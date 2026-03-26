package services

import (
	"testing"
)

func TestHashFingerprintEnt(t *testing.T) {
	h1 := HashFingerprintEnt("browser", "os", "screen")
	if h1 == "" {
		t.Error("expected non-empty hash")
	}
	if len(h1) != 64 {
		t.Errorf("hash length = %d, want 64 (SHA256 hex)", len(h1))
	}

	// Deterministic: same input → same output
	h2 := HashFingerprintEnt("browser", "os", "screen")
	if h1 != h2 {
		t.Errorf("same input gave different hashes: %q vs %q", h1, h2)
	}

	// Different input → different output
	h3 := HashFingerprintEnt("other", "os", "screen")
	if h1 == h3 {
		t.Error("different input should give different hash")
	}
}

func TestHashFingerprintEnt_Empty(t *testing.T) {
	h := HashFingerprintEnt()
	if h == "" {
		t.Error("expected non-empty hash even with no components")
	}
	if len(h) != 64 {
		t.Errorf("hash length = %d, want 64", len(h))
	}
}

func TestHashFingerprintEnt_SingleComponent(t *testing.T) {
	h := HashFingerprintEnt("single")
	if h == "" {
		t.Error("expected non-empty hash")
	}
}

func TestHashFingerprintEnt_OrderMatters(t *testing.T) {
	h1 := HashFingerprintEnt("a", "b")
	h2 := HashFingerprintEnt("b", "a")
	if h1 == h2 {
		t.Error("order should matter for hash computation")
	}
}

func TestPlaceholder_DeviceTracker_CanRegisterAccount(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_DeviceTracker_RecordDeviceRegistration(t *testing.T) {
	t.Skip("requires database connection")
}
