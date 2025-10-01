package middleware

import (
	"strings"

	"backend-gin/database"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

// AuthOptionalMiddleware allows requests without a token but, if a valid token is present,
// it injects the user into context. Handlers can then decide to allow/deny interaction.
func AuthOptionalMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := ParseJWT(tokenString)
			if err == nil {
				var user models.User
				if err := database.DB.Where("email = ?", claims.Email).First(&user).Error; err == nil {
					c.Set("user", &user)
				}
			}
		}
		c.Next()
	}
}
