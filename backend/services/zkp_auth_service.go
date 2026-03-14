package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"sync"
	"time"
)

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

// AuthChallenge represents a ZKP authentication challenge
type AuthChallenge struct {
	UserID    string
	Nonce     string
	Message   []byte
	ExpiresAt time.Time
	CreatedAt time.Time
}
