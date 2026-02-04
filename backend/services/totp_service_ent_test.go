package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"backend-gin/ent"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"go.uber.org/zap"
)

type entSQLDriver struct {
	query func(query string, args []driver.NamedValue) (driver.Rows, error)
	exec  func(query string, args []driver.NamedValue) (driver.Result, error)
}

func (d *entSQLDriver) Open(_ string) (driver.Conn, error) {
	return &entSQLConn{d: d}, nil
}

type entSQLConn struct {
	d *entSQLDriver
}

func (c *entSQLConn) Prepare(query string) (driver.Stmt, error) {
	return &entSQLStmt{c: c, query: query}, nil
}
func (c *entSQLConn) Close() error              { return nil }
func (c *entSQLConn) Begin() (driver.Tx, error) { return &entSQLTx{}, nil }

func (c *entSQLConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if c.d.query == nil {
		return nil, fmt.Errorf("unexpected query: %s", query)
	}
	return c.d.query(query, args)
}

func (c *entSQLConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if c.d.exec == nil {
		return nil, fmt.Errorf("unexpected exec: %s", query)
	}
	return c.d.exec(query, args)
}

type entSQLStmt struct {
	c     *entSQLConn
	query string
}

func (s *entSQLStmt) Close() error { return nil }
func (s *entSQLStmt) NumInput() int {
	// Don't enforce; Ent uses dialect-specific placeholders.
	return -1
}
func (s *entSQLStmt) Exec(args []driver.Value) (driver.Result, error) {
	return s.ExecContext(context.Background(), valuesToNamed(args))
}
func (s *entSQLStmt) Query(args []driver.Value) (driver.Rows, error) {
	return s.QueryContext(context.Background(), valuesToNamed(args))
}
func (s *entSQLStmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	return s.c.ExecContext(ctx, s.query, args)
}
func (s *entSQLStmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	return s.c.QueryContext(ctx, s.query, args)
}

type entSQLTx struct{}

func (t *entSQLTx) Commit() error   { return nil }
func (t *entSQLTx) Rollback() error { return nil }

type entSQLRows struct {
	columns []string
	values  [][]driver.Value
	idx     int
}

func (r *entSQLRows) Columns() []string { return r.columns }
func (r *entSQLRows) Close() error      { return nil }
func (r *entSQLRows) Next(dest []driver.Value) error {
	if r.idx >= len(r.values) {
		return io.EOF
	}
	copy(dest, r.values[r.idx])
	r.idx++
	return nil
}

func valuesToNamed(args []driver.Value) []driver.NamedValue {
	named := make([]driver.NamedValue, 0, len(args))
	for i, v := range args {
		named = append(named, driver.NamedValue{Ordinal: i + 1, Value: v})
	}
	return named
}

func newEntClientWithDriver(t *testing.T, d driver.Driver) *ent.Client {
	t.Helper()

	driverName := fmt.Sprintf("ent-sqldriver-%d", time.Now().UnixNano())
	sql.Register(driverName, d)

	db, err := sql.Open(driverName, "")
	if err != nil {
		t.Fatalf("sql.Open() error: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	drv := entsql.OpenDB(dialect.Postgres, db)
	client := ent.NewClient(ent.Driver(drv))
	t.Cleanup(func() { _ = client.Close() })

	return client
}

func TestEntTOTPService_VerifyBackupCode_AllowsNullOrZeroUsedAt(t *testing.T) {
	testCases := []struct {
		name      string
		usedAtVal any
	}{
		{name: "null_used_at", usedAtVal: nil},
		{name: "zero_used_at", usedAtVal: time.Time{}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			const (
				userID = 123
				code   = "ABCD-EFGH"
			)

			normalizedCode := normalizeBackupCode(code)
			hash := sha256.Sum256([]byte(normalizedCode))
			codeHash := hex.EncodeToString(hash[:])

			legacyFormat := normalizedCode[:BackupCodeLength] + "-" + normalizedCode[BackupCodeLength:]
			legacyHash := sha256.Sum256([]byte(legacyFormat))
			legacyCodeHash := hex.EncodeToString(legacyHash[:])

			var (
				selectQuery string
				updateQuery string
				updateCalls int
			)

			now := time.Now()
			sqlDrv := &entSQLDriver{
				query: func(query string, args []driver.NamedValue) (driver.Rows, error) {
					selectQuery = query

					if !strings.Contains(query, `FROM "backup_codes"`) {
						return nil, fmt.Errorf("unexpected query (not backup_codes): %s", query)
					}
					if !strings.Contains(query, `"backup_codes"."used_at" IS NULL`) || !strings.Contains(query, ` OR `) {
						return nil, fmt.Errorf("expected UsedAt OR clause in query, got: %s", query)
					}
					if !strings.Contains(query, `"backup_codes"."used_at" =`) {
						return nil, fmt.Errorf("expected UsedAt zero-time equality check in query, got: %s", query)
					}

					foundNormalized := false
					foundLegacy := false
					for _, arg := range args {
						switch v := arg.Value.(type) {
						case string:
							if v == codeHash {
								foundNormalized = true
							}
							if v == legacyCodeHash {
								foundLegacy = true
							}
						case []byte:
							s := string(v)
							if s == codeHash {
								foundNormalized = true
							}
							if s == legacyCodeHash {
								foundLegacy = true
							}
						}
					}
					if !foundNormalized || !foundLegacy {
						return nil, fmt.Errorf("expected both normalized and legacy code hashes to be present in query args (foundNormalized=%v foundLegacy=%v)", foundNormalized, foundLegacy)
					}

					return &entSQLRows{
						columns: []string{"id", "created_at", "updated_at", "deleted_at", "code_hash", "used_at", "user_id"},
						values: [][]driver.Value{
							{int64(1), now, now, nil, codeHash, tc.usedAtVal, int64(userID)},
						},
					}, nil
				},
				exec: func(query string, _ []driver.NamedValue) (driver.Result, error) {
					updateQuery = query
					if strings.HasPrefix(query, `UPDATE "backup_codes" SET `) {
						updateCalls++
						return driver.RowsAffected(1), nil
					}
					return nil, fmt.Errorf("unexpected exec: %s", query)
				},
			}

			client := newEntClientWithDriver(t, sqlDrv)
			svc := &EntTOTPService{client: client, logger: zap.NewNop()}

			ok, err := svc.VerifyBackupCode(context.Background(), userID, code)
			if err != nil {
				t.Fatalf("VerifyBackupCode() error: %v", err)
			}
			if !ok {
				t.Fatalf("VerifyBackupCode() ok = false, want true")
			}

			if selectQuery == "" {
				t.Fatalf("expected SELECT query to run")
			}
			if updateQuery == "" || updateCalls != 1 {
				t.Fatalf("expected UPDATE to run exactly once, calls=%d query=%q", updateCalls, updateQuery)
			}
		})
	}
}

func TestEntTOTPService_GetBackupCodeStatus_DoesNotTreatZeroTimeAsUsed(t *testing.T) {
	const userID = 123

	var (
		totalQuery string
		usedQuery  string
	)

	sqlDrv := &entSQLDriver{
		query: func(query string, _ []driver.NamedValue) (driver.Rows, error) {
			if !strings.Contains(query, `FROM "backup_codes"`) || !strings.Contains(query, `COUNT`) {
				return nil, fmt.Errorf("unexpected query: %s", query)
			}

			// total count query: no used_at predicate
			if !strings.Contains(query, `"backup_codes"."used_at"`) {
				totalQuery = query
				return &entSQLRows{
					columns: []string{"count"},
					values:  [][]driver.Value{{int64(10)}},
				}, nil
			}

			// used count query: used_at IS NOT NULL AND used_at <> zero-time
			usedQuery = query
			if !strings.Contains(query, `"backup_codes"."used_at" IS NOT NULL`) {
				return nil, fmt.Errorf("expected used_at IS NOT NULL in used query, got: %s", query)
			}
			if !strings.Contains(query, `"backup_codes"."used_at" <>`) {
				return nil, fmt.Errorf("expected used_at <> zero-time in used query, got: %s", query)
			}
			return &entSQLRows{
				columns: []string{"count"},
				values:  [][]driver.Value{{int64(3)}},
			}, nil
		},
	}

	client := newEntClientWithDriver(t, sqlDrv)
	svc := &EntTOTPService{client: client, logger: zap.NewNop()}

	remaining, total, err := svc.GetBackupCodeStatus(context.Background(), userID)
	if err != nil {
		t.Fatalf("GetBackupCodeStatus() error: %v", err)
	}
	if total != 10 || remaining != 7 {
		t.Fatalf("GetBackupCodeStatus() = (remaining=%d, total=%d), want (7, 10)", remaining, total)
	}

	if totalQuery == "" || usedQuery == "" {
		t.Fatalf("expected both total and used COUNT queries to run")
	}
}
