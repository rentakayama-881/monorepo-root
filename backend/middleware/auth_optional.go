package middleware

import (
	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/user"

	"github.com/gin-gonic/gin"
)

// AuthOptionalMiddleware allows requests without a token but, if a valid token is present,
// it injects the user into context. Handlers can then decide to allow/deny interaction.
func AuthOptionalMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, ok := parseBearerToken(c.GetHeader("Authorization"))
		if ok {
			claims, err := ParseJWT(tokenString)
			if err == nil {
				// Optional auth should only trust access tokens (or legacy tokens without explicit type).
				if claims.TokenType != "" && claims.TokenType != TokenTypeAccess {
					c.Next()
					return
				}

				client := database.GetEntClient()
				var (
					u    *ent.User
					err2 error
				)

				if claims.UserID > 0 {
					u, err2 = client.User.Get(c.Request.Context(), int(claims.UserID))
				} else if claims.Email != "" {
					u, err2 = client.User.Query().Where(user.EmailEQ(claims.Email)).Only(c.Request.Context())
				}

				if err2 == nil && u != nil {
					c.Set("user", u)
					c.Set("user_id", uint(u.ID))
					c.Set("ent_user", u)
					c.Set("claims", claims)
				}
			}
		}
		c.Next()
	}
}
