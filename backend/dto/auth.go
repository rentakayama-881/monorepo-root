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
