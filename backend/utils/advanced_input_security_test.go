package utils

import (
	"math"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// Shannon Entropy
// ---------------------------------------------------------------------------

func TestCalculateShannonEntropy(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	tests := []struct {
		name    string
		input   string
		wantMin float64
		wantMax float64
	}{
		{"Empty string", "", 0, 0},
		{"Single char", "a", 0, 0},
		{"All same chars", "aaaaaaa", 0, 0.01},
		{"Two chars equal", "abababab", 0.99, 1.01},
		{"High entropy hex", "0123456789abcdef0123456789abcdef", 3.5, 4.1},
		{"Normal English text", "the quick brown fox jumps over the lazy dog", 3.5, 4.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := v.CalculateShannonEntropy(tt.input)
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("CalculateShannonEntropy(%q) = %f, want [%f, %f]", tt.input, got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestAnalyzeEntropy(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	tests := []struct {
		name        string
		input       string
		wantAnomaly bool
		wantType    string
	}{
		{
			name:        "Short string (no analysis)",
			input:       "hello",
			wantAnomaly: false,
		},
		{
			name:        "Normal sentence",
			input:       "this is a perfectly normal sentence with various words and characters in it",
			wantAnomaly: false,
		},
		{
			name:        "Low entropy long string",
			input:       "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			wantAnomaly: true,
			wantType:    "low_entropy",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := v.AnalyzeEntropy(tt.input)
			if result.IsAnomaly != tt.wantAnomaly {
				t.Errorf("AnalyzeEntropy(%q).IsAnomaly = %v, want %v (type=%s, desc=%s)",
					tt.input, result.IsAnomaly, tt.wantAnomaly, result.AnomalyType, result.Description)
			}
			if tt.wantType != "" && result.AnomalyType != tt.wantType {
				t.Errorf("AnalyzeEntropy(%q).AnomalyType = %q, want %q", tt.input, result.AnomalyType, tt.wantType)
			}
		})
	}
}

func TestDetectEntropyAnomaly(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	lowEntropy := "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	detected, msg := v.DetectEntropyAnomaly(lowEntropy)
	if !detected {
		t.Error("DetectEntropyAnomaly should detect low entropy anomaly")
	}
	if msg == "" {
		t.Error("DetectEntropyAnomaly should return a non-empty message")
	}

	normal := "this is a perfectly normal sentence with various words and characters in it"
	detected, _ = v.DetectEntropyAnomaly(normal)
	if detected {
		t.Error("DetectEntropyAnomaly should not flag normal text")
	}
}

// ---------------------------------------------------------------------------
// Constant-Time Comparison
// ---------------------------------------------------------------------------

func TestConstantTimeCompare(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want bool
	}{
		{"Equal strings", "secret123", "secret123", true},
		{"Empty strings", "", "", true},
		{"Different content", "abc", "xyz", false},
		{"Different lengths", "short", "longer", false},
		{"Same prefix different suffix", "secret1", "secret2", false},
		{"Single char equal", "a", "a", true},
		{"Single char diff", "a", "b", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ConstantTimeCompare(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("ConstantTimeCompare(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestConstantTimeCompareBytes(t *testing.T) {
	tests := []struct {
		name string
		a, b []byte
		want bool
	}{
		{"Equal bytes", []byte{1, 2, 3}, []byte{1, 2, 3}, true},
		{"Empty bytes", []byte{}, []byte{}, true},
		{"Different bytes", []byte{1, 2, 3}, []byte{4, 5, 6}, false},
		{"Different lengths", []byte{1, 2}, []byte{1, 2, 3}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ConstantTimeCompareBytes(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("ConstantTimeCompareBytes(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Replay Attack Detection
// ---------------------------------------------------------------------------

func TestDetectReplayAttack(t *testing.T) {
	v := NewAdvancedSecurityValidator()
	now := time.Now().Unix()

	t.Run("Valid request within window", func(t *testing.T) {
		result := v.DetectReplayAttack(now, "nonce-1", 60)
		if result.IsReplay {
			t.Errorf("fresh request should not be flagged as replay: reason=%s", result.Reason)
		}
	})

	t.Run("Reused nonce", func(t *testing.T) {
		result := v.DetectReplayAttack(now, "nonce-1", 60)
		if !result.IsReplay || result.Reason != "nonce_reused" {
			t.Errorf("reused nonce should be flagged: IsReplay=%v, Reason=%s", result.IsReplay, result.Reason)
		}
	})

	t.Run("Timestamp too old", func(t *testing.T) {
		old := now - 120
		result := v.DetectReplayAttack(old, "nonce-old", 60)
		if !result.IsReplay || result.Reason != "timestamp_out_of_window" {
			t.Errorf("old timestamp should be flagged: IsReplay=%v, Reason=%s", result.IsReplay, result.Reason)
		}
	})

	t.Run("Timestamp in the future", func(t *testing.T) {
		future := now + 120
		result := v.DetectReplayAttack(future, "nonce-future", 60)
		if !result.IsReplay || result.Reason != "timestamp_out_of_window" {
			t.Errorf("future timestamp should be flagged: IsReplay=%v, Reason=%s", result.IsReplay, result.Reason)
		}
	})
}

// ---------------------------------------------------------------------------
// Levenshtein Distance
// ---------------------------------------------------------------------------

func TestLevenshteinDistance(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want int
	}{
		{"Identical", "kitten", "kitten", 0},
		{"Empty to word", "", "abc", 3},
		{"Word to empty", "abc", "", 3},
		{"Both empty", "", "", 0},
		{"Classic kitten-sitting", "kitten", "sitting", 3},
		{"Single insertion", "abc", "abcd", 1},
		{"Single deletion", "abcd", "abc", 1},
		{"Single substitution", "abc", "axc", 1},
		{"Completely different", "abc", "xyz", 3},
		{"Case sensitive", "ABC", "abc", 3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := LevenshteinDistance(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("LevenshteinDistance(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestNormalizedLevenshtein(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want float64
	}{
		{"Identical", "hello", "hello", 1.0},
		{"Both empty", "", "", 1.0},
		{"Completely different", "abc", "xyz", 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizedLevenshtein(tt.a, tt.b)
			if math.Abs(got-tt.want) > 0.01 {
				t.Errorf("NormalizedLevenshtein(%q, %q) = %f, want %f", tt.a, tt.b, got, tt.want)
			}
		})
	}

	// Partial similarity should be between 0 and 1
	sim := NormalizedLevenshtein("google", "goog1e")
	if sim <= 0 || sim >= 1.0 {
		t.Errorf("NormalizedLevenshtein(google, goog1e) = %f, want 0 < x < 1", sim)
	}
}

// ---------------------------------------------------------------------------
// Typosquatting Detection
// ---------------------------------------------------------------------------

func TestDetectTyposquatting(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	tests := []struct {
		name      string
		input     string
		trusted   string
		threshold float64
		wantFlag  bool
	}{
		{"Exact match", "google.com", "google.com", 0.8, false},
		{"Clearly different", "facebook.com", "google.com", 0.8, false},
		{"Typosquat goog1e", "goog1e.com", "google.com", 0.8, true},
		{"Typosquat gogle", "gogle.com", "google.com", 0.8, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			flagged, _ := v.DetectTyposquatting(tt.input, tt.trusted, tt.threshold)
			if flagged != tt.wantFlag {
				t.Errorf("DetectTyposquatting(%q, %q, %f) flagged=%v, want %v",
					tt.input, tt.trusted, tt.threshold, flagged, tt.wantFlag)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Hamming Distance
// ---------------------------------------------------------------------------

func TestHammingDistance(t *testing.T) {
	tests := []struct {
		name string
		a, b []byte
		want int
	}{
		{"Identical", []byte{0xFF}, []byte{0xFF}, 0},
		{"All different bits", []byte{0x00}, []byte{0xFF}, 8},
		{"One bit different", []byte{0x00}, []byte{0x01}, 1},
		{"Different lengths", []byte{0x00}, []byte{0x00, 0x01}, -1},
		{"Empty", []byte{}, []byte{}, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HammingDistance(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("HammingDistance(%v, %v) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestHammingDistanceStrings(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want int
	}{
		{"Identical", "abc", "abc", 0},
		{"One char different", "abc", "axc", 1},
		{"All different", "abc", "xyz", 3},
		{"Different lengths", "ab", "abc", -1},
		{"Empty", "", "", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := HammingDistanceStrings(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("HammingDistanceStrings(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Homoglyph Detection
// ---------------------------------------------------------------------------

func TestNormalizeHomoglyphs(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"Pure ASCII", "google.com", "google.com"},
		{"Cyrillic a in admin", "\u0430dmin", "admin"},       // Cyrillic а → a
		{"Fullwidth A", "\uff21DMIN", "ADMIN"},                // Ａ → A
		{"No homoglyphs", "hello world 123", "hello world 123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := v.NormalizeHomoglyphs(tt.input)
			if got != tt.want {
				t.Errorf("NormalizeHomoglyphs(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDetectHomoglyphAttack(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	tests := []struct {
		name       string
		input      string
		wantDetect bool
	}{
		{"Clean ASCII", "admin", false},
		{"Cyrillic a", "\u0430dmin", true},  // Cyrillic а
		{"Cyrillic o", "g\u043Eogle", true}, // Cyrillic о
		{"Normal text", "hello world", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			detected, _ := v.DetectHomoglyphAttack(tt.input)
			if detected != tt.wantDetect {
				t.Errorf("DetectHomoglyphAttack(%q) = %v, want %v", tt.input, detected, tt.wantDetect)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Mixed Scripts Detection
// ---------------------------------------------------------------------------

func TestContainsMixedScripts(t *testing.T) {
	v := NewAdvancedSecurityValidator()

	tests := []struct {
		name      string
		input     string
		wantMixed bool
	}{
		{"Pure Latin", "hello world", false},
		{"Pure Cyrillic", "привет", false},
		{"Latin + Cyrillic mix", "hеllo", true},       // Cyrillic е in Latin
		{"Latin + numbers only", "abc123", false},      // Numbers are not letters
		{"Empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mixed, _ := v.ContainsMixedScripts(tt.input)
			if mixed != tt.wantMixed {
				t.Errorf("ContainsMixedScripts(%q) = %v, want %v", tt.input, mixed, tt.wantMixed)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Global instance
// ---------------------------------------------------------------------------

func TestGetAdvancedSecurityValidator(t *testing.T) {
	v := GetAdvancedSecurityValidator()
	if v == nil {
		t.Fatal("GetAdvancedSecurityValidator() returned nil")
	}
	// Verify it works
	entropy := v.CalculateShannonEntropy("test")
	if entropy <= 0 {
		t.Errorf("global validator entropy calculation failed: %f", entropy)
	}
}
