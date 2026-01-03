package services

import (
	"sync"
	"time"

	"backend-gin/logger"
	"backend-gin/models"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// LoginAttemptTracker tracks failed login attempts with in-memory caching
// and persistent storage for account lockouts
type LoginAttemptTracker struct {
	db            *gorm.DB
	mu            sync.RWMutex
	attempts      map[string]*attemptRecord // Key: email or IP
	totpAttempts  map[string]*totpRecord    // Key: email for TOTP tracking
	cleanupTicker *time.Ticker
}

type attemptRecord struct {
	Count       int
	FirstAt     time.Time
	LastAt      time.Time
	LockedUntil *time.Time
}

type totpRecord struct {
	Count   int
	LastAt  time.Time
	ResetAt time.Time
}

// Configuration constants
const (
	MaxFailedLoginAttempts = 4              // Lock after 4 failed attempts
	LockDuration           = 24 * time.Hour // 24 hour lockout
	AttemptWindow          = 15 * time.Minute // Reset counter after 15 min of no attempts
	MaxTOTPAttempts        = 3              // Max TOTP verification attempts
	TOTPAttemptWindow      = 5 * time.Minute // TOTP attempt window
	CleanupInterval        = 5 * time.Minute // Cleanup old records every 5 minutes
)

// Progressive delay durations (exponential backoff)
var ProgressiveDelays = []time.Duration{
	0,                    // First attempt: no delay
	1 * time.Second,      // After 1 failure
	2 * time.Second,      // After 2 failures
	4 * time.Second,      // After 3 failures
	8 * time.Second,      // After 4 failures (before lock)
}

// NewLoginAttemptTracker creates a new login attempt tracker
func NewLoginAttemptTracker(db *gorm.DB) *LoginAttemptTracker {
	tracker := &LoginAttemptTracker{
		db:           db,
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	// Start background cleanup goroutine
	tracker.cleanupTicker = time.NewTicker(CleanupInterval)
	go tracker.cleanupLoop()

	return tracker
}

// cleanupLoop periodically cleans up old records
func (t *LoginAttemptTracker) cleanupLoop() {
	for range t.cleanupTicker.C {
		t.cleanup()
	}
}

// cleanup removes expired attempt records
func (t *LoginAttemptTracker) cleanup() {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()

	// Cleanup login attempts
	for key, record := range t.attempts {
		// Remove if lock expired AND no recent attempts
		if record.LockedUntil != nil && now.After(*record.LockedUntil) {
			if now.Sub(record.LastAt) > AttemptWindow {
				delete(t.attempts, key)
			}
		} else if record.LockedUntil == nil && now.Sub(record.LastAt) > AttemptWindow {
			delete(t.attempts, key)
		}
	}

	// Cleanup TOTP attempts
	for key, record := range t.totpAttempts {
		if now.After(record.ResetAt) {
			delete(t.totpAttempts, key)
		}
	}
}

// RecordFailedLogin records a failed login attempt and returns:
// - shouldLock: whether account should be locked
// - delay: recommended delay before allowing next attempt
// - attemptsRemaining: number of attempts before lock
func (t *LoginAttemptTracker) RecordFailedLogin(email, ip string) (shouldLock bool, delay time.Duration, attemptsRemaining int) {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	key := email // Track by email primarily

	record, exists := t.attempts[key]
	if !exists {
		record = &attemptRecord{
			Count:   0,
			FirstAt: now,
		}
		t.attempts[key] = record
	}

	// Reset counter if window expired
	if now.Sub(record.LastAt) > AttemptWindow && record.LockedUntil == nil {
		record.Count = 0
		record.FirstAt = now
	}

	// Increment counter
	record.Count++
	record.LastAt = now

	// Calculate delay based on attempt count
	delayIndex := record.Count
	if delayIndex >= len(ProgressiveDelays) {
		delayIndex = len(ProgressiveDelays) - 1
	}
	delay = ProgressiveDelays[delayIndex]

	// Check if should lock
	attemptsRemaining = MaxFailedLoginAttempts - record.Count
	if attemptsRemaining < 0 {
		attemptsRemaining = 0
	}

	if record.Count >= MaxFailedLoginAttempts {
		lockUntil := now.Add(LockDuration)
		record.LockedUntil = &lockUntil
		shouldLock = true

		logger.Warn("Account locked due to failed login attempts",
			zap.String("email", email),
			zap.String("ip", ip),
			zap.Int("attempts", record.Count),
			zap.Time("locked_until", lockUntil))
	}

	return shouldLock, delay, attemptsRemaining
}

// IsLocked checks if an email/account is currently locked
func (t *LoginAttemptTracker) IsLocked(email string) (bool, *time.Time) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	record, exists := t.attempts[email]
	if !exists {
		return false, nil
	}

	if record.LockedUntil == nil {
		return false, nil
	}

	if time.Now().After(*record.LockedUntil) {
		return false, nil
	}

	return true, record.LockedUntil
}

// GetDelay returns the recommended delay for an email
func (t *LoginAttemptTracker) GetDelay(email string) time.Duration {
	t.mu.RLock()
	defer t.mu.RUnlock()

	record, exists := t.attempts[email]
	if !exists {
		return 0
	}

	delayIndex := record.Count
	if delayIndex >= len(ProgressiveDelays) {
		delayIndex = len(ProgressiveDelays) - 1
	}

	return ProgressiveDelays[delayIndex]
}

// ResetAttempts resets failed attempts after successful login
func (t *LoginAttemptTracker) ResetAttempts(email string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.attempts, email)
}

// PersistLock persists the lock to database for the user
func (t *LoginAttemptTracker) PersistLock(user *models.User, reason string) error {
	now := time.Now()
	lockUntil := now.Add(LockDuration)

	user.LockedUntil = &lockUntil
	user.LockReason = reason
	user.FailedLoginAttempts = MaxFailedLoginAttempts

	if err := t.db.Save(user).Error; err != nil {
		logger.Error("Failed to persist account lock",
			zap.Uint("user_id", user.ID),
			zap.Error(err))
		return err
	}

	logger.Info("Account lock persisted to database",
		zap.Uint("user_id", user.ID),
		zap.String("reason", reason),
		zap.Time("locked_until", lockUntil))

	return nil
}

// RecordSuccessfulLogin clears attempts and updates user last login info
func (t *LoginAttemptTracker) RecordSuccessfulLogin(user *models.User, ip string) error {
	// Reset in-memory attempts
	t.ResetAttempts(user.Email)

	// Update user record
	now := time.Now()
	user.LastLoginAt = &now
	user.LastLoginIP = ip
	user.FailedLoginAttempts = 0
	user.LockedUntil = nil
	user.LockReason = ""

	if err := t.db.Save(user).Error; err != nil {
		logger.Error("Failed to update last login info",
			zap.Uint("user_id", user.ID),
			zap.Error(err))
		return err
	}

	return nil
}

// RecordFailedAttemptDB updates the failed attempt count in database
func (t *LoginAttemptTracker) RecordFailedAttemptDB(user *models.User) error {
	now := time.Now()
	user.FailedLoginAttempts++
	user.LastFailedLoginAt = &now

	if err := t.db.Save(user).Error; err != nil {
		logger.Error("Failed to record failed login attempt",
			zap.Uint("user_id", user.ID),
			zap.Error(err))
		return err
	}

	return nil
}

// --- TOTP Attempt Tracking ---

// RecordTOTPAttempt records a failed TOTP attempt
// Returns true if max attempts exceeded
func (t *LoginAttemptTracker) RecordTOTPAttempt(email string) (maxExceeded bool, attemptsRemaining int) {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	record, exists := t.totpAttempts[email]

	if !exists || now.After(record.ResetAt) {
		record = &totpRecord{
			Count:   0,
			ResetAt: now.Add(TOTPAttemptWindow),
		}
		t.totpAttempts[email] = record
	}

	record.Count++
	record.LastAt = now

	attemptsRemaining = MaxTOTPAttempts - record.Count
	if attemptsRemaining < 0 {
		attemptsRemaining = 0
	}

	if record.Count >= MaxTOTPAttempts {
		logger.Warn("Max TOTP attempts exceeded",
			zap.String("email", email),
			zap.Int("attempts", record.Count))
		return true, 0
	}

	return false, attemptsRemaining
}

// ResetTOTPAttempts resets TOTP attempts after successful verification
func (t *LoginAttemptTracker) ResetTOTPAttempts(email string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.totpAttempts, email)
}

// GetTOTPAttemptsRemaining returns remaining TOTP attempts
func (t *LoginAttemptTracker) GetTOTPAttemptsRemaining(email string) int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	record, exists := t.totpAttempts[email]
	if !exists {
		return MaxTOTPAttempts
	}

	if time.Now().After(record.ResetAt) {
		return MaxTOTPAttempts
	}

	remaining := MaxTOTPAttempts - record.Count
	if remaining < 0 {
		return 0
	}
	return remaining
}

// Stop stops the cleanup goroutine
func (t *LoginAttemptTracker) Stop() {
	if t.cleanupTicker != nil {
		t.cleanupTicker.Stop()
	}
}
