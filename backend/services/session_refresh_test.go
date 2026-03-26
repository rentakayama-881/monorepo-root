package services

import (
	"testing"
)

// =============================================================================
// session_refresh.go
//
// RefreshSession is a complex transactional method that performs:
// - Token hash lookup
// - Reuse detection with grace period
// - Session fingerprinting (IP/UA drift)
// - Account lock check
// - Atomic token rotation via DB transaction
//
// All logic is tightly coupled to ent.Tx and cannot be unit-tested
// without a database connection.
// =============================================================================

func TestPlaceholder_EntSessionService_RefreshSession(t *testing.T) {
	t.Skip("requires database connection - transactional token rotation with reuse detection")
}
