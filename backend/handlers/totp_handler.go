package handlers

import (
	"net/http"

	"backend-gin/dto"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// TOTPHandler handles TOTP/2FA related endpoints
type TOTPHandler struct {
	totpService *services.TOTPServiceWrapper
	logger      *zap.Logger
}

// NewTOTPHandler creates a new TOTP handler
func NewTOTPHandler(totpService *services.TOTPServiceWrapper, log *zap.Logger) *TOTPHandler {
	return &TOTPHandler{
		totpService: totpService,
		logger:      log,
	}
}

// handleTOTPError sends error response for TOTP handlers
func handleTOTPError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	logger.Error("Unhandled error in TOTP handler", zap.Error(err))
	c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
}

// GetStatus returns current 2FA status
// GET /api/auth/totp/status
func (h *TOTPHandler) GetStatus(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	status, err := h.totpService.GetStatus(userID.(uint))
	if err != nil {
		handleTOTPError(c, err)
		return
	}

	c.JSON(http.StatusOK, status)
}

// Setup initiates TOTP setup and returns QR code data
// POST /api/auth/totp/setup
func (h *TOTPHandler) Setup(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	setup, err := h.totpService.GenerateSetup(userID.(uint))
	if err != nil {
		handleTOTPError(c, err)
		return
	}

	c.JSON(http.StatusOK, setup)
}

// Verify verifies a TOTP code and enables 2FA
// POST /api/auth/totp/verify
// Returns backup codes that should be shown to user ONLY ONCE
func (h *TOTPHandler) Verify(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	var req dto.TOTPVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleTOTPError(c, apperrors.ErrInvalidRequestBody)
		return
	}

	backupCodes, err := h.totpService.VerifyAndEnable(userID.(uint), req.Code)
	if err != nil {
		handleTOTPError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "2FA berhasil diaktifkan",
		"enabled":      true,
		"backup_codes": backupCodes,
	})
}

// Disable disables 2FA after verification
// POST /api/auth/totp/disable
func (h *TOTPHandler) Disable(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	var req dto.TOTPDisableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleTOTPError(c, apperrors.ErrInvalidRequestBody)
		return
	}

	// Password verification function
	verifyPassword := func(hash, password string) bool {
		return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
	}

	if err := h.totpService.Disable(userID.(uint), req.Password, req.Code, verifyPassword); err != nil {
		handleTOTPError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "2FA berhasil dinonaktifkan",
		"enabled": false,
	})
}

// GenerateBackupCodes generates new backup codes
// POST /api/auth/totp/backup-codes
func (h *TOTPHandler) GenerateBackupCodes(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	codes, err := h.totpService.GenerateBackupCodes(userID.(uint))
	if err != nil {
		handleTOTPError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"codes": codes})
}

// GetBackupCodeCount returns the number of remaining backup codes
// GET /api/auth/totp/backup-codes/count
func (h *TOTPHandler) GetBackupCodeCount(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	count, err := h.totpService.GetBackupCodeCount(userID.(uint))
	if err != nil {
		handleTOTPError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": count,
	})
}

// VerifyCode verifies a TOTP code without enabling (for sudo mode, etc)
// POST /api/auth/totp/verify-code
func (h *TOTPHandler) VerifyCode(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleTOTPError(c, apperrors.ErrUnauthorized)
		return
	}

	var req dto.TOTPVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleTOTPError(c, apperrors.ErrInvalidRequestBody)
		return
	}

	valid, err := h.totpService.Verify(userID.(uint), req.Code)
	if err != nil {
		handleTOTPError(c, err)
		return
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{
			"valid":   false,
			"message": "Kode tidak valid",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":   true,
		"message": "Kode valid",
	})
}
