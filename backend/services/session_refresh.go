package services

import (
	"context"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/session"
	"backend-gin/ent/sessionlock"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/middleware"

	"go.uber.org/zap"
)

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
