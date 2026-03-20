package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/ent/session"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/services"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AuthHandler struct {
	authService     *services.EntAuthService
	sessionService  *services.EntSessionService
	loginLimiter    *middleware.RateLimiter
	registerLimiter *middleware.RateLimiter
	verifyLimiter   *middleware.RateLimiter
	refreshLimiter  *middleware.RateLimiter
}

func NewAuthHandler(authService *services.EntAuthService, sessionService *services.EntSessionService) *AuthHandler {
	return &AuthHandler{
		authService:     authService,
		sessionService:  sessionService,
		loginLimiter:    middleware.NewRateLimiter(10, time.Minute),
		registerLimiter: middleware.NewRateLimiter(6, time.Minute),
		verifyLimiter:   middleware.NewRateLimiter(10, time.Minute),
		refreshLimiter:  middleware.NewRateLimiter(30, time.Minute),
	}
}

// Login godoc
// @Summary      User login
// @Description  Authenticate user with email and password. Returns JWT tokens on success, or requires TOTP if 2FA is enabled.
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.LoginRequest  true  "Login credentials"
// @Success      200   {object}  handlers.SwaggerLoginResponse
// @Success      200   {object}  handlers.SwaggerLoginTOTPRequiredResponse  "When 2FA is enabled"
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      429   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/login [post]
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	if !h.loginLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid login request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	input := validators.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	}

	// Use new session-based login with device fingerprint
	response, err := h.authService.LoginWithSession(c.Request.Context(), input, c.ClientIP(), c.GetHeader("User-Agent"), req.DeviceFingerprint)
	if err != nil {
		handleError(c, err)
		return
	}

	// Check if TOTP verification is required
	if response.RequiresTOTP {
		c.JSON(http.StatusOK, gin.H{
			"requires_totp": true,
			"totp_pending":  response.TOTPPending,
			"user": gin.H{
				"email":     response.Email,
				"username":  response.Username,
				"full_name": response.FullName,
			},
		})
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"token_type":    "Bearer",
		"user": gin.H{
			"email":     response.Email,
			"username":  response.Username,
			"full_name": response.FullName,
		},
	})
}

// RefreshToken godoc
// @Summary      Refresh access token
// @Description  Exchange a valid refresh token for a new access/refresh token pair. Accepts token from cookie or JSON body.
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.RefreshTokenRequest  false  "Refresh token (optional if sent via cookie)"
// @Success      200   {object}  handlers.SwaggerRefreshResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      429   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/refresh [post]
// POST /api/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	if !h.refreshLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	refreshToken := getRefreshTokenFromCookie(c)
	if refreshToken == "" {
		var req dto.RefreshTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			handleError(c, apperrors.ErrInvalidInput.WithDetails("Refresh token wajib diisi"))
			return
		}
		refreshToken = strings.TrimSpace(req.RefreshToken)
	}

	if refreshToken == "" {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Refresh token wajib diisi"))
		return
	}

	tokenPair, err := h.sessionService.RefreshSession(c.Request.Context(), refreshToken, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		handleError(c, err)
		return
	}

	if tokenPair.RefreshToken != "" {
		setRefreshTokenCookie(c, tokenPair.RefreshToken)
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_in":    tokenPair.ExpiresIn,
		"token_type":    tokenPair.TokenType,
	})
}

// Logout godoc
// @Summary      Logout user
// @Description  Revoke the current session and clear refresh token cookie.
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      dto.LogoutRequest  false  "Refresh token (optional)"
// @Success      200   {object}  handlers.SwaggerMessageResponse
// @Router       /auth/logout [post]
// POST /api/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	var req dto.LogoutRequest
	// Allow logout without body for backward compatibility.
	_ = c.ShouldBindJSON(&req)

	refreshToken := strings.TrimSpace(req.RefreshToken)
	if refreshToken == "" {
		refreshToken = getRefreshTokenFromCookie(c)
	}

	if refreshToken != "" {
		// Find and revoke session by refresh token
		_ = h.sessionService.RevokeSessionByRefreshToken(c.Request.Context(), refreshToken, "User logout")
	}

	clearRefreshTokenCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Berhasil logout"})
}

// LogoutAll godoc
// @Summary      Logout from all devices
// @Description  Revoke all active sessions for the current user.
// @Tags         Auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerMessageResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/logout-all [post]
// POST /api/auth/logout-all
func (h *AuthHandler) LogoutAll(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	if err := h.sessionService.RevokeAllUserSessions(c.Request.Context(), user.ID, "User requested logout from all devices"); err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	clearRefreshTokenCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "Berhasil logout dari semua perangkat"})
}

// GetActiveSessions godoc
// @Summary      List active sessions
// @Description  Returns all active sessions for the authenticated user.
// @Tags         Auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerSessionListResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/sessions [get]
// GET /api/auth/sessions
func (h *AuthHandler) GetActiveSessions(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	sessions, err := h.sessionService.GetActiveSessions(c.Request.Context(), user.ID)
	if err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	// Map to safe response (don't expose token hashes)
	var response []gin.H
	for _, s := range sessions {
		response = append(response, gin.H{
			"id":           s.ID,
			"ip_address":   s.IPAddress,
			"user_agent":   s.UserAgent,
			"created_at":   s.CreatedAt,
			"last_used_at": s.LastUsedAt,
			"expires_at":   s.ExpiresAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"sessions": response})
}

// RevokeSession godoc
// @Summary      Revoke specific session
// @Description  Revoke a specific active session by its ID. The session must belong to the authenticated user.
// @Tags         Auth
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      int  true  "Session ID"
// @Success      200  {object}  handlers.SwaggerMessageResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /auth/sessions/{id} [delete]
// DELETE /api/auth/sessions/:id
func (h *AuthHandler) RevokeSession(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	sessionID := c.Param("id")
	sessionIDInt, err := strconv.Atoi(sessionID)
	if err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("ID session tidak valid"))
		return
	}

	// Verify session belongs to user using Ent
	_, err = database.GetEntClient().Session.Query().
		Where(session.IDEQ(sessionIDInt), session.UserIDEQ(int(user.ID))).
		Only(c.Request.Context())
	if err != nil {
		handleError(c, apperrors.ErrSessionInvalid)
		return
	}

	if err := h.sessionService.RevokeSession(c.Request.Context(), sessionIDInt, "User revoked session"); err != nil {
		handleError(c, apperrors.ErrInternalServer)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Session berhasil dicabut"})
}

// LoginTOTP godoc
// @Summary      Complete login with TOTP code
// @Description  Verify a TOTP code to complete two-factor authentication during login. Requires the totp_pending token from the initial login response.
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      handlers.SwaggerLoginTOTPRequest  true  "TOTP verification"
// @Success      200   {object}  handlers.SwaggerLoginResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      429   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/login/totp [post]
// POST /api/auth/login/totp
func (h *AuthHandler) LoginTOTP(c *gin.Context) {
	if !h.loginLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req struct {
		TOTPPending       string `json:"totp_pending" binding:"required"`
		Code              string `json:"code" binding:"required"`
		DeviceFingerprint string `json:"device_fingerprint"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid TOTP login request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	response, err := h.authService.CompleteTOTPLogin(c.Request.Context(), req.TOTPPending, req.Code, c.ClientIP(), c.GetHeader("User-Agent"), req.DeviceFingerprint)
	if err != nil {
		handleError(c, err)
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"token_type":    "Bearer",
		"user": gin.H{
			"email":     response.Email,
			"username":  response.Username,
			"full_name": response.FullName,
		},
	})
}

// LoginBackupCode godoc
// @Summary      Complete login with backup code
// @Description  Use a backup code to complete two-factor authentication during login. Requires the totp_pending token from the initial login response.
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        body  body      handlers.SwaggerLoginBackupCodeRequest  true  "Backup code verification"
// @Success      200   {object}  handlers.SwaggerLoginResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      429   {object}  handlers.SwaggerErrorResponse
// @Router       /auth/login/backup-code [post]
// POST /api/auth/login/backup-code
func (h *AuthHandler) LoginBackupCode(c *gin.Context) {
	if !h.loginLimiter.Allow(c.ClientIP()) {
		handleError(c, apperrors.ErrTooManyRequests)
		return
	}

	var req struct {
		TOTPPending       string `json:"totp_pending" binding:"required"`
		Code              string `json:"code" binding:"required"`
		DeviceFingerprint string `json:"device_fingerprint"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid backup code login request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	response, err := h.authService.CompleteTOTPLoginWithBackupCode(c.Request.Context(), req.TOTPPending, req.Code, c.ClientIP(), c.GetHeader("User-Agent"), req.DeviceFingerprint)
	if err != nil {
		handleError(c, err)
		return
	}

	if response.RefreshToken != "" {
		setRefreshTokenCookie(c, response.RefreshToken)
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"token_type":    "Bearer",
		"user": gin.H{
			"email":     response.Email,
			"username":  response.Username,
			"full_name": response.FullName,
		},
	})
}
