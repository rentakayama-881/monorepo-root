package services

import (
	"context"
	"sync"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/user"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// EntLoginAttemptTracker tracks failed login attempts with in-memory caching
// and persistent storage for account lockouts using Ent ORM
type EntLoginAttemptTracker struct {
	mu            sync.RWMutex
	attempts      map[string]*attemptRecord // Key: email or IP
	totpAttempts  map[string]*totpRecord    // Key: email for TOTP tracking
	cleanupTicker *time.Ticker
}

// NewEntLoginAttemptTracker creates a new Ent login attempt tracker
func NewEntLoginAttemptTracker() *EntLoginAttemptTracker {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	// Start background cleanup goroutine
	tracker.cleanupTicker = time.NewTicker(CleanupInterval)
	go tracker.cleanupLoop()

	return tracker
}

// cleanupLoop periodically cleans up old records
func (t *EntLoginAttemptTracker) cleanupLoop() {
	for range t.cleanupTicker.C {
		t.cleanup()
	}
}

// cleanup removes expired attempt records
func (t *EntLoginAttemptTracker) cleanup() {
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
func (t *EntLoginAttemptTracker) RecordFailedLogin(email, ip string) (shouldLock bool, delay time.Duration, attemptsRemaining int) {
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
	attemptsRemaining = MaxLoginAttempts - record.Count
	if attemptsRemaining < 0 {
		attemptsRemaining = 0
	}

	if record.Count >= MaxLoginAttempts {
		lockUntil := now.Add(LockoutDuration)
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
func (t *EntLoginAttemptTracker) IsLocked(email string) (bool, *time.Time) {
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
func (t *EntLoginAttemptTracker) GetDelay(email string) time.Duration {
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
func (t *EntLoginAttemptTracker) ResetAttempts(email string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.attempts, email)
}

// PersistLock persists the lock to database for the user using Ent
func (t *EntLoginAttemptTracker) PersistLock(ctx context.Context, entUser *ent.User, reason string) error {
	now := time.Now()
	lockUntil := now.Add(LockoutDuration)

	client := database.GetEntClient()
	_, err := client.User.UpdateOne(entUser).
		SetLockedUntil(lockUntil).
		SetLockReason(reason).
		SetFailedLoginAttempts(MaxLoginAttempts).
		Save(ctx)

	if err != nil {
		logger.Error("Failed to persist account lock",
			zap.Int("user_id", entUser.ID),
			zap.Error(err))
		return err
	}

	logger.Info("Account lock persisted to database",
		zap.Int("user_id", entUser.ID),
		zap.String("reason", reason),
		zap.Time("locked_until", lockUntil))

	return nil
}

// RecordSuccessfulLogin clears attempts and updates user last login info using Ent
func (t *EntLoginAttemptTracker) RecordSuccessfulLogin(ctx context.Context, entUser *ent.User, ip string) error {
	// Reset in-memory attempts
	t.ResetAttempts(entUser.Email)

	// Update user record using Ent
	now := time.Now()
	client := database.GetEntClient()
	_, err := client.User.UpdateOne(entUser).
		SetLastLoginAt(now).
		SetLastLoginIP(ip).
		SetFailedLoginAttempts(0).
		ClearLockedUntil().
		ClearLockReason().
		Save(ctx)

	if err != nil {
		logger.Error("Failed to update last login info",
			zap.Int("user_id", entUser.ID),
			zap.Error(err))
		return err
	}

	return nil
}

// RecordFailedAttemptDB updates the failed attempt count in database using Ent
func (t *EntLoginAttemptTracker) RecordFailedAttemptDB(ctx context.Context, entUser *ent.User) error {
	now := time.Now()
	client := database.GetEntClient()

	_, err := client.User.UpdateOne(entUser).
		SetFailedLoginAttempts(entUser.FailedLoginAttempts + 1).
		SetLastFailedAt(now).
		Save(ctx)

	if err != nil {
		logger.Error("Failed to record failed login attempt",
			zap.Int("user_id", entUser.ID),
			zap.Error(err))
		return err
	}

	return nil
}

// RecordSuccessfulLoginByEmail finds user by email and records successful login
func (t *EntLoginAttemptTracker) RecordSuccessfulLoginByEmail(ctx context.Context, email, ip string) error {
	client := database.GetEntClient()

	// Reset in-memory attempts
	t.ResetAttempts(email)

	// Update user record using Ent
	now := time.Now()
	_, err := client.User.Update().
		Where(user.EmailEQ(email)).
		SetLastLoginAt(now).
		SetLastLoginIP(ip).
		SetFailedLoginAttempts(0).
		ClearLockedUntil().
		ClearLockReason().
		Save(ctx)

	return err
}

// --- TOTP Attempt Tracking ---

// RecordTOTPAttempt records a failed TOTP attempt
// Returns true if max attempts exceeded
func (t *EntLoginAttemptTracker) RecordTOTPAttempt(email string) (maxExceeded bool, attemptsRemaining int) {
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
func (t *EntLoginAttemptTracker) ResetTOTPAttempts(email string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.totpAttempts, email)
}

// GetTOTPAttemptsRemaining returns remaining TOTP attempts
func (t *EntLoginAttemptTracker) GetTOTPAttemptsRemaining(email string) int {
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
func (t *EntLoginAttemptTracker) Stop() {
	if t.cleanupTicker != nil {
		t.cleanupTicker.Stop()
	}
}
