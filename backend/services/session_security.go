package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent/session"
	"backend-gin/logger"

	"go.uber.org/zap"
)

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
