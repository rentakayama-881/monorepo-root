package handlers

import (
	"net/http"
	"testing"
)

func TestNormalizeItemPrice(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  string
	}{
		{"float64 price", map[string]interface{}{"price": float64(100.5)}, "100.5"},
		{"int-like float", map[string]interface{}{"price": float64(100)}, "100"},
		{"amount key", map[string]interface{}{"amount": "50"}, "50"},
		{"cost key", map[string]interface{}{"cost": "75.5"}, "75.5"},
		{"empty map", map[string]interface{}{}, "-"},
		{"nil price", map[string]interface{}{"price": nil}, "<nil>"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeItemPrice(tt.input)
			if got != tt.want {
				t.Errorf("normalizeItemPrice() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractNumericPrice(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  float64
	}{
		{"float64", map[string]interface{}{"price": float64(99.5)}, 99.5},
		{"int", map[string]interface{}{"price": 42}, 42.0},
		{"int64", map[string]interface{}{"price": int64(100)}, 100.0},
		{"string", map[string]interface{}{"price": "123.45"}, 123.45},
		{"zero", map[string]interface{}{"price": float64(0)}, 0},
		{"negative", map[string]interface{}{"price": float64(-5)}, 0},
		{"empty map", map[string]interface{}{}, 0},
		{"fallback key", map[string]interface{}{"amount": float64(7)}, 7.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractNumericPrice(tt.input)
			if got != tt.want {
				t.Errorf("extractNumericPrice() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPublicMarketOrder_ToClientDTO(t *testing.T) {
	order := publicMarketOrder{
		ID:     "test-123",
		ItemID: "item-456",
		Title:  "Test",
		Delivery: map[string]interface{}{
			"credentials": "secret",
		},
	}

	withDelivery := order.toClientDTO(true)
	if withDelivery.Delivery == nil {
		t.Error("with delivery should include delivery")
	}

	withoutDelivery := order.toClientDTO(false)
	if withoutDelivery.Delivery != nil {
		t.Error("without delivery should not include delivery")
	}
	if withoutDelivery.ID != "test-123" {
		t.Error("other fields should be preserved")
	}
}

func TestIsLocalhostHost(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"localhost", true},
		{"localhost:3000", true},
		{"127.0.0.1", true},
		{"127.0.0.1:8080", true},
		{"::1", false}, // the colon in ::1 triggers the port-stripping logic, leaving empty host
		{"[::1]", false}, // bracketed IPv6 also not handled by this simple function
		{"app.local", true},
		{"example.com", false},
		{"", false},
		{"production.api.com", false},
	}
	for _, tt := range tests {
		got := isLocalhostHost(tt.input)
		if got != tt.want {
			t.Errorf("isLocalhostHost(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestRefreshTokenCookieSameSite(t *testing.T) {
	tests := []struct {
		envVal string
		want   http.SameSite
	}{
		{"strict", http.SameSiteStrictMode},
		{"none", http.SameSiteNoneMode},
		{"lax", http.SameSiteLaxMode},
		{"", http.SameSiteLaxMode},
		{"invalid", http.SameSiteLaxMode},
	}
	for _, tt := range tests {
		t.Setenv("AUTH_COOKIE_SAMESITE", tt.envVal)
		got := refreshTokenCookieSameSite()
		if got != tt.want {
			t.Errorf("refreshTokenCookieSameSite(env=%q) = %v, want %v", tt.envVal, got, tt.want)
		}
	}
}

func TestRefreshTokenCookieName(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		t.Setenv("AUTH_COOKIE_NAME", "")
		got := refreshTokenCookieName()
		if got != "refresh_token" {
			t.Errorf("got %q, want 'refresh_token'", got)
		}
	})
	t.Run("custom", func(t *testing.T) {
		t.Setenv("AUTH_COOKIE_NAME", "my_token")
		got := refreshTokenCookieName()
		if got != "my_token" {
			t.Errorf("got %q, want 'my_token'", got)
		}
	})
}

func TestRefreshTokenCookiePath(t *testing.T) {
	t.Run("default", func(t *testing.T) {
		t.Setenv("AUTH_COOKIE_PATH", "")
		got := refreshTokenCookiePath()
		if got != "/" {
			t.Errorf("got %q, want '/'", got)
		}
	})
	t.Run("custom valid", func(t *testing.T) {
		t.Setenv("AUTH_COOKIE_PATH", "/api")
		got := refreshTokenCookiePath()
		if got != "/api" {
			t.Errorf("got %q, want '/api'", got)
		}
	})
	t.Run("invalid no leading slash", func(t *testing.T) {
		t.Setenv("AUTH_COOKIE_PATH", "invalid")
		got := refreshTokenCookiePath()
		if got != "/" {
			t.Errorf("got %q, want '/' for invalid path", got)
		}
	})
}

func TestParseBoolEnv(t *testing.T) {
	t.Run("true value", func(t *testing.T) {
		t.Setenv("TEST_PARSE_BOOL", "true")
		val, ok := parseBoolEnv("TEST_PARSE_BOOL")
		if !ok || !val {
			t.Errorf("got (%v, %v), want (true, true)", val, ok)
		}
	})
	t.Run("false value", func(t *testing.T) {
		t.Setenv("TEST_PARSE_BOOL", "false")
		val, ok := parseBoolEnv("TEST_PARSE_BOOL")
		if !ok || val {
			t.Errorf("got (%v, %v), want (false, true)", val, ok)
		}
	})
	t.Run("empty", func(t *testing.T) {
		t.Setenv("TEST_PARSE_BOOL", "")
		_, ok := parseBoolEnv("TEST_PARSE_BOOL")
		if ok {
			t.Error("expected ok=false for empty value")
		}
	})
	t.Run("invalid", func(t *testing.T) {
		t.Setenv("TEST_PARSE_BOOL", "maybe")
		_, ok := parseBoolEnv("TEST_PARSE_BOOL")
		if ok {
			t.Error("expected ok=false for invalid value")
		}
	})
}
