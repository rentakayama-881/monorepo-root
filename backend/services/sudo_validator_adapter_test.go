package services

import (
	"testing"
)

// =============================================================================
// sudo_validator_adapter.go
//
// SudoValidatorAdapter wraps EntSudoService.ValidateToken with a
// context-less interface for middleware use. The adapter itself is trivial
// (type conversion uint→int + context.Background()), but ValidateToken
// hits the database.
// =============================================================================

func TestPlaceholder_SudoValidatorAdapter_ValidateToken(t *testing.T) {
	t.Skip("requires database connection - adapter delegates to EntSudoService.ValidateToken")
}

// Test that NewSudoValidatorAdapter returns a non-nil adapter
// when given a non-nil service (no DB call needed for construction).
func TestNewSudoValidatorAdapter_NotNil(t *testing.T) {
	// We can't create a real EntSudoService without DB, but we can
	// verify the constructor doesn't panic with a manually built struct.
	svc := &EntSudoService{} // zero-value, no DB client
	adapter := NewSudoValidatorAdapter(svc)
	if adapter == nil {
		t.Fatal("NewSudoValidatorAdapter returned nil")
	}
}
