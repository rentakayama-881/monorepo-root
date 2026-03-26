package services

import (
	"testing"
	"time"
)

func TestEntLoginAttemptTracker_RecordFailedLogin_Basic(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	shouldLock, delay, remaining := tracker.RecordFailedLogin("test@example.com", "1.2.3.4")
	if shouldLock {
		t.Error("should not lock on first attempt")
	}
	_ = delay
	if remaining != MaxLoginAttempts-1 {
		t.Errorf("remaining = %d, want %d", remaining, MaxLoginAttempts-1)
	}
}

func TestEntLoginAttemptTracker_RecordFailedLogin_Lockout(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	var shouldLock bool
	for i := 0; i < MaxLoginAttempts; i++ {
		shouldLock, _, _ = tracker.RecordFailedLogin("lock@example.com", "1.2.3.4")
	}
	if !shouldLock {
		t.Error("should lock after max attempts")
	}
}

func TestEntLoginAttemptTracker_IsLocked(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	locked, lockedUntil := tracker.IsLocked("unknown@example.com")
	if locked {
		t.Error("should not be locked for unknown email")
	}
	if lockedUntil != nil {
		t.Error("lockedUntil should be nil")
	}
}

func TestEntLoginAttemptTracker_IsLocked_AfterLockout(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	for i := 0; i < MaxLoginAttempts; i++ {
		tracker.RecordFailedLogin("locked@example.com", "1.2.3.4")
	}

	locked, lockedUntil := tracker.IsLocked("locked@example.com")
	if !locked {
		t.Error("should be locked after max attempts")
	}
	if lockedUntil == nil {
		t.Error("lockedUntil should not be nil")
	}
}

func TestEntLoginAttemptTracker_GetDelay(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	delay := tracker.GetDelay("noattempts@example.com")
	if delay != 0 {
		t.Errorf("delay = %v, want 0 for no attempts", delay)
	}
}

func TestEntLoginAttemptTracker_ResetAttempts(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	tracker.RecordFailedLogin("reset@example.com", "1.2.3.4")
	tracker.ResetAttempts("reset@example.com")

	delay := tracker.GetDelay("reset@example.com")
	if delay != 0 {
		t.Errorf("delay after reset = %v, want 0", delay)
	}
}

func TestEntLoginAttemptTracker_RecordTOTPAttempt_Basic(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	maxExceeded, remaining := tracker.RecordTOTPAttempt("totp@example.com")
	if maxExceeded {
		t.Error("should not exceed max on first attempt")
	}
	if remaining != MaxTOTPAttempts-1 {
		t.Errorf("remaining = %d, want %d", remaining, MaxTOTPAttempts-1)
	}
}

func TestEntLoginAttemptTracker_RecordTOTPAttempt_MaxExceeded(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	var maxExceeded bool
	for i := 0; i < MaxTOTPAttempts; i++ {
		maxExceeded, _ = tracker.RecordTOTPAttempt("totp-max@example.com")
	}
	if !maxExceeded {
		t.Error("should exceed max after MaxTOTPAttempts")
	}
}

func TestEntLoginAttemptTracker_ResetTOTPAttempts(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	tracker.RecordTOTPAttempt("resettotp@example.com")
	tracker.ResetTOTPAttempts("resettotp@example.com")

	remaining := tracker.GetTOTPAttemptsRemaining("resettotp@example.com")
	if remaining != MaxTOTPAttempts {
		t.Errorf("remaining after reset = %d, want %d", remaining, MaxTOTPAttempts)
	}
}

func TestEntLoginAttemptTracker_GetTOTPAttemptsRemaining_NoRecord(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	remaining := tracker.GetTOTPAttemptsRemaining("new@example.com")
	if remaining != MaxTOTPAttempts {
		t.Errorf("remaining = %d, want %d", remaining, MaxTOTPAttempts)
	}
}

func TestEntLoginAttemptTracker_ProgressiveDelay(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	tracker.RecordFailedLogin("delay@example.com", "1.2.3.4")
	delay1 := tracker.GetDelay("delay@example.com")

	tracker.RecordFailedLogin("delay@example.com", "1.2.3.4")
	delay2 := tracker.GetDelay("delay@example.com")

	if delay2 < delay1 {
		t.Errorf("delay should increase: delay1=%v, delay2=%v", delay1, delay2)
	}
}

func TestEntLoginAttemptTracker_IsLocked_ExpiredLock(t *testing.T) {
	tracker := &EntLoginAttemptTracker{
		attempts:     make(map[string]*attemptRecord),
		totpAttempts: make(map[string]*totpRecord),
	}

	// Manually set expired lock
	expired := time.Now().Add(-1 * time.Hour)
	tracker.attempts["expired@example.com"] = &attemptRecord{
		Count:       MaxLoginAttempts,
		LockedUntil: &expired,
		LastAt:      time.Now().Add(-2 * time.Hour),
	}

	locked, _ := tracker.IsLocked("expired@example.com")
	if locked {
		t.Error("should not be locked after expiry")
	}
}

func TestPlaceholder_LoginTracker_PersistLock(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_LoginTracker_RecordSuccessfulLogin(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_LoginTracker_RecordFailedAttemptDB(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_LoginTracker_RecordSuccessfulLoginByEmail(t *testing.T) {
	t.Skip("requires database connection")
}
