package utils

import (
	"html"
	"regexp"
	"strings"
)

// SanitizeHTML removes potentially dangerous HTML tags and attributes
func SanitizeHTML(input string) string {
	// Escape HTML special characters
	sanitized := html.EscapeString(input)
	return sanitized
}

// SanitizeText removes or escapes potentially dangerous characters from text input
func SanitizeText(input string) string {
	// Trim whitespace
	input = strings.TrimSpace(input)

	// Escape HTML entities
	input = html.EscapeString(input)

	return input
}

// RemoveScriptTags removes script tags from input
func RemoveScriptTags(input string) string {
	// Remove <script> tags (case insensitive)
	scriptRegex := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	input = scriptRegex.ReplaceAllString(input, "")

	// Remove event handlers (onclick, onerror, etc)
	eventRegex := regexp.MustCompile(`(?i)\s*on\w+\s*=\s*["'][^"']*["']`)
	input = eventRegex.ReplaceAllString(input, "")

	// Remove javascript: protocol
	jsProtocolRegex := regexp.MustCompile(`(?i)javascript:`)
	input = jsProtocolRegex.ReplaceAllString(input, "")

	return input
}

// ValidateNoXSS checks if input contains potential XSS patterns
func ValidateNoXSS(input string) bool {
	// Check for script tags
	if strings.Contains(strings.ToLower(input), "<script") {
		return false
	}

	// Check for event handlers
	eventHandlers := []string{
		"onclick", "onerror", "onload", "onmouseover", "onfocus",
		"onblur", "onchange", "onsubmit", "ondblclick", "onmousedown",
		"onmouseup", "onmousemove", "onmouseout", "onkeydown", "onkeyup",
		"onkeypress",
	}

	lowerInput := strings.ToLower(input)
	for _, handler := range eventHandlers {
		if strings.Contains(lowerInput, handler) {
			return false
		}
	}

	// Check for javascript: protocol
	if strings.Contains(lowerInput, "javascript:") {
		return false
	}

	// Check for data: protocol with script
	if strings.Contains(lowerInput, "data:") && strings.Contains(lowerInput, "script") {
		return false
	}

	return true
}

// SanitizeUsername sanitizes username input
func SanitizeUsername(username string) string {
	// Trim whitespace
	username = strings.TrimSpace(username)

	// Remove any HTML tags
	username = RemoveScriptTags(username)

	// Only allow alphanumeric, underscore, hyphen, and period
	validCharsRegex := regexp.MustCompile(`[^a-zA-Z0-9_\-.]`)
	username = validCharsRegex.ReplaceAllString(username, "")

	return username
}

// SanitizeEmail sanitizes email input
func SanitizeEmail(email string) string {
	// Trim whitespace and convert to lowercase
	email = strings.TrimSpace(strings.ToLower(email))

	// Remove any HTML tags
	email = RemoveScriptTags(email)

	return email
}
