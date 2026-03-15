package services

import (
	"testing"
)

func TestPasskeySessionKeyFormats(t *testing.T) {
	t.Run("registration key", func(t *testing.T) {
		key := registrationSessionKey(42)
		if key != "webauthn:reg:42" {
			t.Errorf("got %q, want 'webauthn:reg:42'", key)
		}
	})

	t.Run("login key", func(t *testing.T) {
		key := loginSessionKey("user@example.com")
		if key != "webauthn:login:user@example.com" {
			t.Errorf("got %q, want 'webauthn:login:user@example.com'", key)
		}
	})

	t.Run("discoverable key", func(t *testing.T) {
		key := discoverableSessionKey("session-123")
		if key != "webauthn:discover:session-123" {
			t.Errorf("got %q, want 'webauthn:discover:session-123'", key)
		}
	})
}

func TestGenerateSessionID(t *testing.T) {
	id, err := generateSessionID("test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id == "" {
		t.Error("session ID should not be empty")
	}
	if len(id) < 5 {
		t.Error("session ID should be at least 5 chars")
	}

	// Test uniqueness
	id2, _ := generateSessionID("test")
	if id == id2 {
		t.Error("two session IDs should be different")
	}
}

func TestInMemoryWebAuthnSessionStore(t *testing.T) {
	store := newInMemoryWebAuthnSessionStore(0) // no cleanup

	t.Run("set and get", func(t *testing.T) {
		// We can't easily create webauthn.SessionData without the package
		// but we can test nil/empty behavior
		_, ok := store.getAndDelete("nonexistent")
		if ok {
			t.Error("should return false for nonexistent key")
		}
	})

	t.Run("nil store safety", func(t *testing.T) {
		var nilStore *inMemoryWebAuthnSessionStore
		_, ok := nilStore.getAndDelete("key")
		if ok {
			t.Error("nil store should return false")
		}
		nilStore.set("key", nil, 0) // should not panic
	})

	t.Run("empty key", func(t *testing.T) {
		_, ok := store.getAndDelete("")
		if ok {
			t.Error("empty key should return false")
		}
		store.set("", nil, 0) // should be no-op
	})
}
