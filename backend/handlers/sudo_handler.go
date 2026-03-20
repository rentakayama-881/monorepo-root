package handlers

import (
	"net/http"

	"backend-gin/dto"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type SudoHandler struct {
	sudoService *services.EntSudoService
	logger      *zap.Logger
}

func NewEntSudoHandler(sudoService *services.EntSudoService, logger *zap.Logger) *SudoHandler {
	return &SudoHandler{
		sudoService: sudoService,
		logger:      logger,
	}
}

// Verify godoc
// @Summary      Verify sudo mode
// @Description  Re-authenticate to enter sudo mode. Requires password, and optionally TOTP code or backup code if 2FA is enabled.
// @Tags         Auth-Sudo
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      dto.SudoVerifyRequest  true  "Sudo credentials"
// @Success      200   {object}  dto.SudoVerifyResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/sudo/verify [post]
// POST /sudo/verify
func (h *SudoHandler) Verify(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req dto.SudoVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password diperlukan"})
		return
	}

	input := services.EntSudoVerifyInput{
		UserID:     int(userID),
		Password:   req.Password,
		TOTPCode:   req.TOTPCode,
		BackupCode: req.BackupCode,
		IPAddress:  c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	}
	result, err := h.sudoService.Verify(c.Request.Context(), input)
	if err != nil {
		h.logger.Debug("Sudo verification failed",
			zap.Uint("user_id", userID),
			zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.SudoVerifyResponse{
		SudoToken: result.SudoToken,
		ExpiresAt: result.ExpiresAt,
		ExpiresIn: result.ExpiresIn,
		Message:   "Sudo mode aktif",
	})
}

// GetStatus godoc
// @Summary      Check sudo mode status
// @Description  Check whether sudo mode is currently active for the authenticated user.
// @Tags         Auth-Sudo
// @Produce      json
// @Security     BearerAuth
// @Param        X-Sudo-Token  header    string  false  "Sudo token"
// @Success      200  {object}  dto.SudoStatusResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      500  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/sudo/status [get]
// GET /sudo/status
func (h *SudoHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Check if user has TOTP enabled
	totpEnabled, err := h.sudoService.CheckUserTOTPEnabled(c.Request.Context(), int(userID))
	if err != nil {
		h.logger.Error("Failed to check TOTP status", zap.Error(err))
		// Continue with false - non-critical
		totpEnabled = false
	}

	// Get sudo token from header
	sudoToken := c.GetHeader("X-Sudo-Token")

	active, err := h.sudoService.GetActiveSession(c.Request.Context(), int(userID), sudoToken)
	if err != nil {
		h.logger.Error("Failed to get sudo status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa status sudo"})
		return
	}
	if active == nil {
		c.JSON(http.StatusOK, dto.SudoStatusResponse{IsActive: false, RequiresTOTP: totpEnabled})
		return
	}
	c.JSON(http.StatusOK, dto.SudoStatusResponse{
		IsActive:     true,
		RequiresTOTP: totpEnabled,
		ExpiresAt:    &active.ExpiresAt,
		ExpiresIn:    active.ExpiresIn,
	})
}

// Extend godoc
// @Summary      Extend sudo session
// @Description  Extend the current sudo session duration. Requires a valid sudo token in the X-Sudo-Token header.
// @Tags         Auth-Sudo
// @Produce      json
// @Security     BearerAuth
// @Param        X-Sudo-Token  header    string  true  "Sudo token"
// @Success      200  {object}  dto.SudoExtendResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/sudo/extend [post]
// POST /sudo/extend
func (h *SudoHandler) Extend(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	sudoToken := c.GetHeader("X-Sudo-Token")
	if sudoToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sudo token diperlukan"})
		return
	}

	result, err := h.sudoService.ExtendSession(c.Request.Context(), int(userID), sudoToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.SudoExtendResponse{
		ExpiresAt: result.ExpiresAt,
		ExpiresIn: result.ExpiresIn,
		Message:   "Sesi sudo diperpanjang",
	})
}

// Revoke godoc
// @Summary      Revoke sudo mode
// @Description  End the current sudo session. If a sudo token is provided, it will be specifically revoked.
// @Tags         Auth-Sudo
// @Produce      json
// @Security     BearerAuth
// @Param        X-Sudo-Token  header    string  false  "Sudo token"
// @Success      200  {object}  handlers.SwaggerMessageResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/sudo [delete]
// DELETE /sudo
func (h *SudoHandler) Revoke(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	sudoToken := c.GetHeader("X-Sudo-Token")
	if sudoToken != "" {
		if err := h.sudoService.Revoke(c.Request.Context(), int(userID), sudoToken); err != nil {
			h.logger.Warn("Failed to revoke sudo token", zap.Error(err))
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Sesi sudo diakhiri"})
}
