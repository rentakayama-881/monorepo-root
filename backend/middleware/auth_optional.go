package middleware

import (
	"strings"

	"backend-gin/database"
	"backend-gin/ent/user"

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
				client := database.GetEntClient()
				u, err2 := client.User.Query().Where(user.EmailEQ(claims.Email)).Only(c.Request.Context())
				if err2 == nil && u != nil {
					// Use ent.User directly instead of mapping to models.User
					c.Set("user", u)
					c.Set("user_id", uint(u.ID))
					c.Set("ent_user", u)
				}
			}
		}
		c.Next()
	}
}
