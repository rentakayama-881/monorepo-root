package services

import (
	"context"
	"testing"
	"time"
)

func TestCacheSet_ReturnsNil(t *testing.T) {
	err := CacheSet(context.Background(), "key", "value", time.Minute)
	if err != nil {
		t.Errorf("CacheSet should return nil, got: %v", err)
	}
}

func TestCacheGet_ReturnsCacheMiss(t *testing.T) {
	var dst string
	err := CacheGet(context.Background(), "key", &dst)
	if err == nil {
		t.Error("CacheGet should return an error (cache miss)")
	}
}

func TestCacheDelete_ReturnsNil(t *testing.T) {
	err := CacheDelete(context.Background(), "k1", "k2")
	if err != nil {
		t.Errorf("CacheDelete should return nil, got: %v", err)
	}
}

func TestCacheExists_ReturnsFalse(t *testing.T) {
	exists, err := CacheExists(context.Background(), "key")
	if err != nil {
		t.Errorf("CacheExists should not error, got: %v", err)
	}
	if exists {
		t.Error("CacheExists should return false")
	}
}

func TestRateLimitKey(t *testing.T) {
	tests := []struct {
		prefix, id string
		want       string
	}{
		{"login", "user1", "ratelimit:login:user1"},
		{"api", "10.0.0.1", "ratelimit:api:10.0.0.1"},
	}

	for _, tt := range tests {
		got := RateLimitKey(tt.prefix, tt.id)
		if got != tt.want {
			t.Errorf("RateLimitKey(%q, %q) = %q, want %q", tt.prefix, tt.id, got, tt.want)
		}
	}
}

func TestCheckRateLimit_AlwaysAllows(t *testing.T) {
	allowed, remaining, _, err := CheckRateLimit(context.Background(), "key", 100, time.Minute)
	if err != nil {
		t.Errorf("CheckRateLimit should not error, got: %v", err)
	}
	if !allowed {
		t.Error("CheckRateLimit should always allow")
	}
	if remaining != 100 {
		t.Errorf("remaining = %d, want 100", remaining)
	}
}

func TestIncrementRateLimit_ReturnsZero(t *testing.T) {
	count, err := IncrementRateLimit(context.Background(), "key", time.Minute)
	if err != nil {
		t.Errorf("IncrementRateLimit should not error, got: %v", err)
	}
	if count != 0 {
		t.Errorf("count = %d, want 0", count)
	}
}

func TestAcquireLock_AlwaysSucceeds(t *testing.T) {
	acquired, err := AcquireLock(context.Background(), "lock-key", time.Second)
	if err != nil {
		t.Errorf("AcquireLock should not error, got: %v", err)
	}
	if !acquired {
		t.Error("AcquireLock should always succeed")
	}
}

func TestReleaseLock_ReturnsNil(t *testing.T) {
	err := ReleaseLock(context.Background(), "lock-key")
	if err != nil {
		t.Errorf("ReleaseLock should return nil, got: %v", err)
	}
}

func TestSessionKey(t *testing.T) {
	got := SessionKey("sess-abc")
	if got != "session:sess-abc" {
		t.Errorf("SessionKey = %q, want %q", got, "session:sess-abc")
	}
}

func TestUserSessionsKey(t *testing.T) {
	got := UserSessionsKey("user-123")
	if got != "user_sessions:user-123" {
		t.Errorf("UserSessionsKey = %q, want %q", got, "user_sessions:user-123")
	}
}

func TestStoreSession_ReturnsNil(t *testing.T) {
	err := StoreSession(context.Background(), "sess", nil, time.Hour)
	if err != nil {
		t.Errorf("StoreSession should return nil, got: %v", err)
	}
}

func TestGetSession_ReturnsCacheMiss(t *testing.T) {
	var dst string
	err := GetSession(context.Background(), "sess", &dst)
	if err == nil {
		t.Error("GetSession should return an error (cache miss)")
	}
}

func TestDeleteSession_ReturnsNil(t *testing.T) {
	err := DeleteSession(context.Background(), "sess")
	if err != nil {
		t.Errorf("DeleteSession should return nil, got: %v", err)
	}
}

func TestValidationCaseCacheKey(t *testing.T) {
	got := ValidationCaseCacheKey("vc-42")
	want := "validation_case:vc-42"
	if got != want {
		t.Errorf("ValidationCaseCacheKey = %q, want %q", got, want)
	}
}

func TestValidationCaseListCacheKey(t *testing.T) {
	got := ValidationCaseListCacheKey(1, 10, "ai-review")
	want := "validation_cases:list:ai-review:1:10"
	if got != want {
		t.Errorf("ValidationCaseListCacheKey = %q, want %q", got, want)
	}
}

func TestUserProfileCacheKey(t *testing.T) {
	got := UserProfileCacheKey("uid-99")
	want := "user_profile:uid-99"
	if got != want {
		t.Errorf("UserProfileCacheKey = %q, want %q", got, want)
	}
}

func TestInvalidateValidationCaseCache_ReturnsNil(t *testing.T) {
	err := InvalidateValidationCaseCache(context.Background(), "vc-42")
	if err != nil {
		t.Errorf("InvalidateValidationCaseCache should return nil, got: %v", err)
	}
}

func TestInvalidateUserCache_ReturnsNil(t *testing.T) {
	err := InvalidateUserCache(context.Background(), "uid-99")
	if err != nil {
		t.Errorf("InvalidateUserCache should return nil, got: %v", err)
	}
}
