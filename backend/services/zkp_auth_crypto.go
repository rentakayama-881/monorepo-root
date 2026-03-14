package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"
)

// ZKProof represents a Schnorr zero-knowledge proof
type ZKProof struct {
	T         *big.Int // Commitment: t = g^r mod p
	S         *big.Int // Response: s = r + c·x mod q
	C         *big.Int // Challenge: c = H(g || y || t || message)
	Timestamp int64    // Proof timestamp for freshness
	KeyID     string   // Identifier of the public key used
}

// ZKKeyPair represents a Schnorr key pair
type ZKKeyPair struct {
	PrivateKey *big.Int // x: Secret exponent
	PublicKey  *big.Int // y = g^x mod p
	KeyID      string   // Unique identifier
	CreatedAt  time.Time
}

// SchnorrParams contains the cryptographic parameters for Schnorr protocol
type SchnorrParams struct {
	// P is a safe prime: P = 2Q + 1
	P *big.Int
	// Q is the order of the subgroup (Sophie Germain prime)
	Q *big.Int
	// G is a generator of the subgroup of order Q
	G *big.Int
}

// GenerateKeyPair creates a new Schnorr key pair.
//
// Algorithm:
//  1. Generate random x ∈ [1, q-1]
//  2. Compute y = g^x mod p
//
// Security Requirements:
//   - x must be uniformly random in the subgroup
//   - x must remain secret
//   - y can be publicly shared
func (s *ZKPAuthService) GenerateKeyPair() (*ZKKeyPair, error) {
	// Generate random private key x ∈ [1, q-1]
	x, err := rand.Int(rand.Reader, s.params.Q)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random private key: %w", err)
	}

	// Ensure x is not zero
	if x.Cmp(big.NewInt(0)) == 0 {
		x = big.NewInt(1)
	}

	// Compute public key: y = g^x mod p
	y := new(big.Int).Exp(s.params.G, x, s.params.P)

	// Generate key ID from public key hash
	keyID := s.generateKeyID(y)

	keyPair := &ZKKeyPair{
		PrivateKey: x,
		PublicKey:  y,
		KeyID:      keyID,
		CreatedAt:  time.Now(),
	}

	// Store key pair
	s.keyStoreMutex.Lock()
	s.keyStore[keyID] = keyPair
	s.keyStoreMutex.Unlock()

	return keyPair, nil
}

// CreateProof generates a non-interactive zero-knowledge proof.
//
// Uses Fiat-Shamir heuristic to make the protocol non-interactive:
//
//	c = H(g || y || t || message)
//
// This transforms the interactive Schnorr protocol into a signature scheme.
//
// Algorithm:
//  1. Generate random r ∈ [1, q-1]
//  2. Compute commitment: t = g^r mod p
//  3. Compute challenge: c = H(g || y || t || message) mod q
//  4. Compute response: s = r + c·x mod q
//
// The proof (t, s, c) demonstrates knowledge of x without revealing it.
func (s *ZKPAuthService) CreateProof(privateKey *big.Int, message []byte) (*ZKProof, error) {
	if privateKey == nil {
		return nil, fmt.Errorf("private key cannot be nil")
	}

	// Compute public key: y = g^x mod p
	y := new(big.Int).Exp(s.params.G, privateKey, s.params.P)

	// Step 1: Generate random r ∈ [1, q-1]
	r, err := rand.Int(rand.Reader, s.params.Q)
	if err != nil {
		return nil, fmt.Errorf("failed to generate random r: %w", err)
	}
	if r.Cmp(big.NewInt(0)) == 0 {
		r = big.NewInt(1)
	}

	// Step 2: Compute commitment: t = g^r mod p
	t := new(big.Int).Exp(s.params.G, r, s.params.P)

	// Step 3: Compute challenge using Fiat-Shamir transform
	// c = H(g || y || t || message) mod q
	c := s.computeChallenge(y, t, message)

	// Step 4: Compute response: s = r + c·x mod q
	// s = r + (c * privateKey) mod q
	cx := new(big.Int).Mul(c, privateKey)
	sResponse := new(big.Int).Add(r, cx)
	sResponse.Mod(sResponse, s.params.Q)

	return &ZKProof{
		T:         t,
		S:         sResponse,
		C:         c,
		Timestamp: time.Now().Unix(),
		KeyID:     s.generateKeyID(y),
	}, nil
}

// VerifyProof verifies a zero-knowledge proof.
//
// Verification Algorithm:
//  1. Recompute challenge: c' = H(g || y || t || message)
//  2. Check c == c' (challenge matches)
//  3. Verify: g^s ≡ t · y^c (mod p)
//
// Mathematical Proof:
//
//	If s = r + c·x (as computed by honest prover), then:
//	g^s = g^(r + c·x)
//	    = g^r · g^(c·x)
//	    = g^r · (g^x)^c
//	    = t · y^c (mod p)
//
// Security Analysis:
//   - A cheating prover who doesn't know x cannot produce valid (t, s) for random c
//   - The probability of guessing is negligible (2^(-|c|))
func (s *ZKPAuthService) VerifyProof(publicKey *big.Int, message []byte, proof *ZKProof) bool {
	if publicKey == nil || proof == nil {
		return false
	}

	// Check proof freshness (within 5 minutes)
	if time.Now().Unix()-proof.Timestamp > 300 {
		return false
	}

	// Step 1: Recompute challenge using Fiat-Shamir
	expectedC := s.computeChallenge(publicKey, proof.T, message)

	// Step 2: Verify challenge matches
	if proof.C.Cmp(expectedC) != 0 {
		return false
	}

	// Step 3: Verify the Schnorr equation: g^s ≡ t · y^c (mod p)
	// Left side: g^s mod p
	lhs := new(big.Int).Exp(s.params.G, proof.S, s.params.P)

	// Right side: t · y^c mod p
	yc := new(big.Int).Exp(publicKey, proof.C, s.params.P)
	rhs := new(big.Int).Mul(proof.T, yc)
	rhs.Mod(rhs, s.params.P)

	return lhs.Cmp(rhs) == 0
}

// computeChallenge computes the Fiat-Shamir challenge.
// c = H(g || y || t || message) mod q
func (s *ZKPAuthService) computeChallenge(publicKey, commitment *big.Int, message []byte) *big.Int {
	h := sha256.New()
	h.Write(s.params.G.Bytes())
	h.Write(publicKey.Bytes())
	h.Write(commitment.Bytes())
	h.Write(message)

	hashBytes := h.Sum(nil)
	c := new(big.Int).SetBytes(hashBytes)
	c.Mod(c, s.params.Q)

	return c
}

// generateKeyID creates a unique identifier from a public key.
func (s *ZKPAuthService) generateKeyID(publicKey *big.Int) string {
	h := sha256.Sum256(publicKey.Bytes())
	return hex.EncodeToString(h[:16])
}
