package handlers

import (
	"net/http"

	"backend-gin/dto"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// SudoHandler handles sudo mode endpoints
type SudoHandler struct {
	sudoService *services.EntSudoService
	logger      *zap.Logger
}

// NewSudoHandler creates a new SudoHandler
func NewEntSudoHandler(sudoService *services.EntSudoService, logger *zap.Logger) *SudoHandler {
	return &SudoHandler{
		sudoService: sudoService,
		logger:      logger,
	}
}

// Verify handles POST /sudo/verify - verify password + TOTP to enter sudo mode
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

// GetStatus handles GET /sudo/status - check if sudo mode is active
func (h *SudoHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
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
		c.JSON(http.StatusOK, dto.SudoStatusResponse{IsActive: false, RequiresTOTP: false})
		return
	}
	c.JSON(http.StatusOK, dto.SudoStatusResponse{
		IsActive:     true,
		RequiresTOTP: false,
		ExpiresAt:    &active.ExpiresAt,
		ExpiresIn:    active.ExpiresIn,
	})
}

// Extend handles POST /sudo/extend - extend sudo session
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

// Revoke handles DELETE /sudo - revoke sudo session
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
