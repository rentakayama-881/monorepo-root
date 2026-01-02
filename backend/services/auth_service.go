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
		// Email exists - check if verified
		if existing.EmailVerified {
			// Sudah verified, tidak boleh register lagi
			return nil, apperrors.ErrEmailAlreadyExists
		} else {
			// Belum verified - hapus user lama dan izinkan register ulang
			logger.Info("Deleting unverified user for re-registration",
				zap.Uint("user_id", existing.ID),
				zap.String("email", email))

			if err := s.deleteUnverifiedUser(&existing); err != nil {
				logger.Warn("Failed to delete unverified user", zap.Error(err), zap.String("email", email))
				// Continue anyway, transaction will handle conflicts
			}
		}
	} else if err != gorm.ErrRecordNotFound {
		logger.Error("Failed to check email existence", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa email")
	}

	// Check if username already exists (if provided)
	if input.Username != nil && *input.Username != "" {
		username := strings.TrimSpace(*input.Username)
		var existingUser models.User
		if err := s.db.Where("name = ?", username).First(&existingUser).Error; err == nil {
			return nil, apperrors.ErrUsernameAlreadyExists
		} else if err != gorm.ErrRecordNotFound {
			logger.Error("Failed to check username existence", zap.Error(err))
			return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa username")
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

	// Use transaction to ensure atomicity
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// Double check email doesn't exist with verified status (race condition protection)
		var checkUser models.User
		if err := tx.Where("email = ? AND email_verified = ?", email, true).First(&checkUser).Error; err == nil {
			return apperrors.ErrEmailAlreadyExists
		}

		// Double check username doesn't exist (if provided)
		if input.Username != nil && *input.Username != "" {
			username := strings.TrimSpace(*input.Username)
			if err := tx.Where("name = ?", username).First(&checkUser).Error; err == nil {
				return apperrors.ErrUsernameAlreadyExists
			}
		}

		// Create user
		if err := tx.Create(&user).Error; err != nil {
			logger.Error("Failed to create user", zap.Error(err), zap.String("email", email))

			// Check if it's a unique constraint violation
			if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
				if strings.Contains(err.Error(), "email") {
					return apperrors.ErrEmailAlreadyExists
				}
				if strings.Contains(err.Error(), "name") || strings.Contains(err.Error(), "username") {
					return apperrors.ErrUsernameAlreadyExists
				}
			}
			return apperrors.ErrDatabase.WithDetails("Gagal mendaftarkan pengguna")
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Create verification token
	token, _, err := s.createVerificationToken(&user)
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
		UserID:               user.ID,
		RequiresVerification: true,
	}, nil
}

// LoginResponse represents login response
type LoginResponse struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int64
	Email        string
	Username     string
	FullName     *string
	RequiresTOTP bool   // True if 2FA is required to complete login
	TOTPPending  string // Temporary token for TOTP verification
}

// LoginWithSession authenticates a user and creates a session with token pair
// If TOTP is enabled, returns RequiresTOTP=true and no tokens
func (s *AuthService) LoginWithSession(input validators.LoginInput, ipAddress, userAgent string) (*LoginResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	email := strings.TrimSpace(strings.ToLower(input.Email))

	// Find user
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Debug("Login attempt for non-existent user", zap.String("email", email))
			return nil, apperrors.ErrInvalidCredentials
		}
		logger.Error("Failed to query user", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa kredensial")
	}

	// Check if account is locked
	var lock models.SessionLock
	if err := s.db.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
		if lock.IsLocked() {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04") + ". Hubungi admin untuk membuka.")
		}
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

	username := ""
	if user.Username != nil {
		username = *user.Username
	}

	// Check if TOTP is enabled - if so, don't issue tokens yet
	if user.IsTOTPEnabled() {
		// Generate a temporary token for TOTP verification step
		pendingToken, err := s.generateTOTPPendingToken(user.ID)
		if err != nil {
			logger.Error("Failed to generate TOTP pending token", zap.Error(err))
			return nil, apperrors.ErrInternalServer
		}

		logger.Info("Login requires TOTP verification",
			zap.Uint("user_id", user.ID),
			zap.String("email", email))

		return &LoginResponse{
			RequiresTOTP: true,
			TOTPPending:  pendingToken,
			Email:        user.Email,
			Username:     username,
			FullName:     user.FullName,
		}, nil
	}

	// Create session with token pair (no TOTP required)
	sessionService := NewSessionService(s.db)
	tokenPair, err := sessionService.CreateSession(&user, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	logger.Info("User logged in successfully",
		zap.Uint("user_id", user.ID),
		zap.String("email", email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        user.Email,
		Username:     username,
		FullName:     user.FullName,
		RequiresTOTP: false,
	}, nil
}

// Login authenticates a user (legacy - for backward compatibility)
func (s *AuthService) Login(input validators.LoginInput) (*LoginResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	email := strings.TrimSpace(strings.ToLower(input.Email))

	// Find user
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Debug("Login attempt for non-existent user", zap.String("email", email))
			return nil, apperrors.ErrInvalidCredentials
		}
		logger.Error("Failed to query user", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa kredensial")
	}

	// Check if account is locked
	var lock models.SessionLock
	if err := s.db.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
		if lock.IsLocked() {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
		}
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

	// Generate JWT (legacy single token)
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
		AccessToken: token,
		Email:       user.Email,
		Username:    username,
		FullName:    user.FullName,
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

// deleteUnverifiedUser deletes an unverified user and their tokens
func (s *AuthService) deleteUnverifiedUser(user *models.User) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Delete all verification tokens for this user
		if err := tx.Where("user_id = ?", user.ID).Delete(&models.EmailVerificationToken{}).Error; err != nil {
			return err
		}
		// Delete the user (hard delete to allow re-registration with same email)
		if err := tx.Unscoped().Delete(user).Error; err != nil {
			return err
		}
		logger.Info("Deleted unverified user and tokens",
			zap.Uint("user_id", user.ID),
			zap.String("email", user.Email))
		return nil
	})
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

// ForgotPasswordResponse represents forgot password response
type ForgotPasswordResponse struct {
	Message string
}

// ForgotPassword sends password reset email
func (s *AuthService) ForgotPassword(email string) (*ForgotPasswordResponse, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	if err := validators.ValidateEmail(email); err != nil {
		return nil, err
	}

	// Find user - but don't reveal if email exists
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		// Don't reveal if email exists or not - still return success
		logger.Debug("Password reset requested for non-existent email", zap.String("email", email))
		return &ForgotPasswordResponse{
			Message: "Jika email terdaftar, tautan reset password telah dikirim.",
		}, nil
	}

	// Create reset token
	raw, err := randomToken()
	if err != nil {
		logger.Error("Failed to generate reset token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	hash := hashToken(raw)
	expires := time.Now().Add(1 * time.Hour) // 1 hour expiry

	resetToken := models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: expires,
	}

	if err := s.db.Create(&resetToken).Error; err != nil {
		logger.Error("Failed to create reset token", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal menyimpan token")
	}

	// Send email
	if err := utils.SendPasswordResetEmail(user.Email, raw); err != nil {
		logger.Warn("Failed to send password reset email", zap.Error(err), zap.String("email", email))
		// Don't fail - still return success to avoid email enumeration
	}

	logger.Info("Password reset requested", zap.String("email", email))

	return &ForgotPasswordResponse{
		Message: "Jika email terdaftar, tautan reset password telah dikirim.",
	}, nil
}

// ResetPassword resets password with token
func (s *AuthService) ResetPassword(token, newPassword string) error {
	// Validate password
	if err := validators.ValidatePassword(newPassword); err != nil {
		return err
	}

	// Find token
	hash := hashToken(token)
	var record models.PasswordResetToken
	if err := s.db.Where("token_hash = ?", hash).First(&record).Error; err != nil {
		logger.Debug("Invalid password reset token")
		return apperrors.ErrInvalidToken
	}

	// Check if already used
	if record.UsedAt != nil {
		return apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan")
	}

	// Check expiration
	if time.Now().After(record.ExpiresAt) {
		return apperrors.ErrTokenExpired.WithDetails("Token reset password sudah kedaluwarsa. Silakan minta ulang.")
	}

	// Find user
	var user models.User
	if err := s.db.First(&user, record.UserID).Error; err != nil {
		logger.Error("User not found for reset token", zap.Uint("user_id", record.UserID))
		return apperrors.ErrUserNotFound
	}

	// Hash new password
	hashPass, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash new password", zap.Error(err))
		return apperrors.ErrInternalServer.WithDetails("Gagal memproses password")
	}

	// Update password and mark token as used
	now := time.Now()
	record.UsedAt = &now
	user.PasswordHash = string(hashPass)

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		logger.Error("Failed to reset password", zap.Error(err), zap.Uint("user_id", user.ID))
		return apperrors.ErrDatabase.WithDetails("Gagal menyimpan password baru")
	}

	logger.Info("Password reset successfully", zap.Uint("user_id", user.ID), zap.String("email", user.Email))

	return nil
}

// TOTP Pending Token functions
// These are short-lived tokens used to verify TOTP after password authentication

const (
	totpPendingTokenLength = 32
	totpPendingTokenExpiry = 5 * time.Minute
)

// TOTPPendingToken stores temporary token for TOTP verification
type TOTPPendingToken struct {
	gorm.Model
	UserID    uint      `gorm:"not null;index"`
	TokenHash string    `gorm:"not null;uniqueIndex"`
	ExpiresAt time.Time `gorm:"not null"`
	UsedAt    *time.Time
}

// generateTOTPPendingToken creates a short-lived token for TOTP verification
func (s *AuthService) generateTOTPPendingToken(userID uint) (string, error) {
	// Generate random token
	tokenBytes := make([]byte, totpPendingTokenLength)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)

	// Hash for storage
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Clean up old pending tokens for this user
	_ = s.db.Where("user_id = ?", userID).Delete(&TOTPPendingToken{})

	// Save pending token
	pending := TOTPPendingToken{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(totpPendingTokenExpiry),
	}
	if err := s.db.Create(&pending).Error; err != nil {
		return "", err
	}

	return token, nil
}

// validateTOTPPendingToken validates and consumes a TOTP pending token
func (s *AuthService) validateTOTPPendingToken(token string) (*models.User, error) {
	// Hash the token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Find the pending token
	var pending TOTPPendingToken
	if err := s.db.Where("token_hash = ?", tokenHash).First(&pending).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.ErrInvalidToken.WithDetails("Token tidak valid atau sudah expired")
		}
		return nil, apperrors.ErrDatabase
	}

	// Check if already used
	if pending.UsedAt != nil {
		return nil, apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan")
	}

	// Check expiration
	if time.Now().After(pending.ExpiresAt) {
		return nil, apperrors.ErrTokenExpired.WithDetails("Token sudah expired. Silakan login ulang.")
	}

	// Mark as used
	now := time.Now()
	if err := s.db.Model(&pending).Update("used_at", now).Error; err != nil {
		logger.Error("Failed to mark pending token as used", zap.Error(err))
	}

	// Get user
	var user models.User
	if err := s.db.First(&user, pending.UserID).Error; err != nil {
		return nil, apperrors.ErrUserNotFound
	}

	return &user, nil
}

// CompleteTOTPLogin completes login after TOTP verification
func (s *AuthService) CompleteTOTPLogin(pendingToken, totpCode string, ipAddress, userAgent string) (*LoginResponse, error) {
	// Validate pending token and get user
	user, err := s.validateTOTPPendingToken(pendingToken)
	if err != nil {
		return nil, err
	}

	// Verify TOTP is still enabled (in case it was disabled between steps)
	if !user.IsTOTPEnabled() {
		return nil, apperrors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak lagi aktif. Silakan login ulang.", 400)
	}

	// Check if account is locked
	var lock models.SessionLock
	if err := s.db.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
		if lock.IsLocked() {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
		}
	}

	// Initialize TOTP service and verify code
	totpService := NewTOTPService(s.db, logger.GetLogger())
	valid, err := totpService.Verify(user.ID, totpCode)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, apperrors.NewAppError("TOTP_INVALID_CODE", "Kode 2FA tidak valid", 401)
	}

	// Create session with token pair
	sessionService := NewSessionService(s.db)
	tokenPair, err := sessionService.CreateSession(user, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	username := ""
	if user.Username != nil {
		username = *user.Username
	}

	logger.Info("User completed TOTP login",
		zap.Uint("user_id", user.ID),
		zap.String("email", user.Email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        user.Email,
		Username:     username,
		FullName:     user.FullName,
		RequiresTOTP: false,
	}, nil
}

// CompleteTOTPLoginWithBackupCode completes login using a backup code
func (s *AuthService) CompleteTOTPLoginWithBackupCode(pendingToken, backupCode string, ipAddress, userAgent string) (*LoginResponse, error) {
	// Validate pending token and get user
	user, err := s.validateTOTPPendingToken(pendingToken)
	if err != nil {
		return nil, err
	}

	// Verify TOTP is still enabled
	if !user.IsTOTPEnabled() {
		return nil, apperrors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak lagi aktif. Silakan login ulang.", 400)
	}

	// Check if account is locked
	var lock models.SessionLock
	if err := s.db.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
		if lock.IsLocked() {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
		}
	}

	// Initialize TOTP service and verify backup code
	totpService := NewTOTPService(s.db, logger.GetLogger())
	valid, err := totpService.VerifyBackupCode(user.ID, backupCode)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, apperrors.NewAppError("BACKUP_CODE_INVALID", "Backup code tidak valid", 401)
	}

	// Create session with token pair
	sessionService := NewSessionService(s.db)
	tokenPair, err := sessionService.CreateSession(user, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	username := ""
	if user.Username != nil {
		username = *user.Username
	}

	logger.Info("User completed login with backup code",
		zap.Uint("user_id", user.ID),
		zap.String("email", user.Email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        user.Email,
		Username:     username,
		FullName:     user.FullName,
		RequiresTOTP: false,
	}, nil
}
