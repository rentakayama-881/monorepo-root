package services

import (
	"testing"
	"time"
)

func TestEmailRateLimiterConstants(t *testing.T) {
	if MaxVerificationPerEmail <= 0 {
		t.Error("MaxVerificationPerEmail should be positive")
	}
	if MaxPasswordResetPerEmail <= 0 {
		t.Error("MaxPasswordResetPerEmail should be positive")
	}
	if MaxEmailsPerIP <= 0 {
		t.Error("MaxEmailsPerIP should be positive")
	}
	if EmailRateWindow <= 0 {
		t.Error("EmailRateWindow should be positive")
	}
	if VerificationResendDelay <= 0 {
		t.Error("VerificationResendDelay should be positive")
	}
}

func TestEmailRateLimiter_CanSendVerification_Fresh(t *testing.T) {
	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	allowed, remaining, _ := limiter.CanSendVerification("new@test.com", "1.2.3.4")
	if !allowed {
		t.Error("fresh email should be allowed")
	}
	if remaining != MaxVerificationPerEmail {
		t.Errorf("remaining = %d, want %d", remaining, MaxVerificationPerEmail)
	}
}

func TestEmailRateLimiter_CanSendPasswordReset_Fresh(t *testing.T) {
	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	allowed, remaining, _ := limiter.CanSendPasswordReset("new@test.com", "1.2.3.4")
	if !allowed {
		t.Error("fresh email should be allowed")
	}
	if remaining != MaxPasswordResetPerEmail {
		t.Errorf("remaining = %d, want %d", remaining, MaxPasswordResetPerEmail)
	}
}

func TestEmailRateLimiter_RecordAndCheck(t *testing.T) {
	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	email := "test@rate.com"
	ip := "10.0.0.1"

	// Record max verification emails
	for i := 0; i < MaxVerificationPerEmail; i++ {
		limiter.RecordVerificationSent(email, ip)
	}

	// Wait past the resend delay
	time.Sleep(VerificationResendDelay + 10*time.Millisecond)

	// Should now be rate limited
	allowed, remaining, _ := limiter.CanSendVerification(email, ip)
	if allowed {
		t.Error("should be rate limited after max emails")
	}
	if remaining != 0 {
		t.Errorf("remaining = %d, want 0", remaining)
	}
}

func TestEmailRateLimiter_GetVerificationStatus_Fresh(t *testing.T) {
	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	count, remaining, resetAt := limiter.GetVerificationStatus("fresh@test.com")
	if count != 0 {
		t.Errorf("count = %d, want 0", count)
	}
	if remaining != MaxVerificationPerEmail {
		t.Errorf("remaining = %d, want %d", remaining, MaxVerificationPerEmail)
	}
	if resetAt != nil {
		t.Error("resetAt should be nil for fresh email")
	}
}

func TestEmailRateLimiter_IPLimit(t *testing.T) {
	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	ip := "192.168.1.1"

	// Send from many different emails via same IP
	for i := 0; i < MaxEmailsPerIP; i++ {
		email := "user" + string(rune('a'+i)) + "@test.com"
		limiter.RecordVerificationSent(email, ip)
	}

	// New email from same IP should be blocked
	time.Sleep(VerificationResendDelay + 10*time.Millisecond)
	allowed, _, _ := limiter.CanSendVerification("another@test.com", ip)
	if allowed {
		t.Error("should be rate limited by IP after max emails")
	}
}
