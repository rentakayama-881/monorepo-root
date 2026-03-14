package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
)

// SerializeProof serializes a ZKProof for transmission
func SerializeProof(proof *ZKProof) map[string]string {
	return map[string]string{
		"t":         hex.EncodeToString(proof.T.Bytes()),
		"s":         hex.EncodeToString(proof.S.Bytes()),
		"c":         hex.EncodeToString(proof.C.Bytes()),
		"timestamp": fmt.Sprintf("%d", proof.Timestamp),
		"key_id":    proof.KeyID,
	}
}

// DeserializeProof deserializes a ZKProof from transmission format
func DeserializeProof(data map[string]string) (*ZKProof, error) {
	tBytes, err := hex.DecodeString(data["t"])
	if err != nil {
		return nil, fmt.Errorf("invalid t value: %w", err)
	}

	sBytes, err := hex.DecodeString(data["s"])
	if err != nil {
		return nil, fmt.Errorf("invalid s value: %w", err)
	}

	cBytes, err := hex.DecodeString(data["c"])
	if err != nil {
		return nil, fmt.Errorf("invalid c value: %w", err)
	}

	var timestamp int64
	fmt.Sscanf(data["timestamp"], "%d", &timestamp)

	return &ZKProof{
		T:         new(big.Int).SetBytes(tBytes),
		S:         new(big.Int).SetBytes(sBytes),
		C:         new(big.Int).SetBytes(cBytes),
		Timestamp: timestamp,
		KeyID:     data["key_id"],
	}, nil
}

// ==============================================================================
// ZKP for Password Authentication (Secure Remote Password-like)
// ==============================================================================

// ZKPPasswordProof creates a ZKP that proves knowledge of a password
// without transmitting the password itself.
//
// This is similar to SRP (Secure Remote Password) protocol.
//
// Algorithm:
//  1. Derive x = H(salt || password) as the "password-derived secret"
//  2. Public key y = g^x mod p (stored on server during registration)
//  3. During login, prove knowledge of x using Schnorr protocol
//
// Benefits:
//   - Password never transmitted (even encrypted)
//   - Server stores only y, not x or password
//   - Resistant to server database compromise (can't derive password from y)
func (s *ZKPAuthService) DerivePasswordKey(password string, salt []byte) *big.Int {
	// Combine salt and password
	h := sha256.New()
	h.Write(salt)
	h.Write([]byte(password))
	hash := h.Sum(nil)

	// Use HKDF-like expansion for better key distribution
	h2 := sha256.New()
	h2.Write(hash)
	h2.Write([]byte("zkp-password-key"))
	expandedHash := h2.Sum(nil)

	// Convert to big.Int in the subgroup
	x := new(big.Int).SetBytes(expandedHash)
	x.Mod(x, s.params.Q)

	// Ensure non-zero
	if x.Cmp(big.NewInt(0)) == 0 {
		x = big.NewInt(1)
	}

	return x
}

// CreatePasswordRegistration creates registration data for password-based ZKP.
// Returns the salt and public key to store on the server.
func (s *ZKPAuthService) CreatePasswordRegistration(password string) (salt []byte, publicKey *big.Int, err error) {
	// Generate random salt
	salt = make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Derive private key from password
	x := s.DerivePasswordKey(password, salt)

	// Compute public key
	y := new(big.Int).Exp(s.params.G, x, s.params.P)

	return salt, y, nil
}

// CreatePasswordProof creates a ZKP for password authentication.
func (s *ZKPAuthService) CreatePasswordProof(password string, salt []byte, message []byte) (*ZKProof, error) {
	// Derive private key from password
	x := s.DerivePasswordKey(password, salt)

	// Create proof using Schnorr protocol
	return s.CreateProof(x, message)
}

// VerifyPasswordProof verifies a password-based ZKP.
func (s *ZKPAuthService) VerifyPasswordProof(storedPublicKey *big.Int, message []byte, proof *ZKProof) bool {
	return s.VerifyProof(storedPublicKey, message, proof)
}
