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
	
	// HAPUS lib/pq, GANTI dengan pgx
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	
	"go.uber.org/zap"
)

// EntClient is the global Ent client instance
var EntClient *ent.Client

// getenv returns the value of the environment variable or the default value
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// SQLDB holds the underlying *sql.DB used by Ent
var SQLDB *sql.DB

// InitEntDB initializes the Ent database client
func InitEntDB() {
	var dsn string

	// Prefer DATABASE_URL if provided
	if url := os.Getenv("DATABASE_URL"); url != "" {
		dsn = url
	} else {
		host := getenv("DB_HOST", "localhost")
		user := getenv("DB_USER", "postgres")
		pass := getenv("DB_PASSWORD", "")
		name := getenv("DB_NAME", "ballerina_dev")
		port := getenv("DB_PORT", "5432")
		sslmode := getenv("DB_SSLMODE", "disable")
		timezone := getenv("DB_TIMEZONE", "UTC")

		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
			host, user, pass, name, port, sslmode, timezone)
	}

	// ---------------------------------------------------------
	// FIX UTAMA: Menggunakan PGX dengan SimpleProtocol
	// ---------------------------------------------------------
	
	// 1. Parse config dari DSN string
	config, err := pgx.ParseConfig(dsn)
	if err != nil {
		logger.Fatal("Failed to parse database config", zap.Error(err))
	}

	// 2. MATIKAN Prepared Statements (Solusi Error 500/Unnamed Statement)
	config.PreferSimpleProtocol = true

	// 3. Buka koneksi menggunakan driver pgx stdlib
	db := stdlib.OpenDB(*config)

	// ---------------------------------------------------------

	// Configure connection pool
	db.SetMaxIdleConns(10)
	db.SetMaxOpenConns(100)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(10 * time.Minute)

	// Assign global SQL handle
	SQLDB = db

	// Create Ent driver (gunakan dialect.Postgres)
	drv := entsql.OpenDB(dialect.Postgres, db)

	// Create Ent client
	EntClient = ent.NewClient(ent.Driver(drv))

	// Run migrations
	ctx := context.Background()
	if err := EntClient.Schema.Create(ctx); err != nil {
		logger.Fatal("Failed to run Ent migrations", zap.Error(err))
	}

	logger.Info("Ent database initialized successfully (PGX Simple Protocol)")
}

// CloseEntDB closes the Ent client connection
func CloseEntDB() {
	if EntClient != nil {
		if err := EntClient.Close(); err != nil {
			logger.Error("Error closing Ent client", zap.Error(err))
		}
	}
}

// GetEntClient returns the global Ent client
func GetEntClient() *ent.Client {
	return EntClient
}

// GetSQLDB returns the underlying *sql.DB for raw SQL operations
func GetSQLDB() *sql.DB {
	return SQLDB
}

