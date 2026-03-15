package services

import (
	"testing"
	"time"
)

func TestHashToken(t *testing.T) {
	// Same input should produce same hash
	h1 := hashToken("test-token")
	h2 := hashToken("test-token")
	if h1 != h2 {
		t.Error("same input should produce same hash")
	}

	// Different input should produce different hash
	h3 := hashToken("different-token")
	if h1 == h3 {
		t.Error("different input should produce different hash")
	}

	// Hash should be hex encoded
	if len(h1) != 64 { // SHA256 = 32 bytes = 64 hex chars
		t.Errorf("hash length = %d, want 64", len(h1))
	}
}

func TestRandomToken(t *testing.T) {
	token, err := randomToken()
	if err != nil {
		t.Fatalf("randomToken error: %v", err)
	}
	if token == "" {
		t.Error("token should not be empty")
	}
	if len(token) != 64 { // 32 bytes = 64 hex chars
		t.Errorf("token length = %d, want 64", len(token))
	}

	// Uniqueness check
	token2, err := randomToken()
	if err != nil {
		t.Fatalf("randomToken error: %v", err)
	}
	if token == token2 {
		t.Error("two tokens should be different")
	}
}

func TestHashRefreshToken(t *testing.T) {
	h := hashRefreshToken("refresh-token-value")
	if h == "" {
		t.Error("hash should not be empty")
	}
	if len(h) != 64 {
		t.Errorf("hash length = %d, want 64", len(h))
	}
}

func TestGenerateTokenFamily(t *testing.T) {
	family := generateTokenFamily()
	if family == "" {
		t.Error("token family should not be empty")
	}
	if len(family) != TokenFamilyLength*2 { // hex encoded
		t.Errorf("token family length = %d, want %d", len(family), TokenFamilyLength*2)
	}

	family2 := generateTokenFamily()
	if family == family2 {
		t.Error("two families should be different")
	}
}

func TestTruncateString(t *testing.T) {
	tests := []struct {
		input  string
		maxLen int
		want   string
	}{
		{"hello", 10, "hello"},
		{"hello", 5, "hello"},
		{"hello", 3, "hel"},
		{"", 5, ""},
		{"hello", 0, ""},
	}
	for _, tt := range tests {
		got := truncateString(tt.input, tt.maxLen)
		if got != tt.want {
			t.Errorf("truncateString(%q, %d) = %q, want %q", tt.input, tt.maxLen, got, tt.want)
		}
	}
}

func TestGenerateBackupCode(t *testing.T) {
	code := generateBackupCode()
	if code == "" {
		t.Error("backup code should not be empty")
	}
	// Format: XXXX-XXXX
	if len(code) != BackupCodeLength*2+1 {
		t.Errorf("code length = %d, want %d", len(code), BackupCodeLength*2+1)
	}
	if code[BackupCodeLength] != '-' {
		t.Errorf("expected dash at position %d, got %c", BackupCodeLength, code[BackupCodeLength])
	}

	// Uniqueness
	code2 := generateBackupCode()
	if code == code2 {
		t.Error("two codes should be different")
	}
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		input time.Duration
		want  string
	}{
		{30 * time.Second, "30 detik"},
		{1 * time.Minute, "1 menit"},
		{5 * time.Minute, "5 menit"},
		{1 * time.Hour, "1 jam"},
		{2*time.Hour + 30*time.Minute, "2 jam 30 menit"},
		{3 * time.Hour, "3 jam"},
	}
	for _, tt := range tests {
		got := formatDuration(tt.input)
		if got != tt.want {
			t.Errorf("formatDuration(%v) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestHashFingerprint(t *testing.T) {
	h := HashFingerprint("fp-123", "Mozilla/5.0")
	if h == "" {
		t.Error("hash should not be empty")
	}
	if len(h) != 64 {
		t.Errorf("hash length = %d, want 64", len(h))
	}

	// Same input, same output
	h2 := HashFingerprint("fp-123", "Mozilla/5.0")
	if h != h2 {
		t.Error("same input should produce same hash")
	}

	// Different input, different output
	h3 := HashFingerprint("fp-456", "Mozilla/5.0")
	if h == h3 {
		t.Error("different input should produce different hash")
	}
}

func TestSecurityConstants(t *testing.T) {
	if MaxAccountsPerDevice <= 0 {
		t.Error("MaxAccountsPerDevice should be positive")
	}
	if MaxLoginAttempts <= 0 {
		t.Error("MaxLoginAttempts should be positive")
	}
	if MaxTOTPAttempts <= 0 {
		t.Error("MaxTOTPAttempts should be positive")
	}
	if LockoutDuration <= 0 {
		t.Error("LockoutDuration should be positive")
	}
	if TOTPLockoutDuration <= 0 {
		t.Error("TOTPLockoutDuration should be positive")
	}
	if MaxConcurrentSessions <= 0 {
		t.Error("MaxConcurrentSessions should be positive")
	}
	if SudoTTL <= 0 {
		t.Error("SudoTTL should be positive")
	}
	if BackupCodeCount <= 0 {
		t.Error("BackupCodeCount should be positive")
	}
}

func TestProgressiveDelays(t *testing.T) {
	if len(ProgressiveDelays) == 0 {
		t.Error("ProgressiveDelays should not be empty")
	}
	// First delay should be zero
	if ProgressiveDelays[0] != 0 {
		t.Errorf("first delay = %v, want 0", ProgressiveDelays[0])
	}
	// Delays should be non-decreasing
	for i := 1; i < len(ProgressiveDelays); i++ {
		if ProgressiveDelays[i] < ProgressiveDelays[i-1] {
			t.Errorf("delay[%d] (%v) < delay[%d] (%v)", i, ProgressiveDelays[i], i-1, ProgressiveDelays[i-1])
		}
	}
}
