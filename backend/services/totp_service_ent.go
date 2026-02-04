package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/ent"
	"backend-gin/ent/backupcode"
	"backend-gin/errors"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	"go.uber.org/zap"
)

// EntTOTPService handles TOTP/2FA operations using Ent ORM
type EntTOTPService struct {
	client *ent.Client
	logger *zap.Logger
}

// NewEntTOTPService creates a new TOTP service with Ent
func NewEntTOTPService(logger *zap.Logger) *EntTOTPService {
	return &EntTOTPService{
		client: database.GetEntClient(),
		logger: logger,
	}
}

// GenerateSetup creates a new TOTP secret for the user
func (s *EntTOTPService) GenerateSetup(ctx context.Context, userID int) (*dto.TOTPSetupResponse, error) {
	u, err := s.client.User.Get(ctx, userID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errors.ErrUserNotFound
		}
		return nil, errors.ErrDatabase
	}

	// If TOTP is already enabled, require disabling first
	if u.TotpEnabled {
		return nil, errors.NewAppError("TOTP_ALREADY_ENABLED", "2FA sudah aktif. Nonaktifkan terlebih dahulu untuk mengatur ulang.", 400)
	}

	// Generate a new TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      TOTPIssuer,
		AccountName: u.Email,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		s.logger.Error("failed to generate TOTP key", zap.Error(err), zap.Int("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	// Store the secret (not enabled yet - user must verify first)
	_, err = s.client.User.
		UpdateOneID(userID).
		SetTotpSecret(key.Secret()).
		Save(ctx)
	if err != nil {
		s.logger.Error("failed to store TOTP secret", zap.Error(err), zap.Int("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	s.logger.Info("TOTP setup initiated", zap.Int("user_id", userID), zap.String("email", u.Email))

	return &dto.TOTPSetupResponse{
		Secret:    key.Secret(),
		QRCodeURL: key.URL(),
		Issuer:    TOTPIssuer,
		Account:   u.Email,
	}, nil
}

// VerifyAndEnable verifies a TOTP code, enables 2FA, and generates backup codes
// Returns backup codes that should be shown to user ONLY ONCE
func (s *EntTOTPService) VerifyAndEnable(ctx context.Context, userID int, code string) ([]string, error) {
	u, err := s.client.User.Get(ctx, userID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, errors.ErrUserNotFound
		}
		return nil, errors.ErrDatabase
	}

	// Must have a secret set
	if u.TotpSecret == nil || *u.TotpSecret == "" {
		return nil, errors.NewAppError("TOTP_NOT_SETUP", "2FA belum diatur. Mulai setup terlebih dahulu.", 400)
	}

	// Verify the code
	valid := totp.Validate(code, *u.TotpSecret)
	if !valid {
		s.logger.Warn("invalid TOTP code during enable", zap.Int("user_id", userID))
		return nil, errors.NewAppError("TOTP_INVALID_CODE", "Kode tidak valid. Pastikan waktu di perangkat Anda sinkron.", 400)
	}

	// Enable TOTP
	now := time.Now()
	_, err = s.client.User.
		UpdateOneID(userID).
		SetTotpEnabled(true).
		SetTotpVerified(true).
		SetTotpVerifiedAt(now).
		Save(ctx)
	if err != nil {
		s.logger.Error("failed to enable TOTP", zap.Error(err), zap.Int("user_id", userID))
		return nil, errors.ErrInternalServer
	}

	// Generate backup codes (only generated once during enable)
	backupCodes, err := s.generateBackupCodesInternal(ctx, userID)
	if err != nil {
		s.logger.Error("failed to generate backup codes during TOTP enable", zap.Error(err), zap.Int("user_id", userID))
		// TOTP is already enabled, so we continue but log the error
		// User can contact support if they need backup codes
	}

	s.logger.Info("TOTP enabled successfully with backup codes", zap.Int("user_id", userID), zap.String("email", u.Email))
	return backupCodes, nil
}

// Verify checks if a TOTP code is valid for the user
func (s *EntTOTPService) Verify(ctx context.Context, userID int, code string) (bool, error) {
	u, err := s.client.User.Get(ctx, userID)
	if err != nil {
		if ent.IsNotFound(err) {
			return false, errors.ErrUserNotFound
		}
		return false, errors.ErrDatabase
	}

	if !u.TotpEnabled || u.TotpSecret == nil || *u.TotpSecret == "" {
		return false, errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	valid := totp.Validate(code, *u.TotpSecret)
	if !valid {
		s.logger.Warn("invalid TOTP code", zap.Int("user_id", userID))
	}

	return valid, nil
}

// Disable disables 2FA for the user after verification
func (s *EntTOTPService) Disable(ctx context.Context, userID int, password, code string, verifyPassword func(hash, password string) bool) error {
	u, err := s.client.User.Get(ctx, userID)
	if err != nil {
		if ent.IsNotFound(err) {
			return errors.ErrUserNotFound
		}
		return errors.ErrDatabase
	}

	if !u.TotpEnabled {
		return errors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif untuk akun ini.", 400)
	}

	// Verify password
	if !verifyPassword(u.PasswordHash, password) {
		s.logger.Warn("TOTP disable: invalid password", zap.Int("user_id", userID))
		return errors.NewAppError("INVALID_PASSWORD", "Password tidak valid.", 401)
	}

	// Verify TOTP code
	if u.TotpSecret != nil && *u.TotpSecret != "" {
		valid := totp.Validate(code, *u.TotpSecret)
		if !valid {
			s.logger.Warn("TOTP disable: invalid code", zap.Int("user_id", userID))
			return errors.NewAppError("TOTP_INVALID_CODE", "Kode 2FA tidak valid.", 400)
		}
	}

	// Disable TOTP and clear secret
	_, err = s.client.User.
		UpdateOneID(userID).
		SetTotpEnabled(false).
		SetTotpVerified(false).
		ClearTotpSecret().
		ClearTotpVerifiedAt().
		Save(ctx)
	if err != nil {
		s.logger.Error("failed to disable TOTP", zap.Error(err), zap.Int("user_id", userID))
		return errors.ErrInternalServer
	}

	// Delete backup codes
	_, _ = s.client.BackupCode.
		Delete().
		Where(backupcode.UserIDEQ(userID)).
		Exec(ctx)

	s.logger.Info("TOTP disabled successfully", zap.Int("user_id", userID))
	return nil
}

// normalizeBackupCode removes dashes, spaces and uppercases the code
func normalizeBackupCode(code string) string {
	code = strings.TrimSpace(code)
	code = strings.ReplaceAll(code, "-", "")
	code = strings.ReplaceAll(code, " ", "")
	return strings.ToUpper(code)
}

// generateBackupCodesInternal generates backup codes (internal use only)
func (s *EntTOTPService) generateBackupCodesInternal(ctx context.Context, userID int) ([]string, error) {
	// Delete existing backup codes
	_, _ = s.client.BackupCode.
		Delete().
		Where(backupcode.UserIDEQ(userID)).
		Exec(ctx)

	// Generate new backup codes
	codes := make([]string, BackupCodeCount)
	for i := 0; i < BackupCodeCount; i++ {
		code := generateBackupCode()
		codes[i] = code

		// IMPORTANT: Normalize code BEFORE hashing to match verification
		normalizedCode := normalizeBackupCode(code)
		hash := sha256.Sum256([]byte(normalizedCode))
		codeHash := hex.EncodeToString(hash[:])

		_, err := s.client.BackupCode.
			Create().
			SetUserID(userID).
			SetCodeHash(codeHash).
			Save(ctx)
		if err != nil {
			s.logger.Error("failed to save backup code", zap.Error(err), zap.Int("user_id", userID))
			return nil, errors.ErrInternalServer
		}
	}

	s.logger.Info("Backup codes generated", zap.Int("user_id", userID), zap.Int("count", BackupCodeCount))
	return codes, nil
}

// GenerateBackupCodes is DEPRECATED - backup codes are now only generated during TOTP enable
// This function is kept for backward compatibility but returns an error
func (s *EntTOTPService) GenerateBackupCodes(ctx context.Context, userID int) ([]string, error) {
	return nil, errors.NewAppError("BACKUP_CODES_NOT_REGENERATABLE", "Backup codes hanya dibuat saat mengaktifkan 2FA. Untuk mendapatkan backup codes baru, nonaktifkan dan aktifkan kembali 2FA.", 400)
}

// VerifyBackupCode verifies and consumes a backup code
func (s *EntTOTPService) VerifyBackupCode(ctx context.Context, userID int, code string) (bool, error) {
	// Normalize the input code
	normalizedCode := normalizeBackupCode(code)

	// Hash the normalized code (current format)
	hash := sha256.Sum256([]byte(normalizedCode))
	codeHash := hex.EncodeToString(hash[:])

	// Backward-compatible: older versions mistakenly hashed the displayed format ("XXXX-XXXX") directly.
	// Keep accepting it so existing backup codes remain usable after upgrades.
	codeHashes := []string{codeHash}
	if len(normalizedCode) == BackupCodeLength*2 {
		legacyFormat := normalizedCode[:BackupCodeLength] + "-" + normalizedCode[BackupCodeLength:]
		legacyHash := sha256.Sum256([]byte(legacyFormat))
		legacyCodeHash := hex.EncodeToString(legacyHash[:])
		if legacyCodeHash != codeHash {
			codeHashes = append(codeHashes, legacyCodeHash)
		}
	}

	// Find unused backup code
	bc, err := s.client.BackupCode.
		Query().
		Where(
			backupcode.UserIDEQ(userID),
			backupcode.CodeHashIn(codeHashes...),
			// Backward-compatible: older rows were mistakenly created with UsedAt set to zero time instead of NULL.
			backupcode.Or(
				backupcode.UsedAtIsNil(),
				backupcode.UsedAtEQ(time.Time{}),
			),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			s.logger.Warn("Invalid or used backup code attempt", zap.Int("user_id", userID))
			return false, nil
		}
		return false, errors.ErrDatabase
	}

	// Mark as used
	now := time.Now()
	_, err = s.client.BackupCode.
		UpdateOneID(bc.ID).
		SetUsedAt(now).
		Save(ctx)
	if err != nil {
		s.logger.Error("Failed to mark backup code as used", zap.Error(err))
	}

	s.logger.Info("Backup code used successfully", zap.Int("user_id", userID))
	return true, nil
}

// GetBackupCodeStatus returns the count of remaining backup codes
func (s *EntTOTPService) GetBackupCodeStatus(ctx context.Context, userID int) (int, int, error) {
	total, err := s.client.BackupCode.
		Query().
		Where(backupcode.UserIDEQ(userID)).
		Count(ctx)
	if err != nil {
		return 0, 0, errors.ErrDatabase
	}

	used, err := s.client.BackupCode.
		Query().
		Where(
			backupcode.UserIDEQ(userID),
			backupcode.UsedAtNotNil(),
			backupcode.UsedAtNEQ(time.Time{}),
		).
		Count(ctx)
	if err != nil {
		return 0, 0, errors.ErrDatabase
	}

	return total - used, total, nil
}
