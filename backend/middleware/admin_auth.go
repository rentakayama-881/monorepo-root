package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var adminJWTKey []byte

func init() {
	secret := os.Getenv("ADMIN_JWT_SECRET")
	if secret == "" {
		// Will be set later when config loads
		secret = "admin-secret-change-me"
	}
	adminJWTKey = []byte(secret)
}

// SetAdminJWTKey sets the admin JWT secret (called from config)
func SetAdminJWTKey(key string) {
	adminJWTKey = []byte(key)
}

// AdminAuthMiddleware validates admin JWT tokens
func AdminAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "ADMIN001",
					"message": "Token admin diperlukan",
				},
			})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "ADMIN002",
					"message": "Format token tidak valid",
				},
			})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return adminJWTKey, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "ADMIN003",
					"message": "Token admin tidak valid atau sudah kadaluarsa",
				},
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{
					"code":    "ADMIN004",
					"message": "Token claims tidak valid",
				},
			})
			return
		}

		// Check if it's an admin token
		tokenType, _ := claims["type"].(string)
		if tokenType != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "ADMIN005",
					"message": "Akses ditolak. Bukan token admin.",
				},
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
