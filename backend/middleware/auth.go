package middleware

import (
	"net/http"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates JWT token and checks session validity
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Ambil token dari header Authorization
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parsing dan validasi JWT
		claims, err := ParseJWT(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
			return
		}

		// Validate token type - must be access token
		if claims.TokenType != "" && claims.TokenType != TokenTypeAccess {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token type tidak valid"})
			return
		}

		// Get user from DB
		var user models.User
		var err2 error

		// Try to find by UserID first (new tokens), fallback to email (legacy tokens)
		if claims.UserID > 0 {
			err2 = database.DB.First(&user, claims.UserID).Error
		} else if claims.Email != "" {
			err2 = database.DB.Where("email = ?", claims.Email).First(&user).Error
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
			return
		}

		if err2 != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
			return
		}

		// Check if account is locked
		var lock models.SessionLock
		if err := database.DB.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
			if lock.IsLocked() {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error":      "Akun terkunci karena aktivitas mencurigakan. Hubungi admin untuk membuka.",
					"locked_at":  lock.LockedAt,
					"expires_at": lock.ExpiresAt,
					"reason":     lock.Reason,
				})
				return
			}
		}

		// If JTI exists, validate session in database (new auth flow)
		if claims.JTI != "" {
			var session models.Session
			if err := database.DB.Where("access_token_jti = ? AND user_id = ?", claims.JTI, user.ID).First(&session).Error; err == nil {
				// Session found - validate it
				if !session.IsValid() {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Session tidak valid"})
					return
				}

				// Session fingerprinting - strict mode
				clientIP := c.ClientIP()
				clientUA := c.GetHeader("User-Agent")

				if session.IPAddress != "" && session.IPAddress != clientIP {
					// IP changed - revoke session and lock account
					now := time.Now()
					session.RevokedAt = &now
					session.RevokeReason = "IP address changed"
					database.DB.Save(&session)

					// Lock account for 7 days
					lockAccount(user.ID, "Perubahan IP address terdeteksi - kemungkinan session hijacking")

					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
						"error": "Session dicabut karena perubahan IP address. Akun dikunci 7 hari.",
					})
					return
				}

				if session.UserAgent != "" && session.UserAgent != clientUA {
					// User-Agent changed - revoke session and lock account
					now := time.Now()
					session.RevokedAt = &now
					session.RevokeReason = "User-Agent changed"
					database.DB.Save(&session)

					// Lock account for 7 days
					lockAccount(user.ID, "Perubahan User-Agent terdeteksi - kemungkinan session hijacking")

					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
						"error": "Session dicabut karena perubahan browser/device. Akun dikunci 7 hari.",
					})
					return
				}

				// Update last used time
				session.LastUsedAt = time.Now()
				database.DB.Save(&session)
			}
			// If session not found but token is valid, allow (backward compatibility)
		}

		// Set user ke context
		c.Set("user", &user)
		c.Set("user_id", user.ID)
		c.Set("claims", claims)
		c.Next()
	}
}

// lockAccount creates a 7-day lock on the account
func lockAccount(userID uint, reason string) {
	lock := models.SessionLock{
		UserID:    userID,
		LockedAt:  time.Now(),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		Reason:    reason,
		LockedBy:  "system",
	}
	database.DB.Create(&lock)

	// Revoke all sessions for this user
	database.DB.Model(&models.Session{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Updates(map[string]interface{}{
			"revoked_at":    time.Now(),
			"revoke_reason": "Account locked: " + reason,
		})
}

