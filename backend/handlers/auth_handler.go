package handlers

import (
	"net/http"
	"time"

	"backend-gin/dto"
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
	authService     *services.AuthService
	loginLimiter    *middleware.RateLimiter
	registerLimiter *middleware.RateLimiter
	verifyLimiter   *middleware.RateLimiter
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService:     authService,
		loginLimiter:    middleware.NewRateLimiter(10, time.Minute),
		registerLimiter: middleware.NewRateLimiter(6, time.Minute),
		verifyLimiter:   middleware.NewRateLimiter(10, time.Minute),
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

	response, err := h.authService.Register(input)
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

	response, err := h.authService.Login(input)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": response.Token,
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

	_, _, err := h.authService.RequestVerification(req.Email)
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

	response, err := h.authService.ForgotPassword(req.Email)
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
