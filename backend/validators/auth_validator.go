package validators

import (
	"regexp"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

var emailRegex = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
var usernameRegex = regexp.MustCompile(`^[a-z0-9_]{7,30}$`)
var commonPasswords = map[string]struct{}{
	"000000":        {},
	"111111":        {},
	"112233":        {},
	"121212":        {},
	"123123":        {},
	"12345":         {},
	"123456":        {},
	"1234567":       {},
	"12345678":      {},
	"123456789":     {},
	"1234567890":    {},
	"123qwe":        {},
	"147258369":     {},
	"159753":        {},
	"1q2w3e4r":      {},
	"1q2w3e4r5t":    {},
	"1q2w3e4r5t6y":  {},
	"1qaz2wsx":      {},
	"1qazxsw2":      {},
	"555555":        {},
	"654321":        {},
	"666666":        {},
	"696969":        {},
	"7777777":       {},
	"87654321":      {},
	"987654321":     {},
	"999999":        {},
	"!@#$%^&*":      {},
	"a1234567":      {},
	"aa123456":      {},
	"abc123":        {},
	"abc12345":      {},
	"abcd1234":      {},
	"admin":         {},
	"administrator": {},
	"andrew":        {},
	"arsenal":       {},
	"asdf123":       {},
	"asdf1234":      {},
	"asdfg123":      {},
	"asdfgh":        {},
	"asdfghjkl":     {},
	"azerty":        {},
	"azerty123":     {},
	"banana":        {},
	"baseball":      {},
	"bismillah":     {},
	"changeme":      {},
	"charlie":       {},
	"computer":      {},
	"cookie":        {},
	"daniel":        {},
	"default":       {},
	"donald":        {},
	"dragon":        {},
	"facebook":      {},
	"flower":        {},
	"football":      {},
	"freedom":       {},
	"ginger":        {},
	"google":        {},
	"hannah":        {},
	"hello":         {},
	"hottie":        {},
	"hunter":        {},
	"iloveyou":      {},
	"iloveu":        {},
	"indonesia":     {},
	"internet":      {},
	"instagram":     {},
	"iphone":        {},
	"jakarta":       {},
	"jennifer":      {},
	"jessica":       {},
	"jordan":        {},
	"joshua":        {},
	"killer":        {},
	"letmein":       {},
	"linkedin":      {},
	"login":         {},
	"lovely":        {},
	"loveme":        {},
	"martin":        {},
	"master":        {},
	"michael":       {},
	"michelle":      {},
	"monkey":        {},
	"mynoob":        {},
	"naruto":        {},
	"nicole":        {},
	"ninja":         {},
	"noob123":       {},
	"pass1234":      {},
	"passw0rd":      {},
	"passw0rd123":   {},
	"password":      {},
	"password!":     {},
	"password1":     {},
	"password123":   {},
	"pepper":        {},
	"pokemon":       {},
	"princess":      {},
	"q1w2e3r4":      {},
	"q1w2e3r4t5":    {},
	"qazwsx":        {},
	"qwe123":        {},
	"qweasd":        {},
	"qwerty":        {},
	"qwerty1":       {},
	"qwerty12":      {},
	"qwerty123":     {},
	"qwertyui":      {},
	"qwertyuiop":    {},
	"qwertyuiop123": {},
	"robert":        {},
	"root":          {},
	"samsung":       {},
	"secret":        {},
	"shadow":        {},
	"soccer":        {},
	"starwars":      {},
	"summer":        {},
	"superman":      {},
	"surabaya":      {},
	"sunshine":      {},
	"temp1234":      {},
	"test123":       {},
	"thomas":        {},
	"trustno1":      {},
	"twitter":       {},
	"user":          {},
	"welcome":       {},
	"welcome1":      {},
	"welcome123":    {},
	"whatever":      {},
	"zaq1zaq1":      {},
	"zxcvbn":        {},
	"zxcvbnm":       {},
}

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

	hasLower := false
	hasUpper := false
	hasDigit := false

	for _, ch := range password {
		switch {
		case ch >= 'a' && ch <= 'z':
			hasLower = true
		case ch >= 'A' && ch <= 'Z':
			hasUpper = true
		case ch >= '0' && ch <= '9':
			hasDigit = true
		}
	}

	if !hasLower {
		return apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 huruf kecil")
	}
	if !hasUpper {
		return apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 huruf besar")
	}
	if !hasDigit {
		return apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 angka")
	}
	if len(password) > 128 {
		return apperrors.ErrWeakPassword.WithDetails("Password maksimal 128 karakter")
	}
	if isCommonPassword(password) {
		return apperrors.ErrWeakPassword.WithDetails("Password terlalu umum dan mudah ditebak")
	}

	return nil
}

func isCommonPassword(password string) bool {
	_, exists := commonPasswords[strings.ToLower(password)]
	return exists
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
