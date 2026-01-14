package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	apperrors "backend-gin/errors"

	"github.com/gin-gonic/gin"
)

// RateLimitConfig holds configuration for rate limiting
type RateLimitConfig struct {
	// General API limits
	RequestsPerMinute int
	RequestsPerHour   int

	// Authentication limits (stricter)
	AuthRequestsPerMinute int
	AuthRequestsPerHour   int

	// Search/expensive operation limits
	SearchRequestsPerMinute int

	// Enable IP-based rate limiting
	EnableIPLimit bool

	// Enable user-based rate limiting
	EnableUserLimit bool

	// Whitelist IPs (e.g., monitoring services)
	WhitelistIPs []string

	// Blacklist IPs
	BlacklistIPs []string
}

// DefaultRateLimitConfig returns sensible defaults
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerMinute:       60,
		RequestsPerHour:         1000,
		AuthRequestsPerMinute:   10,
		AuthRequestsPerHour:     100,
		SearchRequestsPerMinute: 20,
		EnableIPLimit:           true,
		EnableUserLimit:         true,
		WhitelistIPs:            []string{},
		BlacklistIPs:            []string{},
	}
}

// EnhancedRateLimiter provides advanced rate limiting
type EnhancedRateLimiter struct {
	config            RateLimitConfig
	ipMinuteLimiter   *RateLimiter
	ipHourLimiter     *RateLimiter
	userMinuteLimiter *RateLimiter
	userHourLimiter   *RateLimiter
	authMinuteLimiter *RateLimiter
	authHourLimiter   *RateLimiter
	searchLimiter     *RateLimiter
	mu                sync.RWMutex
	blacklist         map[string]time.Time // IP -> block expiry
}

// NewEnhancedRateLimiter creates a new enhanced rate limiter
func NewEnhancedRateLimiter(config RateLimitConfig) *EnhancedRateLimiter {
	return &EnhancedRateLimiter{
		config:            config,
		ipMinuteLimiter:   NewRateLimiter(config.RequestsPerMinute, time.Minute),
		ipHourLimiter:     NewRateLimiter(config.RequestsPerHour, time.Hour),
		userMinuteLimiter: NewRateLimiter(config.RequestsPerMinute*2, time.Minute), // Users get higher limit
		userHourLimiter:   NewRateLimiter(config.RequestsPerHour*2, time.Hour),
		authMinuteLimiter: NewRateLimiter(config.AuthRequestsPerMinute, time.Minute),
		authHourLimiter:   NewRateLimiter(config.AuthRequestsPerHour, time.Hour),
		searchLimiter:     NewRateLimiter(config.SearchRequestsPerMinute, time.Minute),
		blacklist:         make(map[string]time.Time),
	}
}

// GetClientIP extracts the real client IP from request
func GetClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header first (for proxies/load balancers)
	xff := c.GetHeader("X-Forwarded-For")
	if xff != "" {
		// Take the first IP in the chain (original client)
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}

	// Check X-Real-IP header
	xri := c.GetHeader("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fallback to remote address
	return c.ClientIP()
}

// IsWhitelisted checks if IP is whitelisted
func (r *EnhancedRateLimiter) IsWhitelisted(ip string) bool {
	for _, whiteIP := range r.config.WhitelistIPs {
		if ip == whiteIP {
			return true
		}
	}
	return false
}

// IsBlacklisted checks if IP is blacklisted
func (r *EnhancedRateLimiter) IsBlacklisted(ip string) bool {
	// Check static blacklist
	for _, blackIP := range r.config.BlacklistIPs {
		if ip == blackIP {
			return true
		}
	}

	// Check dynamic blacklist
	r.mu.RLock()
	expiry, exists := r.blacklist[ip]
	r.mu.RUnlock()

	if exists {
		if time.Now().Before(expiry) {
			return true
		}
		// Remove expired entry
		r.mu.Lock()
		delete(r.blacklist, ip)
		r.mu.Unlock()
	}

	return false
}

// BlockIP temporarily blocks an IP
func (r *EnhancedRateLimiter) BlockIP(ip string, duration time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.blacklist[ip] = time.Now().Add(duration)
}

// Middleware returns a Gin middleware for rate limiting
func (r *EnhancedRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := GetClientIP(c)

		// Check whitelist first
		if r.IsWhitelisted(ip) {
			c.Next()
			return
		}

		// Check blacklist
		if r.IsBlacklisted(ip) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"code":    "IP_BLOCKED",
				"message": "IP address telah diblokir sementara",
			})
			c.Abort()
			return
		}

		// IP-based rate limiting
		if r.config.EnableIPLimit {
			if !r.ipMinuteLimiter.Allow(ip) || !r.ipHourLimiter.Allow(ip) {
				c.Header("Retry-After", "60")
				c.JSON(http.StatusTooManyRequests, gin.H{
					"success": false,
					"code":    apperrors.ErrRateLimitExceeded.Code,
					"message": "Terlalu banyak permintaan. Silakan coba lagi nanti.",
				})
				c.Abort()
				return
			}
		}

		// User-based rate limiting (if authenticated)
		if r.config.EnableUserLimit {
			if userID, exists := c.Get("userID"); exists {
				userKey := "user:" + userID.(string)
				if !r.userMinuteLimiter.Allow(userKey) || !r.userHourLimiter.Allow(userKey) {
					c.Header("Retry-After", "60")
					c.JSON(http.StatusTooManyRequests, gin.H{
						"success": false,
						"code":    apperrors.ErrRateLimitExceeded.Code,
						"message": "Terlalu banyak permintaan. Silakan coba lagi nanti.",
					})
					c.Abort()
					return
				}
			}
		}

		c.Next()
	}
}

// AuthMiddleware returns a stricter rate limiter for auth endpoints
func (r *EnhancedRateLimiter) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := GetClientIP(c)

		// Check whitelist first
		if r.IsWhitelisted(ip) {
			c.Next()
			return
		}

		// Check blacklist
		if r.IsBlacklisted(ip) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"code":    "IP_BLOCKED",
				"message": "IP address telah diblokir sementara",
			})
			c.Abort()
			return
		}

		// Auth-specific rate limiting
		if !r.authMinuteLimiter.Allow(ip) || !r.authHourLimiter.Allow(ip) {
			// Too many auth attempts - block IP temporarily
			r.BlockIP(ip, 15*time.Minute)

			c.Header("Retry-After", "900") // 15 minutes
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"code":    apperrors.ErrRateLimitExceeded.Code,
				"message": "Terlalu banyak percobaan login. IP diblokir 15 menit.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// SearchMiddleware returns rate limiter for search/expensive operations
func (r *EnhancedRateLimiter) SearchMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := GetClientIP(c)

		// Check whitelist first
		if r.IsWhitelisted(ip) {
			c.Next()
			return
		}

		// Search-specific rate limiting
		if !r.searchLimiter.Allow(ip) {
			c.Header("Retry-After", "60")
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"code":    apperrors.ErrRateLimitExceeded.Code,
				"message": "Terlalu banyak pencarian. Silakan tunggu sebentar.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// Global enhanced rate limiter instance
var enhancedRateLimiter *EnhancedRateLimiter
var rateLimiterOnce sync.Once

// GetEnhancedRateLimiter returns the global enhanced rate limiter
func GetEnhancedRateLimiter() *EnhancedRateLimiter {
	rateLimiterOnce.Do(func() {
		enhancedRateLimiter = NewEnhancedRateLimiter(DefaultRateLimitConfig())
	})
	return enhancedRateLimiter
}

// SetEnhancedRateLimiter sets the global enhanced rate limiter (for testing)
func SetEnhancedRateLimiter(r *EnhancedRateLimiter) {
	enhancedRateLimiter = r
}
