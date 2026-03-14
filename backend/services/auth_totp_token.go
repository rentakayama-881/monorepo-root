package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/totppendingtoken"
	apperrors "backend-gin/errors"
)

// generateTOTPPendingToken creates a short-lived token for TOTP verification
func (s *EntAuthService) generateTOTPPendingToken(ctx context.Context, userID int) (string, error) {
	tokenBytes := make([]byte, totpPendingTokenLength)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)

	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	// Clean up old pending tokens
	_, _ = s.client.TOTPPendingToken.
		Delete().
		Where(totppendingtoken.UserIDEQ(userID)).
		Exec(ctx)

	// Save pending token
	_, err := s.client.TOTPPendingToken.
		Create().
		SetUserID(userID).
		SetTokenHash(tokenHash).
		SetExpiresAt(time.Now().Add(totpPendingTokenExpiry)).
		Save(ctx)
	if err != nil {
		return "", err
	}

	return token, nil
}

// validateTOTPPendingToken validates a TOTP pending token without consuming it.
func (s *EntAuthService) validateTOTPPendingToken(ctx context.Context, token string) (*ent.User, *ent.TOTPPendingToken, error) {
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	pending, err := s.client.TOTPPendingToken.
		Query().
		Where(totppendingtoken.TokenHashEQ(tokenHash)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil, apperrors.ErrInvalidToken.WithDetails("Token tidak valid atau sudah expired")
		}
		return nil, nil, apperrors.ErrDatabase
	}

	// Check if already used
	if pending.UsedAt != nil {
		return nil, nil, apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan")
	}

	// Check expiration
	if time.Now().After(pending.ExpiresAt) {
		return nil, nil, apperrors.ErrTokenExpired.WithDetails("Token sudah expired. Silakan login ulang.")
	}

	// Get user
	u, err := s.client.User.Get(ctx, pending.UserID)
	if err != nil {
		return nil, nil, apperrors.ErrUserNotFound
	}

	return u, pending, nil
}

// consumeTOTPPendingToken marks a pending token as used once authentication succeeds.
func (s *EntAuthService) consumeTOTPPendingToken(ctx context.Context, pendingID int) error {
	affected, err := s.client.TOTPPendingToken.
		Update().
		Where(
			totppendingtoken.IDEQ(pendingID),
			totppendingtoken.UsedAtIsNil(),
		).
		SetUsedAt(time.Now()).
		Save(ctx)
	if err != nil {
		return apperrors.ErrDatabase
	}
	if affected == 0 {
		return apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan atau tidak valid")
	}

	return nil
}
