package services

import (
	"sync"
	"time"

	"backend-gin/logger"

	"go.uber.org/zap"
)

// EmailRateLimiter tracks email sending rate limits for verification and password reset
type EmailRateLimiter struct {
	mu               sync.RWMutex
	verificationReq  map[string]*emailRateRecord // Key: email
	passwordResetReq map[string]*emailRateRecord // Key: email
	ipRequests       map[string]*ipRateRecord    // Key: IP address
	cleanupTicker    *time.Ticker
}

type emailRateRecord struct {
	Count   int
	FirstAt time.Time
	LastAt  time.Time
}

type ipRateRecord struct {
	VerificationCount  int
	PasswordResetCount int
	FirstAt            time.Time
	LastAt             time.Time
}

// Configuration constants
const (
	MaxVerificationPerEmail  = 2                // Max 2 verification emails per email per 24h
	MaxPasswordResetPerEmail = 3                // Max 3 password reset emails per email per 24h
	MaxEmailsPerIP           = 10               // Max 10 total emails per IP per 24h
	EmailRateWindow          = 24 * time.Hour   // 24 hour window
	EmailCleanupInterval     = 30 * time.Minute // Cleanup old records every 30 minutes
	VerificationResendDelay  = 60 * time.Second // Enforce minimum delay between verification resends
)

// Global email rate limiter instance
var emailRateLimiter *EmailRateLimiter

// InitEmailRateLimiter initializes the global email rate limiter
func InitEmailRateLimiter() {
	emailRateLimiter = NewEmailRateLimiter()
	logger.Info("Email rate limiter initialized")
}

// GetEmailRateLimiter returns the global email rate limiter instance
func GetEmailRateLimiter() *EmailRateLimiter {
	return emailRateLimiter
}

// NewEmailRateLimiter creates a new email rate limiter
func NewEmailRateLimiter() *EmailRateLimiter {
	limiter := &EmailRateLimiter{
		verificationReq:  make(map[string]*emailRateRecord),
		passwordResetReq: make(map[string]*emailRateRecord),
		ipRequests:       make(map[string]*ipRateRecord),
	}

	// Start background cleanup goroutine
	limiter.cleanupTicker = time.NewTicker(EmailCleanupInterval)
	go limiter.cleanupLoop()

	return limiter
}

// cleanupLoop periodically cleans up old records
func (e *EmailRateLimiter) cleanupLoop() {
	for range e.cleanupTicker.C {
		e.cleanup()
	}
}

// cleanup removes expired rate records
func (e *EmailRateLimiter) cleanup() {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-EmailRateWindow)

	// Cleanup verification records
	for key, record := range e.verificationReq {
		if record.LastAt.Before(cutoff) {
			delete(e.verificationReq, key)
		}
	}

	// Cleanup password reset records
	for key, record := range e.passwordResetReq {
		if record.LastAt.Before(cutoff) {
			delete(e.passwordResetReq, key)
		}
	}

	// Cleanup IP records
	for key, record := range e.ipRequests {
		if record.LastAt.Before(cutoff) {
			delete(e.ipRequests, key)
		}
	}
}

// CanSendVerification checks if a verification email can be sent
// Returns (allowed, remainingCount, nextAllowedTime)
func (e *EmailRateLimiter) CanSendVerification(email, ip string) (bool, int, *time.Time) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	now := time.Now()
	cutoff := now.Add(-EmailRateWindow)

	// Check email-based limit
	if record, exists := e.verificationReq[email]; exists {
		// Reset if outside window
		if record.FirstAt.Before(cutoff) {
			// Will be allowed, record will reset on actual send
		} else {
			// Enforce short cooldown between resend attempts (platform-like retry window).
			retryAt := record.LastAt.Add(VerificationResendDelay)
			if retryAt.After(now) {
				remaining := MaxVerificationPerEmail - record.Count
				if remaining < 0 {
					remaining = 0
				}
				return false, remaining, &retryAt
			}

			if record.Count >= MaxVerificationPerEmail {
				nextAllowed := record.FirstAt.Add(EmailRateWindow)
				return false, 0, &nextAllowed
			}
		}
	}

	// Check IP-based limit
	if ipRecord, exists := e.ipRequests[ip]; exists {
		if ipRecord.FirstAt.Before(cutoff) {
			// Will be allowed, record will reset on actual send
		} else {
			totalCount := ipRecord.VerificationCount + ipRecord.PasswordResetCount
			if totalCount >= MaxEmailsPerIP {
				nextAllowed := ipRecord.FirstAt.Add(EmailRateWindow)
				return false, 0, &nextAllowed
			}
		}
	}

	// Calculate remaining
	remaining := MaxVerificationPerEmail
	if record, exists := e.verificationReq[email]; exists && record.FirstAt.After(cutoff) {
		remaining = MaxVerificationPerEmail - record.Count
	}

	return true, remaining, nil
}

// RecordVerificationSent records a verification email being sent
func (e *EmailRateLimiter) RecordVerificationSent(email, ip string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-EmailRateWindow)

	// Update email record
	record, exists := e.verificationReq[email]
	if !exists || record.FirstAt.Before(cutoff) {
		record = &emailRateRecord{
			Count:   0,
			FirstAt: now,
		}
		e.verificationReq[email] = record
	}
	record.Count++
	record.LastAt = now

	// Update IP record
	ipRecord, exists := e.ipRequests[ip]
	if !exists || ipRecord.FirstAt.Before(cutoff) {
		ipRecord = &ipRateRecord{
			FirstAt: now,
		}
		e.ipRequests[ip] = ipRecord
	}
	ipRecord.VerificationCount++
	ipRecord.LastAt = now

	logger.Info("Verification email request recorded",
		zap.String("email", email),
		zap.String("ip", ip),
		zap.Int("email_count", record.Count),
		zap.Int("ip_total_count", ipRecord.VerificationCount+ipRecord.PasswordResetCount))
}

// CanSendPasswordReset checks if a password reset email can be sent
// Returns (allowed, remainingCount, nextAllowedTime)
func (e *EmailRateLimiter) CanSendPasswordReset(email, ip string) (bool, int, *time.Time) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	now := time.Now()
	cutoff := now.Add(-EmailRateWindow)

	// Check email-based limit
	if record, exists := e.passwordResetReq[email]; exists {
		if record.FirstAt.Before(cutoff) {
			// Will be allowed, record will reset on actual send
		} else if record.Count >= MaxPasswordResetPerEmail {
			nextAllowed := record.FirstAt.Add(EmailRateWindow)
			return false, 0, &nextAllowed
		}
	}

	// Check IP-based limit
	if ipRecord, exists := e.ipRequests[ip]; exists {
		if ipRecord.FirstAt.Before(cutoff) {
			// Will be allowed, record will reset on actual send
		} else {
			totalCount := ipRecord.VerificationCount + ipRecord.PasswordResetCount
			if totalCount >= MaxEmailsPerIP {
				nextAllowed := ipRecord.FirstAt.Add(EmailRateWindow)
				return false, 0, &nextAllowed
			}
		}
	}

	// Calculate remaining
	remaining := MaxPasswordResetPerEmail
	if record, exists := e.passwordResetReq[email]; exists && record.FirstAt.After(cutoff) {
		remaining = MaxPasswordResetPerEmail - record.Count
	}

	return true, remaining, nil
}

// RecordPasswordResetSent records a password reset email being sent
func (e *EmailRateLimiter) RecordPasswordResetSent(email, ip string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-EmailRateWindow)

	// Update email record
	record, exists := e.passwordResetReq[email]
	if !exists || record.FirstAt.Before(cutoff) {
		record = &emailRateRecord{
			Count:   0,
			FirstAt: now,
		}
		e.passwordResetReq[email] = record
	}
	record.Count++
	record.LastAt = now

	// Update IP record
	ipRecord, exists := e.ipRequests[ip]
	if !exists || ipRecord.FirstAt.Before(cutoff) {
		ipRecord = &ipRateRecord{
			FirstAt: now,
		}
		e.ipRequests[ip] = ipRecord
	}
	ipRecord.PasswordResetCount++
	ipRecord.LastAt = now

	logger.Info("Password reset email sent",
		zap.String("email", email),
		zap.String("ip", ip),
		zap.Int("email_count", record.Count),
		zap.Int("ip_total_count", ipRecord.VerificationCount+ipRecord.PasswordResetCount))
}

// GetVerificationStatus returns the current verification email status for an email
func (e *EmailRateLimiter) GetVerificationStatus(email string) (count int, remaining int, resetAt *time.Time) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	now := time.Now()
	cutoff := now.Add(-EmailRateWindow)

	record, exists := e.verificationReq[email]
	if !exists || record.FirstAt.Before(cutoff) {
		return 0, MaxVerificationPerEmail, nil
	}

	reset := record.FirstAt.Add(EmailRateWindow)
	return record.Count, MaxVerificationPerEmail - record.Count, &reset
}

// Stop stops the cleanup goroutine
func (e *EmailRateLimiter) Stop() {
	if e.cleanupTicker != nil {
		e.cleanupTicker.Stop()
	}
}
