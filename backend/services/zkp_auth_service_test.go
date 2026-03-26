package services

import (
	"math/big"
	"testing"
	"time"
)

// =============================================================================
// zkp_auth_service.go — In-memory key store and auth challenge/response
// =============================================================================

// --- NewZKPAuthService ---

func TestNewZKPAuthService_Params(t *testing.T) {
	svc := NewZKPAuthService()
	if svc.params == nil {
		t.Fatal("params should not be nil")
	}
	if svc.params.P == nil || svc.params.P.Sign() <= 0 {
		t.Error("P should be a positive prime")
	}
	if svc.params.Q == nil || svc.params.Q.Sign() <= 0 {
		t.Error("Q should be a positive prime")
	}
	if svc.params.G == nil || svc.params.G.Cmp(big.NewInt(2)) != 0 {
		t.Error("G should be 2")
	}
	if svc.keyStore == nil {
		t.Error("keyStore should be initialized")
	}
}

func TestNewZKPAuthService_QEquation(t *testing.T) {
	svc := NewZKPAuthService()
	// Q should equal (P - 1) / 2
	pMinusOne := new(big.Int).Sub(svc.params.P, big.NewInt(1))
	expectedQ := new(big.Int).Div(pMinusOne, big.NewInt(2))
	if svc.params.Q.Cmp(expectedQ) != 0 {
		t.Error("Q should equal (P-1)/2")
	}
}

// --- CreateAuthChallenge ---

func TestZkpCreateAuthChallenge(t *testing.T) {
	svc := NewZKPAuthService()
	challenge, err := svc.CreateAuthChallenge("user-42")
	if err != nil {
		t.Fatalf("CreateAuthChallenge failed: %v", err)
	}

	if challenge.UserID != "user-42" {
		t.Errorf("expected UserID %q, got %q", "user-42", challenge.UserID)
	}
	if challenge.Nonce == "" {
		t.Error("Nonce should not be empty")
	}
	if len(challenge.Message) == 0 {
		t.Error("Message should not be empty")
	}
	if challenge.ExpiresAt.Before(time.Now()) {
		t.Error("ExpiresAt should be in the future")
	}
	if challenge.CreatedAt.IsZero() {
		t.Error("CreatedAt should be set")
	}
}

func TestZkpCreateAuthChallenge_UniquenessNonce(t *testing.T) {
	svc := NewZKPAuthService()
	c1, _ := svc.CreateAuthChallenge("user-1")
	c2, _ := svc.CreateAuthChallenge("user-1")

	if c1.Nonce == c2.Nonce {
		t.Error("two challenges for the same user should have different nonces")
	}
}

// --- RegisterPublicKey ---

func TestZkpRegisterPublicKey(t *testing.T) {
	svc := NewZKPAuthService()
	kp, err := svc.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}

	keyID, err := svc.RegisterPublicKey("user-1", kp.PublicKey)
	if err != nil {
		t.Fatalf("RegisterPublicKey failed: %v", err)
	}
	if keyID == "" {
		t.Error("keyID should not be empty")
	}
}

func TestZkpRegisterPublicKey_NilKey(t *testing.T) {
	svc := NewZKPAuthService()
	_, err := svc.RegisterPublicKey("user-1", nil)
	if err == nil {
		t.Error("expected error for nil public key")
	}
}

func TestZkpRegisterPublicKey_InvalidSubgroup(t *testing.T) {
	svc := NewZKPAuthService()
	// p-1 has order 2 in Z*_p (since (p-1)^q = (-1)^q = -1 mod p ≠ 1 for odd q).
	// This means it's NOT in the order-q subgroup.
	badKey := new(big.Int).Sub(svc.params.P, big.NewInt(1))
	_, err := svc.RegisterPublicKey("user-1", badKey)
	if err == nil {
		t.Error("expected error for invalid subgroup key (p-1 has order 2, not q)")
	}
}

// --- GetPublicKey ---

func TestZkpGetPublicKey(t *testing.T) {
	svc := NewZKPAuthService()
	kp, _ := svc.GenerateKeyPair()

	pk, err := svc.GetPublicKey(kp.KeyID)
	if err != nil {
		t.Fatalf("GetPublicKey failed: %v", err)
	}
	if pk.Cmp(kp.PublicKey) != 0 {
		t.Error("retrieved public key should match generated one")
	}
}

func TestZkpGetPublicKey_NotFound(t *testing.T) {
	svc := NewZKPAuthService()
	_, err := svc.GetPublicKey("nonexistent-key-id")
	if err == nil {
		t.Error("expected error for nonexistent key ID")
	}
}

// --- VerifyAuthResponse ---

func TestZkpVerifyAuthResponse_NilInputs(t *testing.T) {
	svc := NewZKPAuthService()

	_, err := svc.VerifyAuthResponse(nil, &ZKProof{})
	if err == nil {
		t.Error("expected error for nil challenge")
	}

	_, err = svc.VerifyAuthResponse(&AuthChallenge{}, nil)
	if err == nil {
		t.Error("expected error for nil proof")
	}
}

func TestZkpVerifyAuthResponse_ExpiredChallenge(t *testing.T) {
	svc := NewZKPAuthService()
	kp, _ := svc.GenerateKeyPair()

	challenge := &AuthChallenge{
		UserID:    "user-1",
		Message:   []byte("test"),
		ExpiresAt: time.Now().Add(-1 * time.Minute), // already expired
		CreatedAt: time.Now().Add(-6 * time.Minute),
	}

	proof, _ := svc.CreateProof(kp.PrivateKey, challenge.Message)

	valid, err := svc.VerifyAuthResponse(challenge, proof)
	if err == nil {
		t.Error("expected error for expired challenge")
	}
	if valid {
		t.Error("should not validate expired challenge")
	}
}

func TestZkpVerifyAuthResponse_FullFlow(t *testing.T) {
	svc := NewZKPAuthService()

	// 1. Generate key pair and register
	kp, _ := svc.GenerateKeyPair()

	// 2. Create auth challenge
	challenge, err := svc.CreateAuthChallenge("user-42")
	if err != nil {
		t.Fatalf("CreateAuthChallenge: %v", err)
	}

	// 3. Create proof with the key pair
	proof, err := svc.CreateProof(kp.PrivateKey, challenge.Message)
	if err != nil {
		t.Fatalf("CreateProof: %v", err)
	}

	// 4. Verify auth response
	valid, err := svc.VerifyAuthResponse(challenge, proof)
	if err != nil {
		t.Fatalf("VerifyAuthResponse error: %v", err)
	}
	if !valid {
		t.Error("VerifyAuthResponse should return true for valid proof")
	}
}
