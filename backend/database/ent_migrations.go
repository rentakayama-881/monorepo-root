package database

import (
	"context"
	"database/sql"

	"backend-gin/logger"

	"go.uber.org/zap"
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
