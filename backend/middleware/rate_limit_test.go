package middleware

import (
"testing"
"time"
)

func TestNewRateLimiter(t *testing.T) {
rl := NewRateLimiter(10, time.Minute)
if rl == nil {
t.Fatal("expected non-nil rate limiter")
}
if rl.limit != 10 {
t.Errorf("limit = %d, want 10", rl.limit)
}
if rl.window != time.Minute {
t.Errorf("window = %v, want 1m", rl.window)
}
}

func TestNewRateLimiterWithPrefix(t *testing.T) {
rl := NewRateLimiterWithPrefix(5, 30*time.Second, "custom")
if rl.prefix != "custom" {
t.Errorf("prefix = %q, want 'custom'", rl.prefix)
}
if rl.limit != 5 {
t.Errorf("limit = %d, want 5", rl.limit)
}
}

func TestRateLimiter_AllowInMemory(t *testing.T) {
rl := NewRateLimiter(3, time.Minute)

// First 3 requests should be allowed
for i := 0; i < 3; i++ {
if !rl.Allow("test-key") {
t.Errorf("request %d should be allowed", i+1)
}
}

// 4th request should be denied
if rl.Allow("test-key") {
t.Error("4th request should be denied")
}
}

func TestRateLimiter_DifferentKeys(t *testing.T) {
rl := NewRateLimiter(2, time.Minute)

rl.Allow("key1")
rl.Allow("key1")

// key2 should still be allowed
if !rl.Allow("key2") {
t.Error("different key should be allowed independently")
}
}

func TestRateLimiter_Remaining(t *testing.T) {
rl := NewRateLimiter(5, time.Minute)

if got := rl.Remaining("new-key"); got != 5 {
t.Errorf("Remaining for new key = %d, want 5", got)
}

rl.Allow("test-key")
rl.Allow("test-key")

if got := rl.Remaining("test-key"); got != 3 {
t.Errorf("Remaining after 2 requests = %d, want 3", got)
}
}

func TestRateLimiter_WindowExpiry(t *testing.T) {
rl := NewRateLimiter(2, 50*time.Millisecond)

rl.Allow("key")
rl.Allow("key")

// Should be denied
if rl.Allow("key") {
t.Error("should be denied at limit")
}

// Wait for window to expire
time.Sleep(60 * time.Millisecond)

// Should be allowed again
if !rl.Allow("key") {
t.Error("should be allowed after window expires")
}
}
