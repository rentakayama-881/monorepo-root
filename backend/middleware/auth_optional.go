package middleware

import (
	"strings"

	"backend-gin/database"
	"backend-gin/ent/user"
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
				client := database.GetEntClient()
				u, err2 := client.User.Query().Where(user.EmailEQ(claims.Email)).Only(c.Request.Context())
				if err2 == nil && u != nil {
					mapped := &models.User{Email: u.Email}
					mapped.ID = uint(u.ID)
					if u.Username != nil {
						name := *u.Username
						mapped.Username = &name
					}
					mapped.AvatarURL = u.AvatarURL
					c.Set("user", mapped)
					c.Set("ent_user", u)
				}
			}
		}
		c.Next()
	}
}
