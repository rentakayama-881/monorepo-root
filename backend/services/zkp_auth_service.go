package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"sync"
	"time"
)

// ==============================================================================
// ZERO-KNOWLEDGE PROOF AUTHENTICATION SERVICE
// ==============================================================================
//
// Implements Schnorr's Zero-Knowledge Proof Protocol for authentication.
//
// Mathematical Foundation:
//
// The protocol is based on the Discrete Logarithm Problem (DLP):
// Given g, p, and y = g^x mod p, it is computationally infeasible to find x.
//
// Schnorr Identification Protocol (Claus-Peter Schnorr, 1991):
//
// Setup:
//   - p: Large prime (safe prime: p = 2q + 1)
//   - g: Generator of subgroup of order q
//   - x: Private key (secret, known only to prover)
//   - y: Public key, y = g^x mod p
//
// Interactive Protocol:
//   1. Prover → Verifier: t = g^r mod p (commitment, r is random)
//   2. Verifier → Prover: c (random challenge)
//   3. Prover → Verifier: s = r + c·x mod q (response)
//   4. Verifier checks: g^s ≡ t · y^c (mod p)
//
// Non-Interactive (Fiat-Shamir Heuristic):
//   Challenge is derived from hash: c = H(g || y || t || message)
//   This removes the need for interaction while maintaining security.
//
// Security Properties:
//   1. Completeness: Honest prover always convinces honest verifier
//   2. Soundness: Cheating prover cannot convince verifier (except with negligible probability)
//   3. Zero-Knowledge: Verifier learns nothing about x except that prover knows it
//
// Mathematical Proof of Correctness:
//   If s = r + c·x mod q, then:
//   g^s = g^(r + c·x) = g^r · g^(c·x) = g^r · (g^x)^c = t · y^c (mod p)
//
// Quantum Security Consideration:
//   Schnorr protocol is based on DLP which is vulnerable to Shor's algorithm.
//   For post-quantum security, consider lattice-based ZKP schemes.
//   However, for current use, this provides strong classical security.
//
// Reference:
//   - Schnorr, C.P. (1991). "Efficient signature generation by smart cards"
//   - NIST FIPS 186-5 (Digital Signature Standard)
//
// ==============================================================================

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

// ZKPAuthService provides Zero-Knowledge Proof authentication operations
type ZKPAuthService struct {
	params        *SchnorrParams
	keyStore      map[string]*ZKKeyPair // In-memory key storage (use database in production)
	keyStoreMutex sync.RWMutex
}

// NewZKPAuthService creates a new ZKP authentication service with secure parameters
func NewZKPAuthService() *ZKPAuthService {
	// Using RFC 3526 MODP Group 14 (2048-bit)
	// This provides approximately 112-bit security level
	// Sufficient for authentication purposes
	//
	// For higher security, use Group 15 (3072-bit) or Group 16 (4096-bit)
	p := new(big.Int)
	p.SetString(
		"FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"+
			"29024E088A67CC74020BBEA63B139B22514A08798E3404DD"+
			"EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"+
			"E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"+
			"EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D"+
			"C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"+
			"83655D23DCA3AD961C62F356208552BB9ED529077096966D"+
			"670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"+
			"E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9"+
			"DE2BCBF6955817183995497CEA956AE515D2261898FA0510"+
			"15728E5A8AACAA68FFFFFFFFFFFFFFFF", 16)

	// G = 2 is a generator for this group
	g := big.NewInt(2)

	// Q = (P - 1) / 2
	q := new(big.Int).Sub(p, big.NewInt(1))
	q.Div(q, big.NewInt(2))

	return &ZKPAuthService{
		params: &SchnorrParams{
			P: p,
			Q: q,
			G: g,
		},
		keyStore: make(map[string]*ZKKeyPair),
	}
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

// CreateAuthChallenge creates a challenge for ZKP authentication.
// The prover must respond with a valid proof for this challenge.
func (s *ZKPAuthService) CreateAuthChallenge(userID string) (*AuthChallenge, error) {
	// Generate random nonce
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Create challenge message
	challengeData := fmt.Sprintf("zkp-auth:%s:%d:%s", userID, time.Now().Unix(), hex.EncodeToString(nonce))

	return &AuthChallenge{
		UserID:    userID,
		Nonce:     hex.EncodeToString(nonce),
		Message:   []byte(challengeData),
		ExpiresAt: time.Now().Add(5 * time.Minute),
		CreatedAt: time.Now(),
	}, nil
}

// VerifyAuthResponse verifies an authentication response.
func (s *ZKPAuthService) VerifyAuthResponse(challenge *AuthChallenge, proof *ZKProof) (bool, error) {
	if challenge == nil || proof == nil {
		return false, fmt.Errorf("challenge and proof cannot be nil")
	}

	// Check challenge expiry
	if time.Now().After(challenge.ExpiresAt) {
		return false, fmt.Errorf("challenge expired")
	}

	// Look up user's public key
	s.keyStoreMutex.RLock()
	keyPair, exists := s.keyStore[proof.KeyID]
	s.keyStoreMutex.RUnlock()

	if !exists {
		return false, fmt.Errorf("unknown key ID: %s", proof.KeyID)
	}

	// Verify the proof
	isValid := s.VerifyProof(keyPair.PublicKey, challenge.Message, proof)

	return isValid, nil
}

// RegisterPublicKey registers a user's public key for future authentication.
func (s *ZKPAuthService) RegisterPublicKey(userID string, publicKey *big.Int) (string, error) {
	if publicKey == nil {
		return "", fmt.Errorf("public key cannot be nil")
	}

	// Validate public key is in the correct subgroup
	// Check: y^q ≡ 1 (mod p)
	check := new(big.Int).Exp(publicKey, s.params.Q, s.params.P)
	if check.Cmp(big.NewInt(1)) != 0 {
		return "", fmt.Errorf("invalid public key: not in subgroup")
	}

	keyID := s.generateKeyID(publicKey)

	keyPair := &ZKKeyPair{
		PrivateKey: nil, // We don't have the private key
		PublicKey:  publicKey,
		KeyID:      keyID,
		CreatedAt:  time.Now(),
	}

	s.keyStoreMutex.Lock()
	s.keyStore[keyID] = keyPair
	s.keyStoreMutex.Unlock()

	return keyID, nil
}

// GetPublicKey retrieves a public key by its ID.
func (s *ZKPAuthService) GetPublicKey(keyID string) (*big.Int, error) {
	s.keyStoreMutex.RLock()
	defer s.keyStoreMutex.RUnlock()

	keyPair, exists := s.keyStore[keyID]
	if !exists {
		return nil, fmt.Errorf("key not found: %s", keyID)
	}

	return keyPair.PublicKey, nil
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

// AuthChallenge represents a ZKP authentication challenge
type AuthChallenge struct {
	UserID    string
	Nonce     string
	Message   []byte
	ExpiresAt time.Time
	CreatedAt time.Time
}

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
