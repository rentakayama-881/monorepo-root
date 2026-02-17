package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/session"
	"backend-gin/ent/sessionlock"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"

	"go.uber.org/zap"
)

type EntSessionService struct {
	client *ent.Client
}

func NewEntSessionService() *EntSessionService {
	return &EntSessionService{client: database.GetEntClient()}
}

// CreateSession creates a new session with token pair
func (s *EntSessionService) CreateSession(ctx context.Context, u *ent.User, ipAddress, userAgent string) (*TokenPair, error) {
	// Check if account is locked
	lock, err := s.client.SessionLock.
		Query().
		Where(sessionlock.UserIDEQ(u.ID)).
		Order(ent.Desc(sessionlock.FieldCreatedAt)).
		First(ctx)
	if err == nil && lock != nil {
		if lock.ExpiresAt.After(time.Now()) {
			return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
		}
	}

	// Check concurrent session limit
	activeSessions, err := s.GetActiveSessions(ctx, u.ID)
	if err == nil && len(activeSessions) >= MaxConcurrentSessions {
		// Revoke oldest session to make room for new one
		oldestSession := activeSessions[len(activeSessions)-1]
		_ = s.RevokeSession(ctx, oldestSession.ID, "New session created - max concurrent sessions reached")
		logger.Info("Revoked oldest session due to concurrent limit",
			zap.Int("user_id", u.ID),
			zap.Int("revoked_session_id", oldestSession.ID))
	}

	// Generate tokens
	username := ""
	if u.Username != nil {
		username = *u.Username
	}
	totpEnabled := u.TotpEnabled && u.TotpVerified
	accessToken, accessJTI, err := middleware.GenerateAccessToken(uint(u.ID), u.Email, username, totpEnabled)
	if err != nil {
		logger.Error("Failed to generate access token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	refreshToken, _, err := middleware.GenerateRefreshToken(uint(u.ID), u.Email, username, totpEnabled)
	if err != nil {
		logger.Error("Failed to generate refresh token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	// Hash refresh token for storage
	refreshTokenHash := hashRefreshToken(refreshToken)
	tokenFamily := generateTokenFamily()

	// Create session record
	sess, err := s.client.Session.
		Create().
		SetUserID(u.ID).
		SetRefreshTokenHash(refreshTokenHash).
		SetAccessTokenJti(accessJTI).
		SetIPAddress(ipAddress).
		SetUserAgent(truncateString(userAgent, 512)).
		SetExpiresAt(time.Now().Add(7 * 24 * time.Hour)).
		SetLastUsedAt(time.Now()).
		SetTokenFamily(tokenFamily).
		SetIsUsed(false).
		Save(ctx)
	if err != nil {
		logger.Error("Failed to create session", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat session")
	}

	// Check impossible travel on login (not just refresh)
	if ipAddress != "" {
		s.checkIPRotationPatternEnt(ctx, u.ID, ipAddress)
	}

	// Log security event
	if securityAudit != nil {
		// Convert Ent user to models.User for security audit
		securityAudit.LogSessionCreatedForEnt(u, ipAddress, userAgent)
	}

	logger.Info("Session created",
		zap.Int("user_id", u.ID),
		zap.Int("session_id", sess.ID),
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
// Uses database transaction with atomic update to prevent race conditions
func (s *EntSessionService) RefreshSession(ctx context.Context, refreshToken, ipAddress, userAgent string) (*TokenPair, error) {
	refreshTokenHash := hashRefreshToken(refreshToken)

	var result *TokenPair
	var txErr error

	// Wrap entire refresh operation in a transaction to prevent race conditions
	err := WithTx(ctx, s.client, func(tx *ent.Tx) error {
		// Find session by refresh token hash
		sess, err := tx.Session.
			Query().
			Where(session.RefreshTokenHashEQ(refreshTokenHash)).
			WithUser().
			Only(ctx)
		if err != nil {
			if ent.IsNotFound(err) {
				// Don't log token hash - security risk
				logger.Debug("Refresh token not found")
				txErr = apperrors.ErrInvalidToken
				return txErr
			}
			txErr = apperrors.ErrDatabase
			return txErr
		}

		// Check if session is valid (not expired and not revoked)
		if sess.ExpiresAt.Before(time.Now()) || sess.RevokedAt != nil {
			txErr = apperrors.ErrInvalidToken.WithDetails("Session telah berakhir atau dicabut")
			return txErr
		}

		u := sess.Edges.User
		if u == nil {
			txErr = apperrors.ErrUserNotFound
			return txErr
		}

		// REUSE DETECTION with grace period for multi-tab scenario
		if sess.IsUsed {
			timeSinceLastUse := time.Since(sess.LastUsedAt)

			if timeSinceLastUse > SessionGracePeriod {
				// Token reuse detected outside grace period - possible theft
				logger.Warn("Refresh token reuse detected outside grace period!",
					zap.Int("user_id", sess.UserID),
					zap.Int("session_id", sess.ID),
					zap.Duration("time_since_last_use", timeSinceLastUse))

				// Log security event
				if securityAudit != nil {
					securityAudit.LogTokenReuseForEnt(u, ipAddress, userAgent)
				}

				// Revoke ALL sessions in this token family
				_ = s.RevokeTokenFamily(ctx, sess.TokenFamily, "Token reuse detected - possible theft")

				// Lock the account for 7 days
				_ = s.LockAccount(ctx, sess.UserID, "Refresh token reuse terdeteksi - kemungkinan token dicuri")

				txErr = apperrors.ErrAccountLocked.WithDetails("Aktivitas mencurigakan terdeteksi. Akun dikunci 7 hari.")
				return txErr
			}

			// Within grace period - this is likely a multi-tab scenario
			logger.Info("Refresh token reuse within grace period - multi-tab scenario",
				zap.Int("user_id", sess.UserID),
				zap.Duration("time_since_last_use", timeSinceLastUse))

			// Find the latest session in this token family
			latestSess, err := tx.Session.
				Query().
				Where(
					session.TokenFamilyEQ(sess.TokenFamily),
					session.IsUsedEQ(false),
				).
				Order(ent.Desc(session.FieldCreatedAt)).
				First(ctx)
			if err == nil {
				// Generate new access token but keep same refresh token
				username := ""
				if u.Username != nil {
					username = *u.Username
				}
				totpEnabled := u.TotpEnabled && u.TotpVerified
				accessToken, accessJTI, err := middleware.GenerateAccessToken(uint(u.ID), u.Email, username, totpEnabled)
				if err != nil {
					txErr = apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
					return txErr
				}

				if _, err := tx.Session.
					UpdateOneID(latestSess.ID).
					SetAccessTokenJti(accessJTI).
					SetLastUsedAt(time.Now()).
					SetIPAddress(ipAddress).
					SetUserAgent(truncateString(userAgent, 512)).
					Save(ctx); err != nil {
					logger.Error("Failed to update latest session during grace refresh", zap.Error(err))
					txErr = apperrors.ErrInternalServer.WithDetails("Gagal memperbarui session")
					return txErr
				}

				result = &TokenPair{
					AccessToken:  accessToken,
					RefreshToken: refreshToken, // Return same refresh token
					ExpiresIn:    300,
					ExpiresAt:    time.Now().Add(5 * time.Minute),
					TokenType:    "Bearer",
				}
				return nil // Commit transaction
			}
		}

		// Session fingerprinting - detect IP/User-Agent drift
		ipChanged := sess.IPAddress != "" && sess.IPAddress != ipAddress
		uaChanged := sess.UserAgent != "" && sess.UserAgent != truncateString(userAgent, 512)

		if ipChanged {
			logger.Warn("IP address changed on refresh",
				zap.Int("user_id", sess.UserID),
				zap.String("old_ip", sess.IPAddress),
				zap.String("new_ip", ipAddress))

			s.checkIPRotationPatternEnt(ctx, sess.UserID, ipAddress)
		}

		if uaChanged {
			logger.Warn("User-Agent changed on refresh",
				zap.Int("user_id", sess.UserID))
		}

		// Check if account is locked
		lock, err := tx.SessionLock.
			Query().
			Where(sessionlock.UserIDEQ(u.ID)).
			Order(ent.Desc(sessionlock.FieldCreatedAt)).
			First(ctx)
		if err == nil && lock != nil && lock.ExpiresAt.After(time.Now()) {
			txErr = apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
			return txErr
		}

		// If refresh token is still far from expiry, reuse it and only rotate access token
		if time.Until(sess.ExpiresAt) > RefreshTokenRotationWindow {
			refreshUsername := ""
			if u.Username != nil {
				refreshUsername = *u.Username
			}
			totpEnabled := u.TotpEnabled && u.TotpVerified
			accessToken, accessJTI, err := middleware.GenerateAccessToken(uint(u.ID), u.Email, refreshUsername, totpEnabled)
			if err != nil {
				txErr = apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
				return txErr
			}

			if _, err := tx.Session.
				UpdateOneID(sess.ID).
				SetAccessTokenJti(accessJTI).
				SetLastUsedAt(time.Now()).
				SetIPAddress(ipAddress).
				SetUserAgent(truncateString(userAgent, 512)).
				Save(ctx); err != nil {
				logger.Error("Failed to update session usage", zap.Error(err))
				txErr = apperrors.ErrInternalServer.WithDetails("Gagal memperbarui session")
				return txErr
			}

			result = &TokenPair{
				AccessToken:  accessToken,
				RefreshToken: refreshToken,
				ExpiresIn:    300,
				ExpiresAt:    time.Now().Add(5 * time.Minute),
				TokenType:    "Bearer",
			}
			return nil
		}

		// Atomic update: Mark current refresh token as used with race condition check
		// This ensures only ONE concurrent request succeeds in marking the session as used
		// Other concurrent requests will fail because is_used is already true
		affectedRows, err := tx.Session.
			Update().
			Where(
				session.IDEQ(sess.ID),
				session.IsUsedEQ(false), // Only update if not already used
			).
			SetIsUsed(true).
			SetLastUsedAt(time.Now()).
			Save(ctx)
		if err != nil {
			logger.Error("Failed to mark session as used", zap.Error(err))
			txErr = apperrors.ErrInternalServer.WithDetails("Gagal memperbarui session")
			return txErr
		}

		// Race condition detected: another request already used this token
		if affectedRows == 0 {
			logger.Warn("Token refresh race condition detected",
				zap.Int("user_id", sess.UserID),
				zap.Int("session_id", sess.ID))
			txErr = apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan")
			return txErr
		}

		// Generate new tokens
		refreshUsername := ""
		if u.Username != nil {
			refreshUsername = *u.Username
		}
		totpEnabled := u.TotpEnabled && u.TotpVerified
		accessToken, accessJTI, err := middleware.GenerateAccessToken(uint(u.ID), u.Email, refreshUsername, totpEnabled)
		if err != nil {
			txErr = apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
			return txErr
		}

		newRefreshToken, _, err := middleware.GenerateRefreshToken(uint(u.ID), u.Email, refreshUsername, totpEnabled)
		if err != nil {
			txErr = apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
			return txErr
		}

		newRefreshTokenHash := hashRefreshToken(newRefreshToken)

		// Create new session record (same token family for rotation tracking)
		newSess, err := tx.Session.
			Create().
			SetUserID(u.ID).
			SetRefreshTokenHash(newRefreshTokenHash).
			SetAccessTokenJti(accessJTI).
			SetIPAddress(ipAddress).
			SetUserAgent(truncateString(userAgent, 512)).
			SetExpiresAt(time.Now().Add(7 * 24 * time.Hour)).
			SetLastUsedAt(time.Now()).
			SetTokenFamily(sess.TokenFamily). // Same family for rotation tracking
			SetIsUsed(false).
			Save(ctx)
		if err != nil {
			txErr = apperrors.ErrInternalServer.WithDetails("Gagal membuat session baru")
			return txErr
		}

		if _, err := tx.Session.
			UpdateOneID(sess.ID).
			SetRevokedAt(time.Now()).
			SetRevokeReason("Refresh token rotated").
			Save(ctx); err != nil {
			txErr = apperrors.ErrInternalServer.WithDetails("Gagal memperbarui session lama")
			return txErr
		}

		logger.Info("Session refreshed",
			zap.Int("user_id", u.ID),
			zap.Int("old_session_id", sess.ID),
			zap.Int("new_session_id", newSess.ID))

		result = &TokenPair{
			AccessToken:  accessToken,
			RefreshToken: newRefreshToken,
			ExpiresIn:    300,
			ExpiresAt:    time.Now().Add(5 * time.Minute),
			TokenType:    "Bearer",
		}
		return nil // Commit transaction
	})

	if err != nil {
		return nil, txErr
	}
	return result, nil
}

// checkIPRotationPatternEnt checks for impossible travel patterns using geolocation
// Detects: 2+ IPs from different countries within 30 minutes (impossible to travel that distance)
func (s *EntSessionService) checkIPRotationPatternEnt(ctx context.Context, userID int, currentIP string) {
	// 30-minute window for impossible travel detection
	cutoff := time.Now().Add(-30 * time.Minute)

	sessions, err := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.CreatedAtGT(cutoff),
		).
		All(ctx)
	if err != nil {
		logger.Warn("Failed to query sessions for impossible travel check", zap.Error(err))
		return
	}

	// Collect unique IPs and their geolocations
	ipToCountry := make(map[string]string) // IP -> CountryCode
	for _, sess := range sessions {
		if sess.IPAddress != "" && sess.IPAddress != currentIP {
			ipToCountry[sess.IPAddress] = ""
		}
	}
	ipToCountry[currentIP] = ""

	// Skip if only one or fewer unique IPs
	if len(ipToCountry) <= 1 {
		return
	}

	// Lookup geolocation for each IP
	geoService := GetGeoLookupService()
	uniqueCountries := make(map[string]bool)
	var detectedCountries []string

	for ip := range ipToCountry {
		loc := geoService.LookupIP(ctx, ip)
		if loc != nil && loc.CountryCode != "" {
			ipToCountry[ip] = loc.CountryCode
			uniqueCountries[loc.CountryCode] = true
			detectedCountries = append(detectedCountries, loc.CountryCode)
		} else {
			// Geo lookup failed for this IP
			// Fail-open: don't block legitimate users due to geo-IP lookup errors
			logger.Debug("Geo lookup failed for IP in impossible travel check",
				zap.Int("user_id", userID),
				zap.String("ip", ip))
		}
	}

	// Impossible travel: 2+ different countries detected in 30-minute window
	if len(uniqueCountries) >= 2 {
		logger.Warn("Impossible travel detected - locking account",
			zap.Int("user_id", userID),
			zap.Strings("countries", detectedCountries),
			zap.Int("unique_countries", len(uniqueCountries)))

		// Lock account for 48 hours
		lockDuration := 48 * time.Hour
		lockUntil := time.Now().Add(lockDuration)
		lockReason := "Impossible travel detected: Login from different countries within 30 minutes"

		// Update user: lock account
		u, err := s.client.User.Get(ctx, userID)
		if err != nil {
			logger.Error("Failed to get user for impossible travel lock", zap.Error(err))
			return
		}

		_, err = s.client.User.
			UpdateOneID(userID).
			SetLockedUntil(lockUntil).
			SetLockReason(lockReason).
			Save(ctx)
		if err != nil {
			logger.Error("Failed to lock user account for impossible travel", zap.Error(err))
			return
		}

		// Revoke all active sessions
		_, err = s.client.Session.
			Update().
			Where(session.UserIDEQ(userID), session.RevokedAtIsNil()).
			SetRevokedAt(time.Now()).
			SetRevokeReason("Impossible travel security lock: Login from different countries").
			Save(ctx)
		if err != nil {
			logger.Error("Failed to revoke sessions for impossible travel lock", zap.Error(err))
		}

		// Log security event
		if securityAudit != nil {
			securityAudit.LogEvent(SecurityEvent{
				Email:     u.Email,
				EventType: "impossible_travel",
				IPAddress: currentIP,
				UserAgent: "",
				Success:   false,
				Details:   "Detected login from " + strings.Join(detectedCountries, ", "),
				Severity:  "critical",
			})
		}

		logger.Info("Account locked due to impossible travel",
			zap.Int("user_id", userID),
			zap.Duration("lock_duration", lockDuration),
			zap.Strings("countries", detectedCountries))
	}
}

// RevokeSession revokes a specific session
func (s *EntSessionService) RevokeSession(ctx context.Context, sessionID int, reason string) error {
	now := time.Now()
	_, err := s.client.Session.
		UpdateOneID(sessionID).
		SetRevokedAt(now).
		SetRevokeReason(reason).
		Save(ctx)
	if err != nil {
		return err
	}
	return nil
}

// RevokeSessionByRefreshToken revokes a session by refresh token
func (s *EntSessionService) RevokeSessionByRefreshToken(ctx context.Context, refreshToken, reason string) error {
	refreshTokenHash := hashRefreshToken(refreshToken)
	now := time.Now()

	sess, err := s.client.Session.
		Query().
		Where(session.RefreshTokenHashEQ(refreshTokenHash)).
		Only(ctx)
	if err != nil {
		return err
	}

	_, err = s.client.Session.
		UpdateOneID(sess.ID).
		SetRevokedAt(now).
		SetRevokeReason(reason).
		Save(ctx)
	return err
}

// RevokeAllUserSessions revokes all sessions for a user
func (s *EntSessionService) RevokeAllUserSessions(ctx context.Context, userID int, reason string) error {
	now := time.Now()
	affected, err := s.client.Session.
		Update().
		Where(
			session.UserIDEQ(userID),
			session.RevokedAtIsNil(),
		).
		SetRevokedAt(now).
		SetRevokeReason(reason).
		Save(ctx)
	if err != nil {
		return err
	}

	logger.Info("All sessions revoked for user",
		zap.Int("user_id", userID),
		zap.Int("sessions_revoked", affected))

	return nil
}

// RevokeTokenFamily revokes all sessions in a token family
func (s *EntSessionService) RevokeTokenFamily(ctx context.Context, tokenFamily, reason string) error {
	now := time.Now()
	affected, err := s.client.Session.
		Update().
		Where(
			session.TokenFamilyEQ(tokenFamily),
			session.RevokedAtIsNil(),
		).
		SetRevokedAt(now).
		SetRevokeReason(reason).
		Save(ctx)
	if err != nil {
		return err
	}

	logger.Info("Token family revoked",
		zap.Int("sessions_revoked", affected))

	return nil
}

// LockAccount locks an account for 7 days
func (s *EntSessionService) LockAccount(ctx context.Context, userID int, reason string) error {
	_, err := s.client.SessionLock.
		Create().
		SetUserID(userID).
		SetLockedAt(time.Now()).
		SetExpiresAt(time.Now().Add(7 * 24 * time.Hour)).
		SetReason(reason).
		SetLockedBy("system").
		Save(ctx)
	if err != nil {
		return err
	}

	// Revoke all sessions
	_ = s.RevokeAllUserSessions(ctx, userID, "Account locked: "+reason)

	logger.Warn("Account locked",
		zap.Int("user_id", userID),
		zap.String("reason", reason))

	return nil
}

// GetActiveSessions returns all active sessions for a user
func (s *EntSessionService) GetActiveSessions(ctx context.Context, userID int) ([]*ent.Session, error) {
	return s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.RevokedAtIsNil(),
			session.ExpiresAtGT(time.Now()),
		).
		Order(ent.Desc(session.FieldLastUsedAt)).
		All(ctx)
}

// CleanupExpiredSessions removes expired sessions (run periodically)
func (s *EntSessionService) CleanupExpiredSessions(ctx context.Context) (int, error) {
	affected, err := s.client.Session.
		Delete().
		Where(session.ExpiresAtLT(time.Now())).
		Exec(ctx)
	return affected, err
}

// GetActiveSessionCount returns count of active sessions for a user
func (s *EntSessionService) GetActiveSessionCount(ctx context.Context, userID int) (int, error) {
	return s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.RevokedAtIsNil(),
			session.ExpiresAtGT(time.Now()),
		).
		Count(ctx)
}

// GetSessionSecurityStats returns security statistics for a user
func (s *EntSessionService) GetSessionSecurityStats(ctx context.Context, userID int) map[string]interface{} {
	stats := make(map[string]interface{})

	// Active sessions count
	activeCount, _ := s.GetActiveSessionCount(ctx, userID)
	stats["active_sessions"] = activeCount

	// Total sessions in last 30 days
	totalCount, _ := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.CreatedAtGT(time.Now().AddDate(0, 0, -30)),
		).
		Count(ctx)
	stats["sessions_30_days"] = totalCount

	// Revoked sessions in last 30 days
	revokedCount, _ := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.RevokedAtNotNil(),
			session.CreatedAtGT(time.Now().AddDate(0, 0, -30)),
		).
		Count(ctx)
	stats["revoked_sessions_30_days"] = revokedCount

	// Unique IPs in last 30 days
	sessions, _ := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.CreatedAtGT(time.Now().AddDate(0, 0, -30)),
		).
		All(ctx)

	uniqueIPs := make(map[string]bool)
	for _, sess := range sessions {
		if sess.IPAddress != "" {
			uniqueIPs[sess.IPAddress] = true
		}
	}
	stats["unique_ips_30_days"] = len(uniqueIPs)

	// Check for any current anomalies
	hasAnomaly, anomalyDetails := s.DetectSessionAnomaly(ctx, userID)
	stats["has_anomaly"] = hasAnomaly
	if hasAnomaly {
		stats["anomaly_details"] = anomalyDetails
	}

	return stats
}

// DetectSessionAnomaly checks for suspicious session patterns
func (s *EntSessionService) DetectSessionAnomaly(ctx context.Context, userID int) (bool, string) {
	anomalies := []string{}
	cutoff := time.Now().Add(-1 * time.Hour)

	// 1. Check for rapid session creation (more than 10 in last hour)
	recentSessionCount, _ := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.CreatedAtGT(cutoff),
		).
		Count(ctx)

	if recentSessionCount > 10 {
		anomalies = append(anomalies, fmt.Sprintf("rapid_session_creation: %d sessions in 1 hour", recentSessionCount))
	}

	// 2. Check for multiple different IPs in last hour
	sessions, _ := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.CreatedAtGT(cutoff),
		).
		All(ctx)

	uniqueIPs := make(map[string]bool)
	for _, sess := range sessions {
		if sess.IPAddress != "" {
			uniqueIPs[sess.IPAddress] = true
		}
	}

	if len(uniqueIPs) >= IPChangeSuspiciousCount {
		anomalies = append(anomalies, fmt.Sprintf("multiple_ips: %d different IPs in 1 hour", len(uniqueIPs)))
	}

	// 3. Check for token reuse attempts
	revokedFamilies, _ := s.client.Session.
		Query().
		Where(
			session.UserIDEQ(userID),
			session.RevokeReasonContains("token reuse"),
			session.CreatedAtGT(time.Now().Add(-24*time.Hour)),
		).
		Count(ctx)

	if revokedFamilies > 0 {
		anomalies = append(anomalies, fmt.Sprintf("token_reuse_detected: %d incidents in 24h", revokedFamilies))
	}

	if len(anomalies) > 0 {
		anomalyDetails := ""
		for _, a := range anomalies {
			anomalyDetails += a + "; "
		}

		logger.Warn("Session anomaly detected",
			zap.Int("user_id", userID),
			zap.String("anomalies", anomalyDetails))

		return true, anomalyDetails
	}

	return false, ""
}
