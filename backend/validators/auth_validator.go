package validators

import (
	"regexp"
	"strings"

	apperrors "backend-gin/errors"
)

var emailRegex = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// ValidateEmail checks if email is valid
func ValidateEmail(email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return apperrors.ErrMissingField.WithDetails("email")
	}
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

// ValidateUsername checks if username is valid
func ValidateUsername(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil // username is optional
	}
	if len(username) > 64 {
		return apperrors.ErrInvalidUserInput.WithDetails("Username maksimal 64 karakter")
	}
	// Could add more rules: alphanumeric only, no spaces, etc.
	return nil
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
