package services

import (
	"context"
	"fmt"
	"time"
)

// ============================================================================
// Session Operations
// ============================================================================

// SessionKey generates a session key
func SessionKey(sessionID string) string {
	return fmt.Sprintf("session:%s", sessionID)
}

// UserSessionsKey generates a key for user's session list
func UserSessionsKey(userID string) string {
	return fmt.Sprintf("user_sessions:%s", userID)
}

// StoreSession stores session data in Redis
func StoreSession(ctx context.Context, sessionID string, data interface{}, expiration time.Duration) error {
	return CacheSet(ctx, SessionKey(sessionID), data, expiration)
}

// GetSession retrieves session data from Redis
func GetSession(ctx context.Context, sessionID string, dest interface{}) error {
	return CacheGet(ctx, SessionKey(sessionID), dest)
}

// DeleteSession removes a session from Redis
func DeleteSession(ctx context.Context, sessionID string) error {
	return CacheDelete(ctx, SessionKey(sessionID))
}

// ============================================================================
// Distributed Lock Operations
// ============================================================================

// AcquireLock tries to acquire a distributed lock
func AcquireLock(ctx context.Context, key string, expiration time.Duration) (bool, error) {
	if RedisClient == nil {
		return true, nil // Allow operation when Redis unavailable
	}

	lockKey := fmt.Sprintf("lock:%s", key)
	result, err := RedisClient.SetNX(ctx, lockKey, "1", expiration).Result()
	return result, err
}

// ReleaseLock releases a distributed lock
func ReleaseLock(ctx context.Context, key string) error {
	if RedisClient == nil {
		return nil
	}

	lockKey := fmt.Sprintf("lock:%s", key)
	return RedisClient.Del(ctx, lockKey).Err()
}

// ============================================================================
// Cache Keys Constants
// ============================================================================

const (
	// Cache key prefixes
	CacheKeyValidationCases = "validation_cases"
	CacheKeyValidationCase  = "validation_case"
	CacheKeyUser            = "user"
	CacheKeyCategories      = "categories"
	CacheKeyUserProfile     = "user_profile"

	// Default cache TTLs
	CacheTTLShort   = 1 * time.Minute
	CacheTTLMedium  = 5 * time.Minute
	CacheTTLLong    = 30 * time.Minute
	CacheTTLSession = 24 * time.Hour
)

// ValidationCaseCacheKey generates cache key for a Validation Case.
func ValidationCaseCacheKey(validationCaseID string) string {
	return fmt.Sprintf("%s:%s", CacheKeyValidationCase, validationCaseID)
}

// ValidationCaseListCacheKey generates cache key for Validation Case Index (filtered list).
func ValidationCaseListCacheKey(page, limit int, category string) string {
	return fmt.Sprintf("%s:list:%s:%d:%d", CacheKeyValidationCases, category, page, limit)
}

// UserProfileCacheKey generates cache key for user profile
func UserProfileCacheKey(userID string) string {
	return fmt.Sprintf("%s:%s", CacheKeyUserProfile, userID)
}

// InvalidateValidationCaseCache removes Validation Case-related cache entries.
func InvalidateValidationCaseCache(ctx context.Context, validationCaseID string) error {
	if RedisClient == nil {
		return nil
	}

	// Delete specific validation case cache
	if err := CacheDelete(ctx, ValidationCaseCacheKey(validationCaseID)); err != nil {
		return err
	}

	// Delete validation case list caches (pattern-based)
	pattern := fmt.Sprintf("%s:list:*", CacheKeyValidationCases)
	keys, err := RedisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return err
	}

	if len(keys) > 0 {
		return CacheDelete(ctx, keys...)
	}

	return nil
}

// InvalidateUserCache removes user-related cache entries
func InvalidateUserCache(ctx context.Context, userID string) error {
	return CacheDelete(ctx, UserProfileCacheKey(userID))
}
