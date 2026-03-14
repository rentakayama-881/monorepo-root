package main

import (
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"backend-gin/logger"
	"backend-gin/middleware"

	"go.uber.org/zap"
)

// Delete account rate limiter: 3 attempts per hour
var deleteAccountLimiter = middleware.NewRateLimiter(3, time.Hour)

// DeleteAccountRateLimit is a middleware that rate limits delete account requests
func DeleteAccountRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !deleteAccountLimiter.Allow(ip) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Terlalu banyak percobaan. Silakan coba lagi dalam 1 jam.",
			})
			return
		}
		c.Next()
	}
}

func buildCORSConfig() cors.Config {
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization", "X-Sudo-Token"}
	corsConfig.AllowCredentials = true

	frontend := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
	if frontend == "" {
		frontend = "https://aivalid.id"
	}

	allowedOriginsEnv := os.Getenv("CORS_ALLOWED_ORIGINS")
	var rawOrigins []string
	if allowedOriginsEnv != "" {
		rawOrigins = strings.Split(allowedOriginsEnv, ",")
	} else {
		rawOrigins = []string{frontend}
	}

	allowedSet := map[string]struct{}{}
	allowedList := []string{}
	for _, origin := range rawOrigins {
		clean := strings.TrimSpace(origin)
		if clean == "" {
			continue
		}
		if _, exists := allowedSet[clean]; exists {
			continue
		}
		allowedSet[clean] = struct{}{}
		allowedList = append(allowedList, clean)
	}

	corsConfig.AllowOrigins = allowedList
	corsConfig.AllowOriginFunc = func(origin string) bool {
		if origin == "" {
			return false
		}
		_, ok := allowedSet[origin]
		return ok
	}

	return corsConfig
}

func expandWWWOrigins(origin string) []string {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return []string{origin}
	}

	host := parsed.Hostname()
	port := parsed.Port()
	if host == "" {
		return []string{origin}
	}

	variants := []string{origin}
	addVariant := func(h string) {
		u := *parsed
		if port != "" {
			u.Host = h + ":" + port
		} else {
			u.Host = h
		}
		variants = append(variants, u.String())
	}

	if strings.HasPrefix(host, "www.") {
		bare := strings.TrimPrefix(host, "www.")
		if bare != "" {
			addVariant(bare)
		}
	} else if len(strings.Split(host, ".")) == 2 {
		addVariant("www." + host)
	}

	return variants
}

func deriveRPOrigins() []string {
	var rawOrigins []string
	originsEnv := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ORIGINS"))
	if originsEnv != "" {
		rawOrigins = strings.Split(originsEnv, ",")
	} else {
		rpOrigin := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ORIGIN"))
		if rpOrigin == "" {
			rpOrigin = strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
			if rpOrigin == "" {
				rpOrigin = "http://localhost:3000"
			}
		}
		rawOrigins = []string{rpOrigin}
	}

	originSet := map[string]struct{}{}
	origins := []string{}
	for _, origin := range rawOrigins {
		clean := strings.TrimSpace(origin)
		if clean == "" {
			continue
		}
		for _, candidate := range expandWWWOrigins(clean) {
			if candidate == "" {
				continue
			}
			if _, exists := originSet[candidate]; exists {
				continue
			}
			originSet[candidate] = struct{}{}
			origins = append(origins, candidate)
		}
	}

	if len(origins) == 0 {
		return []string{"http://localhost:3000"}
	}

	return origins
}

func getEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.Atoi(raw)
	if err != nil || value < 0 {
		logger.Warn("Invalid integer env value, using default",
			zap.String("key", key),
			zap.String("value", raw),
			zap.Int("default", fallback),
		)
		return fallback
	}

	return value
}

func getEnvPositiveInt(key string, fallback int) int {
	value := getEnvInt(key, fallback)
	if value <= 0 {
		logger.Warn("Non-positive integer env value is not allowed, using default",
			zap.String("key", key),
			zap.Int("value", value),
			zap.Int("default", fallback),
		)
		return fallback
	}
	return value
}

func getEnvBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.ParseBool(raw)
	if err != nil {
		logger.Warn("Invalid boolean env value, using default",
			zap.String("key", key),
			zap.String("value", raw),
			zap.Bool("default", fallback),
		)
		return fallback
	}

	return value
}

func getEnvCSV(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		clean := strings.TrimSpace(part)
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		out = append(out, clean)
	}

	return out
}

func buildRateLimitConfig() middleware.RateLimitConfig {
	cfg := middleware.DefaultRateLimitConfig()

	cfg.RequestsPerMinute = getEnvPositiveInt("RATE_LIMIT_REQUESTS_PER_MINUTE", cfg.RequestsPerMinute)
	cfg.RequestsPerHour = getEnvPositiveInt("RATE_LIMIT_REQUESTS_PER_HOUR", cfg.RequestsPerHour)
	cfg.AuthRequestsPerMinute = getEnvPositiveInt("RATE_LIMIT_AUTH_REQUESTS_PER_MINUTE", cfg.AuthRequestsPerMinute)
	cfg.AuthRequestsPerHour = getEnvPositiveInt("RATE_LIMIT_AUTH_REQUESTS_PER_HOUR", cfg.AuthRequestsPerHour)
	cfg.SearchRequestsPerMinute = getEnvPositiveInt("RATE_LIMIT_SEARCH_REQUESTS_PER_MINUTE", cfg.SearchRequestsPerMinute)
	cfg.EnableIPLimit = getEnvBool("RATE_LIMIT_ENABLE_IP_LIMIT", cfg.EnableIPLimit)
	cfg.EnableUserLimit = getEnvBool("RATE_LIMIT_ENABLE_USER_LIMIT", cfg.EnableUserLimit)

	if whitelist := getEnvCSV("RATE_LIMIT_WHITELIST_IPS"); len(whitelist) > 0 {
		cfg.WhitelistIPs = whitelist
	}
	if blacklist := getEnvCSV("RATE_LIMIT_BLACKLIST_IPS"); len(blacklist) > 0 {
		cfg.BlacklistIPs = blacklist
	}

	return cfg
}
