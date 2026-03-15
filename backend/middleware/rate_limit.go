package middleware

import (
	"sync"
	"time"
)

// RateLimiter implements a sliding window rate limiter using in-memory storage.
type RateLimiter struct {
	limit    int
	window   time.Duration
	prefix   string
	mu       sync.Mutex
	requests map[string][]time.Time
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

// cleanupLoop periodically removes expired entries to prevent memory leaks
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
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-r.window)
	entries := r.requests[key]
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
