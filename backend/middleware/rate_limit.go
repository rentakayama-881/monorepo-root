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
	return &RateLimiter{limit: limit, window: window, requests: make(map[string][]time.Time)}
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
