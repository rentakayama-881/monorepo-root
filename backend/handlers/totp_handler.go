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

// GetStatus godoc
// @Summary      Check TOTP enabled status
// @Description  Returns the current 2FA/TOTP status for the authenticated user.
// @Tags         Auth-TOTP
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  dto.TOTPStatusResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/status [get]
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

// Setup godoc
// @Summary      Begin TOTP setup
// @Description  Generate a new TOTP secret and return the QR code URL for the authenticator app.
// @Tags         Auth-TOTP
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  dto.TOTPSetupResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/setup [post]
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

// Verify godoc
// @Summary      Verify TOTP setup and enable 2FA
// @Description  Verify a TOTP code to complete 2FA setup. Returns backup codes (shown only once).
// @Tags         Auth-TOTP
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      dto.TOTPVerifyRequest  true  "TOTP code"
// @Success      200   {object}  handlers.SwaggerTOTPVerifyEnabledResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/verify [post]
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

// Disable godoc
// @Summary      Disable TOTP 2FA
// @Description  Disable two-factor authentication. Requires current password and a valid TOTP code.
// @Tags         Auth-TOTP
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      dto.TOTPDisableRequest  true  "Password and TOTP code"
// @Success      200   {object}  handlers.SwaggerTOTPDisableResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/disable [post]
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

// GenerateBackupCodes godoc
// @Summary      Generate new backup codes
// @Description  Generate a new set of backup codes. Previous codes are invalidated.
// @Tags         Auth-TOTP
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerBackupCodesGenerateResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/backup-codes [post]
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

// GetBackupCodeCount godoc
// @Summary      Get backup codes count
// @Description  Returns the number of remaining unused backup codes.
// @Tags         Auth-TOTP
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerBackupCodeCountResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/backup-codes/count [get]
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

// VerifyCode godoc
// @Summary      Verify a TOTP code
// @Description  Verify a TOTP code without enabling 2FA. Used for sudo mode and other verification flows.
// @Tags         Auth-TOTP
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      dto.TOTPVerifyRequest  true  "TOTP code"
// @Success      200   {object}  handlers.SwaggerTOTPVerifyCodeResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/totp/verify-code [post]
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
