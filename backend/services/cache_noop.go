package services

import (
	"context"
	"fmt"
	"time"
)

// No-op cache and lock stubs. Redis has been removed; all state lives in-memory
// or in the database. These functions preserve the call-site API so the rest of
// the codebase compiles without changes.

// CacheSet is a no-op without Redis.
func CacheSet(_ context.Context, _ string, _ interface{}, _ time.Duration) error {
	return nil
}

// CacheGet always returns a cache miss without Redis.
func CacheGet(_ context.Context, _ string, _ interface{}) error {
	return fmt.Errorf("cache miss: no backing store")
}

// CacheDelete is a no-op without Redis.
func CacheDelete(_ context.Context, _ ...string) error {
	return nil
}

// CacheExists always returns false without Redis.
func CacheExists(_ context.Context, _ string) (bool, error) {
	return false, nil
}

// RateLimitKey generates a rate limit key.
func RateLimitKey(prefix, identifier string) string {
	return fmt.Sprintf("ratelimit:%s:%s", prefix, identifier)
}

// CheckRateLimit always allows the request without Redis.
func CheckRateLimit(_ context.Context, _ string, limit int, window time.Duration) (bool, int, time.Time, error) {
	return true, limit, time.Now().Add(window), nil
}

// IncrementRateLimit is a no-op without Redis.
func IncrementRateLimit(_ context.Context, _ string, _ time.Duration) (int64, error) {
	return 0, nil
}

// AcquireLock always succeeds without Redis (single-instance mode).
func AcquireLock(_ context.Context, _ string, _ time.Duration) (bool, error) {
	return true, nil
}

// ReleaseLock is a no-op without Redis.
func ReleaseLock(_ context.Context, _ string) error {
	return nil
}

// SessionKey generates a session key.
func SessionKey(sessionID string) string {
	return fmt.Sprintf("session:%s", sessionID)
}

// UserSessionsKey generates a key for user's session list.
func UserSessionsKey(userID string) string {
	return fmt.Sprintf("user_sessions:%s", userID)
}

// StoreSession is a no-op without Redis.
func StoreSession(_ context.Context, _ string, _ interface{}, _ time.Duration) error {
	return nil
}

// GetSession always returns a cache miss without Redis.
func GetSession(_ context.Context, _ string, _ interface{}) error {
	return fmt.Errorf("cache miss: no backing store")
}

// DeleteSession is a no-op without Redis.
func DeleteSession(_ context.Context, _ string) error {
	return nil
}

// Cache key prefixes and TTLs.
const (
	CacheKeyValidationCases = "validation_cases"
	CacheKeyValidationCase  = "validation_case"
	CacheKeyUser            = "user"
	CacheKeyCategories      = "categories"
	CacheKeyUserProfile     = "user_profile"

	CacheTTLShort   = 1 * time.Minute
	CacheTTLMedium  = 5 * time.Minute
	CacheTTLLong    = 30 * time.Minute
	CacheTTLSession = 24 * time.Hour
)

// ValidationCaseCacheKey generates cache key for a Validation Case.
func ValidationCaseCacheKey(validationCaseID string) string {
	return fmt.Sprintf("%s:%s", CacheKeyValidationCase, validationCaseID)
}

// ValidationCaseListCacheKey generates cache key for Validation Case Index.
func ValidationCaseListCacheKey(page, limit int, category string) string {
	return fmt.Sprintf("%s:list:%s:%d:%d", CacheKeyValidationCases, category, page, limit)
}

// UserProfileCacheKey generates cache key for user profile.
func UserProfileCacheKey(userID string) string {
	return fmt.Sprintf("%s:%s", CacheKeyUserProfile, userID)
}

// InvalidateValidationCaseCache is a no-op without Redis.
func InvalidateValidationCaseCache(_ context.Context, _ string) error {
	return nil
}

// InvalidateUserCache is a no-op without Redis.
func InvalidateUserCache(_ context.Context, _ string) error {
	return nil
}
