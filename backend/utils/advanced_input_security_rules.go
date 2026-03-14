package utils

import (
	"strings"
	"unicode"
)

// ==============================================================================
// Levenshtein Distance (Edit Distance)
// ==============================================================================

// LevenshteinDistance computes the minimum number of single-character edits
// (insertions, deletions, substitutions) required to change one string into another.
//
// Mathematical Formula (Vladimir Levenshtein, 1965):
// Using dynamic programming:
//
//	d(i, j) = min {
//	    d(i-1, j) + 1,      // deletion
//	    d(i, j-1) + 1,      // insertion
//	    d(i-1, j-1) + cost  // substitution (cost=0 if same, 1 otherwise)
//	}
//
// Base cases:
//
//	d(i, 0) = i  (deleting all characters)
//	d(0, j) = j  (inserting all characters)
//
// Time Complexity: O(m × n)
// Space Complexity: O(min(m, n)) with optimization
//
// Use Cases:
//   - Typosquatting detection: "goog1e.com" vs "google.com"
//   - Fuzzy input matching
//   - Spell checking
func LevenshteinDistance(s1, s2 string) int {
	r1 := []rune(s1)
	r2 := []rune(s2)
	len1, len2 := len(r1), len(r2)

	// Optimize: ensure s1 is the shorter string for space efficiency
	if len1 > len2 {
		r1, r2 = r2, r1
		len1, len2 = len2, len1
	}

	// Use single row for space optimization: O(min(m,n))
	prev := make([]int, len1+1)
	curr := make([]int, len1+1)

	// Initialize base case
	for i := 0; i <= len1; i++ {
		prev[i] = i
	}

	// Fill the matrix row by row
	for j := 1; j <= len2; j++ {
		curr[0] = j
		for i := 1; i <= len1; i++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}
			curr[i] = minInt(
				prev[i]+1,      // deletion
				curr[i-1]+1,    // insertion
				prev[i-1]+cost, // substitution
			)
		}
		prev, curr = curr, prev
	}

	return prev[len1]
}

// NormalizedLevenshtein returns a similarity score between 0 and 1.
// 1.0 = identical, 0.0 = completely different
func NormalizedLevenshtein(s1, s2 string) float64 {
	if len(s1) == 0 && len(s2) == 0 {
		return 1.0
	}

	distance := LevenshteinDistance(s1, s2)
	maxLen := max(len([]rune(s1)), len([]rune(s2)))

	return 1.0 - float64(distance)/float64(maxLen)
}

// DetectTyposquatting checks if input is suspiciously similar to a known good value.
// Threshold is typically 0.8-0.9 (80-90% similarity)
func (v *AdvancedSecurityValidator) DetectTyposquatting(input string, trustedValue string, threshold float64) (bool, float64) {
	similarity := NormalizedLevenshtein(strings.ToLower(input), strings.ToLower(trustedValue))

	// If very similar but not identical, might be typosquatting
	if similarity > threshold && similarity < 1.0 {
		return true, similarity
	}

	return false, similarity
}

// ==============================================================================
// Hamming Distance
// ==============================================================================

// HammingDistance calculates the number of positions at which corresponding
// bits are different between two equal-length byte arrays.
//
// Mathematical Formula:
//
//	d(x, y) = |{i : xᵢ ≠ yᵢ}|
//
// For binary strings, this counts differing bits.
//
// Applications:
//   - Error detection in data transmission
//   - DNA sequence comparison
//   - Hash comparison (detecting single-bit modifications)
func HammingDistance(a, b []byte) int {
	if len(a) != len(b) {
		return -1 // Undefined for different lengths
	}

	distance := 0
	for i := 0; i < len(a); i++ {
		xor := a[i] ^ b[i]
		// Count set bits using Brian Kernighan's algorithm
		// Each iteration clears the lowest set bit
		for xor != 0 {
			distance++
			xor &= xor - 1
		}
	}

	return distance
}

// HammingDistanceStrings calculates Hamming distance for strings (character-level)
func HammingDistanceStrings(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	if len(ra) != len(rb) {
		return -1
	}

	distance := 0
	for i := range ra {
		if ra[i] != rb[i] {
			distance++
		}
	}

	return distance
}

// ==============================================================================
// Homoglyph Detection (Unicode Confusables)
// ==============================================================================

// buildHomoglyphMap creates a mapping of confusable Unicode characters.
// Based on Unicode Technical Standard #39 (UTS39) Security Mechanisms.
//
// Homoglyphs are characters that look similar to each other but have
// different Unicode code points. Attackers use them for:
//   - Phishing: "pаypal.com" (Cyrillic 'а' instead of Latin 'a')
//   - Username impersonation: "аdmin" looks like "admin"
//   - Bypassing filters
func buildHomoglyphMap() map[rune]rune {
	return map[rune]rune{
		// Cyrillic to Latin
		'а': 'a', // Cyrillic Small Letter A
		'е': 'e', // Cyrillic Small Letter Ie
		'о': 'o', // Cyrillic Small Letter O
		'р': 'p', // Cyrillic Small Letter Er
		'с': 'c', // Cyrillic Small Letter Es
		'у': 'y', // Cyrillic Small Letter U
		'х': 'x', // Cyrillic Small Letter Ha
		'ѕ': 's', // Cyrillic Small Letter Dze
		'і': 'i', // Cyrillic Small Letter Byelorussian-Ukrainian I
		'ј': 'j', // Cyrillic Small Letter Je
		'А': 'A', // Cyrillic Capital Letter A
		'В': 'B', // Cyrillic Capital Letter Ve
		'Е': 'E', // Cyrillic Capital Letter Ie
		'К': 'K', // Cyrillic Capital Letter Ka
		'М': 'M', // Cyrillic Capital Letter Em
		'Н': 'H', // Cyrillic Capital Letter En
		'О': 'O', // Cyrillic Capital Letter O
		'Р': 'P', // Cyrillic Capital Letter Er
		'С': 'C', // Cyrillic Capital Letter Es
		'Т': 'T', // Cyrillic Capital Letter Te
		'Х': 'X', // Cyrillic Capital Letter Ha

		// Greek to Latin
		'Α': 'A', // Greek Capital Letter Alpha
		'Β': 'B', // Greek Capital Letter Beta
		'Ε': 'E', // Greek Capital Letter Epsilon
		'Ζ': 'Z', // Greek Capital Letter Zeta
		'Η': 'H', // Greek Capital Letter Eta
		'Ι': 'I', // Greek Capital Letter Iota
		'Κ': 'K', // Greek Capital Letter Kappa
		'Μ': 'M', // Greek Capital Letter Mu
		'Ν': 'N', // Greek Capital Letter Nu
		'Ο': 'O', // Greek Capital Letter Omicron
		'Ρ': 'P', // Greek Capital Letter Rho
		'Τ': 'T', // Greek Capital Letter Tau
		'Υ': 'Y', // Greek Capital Letter Upsilon
		'Χ': 'X', // Greek Capital Letter Chi
		'ο': 'o', // Greek Small Letter Omicron
		'ν': 'v', // Greek Small Letter Nu (looks like v)

		// Fullwidth to ASCII (CJK)
		'０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
		'５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
		'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
		'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J',
		'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O',
		'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T',
		'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z',
		'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
		'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
		'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
		'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
		'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z',

		// Common look-alikes
		'ı': 'i', // Latin Small Letter Dotless I
		'ℓ': 'l', // Script Small L
		'⁰': '0', // Superscript Zero
		'¹': '1', // Superscript One
		'²': '2', // Superscript Two
		'³': '3', // Superscript Three
		'ɑ': 'a', // Latin Small Letter Alpha
		'ɡ': 'g', // Latin Small Letter Script G
		'ⅼ': 'l', // Small Roman Numeral Fifty
		'ⅰ': 'i', // Small Roman Numeral One
		'ⅴ': 'v', // Small Roman Numeral Five
		'ⅹ': 'x', // Small Roman Numeral Ten

		// Modifier letters
		'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
		'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
		'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
		'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
		'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
	}
}

// NormalizeHomoglyphs converts confusable characters to their ASCII equivalents
func (v *AdvancedSecurityValidator) NormalizeHomoglyphs(input string) string {
	var result strings.Builder
	result.Grow(len(input))

	for _, r := range input {
		if normalized, exists := v.homoglyphMap[r]; exists {
			result.WriteRune(normalized)
		} else {
			result.WriteRune(r)
		}
	}

	return result.String()
}

// DetectHomoglyphAttack checks if input contains homoglyph characters
// that might be used for spoofing.
func (v *AdvancedSecurityValidator) DetectHomoglyphAttack(input string) (bool, string) {
	normalized := v.NormalizeHomoglyphs(input)

	if normalized != input {
		// Find which characters were normalized
		var suspiciousChars []rune
		inputRunes := []rune(input)
		normalizedRunes := []rune(normalized)

		for i := range inputRunes {
			if i < len(normalizedRunes) && inputRunes[i] != normalizedRunes[i] {
				suspiciousChars = append(suspiciousChars, inputRunes[i])
			}
		}

		return true, "Homoglyph characters detected: " + string(suspiciousChars)
	}

	return false, ""
}

// ContainsMixedScripts checks if input contains characters from multiple Unicode scripts.
// This is a common indicator of homoglyph attacks.
func (v *AdvancedSecurityValidator) ContainsMixedScripts(input string) (bool, []string) {
	scripts := make(map[string]bool)

	for _, r := range input {
		if unicode.IsLetter(r) {
			script := getScript(r)
			scripts[script] = true
		}
	}

	if len(scripts) > 1 {
		scriptList := make([]string, 0, len(scripts))
		for s := range scripts {
			scriptList = append(scriptList, s)
		}
		return true, scriptList
	}

	return false, nil
}

// getScript determines the Unicode script of a character
func getScript(r rune) string {
	switch {
	case unicode.Is(unicode.Latin, r):
		return "Latin"
	case unicode.Is(unicode.Cyrillic, r):
		return "Cyrillic"
	case unicode.Is(unicode.Greek, r):
		return "Greek"
	case unicode.Is(unicode.Han, r):
		return "Han"
	case unicode.Is(unicode.Hiragana, r):
		return "Hiragana"
	case unicode.Is(unicode.Katakana, r):
		return "Katakana"
	case unicode.Is(unicode.Arabic, r):
		return "Arabic"
	case unicode.Is(unicode.Hebrew, r):
		return "Hebrew"
	case unicode.Is(unicode.Devanagari, r):
		return "Devanagari"
	default:
		return "Other"
	}
}

// ==============================================================================
// Helper Functions
// ==============================================================================

func minInt(a, b, c int) int {
	if a <= b && a <= c {
		return a
	}
	if b <= c {
		return b
	}
	return c
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
