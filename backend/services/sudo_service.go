package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"backend-gin/models"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SudoTTL is how long a sudo session lasts (15 minutes)
const SudoTTL = 15 * time.Minute

// SudoService handles sudo mode operations
type SudoService struct {
	db          *gorm.DB
	logger      *zap.Logger
	totpService *TOTPService
}

// NewSudoService creates a new SudoService
func NewSudoService(db *gorm.DB, logger *zap.Logger, totpService *TOTPService) *SudoService {
	return &SudoService{
		db:          db,
		logger:      logger,
		totpService: totpService,
	}
}

// SudoVerifyInput contains the data needed for sudo verification
type SudoVerifyInput struct {
	UserID     uint
	Password   string
	TOTPCode   string // Optional if TOTP not enabled
	BackupCode string // Alternative to TOTP code
	IPAddress  string
	UserAgent  string
}

// SudoVerifyResult contains the result of sudo verification
type SudoVerifyResult struct {
	SudoToken string    `json:"sudo_token"`
	ExpiresAt time.Time `json:"expires_at"`
	ExpiresIn int64     `json:"expires_in"` // seconds
}

// Verify verifies password + TOTP (if enabled) and creates a sudo session
func (s *SudoService) Verify(input SudoVerifyInput) (*SudoVerifyResult, error) {
	// Get user
	var user models.User
	if err := s.db.First(&user, input.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		s.logger.Debug("Sudo: invalid password",
			zap.Uint("user_id", input.UserID))
		return nil, errors.New("password tidak valid")
	}

	// If TOTP is enabled, verify TOTP code
	if user.IsTOTPEnabled() {
		if input.BackupCode != "" {
			// Try backup code
			valid, err := s.totpService.VerifyBackupCode(input.UserID, input.BackupCode)
			if err != nil {
				s.logger.Error("Sudo: failed to verify backup code", zap.Error(err))
				return nil, errors.New("gagal memverifikasi backup code")
			}
			if !valid {
				return nil, errors.New("backup code tidak valid")
			}
		} else if input.TOTPCode != "" {
			// Verify TOTP code
			valid, err := s.totpService.Verify(input.UserID, input.TOTPCode)
			if err != nil {
				s.logger.Error("Sudo: failed to verify TOTP", zap.Error(err))
				return nil, errors.New("gagal memverifikasi kode 2FA")
			}
			if !valid {
				return nil, errors.New("kode 2FA tidak valid")
			}
		} else {
			return nil, errors.New("kode 2FA diperlukan")
		}
	}

	// Generate sudo token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		s.logger.Error("Sudo: failed to generate token", zap.Error(err))
		return nil, errors.New("gagal membuat sesi sudo")
	}
	token := hex.EncodeToString(tokenBytes)

	// Hash token for storage
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Create sudo session
	expiresAt := time.Now().Add(SudoTTL)
	session := &models.SudoSession{
		UserID:    input.UserID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		IPAddress: input.IPAddress,
		UserAgent: input.UserAgent,
	}

	if err := s.db.Create(session).Error; err != nil {
		s.logger.Error("Sudo: failed to create session", zap.Error(err))
		return nil, errors.New("gagal membuat sesi sudo")
	}

	// Clean up expired sessions for this user
	go s.cleanupExpiredSessions(input.UserID)

	s.logger.Info("Sudo session created",
		zap.Uint("user_id", input.UserID),
		zap.Time("expires_at", expiresAt))

	return &SudoVerifyResult{
		SudoToken: token,
		ExpiresAt: expiresAt,
		ExpiresIn: int64(SudoTTL.Seconds()),
	}, nil
}

// ValidateToken validates a sudo token and returns if it's valid
func (s *SudoService) ValidateToken(userID uint, token string) (bool, error) {
	if token == "" {
		return false, nil
	}

	// Hash the provided token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Find valid session
	var session models.SudoSession
	err := s.db.Where(
		"user_id = ? AND token_hash = ? AND expires_at > ? AND deleted_at IS NULL",
		userID, tokenHash, time.Now(),
	).First(&session).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// GetStatus returns the sudo status for a user
func (s *SudoService) GetStatus(userID uint, token string) (*SudoStatusResult, error) {
	// Check if user has TOTP enabled
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	result := &SudoStatusResult{
		RequiresTOTP: user.IsTOTPEnabled(),
	}

	// If token provided, check if still valid
	if token != "" {
		valid, err := s.ValidateToken(userID, token)
		if err != nil {
			s.logger.Warn("Failed to validate sudo token", zap.Error(err))
		}
		result.IsActive = valid

		if valid {
			// Get expiry time
			hash := sha256.Sum256([]byte(token))
			tokenHash := hex.EncodeToString(hash[:])

			var session models.SudoSession
			if err := s.db.Where("user_id = ? AND token_hash = ?", userID, tokenHash).First(&session).Error; err == nil {
				result.ExpiresAt = &session.ExpiresAt
				remaining := time.Until(session.ExpiresAt).Seconds()
				if remaining > 0 {
					result.ExpiresIn = int64(remaining)
				}
			}
		}
	}

	return result, nil
}

// SudoStatusResult contains the sudo status
type SudoStatusResult struct {
	IsActive     bool       `json:"is_active"`
	RequiresTOTP bool       `json:"requires_totp"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	ExpiresIn    int64      `json:"expires_in,omitempty"` // seconds remaining
}

// RevokeToken revokes a sudo token
func (s *SudoService) RevokeToken(userID uint, token string) error {
	if token == "" {
		return nil
	}

	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	return s.db.Where("user_id = ? AND token_hash = ?", userID, tokenHash).Delete(&models.SudoSession{}).Error
}

// RevokeAllSessions revokes all sudo sessions for a user
func (s *SudoService) RevokeAllSessions(userID uint) error {
	return s.db.Where("user_id = ?", userID).Delete(&models.SudoSession{}).Error
}

// cleanupExpiredSessions removes expired sudo sessions
func (s *SudoService) cleanupExpiredSessions(userID uint) {
	s.db.Where("user_id = ? AND expires_at < ?", userID, time.Now()).Delete(&models.SudoSession{})
}

// ExtendSession extends a valid sudo session by another SudoTTL
func (s *SudoService) ExtendSession(userID uint, token string) (*SudoVerifyResult, error) {
	valid, err := s.ValidateToken(userID, token)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, errors.New("sesi sudo tidak valid atau sudah kadaluarsa")
	}

	// Update expiry
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])
	newExpiresAt := time.Now().Add(SudoTTL)

	if err := s.db.Model(&models.SudoSession{}).
		Where("user_id = ? AND token_hash = ?", userID, tokenHash).
		Update("expires_at", newExpiresAt).Error; err != nil {
		return nil, err
	}

	return &SudoVerifyResult{
		SudoToken: token,
		ExpiresAt: newExpiresAt,
		ExpiresIn: int64(SudoTTL.Seconds()),
	}, nil
}
