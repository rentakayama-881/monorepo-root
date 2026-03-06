package validators

import (
	"strings"
	"testing"

	apperrors "backend-gin/errors"

	"github.com/stretchr/testify/assert"
)

func TestValidateEmail_Valid(t *testing.T) {
	tests := []string{
		"test@example.com",
		"user.name@example.co.uk",
		"user+tag@example.com",
		"123@test.com",
	}

	for _, email := range tests {
		t.Run(email, func(t *testing.T) {
			err := ValidateEmail(email)
			assert.NoError(t, err)
		})
	}
}

func TestValidateEmail_Invalid(t *testing.T) {
	tests := []struct {
		email       string
		expectedErr error
	}{
		{"", apperrors.ErrMissingField.WithDetails("email")},
		{"   ", apperrors.ErrMissingField.WithDetails("email")},
		{"invalid", apperrors.ErrInvalidEmail},
		{"@example.com", apperrors.ErrInvalidEmail},
		{"user@", apperrors.ErrInvalidEmail},
		{"user @example.com", apperrors.ErrInvalidEmail},
	}

	for _, tt := range tests {
		t.Run(tt.email, func(t *testing.T) {
			err := ValidateEmail(tt.email)
			assert.Error(t, err)
			if appErr, ok := err.(*apperrors.AppError); ok {
				expectedErr, _ := tt.expectedErr.(*apperrors.AppError)
				assert.Equal(t, expectedErr.Code, appErr.Code)
			}
		})
	}
}

func TestValidatePassword_Valid(t *testing.T) {
	tests := []string{
		"MyP@ssw0rd",
		"SecurePass1",
		"Testing123",
	}

	for _, password := range tests {
		t.Run(password, func(t *testing.T) {
			err := ValidatePassword(password)
			assert.NoError(t, err)
		})
	}
}

func TestValidatePassword_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		password    string
		expectedErr *apperrors.AppError
	}{
		{
			name:        "Empty password",
			password:    "",
			expectedErr: apperrors.ErrMissingField.WithDetails("password"),
		},
		{
			name:        "Whitespace password",
			password:    "   ",
			expectedErr: apperrors.ErrMissingField.WithDetails("password"),
		},
		{
			name:        "Too short",
			password:    "short",
			expectedErr: apperrors.ErrWeakPassword.WithDetails("Password minimal 8 karakter"),
		},
		{
			name:        "Digits only",
			password:    "12345678",
			expectedErr: apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 huruf kecil"),
		},
		{
			name:        "Lowercase only",
			password:    "aaaaaaaa",
			expectedErr: apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 huruf besar"),
		},
		{
			name:        "Common lowercase password without complexity",
			password:    "password",
			expectedErr: apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 huruf besar"),
		},
		{
			name:        "Common mixed case password without digit",
			password:    "Password",
			expectedErr: apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 angka"),
		},
		{
			name:        "Alphabet only",
			password:    "abcdefgh",
			expectedErr: apperrors.ErrWeakPassword.WithDetails("Password harus mengandung minimal 1 huruf besar"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.password)
			assert.Error(t, err)
			appErr, ok := err.(*apperrors.AppError)
			assert.True(t, ok)
			assert.Equal(t, tt.expectedErr.Code, appErr.Code)
			assert.Equal(t, tt.expectedErr.Details, appErr.Details)
		})
	}
}

func TestValidatePassword_TooLong(t *testing.T) {
	password := strings.Repeat("Ab1", 43) // 129 characters

	err := ValidatePassword(password)
	assert.Error(t, err)

	appErr, ok := err.(*apperrors.AppError)
	assert.True(t, ok)
	assert.Equal(t, apperrors.ErrWeakPassword.Code, appErr.Code)
	assert.Equal(t, "Password maksimal 128 karakter", appErr.Details)
}

func TestValidatePassword_CommonPasswordRejected(t *testing.T) {
	err := ValidatePassword("Password1")
	assert.Error(t, err)

	appErr, ok := err.(*apperrors.AppError)
	assert.True(t, ok)
	assert.Equal(t, apperrors.ErrWeakPassword.Code, appErr.Code)
	assert.Equal(t, "Password terlalu umum dan mudah ditebak", appErr.Details)
}

func TestValidateUsername_Valid(t *testing.T) {
	tests := []string{
		"", // empty is valid (optional)
		"johndoe",
		"user_123",
		"usertest",
		"testing1",
		"username_max_thirty_chars12345",
	}

	for _, username := range tests {
		t.Run(username, func(t *testing.T) {
			err := ValidateUsername(username)
			assert.NoError(t, err)
		})
	}
}

func TestValidateUsername_Invalid(t *testing.T) {
	// Username longer than 30 characters
	longUsername := "this_is_a_very_long_username_that_exceeds_the_maximum_allowed"

	err := ValidateUsername(longUsername)
	assert.Error(t, err)
}

func TestRegisterInput_Validate(t *testing.T) {
	t.Run("Valid input", func(t *testing.T) {
		input := RegisterInput{
			Email:    "test@example.com",
			Password: "ValidPass123",
		}
		err := input.Validate()
		assert.NoError(t, err)
	})

	t.Run("Invalid email", func(t *testing.T) {
		input := RegisterInput{
			Email:    "invalid-email",
			Password: "password123",
		}
		err := input.Validate()
		assert.Error(t, err)
		assert.Equal(t, apperrors.ErrInvalidEmail, err)
	})

	t.Run("Weak password", func(t *testing.T) {
		input := RegisterInput{
			Email:    "test@example.com",
			Password: "weak",
		}
		err := input.Validate()
		assert.Error(t, err)
	})
}

func TestLoginInput_Validate(t *testing.T) {
	t.Run("Valid input", func(t *testing.T) {
		input := LoginInput{
			Email:    "test@example.com",
			Password: "anypassword",
		}
		err := input.Validate()
		assert.NoError(t, err)
	})

	t.Run("Invalid email", func(t *testing.T) {
		input := LoginInput{
			Email:    "invalid",
			Password: "password",
		}
		err := input.Validate()
		assert.Error(t, err)
	})

	t.Run("Missing password", func(t *testing.T) {
		input := LoginInput{
			Email:    "test@example.com",
			Password: "",
		}
		err := input.Validate()
		assert.Error(t, err)
	})
}

func TestVerifyTokenInput_Validate(t *testing.T) {
	validToken := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	t.Run("Valid token", func(t *testing.T) {
		input := VerifyTokenInput{
			Token: validToken,
		}
		err := input.Validate()
		assert.NoError(t, err)
	})

	t.Run("Empty token", func(t *testing.T) {
		input := VerifyTokenInput{
			Token: "",
		}
		err := input.Validate()
		assert.Error(t, err)
	})

	t.Run("Invalid token length", func(t *testing.T) {
		input := VerifyTokenInput{
			Token: "short",
		}
		err := input.Validate()
		assert.Error(t, err)
		assert.Equal(t, apperrors.ErrInvalidToken, err)
	})
}
