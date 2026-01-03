package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/models"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SessionService handles session management
type SessionService struct {
	db *gorm.DB
}

// NewSessionService creates a new session service
func NewSessionService(db *gorm.DB) *SessionService {
	return &SessionService{db: db}
}

// TokenPair represents access and refresh token pair
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int64     `json:"expires_in"`    // Access token expiry in seconds
	ExpiresAt    time.Time `json:"expires_at"`    // Access token expiry timestamp
	TokenType    string    `json:"token_type"`
}

// CreateSession creates a new session with token pair
func (s *SessionService) CreateSession(user *models.User, ipAddress, userAgent string) (*TokenPair, error) {
	// Check if account is locked
	var lock models.SessionLock
	if err := s.db.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
		if lock.IsLocked() {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
		}
	}

	// Generate tokens
	accessToken, accessJTI, err := middleware.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		logger.Error("Failed to generate access token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	refreshToken, _, err := middleware.GenerateRefreshToken(user.ID, user.Email)
	if err != nil {
		logger.Error("Failed to generate refresh token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	// Hash refresh token for storage
	refreshTokenHash := hashRefreshToken(refreshToken)

	// Generate token family for this session
	tokenFamily := generateTokenFamily()

	// Create session record
	session := models.Session{
		UserID:           user.ID,
		RefreshTokenHash: refreshTokenHash,
		AccessTokenJTI:   accessJTI,
		IPAddress:        ipAddress,
		UserAgent:        truncateString(userAgent, 512),
		ExpiresAt:        time.Now().Add(7 * 24 * time.Hour),
		LastUsedAt:       time.Now(),
		TokenFamily:      tokenFamily,
		IsUsed:           false,
	}

	if err := s.db.Create(&session).Error; err != nil {
		logger.Error("Failed to create session", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat session")
	}

	logger.Info("Session created",
		zap.Uint("user_id", user.ID),
		zap.Uint("session_id", session.ID),
		zap.String("ip", ipAddress),
		zap.String("jti", accessJTI))

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    300, // 5 minutes
		ExpiresAt:    time.Now().Add(5 * time.Minute),
		TokenType:    "Bearer",
	}, nil
}

// RefreshSession rotates refresh token and returns new token pair
func (s *SessionService) RefreshSession(refreshToken, ipAddress, userAgent string) (*TokenPair, error) {
	refreshTokenHash := hashRefreshToken(refreshToken)

	// Find session by refresh token hash
	var session models.Session
	if err := s.db.Where("refresh_token_hash = ?", refreshTokenHash).First(&session).Error; err != nil {
		logger.Debug("Refresh token not found", zap.String("hash", refreshTokenHash[:16]))
		return nil, apperrors.ErrInvalidToken
	}

	// Check if session is valid
	if !session.IsValid() {
		return nil, apperrors.ErrInvalidToken.WithDetails("Session telah berakhir atau dicabut")
	}

	// REUSE DETECTION with grace period for multi-tab scenario
	// Allow reuse within 30 seconds to handle race conditions from multiple browser tabs
	if session.IsUsed {
		// Check if this is within grace period (30 seconds from last use)
		gracePeriod := 30 * time.Second
		timeSinceLastUse := time.Since(session.LastUsedAt)

		if timeSinceLastUse > gracePeriod {
			// Token reuse detected outside grace period - possible theft
			logger.Warn("Refresh token reuse detected outside grace period!",
				zap.Uint("user_id", session.UserID),
				zap.Uint("session_id", session.ID),
				zap.String("token_family", session.TokenFamily),
				zap.Duration("time_since_last_use", timeSinceLastUse))

			// Revoke ALL sessions in this token family
			_ = s.RevokeTokenFamily(session.TokenFamily, "Token reuse detected - possible theft")

			// Lock the account for 7 days
			_ = s.LockAccount(session.UserID, "Refresh token reuse terdeteksi - kemungkinan token dicuri")

			return nil, apperrors.ErrAccountLocked.WithDetails("Aktivitas mencurigakan terdeteksi. Akun dikunci 7 hari.")
		}

		// Within grace period - this is likely a multi-tab scenario
		// Return the same token without creating new session (idempotent refresh)
		logger.Info("Refresh token reuse within grace period - multi-tab scenario",
			zap.Uint("user_id", session.UserID),
			zap.Duration("time_since_last_use", timeSinceLastUse))

		// Find the latest session in this token family
		var latestSession models.Session
		if err := s.db.Where("token_family = ? AND is_used = ?", session.TokenFamily, false).
			Order("created_at DESC").First(&latestSession).Error; err == nil {
			// Return existing active session's token info
			var user models.User
			if err := s.db.First(&user, latestSession.UserID).Error; err != nil {
				return nil, apperrors.ErrUserNotFound
			}

			// Generate new access token but keep same refresh token
			accessToken, _, err := middleware.GenerateAccessToken(user.ID, user.Email)
			if err != nil {
				return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
			}

			return &TokenPair{
				AccessToken:  accessToken,
				RefreshToken: refreshToken, // Return same refresh token
				ExpiresIn:    300,
				ExpiresAt:    time.Now().Add(5 * time.Minute),
				TokenType:    "Bearer",
			}, nil
		}
	}

	// Session fingerprinting - WARNING mode (log but allow with update)
	// This prevents legitimate users from getting locked out
	if session.IPAddress != "" && session.IPAddress != ipAddress {
		logger.Warn("IP address changed on refresh",
			zap.Uint("user_id", session.UserID),
			zap.String("old_ip", session.IPAddress),
			zap.String("new_ip", ipAddress))
		// Continue with new IP - allow roaming
	}

	if session.UserAgent != "" && session.UserAgent != truncateString(userAgent, 512) {
		logger.Warn("User-Agent changed on refresh",
			zap.Uint("user_id", session.UserID))
		// Continue with new UA - allow browser updates
	}

	// Get user
	var user models.User
	if err := s.db.First(&user, session.UserID).Error; err != nil {
		return nil, apperrors.ErrUserNotFound
	}

	// Check if account is locked
	var lock models.SessionLock
	if err := s.db.Where("user_id = ?", user.ID).Order("created_at DESC").First(&lock).Error; err == nil {
		if lock.IsLocked() {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
		}
	}

	// Mark current refresh token as used (for reuse detection)
	session.IsUsed = true
	session.LastUsedAt = time.Now()
	s.db.Save(&session)

	// Generate new tokens
	accessToken, accessJTI, err := middleware.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	newRefreshToken, _, err := middleware.GenerateRefreshToken(user.ID, user.Email)
	if err != nil {
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	newRefreshTokenHash := hashRefreshToken(newRefreshToken)

	// Create new session record (same token family for rotation tracking)
	newSession := models.Session{
		UserID:           user.ID,
		RefreshTokenHash: newRefreshTokenHash,
		AccessTokenJTI:   accessJTI,
		IPAddress:        ipAddress,
		UserAgent:        truncateString(userAgent, 512),
		ExpiresAt:        time.Now().Add(7 * 24 * time.Hour),
		LastUsedAt:       time.Now(),
		TokenFamily:      session.TokenFamily, // Same family for rotation tracking
		IsUsed:           false,
	}

	if err := s.db.Create(&newSession).Error; err != nil {
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat session baru")
	}

	logger.Info("Session refreshed",
		zap.Uint("user_id", user.ID),
		zap.Uint("old_session_id", session.ID),
		zap.Uint("new_session_id", newSession.ID))

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    300,
		ExpiresAt:    time.Now().Add(5 * time.Minute),
		TokenType:    "Bearer",
	}, nil
}

// RevokeSession revokes a specific session
func (s *SessionService) RevokeSession(sessionID uint, reason string) error {
	now := time.Now()
	result := s.db.Model(&models.Session{}).
		Where("id = ?", sessionID).
		Updates(map[string]interface{}{
			"revoked_at":    now,
			"revoke_reason": reason,
		})

	if result.Error != nil {
		return result.Error
	}
	return nil
}

// RevokeSessionByRefreshToken revokes a session by refresh token
func (s *SessionService) RevokeSessionByRefreshToken(refreshToken, reason string) error {
	refreshTokenHash := hashRefreshToken(refreshToken)

	now := time.Now()
	result := s.db.Model(&models.Session{}).
		Where("refresh_token_hash = ?", refreshTokenHash).
		Updates(map[string]interface{}{
			"revoked_at":    now,
			"revoke_reason": reason,
		})

	if result.Error != nil {
		return result.Error
	}
	return nil
}

// RevokeAllUserSessions revokes all sessions for a user
func (s *SessionService) RevokeAllUserSessions(userID uint, reason string) error {
	now := time.Now()
	result := s.db.Model(&models.Session{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Updates(map[string]interface{}{
			"revoked_at":    now,
			"revoke_reason": reason,
		})

	if result.Error != nil {
		return result.Error
	}

	logger.Info("All sessions revoked for user",
		zap.Uint("user_id", userID),
		zap.Int64("sessions_revoked", result.RowsAffected))

	return nil
}

// RevokeTokenFamily revokes all sessions in a token family
func (s *SessionService) RevokeTokenFamily(tokenFamily, reason string) error {
	now := time.Now()
	result := s.db.Model(&models.Session{}).
		Where("token_family = ? AND revoked_at IS NULL", tokenFamily).
		Updates(map[string]interface{}{
			"revoked_at":    now,
			"revoke_reason": reason,
		})

	if result.Error != nil {
		return result.Error
	}

	logger.Info("Token family revoked",
		zap.String("token_family", tokenFamily),
		zap.Int64("sessions_revoked", result.RowsAffected))

	return nil
}

// LockAccount locks an account for 7 days
func (s *SessionService) LockAccount(userID uint, reason string) error {
	lock := models.SessionLock{
		UserID:    userID,
		LockedAt:  time.Now(),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		Reason:    reason,
		LockedBy:  "system",
	}

	if err := s.db.Create(&lock).Error; err != nil {
		return err
	}

	// Revoke all sessions
	_ = s.RevokeAllUserSessions(userID, "Account locked: "+reason)

	logger.Warn("Account locked",
		zap.Uint("user_id", userID),
		zap.String("reason", reason),
		zap.Time("expires_at", lock.ExpiresAt))

	return nil
}

// GetActiveSessions returns all active sessions for a user
func (s *SessionService) GetActiveSessions(userID uint) ([]models.Session, error) {
	var sessions []models.Session
	err := s.db.Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Order("last_used_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// CleanupExpiredSessions removes expired sessions (run periodically)
func (s *SessionService) CleanupExpiredSessions() (int64, error) {
	result := s.db.Where("expires_at < ?", time.Now()).Delete(&models.Session{})
	return result.RowsAffected, result.Error
}

// Helper functions
func hashRefreshToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

func generateTokenFamily() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
