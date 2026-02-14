package handlers

import (
	"net/http"
	"os"
	"strconv"
	"strings"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

const (
	defaultRefreshTokenCookieName = "refresh_token"
	defaultRefreshTokenCookiePath = "/"
)

func refreshTokenCookieName() string {
	name := strings.TrimSpace(os.Getenv("AUTH_COOKIE_NAME"))
	if name == "" {
		return defaultRefreshTokenCookieName
	}
	return name
}

func refreshTokenCookiePath() string {
	path := strings.TrimSpace(os.Getenv("AUTH_COOKIE_PATH"))
	if path == "" {
		return defaultRefreshTokenCookiePath
	}
	if !strings.HasPrefix(path, "/") {
		return defaultRefreshTokenCookiePath
	}
	return path
}

func refreshTokenCookieDomain() string {
	return strings.TrimSpace(os.Getenv("AUTH_COOKIE_DOMAIN"))
}

func refreshTokenCookieMaxAge() int {
	if raw := strings.TrimSpace(os.Getenv("AUTH_COOKIE_MAX_AGE_SECONDS")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			return parsed
		}
	}

	return services.RefreshTokenValidDays * 24 * 60 * 60
}

func refreshTokenCookieSameSite() http.SameSite {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_COOKIE_SAMESITE"))) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	case "lax", "":
		return http.SameSiteLaxMode
	default:
		return http.SameSiteLaxMode
	}
}

func parseBoolEnv(key string) (bool, bool) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return false, false
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, false
	}

	return parsed, true
}

func isLocalhostHost(host string) bool {
	clean := strings.ToLower(strings.TrimSpace(host))
	if clean == "" {
		return false
	}
	if idx := strings.Index(clean, ":"); idx > -1 {
		clean = clean[:idx]
	}
	return clean == "localhost" || clean == "127.0.0.1" || clean == "::1" || strings.HasSuffix(clean, ".local")
}

func refreshTokenCookieSecure(c *gin.Context) bool {
	if configured, ok := parseBoolEnv("AUTH_COOKIE_SECURE"); ok {
		return configured
	}

	if isLocalhostHost(c.Request.Host) {
		return false
	}

	if c.Request.TLS != nil {
		return true
	}

	forwardedProto := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")))
	if forwardedProto == "http" {
		return false
	}

	// Default secure in non-local deployments.
	return true
}

func setRefreshTokenCookie(c *gin.Context, refreshToken string) {
	sameSite := refreshTokenCookieSameSite()
	secure := refreshTokenCookieSecure(c)
	if sameSite == http.SameSiteNoneMode {
		// Browsers require Secure when SameSite=None.
		secure = true
	}

	c.SetSameSite(sameSite)
	c.SetCookie(
		refreshTokenCookieName(),
		refreshToken,
		refreshTokenCookieMaxAge(),
		refreshTokenCookiePath(),
		refreshTokenCookieDomain(),
		secure,
		true,
	)
}

func clearRefreshTokenCookie(c *gin.Context) {
	sameSite := refreshTokenCookieSameSite()
	secure := refreshTokenCookieSecure(c)
	if sameSite == http.SameSiteNoneMode {
		secure = true
	}

	c.SetSameSite(sameSite)
	c.SetCookie(
		refreshTokenCookieName(),
		"",
		-1,
		refreshTokenCookiePath(),
		refreshTokenCookieDomain(),
		secure,
		true,
	)
}

func getRefreshTokenFromCookie(c *gin.Context) string {
	token, err := c.Cookie(refreshTokenCookieName())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(token)
}
