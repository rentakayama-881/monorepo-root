package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequestSizeLimits defines maximum sizes for different content types
type RequestSizeLimits struct {
	// Default max body size (1MB)
	DefaultMaxSize int64

	// Max size for JSON requests (5MB)
	JSONMaxSize int64

	// Max size for file uploads (50MB)
	FileUploadMaxSize int64

	// Max size for avatar uploads (2MB)
	AvatarMaxSize int64
}

// DefaultRequestSizeLimits returns sensible defaults
func DefaultRequestSizeLimits() RequestSizeLimits {
	return RequestSizeLimits{
		DefaultMaxSize:    1 * 1024 * 1024,  // 1MB
		JSONMaxSize:       5 * 1024 * 1024,  // 5MB
		FileUploadMaxSize: 50 * 1024 * 1024, // 50MB
		AvatarMaxSize:     2 * 1024 * 1024,  // 2MB
	}
}

// RequestSizeLimitMiddleware limits the maximum request body size
func RequestSizeLimitMiddleware(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)
		c.Next()
	}
}

// DefaultRequestSizeLimitMiddleware uses default size limit (1MB)
func DefaultRequestSizeLimitMiddleware() gin.HandlerFunc {
	limits := DefaultRequestSizeLimits()
	return RequestSizeLimitMiddleware(limits.DefaultMaxSize)
}

// JSONRequestSizeLimitMiddleware for JSON API endpoints (5MB)
func JSONRequestSizeLimitMiddleware() gin.HandlerFunc {
	limits := DefaultRequestSizeLimits()
	return RequestSizeLimitMiddleware(limits.JSONMaxSize)
}

// FileUploadSizeLimitMiddleware for file upload endpoints (50MB)
func FileUploadSizeLimitMiddleware() gin.HandlerFunc {
	limits := DefaultRequestSizeLimits()
	return RequestSizeLimitMiddleware(limits.FileUploadMaxSize)
}

// AvatarUploadSizeLimitMiddleware for avatar uploads (2MB)
func AvatarUploadSizeLimitMiddleware() gin.HandlerFunc {
	limits := DefaultRequestSizeLimits()
	return RequestSizeLimitMiddleware(limits.AvatarMaxSize)
}
