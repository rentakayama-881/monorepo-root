package services

import (
	"testing"
)

// =============================================================================
// sudo_service_ent.go
//
// EntSudoService methods (Verify, ValidateToken, Revoke, RevokeAll,
// CheckUserTOTPEnabled, GetActiveSession, ExtendSession) all depend
// on ent.Client for DB operations and bcrypt/TOTP verification.
// =============================================================================

func TestPlaceholder_EntSudoService_Verify(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSudoService_ValidateToken(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSudoService_Revoke(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSudoService_RevokeAll(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSudoService_CheckUserTOTPEnabled(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSudoService_GetActiveSession(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSudoService_ExtendSession(t *testing.T) {
	t.Skip("requires database connection")
}

// =============================================================================
// Pure logic tests for EntSudoVerifyInput struct
// =============================================================================

func TestEntSudoVerifyInput_ZeroValue(t *testing.T) {
	// Verify that the zero value is safe (no panics, empty fields)
	input := EntSudoVerifyInput{}
	if input.UserID != 0 {
		t.Errorf("expected zero UserID, got %d", input.UserID)
	}
	if input.Password != "" {
		t.Error("expected empty Password")
	}
	if input.TOTPCode != "" {
		t.Error("expected empty TOTPCode")
	}
	if input.BackupCode != "" {
		t.Error("expected empty BackupCode")
	}
	if input.IPAddress != "" {
		t.Error("expected empty IPAddress")
	}
	if input.UserAgent != "" {
		t.Error("expected empty UserAgent")
	}
}
