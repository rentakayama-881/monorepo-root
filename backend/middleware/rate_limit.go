package middleware

import (
	"sync"
	"time"
)

// RateLimiter implements a small in-memory sliding window limiter.
type RateLimiter struct {
	limit    int
	window   time.Duration
	mu       sync.Mutex
	requests map[string][]time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	r := &RateLimiter{limit: limit, window: window, requests: make(map[string][]time.Time)}
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

// cleanup removes all expired entries from the rate limiter
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
