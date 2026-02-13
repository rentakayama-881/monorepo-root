package middleware

import (
	"context"
	"errors"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/session"
	"backend-gin/ent/sessionlock"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AuthMiddleware validates JWT token and checks session validity
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Ambil token dari header Authorization
		authHeader := c.GetHeader("Authorization")
		tokenString, ok := parseBearerToken(authHeader)
		if !ok {
			abortWithAppError(c, apperrors.ErrInvalidToken.WithDetails("Token diperlukan"), nil)
			return
		}

		// Parsing dan validasi JWT
		claims, err := ParseJWT(tokenString)
		if err != nil {
			abortWithAppError(c, apperrors.ErrInvalidToken.WithDetails("Token tidak valid"), nil)
			return
		}

		// Validate token type - must be access token
		if claims.TokenType != "" && claims.TokenType != TokenTypeAccess {
			abortWithAppError(c, apperrors.ErrInvalidToken.WithDetails("Token type tidak valid"), nil)
			return
		}

		// Get user via Ent
		client := database.GetEntClient()
		var entUser *ent.User
		var err2 error

		if claims.UserID > 0 {
			entUser, err2 = client.User.Get(c.Request.Context(), int(claims.UserID))
		} else if claims.Email != "" {
			entUser, err2 = client.User.Query().Where(user.EmailEQ(claims.Email)).Only(c.Request.Context())
		} else {
			abortWithAppError(c, apperrors.ErrInvalidToken.WithDetails("Token tidak valid"), nil)
			return
		}
		if err2 != nil {
			abortWithAppError(c, apperrors.ErrInvalidToken.WithDetails("User tidak ditemukan"), nil)
			return
		}

		// Check if account is locked via SessionLock
		lock, lockErr := client.SessionLock.Query().
			Where(sessionlock.UserIDEQ(entUser.ID)).
			Order(ent.Desc(sessionlock.FieldCreatedAt)).
			First(c.Request.Context())
		if lockErr != nil && !ent.IsNotFound(lockErr) {
			if isRequestContextError(lockErr) {
				logger.Warn("Account lock validation canceled by request context",
					zap.Uint("user_id", uint(entUser.ID)),
					zap.Error(lockErr),
				)
				abortWithAppError(c, apperrors.ErrSessionInvalid, nil)
				return
			}

			logger.Error("Failed to validate account lock state",
				zap.Uint("user_id", uint(entUser.ID)),
				zap.Error(lockErr),
			)
			abortWithAppError(c, apperrors.ErrInternalServer.WithDetails("Gagal memvalidasi status akun"), nil)
			return
		}
		if lockErr == nil && lock != nil {
			// Consider locked if unlocked_at is nil and expires_at in future
			if lock.UnlockedAt == nil && lock.ExpiresAt.After(time.Now()) {
				abortWithAppError(c, apperrors.ErrAccountLocked.WithDetails("Akun terkunci karena aktivitas mencurigakan. Hubungi admin untuk membuka."), map[string]interface{}{
					"locked_at":  lock.LockedAt,
					"expires_at": lock.ExpiresAt,
					"reason":     lock.Reason,
				})
				return
			}
		}

		// If JTI exists, validate session in database (new auth flow)
		if claims.JTI != "" {
			sess, err := client.Session.
				Query().
				Where(
					session.AccessTokenJtiEQ(claims.JTI),
					session.UserIDEQ(entUser.ID),
				).
				First(c.Request.Context())
			if err != nil {
				if ent.IsNotFound(err) {
					abortWithAppError(c, apperrors.ErrSessionInvalid, nil)
					return
				}

				if isRequestContextError(err) {
					logger.Warn("Session validation canceled by request context",
						zap.Uint("user_id", uint(entUser.ID)),
						zap.String("jti", claims.JTI),
						zap.Error(err),
					)
					abortWithAppError(c, apperrors.ErrSessionInvalid, nil)
					return
				}

				logger.Error("Failed to validate session by JTI",
					zap.Uint("user_id", uint(entUser.ID)),
					zap.String("jti", claims.JTI),
					zap.Error(err),
				)
				abortWithAppError(c, apperrors.ErrInternalServer.WithDetails("Gagal memvalidasi sesi"), nil)
				return
			}

			// Validate not revoked and not expired
			if sess.RevokedAt != nil || sess.ExpiresAt.Before(time.Now()) {
				abortWithAppError(c, apperrors.ErrSessionInvalid, nil)
				return
			}

			clientIP := c.ClientIP()
			clientUA := c.GetHeader("User-Agent")

			// Update session with drift-aware behavior
			updates := client.Session.UpdateOneID(sess.ID).SetLastUsedAt(time.Now())
			if sess.IPAddress != "" && sess.IPAddress != clientIP {
				logger.Warn("IP address changed during session",
					zap.Uint("user_id", uint(entUser.ID)),
					zap.String("session_ip", sess.IPAddress),
					zap.String("request_ip", clientIP),
				)
				updates = updates.SetIPAddress(clientIP)
			}
			if sess.UserAgent != "" && sess.UserAgent != clientUA {
				logger.Warn("User-Agent changed during session",
					zap.Uint("user_id", uint(entUser.ID)),
				)
				if len(clientUA) > 512 {
					clientUA = clientUA[:512]
				}
				updates = updates.SetUserAgent(clientUA)
			}
			if _, updateErr := updates.Save(c.Request.Context()); updateErr != nil {
				if isRequestContextError(updateErr) {
					logger.Debug("Skipped session activity metadata update due to request context cancellation",
						zap.Uint("user_id", uint(entUser.ID)),
						zap.String("jti", claims.JTI),
						zap.Error(updateErr),
					)
				} else {
					logger.Warn("Failed to update session activity metadata",
						zap.Uint("user_id", uint(entUser.ID)),
						zap.String("jti", claims.JTI),
						zap.Error(updateErr),
					)
				}
			}
		}

		// Set user ke context - now using ent.User directly
		c.Set("user", entUser)
		c.Set("user_id", uint(entUser.ID))
		c.Set("ent_user", entUser)
		c.Set("claims", claims)
		c.Next()
	}
}

// truncateString truncates a string to max length
func truncateString(s string, max int) string {
	if len(s) > max {
		return s[:max]
	}
	return s
}

func isRequestContextError(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

func abortWithAppError(c *gin.Context, appErr *apperrors.AppError, extra map[string]interface{}) {
	response := apperrors.ErrorResponse(appErr)
	for key, value := range extra {
		response[key] = value
	}
	c.AbortWithStatusJSON(appErr.StatusCode, response)
}
