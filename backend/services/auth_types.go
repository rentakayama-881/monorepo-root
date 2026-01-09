package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"
)

// Auth service response types

// RegisterResponse represents the response after user registration
type RegisterResponse struct {
	Message              string `json:"message"`
	UserID               uint   `json:"user_id"`
	RequiresVerification bool   `json:"requires_verification"`
}

// LoginResponse represents the response after successful login
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Email        string `json:"email"`
	Username     string `json:"username,omitempty"`
	FullName     string `json:"full_name,omitempty"`
	RequiresTOTP bool   `json:"requires_totp,omitempty"`
	TOTPPending  string `json:"totp_pending,omitempty"`
}

// ForgotPasswordResponse represents the response after password reset request
type ForgotPasswordResponse struct {
	Message string `json:"message"`
}

// TokenPair represents an access/refresh token pair
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int64     `json:"expires_in"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
	TokenType    string    `json:"token_type"`
}

// SecurityEventType represents types of security events
type SecurityEventType string

// Security event type constants
const (
	SecurityEventLogin           SecurityEventType = "login"
	SecurityEventLoginFailed     SecurityEventType = "login_failed"
	SecurityEventLogout          SecurityEventType = "logout"
	SecurityEventPasswordChange  SecurityEventType = "password_change"
	SecurityEventPasswordReset   SecurityEventType = "password_reset"
	SecurityEventTOTPEnabled     SecurityEventType = "totp_enabled"
	SecurityEventTOTPDisabled    SecurityEventType = "totp_disabled"
	SecurityEventAccountLocked   SecurityEventType = "account_locked"
	SecurityEventAccountUnlocked SecurityEventType = "account_unlocked"
	SecurityEventSessionRevoked  SecurityEventType = "session_revoked"
	SecurityEventPasskeyAdded    SecurityEventType = "passkey_added"
	SecurityEventPasskeyRemoved  SecurityEventType = "passkey_removed"

	// Event type constants as strings for use in SecurityEvent
	EventPasswordResetReq   = "password_reset_request"
	EventEmailVerification  = "email_verification"
	EventRegistration       = "registration"
	EventPasskeyRegistered  = "passkey_registered"
	EventBruteForceDetected = "brute_force_detected"
)

// SecurityEvent represents a security audit event
type SecurityEvent struct {
	UserID    *uint
	Email     string
	EventType string
	IPAddress string
	UserAgent string
	Success   bool
	Details   string
	Severity  string
}

// User represents user data for internal service use
// This is a lightweight struct for service layer operations
type User struct {
	ID            uint
	Email         string
	Username      *string
	PasswordHash  string
	EmailVerified bool
	TotpEnabled   bool
	TOTPSecret    string
	AvatarURL     string
	FullName      *string
	LockedUntil   *time.Time
	LockReason    string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// randomToken generates a random token for password reset, email verification, etc.
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// hashToken creates a SHA256 hash of a token
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
