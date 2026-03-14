package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/passwordresettoken"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/utils"
	"backend-gin/validators"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// ForgotPassword sends password reset email
func (s *EntAuthService) ForgotPassword(ctx context.Context, email, ip string) (*ForgotPasswordResponse, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	if err := validators.ValidateEmail(email); err != nil {
		return nil, err
	}

	// Check email rate limit
	if emailRateLimiter != nil {
		allowed, remaining, nextAllowed := emailRateLimiter.CanSendPasswordReset(email, ip)
		if !allowed {
			if securityAudit != nil {
				securityAudit.LogEvent(SecurityEvent{
					Email:     email,
					EventType: EventPasswordResetReq,
					IPAddress: ip,
					Success:   false,
					Details:   fmt.Sprintf("Rate limit reached. Next allowed: %v", nextAllowed),
					Severity:  "warning",
				})
			}
			return nil, apperrors.ErrPasswordResetLimitReached.WithDetails(
				fmt.Sprintf("Maksimal %d email reset password per 24 jam", MaxPasswordResetPerEmail))
		}
		logger.Debug("Password reset rate limit check",
			zap.String("email", email),
			zap.Int("remaining", remaining))
	}

	// Find user - but don't reveal if email exists
	u, err := s.client.User.
		Query().
		Where(user.EmailEQ(email)).
		Only(ctx)
	if err != nil {
		logger.Debug("Password reset requested for non-existent email", zap.String("email", email))
		return &ForgotPasswordResponse{
			Message: "Jika email terdaftar, tautan reset password telah dikirim.",
		}, nil
	}

	// Create reset token
	raw, err := randomToken()
	if err != nil {
		logger.Error("Failed to generate reset token", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token")
	}

	hash := hashToken(raw)
	expires := time.Now().Add(1 * time.Hour)

	_, err = s.client.PasswordResetToken.
		Create().
		SetUserID(u.ID).
		SetTokenHash(hash).
		SetExpiresAt(expires).
		Save(ctx)
	if err != nil {
		logger.Error("Failed to create reset token", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal menyimpan token")
	}

	// Send email asynchronously via queue
	if err := utils.QueuePasswordResetEmail(u.Email, raw); err != nil {
		logger.Warn("Failed to queue password reset email", zap.Error(err), zap.String("email", email))
	} else {
		if emailRateLimiter != nil {
			emailRateLimiter.RecordPasswordResetSent(email, ip)
		}
		if securityAudit != nil {
			userID := uint(u.ID)
			securityAudit.LogEvent(SecurityEvent{
				UserID:    &userID,
				Email:     email,
				EventType: EventPasswordResetReq,
				IPAddress: ip,
				Success:   true,
				Severity:  "info",
			})
		}
	}

	logger.Info("Password reset requested", zap.String("email", email))

	return &ForgotPasswordResponse{
		Message: "Jika email terdaftar, tautan reset password telah dikirim.",
	}, nil
}

// ResetPassword resets password with token
func (s *EntAuthService) ResetPassword(ctx context.Context, token, newPassword string) error {
	// Validate password
	if err := validators.ValidatePassword(newPassword); err != nil {
		return err
	}

	// Find token
	hash := hashToken(token)
	record, err := s.client.PasswordResetToken.
		Query().
		Where(passwordresettoken.TokenHashEQ(hash)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			logger.Debug("Invalid password reset token")
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
		return apperrors.ErrTokenExpired.WithDetails("Token reset password sudah kedaluwarsa. Silakan minta ulang.")
	}

	// Hash new password
	hashPass, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash new password", zap.Error(err))
		return apperrors.ErrInternalServer.WithDetails("Gagal memproses password")
	}

	// Update password and mark token as used
	err = WithTx(ctx, s.client, func(tx *ent.Tx) error {
		now := time.Now()

		// Mark token as used
		_, err := tx.PasswordResetToken.
			UpdateOneID(record.ID).
			SetUsedAt(now).
			Save(ctx)
		if err != nil {
			return err
		}

		// Update password
		_, err = tx.User.
			UpdateOneID(record.UserID).
			SetPasswordHash(string(hashPass)).
			Save(ctx)
		return err
	})

	if err != nil {
		logger.Error("Failed to reset password", zap.Error(err), zap.Int("user_id", record.UserID))
		return apperrors.ErrDatabase.WithDetails("Gagal menyimpan password baru")
	}

	logger.Info("Password reset successfully", zap.Int("user_id", record.UserID))
	return nil
}
