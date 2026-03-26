package services

import (
	"testing"
)

func TestIsPrivateIP(t *testing.T) {
	tests := []struct {
		name string
		ip   string
		want bool
	}{
		{"loopback v4", "127.0.0.1", true},
		{"loopback v6", "::1", true},
		{"private 10.x", "10.0.0.1", true},
		{"private 172.16.x", "172.16.0.1", true},
		{"private 192.168.x", "192.168.1.1", true},
		{"public IP", "8.8.8.8", false},
		{"public IP 2", "1.1.1.1", false},
		{"link-local", "169.254.1.1", true},
		{"empty string", "", false},
		{"invalid IP", "not-an-ip", false},
		{"public v6", "2001:4860:4860::8888", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isPrivateIP(tt.ip)
			if got != tt.want {
				t.Errorf("isPrivateIP(%q) = %v, want %v", tt.ip, got, tt.want)
			}
		})
	}
}

func TestNewGeoLookupService(t *testing.T) {
	svc := NewGeoLookupService()
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.httpClient == nil {
		t.Error("expected non-nil HTTP client")
	}
	if svc.cache == nil {
		t.Error("expected non-nil cache map")
	}
}

func TestGeoLookupTimeout_Positive(t *testing.T) {
	if GeoLookupTimeout <= 0 {
		t.Errorf("GeoLookupTimeout = %v, want positive", GeoLookupTimeout)
	}
}

func TestGeoCacheTTL_Positive(t *testing.T) {
	if GeoCacheTTL <= 0 {
		t.Errorf("GeoCacheTTL = %v, want positive", GeoCacheTTL)
	}
}

func TestPlaceholder_GeoLookup_LookupIP(t *testing.T) {
	t.Skip("requires database connection and external API")
}
