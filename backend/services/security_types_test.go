package services

import (
	"testing"
)

func TestSecurityEventTypeConstants_Unique(t *testing.T) {
	events := []string{
		EventLoginSuccess,
		EventLoginFailed,
		EventLogout,
		EventLogoutAll,
		EventRegister,
		EventAccountLocked,
		EventBruteForce,
		EventTOTPFailed,
		EventTOTPMaxAttempts,
		EventTOTPSuccess,
		EventSessionCreated,
		EventTokenReuse,
		EventPasswordChanged,
		EventSudoActivated,
		EventPasskeyAdded,
		EventPasskeyRemoved,
		EventPasskeyLogin,
		EventAccountDeleted,
		EventTOTPEnabled,
		EventTOTPDisabled,
	}
	seen := make(map[string]bool)
	for _, e := range events {
		if e == "" {
			t.Error("event constant must not be empty")
		}
		if seen[e] {
			t.Errorf("duplicate event constant: %s", e)
		}
		seen[e] = true
	}
}

func TestTOTPConstants(t *testing.T) {
	if TOTPIssuer == "" {
		t.Error("TOTPIssuer must not be empty")
	}
	if TOTPDigits != 6 {
		t.Errorf("TOTPDigits = %d, want 6", TOTPDigits)
	}
	if TOTPPeriod != 30 {
		t.Errorf("TOTPPeriod = %d, want 30", TOTPPeriod)
	}
}

func TestDeviceAndSessionConstants(t *testing.T) {
	if MaxAccountsPerDevice < 1 {
		t.Error("MaxAccountsPerDevice must be >= 1")
	}
	if MaxConcurrentSessions < 1 {
		t.Error("MaxConcurrentSessions must be >= 1")
	}
	if DeviceCacheExpiry <= 0 {
		t.Error("DeviceCacheExpiry must be positive")
	}
	if DeviceCleanupInterval <= 0 {
		t.Error("DeviceCleanupInterval must be positive")
	}
	if SessionGracePeriod <= 0 {
		t.Error("SessionGracePeriod must be positive")
	}
	if RefreshTokenRotationWindow <= 0 {
		t.Error("RefreshTokenRotationWindow must be positive")
	}
	if IPChangeWindow <= 0 {
		t.Error("IPChangeWindow must be positive")
	}
	if IPChangeSuspiciousCount < 1 {
		t.Error("IPChangeSuspiciousCount must be >= 1")
	}
}

func TestSudoVerifyResult(t *testing.T) {
	r := SudoVerifyResult{
		Valid:     true,
		SudoToken: "token-123",
		ExpiresIn: 900,
		UserID:    42,
	}
	if !r.Valid {
		t.Error("Valid should be true")
	}
	if r.SudoToken != "token-123" {
		t.Error("SudoToken mismatch")
	}
	if r.UserID != 42 {
		t.Error("UserID mismatch")
	}
}

func TestLoginAttemptConstants(t *testing.T) {
	if AttemptWindow <= 0 {
		t.Error("AttemptWindow must be positive")
	}
	if TOTPAttemptWindow <= 0 {
		t.Error("TOTPAttemptWindow must be positive")
	}
	if CleanupInterval <= 0 {
		t.Error("CleanupInterval must be positive")
	}
	if SudoTTL <= 0 {
		t.Error("SudoTTL must be positive")
	}
}
