package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"backend-gin/dto"
	"backend-gin/errors"
	"backend-gin/models"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"go.uber.org/zap"
)

// PasskeyHandler handles passkey/WebAuthn endpoints
type PasskeyHandler struct {
	passkeyService *services.PasskeyService
	authService    *services.AuthService
	logger         *zap.Logger
}

// NewPasskeyHandler creates a new PasskeyHandler
func NewPasskeyHandler(passkeyService *services.PasskeyService, authService *services.AuthService, logger *zap.Logger) *PasskeyHandler {
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
	c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
}

// GetStatus returns passkey status for current user
func (h *PasskeyHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	count, err := h.passkeyService.GetPasskeyCount(userID)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyStatusResponse{
		HasPasskeys: count > 0,
		Count:       int(count),
	})
}

// ListPasskeys returns all passkeys for current user
func (h *PasskeyHandler) ListPasskeys(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	passkeys, err := h.passkeyService.ListPasskeys(userID)
	if err != nil {
		h.handleError(c, err)
		return
	}

	response := make([]dto.PasskeyResponse, len(passkeys))
	for i, pk := range passkeys {
		var transports []string
		if pk.Transports != nil {
			_ = json.Unmarshal(pk.Transports, &transports)
		}
		response[i] = dto.PasskeyResponse{
			ID:         pk.ID,
			Name:       pk.Name,
			CreatedAt:  pk.CreatedAt,
			LastUsedAt: pk.LastUsedAt,
			Transports: transports,
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

	options, err := h.passkeyService.BeginRegistration(userID)
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
		Name       string          `json:"name"`
		Credential json.RawMessage `json:"credential"`
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

	passkey, err := h.passkeyService.FinishRegistration(userID, rawRequest.Name, parsedResponse)
	if err != nil {
		h.handleError(c, err)
		return
	}

	var transports []string
	if passkey.Transports != nil {
		_ = json.Unmarshal(passkey.Transports, &transports)
	}

	c.JSON(http.StatusOK, dto.PasskeyResponse{
		ID:        passkey.ID,
		Name:      passkey.Name,
		CreatedAt: passkey.CreatedAt,
		Transports: transports,
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
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid passkey ID"})
		return
	}

	if err := h.passkeyService.DeletePasskey(userID, uint(id)); err != nil {
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
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid passkey ID"})
		return
	}

	var req dto.PasskeyRenameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := h.passkeyService.RenamePasskey(userID, uint(id), req.Name); err != nil {
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

	hasPasskeys, err := h.passkeyService.HasPasskeysByEmail(req.Email)
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

	if req.Email != "" {
		// Non-discoverable login with email
		options, err := h.passkeyService.BeginLogin(req.Email)
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
		Email      string          `json:"email"`
		SessionID  string          `json:"session_id"`
		Credential json.RawMessage `json:"credential"`
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

	var user *models.User
	if rawRequest.SessionID != "" {
		// Discoverable login
		u, err := h.passkeyService.FinishDiscoverableLogin(rawRequest.SessionID, parsedResponse)
		if err != nil {
			h.handleError(c, err)
			return
		}
		user = u
	} else if rawRequest.Email != "" {
		// Non-discoverable login
		u, err := h.passkeyService.FinishLogin(rawRequest.Email, parsedResponse)
		if err != nil {
			h.handleError(c, err)
			return
		}
		user = u
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email or session_id required"})
		return
	}

	// Get client info for session
	userAgent := c.GetHeader("User-Agent")
	clientIP := c.ClientIP()

	// Generate tokens using auth service
	// Signature: LoginWithPasskey(user *User, ipAddress, userAgent string)
	response, err := h.authService.LoginWithPasskey(user, clientIP, userAgent)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// Ensure io import is used
var _ io.Reader = (*bytes.Reader)(nil)
