package middleware

import (
	"net/http"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/session"
	"backend-gin/ent/sessionlock"
	"backend-gin/ent/user"
	"backend-gin/logger"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
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

		// Get user via Ent
		client := database.GetEntClient()
		var entUser *ent.User
		var err2 error

		if claims.UserID > 0 {
			entUser, err2 = client.User.Get(c.Request.Context(), int(claims.UserID))
		} else if claims.Email != "" {
			entUser, err2 = client.User.Query().Where(user.EmailEQ(claims.Email)).Only(c.Request.Context())
		} else {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
			return
		}
		if err2 != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User tidak ditemukan"})
			return
		}
		// Map ent.User to models.User for existing handlers
		mappedUser := &models.User{
			Model:         models.User{}.Model,
			Email:         entUser.Email,
			Username:      nil,
			PasswordHash:  entUser.PasswordHash,
			EmailVerified: entUser.EmailVerified,
			AvatarURL:     entUser.AvatarURL,
			FullName:      nil,
			Bio:           entUser.Bio,
			Pronouns:      entUser.Pronouns,
			Company:       entUser.Company,
			Telegram:      entUser.Telegram,
			PrimaryBadgeID: func() *uint {
				if entUser.PrimaryBadgeID != nil {
					v := uint(*entUser.PrimaryBadgeID)
					return &v
				}
				return nil
			}(),
		}
		// Optional pointer fields
		if entUser.Username != nil {
			uname := *entUser.Username
			mappedUser.Username = &uname
		}
		if entUser.FullName != nil {
			fn := *entUser.FullName
			mappedUser.FullName = &fn
		}
		// Assign ID
		mappedUser.ID = uint(entUser.ID)

		// Check if account is locked via SessionLock
		if lock, err := client.SessionLock.Query().Where(sessionlock.UserIDEQ(entUser.ID)).Order(ent.Desc(sessionlock.FieldCreatedAt)).First(c.Request.Context()); err == nil && lock != nil {
			// Consider locked if unlocked_at is nil and expires_at in future
			if lock.UnlockedAt == nil && lock.ExpiresAt.After(time.Now()) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"error":      "Akun terkunci karena aktivitas mencurigakan. Hubungi admin untuk membuka.",
					"code":       "account_locked",
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
			if err == nil && sess != nil {
				// Validate not revoked and not expired
				if sess.RevokedAt != nil || sess.ExpiresAt.Before(time.Now()) {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Session tidak valid"})
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
				_, _ = updates.Save(c.Request.Context())
			}
		}

		// Set user ke context
		c.Set("user", mappedUser)
		c.Set("user_id", mappedUser.ID)
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
