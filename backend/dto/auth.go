package dto

type RegisterRequest struct {
	Email    string  `json:"email" binding:"required"`
	Password string  `json:"password" binding:"required"`
	Username *string `json:"username"`
	FullName *string `json:"full_name"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginTOTPRequest for completing 2FA login
type LoginTOTPRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	TOTPCode string `json:"totp_code" binding:"required"`
}

type VerifyRequest struct {
	Email string `json:"email" binding:"required"`
}

type VerifyConfirmRequest struct {
	Token string `json:"token" binding:"required"`
}

// ForgotPasswordRequest for requesting password reset
type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required"`
}

// ResetPasswordRequest for resetting password with token
type ResetPasswordRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

// RefreshTokenRequest for token refresh
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// LogoutRequest for logout (optional refresh token)
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// ============ TOTP DTOs ============

// TOTPSetupResponse returned when initiating TOTP setup
type TOTPSetupResponse struct {
	Secret    string `json:"secret"`     // Base32 encoded secret (for manual entry)
	QRCodeURL string `json:"qr_code_url"` // otpauth:// URL for QR code generation
	Issuer    string `json:"issuer"`      // App name shown in authenticator
	Account   string `json:"account"`     // User identifier (email)
}

// TOTPVerifyRequest for verifying TOTP code
type TOTPVerifyRequest struct {
	Code string `json:"code" binding:"required"` // 6-digit TOTP code
}

// TOTPDisableRequest for disabling 2FA
type TOTPDisableRequest struct {
	Password string `json:"password" binding:"required"` // Current password for confirmation
	Code     string `json:"code" binding:"required"`     // Current TOTP code
}

// BackupCodesResponse returned when generating backup codes
type BackupCodesResponse struct {
	Codes []string `json:"codes"` // 10 backup codes (shown once, then hashed)
}

// BackupCodeVerifyRequest for using a backup code
type BackupCodeVerifyRequest struct {
	Code string `json:"code" binding:"required"` // One of the backup codes
}

// TOTPStatusResponse returns current 2FA status
type TOTPStatusResponse struct {
	Enabled    bool    `json:"enabled"`
	VerifiedAt *string `json:"verified_at,omitempty"` // ISO8601 timestamp
}
