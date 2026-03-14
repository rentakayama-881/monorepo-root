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

var (
	redisPingWithTimeout     = pingRedisWithTimeout
	redisBuildInsecureClient = buildInsecureRedisClient
)

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

		if err := redisPingWithTimeout(RedisClient, 5*time.Second); err != nil {
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
	pingErr := redisPingWithTimeout(RedisClient, 5*time.Second)
	if pingErr == nil {
		logger.Info("Redis connected successfully")
		return nil
	}

	// Optional fallback for environments where URL is configured as TLS but endpoint is plain TCP.
	// This is disabled by default and must be explicitly enabled.
	if allowInsecureRedisFallback() && isTLSHandshakeError(pingErr) {
		logger.Warn(
			"Redis TLS handshake failed; retrying without TLS due to REDIS_ALLOW_INSECURE_FALLBACK=true",
			zap.Error(pingErr),
		)

		insecureClient, insecureErr := redisBuildInsecureClient(redisURL)
		if insecureErr != nil {
			logger.Error("Failed to build insecure Redis fallback client", zap.Error(insecureErr))
			if RedisClient != nil {
				if closeErr := RedisClient.Close(); closeErr != nil {
					logger.Warn("Failed to close Redis client after insecure fallback build error", zap.Error(closeErr))
				}
			}
			RedisClient = nil
			return insecureErr
		}

		if retryPingErr := redisPingWithTimeout(insecureClient, 5*time.Second); retryPingErr == nil {
			if closeErr := RedisClient.Close(); closeErr != nil {
				logger.Warn("Failed to close previous Redis client before fallback swap", zap.Error(closeErr))
			}
			RedisClient = insecureClient
			logger.Warn("Redis connected without TLS fallback")
			return nil
		}

		if closeErr := insecureClient.Close(); closeErr != nil {
			logger.Warn("Failed to close insecure Redis fallback client", zap.Error(closeErr))
		}
	}

	logger.Error("Failed to connect to Redis", zap.Error(pingErr))
	RedisClient = nil
	return pingErr
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


