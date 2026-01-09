package database

// Deprecated: GORM has been replaced with Ent ORM.
// This file is kept for backward compatibility comments only.
// All database operations should now use Ent ORM via GetEntClient().

// The following functions are deprecated no-ops kept for reference:
// - InitDB() -> Use InitEntDB() instead
// - migrateAndSeed() -> Ent handles migrations
// - DB variable -> Use GetEntClient() instead
