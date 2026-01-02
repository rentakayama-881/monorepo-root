package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"backend-gin/dto"
	"backend-gin/errors"
	"backend-gin/models"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	// TOTPIssuer is the name shown in authenticator apps
	TOTPIssuer = "Alephdraad"
	// BackupCodeCount is the number of backup codes to generate
	BackupCodeCount = 10
	// BackupCodeLength is the length of each backup code
	BackupCodeLength = 8
)

// TOTPService handles TOTP/2FA operations
type TOTPService struct {
	db     *gorm.DB
	logger *zap.Logger
}

// NewTOTPService creates a new TOTP service
func NewTOTPService(db *gorm.DB, logger *zap.Logger) *TOTPService {
	return &TOTPService{
		db:     db,
		logger: logger,
	}
}

// GenerateSetup creates a new TOTP secret for the user
// Returns the secret and QR code URL (does not enable TOTP yet)
func (s *TOTPService) GenerateSetup(userID uint) (*dto.TOTPSetupResponse, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, errors.ErrUserNotFound
	}

	// If TOTP is already enabled, require disabling first
	if user.TOTPEnabled {
		return nil, errors.NewAppError("TOTP_ALREADY_ENABLED", "2FA sudah aktif. Nonaktifkan terlebih dahulu untuk mengatur ulang.", 400)
	}

	// Generate a new TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      TOTPIssuer,
		AccountName: user.Email,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		s.logger.Error("failed to generate TOTP key", zap.Error(err), zap.Uint("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	// Store the secret (not enabled yet - user must verify first)
	if err := s.db.Model(&user).Update("totp_secret", key.Secret()).Error; err != nil {
		s.logger.Error("failed to store TOTP secret", zap.Error(err), zap.Uint("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	s.logger.Info("TOTP setup initiated", zap.Uint("user_id", userID), zap.String("email", user.Email))

	return &dto.TOTPSetupResponse{
		Secret:    key.Secret(),
		QRCodeURL: key.URL(),
		Issuer:    TOTPIssuer,
		Account:   user.Email,
	}, nil
}

// VerifyAndEnable verifies a TOTP code and enables 2FA for the user
// This should be called after GenerateSetup with the first valid code
func (s *TOTPService) VerifyAndEnable(userID uint, code string) error {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return errors.ErrUserNotFound
	}

	// Must have a secret set (from GenerateSetup)
	if user.TOTPSecret == "" {
		return errors.NewAppError("TOTP_NOT_SETUP", "2FA belum diatur. Mulai setup terlebih dahulu.", 400)
	}

	// Verify the code
	valid := totp.Validate(code, user.TOTPSecret)
	if !valid {
		s.logger.Warn("invalid TOTP code during enable", zap.Uint("user_id", userID))
		return errors.NewAppError("TOTP_INVALID_CODE", "Kode tidak valid. Pastikan waktu di perangkat Anda sinkron.", 400)
	}

	// Enable TOTP
	now := time.Now()
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"totp_enabled":     true,
		"totp_verified_at": now,
	}).Error; err != nil {
		s.logger.Error("failed to enable TOTP", zap.Error(err), zap.Uint("user_id", userID))
		return errors.ErrInternalServer
	}

	s.logger.Info("TOTP enabled successfully", zap.Uint("user_id", userID), zap.String("email", user.Email))

	return nil
}

// Verify checks if a TOTP code is valid for the user
func (s *TOTPService) Verify(userID uint, code string) (bool, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return false, errors.ErrUserNotFound
	}

	if !user.TOTPEnabled || user.TOTPSecret == "" {
		return false, errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	valid := totp.Validate(code, user.TOTPSecret)
	if !valid {
		s.logger.Warn("invalid TOTP code", zap.Uint("user_id", userID))
	}

	return valid, nil
}

// Disable disables 2FA for the user after password and TOTP verification
func (s *TOTPService) Disable(userID uint, password, code string, verifyPassword func(hash, password string) bool) error {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return errors.ErrUserNotFound
	}

	if !user.TOTPEnabled {
		return errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	// Verify password
	if !verifyPassword(user.PasswordHash, password) {
		return errors.ErrInvalidCredentials
	}

	// Verify TOTP code
	valid := totp.Validate(code, user.TOTPSecret)
	if !valid {
		return errors.NewAppError("TOTP_INVALID_CODE", "Kode 2FA tidak valid.", 400)
	}

	// Disable TOTP and clear secret
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"totp_enabled":     false,
		"totp_secret":      "",
		"totp_verified_at": nil,
	}).Error; err != nil {
		s.logger.Error("failed to disable TOTP", zap.Error(err), zap.Uint("user_id", userID))
		return errors.ErrInternalServer
	}

	// Delete all backup codes
	if err := s.db.Where("user_id = ?", userID).Delete(&models.BackupCode{}).Error; err != nil {
		s.logger.Error("failed to delete backup codes", zap.Error(err), zap.Uint("user_id", userID))
		// Don't fail the whole operation for this
	}

	s.logger.Info("TOTP disabled successfully", zap.Uint("user_id", userID), zap.String("email", user.Email))

	return nil
}

// GetStatus returns the current TOTP status for a user
func (s *TOTPService) GetStatus(userID uint) (*dto.TOTPStatusResponse, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, errors.ErrUserNotFound
	}

	resp := &dto.TOTPStatusResponse{
		Enabled: user.TOTPEnabled,
	}

	if user.TOTPVerifiedAt != nil {
		t := user.TOTPVerifiedAt.Format(time.RFC3339)
		resp.VerifiedAt = &t
	}

	return resp, nil
}

// GenerateBackupCodes generates new backup codes for the user
// This replaces any existing backup codes
func (s *TOTPService) GenerateBackupCodes(userID uint) (*dto.BackupCodesResponse, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, errors.ErrUserNotFound
	}

	if !user.TOTPEnabled {
		return nil, errors.NewAppError("TOTP_NOT_ENABLED", "Aktifkan 2FA terlebih dahulu sebelum membuat backup codes.", 400)
	}

	// Delete existing backup codes
	if err := s.db.Where("user_id = ?", userID).Delete(&models.BackupCode{}).Error; err != nil {
		s.logger.Error("failed to delete old backup codes", zap.Error(err), zap.Uint("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	// Generate new codes
	codes := make([]string, BackupCodeCount)
	backupCodes := make([]models.BackupCode, BackupCodeCount)

	for i := 0; i < BackupCodeCount; i++ {
		code := generateBackupCode()
		codes[i] = code
		backupCodes[i] = models.BackupCode{
			UserID:   userID,
			CodeHash: hashBackupCode(code),
		}
	}

	// Save hashed codes
	if err := s.db.Create(&backupCodes).Error; err != nil {
		s.logger.Error("failed to save backup codes", zap.Error(err), zap.Uint("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	s.logger.Info("backup codes generated", zap.Uint("user_id", userID), zap.Int("count", BackupCodeCount))

	return &dto.BackupCodesResponse{
		Codes: codes,
	}, nil
}

// VerifyBackupCode verifies and consumes a backup code
// Returns true if the code was valid and consumed
func (s *TOTPService) VerifyBackupCode(userID uint, code string) (bool, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return false, errors.ErrUserNotFound
	}

	if !user.TOTPEnabled {
		return false, errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	// Normalize code (remove spaces/dashes)
	code = normalizeBackupCode(code)
	codeHash := hashBackupCode(code)

	// Find unused backup code
	var backupCode models.BackupCode
	err := s.db.Where("user_id = ? AND code_hash = ? AND used_at IS NULL", userID, codeHash).First(&backupCode).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			s.logger.Warn("invalid backup code attempt", zap.Uint("user_id", userID))
			return false, nil
		}
		return false, errors.ErrInternalServer
	}

	// Mark as used
	now := time.Now()
	if err := s.db.Model(&backupCode).Update("used_at", now).Error; err != nil {
		s.logger.Error("failed to mark backup code as used", zap.Error(err), zap.Uint("user_id", userID))
		return false, errors.ErrInternalServer
	}

	s.logger.Info("backup code used", zap.Uint("user_id", userID), zap.Uint("code_id", backupCode.ID))

	return true, nil
}

// GetBackupCodeCount returns the number of unused backup codes
func (s *TOTPService) GetBackupCodeCount(userID uint) (int64, error) {
	var count int64
	err := s.db.Model(&models.BackupCode{}).
		Where("user_id = ? AND used_at IS NULL", userID).
		Count(&count).Error
	if err != nil {
		return 0, errors.ErrInternalServer
	}
	return count, nil
}

// generateBackupCode generates a random backup code
func generateBackupCode() string {
	bytes := make([]byte, BackupCodeLength/2)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to less secure random if crypto/rand fails
		for i := range bytes {
			bytes[i] = byte(time.Now().UnixNano() % 256)
		}
	}
	// Format as XXXX-XXXX
	code := strings.ToUpper(hex.EncodeToString(bytes))
	return code[:4] + "-" + code[4:]
}

// hashBackupCode hashes a backup code for storage
func hashBackupCode(code string) string {
	code = normalizeBackupCode(code)
	hash := sha256.Sum256([]byte(code))
	return hex.EncodeToString(hash[:])
}

// normalizeBackupCode removes formatting from backup code
func normalizeBackupCode(code string) string {
	code = strings.ToUpper(code)
	code = strings.ReplaceAll(code, "-", "")
	code = strings.ReplaceAll(code, " ", "")
	return code
}

// VerifyByEmail verifies TOTP for a user by email (used in login flow)
func (s *TOTPService) VerifyByEmail(email, code string) (bool, *models.User, error) {
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		return false, nil, errors.ErrUserNotFound
	}

	if !user.TOTPEnabled || user.TOTPSecret == "" {
		return false, nil, errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	valid := totp.Validate(code, user.TOTPSecret)
	if !valid {
		s.logger.Warn("invalid TOTP code during login", zap.String("email", email))
		return false, &user, nil
	}

	return true, &user, nil
}

// VerifyBackupCodeByEmail verifies backup code for a user by email (used in login flow)
func (s *TOTPService) VerifyBackupCodeByEmail(email, code string) (bool, *models.User, error) {
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		return false, nil, errors.ErrUserNotFound
	}

	if !user.TOTPEnabled {
		return false, nil, errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	valid, err := s.VerifyBackupCode(user.ID, code)
	if err != nil {
		return false, &user, err
	}

	return valid, &user, nil
}

