package utils

import (
	"regexp"
	"strings"
	"unicode"
)

// ==============================================================================
// Email Validation (Enhanced)
// ==============================================================================

// Email validation patterns
var (
	emailRegexStrict       = regexp.MustCompile(`^[a-zA-Z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$`)
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
