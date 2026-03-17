package services

import (
	"math/big"
	"testing"
	"time"
)

func TestZKPAuthService_GenerateKeyPair(t *testing.T) {
	svc := NewZKPAuthService()
	kp, err := svc.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}
	if kp.PrivateKey == nil || kp.PrivateKey.Sign() <= 0 {
		t.Error("private key should be positive")
	}
	if kp.PublicKey == nil || kp.PublicKey.Sign() <= 0 {
		t.Error("public key should be positive")
	}
	if kp.KeyID == "" {
		t.Error("key ID should not be empty")
	}
	if kp.CreatedAt.IsZero() {
		t.Error("created at should be set")
	}
}

func TestZKPAuthService_CreateAndVerifyProof(t *testing.T) {
	svc := NewZKPAuthService()
	kp, err := svc.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair failed: %v", err)
	}

	message := []byte("authenticate user 42")
	proof, err := svc.CreateProof(kp.PrivateKey, message)
	if err != nil {
		t.Fatalf("CreateProof failed: %v", err)
	}

	if proof.T == nil || proof.S == nil || proof.C == nil {
		t.Fatal("proof fields should not be nil")
	}
	if proof.KeyID == "" {
		t.Error("proof key ID should not be empty")
	}

	// Verify should succeed
	if !svc.VerifyProof(kp.PublicKey, message, proof) {
		t.Error("VerifyProof should return true for a valid proof")
	}
}

func TestZKPAuthService_VerifyProof_WrongMessage(t *testing.T) {
	svc := NewZKPAuthService()
	kp, err := svc.GenerateKeyPair()
	if err != nil {
		t.Fatalf("GenerateKeyPair: %v", err)
	}

	proof, err := svc.CreateProof(kp.PrivateKey, []byte("original"))
	if err != nil {
		t.Fatalf("CreateProof: %v", err)
	}

	if svc.VerifyProof(kp.PublicKey, []byte("tampered"), proof) {
		t.Error("VerifyProof should reject tampered message")
	}
}

func TestZKPAuthService_VerifyProof_WrongKey(t *testing.T) {
	svc := NewZKPAuthService()
	kp1, _ := svc.GenerateKeyPair()
	kp2, _ := svc.GenerateKeyPair()

	msg := []byte("msg")
	proof, _ := svc.CreateProof(kp1.PrivateKey, msg)

	if svc.VerifyProof(kp2.PublicKey, msg, proof) {
		t.Error("VerifyProof should reject proof with wrong public key")
	}
}

func TestZKPAuthService_VerifyProof_Expired(t *testing.T) {
	svc := NewZKPAuthService()
	kp, _ := svc.GenerateKeyPair()

	msg := []byte("msg")
	proof, _ := svc.CreateProof(kp.PrivateKey, msg)

	// Expire the proof manually
	proof.Timestamp = time.Now().Unix() - 400

	if svc.VerifyProof(kp.PublicKey, msg, proof) {
		t.Error("VerifyProof should reject expired proof")
	}
}

func TestZKPAuthService_VerifyProof_NilInputs(t *testing.T) {
	svc := NewZKPAuthService()

	if svc.VerifyProof(nil, []byte("msg"), &ZKProof{}) {
		t.Error("should return false for nil publicKey")
	}
	if svc.VerifyProof(big.NewInt(1), []byte("msg"), nil) {
		t.Error("should return false for nil proof")
	}
}

func TestZKPAuthService_CreateProof_NilKey(t *testing.T) {
	svc := NewZKPAuthService()
	_, err := svc.CreateProof(nil, []byte("msg"))
	if err == nil {
		t.Error("CreateProof should fail with nil private key")
	}
}

func TestZKPAuthService_MultipleProofs(t *testing.T) {
	svc := NewZKPAuthService()
	kp, _ := svc.GenerateKeyPair()

	msg := []byte("same message")
	proof1, _ := svc.CreateProof(kp.PrivateKey, msg)
	proof2, _ := svc.CreateProof(kp.PrivateKey, msg)

	// Both proofs should verify
	if !svc.VerifyProof(kp.PublicKey, msg, proof1) {
		t.Error("first proof should verify")
	}
	if !svc.VerifyProof(kp.PublicKey, msg, proof2) {
		t.Error("second proof should verify")
	}

	// Proofs should have different commitments (randomized)
	if proof1.T.Cmp(proof2.T) == 0 {
		t.Error("two proofs should have different commitments (different random r)")
	}
}
