package handlers

import (
	"net/http"
	"time"

	"backend-gin/database"
	"backend-gin/dto"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/models"
	"backend-gin/services"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AuthHandler handles authentication HTTP requests
type AuthHandler struct {
	authService     *services.AuthService
	sessionService  *services.SessionService
	loginLimiter    *middleware.RateLimiter
	registerLimiter *middleware.RateLimiter
	verifyLimiter   *middleware.RateLimiter
	refreshLimiter  *middleware.RateLimiter
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthService, sessionService *services.SessionService) *AuthHandler {
	return &AuthHandler{
		authService:     authService,
		sessionService:  sessionService,
		loginLimiter:    middleware.NewRateLimiter(10, time.Minute),
		registerLimiter: middleware.NewRateLimiter(6, time.Minute),
		verifyLimiter:   middleware.NewRateLimiter(10, time.Minute),
		refreshLimiter:  middleware.NewRateLimiter(30, time.Minute),
	}
}

// handleError sends error response
func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		c.JSON(appErr.StatusCode, gin.H{
			"error": appErr.Message,
			"code":  appErr.Code,
		})
		return
	}

	logger.Error("Unhandled error", zap.Error(err))
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Terjadi kesalahan internal"})
}

// Register handles user registration
// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	if !h.registerLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid registration request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	input := validators.RegisterInput{
		Email:    req.Email,
		Password: req.Password,
		Username: req.Username,
		FullName: req.FullName,
	}

	// Use RegisterWithDevice if device fingerprint provided
	response, err := h.authService.RegisterWithDevice(input, req.DeviceFingerprint, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": response.Message,
		"verification": gin.H{
			"required": response.RequiresVerification,
		},
	})
}

// Login handles user login
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	if !h.loginLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid login request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	input := validators.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	}

	// Use new session-based login
	response, err := h.authService.LoginWithSession(input, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	// Check if TOTP verification is required
	if response.RequiresTOTP {
		c.JSON(http.StatusOK, gin.H{
			"requires_totp":  true,
			"totp_pending":   response.TOTPPending,
			"user": gin.H{
				"email":     response.Email,
				"username":  response.Username,
				"full_name": response.FullName,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"token_type":    "Bearer",
		"user": gin.H{
			"email":     response.Email,
			"username":  response.Username,
			"full_name": response.FullName,
		},
	})
}

// RequestVerification requests a new verification email
// POST /api/auth/verify/request
func (h *AuthHandler) RequestVerification(c *gin.Context) {
	if !h.verifyLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req dto.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid verification request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	_, _, err := h.authService.RequestVerification(req.Email, c.ClientIP())
	if err != nil {
		handleError(c, err)
		return
	}

	// Always return success message to avoid email enumeration
	c.JSON(http.StatusOK, gin.H{
		"message": "Jika email terdaftar, tautan verifikasi telah dikirim.",
	})
}

// ConfirmVerification confirms email verification
// POST /api/auth/verify/confirm
func (h *AuthHandler) ConfirmVerification(c *gin.Context) {
	var req dto.VerifyConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid verification confirm request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	input := validators.VerifyTokenInput{
		Token: req.Token,
	}

	if err := h.authService.ConfirmVerification(input); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email berhasil diverifikasi"})
}

// ForgotPassword handles password reset request
// POST /api/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	if !h.verifyLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req dto.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid forgot password request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Email wajib diisi"))
		return
	}

	response, err := h.authService.ForgotPassword(req.Email, c.ClientIP())
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": response.Message,
	})
}

// ResetPassword handles password reset with token
// POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req dto.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid reset password request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Token dan password baru wajib diisi"))
		return
	}

	if err := h.authService.ResetPassword(req.Token, req.NewPassword); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password berhasil direset. Silakan login dengan password baru.",
	})
}

// RefreshToken handles token refresh with rotation
// POST /api/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	if !h.refreshLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req dto.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Refresh token wajib diisi"))
		return
	}

	tokenPair, err := h.sessionService.RefreshSession(req.RefreshToken, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_in":    tokenPair.ExpiresIn,
		"token_type":    tokenPair.TokenType,
	})
}

// Logout revokes the current session
// POST /api/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	var req dto.LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow logout without body for backward compatibility
		c.JSON(http.StatusOK, gin.H{"message": "Berhasil logout"})
		return
	}

	if req.RefreshToken != "" {
		// Find and revoke session by refresh token
		_ = h.sessionService.RevokeSessionByRefreshToken(req.RefreshToken, "User logout")
	}

	c.JSON(http.StatusOK, gin.H{"message": "Berhasil logout"})
}

// LogoutAll revokes all sessions for the current user
// POST /api/auth/logout-all
func (h *AuthHandler) LogoutAll(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*models.User)

	if err := h.sessionService.RevokeAllUserSessions(user.ID, "User requested logout from all devices"); err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Berhasil logout dari semua perangkat"})
}

// GetActiveSessions returns all active sessions for the current user
// GET /api/auth/sessions
func (h *AuthHandler) GetActiveSessions(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*models.User)

	sessions, err := h.sessionService.GetActiveSessions(user.ID)
	if err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	// Map to safe response (don't expose token hashes)
	var response []gin.H
	for _, s := range sessions {
		response = append(response, gin.H{
			"id":           s.ID,
			"ip_address":   s.IPAddress,
			"user_agent":   s.UserAgent,
			"created_at":   s.CreatedAt,
			"last_used_at": s.LastUsedAt,
			"expires_at":   s.ExpiresAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"sessions": response})
}

// RevokeSession revokes a specific session
// DELETE /api/auth/sessions/:id
func (h *AuthHandler) RevokeSession(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*models.User)

	sessionID := c.Param("id")

	// Verify session belongs to user
	var session models.Session
	if err := database.DB.Where("id = ? AND user_id = ?", sessionID, user.ID).First(&session).Error; err != nil {
		handleError(c, apperrors.ErrSessionInvalid)
		return
	}

	if err := h.sessionService.RevokeSession(session.ID, "User revoked session"); err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Session berhasil dicabut"})
}

// LoginTOTP completes login with TOTP code after password verification
// POST /api/auth/login/totp
func (h *AuthHandler) LoginTOTP(c *gin.Context) {
	if !h.loginLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req struct {
		TOTPPending string `json:"totp_pending" binding:"required"`
		Code        string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid TOTP login request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	response, err := h.authService.CompleteTOTPLogin(req.TOTPPending, req.Code, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"token_type":    "Bearer",
		"user": gin.H{
			"email":     response.Email,
			"username":  response.Username,
			"full_name": response.FullName,
		},
	})
}

// LoginBackupCode completes login with backup code after password verification
// POST /api/auth/login/backup-code
func (h *AuthHandler) LoginBackupCode(c *gin.Context) {
	if !h.loginLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req struct {
		TOTPPending string `json:"totp_pending" binding:"required"`
		Code        string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid backup code login request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	response, err := h.authService.CompleteTOTPLoginWithBackupCode(req.TOTPPending, req.Code, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"token_type":    "Bearer",
		"user": gin.H{
			"email":     response.Email,
			"username":  response.Username,
			"full_name": response.FullName,
		},
	})
}
