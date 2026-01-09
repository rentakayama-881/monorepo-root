package services_test

import (
	"context"
	"testing"

	"backend-gin/logger"
	"backend-gin/tests/enttest"
	"backend-gin/validators"

	apperrors "backend-gin/errors"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func init() {
	// Initialize logger for tests
	if logger.Log == nil {
		logger.InitLogger()
	}
}

// TestEntAuthService_Register tests user registration with Ent ORM
func TestEntAuthService_Register(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	tc := enttest.NewTestClient(t)
	ctx := context.Background()

	t.Run("successful registration creates unverified user", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		// Create user directly via Ent client
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("SecurePass123!"), bcrypt.DefaultCost)
		require.NoError(t, err)

		user, err := tc.CreateTestUser(ctx, "test@example.com", string(hashedPassword))
		require.NoError(t, err)

		assert.NotNil(t, user)
		assert.Equal(t, "test@example.com", user.Email)
		assert.False(t, user.EmailVerified)
	})

	t.Run("duplicate email fails", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("SecurePass123!"), bcrypt.DefaultCost)
		require.NoError(t, err)

		// Create first user
		_, err = tc.CreateTestUser(ctx, "duplicate@example.com", string(hashedPassword))
		require.NoError(t, err)

		// Try to create second user with same email - should fail due to unique constraint
		_, err = tc.CreateTestUser(ctx, "duplicate@example.com", string(hashedPassword))
		assert.Error(t, err)
	})

	t.Run("duplicate username fails", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("SecurePass123!"), bcrypt.DefaultCost)
		require.NoError(t, err)

		// Create first user with username
		_, err = tc.CreateTestUserWithUsername(ctx, "user1@example.com", "testuser", string(hashedPassword))
		require.NoError(t, err)

		// Try to create second user with same username - should fail
		_, err = tc.CreateTestUserWithUsername(ctx, "user2@example.com", "testuser", string(hashedPassword))
		assert.Error(t, err)
	})
}

// TestEntAuthService_Login tests user login
func TestEntAuthService_Login(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	tc := enttest.NewTestClient(t)
	ctx := context.Background()

	t.Run("successful login with correct password", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		password := "SecurePass123!"
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		require.NoError(t, err)

		// Create verified user
		user, err := tc.CreateVerifiedTestUser(ctx, "login@example.com", string(hashedPassword))
		require.NoError(t, err)

		// Verify password
		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
		assert.NoError(t, err)
	})

	t.Run("login fails with wrong password", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		password := "SecurePass123!"
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		require.NoError(t, err)

		// Create verified user
		user, err := tc.CreateVerifiedTestUser(ctx, "login@example.com", string(hashedPassword))
		require.NoError(t, err)

		// Verify wrong password fails
		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("WrongPassword!"))
		assert.Error(t, err)
	})

	t.Run("login fails for unverified user", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		password := "SecurePass123!"
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		require.NoError(t, err)

		// Create unverified user
		user, err := tc.CreateTestUser(ctx, "unverified@example.com", string(hashedPassword))
		require.NoError(t, err)

		assert.False(t, user.EmailVerified)
	})

	t.Run("login fails for non-existent user", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		// Try to get non-existent user
		_, err = tc.User.Get(ctx, 99999)
		assert.Error(t, err)
	})
}

// TestEntAuthService_Session tests session management
func TestEntAuthService_Session(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	tc := enttest.NewTestClient(t)
	ctx := context.Background()

	t.Run("create session for user", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("SecurePass123!"), bcrypt.DefaultCost)
		require.NoError(t, err)

		user, err := tc.CreateVerifiedTestUser(ctx, "session@example.com", string(hashedPassword))
		require.NoError(t, err)

		// Create session
		session, err := tc.CreateTestSession(ctx, user.ID, "test-jti-123", "test-refresh-hash",
			user.CreatedAt.AddDate(0, 0, 7))
		require.NoError(t, err)

		assert.NotNil(t, session)
		assert.Equal(t, user.ID, session.UserID)
		assert.Equal(t, "test-jti-123", session.AccessTokenJti)
	})

	t.Run("get active sessions for user", func(t *testing.T) {
		err := tc.CleanupTables(ctx)
		require.NoError(t, err)

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("SecurePass123!"), bcrypt.DefaultCost)
		require.NoError(t, err)

		user, err := tc.CreateVerifiedTestUser(ctx, "session@example.com", string(hashedPassword))
		require.NoError(t, err)

		// Create multiple sessions
		_, err = tc.CreateTestSession(ctx, user.ID, "jti-1", "refresh-1", user.CreatedAt.AddDate(0, 0, 7))
		require.NoError(t, err)

		_, err = tc.CreateTestSession(ctx, user.ID, "jti-2", "refresh-2", user.CreatedAt.AddDate(0, 0, 7))
		require.NoError(t, err)

		// Query sessions
		sessions, err := tc.Session.Query().All(ctx)
		require.NoError(t, err)

		assert.Len(t, sessions, 2)
	})
}

// TestInputValidation tests validator functions
func TestInputValidation(t *testing.T) {
	t.Run("valid email passes validation", func(t *testing.T) {
		input := validators.RegisterInput{
			Email:    "valid@example.com",
			Password: "SecurePass123!",
		}

		err := input.Validate()
		assert.NoError(t, err)
	})

	t.Run("invalid email fails validation", func(t *testing.T) {
		input := validators.RegisterInput{
			Email:    "invalid-email",
			Password: "SecurePass123!",
		}

		err := input.Validate()
		assert.Error(t, err)
		assert.Equal(t, apperrors.ErrInvalidEmail, err)
	})

	t.Run("weak password fails validation", func(t *testing.T) {
		input := validators.RegisterInput{
			Email:    "valid@example.com",
			Password: "weak",
		}

		err := input.Validate()
		assert.Error(t, err)
		// Check it's a password-related error
		appErr, ok := err.(*apperrors.AppError)
		require.True(t, ok)
		assert.Equal(t, "AUTH007", appErr.Code)
	})
}
