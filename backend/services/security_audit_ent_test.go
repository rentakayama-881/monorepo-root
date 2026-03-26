package services

import (
	"testing"
)

// =============================================================================
// security_audit_ent.go
//
// EntSecurityAuditService.LogEvent and all Log* convenience methods persist
// events to the database via database.GetEntClient(). Query methods
// (GetRecentEvents, GetFailedLoginsByIP, CleanupOldEvents) also need DB.
// =============================================================================

func TestPlaceholder_EntSecurityAuditService_LogEvent(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSecurityAuditService_LogLoginSuccess(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSecurityAuditService_LogLoginFailed(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSecurityAuditService_GetRecentEvents(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSecurityAuditService_GetFailedLoginsByIP(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSecurityAuditService_CleanupOldEvents(t *testing.T) {
	t.Skip("requires database connection")
}

// =============================================================================
// Constructor test — no DB needed
// =============================================================================

func TestNewEntSecurityAuditService_NotNil(t *testing.T) {
	svc := NewEntSecurityAuditService()
	if svc == nil {
		t.Fatal("NewEntSecurityAuditService returned nil")
	}
}
