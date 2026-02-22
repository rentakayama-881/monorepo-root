package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"backend-gin/ent"
	"backend-gin/logger"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"go.uber.org/zap"
)

var (
	EntClient *ent.Client
	SQLDB     *sql.DB
)

func tableExists(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, name string) (bool, error) {
	var reg sql.NullString
	if err := q.QueryRowContext(ctx, `SELECT to_regclass($1)`, "public."+name).Scan(&reg); err != nil {
		return false, err
	}
	return reg.Valid && reg.String != "", nil
}

func columnExists(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, table, column string) (bool, error) {
	var exists bool
	if err := q.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = $2
		)
	`, table, column).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func constraintExists(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, constraintName string) (bool, error) {
	var exists bool
	if err := q.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM pg_constraint
			WHERE conname = $1
		)
	`, constraintName).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func indexExists(ctx context.Context, q interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}, indexName string) (bool, error) {
	var exists bool
	if err := q.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM pg_indexes
			WHERE schemaname = 'public'
			  AND indexname = $1
		)
	`, indexName).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

// applyDomainRenames performs an idempotent, production-safe rename from legacy "thread" naming
// to the new "validation case" naming at the DB level.
//
// This runs BEFORE Ent schema migration so the generated schema matches the physical tables.
func applyDomainRenames(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	threadsExists, err := tableExists(ctx, tx, "threads")
	if err != nil {
		return err
	}
	validationCasesExists, err := tableExists(ctx, tx, "validation_cases")
	if err != nil {
		return err
	}
	if threadsExists && !validationCasesExists {
		if _, err := tx.ExecContext(ctx, `ALTER TABLE threads RENAME TO validation_cases`); err != nil {
			return err
		}
	}

	tagThreadsExists, err := tableExists(ctx, tx, "tag_threads")
	if err != nil {
		return err
	}
	tagValidationCasesExists, err := tableExists(ctx, tx, "tag_validation_cases")
	if err != nil {
		return err
	}
	if tagThreadsExists && !tagValidationCasesExists {
		if _, err := tx.ExecContext(ctx, `ALTER TABLE tag_threads RENAME TO tag_validation_cases`); err != nil {
			return err
		}
	}

	// Join table column rename so Ent M2M edge matches.
	joinTableExists, err := tableExists(ctx, tx, "tag_validation_cases")
	if err != nil {
		return err
	}
	if joinTableExists {
		threadIDExists, err := columnExists(ctx, tx, "tag_validation_cases", "thread_id")
		if err != nil {
			return err
		}
		validationCaseIDExists, err := columnExists(ctx, tx, "tag_validation_cases", "validation_case_id")
		if err != nil {
			return err
		}
		if threadIDExists && !validationCaseIDExists {
			if _, err := tx.ExecContext(ctx, `ALTER TABLE tag_validation_cases RENAME COLUMN thread_id TO validation_case_id`); err != nil {
				return err
			}
		}
	}

	// Legacy compatibility:
	// Some older deployments still have thread_credentials.thread_id FK pointing to validation_cases
	// with NO ACTION, which can block deleting open cases. Normalize it to ON DELETE CASCADE.
	threadCredTableExists, err := tableExists(ctx, tx, "thread_credentials")
	if err != nil {
		return err
	}
	if threadCredTableExists {
		threadIDExists, err := columnExists(ctx, tx, "thread_credentials", "thread_id")
		if err != nil {
			return err
		}
		if threadIDExists {
			oldFK := "thread_credentials_threads_received_credentials"
			oldFKExists, err := constraintExists(ctx, tx, oldFK)
			if err != nil {
				return err
			}
			if oldFKExists {
				if _, err := tx.ExecContext(ctx, `ALTER TABLE thread_credentials DROP CONSTRAINT thread_credentials_threads_received_credentials`); err != nil {
					return err
				}
			}

			newFK := "thread_credentials_validation_cases_received_credentials"
			newFKExists, err := constraintExists(ctx, tx, newFK)
			if err != nil {
				return err
			}
			if !newFKExists {
				if _, err := tx.ExecContext(ctx, `
					ALTER TABLE thread_credentials
					ADD CONSTRAINT thread_credentials_validation_cases_received_credentials
					FOREIGN KEY (thread_id) REFERENCES validation_cases(id) ON DELETE CASCADE
				`); err != nil {
					return err
				}
			}
		}
	}

	return tx.Commit()
}

func applyWorkflowCycleMigrations(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	statements := []string{
		`ALTER TABLE validation_cases ADD COLUMN IF NOT EXISTS workflow_cycle INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE consultation_requests ADD COLUMN IF NOT EXISTS workflow_cycle INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE final_offers ADD COLUMN IF NOT EXISTS workflow_cycle INTEGER NOT NULL DEFAULT 1`,
		`UPDATE validation_cases SET workflow_cycle = 1 WHERE workflow_cycle < 1`,
		`UPDATE consultation_requests SET workflow_cycle = 1 WHERE workflow_cycle < 1`,
		`UPDATE final_offers SET workflow_cycle = 1 WHERE workflow_cycle < 1`,
	}

	for _, stmt := range statements {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}

	// Legacy index blocked validators from re-requesting after dispute refund.
	legacyIndexName := "consultationrequest_validation_case_id_validator_user_id"
	legacyExists, err := indexExists(ctx, tx, legacyIndexName)
	if err != nil {
		return err
	}
	if legacyExists {
		if _, err := tx.ExecContext(ctx, `DROP INDEX IF EXISTS consultationrequest_validation_case_id_validator_user_id`); err != nil {
			return err
		}
	}

	indexStatements := []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS consultationrequest_validation_case_id_validator_user_id_workflow_cycle ON consultation_requests (validation_case_id, validator_user_id, workflow_cycle)`,
		`CREATE INDEX IF NOT EXISTS consultationrequest_validation_case_id_workflow_cycle ON consultation_requests (validation_case_id, workflow_cycle)`,
		`CREATE INDEX IF NOT EXISTS consultationrequest_validator_user_id_status_workflow_cycle ON consultation_requests (validator_user_id, status, workflow_cycle)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS finaloffer_validation_case_id_validator_user_id_workflow_cycle ON final_offers (validation_case_id, validator_user_id, workflow_cycle)`,
	}
	for _, stmt := range indexStatements {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// applyWorkflowCyclePreSchemaCleanup prepares legacy data before Ent tries to create
// unique workflow_cycle indexes. This prevents startup crash loops on historical duplicates.
func applyWorkflowCyclePreSchemaCleanup(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	validationCasesExists, err := tableExists(ctx, tx, "validation_cases")
	if err != nil {
		return err
	}
	if validationCasesExists {
		if _, err := tx.ExecContext(ctx, `ALTER TABLE validation_cases ADD COLUMN IF NOT EXISTS workflow_cycle INTEGER NOT NULL DEFAULT 1`); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE validation_cases SET workflow_cycle = 1 WHERE workflow_cycle < 1`); err != nil {
			return err
		}
	}

	consultationRequestsExists, err := tableExists(ctx, tx, "consultation_requests")
	if err != nil {
		return err
	}
	if consultationRequestsExists {
		if _, err := tx.ExecContext(ctx, `ALTER TABLE consultation_requests ADD COLUMN IF NOT EXISTS workflow_cycle INTEGER NOT NULL DEFAULT 1`); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE consultation_requests SET workflow_cycle = 1 WHERE workflow_cycle < 1`); err != nil {
			return err
		}

		res, err := tx.ExecContext(ctx, `
			WITH ranked AS (
				SELECT
					cr.id,
					ROW_NUMBER() OVER (
						PARTITION BY cr.validation_case_id, cr.validator_user_id, cr.workflow_cycle
						ORDER BY cr.created_at DESC, cr.id DESC
					) AS rn
				FROM consultation_requests cr
			)
			DELETE FROM consultation_requests cr
			USING ranked r
			WHERE cr.id = r.id
			  AND r.rn > 1
		`)
		if err != nil {
			return err
		}
		if deleted, _ := res.RowsAffected(); deleted > 0 {
			logger.Warn("Deduplicated consultation_requests before schema migration", zap.Int64("rows_deleted", deleted))
		}
	}

	finalOffersExists, err := tableExists(ctx, tx, "final_offers")
	if err != nil {
		return err
	}
	if finalOffersExists {
		if _, err := tx.ExecContext(ctx, `ALTER TABLE final_offers ADD COLUMN IF NOT EXISTS workflow_cycle INTEGER NOT NULL DEFAULT 1`); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE final_offers SET workflow_cycle = 1 WHERE workflow_cycle < 1`); err != nil {
			return err
		}

		// Keep the accepted final offer if linked from validation_cases; otherwise keep newest row.
		res, err := tx.ExecContext(ctx, `
			WITH ranked AS (
				SELECT
					fo.id,
					ROW_NUMBER() OVER (
						PARTITION BY fo.validation_case_id, fo.validator_user_id, fo.workflow_cycle
						ORDER BY
							CASE
								WHEN vc.accepted_final_offer_id = fo.id THEN 0
								ELSE 1
							END ASC,
							fo.created_at DESC,
							fo.id DESC
					) AS rn
				FROM final_offers fo
				LEFT JOIN validation_cases vc ON vc.id = fo.validation_case_id
			)
			DELETE FROM final_offers fo
			USING ranked r
			WHERE fo.id = r.id
			  AND r.rn > 1
		`)
		if err != nil {
			return err
		}
		if deleted, _ := res.RowsAffected(); deleted > 0 {
			logger.Warn("Deduplicated final_offers before schema migration", zap.Int64("rows_deleted", deleted))
		}
	}

	return tx.Commit()
}

// InitEntDB initializes the Ent client and SQL DB connection.
func InitEntDB() {
	// Prefer DATABASE_URL (recommended for Neon)
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Fallback to individual env vars
		host := os.Getenv("DB_HOST")
		user := os.Getenv("DB_USER")
		pass := os.Getenv("DB_PASS")
		name := os.Getenv("DB_NAME")
		port := os.Getenv("DB_PORT")
		sslmode := os.Getenv("DB_SSLMODE")

		if port == "" {
			port = "5432"
		}
		if sslmode == "" {
			// Neon requires SSL; "require" is a safe default
			sslmode = "require"
		}

		if host == "" || user == "" || name == "" {
			logger.Fatal("Missing database env vars. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASS/DB_NAME.", zap.String("DB_HOST", host), zap.String("DB_USER", user), zap.String("DB_NAME", name))
		}

		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
			host, user, pass, name, port, sslmode,
		)
	}

	// ---------------------------------------------------------
	// FIX: PGX + Simple Protocol
	// Avoids "unnamed prepared statement does not exist"
	// and bind parameter mismatch issues under pooling.
	// ---------------------------------------------------------
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		logger.Fatal("Failed to parse database config", zap.Error(err))
	}

	// IMPORTANT: disable prepared statements usage
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// Optional timezone support
	// If you want timezone, set DB_TIMEZONE env to e.g. "Asia/Jakarta"
	if tz := os.Getenv("DB_TIMEZONE"); tz != "" {
		if cfg.RuntimeParams == nil {
			cfg.RuntimeParams = map[string]string{}
		}
		cfg.RuntimeParams["timezone"] = tz
	}

	// Open database/sql DB from pgx config
	db := stdlib.OpenDB(*cfg)

	// Connection pool tuning (safe defaults for Neon)
	db.SetMaxIdleConns(5)
	db.SetMaxOpenConns(20)
	db.SetConnMaxIdleTime(5 * time.Minute)
	db.SetConnMaxLifetime(30 * time.Minute)

	// Verify connectivity quickly
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		logger.Fatal("Failed to ping database", zap.Error(err))
	}

	// One-time naming migration (Thread -> Validation Case) to keep DB aligned with domain terminology.
	// Idempotent and safe: runs only when old tables exist and new tables do not.
	// Do not fail service startup if this step times out due transient DB contention.
	renameCtx, renameCancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer renameCancel()
	if err := applyDomainRenames(renameCtx, db); err != nil {
		logger.Warn("Skipping domain rename migration on startup", zap.Error(err))
	}

	preSchemaCtx, preSchemaCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer preSchemaCancel()
	if err := applyWorkflowCyclePreSchemaCleanup(preSchemaCtx, db); err != nil {
		logger.Fatal("Failed to prepare workflow cycle migrations", zap.Error(err))
	}

	SQLDB = db

	// Create Ent driver and client
	drv := entsql.OpenDB(dialect.Postgres, db)
	EntClient = ent.NewClient(ent.Driver(drv))

	// Run migrations (optional depending on your setup)
	// If you use Atlas/Ent migration files, keep this.
	// If you manage migrations externally, you can remove/comment it.
	ctx2, cancel2 := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel2()
	if err := EntClient.Schema.Create(ctx2); err != nil {
		logger.Fatal("Failed to run Ent migrations", zap.Error(err))
	}

	cycleCtx, cycleCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cycleCancel()
	if err := applyWorkflowCycleMigrations(cycleCtx, db); err != nil {
		logger.Fatal("Failed to apply workflow cycle migrations", zap.Error(err))
	}

	logger.Info("Ent database initialized successfully (PGX Simple Protocol)")
}

// CloseEntDB closes Ent client and SQL DB.
func CloseEntDB() {
	if EntClient != nil {
		if err := EntClient.Close(); err != nil {
			logger.Error("Failed to close Ent client", zap.Error(err))
		}
	}
	if SQLDB != nil {
		if err := SQLDB.Close(); err != nil {
			logger.Error("Failed to close SQL DB", zap.Error(err))
		}
	}
}

// GetEntClient returns the global Ent client.
func GetEntClient() *ent.Client {
	return EntClient
}

// GetSQLDB returns the global SQL DB handle.
func GetSQLDB() *sql.DB {
	return SQLDB
}
