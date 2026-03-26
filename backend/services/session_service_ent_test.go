package services

import (
	"testing"
)

// =============================================================================
// session_service_ent.go
//
// EntSessionService methods (CreateSession, RevokeSession,
// RevokeAllUserSessions, GetActiveSessions, etc.) all operate directly
// on ent.Client with database queries. They require a live DB connection.
// =============================================================================

func TestPlaceholder_EntSessionService_CreateSession(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_RevokeSession(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_RevokeSessionByRefreshToken(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_RevokeAllUserSessions(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_RevokeTokenFamily(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_GetActiveSessions(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_CleanupExpiredSessions(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_EntSessionService_GetActiveSessionCount(t *testing.T) {
	t.Skip("requires database connection")
}
