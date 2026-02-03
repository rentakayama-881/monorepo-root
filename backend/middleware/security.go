package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware adds security headers to protect against XSS and other attacks
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Strict-Transport-Security - Enforce HTTPS
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Content-Security-Policy:
		// This service is a JSON API. Use a strict CSP to reduce browser attack surface.
		c.Header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")

		// X-Content-Type-Options - Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// X-Frame-Options - Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")

		// X-XSS-Protection - Enable XSS filter in older browsers
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer-Policy - Control referrer information
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Prevent Adobe Flash / Acrobat from loading cross-domain content.
		c.Header("X-Permitted-Cross-Domain-Policies", "none")

		// Permissions-Policy - Control browser features
		c.Header("Permissions-Policy",
			"geolocation=(), "+
				"microphone=(), "+
				"camera=(), "+
				"payment=(), "+
				"usb=(), "+
				"magnetometer=(), "+
				"gyroscope=(), "+
				"accelerometer=()")

		c.Next()
	}
}
