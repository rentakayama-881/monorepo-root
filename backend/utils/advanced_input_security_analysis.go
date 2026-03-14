package utils

import (
	"crypto/subtle"
	"time"
)

// ==============================================================================
// Timing-Safe Comparison
// ==============================================================================

// ConstantTimeCompare performs a constant-time comparison of two strings.
//
// Security Background (Paul Kocher, 1996):
// Timing attacks exploit the fact that comparison functions often return
// early when a mismatch is found. By measuring execution time, an attacker
// can determine how many characters matched.
//
// Attack Scenario:
// If comparing "secret123" with user input:
//   - "aecret123" fails at position 0 (fast return)
//   - "secre0123" fails at position 5 (slower return)
//
// By measuring timing, attacker can brute-force character by character.
//
// Solution:
// Compare ALL characters before returning, ensuring constant execution time.
//
// This uses crypto/subtle.ConstantTimeCompare which:
//   - XORs all bytes together
//   - Returns result only after processing all bytes
//   - Same execution path regardless of where mismatch occurs
func ConstantTimeCompare(a, b string) bool {
	// Handle length difference in constant time
	if len(a) != len(b) {
		// Still perform comparison to mask length information
		// Use the shorter length to avoid panic
		minLen := len(a)
		if len(b) < minLen {
			minLen = len(b)
		}
		// Compare what we can, but always return false
		subtle.ConstantTimeCompare([]byte(a[:minLen]), []byte(b[:minLen]))
		return false
	}

	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// ConstantTimeCompareBytes performs constant-time comparison on byte slices
func ConstantTimeCompareBytes(a, b []byte) bool {
	if len(a) != len(b) {
		minLen := len(a)
		if len(b) < minLen {
			minLen = len(b)
		}
		subtle.ConstantTimeCompare(a[:minLen], b[:minLen])
		return false
	}

	return subtle.ConstantTimeCompare(a, b) == 1
}

// ==============================================================================
// Replay Attack Detection
// ==============================================================================

// ReplayAttackResult contains the result of replay attack detection
type ReplayAttackResult struct {
	IsReplay  bool
	Reason    string
	TimeDrift time.Duration
}

// DetectReplayAttack checks for potential replay attacks using timestamp and nonce.
//
// Replay attacks occur when an attacker captures and retransmits a valid request.
// Prevention requires:
// 1. Timestamp validation (request not too old)
// 2. Nonce uniqueness (each request has unique identifier)
//
// Parameters:
//   - timestamp: Unix timestamp from the request
//   - nonce: Unique identifier for this request
//   - windowSeconds: Acceptable time window (accounts for clock drift + network latency)
func (v *AdvancedSecurityValidator) DetectReplayAttack(
	timestamp int64,
	nonce string,
	windowSeconds int64,
) ReplayAttackResult {
	currentTime := time.Now().Unix()
	timeDiff := currentTime - timestamp

	result := ReplayAttackResult{
		IsReplay:  false,
		TimeDrift: time.Duration(timeDiff) * time.Second,
	}

	// Check timestamp within acceptable window
	// Physics consideration: network latency + clock drift
	// Typical values: 30-300 seconds depending on use case
	if timeDiff < -windowSeconds || timeDiff > windowSeconds {
		result.IsReplay = true
		result.Reason = "timestamp_out_of_window"
		return result
	}

	// Check nonce uniqueness
	if _, exists := v.usedNonces[nonce]; exists {
		result.IsReplay = true
		result.Reason = "nonce_reused"
		return result
	}

	// Store nonce with expiry
	v.usedNonces[nonce] = time.Now()

	// Clean up old nonces (simple implementation)
	// In production, use Redis with TTL or similar
	v.cleanupOldNonces(time.Duration(windowSeconds*2) * time.Second)

	return result
}

// cleanupOldNonces removes nonces older than maxAge
func (v *AdvancedSecurityValidator) cleanupOldNonces(maxAge time.Duration) {
	cutoff := time.Now().Add(-maxAge)
	for nonce, timestamp := range v.usedNonces {
		if timestamp.Before(cutoff) {
			delete(v.usedNonces, nonce)
		}
	}
}
