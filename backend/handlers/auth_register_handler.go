package handlers

import (
	"net/http"

	"backend-gin/dto"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

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
	response, err := h.authService.RegisterWithDevice(c.Request.Context(), input, req.DeviceFingerprint, c.ClientIP(), c.GetHeader("User-Agent"))
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

	result, err := h.authService.RequestVerification(c.Request.Context(), req.Email, c.ClientIP())
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

	if err := h.authService.ConfirmVerification(c.Request.Context(), input); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email berhasil diverifikasi"})
}

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

	response, err := h.authService.ForgotPassword(c.Request.Context(), req.Email, c.ClientIP())
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": response.Message,
	})
}

// POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req dto.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid reset password request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Token dan password baru wajib diisi"))
		return
	}

	if err := h.authService.ResetPassword(c.Request.Context(), req.Token, req.NewPassword); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password berhasil direset. Silakan login dengan password baru.",
	})
}
