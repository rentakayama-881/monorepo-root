package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/sudosession"
	apperrors "backend-gin/errors"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// EntSudoService handles sudo mode operations using Ent ORM
type EntSudoService struct {
	client      *ent.Client
	logger      *zap.Logger
	totpService *EntTOTPService
}

// NewEntSudoService creates a new SudoService with Ent
func NewEntSudoService(logger *zap.Logger, totpService *EntTOTPService) *EntSudoService {
	return &EntSudoService{
		client:      database.GetEntClient(),
		logger:      logger,
		totpService: totpService,
	}
}

// EntSudoVerifyInput contains the data needed for sudo verification
type EntSudoVerifyInput struct {
	UserID     int
	Password   string
	TOTPCode   string // Optional if TOTP not enabled
	BackupCode string // Alternative to TOTP code
	IPAddress  string
	UserAgent  string
}

// Verify verifies password + TOTP (if enabled) and creates a sudo session
func (s *EntSudoService) Verify(ctx context.Context, input EntSudoVerifyInput) (*SudoVerifyResult, error) {
	// Get user
	u, err := s.client.User.Get(ctx, input.UserID)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.Password)); err != nil {
		s.logger.Debug("Sudo: invalid password",
			zap.Int("user_id", input.UserID))
		return nil, apperrors.NewAppError("INVALID_PASSWORD", "Password tidak valid", 401)
	}

	// If TOTP is enabled, verify TOTP code
	totpEnabled := u.TotpEnabled && u.TotpSecret != nil && *u.TotpSecret != ""
	if totpEnabled {
		if input.BackupCode != "" {
			// Try backup code
			valid, err := s.totpService.VerifyBackupCode(ctx, input.UserID, input.BackupCode)
			if err != nil {
				s.logger.Error("Sudo: failed to verify backup code", zap.Error(err))
				return nil, apperrors.NewAppError("BACKUP_CODE_ERROR", "Gagal memverifikasi backup code", 500)
			}
			if !valid {
				return nil, apperrors.NewAppError("INVALID_BACKUP_CODE", "Backup code tidak valid", 401)
			}
		} else if input.TOTPCode != "" {
			// Verify TOTP code
			valid, err := s.totpService.Verify(ctx, input.UserID, input.TOTPCode)
			if err != nil {
				s.logger.Error("Sudo: failed to verify TOTP", zap.Error(err))
				return nil, apperrors.NewAppError("TOTP_ERROR", "Gagal memverifikasi kode 2FA", 500)
			}
			if !valid {
				return nil, apperrors.NewAppError("INVALID_TOTP", "Kode 2FA tidak valid", 401)
			}
		} else {
			return nil, apperrors.NewAppError("TOTP_REQUIRED", "Kode 2FA diperlukan", 400)
		}
	}

	// Generate sudo token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		s.logger.Error("Sudo: failed to generate token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat sesi sudo")
	}
	token := hex.EncodeToString(tokenBytes)

	// Hash token for storage
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Create sudo session
	expiresAt := time.Now().Add(SudoTTL)
	_, err = s.client.SudoSession.
		Create().
		SetUserID(input.UserID).
		SetTokenHash(tokenHash).
		SetExpiresAt(expiresAt).
		SetIPAddress(input.IPAddress).
		SetUserAgent(input.UserAgent).
		Save(ctx)
	if err != nil {
		s.logger.Error("Sudo: failed to create session", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat sesi sudo")
	}

	// Clean up expired sessions for this user
	go s.cleanupExpiredSessions(ctx, input.UserID)

	s.logger.Info("Sudo session created",
		zap.Int("user_id", input.UserID),
		zap.Time("expires_at", expiresAt))

	return &SudoVerifyResult{
		SudoToken: token,
		ExpiresAt: expiresAt,
		ExpiresIn: int64(SudoTTL.Seconds()),
	}, nil
}

// ValidateToken validates a sudo token and returns if it's valid
func (s *EntSudoService) ValidateToken(ctx context.Context, userID int, token string) (bool, error) {
	if token == "" {
		return false, nil
	}

	// Hash the provided token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Find valid session
	session, err := s.client.SudoSession.
		Query().
		Where(
			sudosession.UserIDEQ(userID),
			sudosession.TokenHashEQ(tokenHash),
			sudosession.ExpiresAtGT(time.Now()),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return false, nil
		}
		return false, apperrors.ErrDatabase
	}

	// Update last used time
	_, _ = s.client.SudoSession.
		UpdateOneID(session.ID).
		SetLastUsedAt(time.Now()).
		Save(ctx)

	return true, nil
}

// Revoke invalidates a sudo token
func (s *EntSudoService) Revoke(ctx context.Context, userID int, token string) error {
	if token == "" {
		return nil
	}

	// Hash the provided token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Delete the session
	_, err := s.client.SudoSession.
		Delete().
		Where(
			sudosession.UserIDEQ(userID),
			sudosession.TokenHashEQ(tokenHash),
		).
		Exec(ctx)

	return err
}

// RevokeAll revokes all sudo sessions for a user
func (s *EntSudoService) RevokeAll(ctx context.Context, userID int) error {
	_, err := s.client.SudoSession.
		Delete().
		Where(sudosession.UserIDEQ(userID)).
		Exec(ctx)
	return err
}

// CheckUserTOTPEnabled checks if the user has TOTP enabled
func (s *EntSudoService) CheckUserTOTPEnabled(ctx context.Context, userID int) (bool, error) {
	u, err := s.client.User.Get(ctx, userID)
	if err != nil {
		if ent.IsNotFound(err) {
			return false, nil
		}
		return false, err
	}
	return u.TotpEnabled && u.TotpSecret != nil && *u.TotpSecret != "", nil
}

// GetActiveSession returns info about the current sudo session
func (s *EntSudoService) GetActiveSession(ctx context.Context, userID int, token string) (*SudoVerifyResult, error) {
	if token == "" {
		return nil, nil
	}

	// Hash the provided token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Find valid session
	session, err := s.client.SudoSession.
		Query().
		Where(
			sudosession.UserIDEQ(userID),
			sudosession.TokenHashEQ(tokenHash),
			sudosession.ExpiresAtGT(time.Now()),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, apperrors.ErrDatabase
	}

	return &SudoVerifyResult{
		SudoToken: token,
		ExpiresAt: session.ExpiresAt,
		ExpiresIn: int64(time.Until(session.ExpiresAt).Seconds()),
	}, nil
}

// cleanupExpiredSessions removes expired sudo sessions for a user
func (s *EntSudoService) cleanupExpiredSessions(ctx context.Context, userID int) {
	deleted, err := s.client.SudoSession.
		Delete().
		Where(
			sudosession.UserIDEQ(userID),
			sudosession.ExpiresAtLT(time.Now()),
		).
		Exec(ctx)
	if err != nil {
		s.logger.Error("Failed to cleanup expired sudo sessions", zap.Error(err))
	} else if deleted > 0 {
		s.logger.Debug("Cleaned up expired sudo sessions",
			zap.Int("user_id", userID),
			zap.Int("deleted", deleted))
	}
}

// ExtendSession extends a valid sudo session by SudoTTL
func (s *EntSudoService) ExtendSession(ctx context.Context, userID int, token string) (*SudoVerifyResult, error) {
	if token == "" {
		return nil, apperrors.NewAppError("SUDO_TOKEN_REQUIRED", "Sudo token diperlukan", 400)
	}
	// Hash provided token
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Find session
	sess, err := s.client.SudoSession.
		Query().
		Where(
			sudosession.UserIDEQ(userID),
			sudosession.TokenHashEQ(tokenHash),
			sudosession.ExpiresAtGT(time.Now()),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.NewAppError("SUDO_SESSION_INVALID", "Sesi sudo tidak valid atau kadaluarsa", 401)
		}
		return nil, apperrors.ErrDatabase
	}

	// Extend expiry
	newExp := time.Now().Add(SudoTTL)
	_, err = s.client.SudoSession.UpdateOneID(sess.ID).SetExpiresAt(newExp).Save(ctx)
	if err != nil {
		return nil, apperrors.ErrInternalServer
	}

	return &SudoVerifyResult{
		SudoToken: token,
		ExpiresAt: newExp,
		ExpiresIn: int64(SudoTTL.Seconds()),
	}, nil
}
