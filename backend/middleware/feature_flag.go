package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
)

// FeatureFlagChecker is the interface needed by RequireFeature middleware.
// This avoids a circular import between middleware and services.
type FeatureFlagChecker interface {
	IsEnabled(ctx context.Context, key string, userID uint) bool
}

// RequireFeature returns middleware that blocks requests if the given feature flag
// is disabled for the current user. Returns 404 to avoid leaking feature existence.
func RequireFeature(flagChecker FeatureFlagChecker, key string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		if !flagChecker.IsEnabled(c.Request.Context(), key, userID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Feature not available"})
			c.Abort()
			return
		}
		c.Next()
	}
}
