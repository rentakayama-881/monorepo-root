package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/emailverificationtoken"
	"backend-gin/ent/passwordresettoken"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/utils"
	"backend-gin/validators"

	"go.uber.org/zap"
)

// ConfirmVerification confirms email verification
func (s *EntAuthService) ConfirmVerification(ctx context.Context, input validators.VerifyTokenInput) error {
	if err := input.Validate(); err != nil {
		return err
	}

	hash := hashToken(input.Token)

	// Find token
	record, err := s.client.EmailVerificationToken.
		Query().
		Where(emailverificationtoken.TokenHashEQ(hash)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			// Don't log token hash - security risk
			logger.Debug("Invalid email verification token attempt")
			return apperrors.ErrInvalidToken
		}
		return apperrors.ErrDatabase
	}

	// Check if already used
	if record.UsedAt != nil {
		return apperrors.ErrInvalidToken.WithDetails("Token sudah digunakan")
	}

	// Check expiration
	if time.Now().After(record.ExpiresAt) {
		return apperrors.ErrTokenExpired
	}

	// Update token and user in transaction
	err = WithTx(ctx, s.client, func(tx *ent.Tx) error {
		now := time.Now()

		// Mark token as used
		_, err := tx.EmailVerificationToken.
			UpdateOneID(record.ID).
			SetUsedAt(now).
			Save(ctx)
		if err != nil {
			return err
		}

		// Mark user as verified
		_, err = tx.User.
			UpdateOneID(record.UserID).
			SetEmailVerified(true).
			Save(ctx)
		return err
	})

	if err != nil {
		logger.Error("Failed to verify email", zap.Error(err), zap.Int("user_id", record.UserID))
		return apperrors.ErrDatabase.WithDetails("Gagal memperbarui status verifikasi")
	}

	logger.Info("Email verified successfully", zap.Int("user_id", record.UserID))
	return nil
}

func (s *EntAuthService) RequestVerification(ctx context.Context, email, ip string) (*VerificationRequestResult, error) {
	normalizedEmail := strings.TrimSpace(strings.ToLower(email))
	if err := validators.ValidateEmail(normalizedEmail); err != nil {
		return nil, err
	}

	result := &VerificationRequestResult{}
	if emailRateLimiter != nil {
		allowed, _, nextAllowed := emailRateLimiter.CanSendVerification(normalizedEmail, ip)
		if !allowed {
			retryAfter := secondsUntil(nextAllowed)
			result.RetryAfterSeconds = retryAfter

			err := apperrors.ErrVerificationLimitReached
			if retryAfter > 0 {
				err = err.WithDetails(fmt.Sprintf("Silakan coba lagi dalam %d detik", retryAfter))
			}
			return result, err
		}

		emailRateLimiter.RecordVerificationSent(normalizedEmail, ip)
		result.RetryAfterSeconds = int(VerificationResendDelay / time.Second)
	}

	u, err := s.client.User.Query().
		Where(user.EmailEqualFold(normalizedEmail)).
		Only(ctx)
	if err != nil {
		return result, nil
	}

	if u.EmailVerified {
		logger.Debug("User already verified, skipping email", zap.String("email", normalizedEmail))
		return result, nil
	}

	token, _, err := s.createVerificationToken(ctx, u)
	if err != nil {
		logger.Error("Failed to create verification token", zap.Error(err), zap.String("email", normalizedEmail))
		return nil, err
	}

	if err := utils.QueueVerificationEmail(normalizedEmail, token); err != nil {
		logger.Warn("Failed to queue verification email", zap.Error(err), zap.String("email", normalizedEmail))
		return result, nil
	}

	result.Sent = true
	return result, nil
}

func secondsUntil(nextAllowed *time.Time) int {
	if nextAllowed == nil {
		return 0
	}
	remaining := int(time.Until(*nextAllowed).Seconds())
	if remaining < 1 {
		return 1
	}
	return remaining
}

func (s *EntAuthService) createVerificationToken(ctx context.Context, u *ent.User) (string, string, error) {
	raw, err := randomToken()
	if err != nil {
		return "", "", err
	}
	hash := hashToken(raw)
	expires := time.Now().Add(24 * time.Hour)

	// Keep only one active verification token per user.
	_, _ = s.client.EmailVerificationToken.
		Delete().
		Where(
			emailverificationtoken.UserIDEQ(u.ID),
			emailverificationtoken.UsedAtIsNil(),
		).
		Exec(ctx)

	_, err = s.client.EmailVerificationToken.
		Create().
		SetUserID(u.ID).
		SetTokenHash(hash).
		SetExpiresAt(expires).
		Save(ctx)
	if err != nil {
		return "", "", err
	}

	frontend := strings.TrimSuffix(utils.GetEnv("FRONTEND_BASE_URL", "http://localhost:3000"), "/")
	link := frontend + "/verify-email?token=" + raw

	return raw, link, nil
}

// deleteUnverifiedUser deletes an unverified user and all related records
func (s *EntAuthService) deleteUnverifiedUser(ctx context.Context, u *ent.User) error {
	return WithTx(ctx, s.client, func(tx *ent.Tx) error {
		userID := u.ID

		// Delete verification tokens
		_, _ = tx.EmailVerificationToken.Delete().Where(emailverificationtoken.UserIDEQ(userID)).Exec(ctx)

		// Delete password reset tokens
		_, _ = tx.PasswordResetToken.Delete().Where(passwordresettoken.UserIDEQ(userID)).Exec(ctx)

		// Delete the user
		return tx.User.DeleteOneID(userID).Exec(ctx)
	})
}
