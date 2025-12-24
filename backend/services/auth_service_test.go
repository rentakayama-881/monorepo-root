package services

import (
	"testing"

	apperrors "backend-gin/errors"
	"backend-gin/models"
	"backend-gin/validators"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Auto-migrate models
	err = db.AutoMigrate(
		&models.User{},
		&models.EmailVerificationToken{},
	)
	require.NoError(t, err)

	return db
}

func TestAuthService_Register_Success(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	input := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "password123",
	}

	response, err := service.Register(input)

	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.Equal(t, "Registrasi berhasil. Silakan verifikasi email Anda.", response.Message)
	assert.True(t, response.RequiresVerification)
	assert.NotEmpty(t, response.DevToken)
	assert.NotEmpty(t, response.DevLink)

	// Verify user was created in database
	var user models.User
	err = db.Where("email = ?", "test@example.com").First(&user).Error
	assert.NoError(t, err)
	assert.Equal(t, "test@example.com", user.Email)
	assert.False(t, user.EmailVerified)
}

func TestAuthService_Register_DuplicateEmail(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	// Create first user
	input := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	_, err := service.Register(input)
	require.NoError(t, err)

	// Try to register with same email
	_, err = service.Register(input)
	assert.Error(t, err)
	assert.Equal(t, apperrors.ErrEmailAlreadyExists, err)
}

func TestAuthService_Register_InvalidEmail(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	input := validators.RegisterInput{
		Email:    "invalid-email",
		Password: "password123",
	}

	_, err := service.Register(input)
	assert.Error(t, err)
	assert.Equal(t, apperrors.ErrInvalidEmail, err)
}

func TestAuthService_Register_WeakPassword(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	input := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "weak",
	}

	_, err := service.Register(input)
	assert.Error(t, err)
	appErr, ok := err.(*apperrors.AppError)
	require.True(t, ok)
	assert.Equal(t, "AUTH007", appErr.Code)
}

func TestAuthService_Login_Success(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	// Register user first
	registerInput := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	regResp, err := service.Register(registerInput)
	require.NoError(t, err)

	// Verify email
	verifyInput := validators.VerifyTokenInput{
		Token: regResp.DevToken,
	}
	err = service.ConfirmVerification(verifyInput)
	require.NoError(t, err)

	// Try to login
	loginInput := validators.LoginInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	loginResp, err := service.Login(loginInput)

	assert.NoError(t, err)
	assert.NotNil(t, loginResp)
	assert.NotEmpty(t, loginResp.Token)
	assert.Equal(t, "test@example.com", loginResp.Email)
}

func TestAuthService_Login_InvalidCredentials(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	// Register user
	registerInput := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	_, err := service.Register(registerInput)
	require.NoError(t, err)

	// Try wrong password
	loginInput := validators.LoginInput{
		Email:    "test@example.com",
		Password: "wrongpassword",
	}
	_, err = service.Login(loginInput)

	assert.Error(t, err)
	assert.Equal(t, apperrors.ErrInvalidCredentials, err)
}

func TestAuthService_Login_EmailNotVerified(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	// Register user but don't verify
	registerInput := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	_, err := service.Register(registerInput)
	require.NoError(t, err)

	// Try to login without verification
	loginInput := validators.LoginInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	_, err = service.Login(loginInput)

	assert.Error(t, err)
	assert.Equal(t, apperrors.ErrEmailNotVerified, err)
}

func TestAuthService_ConfirmVerification_Success(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	// Register user
	registerInput := validators.RegisterInput{
		Email:    "test@example.com",
		Password: "password123",
	}
	regResp, err := service.Register(registerInput)
	require.NoError(t, err)

	// Verify email
	verifyInput := validators.VerifyTokenInput{
		Token: regResp.DevToken,
	}
	err = service.ConfirmVerification(verifyInput)

	assert.NoError(t, err)

	// Check user is verified
	var user models.User
	err = db.Where("email = ?", "test@example.com").First(&user).Error
	require.NoError(t, err)
	assert.True(t, user.EmailVerified)
}

func TestAuthService_ConfirmVerification_InvalidToken(t *testing.T) {
	db := setupTestDB(t)
	service := NewAuthService(db)

	verifyInput := validators.VerifyTokenInput{
		Token: "0000000000000000000000000000000000000000000000000000000000000000",
	}
	err := service.ConfirmVerification(verifyInput)

	assert.Error(t, err)
	assert.Equal(t, apperrors.ErrInvalidToken, err)
}
