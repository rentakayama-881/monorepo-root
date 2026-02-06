package middleware

import (
	"net/http"
	"os"
	"time"

	"backend-gin/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// getAdminJWTKey returns the admin JWT secret from environment
// ADMIN_JWT_SECRET must be set - validated at startup in main.go
func getAdminJWTKey() []byte {
	secret := os.Getenv("ADMIN_JWT_SECRET")
	if secret == "" {
		// This should never happen - startup validation should catch this
		panic("CRITICAL: ADMIN_JWT_SECRET environment variable is not set")
	}
	return []byte(secret)
}

// AdminAuthMiddleware validates admin JWT tokens
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "ADMIN001",
				"message": "Token admin diperlukan",
			})
			return
		}

		tokenString, ok := parseBearerToken(authHeader)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "ADMIN002",
				"message": "Format token tidak valid",
			})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return getAdminJWTKey(), nil
		},
			jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
			jwt.WithIssuer(config.JWTIssuer),
			jwt.WithAudience(config.JWTAudience),
			jwt.WithIssuedAt(),
			jwt.WithExpirationRequired(),
			jwt.WithLeeway(time.Minute),
		)

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "ADMIN003",
				"message": "Token admin tidak valid atau sudah kadaluarsa",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "ADMIN004",
				"message": "Token claims tidak valid",
			})
			return
		}

		// Check if it's an admin token
		tokenType, _ := claims["type"].(string)
		if tokenType != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    "ADMIN005",
				"message": "Akses ditolak. Bukan token admin.",
			})
			return
		}

		// Set admin info in context
		adminID, _ := claims["admin_id"].(float64)
		adminEmail, _ := claims["email"].(string)
		adminName, _ := claims["name"].(string)

		c.Set("admin_id", uint(adminID))
		c.Set("admin_email", adminEmail)
		c.Set("admin_name", adminName)

		c.Next()
	}
}
