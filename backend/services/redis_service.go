package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"backend-gin/logger"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// RedisClient is the global Redis client instance
var RedisClient *redis.Client

// RedisConfig holds Redis connection configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// InitRedis initializes the Redis connection
// Returns nil if Redis is not configured (optional dependency)
func InitRedis() error {
	redisURL := os.Getenv("REDIS_URL")

	// If REDIS_URL is provided, use it directly (for cloud Redis like Upstash)
	if redisURL == "" {
		// Fallback to individual config values
		host := os.Getenv("REDIS_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("REDIS_PORT")
		if port == "" {
			port = "6379"
		}
		password := os.Getenv("REDIS_PASSWORD")

		RedisClient = redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%s:%s", host, port),
			Password: password,
			DB:       0,
		})

		if err := pingRedisWithTimeout(RedisClient, 5*time.Second); err != nil {
			logger.Error("Failed to connect to Redis", zap.Error(err))
			RedisClient = nil
			return err
		}

		logger.Info("Redis connected successfully")
		return nil
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		logger.Error("Failed to parse REDIS_URL", zap.Error(err))
		return err
	}

	RedisClient = redis.NewClient(opt)
	if err := pingRedisWithTimeout(RedisClient, 5*time.Second); err == nil {
		logger.Info("Redis connected successfully")
		return nil
	}

	// Optional fallback for environments where URL is configured as TLS but endpoint is plain TCP.
	// This is disabled by default and must be explicitly enabled.
	if allowInsecureRedisFallback() && isTLSHandshakeError(err) {
		logger.Warn(
			"Redis TLS handshake failed; retrying without TLS due to REDIS_ALLOW_INSECURE_FALLBACK=true",
			zap.Error(err),
		)

		insecureClient, insecureErr := buildInsecureRedisClient(redisURL)
		if insecureErr != nil {
			logger.Error("Failed to build insecure Redis fallback client", zap.Error(insecureErr))
			RedisClient = nil
			return err
		}

		if pingErr := pingRedisWithTimeout(insecureClient, 5*time.Second); pingErr == nil {
			_ = RedisClient.Close()
			RedisClient = insecureClient
			logger.Warn("Redis connected without TLS fallback")
			return nil
		}

		_ = insecureClient.Close()
	}

	logger.Error("Failed to connect to Redis", zap.Error(err))
	RedisClient = nil
	return err
}

func pingRedisWithTimeout(client *redis.Client, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	_, err := client.Ping(ctx).Result()
	return err
}

func allowInsecureRedisFallback() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("REDIS_ALLOW_INSECURE_FALLBACK")), "true")
}

func isTLSHandshakeError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "tls handshake") ||
		strings.Contains(msg, "first record does not look like a tls handshake")
}

func buildInsecureRedisClient(redisURL string) (*redis.Client, error) {
	parsed, err := url.Parse(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL for fallback: %w", err)
	}

	parsed.Scheme = "redis"
	insecureOpts, err := redis.ParseURL(parsed.String())
	if err != nil {
		return nil, fmt.Errorf("failed to parse insecure redis URL: %w", err)
	}

	// Ensure TLS is disabled explicitly.
	insecureOpts.TLSConfig = nil
	return redis.NewClient(insecureOpts), nil
}

// CloseRedis closes the Redis connection
func CloseRedis() {
	if RedisClient != nil {
		if err := RedisClient.Close(); err != nil {
			logger.Error("Error closing Redis connection", zap.Error(err))
		}
	}
}

// IsRedisAvailable checks if Redis is connected and available
func IsRedisAvailable() bool {
	if RedisClient == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, err := RedisClient.Ping(ctx).Result()
	return err == nil
}

// ============================================================================
// Cache Operations
// ============================================================================

// CacheSet stores a value in Redis with expiration
func CacheSet(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	if RedisClient == nil {
		return nil // Graceful degradation - no-op when Redis unavailable
	}

	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal cache value: %w", err)
	}

	return RedisClient.Set(ctx, key, data, expiration).Err()
}

// CacheGet retrieves a value from Redis
func CacheGet(ctx context.Context, key string, dest interface{}) error {
	if RedisClient == nil {
		return redis.Nil // Treat as cache miss when Redis unavailable
	}

	data, err := RedisClient.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}

	return json.Unmarshal(data, dest)
}

// CacheDelete removes a key from Redis
func CacheDelete(ctx context.Context, keys ...string) error {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.Del(ctx, keys...).Err()
}

// CacheExists checks if a key exists in Redis
func CacheExists(ctx context.Context, key string) (bool, error) {
	if RedisClient == nil {
		return false, nil
	}
	result, err := RedisClient.Exists(ctx, key).Result()
	return result > 0, err
}

// ============================================================================
// Rate Limiting Operations
// ============================================================================

// RateLimitKey generates a rate limit key
func RateLimitKey(prefix, identifier string) string {
	return fmt.Sprintf("ratelimit:%s:%s", prefix, identifier)
}

// CheckRateLimit checks if the rate limit has been exceeded
// Returns (allowed bool, remaining int, resetAt time.Time, error)
func CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, int, time.Time, error) {
	if RedisClient == nil {
		// Graceful degradation - allow request when Redis unavailable
		return true, limit, time.Now().Add(window), nil
	}

	now := time.Now()
	windowStart := now.Truncate(window)
	resetAt := windowStart.Add(window)

	// Use Redis INCR with expiration for sliding window
	pipe := RedisClient.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.ExpireAt(ctx, key, resetAt)

	_, err := pipe.Exec(ctx)
	if err != nil && err != redis.Nil {
		logger.Error("Rate limit check failed", zap.Error(err))
		// Fail open - allow request on error
		return true, limit, resetAt, err
	}

	count := int(incr.Val())
	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}

	return count <= limit, remaining, resetAt, nil
}

// IncrementRateLimit increments the rate limit counter
func IncrementRateLimit(ctx context.Context, key string, window time.Duration) (int64, error) {
	if RedisClient == nil {
		return 0, nil
	}

	pipe := RedisClient.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}

	return incr.Val(), nil
}

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
