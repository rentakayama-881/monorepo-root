package services

import (
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"
)

func TestEntPasskeyService_SessionFallback_InMemory(t *testing.T) {
	previousRedisClient := RedisClient
	RedisClient = nil
	t.Cleanup(func() { RedisClient = previousRedisClient })

	svc, err := NewEntPasskeyService(zap.NewNop(), "example.com", []string{"https://example.com"}, "Example")
	if err != nil {
		t.Fatalf("NewEntPasskeyService() error: %v", err)
	}

	// Short TTL to make expiry test fast/deterministic.
	svc.sessionTTL = 15 * time.Millisecond

	_, sessionID, err := svc.BeginDiscoverableLogin()
	if err != nil {
		t.Fatalf("BeginDiscoverableLogin() error: %v", err)
	}

	// Session should be stored even when Redis isn't available.
	if _, ok := svc.getSession(discoverableSessionKey(sessionID)); !ok {
		t.Fatalf("expected discoverable login session to be retrievable from in-memory store")
	}

	// One-time read (getSession deletes).
	if _, ok := svc.getSession(discoverableSessionKey(sessionID)); ok {
		t.Fatalf("expected discoverable login session to be deleted after retrieval")
	}

	// Expiry behavior.
	svc.storeSession("webauthn:test", &webauthn.SessionData{})
	time.Sleep(25 * time.Millisecond)
	if _, ok := svc.getSession("webauthn:test"); ok {
		t.Fatalf("expected session to be expired")
	}
}
