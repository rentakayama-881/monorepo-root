package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/ent"
	"backend-gin/ent/session"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/services"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AuthHandler handles authentication HTTP requests
type AuthHandler struct {
	authService     *services.AuthServiceWrapper
	sessionService  *services.SessionServiceWrapper
	loginLimiter    *middleware.RateLimiter
	registerLimiter *middleware.RateLimiter
	verifyLimiter   *middleware.RateLimiter
	refreshLimiter  *middleware.RateLimiter
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthServiceWrapper, sessionService *services.SessionServiceWrapper) *AuthHandler {
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
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	logger.Error("Unhandled error", zap.Error(err))
	c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
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
	response, err := h.authService.RegisterWithDeviceCtx(c.Request.Context(), input, req.DeviceFingerprint, c.ClientIP(), c.GetHeader("User-Agent"))
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
	response, err := h.authService.LoginWithSessionCtx(c.Request.Context(), input, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	// Check if TOTP verification is required
	if response.RequiresTOTP {
		c.JSON(http.StatusOK, gin.H{
			"requires_totp": true,
			"totp_pending":  response.TOTPPending,
			"user": gin.H{
				"email":     response.Email,
				"username":  response.Username,
				"full_name": response.FullName,
			},
		})
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
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

	result, err := h.authService.RequestVerificationCtx(c.Request.Context(), req.Email, c.ClientIP())
	if err != nil {
		// Include server-side retry metadata for rate-limit responses.
		if appErr, ok := err.(*apperrors.AppError); ok && result != nil && result.RetryAfterSeconds > 0 &&
			(appErr.Code == "AUTH016" || appErr.Code == "AUTH018") {
			payload := apperrors.ErrorResponse(appErr)
			payload["retry_after_seconds"] = result.RetryAfterSeconds
			c.JSON(appErr.StatusCode, payload)
			return
		}
		handleError(c, err)
		return
	}

	// Always return success message to avoid email enumeration
	response := gin.H{
		"message": "Jika email terdaftar, tautan verifikasi telah dikirim.",
	}
	if result != nil && result.RetryAfterSeconds > 0 {
		response["retry_after_seconds"] = result.RetryAfterSeconds
	}

	c.JSON(http.StatusOK, response)
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

	if err := h.authService.ConfirmVerificationCtx(c.Request.Context(), input); err != nil {
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

	response, err := h.authService.ForgotPasswordCtx(c.Request.Context(), req.Email, c.ClientIP())
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

	if err := h.authService.ResetPasswordCtx(c.Request.Context(), req.Token, req.NewPassword); err != nil {
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

	refreshToken := getRefreshTokenFromCookie(c)
	if refreshToken == "" {
		var req dto.RefreshTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			handleError(c, apperrors.ErrInvalidInput.WithDetails("Refresh token wajib diisi"))
			return
		}
		refreshToken = strings.TrimSpace(req.RefreshToken)
	}

	if refreshToken == "" {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Refresh token wajib diisi"))
		return
	}

	tokenPair, err := h.sessionService.RefreshSessionCtx(c.Request.Context(), refreshToken, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	if tokenPair.RefreshToken != "" {
		setRefreshTokenCookie(c, tokenPair.RefreshToken)
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
	// Allow logout without body for backward compatibility.
	_ = c.ShouldBindJSON(&req)

	refreshToken := strings.TrimSpace(req.RefreshToken)
	if refreshToken == "" {
		refreshToken = getRefreshTokenFromCookie(c)
	}

	if refreshToken != "" {
		// Find and revoke session by refresh token
		_ = h.sessionService.RevokeSessionByRefreshTokenCtx(c.Request.Context(), refreshToken, "User logout")
	}

	clearRefreshTokenCookie(c)
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
	user := userIfc.(*ent.User)

	if err := h.sessionService.RevokeAllUserSessionsCtx(c.Request.Context(), uint(user.ID), "User requested logout from all devices"); err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	clearRefreshTokenCookie(c)
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
	user := userIfc.(*ent.User)

	sessions, err := h.sessionService.GetActiveSessionsCtx(c.Request.Context(), uint(user.ID))
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
	user := userIfc.(*ent.User)

	sessionID := c.Param("id")
	sessionIDInt, err := strconv.Atoi(sessionID)
	if err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("ID session tidak valid"))
		return
	}

	// Verify session belongs to user using Ent
	_, err = database.GetEntClient().Session.Query().
		Where(session.IDEQ(sessionIDInt), session.UserIDEQ(int(user.ID))).
		Only(c.Request.Context())
	if err != nil {
		handleError(c, apperrors.ErrSessionInvalid)
		return
	}

	if err := h.sessionService.RevokeSessionCtx(c.Request.Context(), uint(sessionIDInt), "User revoked session"); err != nil {
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

	response, err := h.authService.CompleteTOTPLoginCtx(c.Request.Context(), req.TOTPPending, req.Code, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
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

	response, err := h.authService.CompleteTOTPLoginWithBackupCodeCtx(c.Request.Context(), req.TOTPPending, req.Code, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
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
