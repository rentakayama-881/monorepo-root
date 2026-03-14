package utils

import (
	"net/url"
	"regexp"
	"strings"
)

// ==============================================================================
// Path Traversal Detection
// ==============================================================================

// Path traversal patterns to detect
var pathTraversalPatterns = []string{
	`(?i)\.\.(/|\\)`,           // ../ or ..\
	`(?i)\.\.%2f`,              // URL encoded ../
	`(?i)\.\.%5c`,              // URL encoded ..\
	`(?i)%2e%2e(/|\\|%2f|%5c)`, // Double URL encoded
	`(?i)\.\.%c0%af`,           // Overlong UTF-8
	`(?i)\.\.%c1%9c`,           // Overlong UTF-8
	`(?i)/etc/passwd`,          // Linux password file
	`(?i)/etc/shadow`,          // Linux shadow file
	`(?i)c:\\windows`,          // Windows system path
	`(?i)c:/windows`,           // Windows system path (forward slash)
	`(?i)\\\\`,                 // UNC path
	`(?i)/proc/self`,           // Linux proc filesystem
	`(?i)/var/log`,             // Log files
	`(?i)web\.config`,          // ASP.NET config
	`(?i)\.htaccess`,           // Apache config
	`(?i)\.htpasswd`,           // Apache password file
	`(?i)\.env`,                // Environment file
	`(?i)\.git`,                // Git directory
	`(?i)\.svn`,                // SVN directory
	`(?i)id_rsa`,               // SSH keys
	`(?i)authorized_keys`,      // SSH authorized keys
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
	`(?i)\$\(.*\)`,        // Command substitution
	"(?i)`[^`]+`",         // Backtick command substitution
	`(?i)>\s*/dev/tcp`,    // Bash TCP redirect
	`(?i)eval\s*\(`,       // Eval
	`(?i)exec\s*\(`,       // Exec
	`(?i)system\s*\(`,     // System
	`(?i)passthru\s*\(`,   // Passthru (PHP)
	`(?i)shell_exec\s*\(`, // Shell exec (PHP)
	`(?i)popen\s*\(`,      // Popen
	`(?i)proc_open\s*\(`,  // Proc open
	`(?i)\|\|`,            // Command chaining
	`(?i)&&`,              // Command chaining
	`(?i)\$IFS`,           // Internal Field Separator
	`(?i)%0[ad]`,          // Newline injection
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
	`(?i)\)\(\|`,        // LDAP OR injection
	`(?i)\)\(&`,         // LDAP AND injection
	`(?i)\*\)`,          // Wildcard injection
	`(?i)\(\*\)`,        // Wildcard filter
	`(?i)[\x00-\x1f]`,   // Control characters
	`(?i)\\[0-9a-f]{2}`, // Hex escape
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
