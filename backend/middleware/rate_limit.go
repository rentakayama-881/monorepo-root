package middleware

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// RateLimiter implements a sliding window rate limiter.
// Uses Redis sorted sets for distributed rate limiting when available,
// falls back to in-memory sliding window when Redis is unavailable.
type RateLimiter struct {
	limit       int
	window      time.Duration
	prefix      string
	redisClient *redis.Client
	mu          sync.Mutex
	requests    map[string][]time.Time // in-memory fallback
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return NewRateLimiterWithPrefix(limit, window, "rl")
}

func NewRateLimiterWithPrefix(limit int, window time.Duration, prefix string) *RateLimiter {
	r := &RateLimiter{
		limit:    limit,
		window:   window,
		prefix:   prefix,
		requests: make(map[string][]time.Time),
	}
	go r.cleanupLoop()
	return r
}

// SetRedisClient sets the Redis client for distributed rate limiting.
// When set, the rate limiter uses Redis sorted sets; otherwise falls back to in-memory.
func (r *RateLimiter) SetRedisClient(client *redis.Client) {
	r.redisClient = client
}

// cleanupLoop periodically removes expired entries to prevent memory leaks (in-memory fallback only)
func (r *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(r.window)
	defer ticker.Stop()
	for range ticker.C {
		r.cleanup()
	}
}

// cleanup removes all expired entries from the in-memory rate limiter
func (r *RateLimiter) cleanup() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-r.window)
	for key, entries := range r.requests {
		var filtered []time.Time
		for _, t := range entries {
			if t.After(cutoff) {
				filtered = append(filtered, t)
			}
		}
		if len(filtered) == 0 {
			delete(r.requests, key)
		} else {
			r.requests[key] = filtered
		}
	}
}

func (r *RateLimiter) Allow(key string) bool {
	// Try Redis-based sliding window first
	if r.redisClient != nil {
		allowed, err := r.allowRedis(key)
		if err == nil {
			return allowed
		}
		// Fall through to in-memory on Redis error
	}

	return r.allowInMemory(key)
}

// allowRedis implements sliding window rate limiting using Redis sorted sets.
// Each request is added as a member with the current timestamp as score.
// Old entries outside the window are removed atomically.
func (r *RateLimiter) allowRedis(key string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	redisKey := fmt.Sprintf("ratelimit:%s:%s", r.prefix, key)
	now := time.Now()
	nowMicro := now.UnixMicro()
	cutoff := now.Add(-r.window).UnixMicro()

	// Lua script for atomic sliding window: remove old entries, count, conditionally add
	script := redis.NewScript(`
		local key = KEYS[1]
		local cutoff = tonumber(ARGV[1])
		local now = ARGV[2]
		local limit = tonumber(ARGV[3])
		local window_ms = tonumber(ARGV[4])

		redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
		local count = redis.call('ZCARD', key)
		if count < limit then
			redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
			redis.call('PEXPIRE', key, window_ms)
			return 1
		end
		redis.call('PEXPIRE', key, window_ms)
		return 0
	`)

	windowMs := r.window.Milliseconds()
	result, err := script.Run(ctx, r.redisClient, []string{redisKey},
		cutoff, nowMicro, r.limit, windowMs).Int()
	if err != nil {
		return false, err
	}

	return result == 1, nil
}

// allowInMemory is the original in-memory sliding window fallback
func (r *RateLimiter) allowInMemory(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-r.window)
	entries := r.requests[key]
	// drop old entries
	var filtered []time.Time
	for _, t := range entries {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	if len(filtered) >= r.limit {
		r.requests[key] = filtered
		return false
	}
	filtered = append(filtered, now)
	r.requests[key] = filtered
	return true
}

// Remaining returns the number of remaining requests allowed for the given key
func (r *RateLimiter) Remaining(key string) int {
	if r.redisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		redisKey := fmt.Sprintf("ratelimit:%s:%s", r.prefix, key)
		cutoff := time.Now().Add(-r.window).UnixMicro()

		// Remove old entries and count
		r.redisClient.ZRemRangeByScore(ctx, redisKey, "-inf", strconv.FormatInt(cutoff, 10))
		count, err := r.redisClient.ZCard(ctx, redisKey).Result()
		if err == nil {
			remaining := r.limit - int(count)
			if remaining < 0 {
				remaining = 0
			}
			return remaining
		}
	}

	// Fallback to in-memory count
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-r.window)
	entries := r.requests[key]
	count := 0
	for _, t := range entries {
		if t.After(cutoff) {
			count++
		}
	}
	remaining := r.limit - count
	if remaining < 0 {
		remaining = 0
	}
	return remaining
}
