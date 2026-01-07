package handlers

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strconv"

	"backend-gin/dto"
	"backend-gin/ent"
	"backend-gin/errors"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"go.uber.org/zap"
)

// PasskeyHandler handles passkey/WebAuthn endpoints
type PasskeyHandler struct {
	passkeyService *services.EntPasskeyService
	authService    *services.AuthServiceWrapper
	logger         *zap.Logger
}

// NewPasskeyHandler creates a new PasskeyHandler
func NewPasskeyHandler(passkeyService *services.EntPasskeyService, authService *services.AuthServiceWrapper, logger *zap.Logger) *PasskeyHandler {
	return &PasskeyHandler{
		passkeyService: passkeyService,
		authService:    authService,
		logger:         logger,
	}
}

func (h *PasskeyHandler) handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*errors.AppError); ok {
		c.JSON(appErr.StatusCode, gin.H{"error": appErr.Message})
		return
	}
	h.logger.Error("Passkey error", zap.Error(err))
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Akun Anda telah di hapus atau tidak di temukan"})
}

// GetStatus returns passkey status for current user
func (h *PasskeyHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	ctx := context.Background()
	count, err := h.passkeyService.GetPasskeyCount(ctx, int(userID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyStatusResponse{
		HasPasskeys: count > 0,
		Count:       count,
	})
}

// ListPasskeys returns all passkeys for current user
func (h *PasskeyHandler) ListPasskeys(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	ctx := context.Background()
	passkeys, err := h.passkeyService.ListPasskeys(ctx, int(userID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	response := make([]dto.PasskeyResponse, len(passkeys))
	for i, pk := range passkeys {
		response[i] = dto.PasskeyResponse{
			ID:         uint(pk.ID),
			Name:       pk.Name,
			CreatedAt:  pk.CreatedAt,
			LastUsedAt: pk.LastUsedAt,
			Transports: pk.Transports,
		}
	}

	c.JSON(http.StatusOK, dto.PasskeyListResponse{
		Passkeys: response,
		Count:    len(response),
	})
}

// BeginRegistration starts passkey registration
func (h *PasskeyHandler) BeginRegistration(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	ctx := context.Background()
	options, err := h.passkeyService.BeginRegistration(ctx, int(userID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyRegisterBeginResponse{
		Options: options,
	})
}

// FinishRegistration completes passkey registration
func (h *PasskeyHandler) FinishRegistration(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse the raw body to get name and credential
	var rawRequest struct {
		Name       string `json:"name"`
		Credential []byte `json:"credential"`
	}
	if err := c.ShouldBindJSON(&rawRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Parse the credential using WebAuthn library
	parsedResponse, err := protocol.ParseCredentialCreationResponseBody(
		bytes.NewReader(rawRequest.Credential),
	)
	if err != nil {
		h.logger.Error("Failed to parse credential", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credential format"})
		return
	}

	ctx := context.Background()
	passkey, err := h.passkeyService.FinishRegistration(ctx, int(userID), rawRequest.Name, parsedResponse)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyResponse{
		ID:         uint(passkey.ID),
		Name:       passkey.Name,
		CreatedAt:  passkey.CreatedAt,
		Transports: passkey.Transports,
	})
}

// DeletePasskey removes a passkey
func (h *PasskeyHandler) DeletePasskey(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid passkey ID"})
		return
	}

	ctx := context.Background()
	if err := h.passkeyService.DeletePasskey(ctx, int(userID), id); err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Passkey deleted"})
}

// RenamePasskey updates a passkey name
func (h *PasskeyHandler) RenamePasskey(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid passkey ID"})
		return
	}

	var req dto.PasskeyRenameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	ctx := context.Background()
	if err := h.passkeyService.RenamePasskey(ctx, int(userID), id, req.Name); err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Passkey renamed"})
}

// CheckPasskeys checks if an email has passkeys registered (public endpoint)
func (h *PasskeyHandler) CheckPasskeys(c *gin.Context) {
	var req dto.PasskeyCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	ctx := context.Background()
	hasPasskeys, err := h.passkeyService.HasPasskeysByEmail(ctx, req.Email)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyCheckResponse{
		HasPasskeys: hasPasskeys,
	})
}

// BeginLogin starts passkey login
func (h *PasskeyHandler) BeginLogin(c *gin.Context) {
	var req dto.PasskeyLoginBeginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body for discoverable login
		req = dto.PasskeyLoginBeginRequest{}
	}

	ctx := context.Background()

	if req.Email != "" {
		// Non-discoverable login with email
		options, err := h.passkeyService.BeginLogin(ctx, req.Email)
		if err != nil {
			h.handleError(c, err)
			return
		}

		c.JSON(http.StatusOK, dto.PasskeyLoginBeginResponse{
			Options: options,
		})
		return
	}

	// Discoverable login (usernameless)
	options, sessionID, err := h.passkeyService.BeginDiscoverableLogin()
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyLoginBeginResponse{
		Options:   options,
		SessionID: sessionID,
	})
}

// FinishLogin completes passkey login
func (h *PasskeyHandler) FinishLogin(c *gin.Context) {
	var rawRequest struct {
		Email      string `json:"email"`
		SessionID  string `json:"session_id"`
		Credential []byte `json:"credential"`
	}
	if err := c.ShouldBindJSON(&rawRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Parse the credential
	parsedResponse, err := protocol.ParseCredentialRequestResponseBody(
		bytes.NewReader(rawRequest.Credential),
	)
	if err != nil {
		h.logger.Error("Failed to parse credential", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credential format"})
		return
	}

	ctx := context.Background()
	var entUser *ent.User
	if rawRequest.SessionID != "" {
		// Discoverable login
		u, err := h.passkeyService.FinishDiscoverableLogin(ctx, rawRequest.SessionID, parsedResponse)
		if err != nil {
			h.handleError(c, err)
			return
		}
		entUser = u
	} else if rawRequest.Email != "" {
		// Non-discoverable login
		u, err := h.passkeyService.FinishLogin(ctx, rawRequest.Email, parsedResponse)
		if err != nil {
			h.handleError(c, err)
			return
		}
		entUser = u
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email or session_id required"})
		return
	}

	// Get client info for session
	userAgent := c.GetHeader("User-Agent")
	clientIP := c.ClientIP()

	h.logger.Info("Passkey login user info",
		zap.Int("user_id", entUser.ID),
		zap.String("email", entUser.Email),
		zap.Bool("email_verified", entUser.EmailVerified),
	)

	// Generate tokens using auth service with Ent user
	response, err := h.authService.LoginWithPasskeyEnt(entUser, clientIP, userAgent)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// Ensure io import is used
var _ io.Reader = (*bytes.Reader)(nil)
