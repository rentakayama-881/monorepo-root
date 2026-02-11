package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"backend-gin/logger"
)

const (
	// RequestIDHeader is the header name for request correlation IDs
	RequestIDHeader = "X-Request-ID"
	// RequestIDKey is the context key for storing the request ID
	RequestIDKey = "request_id"
)

// CorrelationID middleware generates or propagates a unique request ID for every request.
// If the incoming request already has an X-Request-ID header, it is reused.
// The ID is set on the response header, stored in gin context, and added to the Zap logger context.
func CorrelationID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(RequestIDHeader)
		if requestID == "" {
			requestID = uuid.New().String()
		}

		// Store in context for downstream use
		c.Set(RequestIDKey, requestID)

		// Set on response header
		c.Header(RequestIDHeader, requestID)

		// Log with request ID context
		logger.Info("request started",
			zap.String("request_id", requestID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
		)

		c.Next()

		// Log completion
		logger.Info("request completed",
			zap.String("request_id", requestID),
			zap.Int("status", c.Writer.Status()),
		)
	}
}

// GetRequestID retrieves the request ID from the gin context
func GetRequestID(c *gin.Context) string {
	if id, exists := c.Get(RequestIDKey); exists {
		if s, ok := id.(string); ok {
			return s
		}
	}
	return ""
}
