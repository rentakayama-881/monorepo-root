package middleware

import (
	"fmt"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"

	apperrors "backend-gin/errors"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
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
	whitelistExact    map[string]struct{}
	whitelistCIDRs    []netip.Prefix
	blacklistExact    map[string]struct{}
	blacklistCIDRs    []netip.Prefix
	mu                sync.RWMutex
	blacklist         map[string]time.Time // IP -> block expiry
}

// NewEnhancedRateLimiter creates a new enhanced rate limiter
func NewEnhancedRateLimiter(config RateLimitConfig) *EnhancedRateLimiter {
	whitelistExact, whitelistCIDRs := parseIPRules(config.WhitelistIPs)
	blacklistExact, blacklistCIDRs := parseIPRules(config.BlacklistIPs)

	return &EnhancedRateLimiter{
		config:            config,
		ipMinuteLimiter:   NewRateLimiter(config.RequestsPerMinute, time.Minute),
		ipHourLimiter:     NewRateLimiter(config.RequestsPerHour, time.Hour),
		userMinuteLimiter: NewRateLimiter(config.RequestsPerMinute*2, time.Minute), // Users get higher limit
		userHourLimiter:   NewRateLimiter(config.RequestsPerHour*2, time.Hour),
		authMinuteLimiter: NewRateLimiter(config.AuthRequestsPerMinute, time.Minute),
		authHourLimiter:   NewRateLimiter(config.AuthRequestsPerHour, time.Hour),
		searchLimiter:     NewRateLimiter(config.SearchRequestsPerMinute, time.Minute),
		whitelistExact:    whitelistExact,
		whitelistCIDRs:    whitelistCIDRs,
		blacklistExact:    blacklistExact,
		blacklistCIDRs:    blacklistCIDRs,
		blacklist:         make(map[string]time.Time),
	}
}

// SetRedisClient injects a shared Redis client into all internal limiters.
// This avoids package import cycles while preserving distributed rate limiting.
func (r *EnhancedRateLimiter) SetRedisClient(client *redis.Client) {
	if r == nil {
		return
	}
	r.ipMinuteLimiter.SetRedisClient(client)
	r.ipHourLimiter.SetRedisClient(client)
	r.userMinuteLimiter.SetRedisClient(client)
	r.userHourLimiter.SetRedisClient(client)
	r.authMinuteLimiter.SetRedisClient(client)
	r.authHourLimiter.SetRedisClient(client)
	r.searchLimiter.SetRedisClient(client)
}

// GetClientIP returns the client IP resolved by Gin.
// Important: this respects TrustedProxies configuration set in main.go
// and avoids trusting spoofable forwarding headers directly.
func GetClientIP(c *gin.Context) string {
	return c.ClientIP()
}

// IsWhitelisted checks if IP is whitelisted
func (r *EnhancedRateLimiter) IsWhitelisted(ip string) bool {
	normalized, addr, hasAddr := normalizeIP(ip)
	rawKey := strings.TrimSpace(ip)
	if _, ok := r.whitelistExact[normalized]; ok {
		return true
	}
	if _, ok := r.whitelistExact[rawKey]; ok {
		return true
	}
	if hasAddr {
		for _, prefix := range r.whitelistCIDRs {
			if prefix.Contains(addr) {
				return true
			}
		}
	}
	return false
}

// IsBlacklisted checks if IP is blacklisted
func (r *EnhancedRateLimiter) IsBlacklisted(ip string) bool {
	// Check static blacklist
	normalized, addr, hasAddr := normalizeIP(ip)
	rawKey := strings.TrimSpace(ip)
	if _, ok := r.blacklistExact[normalized]; ok {
		return true
	}
	if _, ok := r.blacklistExact[rawKey]; ok {
		return true
	}
	if hasAddr {
		for _, prefix := range r.blacklistCIDRs {
			if prefix.Contains(addr) {
				return true
			}
		}
	}

	// Check dynamic blacklist
	dynamicKey := normalizedIPKey(ip)
	r.mu.RLock()
	expiry, exists := r.blacklist[dynamicKey]
	r.mu.RUnlock()

	if exists {
		if time.Now().Before(expiry) {
			return true
		}
		// Remove expired entry
		r.mu.Lock()
		delete(r.blacklist, dynamicKey)
		r.mu.Unlock()
	}

	return false
}

// BlockIP temporarily blocks an IP
func (r *EnhancedRateLimiter) BlockIP(ip string, duration time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.blacklist[normalizedIPKey(ip)] = time.Now().Add(duration)
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
			userKey := getUserRateLimitKey(c)
			if userKey != "" {
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

func getUserRateLimitKey(c *gin.Context) string {
	if userID, exists := c.Get("user_id"); exists {
		if normalized := normalizeRateLimitIdentity(userID); normalized != "" {
			return "user:" + normalized
		}
	}
	if legacyUserID, exists := c.Get("userID"); exists {
		if normalized := normalizeRateLimitIdentity(legacyUserID); normalized != "" {
			return "user:" + normalized
		}
	}
	return ""
}

func normalizeRateLimitIdentity(value interface{}) string {
	normalized := strings.TrimSpace(fmt.Sprint(value))
	if normalized == "" || normalized == "<nil>" {
		return ""
	}
	return normalized
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

func parseIPRules(entries []string) (map[string]struct{}, []netip.Prefix) {
	exact := make(map[string]struct{}, len(entries))
	cidrs := make([]netip.Prefix, 0)

	for _, entry := range entries {
		clean := strings.TrimSpace(entry)
		if clean == "" {
			continue
		}

		if strings.Contains(clean, "/") {
			if prefix, err := netip.ParsePrefix(clean); err == nil {
				cidrs = append(cidrs, prefix.Masked())
				continue
			}
			// Keep invalid CIDR entries as exact raw rules for backward compatibility.
			exact[clean] = struct{}{}
			continue
		}

		if addr, err := netip.ParseAddr(clean); err == nil {
			exact[addr.String()] = struct{}{}
			continue
		}

		// Keep unknown formats as raw exact entries for backward compatibility.
		exact[clean] = struct{}{}
	}

	return exact, cidrs
}

func normalizeIP(ip string) (string, netip.Addr, bool) {
	clean := strings.TrimSpace(ip)
	addr, err := netip.ParseAddr(clean)
	if err != nil {
		return clean, netip.Addr{}, false
	}
	return addr.String(), addr, true
}

func normalizedIPKey(ip string) string {
	normalized, _, _ := normalizeIP(ip)
	return normalized
}
