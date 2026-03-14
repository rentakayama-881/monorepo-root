package utils

import (
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

// InputSecurityValidator provides comprehensive input security validation
type InputSecurityValidator struct{}

// NewInputSecurityValidator creates a new input security validator
func NewInputSecurityValidator() *InputSecurityValidator {
	return &InputSecurityValidator{}
}

// ==============================================================================
// SQL Injection Detection
// ==============================================================================

// SQL injection patterns to detect
var sqlInjectionPatterns = []string{
	`(?i)(\s|^|\()SELECT\s+.*\s+FROM\s`,                        // SELECT ... FROM
	`(?i)(\s|^)INSERT\s+INTO\s`,                                // INSERT INTO
	`(?i)(\s|^)UPDATE\s+\w+\s+SET\s`,                           // UPDATE ... SET
	`(?i)(\s|^)DELETE\s+FROM\s`,                                // DELETE FROM
	`(?i)(\s|^)DROP\s+(TABLE|DATABASE|INDEX)\s`,                // DROP TABLE/DATABASE/INDEX
	`(?i)(\s|^)CREATE\s+(TABLE|DATABASE|INDEX)\s`,              // CREATE TABLE/DATABASE/INDEX
	`(?i)(\s|^)ALTER\s+(TABLE|DATABASE)\s`,                     // ALTER TABLE/DATABASE
	`(?i)(\s|^)TRUNCATE\s+(TABLE\s+)?\w`,                       // TRUNCATE TABLE
	`(?i)(\s|^)EXEC(UTE)?\s+`,                                  // EXEC/EXECUTE
	`(?i)(\s|^)UNION\s+(ALL\s+)?SELECT\s`,                      // UNION SELECT
	`(?i)(\s|^)DECLARE\s+@`,                                    // DECLARE @variable
	`(?i)(\s|^)(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?`,   // OR 1=1
	`(?i)(\s|^)(OR|AND)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]`, // OR "a"="a"
	`(?i);\s*--`,                                        // Statement terminator + comment
	`(?i)/\*.*\*/`,                                      // Block comment
	`(?i)'\s*(OR|AND)\s+'`,                              // ' OR '
	`(?i)WAITFOR\s+DELAY\s`,                             // Time-based injection
	`(?i)BENCHMARK\s*\(`,                                // MySQL time-based
	`(?i)SLEEP\s*\(\s*\d`,                               // MySQL/PostgreSQL time-based
	`(?i)PG_SLEEP\s*\(`,                                 // PostgreSQL time-based
	`(?i)LOAD_FILE\s*\(`,                                // File read
	`(?i)INTO\s+(OUTFILE|DUMPFILE)\s`,                   // File write
	`(?i)INFORMATION_SCHEMA\.\w`,                        // Schema enumeration
	`(?i)SYS\.(ALL_TABLES|USER_TABLES|ALL_TAB_COLUMNS)`, // Oracle schema
}

var compiledSQLPatterns []*regexp.Regexp

func init() {
	for _, pattern := range sqlInjectionPatterns {
		compiled, err := regexp.Compile(pattern)
		if err == nil {
			compiledSQLPatterns = append(compiledSQLPatterns, compiled)
		}
	}
}

// DetectSQLInjection checks if input contains SQL injection patterns
func (v *InputSecurityValidator) DetectSQLInjection(input string) (bool, string) {
	for i, pattern := range compiledSQLPatterns {
		if pattern.MatchString(input) {
			return true, sqlInjectionPatterns[i]
		}
	}
	return false, ""
}

// IsSafeFromSQLInjection returns true if input is safe from SQL injection
func (v *InputSecurityValidator) IsSafeFromSQLInjection(input string) bool {
	detected, _ := v.DetectSQLInjection(input)
	return !detected
}

// ==============================================================================
// XSS Detection (Enhanced)
// ==============================================================================

// XSS patterns to detect
var xssPatterns = []string{
	`(?i)<script[^>]*>`,                 // Script tags
	`(?i)</script>`,                     // Closing script tags
	`(?i)<iframe[^>]*>`,                 // Iframe tags
	`(?i)<object[^>]*>`,                 // Object tags
	`(?i)<embed[^>]*>`,                  // Embed tags
	`(?i)<applet[^>]*>`,                 // Applet tags
	`(?i)<meta[^>]*http-equiv`,          // Meta refresh
	`(?i)<link[^>]*>`,                   // Link tags (can be used for CSS injection)
	`(?i)<base[^>]*>`,                   // Base tag hijacking
	`(?i)<form[^>]*>`,                   // Form injection
	`(?i)<input[^>]*>`,                  // Input injection
	`(?i)<img[^>]*onerror`,              // Img onerror
	`(?i)<svg[^>]*onload`,               // SVG onload
	`(?i)<body[^>]*onload`,              // Body onload
	`(?i)<marquee[^>]*>`,                // Marquee (rare but used)
	`(?i)\s+on\w+\s*=`,                  // Event handlers (onclick, onerror, etc.)
	`(?i)javascript\s*:`,                // javascript: protocol
	`(?i)vbscript\s*:`,                  // vbscript: protocol
	`(?i)data\s*:[^,]*;base64`,          // data: with base64
	`(?i)expression\s*\(`,               // CSS expression
	`(?i)@import\s`,                     // CSS import
	`(?i)binding\s*:`,                   // Mozilla binding
	`(?i)-moz-binding\s*:`,              // Mozilla binding
	`(?i)behavior\s*:`,                  // IE behavior
	`(?i)<style[^>]*>`,                  // Style tags
	`(?i)url\s*\(\s*['"]?\s*javascript`, // CSS url with javascript
	`(?i)<!--`,                          // HTML comments (can hide payloads)
	`(?i)-->`,                           // Closing HTML comments
	`(?i)<!\[CDATA\[`,                   // CDATA sections
	`(?i)\]\]>`,                         // CDATA close
	`(?i)&\{[^}]*\}`,                    // HTML entity encoding tricks
	`(?i)\\u00[0-9a-f]{2}`,              // Unicode escapes
	`(?i)&#x[0-9a-f]+;?`,                // Hex encoded entities
	`(?i)&#\d+;?`,                       // Decimal encoded entities
}

var compiledXSSPatterns []*regexp.Regexp

func init() {
	for _, pattern := range xssPatterns {
		compiled, err := regexp.Compile(pattern)
		if err == nil {
			compiledXSSPatterns = append(compiledXSSPatterns, compiled)
		}
	}
}

// DetectXSS checks if input contains XSS patterns
func (v *InputSecurityValidator) DetectXSS(input string) (bool, string) {
	// Decode common encodings first
	decoded := v.decodeInput(input)

	for i, pattern := range compiledXSSPatterns {
		if pattern.MatchString(decoded) {
			return true, xssPatterns[i]
		}
	}

	// Additional check for null bytes
	if strings.Contains(input, "\x00") {
		return true, "null byte"
	}

	return false, ""
}

// IsSafeFromXSS returns true if input is safe from XSS
func (v *InputSecurityValidator) IsSafeFromXSS(input string) bool {
	detected, _ := v.DetectXSS(input)
	return !detected
}

// decodeInput attempts to decode various encodings to catch obfuscated attacks
func (v *InputSecurityValidator) decodeInput(input string) string {
	// URL decode
	decoded, err := url.QueryUnescape(input)
	if err != nil {
		decoded = input
	}

	// Double URL decode
	decoded2, err := url.QueryUnescape(decoded)
	if err == nil {
		decoded = decoded2
	}

	// Remove null bytes
	decoded = strings.ReplaceAll(decoded, "\x00", "")

	return decoded
}

// ==============================================================================
// Comprehensive Input Validation
// ==============================================================================

// ValidationResult contains the result of a comprehensive validation
type ValidationResult struct {
	IsValid   bool
	Threats   []string
	SafeValue string
}

// ValidateInput performs comprehensive input validation
func (v *InputSecurityValidator) ValidateInput(input string) ValidationResult {
	result := ValidationResult{
		IsValid:   true,
		Threats:   []string{},
		SafeValue: input,
	}

	// Check for SQL injection
	if detected, pattern := v.DetectSQLInjection(input); detected {
		result.IsValid = false
		result.Threats = append(result.Threats, "SQL Injection: "+pattern)
	}

	// Check for XSS
	if detected, pattern := v.DetectXSS(input); detected {
		result.IsValid = false
		result.Threats = append(result.Threats, "XSS: "+pattern)
	}

	// Check for path traversal
	if detected, pattern := v.DetectPathTraversal(input); detected {
		result.IsValid = false
		result.Threats = append(result.Threats, "Path Traversal: "+pattern)
	}

	// Check for command injection
	if detected, pattern := v.DetectCommandInjection(input); detected {
		result.IsValid = false
		result.Threats = append(result.Threats, "Command Injection: "+pattern)
	}

	// Check for LDAP injection
	if detected, pattern := v.DetectLDAPInjection(input); detected {
		result.IsValid = false
		result.Threats = append(result.Threats, "LDAP Injection: "+pattern)
	}

	// If valid, sanitize the input
	if result.IsValid {
		result.SafeValue = v.SanitizeInput(input)
	}

	return result
}

// SanitizeInput sanitizes input by removing/escaping dangerous content
func (v *InputSecurityValidator) SanitizeInput(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")

	// Trim whitespace
	input = strings.TrimSpace(input)

	// Remove control characters except newlines and tabs
	var result strings.Builder
	for _, r := range input {
		if r == '\n' || r == '\r' || r == '\t' || !unicode.IsControl(r) {
			result.WriteRune(r)
		}
	}

	return result.String()
}

// ==============================================================================
// Global Validator Instance
// ==============================================================================

var inputSecurityValidator = NewInputSecurityValidator()

// GetInputSecurityValidator returns the global input security validator
func GetInputSecurityValidator() *InputSecurityValidator {
	return inputSecurityValidator
}
