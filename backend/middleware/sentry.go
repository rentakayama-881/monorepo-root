package middleware

import (
	"fmt"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

// SentryMiddleware initialises the Sentry hub on each request and recovers
// panics.  Repanic is true so that Gin's own recovery middleware still fires
// and the response is consistent with the rest of the app.
func SentryMiddleware() gin.HandlerFunc {
	return sentrygin.New(sentrygin.Options{
		Repanic: true,
	})
}

// SentryUserEnrich enriches the Sentry scope with user information that is
// set by AuthMiddleware or AdminAuthMiddleware further down the handler chain.
//
// It calls c.Next() first so that downstream middleware (including auth) has a
// chance to populate gin.Context before we read from it.  The sentrygin
// middleware defers its panic‐capture, so the enriched scope is available when
// the event is finally sent.
func SentryUserEnrich() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		hub := sentrygin.GetHubFromContext(c)
		if hub == nil {
			return
		}

		user := sentry.User{
			IPAddress: c.ClientIP(),
		}

		// Regular user auth (set by AuthMiddleware).
		if val, exists := c.Get("user_id"); exists {
			if id, ok := val.(uint); ok {
				user.ID = fmt.Sprintf("%d", id)
			}
		}
		if val, exists := c.Get("claims"); exists {
			if claims, ok := val.(*Claims); ok {
				user.Email = claims.Email
				user.Username = claims.Username
			}
		}

		// Admin auth fallback (set by AdminAuthMiddleware).
		if user.ID == "" {
			if val, exists := c.Get("admin_id"); exists {
				if id, ok := val.(uint); ok {
					user.ID = fmt.Sprintf("admin:%d", id)
				}
			}
			if val, exists := c.Get("admin_email"); exists {
				if s, ok := val.(string); ok {
					user.Email = s
				}
			}
			if val, exists := c.Get("admin_name"); exists {
				if s, ok := val.(string); ok {
					user.Username = s
				}
			}
		}

		if user.ID != "" {
			hub.Scope().SetUser(user)
		}

		// Propagate reverse‑proxy request ID if present.
		if reqID := c.GetHeader("X-Request-ID"); reqID != "" {
			hub.Scope().SetTag("request_id", reqID)
		}
	}
}
