package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/models"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Session security constants
const (
	MaxConcurrentSessions   = 5                // Maximum concurrent sessions per user
	SessionGracePeriod      = 30 * time.Second // Grace period for token reuse (multi-tab)
	IPChangeSuspiciousCount = 3                // Number of different IPs to trigger warning
	IPChangeWindow          = 1 * time.Hour    // Time window for IP change tracking
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
	ExpiresIn    int64     `json:"expires_in"` // Access token expiry in seconds
	ExpiresAt    time.Time `json:"expires_at"` // Access token expiry timestamp
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

	// Check concurrent session limit
	activeSessions, err := s.GetActiveSessions(user.ID)
	if err == nil && len(activeSessions) >= MaxConcurrentSessions {
		// Revoke oldest session to make room for new one
		oldestSession := activeSessions[len(activeSessions)-1]
		_ = s.RevokeSession(oldestSession.ID, "New session created - max concurrent sessions reached")
		logger.Info("Revoked oldest session due to concurrent limit",
			zap.Uint("user_id", user.ID),
			zap.Uint("revoked_session_id", oldestSession.ID))
	}

	// Generate tokens
	username := ""
	if user.Username != nil {
		username = *user.Username
	}
	accessToken, accessJTI, err := middleware.GenerateAccessToken(user.ID, user.Email, username)
	if err != nil {
		logger.Error("Failed to generate access token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	refreshToken, _, err := middleware.GenerateRefreshToken(user.ID, user.Email, username)
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

	// Log security event
	if securityAudit != nil {
		securityAudit.LogSessionCreated(user, ipAddress, userAgent)
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

	// Get user for audit logging
	var user models.User
	if err := s.db.First(&user, session.UserID).Error; err != nil {
		return nil, apperrors.ErrUserNotFound
	}

	// REUSE DETECTION with grace period for multi-tab scenario
	// Allow reuse within 30 seconds to handle race conditions from multiple browser tabs
	if session.IsUsed {
		// Check if this is within grace period (30 seconds from last use)
		timeSinceLastUse := time.Since(session.LastUsedAt)

		if timeSinceLastUse > SessionGracePeriod {
			// Token reuse detected outside grace period - possible theft
			logger.Warn("Refresh token reuse detected outside grace period!",
				zap.Uint("user_id", session.UserID),
				zap.Uint("session_id", session.ID),
				zap.String("token_family", session.TokenFamily),
				zap.Duration("time_since_last_use", timeSinceLastUse))

			// Log security event
			if securityAudit != nil {
				securityAudit.LogTokenReuse(&user, ipAddress, userAgent)
			}

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
			// Generate new access token but keep same refresh token
			username := ""
			if user.Username != nil {
				username = *user.Username
			}
			accessToken, _, err := middleware.GenerateAccessToken(user.ID, user.Email, username)
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

	// Session fingerprinting - detect IP/User-Agent drift
	ipChanged := session.IPAddress != "" && session.IPAddress != ipAddress
	uaChanged := session.UserAgent != "" && session.UserAgent != truncateString(userAgent, 512)

	if ipChanged {
		logger.Warn("IP address changed on refresh",
			zap.Uint("user_id", session.UserID),
			zap.String("old_ip", session.IPAddress),
			zap.String("new_ip", ipAddress))

		// Check for suspicious IP rotation pattern
		s.checkIPRotationPattern(session.UserID, ipAddress)
	}

	if uaChanged {
		logger.Warn("User-Agent changed on refresh",
			zap.Uint("user_id", session.UserID))
	}

	// Log significant session changes
	if (ipChanged || uaChanged) && securityAudit != nil {
		securityAudit.LogEvent(SecurityEvent{
			UserID:    &user.ID,
			Email:     user.Email,
			EventType: "session_drift_detected",
			IPAddress: ipAddress,
			UserAgent: userAgent,
			Success:   true,
			Details:   fmt.Sprintf("IP changed: %v, UA changed: %v", ipChanged, uaChanged),
			Severity:  "warning",
		})
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
	refreshUsername := ""
	if user.Username != nil {
		refreshUsername = *user.Username
	}
	accessToken, accessJTI, err := middleware.GenerateAccessToken(user.ID, user.Email, refreshUsername)
	if err != nil {
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	newRefreshToken, _, err := middleware.GenerateRefreshToken(user.ID, user.Email, refreshUsername)
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

	// Log security event
	if securityAudit != nil {
		securityAudit.LogEvent(SecurityEvent{
			UserID:    &user.ID,
			Email:     user.Email,
			EventType: EventSessionRefreshed,
			IPAddress: ipAddress,
			UserAgent: userAgent,
			Success:   true,
			Severity:  "info",
		})
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

// checkIPRotationPattern checks for suspicious IP rotation patterns
func (s *SessionService) checkIPRotationPattern(userID uint, currentIP string) {
	// Get recent sessions with different IPs in the last hour
	cutoff := time.Now().Add(-IPChangeWindow)
	var sessions []models.Session
	s.db.Where("user_id = ? AND created_at > ?", userID, cutoff).
		Select("DISTINCT ip_address").
		Find(&sessions)

	uniqueIPs := make(map[string]bool)
	for _, sess := range sessions {
		if sess.IPAddress != "" {
			uniqueIPs[sess.IPAddress] = true
		}
	}
	uniqueIPs[currentIP] = true

	if len(uniqueIPs) >= IPChangeSuspiciousCount {
		logger.Warn("Suspicious IP rotation pattern detected",
			zap.Uint("user_id", userID),
			zap.Int("unique_ips", len(uniqueIPs)),
			zap.Duration("window", IPChangeWindow))

		// Get user for security event
		var user models.User
		if err := s.db.First(&user, userID).Error; err == nil && securityAudit != nil {
			securityAudit.LogEvent(SecurityEvent{
				UserID:    &user.ID,
				Email:     user.Email,
				EventType: EventIPRotation,
				IPAddress: currentIP,
				Success:   false,
				Details:   fmt.Sprintf("User accessed from %d different IPs in %v", len(uniqueIPs), IPChangeWindow),
				Severity:  "warning",
			})
		}
	}
}

// RevokeSession revokes a specific session
func (s *SessionService) RevokeSession(sessionID uint, reason string) error {
	// Get session info for logging
	var session models.Session
	if err := s.db.First(&session, sessionID).Error; err != nil {
		return err
	}

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

	// Log security event
	if securityAudit != nil {
		var user models.User
		if err := s.db.First(&user, session.UserID).Error; err == nil {
			securityAudit.LogEvent(SecurityEvent{
				UserID:    &user.ID,
				Email:     user.Email,
				EventType: EventSessionRevoked,
				IPAddress: session.IPAddress,
				Success:   true,
				Details:   reason,
				Severity:  "info",
			})
		}
	}

	return nil
}

// RevokeSessionByRefreshToken revokes a session by refresh token
func (s *SessionService) RevokeSessionByRefreshToken(refreshToken, reason string) error {
	refreshTokenHash := hashRefreshToken(refreshToken)

	// Get session info for logging
	var session models.Session
	if err := s.db.Where("refresh_token_hash = ?", refreshTokenHash).First(&session).Error; err != nil {
		return err
	}

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

	// Log security event
	if securityAudit != nil {
		var user models.User
		if err := s.db.First(&user, session.UserID).Error; err == nil {
			securityAudit.LogEvent(SecurityEvent{
				UserID:    &user.ID,
				Email:     user.Email,
				EventType: EventSessionRevoked,
				IPAddress: session.IPAddress,
				Success:   true,
				Details:   reason,
				Severity:  "info",
			})
		}
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

	// Log security event
	if securityAudit != nil {
		var user models.User
		if err := s.db.First(&user, userID).Error; err == nil {
			securityAudit.LogEvent(SecurityEvent{
				UserID:    &user.ID,
				Email:     user.Email,
				EventType: EventSessionRevoked,
				Success:   true,
				Details:   fmt.Sprintf("All sessions revoked (%d): %s", result.RowsAffected, reason),
				Severity:  "warning",
			})
		}
	}

	return nil
}

// RevokeTokenFamily revokes all sessions in a token family
func (s *SessionService) RevokeTokenFamily(tokenFamily, reason string) error {
	// Get a session to find user
	var session models.Session
	s.db.Where("token_family = ?", tokenFamily).First(&session)

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

	// Log security event
	if securityAudit != nil && session.UserID > 0 {
		var user models.User
		if err := s.db.First(&user, session.UserID).Error; err == nil {
			securityAudit.LogEvent(SecurityEvent{
				UserID:    &user.ID,
				Email:     user.Email,
				EventType: EventSessionRevoked,
				Success:   true,
				Details:   fmt.Sprintf("Token family revoked (%d sessions): %s", result.RowsAffected, reason),
				Severity:  "critical",
			})
		}
	}

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

// GetActiveSessionCount returns count of active sessions for a user
func (s *SessionService) GetActiveSessionCount(userID uint) (int64, error) {
	var count int64
	err := s.db.Model(&models.Session{}).
		Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, time.Now()).
		Count(&count).Error
	return count, err
}

// DetectSessionAnomaly checks for suspicious session patterns
func (s *SessionService) DetectSessionAnomaly(userID uint) (bool, string) {
	anomalies := []string{}

	// 1. Check for rapid session creation (more than 10 in last hour)
	var recentSessionCount int64
	cutoff := time.Now().Add(-1 * time.Hour)
	s.db.Model(&models.Session{}).
		Where("user_id = ? AND created_at > ?", userID, cutoff).
		Count(&recentSessionCount)

	if recentSessionCount > 10 {
		anomalies = append(anomalies, fmt.Sprintf("rapid_session_creation: %d sessions in 1 hour", recentSessionCount))
	}

	// 2. Check for multiple different IPs in last hour
	var sessions []models.Session
	s.db.Where("user_id = ? AND created_at > ?", userID, cutoff).
		Select("DISTINCT ip_address").
		Find(&sessions)

	uniqueIPs := make(map[string]bool)
	for _, sess := range sessions {
		if sess.IPAddress != "" {
			uniqueIPs[sess.IPAddress] = true
		}
	}

	if len(uniqueIPs) >= IPChangeSuspiciousCount {
		anomalies = append(anomalies, fmt.Sprintf("multiple_ips: %d different IPs in 1 hour", len(uniqueIPs)))
	}

	// 3. Check for token reuse attempts (any sessions with is_used=true that caused family revoke)
	var revokedFamilies int64
	s.db.Model(&models.Session{}).
		Where("user_id = ? AND revoke_reason LIKE ? AND created_at > ?",
			userID, "%token reuse%", time.Now().Add(-24*time.Hour)).
		Count(&revokedFamilies)

	if revokedFamilies > 0 {
		anomalies = append(anomalies, fmt.Sprintf("token_reuse_detected: %d incidents in 24h", revokedFamilies))
	}

	if len(anomalies) > 0 {
		anomalyDetails := ""
		for _, a := range anomalies {
			anomalyDetails += a + "; "
		}

		// Log security event
		if securityAudit != nil {
			var user models.User
			if err := s.db.First(&user, userID).Error; err == nil {
				securityAudit.LogEvent(SecurityEvent{
					UserID:    &user.ID,
					Email:     user.Email,
					EventType: "session_anomaly_detected",
					Success:   false,
					Details:   anomalyDetails,
					Severity:  "warning",
				})
			}
		}

		logger.Warn("Session anomaly detected",
			zap.Uint("user_id", userID),
			zap.String("anomalies", anomalyDetails))

		return true, anomalyDetails
	}

	return false, ""
}

// GetSessionSecurityStats returns security statistics for a user
func (s *SessionService) GetSessionSecurityStats(userID uint) map[string]interface{} {
	stats := make(map[string]interface{})

	// Active sessions count
	activeCount, _ := s.GetActiveSessionCount(userID)
	stats["active_sessions"] = activeCount

	// Total sessions in last 30 days
	var totalCount int64
	s.db.Model(&models.Session{}).
		Where("user_id = ? AND created_at > ?", userID, time.Now().AddDate(0, 0, -30)).
		Count(&totalCount)
	stats["sessions_30_days"] = totalCount

	// Revoked sessions in last 30 days
	var revokedCount int64
	s.db.Model(&models.Session{}).
		Where("user_id = ? AND revoked_at IS NOT NULL AND created_at > ?",
			userID, time.Now().AddDate(0, 0, -30)).
		Count(&revokedCount)
	stats["revoked_sessions_30_days"] = revokedCount

	// Unique IPs in last 30 days
	var sessions []models.Session
	s.db.Where("user_id = ? AND created_at > ?", userID, time.Now().AddDate(0, 0, -30)).
		Select("DISTINCT ip_address").
		Find(&sessions)
	uniqueIPs := make(map[string]bool)
	for _, sess := range sessions {
		if sess.IPAddress != "" {
			uniqueIPs[sess.IPAddress] = true
		}
	}
	stats["unique_ips_30_days"] = len(uniqueIPs)

	// Check for any current anomalies
	hasAnomaly, anomalyDetails := s.DetectSessionAnomaly(userID)
	stats["has_anomaly"] = hasAnomaly
	if hasAnomaly {
		stats["anomaly_details"] = anomalyDetails
	}

	return stats
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
