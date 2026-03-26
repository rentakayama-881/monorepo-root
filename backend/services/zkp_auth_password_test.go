package services

import (
	"encoding/hex"
	"math/big"
	"testing"
)

// =============================================================================
// zkp_auth_password.go — Pure cryptographic functions (no DB required)
// =============================================================================

// --- SerializeProof / DeserializeProof round-trip ---

func TestSerializeDeserializeProof_RoundTrip(t *testing.T) {
	original := &ZKProof{
		T:         big.NewInt(123456789),
		S:         big.NewInt(987654321),
		C:         big.NewInt(555555),
		Timestamp: 1700000000,
		KeyID:     "test-key-id",
	}

	serialized := SerializeProof(original)

	// Verify all fields are present in serialized map
	for _, key := range []string{"t", "s", "c", "timestamp", "key_id"} {
		if _, ok := serialized[key]; !ok {
			t.Fatalf("serialized map missing key %q", key)
		}
	}

	deserialized, err := DeserializeProof(serialized)
	if err != nil {
		t.Fatalf("DeserializeProof failed: %v", err)
	}

	if original.T.Cmp(deserialized.T) != 0 {
		t.Errorf("T mismatch: got %s, want %s", deserialized.T, original.T)
	}
	if original.S.Cmp(deserialized.S) != 0 {
		t.Errorf("S mismatch: got %s, want %s", deserialized.S, original.S)
	}
	if original.C.Cmp(deserialized.C) != 0 {
		t.Errorf("C mismatch: got %s, want %s", deserialized.C, original.C)
	}
	if deserialized.Timestamp != original.Timestamp {
		t.Errorf("Timestamp mismatch: got %d, want %d", deserialized.Timestamp, original.Timestamp)
	}
	if deserialized.KeyID != original.KeyID {
		t.Errorf("KeyID mismatch: got %q, want %q", deserialized.KeyID, original.KeyID)
	}
}

func TestDeserializeProof_InvalidHex(t *testing.T) {
	tests := []struct {
		name string
		data map[string]string
	}{
		{
			name: "invalid t hex",
			data: map[string]string{"t": "zzzz", "s": "00", "c": "00", "timestamp": "0", "key_id": ""},
		},
		{
			name: "invalid s hex",
			data: map[string]string{"t": "00", "s": "not-hex!", "c": "00", "timestamp": "0", "key_id": ""},
		},
		{
			name: "invalid c hex",
			data: map[string]string{"t": "00", "s": "00", "c": "ghij", "timestamp": "0", "key_id": ""},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := DeserializeProof(tc.data)
			if err == nil {
				t.Error("expected error for invalid hex, got nil")
			}
		})
	}
}

func TestSerializeProof_LargeValues(t *testing.T) {
	// Use large big.Int values that look like real crypto output
	largeT := new(big.Int)
	largeT.SetString("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE", 16)
	largeS := new(big.Int)
	largeS.SetString("DEADBEEFCAFEBABE0123456789ABCDEF", 16)

	original := &ZKProof{
		T:         largeT,
		S:         largeS,
		C:         big.NewInt(42),
		Timestamp: 1700000000,
		KeyID:     "large-key",
	}

	serialized := SerializeProof(original)
	deserialized, err := DeserializeProof(serialized)
	if err != nil {
		t.Fatalf("DeserializeProof failed: %v", err)
	}

	if original.T.Cmp(deserialized.T) != 0 {
		t.Error("large T value round-trip failed")
	}
	if original.S.Cmp(deserialized.S) != 0 {
		t.Error("large S value round-trip failed")
	}
}

// --- DerivePasswordKey ---

func TestZkpDerivePasswordKey_Deterministic(t *testing.T) {
	svc := NewZKPAuthService()
	salt := []byte("fixed-salt-for-test")
	password := "my-secret-password"

	key1 := svc.DerivePasswordKey(password, salt)
	key2 := svc.DerivePasswordKey(password, salt)

	if key1.Cmp(key2) != 0 {
		t.Error("DerivePasswordKey should be deterministic for same password+salt")
	}
}

func TestZkpDerivePasswordKey_DifferentPasswords(t *testing.T) {
	svc := NewZKPAuthService()
	salt := []byte("same-salt")

	key1 := svc.DerivePasswordKey("password1", salt)
	key2 := svc.DerivePasswordKey("password2", salt)

	if key1.Cmp(key2) == 0 {
		t.Error("different passwords should produce different keys")
	}
}

func TestZkpDerivePasswordKey_DifferentSalts(t *testing.T) {
	svc := NewZKPAuthService()
	password := "same-password"

	key1 := svc.DerivePasswordKey(password, []byte("salt-a"))
	key2 := svc.DerivePasswordKey(password, []byte("salt-b"))

	if key1.Cmp(key2) == 0 {
		t.Error("different salts should produce different keys")
	}
}

func TestZkpDerivePasswordKey_NonZero(t *testing.T) {
	svc := NewZKPAuthService()
	key := svc.DerivePasswordKey("test", []byte("salt"))

	if key.Sign() <= 0 {
		t.Error("derived key should be positive (non-zero)")
	}
}

func TestZkpDerivePasswordKey_InSubgroup(t *testing.T) {
	svc := NewZKPAuthService()
	key := svc.DerivePasswordKey("test", []byte("salt"))

	// key should be < Q (the subgroup order)
	if key.Cmp(svc.params.Q) >= 0 {
		t.Error("derived key should be less than Q")
	}
}

// --- CreatePasswordRegistration ---

func TestZkpCreatePasswordRegistration(t *testing.T) {
	svc := NewZKPAuthService()

	salt, pubKey, err := svc.CreatePasswordRegistration("my-password")
	if err != nil {
		t.Fatalf("CreatePasswordRegistration failed: %v", err)
	}

	if len(salt) != 32 {
		t.Errorf("expected 32-byte salt, got %d bytes", len(salt))
	}

	if pubKey == nil || pubKey.Sign() <= 0 {
		t.Error("public key should be positive")
	}
}

func TestZkpCreatePasswordRegistration_DifferentSalts(t *testing.T) {
	svc := NewZKPAuthService()

	salt1, _, err1 := svc.CreatePasswordRegistration("password")
	salt2, _, err2 := svc.CreatePasswordRegistration("password")
	if err1 != nil || err2 != nil {
		t.Fatalf("CreatePasswordRegistration failed: %v / %v", err1, err2)
	}

	// Random salts should be different
	if hex.EncodeToString(salt1) == hex.EncodeToString(salt2) {
		t.Error("two registrations should produce different salts")
	}
}

// --- CreatePasswordProof + VerifyPasswordProof end-to-end ---

func TestZkpPasswordProof_EndToEnd(t *testing.T) {
	svc := NewZKPAuthService()
	password := "correct-horse-battery-staple"

	// Registration: derive salt + public key
	salt, pubKey, err := svc.CreatePasswordRegistration(password)
	if err != nil {
		t.Fatalf("CreatePasswordRegistration failed: %v", err)
	}

	// Authentication: create proof
	message := []byte("login-challenge-12345")
	proof, err := svc.CreatePasswordProof(password, salt, message)
	if err != nil {
		t.Fatalf("CreatePasswordProof failed: %v", err)
	}

	// Verification: verify proof with stored public key
	if !svc.VerifyPasswordProof(pubKey, message, proof) {
		t.Error("VerifyPasswordProof should return true for correct password")
	}
}

func TestZkpPasswordProof_WrongPassword(t *testing.T) {
	svc := NewZKPAuthService()

	salt, pubKey, _ := svc.CreatePasswordRegistration("correct-password")

	message := []byte("challenge")
	proof, err := svc.CreatePasswordProof("wrong-password", salt, message)
	if err != nil {
		t.Fatalf("CreatePasswordProof failed: %v", err)
	}

	if svc.VerifyPasswordProof(pubKey, message, proof) {
		t.Error("VerifyPasswordProof should return false for wrong password")
	}
}

func TestZkpPasswordProof_WrongMessage(t *testing.T) {
	svc := NewZKPAuthService()
	password := "my-password"

	salt, pubKey, _ := svc.CreatePasswordRegistration(password)

	proof, _ := svc.CreatePasswordProof(password, salt, []byte("original-challenge"))

	if svc.VerifyPasswordProof(pubKey, []byte("tampered-challenge"), proof) {
		t.Error("VerifyPasswordProof should return false for tampered message")
	}
}
