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
	`(?i)(\s|^|\()SELECT\s+.*\s+FROM\s`,            // SELECT ... FROM
	`(?i)(\s|^)INSERT\s+INTO\s`,                    // INSERT INTO
	`(?i)(\s|^)UPDATE\s+\w+\s+SET\s`,               // UPDATE ... SET
	`(?i)(\s|^)DELETE\s+FROM\s`,                    // DELETE FROM
	`(?i)(\s|^)DROP\s+(TABLE|DATABASE|INDEX)\s`,   // DROP TABLE/DATABASE/INDEX
	`(?i)(\s|^)CREATE\s+(TABLE|DATABASE|INDEX)\s`, // CREATE TABLE/DATABASE/INDEX
	`(?i)(\s|^)ALTER\s+(TABLE|DATABASE)\s`,        // ALTER TABLE/DATABASE
	`(?i)(\s|^)TRUNCATE\s+(TABLE\s+)?\w`,          // TRUNCATE TABLE
	`(?i)(\s|^)EXEC(UTE)?\s+`,                     // EXEC/EXECUTE
	`(?i)(\s|^)UNION\s+(ALL\s+)?SELECT\s`,         // UNION SELECT
	`(?i)(\s|^)DECLARE\s+@`,                       // DECLARE @variable
	`(?i)(\s|^)(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?`,  // OR 1=1
	`(?i)(\s|^)(OR|AND)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]`, // OR "a"="a"
	`(?i);\s*--`,                                  // Statement terminator + comment
	`(?i)/\*.*\*/`,                                // Block comment
	`(?i)'\s*(OR|AND)\s+'`,                        // ' OR '
	`(?i)WAITFOR\s+DELAY\s`,                       // Time-based injection
	`(?i)BENCHMARK\s*\(`,                          // MySQL time-based
	`(?i)SLEEP\s*\(\s*\d`,                         // MySQL/PostgreSQL time-based
	`(?i)PG_SLEEP\s*\(`,                           // PostgreSQL time-based
	`(?i)LOAD_FILE\s*\(`,                          // File read
	`(?i)INTO\s+(OUTFILE|DUMPFILE)\s`,             // File write
	`(?i)INFORMATION_SCHEMA\.\w`,                  // Schema enumeration
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
	`(?i)<script[^>]*>`,                        // Script tags
	`(?i)</script>`,                            // Closing script tags
	`(?i)<iframe[^>]*>`,                        // Iframe tags
	`(?i)<object[^>]*>`,                        // Object tags
	`(?i)<embed[^>]*>`,                         // Embed tags
	`(?i)<applet[^>]*>`,                        // Applet tags
	`(?i)<meta[^>]*http-equiv`,                 // Meta refresh
	`(?i)<link[^>]*>`,                          // Link tags (can be used for CSS injection)
	`(?i)<base[^>]*>`,                          // Base tag hijacking
	`(?i)<form[^>]*>`,                          // Form injection
	`(?i)<input[^>]*>`,                         // Input injection
	`(?i)<img[^>]*onerror`,                     // Img onerror
	`(?i)<svg[^>]*onload`,                      // SVG onload
	`(?i)<body[^>]*onload`,                     // Body onload
	`(?i)<marquee[^>]*>`,                       // Marquee (rare but used)
	`(?i)\s+on\w+\s*=`,                         // Event handlers (onclick, onerror, etc.)
	`(?i)javascript\s*:`,                       // javascript: protocol
	`(?i)vbscript\s*:`,                         // vbscript: protocol
	`(?i)data\s*:[^,]*;base64`,                 // data: with base64
	`(?i)expression\s*\(`,                      // CSS expression
	`(?i)@import\s`,                            // CSS import
	`(?i)binding\s*:`,                          // Mozilla binding
	`(?i)-moz-binding\s*:`,                     // Mozilla binding
	`(?i)behavior\s*:`,                         // IE behavior
	`(?i)<style[^>]*>`,                         // Style tags
	`(?i)url\s*\(\s*['"]?\s*javascript`,        // CSS url with javascript
	`(?i)<!--`,                                  // HTML comments (can hide payloads)
	`(?i)-->`,                                  // Closing HTML comments
	`(?i)<!\[CDATA\[`,                          // CDATA sections
	`(?i)\]\]>`,                                // CDATA close
	`(?i)&\{[^}]*\}`,                           // HTML entity encoding tricks
	`(?i)\\u00[0-9a-f]{2}`,                     // Unicode escapes
	`(?i)&#x[0-9a-f]+;?`,                       // Hex encoded entities
	`(?i)&#\d+;?`,                              // Decimal encoded entities
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
// Path Traversal Detection
// ==============================================================================

// Path traversal patterns to detect
var pathTraversalPatterns = []string{
	`(?i)\.\.(/|\\)`,          // ../ or ..\
	`(?i)\.\.%2f`,             // URL encoded ../
	`(?i)\.\.%5c`,             // URL encoded ..\
	`(?i)%2e%2e(/|\\|%2f|%5c)`, // Double URL encoded
	`(?i)\.\.%c0%af`,          // Overlong UTF-8
	`(?i)\.\.%c1%9c`,          // Overlong UTF-8
	`(?i)/etc/passwd`,         // Linux password file
	`(?i)/etc/shadow`,         // Linux shadow file
	`(?i)c:\\windows`,         // Windows system path
	`(?i)c:/windows`,          // Windows system path (forward slash)
	`(?i)\\\\`,                // UNC path
	`(?i)/proc/self`,          // Linux proc filesystem
	`(?i)/var/log`,            // Log files
	`(?i)web\.config`,         // ASP.NET config
	`(?i)\.htaccess`,          // Apache config
	`(?i)\.htpasswd`,          // Apache password file
	`(?i)\.env`,               // Environment file
	`(?i)\.git`,               // Git directory
	`(?i)\.svn`,               // SVN directory
	`(?i)id_rsa`,              // SSH keys
	`(?i)authorized_keys`,     // SSH authorized keys
}

var compiledPathPatterns []*regexp.Regexp

func init() {
	for _, pattern := range pathTraversalPatterns {
		compiled, err := regexp.Compile(pattern)
		if err == nil {
			compiledPathPatterns = append(compiledPathPatterns, compiled)
		}
	}
}

// DetectPathTraversal checks if input contains path traversal patterns
func (v *InputSecurityValidator) DetectPathTraversal(input string) (bool, string) {
	decoded := v.decodeInput(input)

	for i, pattern := range compiledPathPatterns {
		if pattern.MatchString(decoded) {
			return true, pathTraversalPatterns[i]
		}
	}
	return false, ""
}

// IsSafeFromPathTraversal returns true if input is safe from path traversal
func (v *InputSecurityValidator) IsSafeFromPathTraversal(input string) bool {
	detected, _ := v.DetectPathTraversal(input)
	return !detected
}

// ==============================================================================
// Command Injection Detection
// ==============================================================================

// Command injection patterns to detect
var commandInjectionPatterns = []string{
	`(?i);\s*(ls|dir|cat|type|more|less|head|tail|grep|find|wget|curl|nc|netcat|bash|sh|cmd|powershell)`,
	`(?i)\|\s*(ls|dir|cat|type|more|less|head|tail|grep|find|wget|curl|nc|netcat|bash|sh|cmd|powershell)`,
	`(?i)\$\(.*\)`,             // Command substitution
	"(?i)`[^`]+`",              // Backtick command substitution
	`(?i)>\s*/dev/tcp`,         // Bash TCP redirect
	`(?i)eval\s*\(`,            // Eval
	`(?i)exec\s*\(`,            // Exec
	`(?i)system\s*\(`,          // System
	`(?i)passthru\s*\(`,        // Passthru (PHP)
	`(?i)shell_exec\s*\(`,      // Shell exec (PHP)
	`(?i)popen\s*\(`,           // Popen
	`(?i)proc_open\s*\(`,       // Proc open
	`(?i)\|\|`,                 // Command chaining
	`(?i)&&`,                   // Command chaining
	`(?i)\$IFS`,                // Internal Field Separator
	`(?i)%0[ad]`,               // Newline injection
}

var compiledCommandPatterns []*regexp.Regexp

func init() {
	for _, pattern := range commandInjectionPatterns {
		compiled, err := regexp.Compile(pattern)
		if err == nil {
			compiledCommandPatterns = append(compiledCommandPatterns, compiled)
		}
	}
}

// DetectCommandInjection checks if input contains command injection patterns
func (v *InputSecurityValidator) DetectCommandInjection(input string) (bool, string) {
	decoded := v.decodeInput(input)

	for i, pattern := range compiledCommandPatterns {
		if pattern.MatchString(decoded) {
			return true, commandInjectionPatterns[i]
		}
	}
	return false, ""
}

// IsSafeFromCommandInjection returns true if input is safe from command injection
func (v *InputSecurityValidator) IsSafeFromCommandInjection(input string) bool {
	detected, _ := v.DetectCommandInjection(input)
	return !detected
}

// ==============================================================================
// LDAP Injection Detection
// ==============================================================================

// LDAP injection patterns to detect
var ldapInjectionPatterns = []string{
	`(?i)\)\(\|`,               // LDAP OR injection
	`(?i)\)\(&`,               // LDAP AND injection
	`(?i)\*\)`,                // Wildcard injection
	`(?i)\(\*\)`,              // Wildcard filter
	`(?i)[\x00-\x1f]`,         // Control characters
	`(?i)\\[0-9a-f]{2}`,       // Hex escape
}

var compiledLDAPPatterns []*regexp.Regexp

func init() {
	for _, pattern := range ldapInjectionPatterns {
		compiled, err := regexp.Compile(pattern)
		if err == nil {
			compiledLDAPPatterns = append(compiledLDAPPatterns, compiled)
		}
	}
}

// DetectLDAPInjection checks if input contains LDAP injection patterns
func (v *InputSecurityValidator) DetectLDAPInjection(input string) (bool, string) {
	for i, pattern := range compiledLDAPPatterns {
		if pattern.MatchString(input) {
			return true, ldapInjectionPatterns[i]
		}
	}
	return false, ""
}

// IsSafeFromLDAPInjection returns true if input is safe from LDAP injection
func (v *InputSecurityValidator) IsSafeFromLDAPInjection(input string) bool {
	detected, _ := v.DetectLDAPInjection(input)
	return !detected
}

// ==============================================================================
// URL Validation
// ==============================================================================

// AllowedURLProtocols lists allowed URL protocols
var AllowedURLProtocols = []string{"http", "https", "mailto"}

// ValidateURL validates a URL and ensures it uses allowed protocols
func (v *InputSecurityValidator) ValidateURL(inputURL string) (bool, string) {
	if inputURL == "" {
		return true, "" // Empty URL is allowed (optional field)
	}

	// Decode URL
	decoded := v.decodeInput(inputURL)

	// Check for javascript: and other dangerous protocols
	dangerousProtocols := []string{
		"javascript:", "vbscript:", "data:", "file:", "ftp:",
		"jar:", "netdoc:", "mailto:", "tel:", "sms:",
	}

	lowerURL := strings.ToLower(decoded)
	for _, proto := range dangerousProtocols {
		if strings.HasPrefix(lowerURL, proto) && proto != "mailto:" {
			return false, "dangerous protocol: " + proto
		}
	}

	// Parse URL
	parsed, err := url.Parse(inputURL)
	if err != nil {
		return false, "invalid URL format"
	}

	// Check protocol is allowed
	if parsed.Scheme != "" {
		allowed := false
		for _, proto := range AllowedURLProtocols {
			if parsed.Scheme == proto {
				allowed = true
				break
			}
		}
		if !allowed {
			return false, "protocol not allowed: " + parsed.Scheme
		}
	}

	// Check for IP address in hostname (potential SSRF)
	if parsed.Host != "" {
		// Check for localhost
		host := strings.ToLower(parsed.Hostname())
		if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "0.0.0.0" {
			return false, "localhost URLs not allowed"
		}

		// Check for internal IP ranges
		if v.isInternalIP(host) {
			return false, "internal IP addresses not allowed"
		}
	}

	// Check for XSS in URL
	if detected, _ := v.DetectXSS(inputURL); detected {
		return false, "URL contains XSS patterns"
	}

	return true, ""
}

// isInternalIP checks if an IP address is internal/private
func (v *InputSecurityValidator) isInternalIP(host string) bool {
	// Check for common internal IP patterns
	internalPatterns := []string{
		"10.", "172.16.", "172.17.", "172.18.", "172.19.",
		"172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
		"172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
		"172.30.", "172.31.", "192.168.", "169.254.", "fc", "fd",
	}

	for _, pattern := range internalPatterns {
		if strings.HasPrefix(host, pattern) {
			return true
		}
	}
	return false
}

// IsValidURL is a convenience method for URL validation
func (v *InputSecurityValidator) IsValidURL(inputURL string) bool {
	valid, _ := v.ValidateURL(inputURL)
	return valid
}

// ==============================================================================
// Comprehensive Input Validation
// ==============================================================================

// ValidationResult contains the result of a comprehensive validation
type ValidationResult struct {
	IsValid    bool
	Threats    []string
	SafeValue  string
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
// Email Validation (Enhanced)
// ==============================================================================

// Email validation patterns
var (
	emailRegexStrict = regexp.MustCompile(`^[a-zA-Z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$`)
	disposableEmailDomains = []string{
		"tempmail.com", "throwaway.email", "guerrillamail.com", "10minutemail.com",
		"mailinator.com", "maildrop.cc", "yopmail.com", "trashmail.com",
		"fakeinbox.com", "temp-mail.org", "dispostable.com", "getnada.com",
	}
)

// ValidateEmail validates email format and checks for disposable domains
func (v *InputSecurityValidator) ValidateEmail(email string) (bool, string) {
	email = strings.TrimSpace(strings.ToLower(email))

	if email == "" {
		return false, "email is required"
	}

	// Check format
	if !emailRegexStrict.MatchString(email) {
		return false, "invalid email format"
	}

	// Check for XSS
	if detected, _ := v.DetectXSS(email); detected {
		return false, "email contains invalid characters"
	}

	// Check for disposable email domains
	parts := strings.Split(email, "@")
	if len(parts) == 2 {
		domain := parts[1]
		for _, disposable := range disposableEmailDomains {
			if domain == disposable || strings.HasSuffix(domain, "."+disposable) {
				return false, "disposable email addresses not allowed"
			}
		}
	}

	// Check length
	if len(email) > 254 {
		return false, "email too long"
	}

	return true, ""
}

// IsValidEmail is a convenience method for email validation
func (v *InputSecurityValidator) IsValidEmail(email string) bool {
	valid, _ := v.ValidateEmail(email)
	return valid
}

// ==============================================================================
// Username Validation (Enhanced)
// ==============================================================================

// Reserved usernames that cannot be used
var reservedUsernames = []string{
	"admin", "administrator", "root", "system", "support", "help",
	"mod", "moderator", "staff", "official", "api", "www", "mail",
	"ftp", "smtp", "pop", "imap", "news", "wap", "static", "assets",
	"security", "abuse", "postmaster", "webmaster", "hostmaster",
	"info", "sales", "contact", "feedback", "test", "demo", "null",
	"undefined", "anonymous", "guest", "public", "private", "user",
	"users", "account", "accounts", "login", "logout", "register",
	"signup", "signin", "signout", "password", "forgot", "reset",
	"verify", "confirm", "activate", "deactivate", "delete", "remove",
	"edit", "update", "create", "new", "add", "search", "explore",
	"home", "dashboard", "settings", "profile", "notifications",
	"messages", "inbox", "outbox", "sent", "drafts", "trash", "spam",
}

// ValidateUsername validates username format
func (v *InputSecurityValidator) ValidateUsername(username string) (bool, string) {
	username = strings.TrimSpace(strings.ToLower(username))

	if username == "" {
		return false, "username is required"
	}

	// Check length
	if len(username) < 7 {
		return false, "username must be at least 7 characters"
	}
	if len(username) > 30 {
		return false, "username must be at most 30 characters"
	}

	// Check format (lowercase letters, numbers, underscore only)
	usernameRegex := regexp.MustCompile(`^[a-z0-9_]+$`)
	if !usernameRegex.MatchString(username) {
		return false, "username can only contain lowercase letters, numbers, and underscores"
	}

	// Check for consecutive underscores
	if strings.Contains(username, "__") {
		return false, "username cannot contain consecutive underscores"
	}

	// Cannot start or end with underscore
	if strings.HasPrefix(username, "_") || strings.HasSuffix(username, "_") {
		return false, "username cannot start or end with underscore"
	}

	// Check for reserved usernames
	for _, reserved := range reservedUsernames {
		if username == reserved {
			return false, "this username is reserved"
		}
	}

	// Check for XSS
	if detected, _ := v.DetectXSS(username); detected {
		return false, "username contains invalid characters"
	}

	return true, ""
}

// IsValidUsername is a convenience method for username validation
func (v *InputSecurityValidator) IsValidUsername(username string) bool {
	valid, _ := v.ValidateUsername(username)
	return valid
}

// ==============================================================================
// Password Validation (Enhanced)
// ==============================================================================

// Common weak passwords
var commonPasswords = []string{
	"password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
	"letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
	"ashley", "bailey", "shadow", "123123", "654321", "superman", "qazwsx",
	"michael", "football", "password1", "password123", "welcome", "welcome1",
	"admin", "login", "pass", "test", "guest", "master", "hello", "charlie",
	"donald", "password2", "qwerty123", "mustang", "access", "solo", "passw0rd",
}

// ValidatePassword validates password strength
func (v *InputSecurityValidator) ValidatePassword(password string) (bool, string) {
	if password == "" {
		return false, "password is required"
	}

	// Check length
	if len(password) < 8 {
		return false, "password must be at least 8 characters"
	}
	if len(password) > 128 {
		return false, "password too long"
	}

	// Check for common passwords
	lowerPassword := strings.ToLower(password)
	for _, common := range commonPasswords {
		if lowerPassword == common {
			return false, "this password is too common"
		}
	}

	// Check character requirements
	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	// Require at least 3 of 4 character types for strong passwords
	strengthScore := 0
	if hasUpper {
		strengthScore++
	}
	if hasLower {
		strengthScore++
	}
	if hasNumber {
		strengthScore++
	}
	if hasSpecial {
		strengthScore++
	}

	if strengthScore < 3 {
		return false, "password must contain at least 3 of: uppercase, lowercase, numbers, special characters"
	}

	return true, ""
}

// IsValidPassword is a convenience method for password validation
func (v *InputSecurityValidator) IsValidPassword(password string) bool {
	valid, _ := v.ValidatePassword(password)
	return valid
}

// ==============================================================================
// Global Validator Instance
// ==============================================================================

var inputSecurityValidator = NewInputSecurityValidator()

// GetInputSecurityValidator returns the global input security validator
func GetInputSecurityValidator() *InputSecurityValidator {
	return inputSecurityValidator
}
