package services

import (
	"testing"
)

func TestOriginAndHostFromAssertion_Nil(t *testing.T) {
	origin, host := originAndHostFromAssertion(nil)
	if origin != "" {
		t.Errorf("origin = %q, want empty", origin)
	}
	if host != "" {
		t.Errorf("host = %q, want empty", host)
	}
}

func TestOriginAndHost(t *testing.T) {
	tests := []struct {
		name       string
		origin     string
		wantOrigin string
		wantHost   string
	}{
		{
			"empty",
			"",
			"", "",
		},
		{
			"valid https URL",
			"https://example.com",
			"https://example.com", "example.com",
		},
		{
			"valid https with port",
			"https://example.com:3000",
			"https://example.com:3000", "example.com:3000",
		},
		{
			"http localhost",
			"http://localhost:8080",
			"http://localhost:8080", "localhost:8080",
		},
		{
			"valid with path",
			"https://example.com/path",
			"https://example.com/path", "example.com",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotOrigin, gotHost := originAndHost(tt.origin)
			if gotOrigin != tt.wantOrigin {
				t.Errorf("origin = %q, want %q", gotOrigin, tt.wantOrigin)
			}
			if gotHost != tt.wantHost {
				t.Errorf("host = %q, want %q", gotHost, tt.wantHost)
			}
		})
	}
}

func TestPlaceholder_PasskeyLogin_BeginLogin(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_PasskeyLogin_BeginDiscoverableLogin(t *testing.T) {
	t.Skip("requires WebAuthn configuration")
}

func TestPlaceholder_PasskeyLogin_FinishLogin(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_PasskeyLogin_FinishDiscoverableLogin(t *testing.T) {
	t.Skip("requires database connection")
}
