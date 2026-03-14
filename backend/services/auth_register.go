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
	"golang.org/x/crypto/bcrypt"
)

// RegisterWithDevice registers a new user with device fingerprint tracking
func (s *EntAuthService) RegisterWithDevice(ctx context.Context, input validators.RegisterInput, deviceFingerprint, ip, userAgent string) (*RegisterResponse, error) {
	// Check device limit if fingerprint provided
	if deviceFingerprint != "" {
		// Compute hash once: used for both Feature Service ban check and local tracking.
		// This aligns the ban identifier so that bans created from Observed Devices
		// (which use fingerprint_hash) are enforced correctly during auth.
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

		// Check Feature Service admin bans first (highest priority)
		if deviceBanChecker != nil {
			if banned, reason, err := deviceBanChecker.IsDeviceBanned(ctx, fingerprintHash); banned {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     input.Email,
						EventType: "registration_device_banned",
						IPAddress: ip,
						UserAgent: userAgent,
						Success:   false,
						Details:   "Device banned by admin: " + reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			} else if err != nil {
				logger.Debug("Device ban check error (will continue)", zap.Error(err))
			}
		}

		// Check PostgreSQL device tracker
		if deviceTracker != nil {
			// Check if device is blocked
			if blocked, reason := deviceTracker.IsDeviceBlocked(ctx, fingerprintHash); blocked {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     input.Email,
						EventType: "registration_device_blocked",
						IPAddress: ip,
						UserAgent: userAgent,
						Success:   false,
						Details:   reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			}

			// Check device account limit
			allowed, count, err := deviceTracker.CanRegisterAccount(ctx, fingerprintHash, ip, userAgent)
			if err != nil {
				logger.Warn("Failed to check device limit", zap.Error(err))
			} else if !allowed {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     input.Email,
						EventType: "registration_device_limit",
						IPAddress: ip,
						UserAgent: userAgent,
						Success:   false,
						Details:   fmt.Sprintf("Device already has %d accounts (max %d)", count, MaxAccountsPerDevice),
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceLimitReached.WithDetails(
					fmt.Sprintf("Perangkat ini sudah memiliki %d akun terdaftar (maksimal %d)", count, MaxAccountsPerDevice))
			}
		}
	}

	// Continue with normal registration
	response, err := s.Register(ctx, input)
	if err != nil {
		return nil, err
	}

	// Record device registration if successful
	if deviceFingerprint != "" && deviceTracker != nil && response != nil {
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
		if err := deviceTracker.RecordDeviceRegistration(ctx, int(response.UserID), fingerprintHash, ip, userAgent); err != nil {
			logger.Warn("Failed to record device registration", zap.Error(err))
		}
	}

	return response, nil
}

// Register registers a new user
func (s *EntAuthService) Register(ctx context.Context, input validators.RegisterInput) (*RegisterResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Normalize email
	email := strings.TrimSpace(strings.ToLower(input.Email))
	password := strings.TrimSpace(input.Password)

	// Check if email already exists
	existingUser, err := s.client.User.
		Query().
		Where(user.EmailEqualFold(email)).
		Only(ctx)
	if err == nil {
		// Email exists - check if verified
		if existingUser.EmailVerified {
			return nil, apperrors.ErrEmailAlreadyExists
		} else {
			// Not verified - delete old user for re-registration
			logger.Info("Deleting unverified user for re-registration",
				zap.Int("user_id", existingUser.ID),
				zap.String("email", email))

			if err := s.deleteUnverifiedUser(ctx, existingUser); err != nil {
				logger.Warn("Failed to delete unverified user", zap.Error(err), zap.String("email", email))
			}
		}
	} else if !ent.IsNotFound(err) {
		logger.Error("Failed to check email existence", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa email")
	}

	// Check if username already exists (if provided)
	if input.Username != nil && *input.Username != "" {
		username := strings.TrimSpace(*input.Username)
		exists, err := s.client.User.
			Query().
			Where(user.UsernameEQ(username)).
			Exist(ctx)
		if err != nil {
			logger.Error("Failed to check username existence", zap.Error(err))
			return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa username")
		}
		if exists {
			return nil, apperrors.ErrUsernameAlreadyExists
		}
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash password", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal memproses password")
	}

	// Create user using transaction
	var createdUser *ent.User
	err = WithTx(ctx, s.client, func(tx *ent.Tx) error {
		// Double check email doesn't exist with verified status
		exists, err := tx.User.
			Query().
			Where(user.EmailEQ(email), user.EmailVerifiedEQ(true)).
			Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			return apperrors.ErrEmailAlreadyExists
		}

		// Create user
		create := tx.User.
			Create().
			SetEmail(email).
			SetPasswordHash(string(hash)).
			SetEmailVerified(false).
			SetAvatarURL("")

		if input.Username != nil {
			create.SetUsername(*input.Username)
		}
		if input.FullName != nil {
			create.SetFullName(*input.FullName)
		}

		createdUser, err = create.Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				if strings.Contains(err.Error(), "email") {
					return apperrors.ErrEmailAlreadyExists
				}
				if strings.Contains(err.Error(), "username") {
					return apperrors.ErrUsernameAlreadyExists
				}
			}
			return apperrors.ErrDatabase.WithDetails("Gagal mendaftarkan pengguna")
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	// Create verification token
	token, _, err := s.createVerificationToken(ctx, createdUser)
	if err != nil {
		logger.Error("Failed to create verification token", zap.Error(err), zap.Int("user_id", createdUser.ID))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat token verifikasi")
	}

	// Send verification email asynchronously via queue
	if err := utils.QueueVerificationEmail(createdUser.Email, token); err != nil {
		logger.Warn("Failed to queue verification email", zap.Error(err), zap.String("email", email))
	}

	// Log successful registration
	if securityAudit != nil {
		securityAudit.LogRegister(ctx, createdUser.ID, email, "", "")
	}

	logger.Info("User registered successfully",
		zap.Int("user_id", createdUser.ID),
		zap.String("email", email))

	return &RegisterResponse{
		Message:              "Registrasi berhasil. Silakan verifikasi email Anda.",
		UserID:               uint(createdUser.ID),
		RequiresVerification: true,
	}, nil
}

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
