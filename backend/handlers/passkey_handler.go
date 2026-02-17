package handlers

import (
	"bytes"
	"encoding/json"
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

type PasskeyHandler struct {
	passkeyService *services.EntPasskeyService
	authService    *services.EntAuthService
	logger         *zap.Logger
}

func NewPasskeyHandler(passkeyService *services.EntPasskeyService, authService *services.EntAuthService, logger *zap.Logger) *PasskeyHandler {
	return &PasskeyHandler{
		passkeyService: passkeyService,
		authService:    authService,
		logger:         logger,
	}
}

// GetStatus returns passkey status for current user
func (h *PasskeyHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, errors.ErrorResponse(errors.ErrUnauthorized))
		return
	}

	ctx := c.Request.Context()
	count, err := h.passkeyService.GetPasskeyCount(ctx, int(userID))
	if err != nil {
		handleError(c, err)
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
		c.JSON(http.StatusUnauthorized, errors.ErrorResponse(errors.ErrUnauthorized))
		return
	}

	ctx := c.Request.Context()
	passkeys, err := h.passkeyService.ListPasskeys(ctx, int(userID))
	if err != nil {
		handleError(c, err)
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
		c.JSON(http.StatusUnauthorized, errors.ErrorResponse(errors.ErrUnauthorized))
		return
	}

	ctx := c.Request.Context()
	options, sessionID, err := h.passkeyService.BeginRegistration(ctx, int(userID))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dto.PasskeyRegisterBeginResponse{
		Options:   options,
		SessionID: sessionID,
	})
}

// FinishRegistration completes passkey registration
func (h *PasskeyHandler) FinishRegistration(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, errors.ErrorResponse(errors.ErrUnauthorized))
		return
	}

	// Parse the raw body to get name and credential
	var rawRequest struct {
		Name       string          `json:"name"`
		SessionID  string          `json:"session_id"`
		Credential json.RawMessage `json:"credential"`
	}
	if err := c.ShouldBindJSON(&rawRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if rawRequest.SessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
		return
	}
	if len(rawRequest.Credential) == 0 {
		h.logger.Warn("Passkey registration missing credential payload",
			zap.String("host", c.Request.Host),
			zap.String("origin", c.GetHeader("Origin")),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Parse the credential using WebAuthn library
	parsedResponse, err := protocol.ParseCredentialCreationResponseBody(
		bytes.NewReader(rawRequest.Credential),
	)
	if err != nil {
		h.logger.Error("Failed to parse registration credential",
			zap.Error(err),
			zap.String("host", c.Request.Host),
			zap.String("origin", c.GetHeader("Origin")),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credential format"})
		return
	}

	ctx := c.Request.Context()
	passkey, err := h.passkeyService.FinishRegistration(ctx, int(userID), rawRequest.SessionID, rawRequest.Name, parsedResponse)
	if err != nil {
		handleError(c, err)
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
		c.JSON(http.StatusUnauthorized, errors.ErrorResponse(errors.ErrUnauthorized))
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid passkey ID"})
		return
	}

	ctx := c.Request.Context()
	if err := h.passkeyService.DeletePasskey(ctx, int(userID), id); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Passkey deleted"})
}

// RenamePasskey updates a passkey name
func (h *PasskeyHandler) RenamePasskey(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, errors.ErrorResponse(errors.ErrUnauthorized))
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

	ctx := c.Request.Context()
	if err := h.passkeyService.RenamePasskey(ctx, int(userID), id, req.Name); err != nil {
		handleError(c, err)
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

	ctx := c.Request.Context()
	hasPasskeys, err := h.passkeyService.HasPasskeysByEmail(ctx, req.Email)
	if err != nil {
		handleError(c, err)
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

	ctx := c.Request.Context()

	if req.Email != "" {
		// Non-discoverable login with email
		options, sessionID, err := h.passkeyService.BeginLogin(ctx, req.Email)
		if err != nil {
			handleError(c, err)
			return
		}

		c.JSON(http.StatusOK, dto.PasskeyLoginBeginResponse{
			Options:   options,
			SessionID: sessionID,
		})
		return
	}

	// Discoverable login (usernameless)
	options, sessionID, err := h.passkeyService.BeginDiscoverableLogin()
	if err != nil {
		handleError(c, err)
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
		Email             string          `json:"email"`
		SessionID         string          `json:"session_id"`
		Credential        json.RawMessage `json:"credential"`
		DeviceFingerprint string          `json:"device_fingerprint"`
	}
	if err := c.ShouldBindJSON(&rawRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if len(rawRequest.Credential) == 0 {
		h.logger.Warn("Passkey login missing credential payload",
			zap.String("host", c.Request.Host),
			zap.String("origin", c.GetHeader("Origin")),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Parse the credential
	parsedResponse, err := protocol.ParseCredentialRequestResponseBody(
		bytes.NewReader(rawRequest.Credential),
	)
	if err != nil {
		h.logger.Error("Failed to parse login credential",
			zap.Error(err),
			zap.String("host", c.Request.Host),
			zap.String("origin", c.GetHeader("Origin")),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid credential format"})
		return
	}

	ctx := c.Request.Context()
	var entUser *ent.User
	if rawRequest.SessionID != "" && rawRequest.Email == "" {
		// Discoverable login
		u, err := h.passkeyService.FinishDiscoverableLogin(ctx, rawRequest.SessionID, parsedResponse)
		if err != nil {
			handleError(c, err)
			return
		}
		entUser = u
	} else if rawRequest.SessionID != "" && rawRequest.Email != "" {
		// Non-discoverable login
		u, err := h.passkeyService.FinishLogin(ctx, rawRequest.Email, rawRequest.SessionID, parsedResponse)
		if err != nil {
			handleError(c, err)
			return
		}
		entUser = u
	} else if rawRequest.Email != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required for email login"})
		return
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id required"})
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
	response, err := h.authService.LoginWithPasskey(c.Request.Context(), entUser, clientIP, userAgent, rawRequest.DeviceFingerprint)
	if err != nil {
		handleError(c, err)
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
	}

	c.JSON(http.StatusOK, response)
}
