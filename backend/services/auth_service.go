package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/models"
	"backend-gin/utils"
	"backend-gin/validators"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService handles authentication business logic
type AuthService struct {
	db *gorm.DB
}

// NewAuthService creates a new auth service
func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{db: db}
}

// RegisterResponse represents registration response
type RegisterResponse struct {
	Message              string
	DevToken             string
	DevLink              string
	UserID               uint
	RequiresVerification bool
}

// Register registers a new user
func (s *AuthService) Register(input validators.RegisterInput) (*RegisterResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Normalize email
	email := strings.TrimSpace(strings.ToLower(input.Email))
	password := strings.TrimSpace(input.Password)

	// Check if email already exists
	var existing models.User
	if err := s.db.Where("email = ?", email).First(&existing).Error; err == nil {
		return nil, apperrors.ErrEmailAlreadyExists
	}

	// Check if username already exists
	if input.Username != nil {
		username := strings.TrimSpace(*input.Username)
		if username != "" {
			var count int64
			s.db.Model(&models.User{}).Where("name = ?", username).Count(&count)
			if count > 0 {
				return nil, apperrors.ErrUsernameAlreadyExists
			}
		}
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash password", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal memproses password")
	}

	// Create user
	user := models.User{
		Email:         email,
		PasswordHash:  string(hash),
		EmailVerified: false,
		AvatarURL:     "",
	}
	if input.Username != nil {
		user.Username = input.Username
	}
	if input.FullName != nil {
		user.FullName = input.FullName
	}

	if err := s.db.Create(&user).Error; err != nil {
		logger.Error("Failed to create user", zap.Error(err), zap.String("email", email))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal mendaftarkan pengguna")
	}

	// Create verification token
	token, link, err := s.createVerificationToken(&user)
	if err != nil {
		logger.Error("Failed to create verification token", zap.Error(err), zap.Uint("user_id", user.ID))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token verifikasi")
	}

	// Send verification email
	if err := utils.SendVerificationEmail(user.Email, token); err != nil {
		logger.Warn("Failed to send verification email", zap.Error(err), zap.String("email", email))
		// Don't fail registration if email fails
	}

	logger.Info("User registered successfully",
		zap.Uint("user_id", user.ID),
		zap.String("email", email))

	return &RegisterResponse{
		Message:              "Registrasi berhasil. Silakan verifikasi email Anda.",
		DevToken:             token,
		DevLink:              link,
		UserID:               user.ID,
		RequiresVerification: true,
	}, nil
}

// LoginResponse represents login response
type LoginResponse struct {
	Token    string
	Email    string
	Username string
	FullName *string
}

// Login authenticates a user
func (s *AuthService) Login(input validators.LoginInput) (*LoginResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	email := strings.TrimSpace(strings.ToLower(input.Email))

	// Find user
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		logger.Debug("Login attempt for non-existent user", zap.String("email", email))
		return nil, apperrors.ErrInvalidCredentials
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		logger.Debug("Invalid password attempt", zap.String("email", email))
		return nil, apperrors.ErrInvalidCredentials
	}

	// Check email verification
	if !user.EmailVerified {
		return nil, apperrors.ErrEmailNotVerified
	}

	// Generate JWT
	token, err := middleware.GenerateJWT(user.Email, 24*time.Hour)
	if err != nil {
		logger.Error("Failed to generate JWT", zap.Error(err), zap.Uint("user_id", user.ID))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	username := ""
	if user.Username != nil {
		username = *user.Username
	}

	logger.Info("User logged in successfully",
		zap.Uint("user_id", user.ID),
		zap.String("email", email))

	return &LoginResponse{
		Token:    token,
		Email:    user.Email,
		Username: username,
		FullName: user.FullName,
	}, nil
}

// RequestVerification requests a new verification email
func (s *AuthService) RequestVerification(email string) (string, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	if err := validators.ValidateEmail(email); err != nil {
		return "", "", err
	}

	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		// Don't reveal if email exists or not
		logger.Debug("Verification requested for non-existent email", zap.String("email", email))
		return "", "", nil
	}

	token, link, err := s.createVerificationToken(&user)
	if err != nil {
		logger.Error("Failed to create verification token", zap.Error(err))
		return "", "", apperrors.ErrInternalServer.WithDetails("Gagal membuat token verifikasi")
	}

	if err := utils.SendVerificationEmail(user.Email, token); err != nil {
		logger.Warn("Failed to send verification email", zap.Error(err))
	}

	return token, link, nil
}

// ConfirmVerification confirms email verification
func (s *AuthService) ConfirmVerification(input validators.VerifyTokenInput) error {
	if err := input.Validate(); err != nil {
		return err
	}

	hash := hashToken(input.Token)
	var record models.EmailVerificationToken
	if err := s.db.Where("token_hash = ?", hash).First(&record).Error; err != nil {
		logger.Debug("Invalid verification token", zap.String("token_hash", hash[:8]))
		return apperrors.ErrInvalidToken
	}

	// Check if already used
	if record.UsedAt != nil {
		return apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan")
	}

	// Check expiration
	if time.Now().After(record.ExpiresAt) {
		return apperrors.ErrTokenExpired
	}

	// Find user
	var user models.User
	if err := s.db.First(&user, record.UserID).Error; err != nil {
		logger.Error("User not found for verification token", zap.Uint("user_id", record.UserID))
		return apperrors.ErrUserNotFound
	}

	// Mark as verified
	now := time.Now()
	record.UsedAt = &now
	user.EmailVerified = true

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		logger.Error("Failed to verify email", zap.Error(err), zap.Uint("user_id", user.ID))
		return apperrors.ErrDatabase.WithDetails("Gagal memperbarui status verifikasi")
	}

	logger.Info("Email verified successfully",
		zap.Uint("user_id", user.ID),
		zap.String("email", user.Email))

	return nil
}

// createVerificationToken creates a verification token for a user
func (s *AuthService) createVerificationToken(user *models.User) (string, string, error) {
	raw, err := randomToken()
	if err != nil {
		return "", "", err
	}
	hash := hashToken(raw)
	expires := time.Now().Add(24 * time.Hour)

	token := models.EmailVerificationToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: expires,
	}
	if err := s.db.Create(&token).Error; err != nil {
		return "", "", err
	}

	frontend := strings.TrimSuffix(utils.GetEnv("FRONTEND_BASE_URL", "http://localhost:3000"), "/")
	link := frontend + "/verify-email?token=" + raw

	return raw, link, nil
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
