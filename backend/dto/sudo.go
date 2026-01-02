package dto

import "time"

// SudoVerifyRequest is the request to verify sudo mode
type SudoVerifyRequest struct {
	Password   string `json:"password" binding:"required"`
	TOTPCode   string `json:"totp_code,omitempty"`   // Required if TOTP enabled
	BackupCode string `json:"backup_code,omitempty"` // Alternative to TOTP
}

// SudoVerifyResponse is the response after successful sudo verification
type SudoVerifyResponse struct {
	SudoToken string    `json:"sudo_token"`
	ExpiresAt time.Time `json:"expires_at"`
	ExpiresIn int64     `json:"expires_in"` // seconds
	Message   string    `json:"message"`
}

// SudoStatusResponse shows the current sudo status
type SudoStatusResponse struct {
	IsActive     bool       `json:"is_active"`      // Whether sudo mode is active
	RequiresTOTP bool       `json:"requires_totp"`  // Whether TOTP is needed for sudo
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	ExpiresIn    int64      `json:"expires_in,omitempty"` // seconds remaining
}

// SudoExtendResponse is the response after extending sudo session
type SudoExtendResponse struct {
	ExpiresAt time.Time `json:"expires_at"`
	ExpiresIn int64     `json:"expires_in"`
	Message   string    `json:"message"`
}
