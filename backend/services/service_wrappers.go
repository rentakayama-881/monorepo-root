package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/dto"
	"backend-gin/ent"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/utils"
	"backend-gin/validators"

	"go.uber.org/zap"
)

// ============================================================================
// AuthService Wrapper - wraps EntAuthService for handler compatibility
// ============================================================================

// AuthServiceWrapper provides backward-compatible interface for handlers
// while delegating to EntAuthService for actual implementation
type AuthServiceWrapper struct {
	ent    *EntAuthService
	logger *zap.Logger
}

// VerificationRequestResult carries resend metadata that frontend can use
// without relying on client-side hardcoded cooldown values.
type VerificationRequestResult struct {
	Sent              bool
	RetryAfterSeconds int
}

// NewAuthServiceWrapper creates a wrapper around EntAuthService
func NewAuthServiceWrapper(entService *EntAuthService) *AuthServiceWrapper {
	return &AuthServiceWrapper{
		ent:    entService,
		logger: zap.L(),
	}
}

// RegisterWithDeviceCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) RegisterWithDeviceCtx(ctx context.Context, input validators.RegisterInput, deviceFingerprint, ip, userAgent string) (*RegisterResponse, error) {
	return w.ent.RegisterWithDevice(ctx, input, deviceFingerprint, ip, userAgent)
}

// RegisterWithDevice delegates to EntAuthService with context
func (w *AuthServiceWrapper) RegisterWithDevice(input validators.RegisterInput, deviceFingerprint, ip, userAgent string) (*RegisterResponse, error) {
	return w.RegisterWithDeviceCtx(context.Background(), input, deviceFingerprint, ip, userAgent)
}

// LoginWithSessionCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) LoginWithSessionCtx(ctx context.Context, input validators.LoginInput, ip, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.ent.LoginWithSession(ctx, input, ip, userAgent, deviceFingerprint)
}

// LoginWithSession delegates to EntAuthService with context
func (w *AuthServiceWrapper) LoginWithSession(input validators.LoginInput, ip, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.LoginWithSessionCtx(context.Background(), input, ip, userAgent, deviceFingerprint)
}

// LoginWithPasskeyEntCtx uses ent.User directly with request context.
func (w *AuthServiceWrapper) LoginWithPasskeyEntCtx(ctx context.Context, user *ent.User, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.ent.LoginWithPasskey(ctx, user, ipAddress, userAgent, deviceFingerprint)
}

// LoginWithPasskeyEnt uses ent.User directly
func (w *AuthServiceWrapper) LoginWithPasskeyEnt(user *ent.User, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.LoginWithPasskeyEntCtx(context.Background(), user, ipAddress, userAgent, deviceFingerprint)
}

// RequestVerificationCtx creates verification token and queues email if account exists.
// It always returns generic semantics to avoid email enumeration.
func (w *AuthServiceWrapper) RequestVerificationCtx(ctx context.Context, email, ip string) (*VerificationRequestResult, error) {
	normalizedEmail := strings.TrimSpace(strings.ToLower(email))
	if err := validators.ValidateEmail(normalizedEmail); err != nil {
		return nil, err
	}

	result := &VerificationRequestResult{}
	if emailRateLimiter != nil {
		allowed, _, nextAllowed := emailRateLimiter.CanSendVerification(normalizedEmail, ip)
		if !allowed {
			retryAfter := secondsUntil(nextAllowed)
			result.RetryAfterSeconds = retryAfter

			err := apperrors.ErrVerificationLimitReached
			if retryAfter > 0 {
				err = err.WithDetails(fmt.Sprintf("Silakan coba lagi dalam %d detik", retryAfter))
			}
			return result, err
		}

		// Reserve quota even for non-existent email to keep endpoint behavior non-enumerable.
		emailRateLimiter.RecordVerificationSent(normalizedEmail, ip)
		result.RetryAfterSeconds = int(VerificationResendDelay / time.Second)
	}

	u, err := w.ent.client.User.Query().
		Where(user.EmailEqualFold(normalizedEmail)).
		Only(ctx)
	if err != nil {
		// Return generic success for non-existent users (don't reveal account existence).
		return result, nil
	}

	// Check if user is already verified - no need to send another email
	if u.EmailVerified {
		w.logger.Debug("User already verified, skipping email", zap.String("email", normalizedEmail))
		return result, nil
	}

	// Create verification token
	token, _, err := w.ent.createVerificationToken(ctx, u)
	if err != nil {
		w.logger.Error("Failed to create verification token", zap.Error(err), zap.String("email", normalizedEmail))
		return nil, err
	}

	// Queue verification email
	if err := utils.QueueVerificationEmail(normalizedEmail, token); err != nil {
		w.logger.Warn("Failed to queue verification email", zap.Error(err), zap.String("email", normalizedEmail))
		return result, nil
	}

	result.Sent = true
	return result, nil
}

// RequestVerification creates verification token and queues email if account exists.
// It always returns generic semantics to avoid email enumeration.
func (w *AuthServiceWrapper) RequestVerification(email, ip string) (*VerificationRequestResult, error) {
	return w.RequestVerificationCtx(context.Background(), email, ip)
}

func secondsUntil(nextAllowed *time.Time) int {
	if nextAllowed == nil {
		return 0
	}
	remaining := int(time.Until(*nextAllowed).Seconds())
	if remaining < 1 {
		return 1
	}
	return remaining
}

// ConfirmVerificationCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) ConfirmVerificationCtx(ctx context.Context, input validators.VerifyTokenInput) error {
	return w.ent.ConfirmVerification(ctx, input)
}

// ConfirmVerification delegates to EntAuthService
func (w *AuthServiceWrapper) ConfirmVerification(input validators.VerifyTokenInput) error {
	return w.ConfirmVerificationCtx(context.Background(), input)
}

// ForgotPasswordCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) ForgotPasswordCtx(ctx context.Context, email, ip string) (*ForgotPasswordResponse, error) {
	return w.ent.ForgotPassword(ctx, email, ip)
}

// ForgotPassword delegates to EntAuthService
func (w *AuthServiceWrapper) ForgotPassword(email, ip string) (*ForgotPasswordResponse, error) {
	return w.ForgotPasswordCtx(context.Background(), email, ip)
}

// ResetPasswordCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) ResetPasswordCtx(ctx context.Context, token, newPassword string) error {
	return w.ent.ResetPassword(ctx, token, newPassword)
}

// ResetPassword delegates to EntAuthService
func (w *AuthServiceWrapper) ResetPassword(token, newPassword string) error {
	return w.ResetPasswordCtx(context.Background(), token, newPassword)
}

// CompleteTOTPLoginCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) CompleteTOTPLoginCtx(ctx context.Context, pendingToken, totpCode, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.ent.CompleteTOTPLogin(ctx, pendingToken, totpCode, ipAddress, userAgent, deviceFingerprint)
}

// CompleteTOTPLogin delegates to EntAuthService
func (w *AuthServiceWrapper) CompleteTOTPLogin(pendingToken, totpCode, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.CompleteTOTPLoginCtx(context.Background(), pendingToken, totpCode, ipAddress, userAgent, deviceFingerprint)
}

// CompleteTOTPLoginWithBackupCodeCtx delegates to EntAuthService with request context.
func (w *AuthServiceWrapper) CompleteTOTPLoginWithBackupCodeCtx(ctx context.Context, pendingToken, backupCode, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.ent.CompleteTOTPLoginWithBackupCode(ctx, pendingToken, backupCode, ipAddress, userAgent, deviceFingerprint)
}

// CompleteTOTPLoginWithBackupCode delegates to EntAuthService
func (w *AuthServiceWrapper) CompleteTOTPLoginWithBackupCode(pendingToken, backupCode, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	return w.CompleteTOTPLoginWithBackupCodeCtx(context.Background(), pendingToken, backupCode, ipAddress, userAgent, deviceFingerprint)
}

// ============================================================================
// SessionService Wrapper - wraps EntSessionService for handler compatibility
// ============================================================================

// SessionServiceWrapper provides backward-compatible interface for handlers
type SessionServiceWrapper struct {
	ent *EntSessionService
}

// NewSessionServiceWrapper creates a wrapper around EntSessionService
func NewSessionServiceWrapper(entService *EntSessionService) *SessionServiceWrapper {
	return &SessionServiceWrapper{ent: entService}
}

// RefreshSessionCtx delegates to EntSessionService with request context.
func (w *SessionServiceWrapper) RefreshSessionCtx(ctx context.Context, refreshToken, ip, userAgent string) (*TokenPair, error) {
	return w.ent.RefreshSession(ctx, refreshToken, ip, userAgent)
}

// RefreshSession delegates to EntSessionService
func (w *SessionServiceWrapper) RefreshSession(refreshToken, ip, userAgent string) (*TokenPair, error) {
	return w.RefreshSessionCtx(context.Background(), refreshToken, ip, userAgent)
}

// RevokeSessionByRefreshTokenCtx delegates to EntSessionService with request context.
func (w *SessionServiceWrapper) RevokeSessionByRefreshTokenCtx(ctx context.Context, refreshToken, reason string) error {
	return w.ent.RevokeSessionByRefreshToken(ctx, refreshToken, reason)
}

// RevokeSessionByRefreshToken delegates to EntSessionService
func (w *SessionServiceWrapper) RevokeSessionByRefreshToken(refreshToken, reason string) error {
	return w.RevokeSessionByRefreshTokenCtx(context.Background(), refreshToken, reason)
}

// RevokeAllUserSessionsCtx delegates to EntSessionService with request context.
func (w *SessionServiceWrapper) RevokeAllUserSessionsCtx(ctx context.Context, userID uint, reason string) error {
	return w.ent.RevokeAllUserSessions(ctx, int(userID), reason)
}

// RevokeAllUserSessions delegates to EntSessionService
func (w *SessionServiceWrapper) RevokeAllUserSessions(userID uint, reason string) error {
	return w.RevokeAllUserSessionsCtx(context.Background(), userID, reason)
}

// GetActiveSessionsCtx delegates to EntSessionService and converts result with request context.
func (w *SessionServiceWrapper) GetActiveSessionsCtx(ctx context.Context, userID uint) ([]*ent.Session, error) {
	return w.ent.GetActiveSessions(ctx, int(userID))
}

// GetActiveSessions delegates to EntSessionService and converts result
func (w *SessionServiceWrapper) GetActiveSessions(userID uint) ([]*ent.Session, error) {
	return w.GetActiveSessionsCtx(context.Background(), userID)
}

// RevokeSessionCtx delegates to EntSessionService with request context.
func (w *SessionServiceWrapper) RevokeSessionCtx(ctx context.Context, sessionID uint, reason string) error {
	return w.ent.RevokeSession(ctx, int(sessionID), reason)
}

// RevokeSession delegates to EntSessionService
func (w *SessionServiceWrapper) RevokeSession(sessionID uint, reason string) error {
	return w.RevokeSessionCtx(context.Background(), sessionID, reason)
}

// ============================================================================
// TOTPService Wrapper - wraps EntTOTPService for handler compatibility
// ============================================================================

// TOTPServiceWrapper provides backward-compatible interface for handlers
type TOTPServiceWrapper struct {
	ent *EntTOTPService
}

// NewTOTPServiceWrapper creates a wrapper around EntTOTPService
func NewTOTPServiceWrapper(entService *EntTOTPService) *TOTPServiceWrapper {
	return &TOTPServiceWrapper{ent: entService}
}

// GenerateSetup delegates to EntTOTPService
func (w *TOTPServiceWrapper) GenerateSetup(userID uint) (*dto.TOTPSetupResponse, error) {
	return w.ent.GenerateSetup(context.Background(), int(userID))
}

// VerifyAndEnable delegates to EntTOTPService
// Returns backup codes that should be shown to user ONLY ONCE
func (w *TOTPServiceWrapper) VerifyAndEnable(userID uint, code string) ([]string, error) {
	return w.ent.VerifyAndEnable(context.Background(), int(userID), code)
}

// Verify delegates to EntTOTPService
func (w *TOTPServiceWrapper) Verify(userID uint, code string) (bool, error) {
	return w.ent.Verify(context.Background(), int(userID), code)
}

// Disable delegates to EntTOTPService
func (w *TOTPServiceWrapper) Disable(userID uint, password, reason string, verify func(hash, pwd string) bool) error {
	return w.ent.Disable(context.Background(), int(userID), password, reason, verify)
}

// GenerateBackupCodes delegates to EntTOTPService
func (w *TOTPServiceWrapper) GenerateBackupCodes(userID uint) ([]string, error) {
	return w.ent.GenerateBackupCodes(context.Background(), int(userID))
}

// GetStatus returns TOTP enabled status for user
func (w *TOTPServiceWrapper) GetStatus(userID uint) (*dto.TOTPStatusResponse, error) {
	ctx := context.Background()
	u, err := w.ent.client.User.Get(ctx, int(userID))
	if err != nil {
		return nil, err
	}

	var verifiedAt *string
	if u.TotpVerifiedAt != nil {
		t := u.TotpVerifiedAt.Format(time.RFC3339)
		verifiedAt = &t
	}

	return &dto.TOTPStatusResponse{
		Enabled:    u.TotpEnabled,
		VerifiedAt: verifiedAt,
	}, nil
}

// GetBackupCodeCount returns remaining backup codes count
func (w *TOTPServiceWrapper) GetBackupCodeCount(userID uint) (int, error) {
	remaining, _, err := w.ent.GetBackupCodeStatus(context.Background(), int(userID))
	return remaining, err
}
