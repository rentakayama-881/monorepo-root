package middleware

import (
	"net/http"

	apperrors "backend-gin/errors"

	"github.com/gin-gonic/gin"
)

// SudoValidator is an interface for validating sudo tokens
// This avoids circular imports between middleware and services
type SudoValidator interface {
	ValidateToken(userID uint, token string) (bool, error)
}

// RequireSudo is a middleware that requires a valid sudo token for critical actions
// The sudo token should be passed in the X-Sudo-Token header
func RequireSudo(validator SudoValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		if userID == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
			return
		}

		sudoToken := c.GetHeader("X-Sudo-Token")
		if sudoToken == "" {
			response := apperrors.ErrorResponse(apperrors.NewAppError("SUDO_TOKEN_REQUIRED", "Sudo mode diperlukan untuk aksi ini", http.StatusForbidden))
			response["require_sudo"] = true
			c.AbortWithStatusJSON(http.StatusForbidden, response)
			return
		}

		valid, err := validator.ValidateToken(userID, sudoToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer.WithDetails("Gagal memvalidasi sesi sudo")))
			return
		}

		if !valid {
			response := apperrors.ErrorResponse(apperrors.NewAppError("SUDO_SESSION_INVALID", "Sesi sudo tidak valid atau sudah kadaluarsa", http.StatusForbidden))
			response["require_sudo"] = true
			c.AbortWithStatusJSON(http.StatusForbidden, response)
			return
		}

		// Store sudo token in context for potential use
		c.Set("sudo_token", sudoToken)
		c.Next()
	}
}

// OptionalSudo is a middleware that checks for sudo token but doesn't require it
// Use this when an action is enhanced by sudo but not strictly required
func OptionalSudo(validator SudoValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		if userID == 0 {
			c.Next()
			return
		}

		sudoToken := c.GetHeader("X-Sudo-Token")
		if sudoToken != "" {
			valid, _ := validator.ValidateToken(userID, sudoToken)
			c.Set("sudo_active", valid)
			if valid {
				c.Set("sudo_token", sudoToken)
			}
		} else {
			c.Set("sudo_active", false)
		}

		c.Next()
	}
}
