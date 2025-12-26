package validators

import (
	"regexp"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

var emailRegex = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
var usernameRegex = regexp.MustCompile(`^[a-z0-9_]{7,30}$`)

// ValidateEmail checks if email is valid
func ValidateEmail(email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return apperrors.ErrMissingField.WithDetails("email")
	}
	// Check for XSS patterns
	if !utils.ValidateNoXSS(email) {
		return apperrors.ErrInvalidEmail.WithDetails("Email mengandung karakter yang tidak diizinkan")
	}
	email = utils.SanitizeEmail(email)
	if !emailRegex.MatchString(email) {
		return apperrors.ErrInvalidEmail
	}
	return nil
}

// ValidatePassword checks if password meets requirements
func ValidatePassword(password string) error {
	password = strings.TrimSpace(password)
	if password == "" {
		return apperrors.ErrMissingField.WithDetails("password")
	}
	if len(password) < 8 {
		return apperrors.ErrWeakPassword.WithDetails("Password minimal 8 karakter")
	}
	return nil
}

// ValidateUsername checks if username is valid (Instagram-style)
// Rules: lowercase letters, numbers, underscore only. Min 7, max 30 chars.
func ValidateUsername(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil // username is optional during registration
	}
	// Check for XSS patterns
	if !utils.ValidateNoXSS(username) {
		return apperrors.ErrInvalidUserInput.WithDetails("Username mengandung karakter yang tidak diizinkan")
	}
	username = utils.SanitizeUsername(username)
	
	// Check length
	if len(username) < 7 {
		return apperrors.ErrInvalidUserInput.WithDetails("Username minimal 7 karakter")
	}
	if len(username) > 30 {
		return apperrors.ErrInvalidUserInput.WithDetails("Username maksimal 30 karakter")
	}
	
	// Check format: lowercase letters, numbers, underscore only
	if !usernameRegex.MatchString(username) {
		return apperrors.ErrInvalidUserInput.WithDetails("Username hanya boleh huruf kecil, angka, dan underscore")
	}
	
	return nil
}

// ValidateUsernameStrict is like ValidateUsername but username is required
func ValidateUsernameStrict(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return apperrors.ErrMissingField.WithDetails("username")
	}
	return ValidateUsername(username)
}

// RegisterInput represents registration input
type RegisterInput struct {
	Email    string
	Password string
	Username *string
	FullName *string
}

// Validate validates registration input
func (r *RegisterInput) Validate() error {
	if err := ValidateEmail(r.Email); err != nil {
		return err
	}
	if err := ValidatePassword(r.Password); err != nil {
		return err
	}
	if r.Username != nil {
		if err := ValidateUsername(*r.Username); err != nil {
			return err
		}
	}
	return nil
}

// LoginInput represents login input
type LoginInput struct {
	Email    string
	Password string
}

// Validate validates login input
func (l *LoginInput) Validate() error {
	if err := ValidateEmail(l.Email); err != nil {
		return err
	}
	if l.Password == "" {
		return apperrors.ErrMissingField.WithDetails("password")
	}
	return nil
}

// VerifyTokenInput represents verification token input
type VerifyTokenInput struct {
	Token string
}

// Validate validates verification token input
func (v *VerifyTokenInput) Validate() error {
	v.Token = strings.TrimSpace(v.Token)
	if v.Token == "" {
		return apperrors.ErrMissingField.WithDetails("token")
	}
	if len(v.Token) != 64 { // hex encoded 32 bytes
		return apperrors.ErrInvalidToken
	}
	return nil
}
