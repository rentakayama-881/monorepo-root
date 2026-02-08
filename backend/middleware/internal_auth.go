package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const internalAPIKeyHeader = "X-Internal-Api-Key"

// InternalServiceAuth protects internal service-to-service endpoints.
//
// Configure expected key via env var: INTERNAL_API_KEY
func InternalServiceAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		expected := strings.TrimSpace(os.Getenv("INTERNAL_API_KEY"))
		if expected == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "internal api key not configured",
			})
			return
		}

		provided := strings.TrimSpace(c.GetHeader(internalAPIKeyHeader))
		if provided == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "unauthorized",
			})
			return
		}

		c.Next()
	}
}
