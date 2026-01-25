package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"backend-gin/ent"
)

// Security tracking types used by device tracker and login tracker

// recentDeviceRecord tracks recent device activity in memory
type recentDeviceRecord struct {
	FingerprintHash string
	IPAddress       string
	UserAgent       string
	AccountCount    int
	LastSeen        time.Time
	Blocked         bool
	BlockReason     string
}

// attemptRecord tracks login attempt information
type attemptRecord struct {
	Count       int
	FirstAt     time.Time
	LastAt      time.Time
	LockedUntil *time.Time
	LockReason  string
}

// totpRecord tracks TOTP attempt information
type totpRecord struct {
	Count   int
	LastAt  time.Time
	ResetAt time.Time
}

// SudoVerifyResult represents the result of sudo verification
type SudoVerifyResult struct {
	Valid     bool
	SudoToken string
	ExpiresAt time.Time
	ExpiresIn int64
	UserID    uint
}

// Security tracker constants
const (
	// MaxAccountsPerDevice is the maximum number of accounts per device
	MaxAccountsPerDevice = 3

	// DeviceCleanupInterval is how often to clean up old device records
	DeviceCleanupInterval = 1 * time.Hour

	// DeviceCacheExpiry is how long device records are kept in cache
	DeviceCacheExpiry = 24 * time.Hour

	// CleanupInterval is how often to clean up old attempt records
	CleanupInterval = 15 * time.Minute

	// AttemptWindow is the time window for counting attempts
	AttemptWindow = 30 * time.Minute

	// MaxLoginAttempts is the maximum number of login attempts before lockout
	MaxLoginAttempts = 5

	// MaxFailedLoginAttempts is the same as MaxLoginAttempts (alias)
	MaxFailedLoginAttempts = 5

	// LockoutDuration is how long to lock an account after max attempts
	LockoutDuration = 15 * time.Minute

	// LockDuration is an alias for LockoutDuration
	LockDuration = 15 * time.Minute

	// MaxTOTPAttempts is the maximum number of TOTP attempts before lockout
	MaxTOTPAttempts = 5

	// TOTPLockoutDuration is how long to lock TOTP after max attempts
	TOTPLockoutDuration = 15 * time.Minute

	// TOTPAttemptWindow is the time window for TOTP attempt counting
	TOTPAttemptWindow = 15 * time.Minute

	// totpPendingTokenLength is the length of TOTP pending token in bytes
	totpPendingTokenLength = 32

	// totpPendingTokenExpiry is how long a TOTP pending token is valid
	totpPendingTokenExpiry = 5 * time.Minute
)

// SecurityEventType constants for audit logging
const (
	EventLoginSuccess    = "login_success"
	EventLoginFailed     = "login_failed"
	EventLogout          = "logout"
	EventLogoutAll       = "logout_all"
	EventRegister        = "register"
	EventAccountLocked   = "account_locked"
	EventBruteForce      = "brute_force_detected"
	EventTOTPFailed      = "totp_failed"
	EventTOTPMaxAttempts = "totp_max_attempts"
	EventTOTPSuccess     = "totp_success"
	EventSessionCreated  = "session_created"
	EventTokenReuse      = "token_reuse"
	EventPasswordChanged = "password_changed"
	EventSudoActivated   = "sudo_activated"
	EventPasskeyAdded    = "passkey_added"
	EventPasskeyRemoved  = "passkey_removed"
	EventPasskeyLogin    = "passkey_login"
	EventAccountDeleted  = "account_deleted"
	EventTOTPEnabled     = "totp_enabled"
	EventTOTPDisabled    = "totp_disabled"
)

// ProgressiveDelays defines delays for progressive slowdown on failed attempts
var ProgressiveDelays = []time.Duration{
	0,               // 1st attempt: no delay
	1 * time.Second, // 2nd attempt: 1s delay
	2 * time.Second, // 3rd attempt: 2s delay
	4 * time.Second, // 4th attempt: 4s delay
	8 * time.Second, // 5th attempt: 8s delay
}

// Session management constants
const (
	// MaxConcurrentSessions is the maximum number of concurrent sessions per user
	MaxConcurrentSessions = 5

	// RefreshTokenValidDays is how many days a refresh token is valid
	RefreshTokenValidDays = 7

	// TokenFamilyLength is the length of token family ID in bytes
	TokenFamilyLength = 16

	// SessionGracePeriod is the grace period for token refresh after expiry
	SessionGracePeriod = 30 * time.Second

	// RefreshTokenRotationWindow is how close to expiry we rotate refresh tokens
	RefreshTokenRotationWindow = 24 * time.Hour

	// IPChangeWindow is the time window to monitor for IP changes
	IPChangeWindow = 1 * time.Hour

	// IPChangeSuspiciousCount is the number of IP changes in window considered suspicious
	IPChangeSuspiciousCount = 5

	// SudoTTL is how long sudo mode lasts
	SudoTTL = 15 * time.Minute
)

// TOTP constants
const (
	// TOTPIssuer is the issuer name for TOTP setup
	TOTPIssuer = "AlephdRaad"

	// TOTPDigits is the number of digits for TOTP codes
	TOTPDigits = 6

	// TOTPPeriod is the time period for TOTP codes in seconds
	TOTPPeriod = 30

	// BackupCodeCount is the number of backup codes generated
	BackupCodeCount = 10

	// BackupCodeLength is the length of each backup code part
	BackupCodeLength = 4
)

// generateBackupCode generates a single backup code in format XXXX-XXXX
func generateBackupCode() string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude confusing chars
	b := make([]byte, BackupCodeLength*2)
	rand.Read(b)
	code := make([]byte, BackupCodeLength*2)
	for i := range code {
		code[i] = charset[b[i]%byte(len(charset))]
	}
	return string(code[:BackupCodeLength]) + "-" + string(code[BackupCodeLength:])
}

// hashRefreshToken creates a SHA256 hash of the refresh token
func hashRefreshToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// generateTokenFamily generates a unique identifier for a token family
// This is used to detect token reuse attacks
func generateTokenFamily() string {
	b := make([]byte, TokenFamilyLength)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based generation
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// truncateString truncates a string to max length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

// Global service instances for cross-service access
var (
	// deviceTracker is the global device tracker instance
	deviceTracker DeviceTrackerInterface

	// securityAudit is the global security audit service instance
	securityAudit SecurityAuditInterface

	// loginTracker is the global login attempt tracker instance
	loginTracker LoginTrackerInterface
)

// DeviceTrackerInterface defines device tracking operations
type DeviceTrackerInterface interface {
	IsDeviceBlocked(fingerprintHash string) (bool, string)
	CanRegisterAccount(fingerprintHash, ip, userAgent string) (bool, int, error)
	RecordDeviceRegistration(userID uint, fingerprintHash, ip, userAgent string) error
}

// SecurityAuditInterface defines security audit operations
type SecurityAuditInterface interface {
	LogEvent(event SecurityEvent)
	LogLoginFailed(email, ip, userAgent, reason string)
	LogLoginSuccess(email, ip, userAgent string)
	LogBruteForceDetected(email, ip string, attempts int)
	LogAccountLockedForEnt(user *ent.User, ip, reason string, duration time.Duration)
	LogLoginSuccessForEnt(user *ent.User, ip, userAgent string)
	LogSessionCreatedForEnt(user *ent.User, ip, userAgent string)
	LogTOTPMaxAttempts(user *User, ip string)
	LogTOTPFailedForEnt(user *ent.User, ip, userAgent string, attemptsRemaining int)
	LogTOTPSuccessForEnt(user *ent.User, ip, userAgent string)
	LogTokenReuseForEnt(user *ent.User, ip, userAgent string)
	LogRegister(ctx context.Context, userID int, email, ip, userAgent string)
}

// LoginTrackerInterface defines login tracking operations
type LoginTrackerInterface interface {
	IsLocked(key string) (bool, *time.Time)
	GetDelay(key string) time.Duration
	RecordFailedAttempt(key, reason string)
	RecordFailedLogin(key, ip string) (locked bool, attempts int, lockedUntil *time.Time)
	RecordSuccess(key string)
	ResetAttempts(key string)
	RecordSuccessfulLogin(user *User, ip string) error
	GetTOTPAttemptsRemaining(email string) int
	RecordTOTPAttempt(email string) (locked bool, attemptsRemaining int)
	ResetTOTPAttempts(email string)
}

// SetDeviceTracker sets the global device tracker instance
func SetDeviceTracker(tracker DeviceTrackerInterface) {
	deviceTracker = tracker
}

// SetSecurityAudit sets the global security audit instance
func SetSecurityAudit(audit SecurityAuditInterface) {
	securityAudit = audit
}

// SetLoginTracker sets the global login tracker instance
func SetLoginTracker(tracker LoginTrackerInterface) {
	loginTracker = tracker
}

// HashFingerprint creates a SHA256 hash of device fingerprint components
func HashFingerprint(fingerprint, userAgent string) string {
	h := sha256.New()
	h.Write([]byte(fingerprint))
	h.Write([]byte(userAgent))
	return hex.EncodeToString(h.Sum(nil))
}

// formatDuration formats a duration into a human-readable Indonesian string
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%d detik", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%d menit", int(d.Minutes()))
	}
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	if minutes > 0 {
		return fmt.Sprintf("%d jam %d menit", hours, minutes)
	}
	return fmt.Sprintf("%d jam", hours)
}
