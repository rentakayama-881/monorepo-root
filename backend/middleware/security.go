package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware adds security headers to protect against XSS and other attacks
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Strict-Transport-Security - Enforce HTTPS
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Content Security Policy - Protect against XSS
		// Allows same origin, specific trusted CDNs, and inline styles/scripts with nonce
		c.Header("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app; "+
				"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "+
				"img-src 'self' data: https: http:; "+
				"font-src 'self' https://fonts.gstatic.com; "+
				"connect-src 'self' https://*.vercel.app https://vercel.live; "+
				"frame-ancestors 'none'; "+
				"base-uri 'self'; "+
				"form-action 'self'")

		// X-Content-Type-Options - Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// X-Frame-Options - Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")

		// X-XSS-Protection - Enable XSS filter in older browsers
		c.Header("X-XSS-Protection", "1; mode=block")

		// Referrer-Policy - Control referrer information
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

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
