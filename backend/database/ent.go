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
	if err := applyDomainRenames(ctx, db); err != nil {
		logger.Fatal("Failed to apply domain renames", zap.Error(err))
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
