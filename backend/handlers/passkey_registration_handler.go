package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"backend-gin/dto"
	apperrors "backend-gin/errors"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"go.uber.org/zap"
)

func (h *PasskeyHandler) ensurePinSetForPasskeyRegistration(c *gin.Context, userID uint) bool {
	if h.walletClient == nil {
		h.logger.Error("Passkey PIN guard is not configured", zap.Uint("user_id", userID))
		appErr := apperrors.NewAppError(
			"PASSKEY_SECURITY_CHECK_UNAVAILABLE",
			"Tidak dapat memverifikasi status keamanan PIN saat ini. Silakan coba lagi.",
			http.StatusServiceUnavailable,
		)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return false
	}

	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return false
	}

	status, err := h.walletClient.GetPinStatus(c.Request.Context(), authHeader)
	if err != nil {
		var walletErr *services.FeatureWalletError
		if errors.As(err, &walletErr) {
			if walletErr.StatusCode == http.StatusUnauthorized {
				c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
				return false
			}

			if walletErr.StatusCode == http.StatusForbidden {
				appCode := "PIN_REQUIRED"
				message := "Anda harus membuat PIN transaksi terlebih dahulu sebelum menambahkan passkey."
				if strings.EqualFold(strings.TrimSpace(walletErr.Code), "TWO_FACTOR_REQUIRED") {
					appCode = "TWO_FACTOR_REQUIRED"
					message = "Anda harus mengaktifkan 2FA terlebih dahulu sebelum membuat PIN transaksi dan menambahkan passkey."
				}

				appErr := apperrors.NewAppError(appCode, message, http.StatusForbidden)
				c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
				return false
			}
		}

		h.logger.Warn("Failed to validate PIN status before passkey registration",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		appErr := apperrors.NewAppError(
			"PASSKEY_SECURITY_CHECK_UNAVAILABLE",
			"Tidak dapat memverifikasi status keamanan PIN saat ini. Silakan coba lagi.",
			http.StatusServiceUnavailable,
		)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return false
	}

	if status == nil || !status.PinSet {
		appErr := apperrors.NewAppError(
			"PIN_REQUIRED",
			"Anda harus membuat PIN transaksi terlebih dahulu sebelum menambahkan passkey.",
			http.StatusForbidden,
		)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return false
	}

	return true
}

func (h *PasskeyHandler) verifyPinForPasskeyRegistration(c *gin.Context, userID uint, authHeader, pin string, pqc *services.PqcHeaders) bool {
	result, err := h.walletClient.VerifyPin(c.Request.Context(), authHeader, pin, pqc)
	if err != nil {
		var walletErr *services.FeatureWalletError
		if errors.As(err, &walletErr) {
			if walletErr.StatusCode == http.StatusUnauthorized {
				if strings.EqualFold(strings.TrimSpace(walletErr.Code), "INVALID_PIN") {
					message := strings.TrimSpace(walletErr.Message)
					if message == "" {
						message = "PIN transaksi tidak valid."
					}
					appErr := apperrors.NewAppError("INVALID_PIN", message, http.StatusUnauthorized)
					c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
					return false
				}

				if strings.EqualFold(strings.TrimSpace(walletErr.Code), "PQC_SIGNATURE_INVALID") {
					h.logger.Warn("PQC signature rejected during passkey PIN verification",
						zap.Uint("user_id", userID),
					)
					appErr := apperrors.NewAppError("PQC_SIGNATURE_INVALID",
						"Verifikasi tanda tangan PQC gagal. Silakan coba lagi.", http.StatusUnauthorized)
					c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
					return false
				}

				c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
				return false
			}

			if walletErr.StatusCode == http.StatusForbidden {
				appCode := "PIN_REQUIRED"
				message := "Anda harus membuat PIN transaksi terlebih dahulu sebelum menambahkan passkey."
				if strings.EqualFold(strings.TrimSpace(walletErr.Code), "TWO_FACTOR_REQUIRED") {
					appCode = "TWO_FACTOR_REQUIRED"
					message = "Anda harus mengaktifkan 2FA terlebih dahulu sebelum membuat PIN transaksi dan menambahkan passkey."
				}
				appErr := apperrors.NewAppError(appCode, message, http.StatusForbidden)
				c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
				return false
			}
		}

		h.logger.Warn("Failed to verify PIN before passkey registration",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		appErr := apperrors.NewAppError(
			"PASSKEY_PIN_VERIFICATION_UNAVAILABLE",
			"Tidak dapat memverifikasi PIN transaksi saat ini. Silakan coba lagi.",
			http.StatusServiceUnavailable,
		)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return false
	}

	if result == nil || !result.Valid {
		message := "PIN transaksi tidak valid."
		if result != nil && strings.TrimSpace(result.Message) != "" {
			message = strings.TrimSpace(result.Message)
		}
		appErr := apperrors.NewAppError("INVALID_PIN", message, http.StatusUnauthorized)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return false
	}

	return true
}

// GetStatus godoc
// @Summary      Get passkey status
// @Description  Returns whether the authenticated user has passkeys registered and their count.
// @Tags         Auth-Passkeys
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  dto.PasskeyStatusResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/passkeys/status [get]
// GetStatus returns passkey status for current user
func (h *PasskeyHandler) GetStatus(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
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

// ListPasskeys godoc
// @Summary      List user's passkeys
// @Description  Returns all passkeys registered by the authenticated user.
// @Tags         Auth-Passkeys
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  dto.PasskeyListResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/passkeys [get]
// ListPasskeys returns all passkeys for current user
func (h *PasskeyHandler) ListPasskeys(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
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

// BeginRegistration godoc
// @Summary      Begin passkey registration
// @Description  Start a passkey registration ceremony. Requires PIN verification before WebAuthn options are issued.
// @Tags         Auth-Passkeys
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      dto.PasskeyRegisterBeginRequest  true  "PIN for verification"
// @Success      200   {object}  dto.PasskeyRegisterBeginResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      403   {object}  handlers.SwaggerErrorResponse  "PIN not set or 2FA required"
// @Router       /auth/passkeys/register/begin [post]
// BeginRegistration starts passkey registration
func (h *PasskeyHandler) BeginRegistration(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return
	}

	if !h.ensurePinSetForPasskeyRegistration(c, userID) {
		return
	}

	var req dto.PasskeyRegisterBeginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrInvalidRequestBody))
		return
	}

	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return
	}

	var pqc *services.PqcHeaders
	if sig := strings.TrimSpace(c.GetHeader("X-PQC-Signature")); sig != "" {
		pqc = &services.PqcHeaders{
			Signature: sig,
			KeyID:     strings.TrimSpace(c.GetHeader("X-PQC-Key-Id")),
			Timestamp: strings.TrimSpace(c.GetHeader("X-PQC-Timestamp")),
		}
	}

	if !h.verifyPinForPasskeyRegistration(c, userID, authHeader, req.Pin, pqc) {
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

// FinishRegistration godoc
// @Summary      Complete passkey registration
// @Description  Complete the passkey registration ceremony with the credential from the browser's WebAuthn API.
// @Tags         Auth-Passkeys
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      dto.PasskeyRegisterFinishRequest  true  "Registration credential"
// @Success      200   {object}  dto.PasskeyResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      403   {object}  handlers.SwaggerErrorResponse  "PIN not set"
// @Router       /auth/passkeys/register/finish [post]
// FinishRegistration completes passkey registration
func (h *PasskeyHandler) FinishRegistration(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return
	}

	if !h.ensurePinSetForPasskeyRegistration(c, userID) {
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
