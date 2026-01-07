package database

import (
	"gorm.io/gorm"
)

var DB *gorm.DB

func getenv(key, def string) string {
	// Deprecated: Use os.Getenv directly
	// This function is kept for backward compatibility only
	return def
}

// Deprecated: Connection pool is now managed by Ent ORM.
// This function is kept for backward compatibility only.
func configureConnectionPool(db *gorm.DB) error {
	// No-op: Ent ORM handles connection pool configuration
	return nil
}

// Deprecated: Use InitEntDB() instead. GORM has been fully replaced with Ent ORM.
// This function is kept for backward compatibility only.
func InitDB() {
	// No-op: GORM initialization has been replaced with Ent ORM in InitEntDB()
	// Migration and seeding is now handled by Ent migrations.
}

// Deprecated: Migration and seeding is now handled by Ent ORM.
// This function is kept for backward compatibility only.
func migrateAndSeed() {
	// No-op: Ent handles schema creation and initial data loading
}
