package services

import (
	"testing"
	"time"

	"backend-gin/logger"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEmailRateLimiter_VerificationResendDelay(t *testing.T) {
	if logger.Log == nil {
		logger.InitLogger()
	}

	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	email := "resend@example.com"
	ip := "127.0.0.1"

	allowed, _, _ := limiter.CanSendVerification(email, ip)
	require.True(t, allowed)

	limiter.RecordVerificationSent(email, ip)

	allowed, _, retryAt := limiter.CanSendVerification(email, ip)
	require.False(t, allowed)
	require.NotNil(t, retryAt)
	assert.True(t, retryAt.After(time.Now()))
}

func TestEmailRateLimiter_VerificationLimitAfterCooldown(t *testing.T) {
	if logger.Log == nil {
		logger.InitLogger()
	}

	limiter := NewEmailRateLimiter()
	defer limiter.Stop()

	email := "limit@example.com"
	ip := "127.0.0.2"

	// Simulate two successful requests in the current window.
	limiter.RecordVerificationSent(email, ip)
	limiter.RecordVerificationSent(email, ip)

	// Move last request outside short resend delay to verify 24-hour max still applies.
	limiter.mu.Lock()
	record := limiter.verificationReq[email]
	record.LastAt = time.Now().Add(-(VerificationResendDelay + time.Second))
	limiter.mu.Unlock()

	allowed, remaining, retryAt := limiter.CanSendVerification(email, ip)
	require.False(t, allowed)
	assert.Equal(t, 0, remaining)
	require.NotNil(t, retryAt)
	assert.True(t, retryAt.After(time.Now()))
}
