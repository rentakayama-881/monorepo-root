package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func newRateLimitTestRouter(limiter *EnhancedRateLimiter, setUserCtx gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if setUserCtx != nil {
		router.Use(setUserCtx)
	}
	router.Use(limiter.Middleware())
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return router
}

func TestEnhancedRateLimiter_UserLimitWithUserID(t *testing.T) {
	limiter := NewEnhancedRateLimiter(RateLimitConfig{
		RequestsPerMinute:       1,
		RequestsPerHour:         100,
		AuthRequestsPerMinute:   10,
		AuthRequestsPerHour:     100,
		SearchRequestsPerMinute: 20,
		EnableIPLimit:           false,
		EnableUserLimit:         true,
	})

	router := newRateLimitTestRouter(limiter, func(c *gin.Context) {
		c.Set("user_id", uint(123))
		c.Next()
	})

	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request should pass, got status %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request should be rate limited, got status %d", rec2.Code)
	}
}

func TestEnhancedRateLimiter_UserLimitWithLegacyUserID(t *testing.T) {
	limiter := NewEnhancedRateLimiter(RateLimitConfig{
		RequestsPerMinute:       1,
		RequestsPerHour:         100,
		AuthRequestsPerMinute:   10,
		AuthRequestsPerHour:     100,
		SearchRequestsPerMinute: 20,
		EnableIPLimit:           false,
		EnableUserLimit:         true,
	})

	router := newRateLimitTestRouter(limiter, func(c *gin.Context) {
		c.Set("userID", "legacy-456")
		c.Next()
	})

	req1 := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec1 := httptest.NewRecorder()
	router.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request should pass, got status %d", rec1.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request should be rate limited, got status %d", rec2.Code)
	}
}

func TestGetUserRateLimitKey_PrefersUserIDAndIgnoresNil(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c1, _ := gin.CreateTestContext(httptest.NewRecorder())
	c1.Set("user_id", uint(77))
	c1.Set("userID", "legacy")

	if got := getUserRateLimitKey(c1); got != "user:77" {
		t.Fatalf("expected user:77, got %q", got)
	}

	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	c2.Set("user_id", nil)
	c2.Set("userID", "legacy-1")

	if got := getUserRateLimitKey(c2); got != "user:legacy-1" {
		t.Fatalf("expected fallback to legacy key, got %q", got)
	}

	c3, _ := gin.CreateTestContext(httptest.NewRecorder())
	c3.Set("user_id", "   ")
	c3.Set("userID", "")

	if got := getUserRateLimitKey(c3); got != "" {
		t.Fatalf("expected empty user key, got %q", got)
	}
}

func TestGetClientIP_DoesNotTrustSpoofedHeadersFromUntrustedSource(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := router.SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatalf("failed to set trusted proxies: %v", err)
	}

	router.GET("/ip", func(c *gin.Context) {
		c.String(http.StatusOK, GetClientIP(c))
	})

	req := httptest.NewRequest(http.MethodGet, "/ip", nil)
	req.RemoteAddr = "203.0.113.7:4321"
	req.Header.Set("X-Forwarded-For", "198.51.100.10")
	req.Header.Set("X-Real-IP", "198.51.100.11")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", rec.Code)
	}

	if got := strings.TrimSpace(rec.Body.String()); got != "203.0.113.7" {
		t.Fatalf("expected remote client IP, got %q", got)
	}
}

func TestGetClientIP_UsesForwardedIPFromTrustedProxy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := router.SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatalf("failed to set trusted proxies: %v", err)
	}

	router.GET("/ip", func(c *gin.Context) {
		c.String(http.StatusOK, GetClientIP(c))
	})

	req := httptest.NewRequest(http.MethodGet, "/ip", nil)
	req.RemoteAddr = "127.0.0.1:8080"
	req.Header.Set("X-Forwarded-For", "198.51.100.10, 127.0.0.1")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", rec.Code)
	}

	if got := strings.TrimSpace(rec.Body.String()); got != "198.51.100.10" {
		t.Fatalf("expected forwarded client IP, got %q", got)
	}
}

func TestParseIPRules_SupportsExactAndCIDR(t *testing.T) {
	exact, cidrs := parseIPRules([]string{
		" 203.0.113.10 ",
		"203.0.113.0/24",
		"10.0.0.0/99",
		"invalid-entry",
		"",
		"2001:db8::1",
		"2001:db8::/32",
	})

	if _, ok := exact["203.0.113.10"]; !ok {
		t.Fatalf("expected normalized IPv4 exact entry to be present")
	}
	if _, ok := exact["2001:db8::1"]; !ok {
		t.Fatalf("expected normalized IPv6 exact entry to be present")
	}
	if _, ok := exact["invalid-entry"]; !ok {
		t.Fatalf("expected non-IP legacy exact entry to be preserved")
	}
	if _, ok := exact["10.0.0.0/99"]; !ok {
		t.Fatalf("expected invalid CIDR entry to be preserved as exact legacy rule")
	}
	if len(cidrs) != 2 {
		t.Fatalf("expected 2 CIDR entries, got %d", len(cidrs))
	}
	if got := cidrs[0].String(); got != "203.0.113.0/24" {
		t.Fatalf("unexpected first CIDR: %s", got)
	}
	if got := cidrs[1].String(); got != "2001:db8::/32" {
		t.Fatalf("unexpected second CIDR: %s", got)
	}
}

func TestEnhancedRateLimiter_WhitelistCIDRBypassesIPRateLimit(t *testing.T) {
	limiter := NewEnhancedRateLimiter(RateLimitConfig{
		RequestsPerMinute:       1,
		RequestsPerHour:         1,
		AuthRequestsPerMinute:   10,
		AuthRequestsPerHour:     100,
		SearchRequestsPerMinute: 20,
		EnableIPLimit:           true,
		EnableUserLimit:         false,
		WhitelistIPs:            []string{"198.51.100.0/24"},
	})

	router := newRateLimitTestRouter(limiter, nil)
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "198.51.100.42:1234"
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("whitelisted CIDR request should pass, iteration=%d status=%d", i, rec.Code)
		}
	}
}

func TestEnhancedRateLimiter_BlacklistCIDRBlocksRequest(t *testing.T) {
	limiter := NewEnhancedRateLimiter(RateLimitConfig{
		RequestsPerMinute:       60,
		RequestsPerHour:         1000,
		AuthRequestsPerMinute:   10,
		AuthRequestsPerHour:     100,
		SearchRequestsPerMinute: 20,
		EnableIPLimit:           true,
		EnableUserLimit:         false,
		BlacklistIPs:            []string{"203.0.113.0/24"},
	})

	router := newRateLimitTestRouter(limiter, nil)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "203.0.113.9:4321"
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("blacklisted CIDR request should be blocked, got status %d", rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, "IP_BLOCKED") {
		t.Fatalf("expected IP_BLOCKED response body, got %s", body)
	}
}

func TestEnhancedRateLimiter_DynamicBlacklistUsesNormalizedIPKey(t *testing.T) {
	limiter := NewEnhancedRateLimiter(DefaultRateLimitConfig())

	limiter.BlockIP(" 2001:db8::1 ", time.Minute)
	if !limiter.IsBlacklisted("2001:db8:0:0:0:0:0:1") {
		t.Fatalf("expected equivalent IPv6 address to be blacklisted")
	}
}
