package services

import (
	"context"
	"time"

	"backend-gin/dto"
	"backend-gin/ent"
	"backend-gin/ent/user"
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

// NewAuthServiceWrapper creates a wrapper around EntAuthService
func NewAuthServiceWrapper(entService *EntAuthService) *AuthServiceWrapper {
	return &AuthServiceWrapper{
		ent:    entService,
		logger: zap.L(),
	}
}

// RegisterWithDevice delegates to EntAuthService with context
func (w *AuthServiceWrapper) RegisterWithDevice(input validators.RegisterInput, deviceFingerprint, ip, userAgent string) (*RegisterResponse, error) {
	return w.ent.RegisterWithDevice(context.Background(), input, deviceFingerprint, ip, userAgent)
}

// LoginWithSession delegates to EntAuthService with context
func (w *AuthServiceWrapper) LoginWithSession(input validators.LoginInput, ip, userAgent string) (*LoginResponse, error) {
	return w.ent.LoginWithSession(context.Background(), input, ip, userAgent)
}

// LoginWithPasskeyEnt uses ent.User directly
func (w *AuthServiceWrapper) LoginWithPasskeyEnt(user *ent.User, ipAddress, userAgent string) (*LoginResponse, error) {
	return w.ent.LoginWithPasskey(context.Background(), user, ipAddress, userAgent)
}

// RequestVerification creates verification token and sends email
func (w *AuthServiceWrapper) RequestVerification(email, ip string) (string, string, error) {
	// Delegate to internal createVerificationToken after finding user
	ctx := context.Background()
	u, err := w.ent.client.User.Query().
		Where(user.EmailEQ(email)).
		Only(ctx)
	if err != nil {
		// Return empty for non-existent users (security: don't reveal existence)
		return "", "", nil
	}
	return w.ent.createVerificationToken(ctx, u)
}

// ConfirmVerification delegates to EntAuthService
func (w *AuthServiceWrapper) ConfirmVerification(input validators.VerifyTokenInput) error {
	return w.ent.ConfirmVerification(context.Background(), input)
}

// ForgotPassword delegates to EntAuthService
func (w *AuthServiceWrapper) ForgotPassword(email, ip string) (*ForgotPasswordResponse, error) {
	return w.ent.ForgotPassword(context.Background(), email, ip)
}

// ResetPassword delegates to EntAuthService
func (w *AuthServiceWrapper) ResetPassword(token, newPassword string) error {
	return w.ent.ResetPassword(context.Background(), token, newPassword)
}

// CompleteTOTPLogin delegates to EntAuthService
func (w *AuthServiceWrapper) CompleteTOTPLogin(pendingToken, totpCode, ipAddress, userAgent string) (*LoginResponse, error) {
	return w.ent.CompleteTOTPLogin(context.Background(), pendingToken, totpCode, ipAddress, userAgent)
}

// CompleteTOTPLoginWithBackupCode placeholder - needs EntAuthService implementation
func (w *AuthServiceWrapper) CompleteTOTPLoginWithBackupCode(pendingToken, backupCode, ipAddress, userAgent string) (*LoginResponse, error) {
	// TODO: Implement in EntAuthService
	return nil, nil
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

// RefreshSession delegates to EntSessionService
func (w *SessionServiceWrapper) RefreshSession(refreshToken, ip, userAgent string) (*TokenPair, error) {
	return w.ent.RefreshSession(context.Background(), refreshToken, ip, userAgent)
}

// RevokeSessionByRefreshToken delegates to EntSessionService
func (w *SessionServiceWrapper) RevokeSessionByRefreshToken(refreshToken, reason string) error {
	return w.ent.RevokeSessionByRefreshToken(context.Background(), refreshToken, reason)
}

// RevokeAllUserSessions delegates to EntSessionService
func (w *SessionServiceWrapper) RevokeAllUserSessions(userID uint, reason string) error {
	return w.ent.RevokeAllUserSessions(context.Background(), int(userID), reason)
}

// GetActiveSessions delegates to EntSessionService and converts result
func (w *SessionServiceWrapper) GetActiveSessions(userID uint) ([]*ent.Session, error) {
	return w.ent.GetActiveSessions(context.Background(), int(userID))
}

// RevokeSession delegates to EntSessionService
func (w *SessionServiceWrapper) RevokeSession(sessionID uint, reason string) error {
	return w.ent.RevokeSession(context.Background(), int(sessionID), reason)
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
func (w *TOTPServiceWrapper) VerifyAndEnable(userID uint, code string) error {
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
