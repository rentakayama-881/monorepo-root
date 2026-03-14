package services

import (
	"context"
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
