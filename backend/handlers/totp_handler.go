package handlers

import (
	"net/http"

	"backend-gin/dto"
	apperrors "backend-gin/errors"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type TOTPHandler struct {
	totpService *services.EntTOTPService
}

func NewTOTPHandler(totpService *services.EntTOTPService) *TOTPHandler {
	return &TOTPHandler{totpService: totpService}
}

// GET /api/auth/totp/status
func (h *TOTPHandler) GetStatus(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	ctx := c.Request.Context()
	status, err := h.totpService.GetStatus(ctx, int(userID.(uint)))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, status)
}

// POST /api/auth/totp/setup
func (h *TOTPHandler) Setup(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	ctx := c.Request.Context()
	setup, err := h.totpService.GenerateSetup(ctx, int(userID.(uint)))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, setup)
}

// Enables 2FA after verifying code. Returns backup codes (shown ONLY ONCE).
// POST /api/auth/totp/verify
func (h *TOTPHandler) Verify(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	var req dto.TOTPVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody)
		return
	}

	ctx := c.Request.Context()
	backupCodes, err := h.totpService.VerifyAndEnable(ctx, int(userID.(uint)), req.Code)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "2FA berhasil diaktifkan",
		"enabled":      true,
		"backup_codes": backupCodes,
	})
}

// POST /api/auth/totp/disable
func (h *TOTPHandler) Disable(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	var req dto.TOTPDisableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody)
		return
	}

	verifyPassword := func(hash, password string) bool {
		return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
	}

	ctx := c.Request.Context()
	if err := h.totpService.Disable(ctx, int(userID.(uint)), req.Password, req.Code, verifyPassword); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "2FA berhasil dinonaktifkan",
		"enabled": false,
	})
}

// POST /api/auth/totp/backup-codes
func (h *TOTPHandler) GenerateBackupCodes(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	ctx := c.Request.Context()
	codes, err := h.totpService.GenerateBackupCodes(ctx, int(userID.(uint)))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"codes": codes})
}

// GET /api/auth/totp/backup-codes/count
func (h *TOTPHandler) GetBackupCodeCount(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	ctx := c.Request.Context()
	count, err := h.totpService.GetBackupCodeCount(ctx, int(userID.(uint)))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": count,
	})
}

// Verifies a TOTP code without enabling (for sudo mode, etc).
// POST /api/auth/totp/verify-code
func (h *TOTPHandler) VerifyCode(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	var req dto.TOTPVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody)
		return
	}

	ctx := c.Request.Context()
	valid, err := h.totpService.Verify(ctx, int(userID.(uint)), req.Code)
	if err != nil {
		handleError(c, err)
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
