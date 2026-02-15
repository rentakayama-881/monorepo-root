package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/emailverificationtoken"
	"backend-gin/ent/passwordresettoken"
	"backend-gin/ent/sessionlock"
	"backend-gin/ent/totppendingtoken"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/utils"
	"backend-gin/validators"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// EntAuthService handles authentication business logic using Ent ORM
type EntAuthService struct {
	client *ent.Client
}

// NewEntAuthService creates a new auth service with Ent
func NewEntAuthService() *EntAuthService {
	return &EntAuthService{client: database.GetEntClient()}
}

// strVal safely dereferences a string pointer, returning empty string if nil
func strVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// RegisterWithDevice registers a new user with device fingerprint tracking
func (s *EntAuthService) RegisterWithDevice(ctx context.Context, input validators.RegisterInput, deviceFingerprint, ip, userAgent string) (*RegisterResponse, error) {
	// Check device limit if fingerprint provided
	if deviceFingerprint != "" {
		// Check Feature Service admin bans first (highest priority)
		if deviceBanChecker != nil {
			if banned, reason, err := deviceBanChecker.IsDeviceBanned(ctx, deviceFingerprint); banned {
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
			fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

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

// LoginWithSession authenticates a user and creates a session with token pair
func (s *EntAuthService) LoginWithSession(ctx context.Context, input validators.LoginInput, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	email := strings.TrimSpace(strings.ToLower(input.Email))

	// Check if account is locked by login tracker (brute force protection)
	if loginTracker != nil {
		if locked, lockedUntil := loginTracker.IsLocked(email); locked {
			if securityAudit != nil {
				securityAudit.LogLoginFailed(email, ipAddress, userAgent, "Account locked - brute force protection")
			}
			remaining := time.Until(*lockedUntil)
			return nil, apperrors.ErrAccountLockedBruteForce.WithDetails(
				fmt.Sprintf("Akun dikunci selama %s akibat terlalu banyak percobaan gagal", formatDuration(remaining)))
		}

		// Apply progressive delay
		delay := loginTracker.GetDelay(email)
		if delay > 0 {
			time.Sleep(delay)
		}
	}

	// Find user
	u, err := s.client.User.
		Query().
		Where(user.EmailEQ(email)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			logger.Debug("Login attempt for non-existent user", zap.String("email", email))
			if loginTracker != nil {
				locked, _, _ := loginTracker.RecordFailedLogin(email, ipAddress)
				if locked && securityAudit != nil {
					securityAudit.LogBruteForceDetected(email, ipAddress, MaxLoginAttempts)
				}
			}
			if securityAudit != nil {
				securityAudit.LogLoginFailed(email, ipAddress, userAgent, "User not found")
			}
			return nil, apperrors.ErrInvalidCredentials
		}
		logger.Error("Failed to query user", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal memeriksa kredensial")
	}

	// Check if user account is locked in database
	if u.LockedUntil != nil && u.LockedUntil.After(time.Now()) {
		remaining := time.Until(*u.LockedUntil)
		reason := u.LockReason
		if securityAudit != nil {
			securityAudit.LogLoginFailed(email, ipAddress, userAgent, "Account locked in database")
		}
		return nil, apperrors.ErrAccountLockedBruteForce.WithDetails(
			fmt.Sprintf("Akun dikunci selama %s. Alasan: %s", formatDuration(remaining), reason))
	}

	// Check session lock (legacy)
	lock, err := s.client.SessionLock.
		Query().
		Where(sessionlock.UserIDEQ(u.ID)).
		Order(ent.Desc(sessionlock.FieldCreatedAt)).
		First(ctx)
	if err == nil && lock.ExpiresAt.After(time.Now()) {
		return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
	}

	// Device ban checks BEFORE password verification:
	// 1. Avoids expensive bcrypt on banned devices
	// 2. Prevents banned devices from testing passwords (info leak)
	// Order: Feature Service admin bans (highest priority) → local device tracker
	if deviceFingerprint != "" {
		// Check Feature Service admin bans first (highest priority)
		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, deviceFingerprint); banned {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     email,
						EventType: "login_device_banned",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   "Device banned by admin: " + reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			} else if banErr != nil {
				logger.Debug("Device ban check error (will continue)", zap.Error(banErr))
			}
		}

		// Check PostgreSQL device tracker
		if deviceTracker != nil {
			fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

			// Check if device is blocked
			if blocked, reason := deviceTracker.IsDeviceBlocked(ctx, fingerprintHash); blocked {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     email,
						EventType: "login_device_blocked",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			}
		}
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.Password)); err != nil {
		logger.Debug("Invalid password attempt", zap.String("email", email))

		if loginTracker != nil {
			locked, _, _ := loginTracker.RecordFailedLogin(email, ipAddress)
			if locked {
				// Persist lock to database
				_, _ = s.client.User.
					UpdateOneID(u.ID).
					SetLockedUntil(time.Now().Add(LockoutDuration)).
					SetLockReason("Terlalu banyak percobaan login gagal").
					Save(ctx)

				if securityAudit != nil {
					securityAudit.LogAccountLockedForEnt(u, ipAddress, "Brute force protection triggered", LockoutDuration)
					securityAudit.LogBruteForceDetected(email, ipAddress, MaxLoginAttempts)
				}
			}
		}

		if securityAudit != nil {
			securityAudit.LogLoginFailed(email, ipAddress, userAgent, "Invalid password")
		}
		return nil, apperrors.ErrInvalidCredentials
	}

	// Check email verification
	if !u.EmailVerified {
		return nil, apperrors.ErrEmailNotVerified
	}

	// Successful password verification - reset failed attempts
	if loginTracker != nil {
		loginTracker.ResetAttempts(email)
	}

	username := ""
	if u.Username != nil {
		username = *u.Username
	}

	// Check if TOTP is enabled
	if u.TotpSecret != nil && *u.TotpSecret != "" && u.TotpVerified {
		// Generate a temporary token for TOTP verification step
		pendingToken, err := s.generateTOTPPendingToken(ctx, u.ID)
		if err != nil {
			logger.Error("Failed to generate TOTP pending token", zap.Error(err))
			return nil, apperrors.ErrInternalServer
		}

		logger.Info("Login requires TOTP verification",
			zap.Int("user_id", u.ID),
			zap.String("email", email))

		return &LoginResponse{
			RequiresTOTP: true,
			TOTPPending:  pendingToken,
			Email:        u.Email,
			Username:     username,
			FullName:     strVal(u.FullName),
		}, nil
	}

	// Create session with token pair (no TOTP required)
	sessionService := NewEntSessionService()
	tokenPair, err := sessionService.CreateSession(ctx, u, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	// Record device login if fingerprint provided
	if deviceFingerprint != "" && deviceTracker != nil {
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
		if err := deviceTracker.RecordDeviceLogin(ctx, u.ID, fingerprintHash, ipAddress, userAgent); err != nil {
			logger.Warn("Failed to record device login", zap.Error(err))
		}
	}

	// Record successful login
	if loginTracker != nil {
		// Convert Ent user to models.User for login tracker
		modelUser := entUserToModel(u)
		_ = loginTracker.RecordSuccessfulLogin(modelUser, ipAddress)
	}
	if securityAudit != nil {
		securityAudit.LogLoginSuccessForEnt(u, ipAddress, userAgent)
		securityAudit.LogSessionCreatedForEnt(u, ipAddress, userAgent)
	}

	logger.Info("User logged in successfully",
		zap.Int("user_id", u.ID),
		zap.String("email", email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        u.Email,
		Username:     username,
		FullName:     strVal(u.FullName),
		RequiresTOTP: false,
	}, nil
}

// LoginWithPasskey creates a session for a user authenticated via passkey
func (s *EntAuthService) LoginWithPasskey(ctx context.Context, u *ent.User, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	logger.Info("LoginWithPasskey called",
		zap.Int("user_id", u.ID),
		zap.String("email", u.Email),
		zap.Bool("email_verified", u.EmailVerified),
		zap.String("ip", ipAddress),
	)

	// Re-fetch fresh user data
	freshUser, err := s.client.User.Get(ctx, u.ID)
	if err != nil {
		logger.Error("Failed to fetch fresh user data", zap.Error(err))
		return nil, apperrors.ErrInternalServer
	}

	// Check if account is locked in database (brute force, impossible travel, etc.)
	if freshUser.LockedUntil != nil && freshUser.LockedUntil.After(time.Now()) {
		remaining := time.Until(*freshUser.LockedUntil)
		reason := freshUser.LockReason
		return nil, apperrors.ErrAccountLockedBruteForce.WithDetails(
			fmt.Sprintf("Akun dikunci selama %s. Alasan: %s", formatDuration(remaining), reason))
	}

	// Check session lock (legacy)
	lock, err := s.client.SessionLock.
		Query().
		Where(sessionlock.UserIDEQ(freshUser.ID)).
		Order(ent.Desc(sessionlock.FieldCreatedAt)).
		First(ctx)
	if err == nil && lock.ExpiresAt.After(time.Now()) {
		return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
	}

	if !freshUser.EmailVerified {
		logger.Warn("Email not verified for passkey login",
			zap.Int("user_id", freshUser.ID),
			zap.String("email", freshUser.Email),
		)
		return nil, apperrors.ErrEmailNotVerified
	}

	// Check device status if fingerprint provided
	if deviceFingerprint != "" {
		// Check Feature Service admin bans (highest priority)
		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, deviceFingerprint); banned {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     freshUser.Email,
						EventType: "passkey_login_device_banned",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   "Device banned by admin: " + reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			} else if banErr != nil {
				logger.Debug("Device ban check error (will continue)", zap.Error(banErr))
			}
		}

		// Check PostgreSQL device tracker
		if deviceTracker != nil {
			fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
			if blocked, reason := deviceTracker.IsDeviceBlocked(ctx, fingerprintHash); blocked {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     freshUser.Email,
						EventType: "passkey_login_device_blocked",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			}
		}
	}

	username := ""
	if freshUser.Username != nil {
		username = *freshUser.Username
	}

	// Create session with token pair
	sessionService := NewEntSessionService()
	tokenPair, err := sessionService.CreateSession(ctx, freshUser, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	// Record device login if fingerprint provided
	if deviceFingerprint != "" && deviceTracker != nil {
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
		if err := deviceTracker.RecordDeviceLogin(ctx, freshUser.ID, fingerprintHash, ipAddress, userAgent); err != nil {
			logger.Warn("Failed to record device login for passkey", zap.Error(err))
		}
	}

	logger.Info("User logged in via passkey",
		zap.Int("user_id", freshUser.ID),
		zap.String("email", freshUser.Email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        freshUser.Email,
		Username:     username,
		FullName:     strVal(freshUser.FullName),
		RequiresTOTP: false,
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

// CompleteTOTPLogin completes login after TOTP verification
func (s *EntAuthService) CompleteTOTPLogin(ctx context.Context, pendingToken, totpCode string, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	// Validate pending token and get user
	u, pending, err := s.validateTOTPPendingToken(ctx, pendingToken)
	if err != nil {
		return nil, err
	}

	// Check TOTP attempt limits
	if loginTracker != nil {
		attemptsRemaining := loginTracker.GetTOTPAttemptsRemaining(u.Email)
		if attemptsRemaining <= 0 {
			if securityAudit != nil {
				securityAudit.LogTOTPMaxAttempts(entUserToModel(u), ipAddress)
			}
			return nil, apperrors.ErrTOTPMaxAttempts
		}
	}

	// Verify TOTP is still enabled
	if u.TotpSecret == nil || *u.TotpSecret == "" || !u.TotpVerified {
		return nil, apperrors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak lagi aktif. Silakan login ulang.", 400)
	}

	// Check if account is locked
	lock, err := s.client.SessionLock.
		Query().
		Where(sessionlock.UserIDEQ(u.ID)).
		Order(ent.Desc(sessionlock.FieldCreatedAt)).
		First(ctx)
	if err == nil && lock.ExpiresAt.After(time.Now()) {
		return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
	}

	// Check device status if fingerprint provided
	if deviceFingerprint != "" {
		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, deviceFingerprint); banned {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     u.Email,
						EventType: "totp_login_device_banned",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   "Device banned by admin: " + reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			} else if banErr != nil {
				logger.Debug("Device ban check error (will continue)", zap.Error(banErr))
			}
		}
		if deviceTracker != nil {
			fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
			if blocked, reason := deviceTracker.IsDeviceBlocked(ctx, fingerprintHash); blocked {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     u.Email,
						EventType: "totp_login_device_blocked",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			}
		}
	}

	// Verify TOTP code using Ent-based TOTP service
	totpEntService := NewEntTOTPService(logger.GetLogger())
	valid, err := totpEntService.Verify(ctx, u.ID, totpCode)
	if err != nil {
		return nil, err
	}
	if !valid {
		if loginTracker != nil {
			_, attemptsRemaining := loginTracker.RecordTOTPAttempt(u.Email)
			if securityAudit != nil {
				securityAudit.LogTOTPFailedForEnt(u, ipAddress, userAgent, attemptsRemaining)
			}
		}
		return nil, apperrors.NewAppError("TOTP_INVALID_CODE", "Kode 2FA tidak valid", 401)
	}

	// Reset TOTP attempts on success
	if loginTracker != nil {
		loginTracker.ResetTOTPAttempts(u.Email)
	}

	// Consume pending token only after successful TOTP verification.
	if err := s.consumeTOTPPendingToken(ctx, pending.ID); err != nil {
		return nil, err
	}

	// Create session with token pair
	sessionService := NewEntSessionService()
	tokenPair, err := sessionService.CreateSession(ctx, u, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	// Record device login if fingerprint provided
	if deviceFingerprint != "" && deviceTracker != nil {
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
		if err := deviceTracker.RecordDeviceLogin(ctx, u.ID, fingerprintHash, ipAddress, userAgent); err != nil {
			logger.Warn("Failed to record device login for TOTP", zap.Error(err))
		}
	}

	// Record successful login
	if loginTracker != nil {
		_ = loginTracker.RecordSuccessfulLogin(entUserToModel(u), ipAddress)
	}
	if securityAudit != nil {
		securityAudit.LogTOTPSuccessForEnt(u, ipAddress, userAgent)
		securityAudit.LogLoginSuccessForEnt(u, ipAddress, userAgent)
		securityAudit.LogSessionCreatedForEnt(u, ipAddress, userAgent)
	}

	username := ""
	if u.Username != nil {
		username = *u.Username
	}

	logger.Info("User completed TOTP login",
		zap.Int("user_id", u.ID),
		zap.String("email", u.Email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        u.Email,
		Username:     username,
		FullName:     strVal(u.FullName),
		RequiresTOTP: false,
	}, nil
}

// CompleteTOTPLoginWithBackupCode completes login using a backup code instead of TOTP
func (s *EntAuthService) CompleteTOTPLoginWithBackupCode(ctx context.Context, pendingToken, backupCode string, ipAddress, userAgent, deviceFingerprint string) (*LoginResponse, error) {
	// Validate pending token and get user
	u, pending, err := s.validateTOTPPendingToken(ctx, pendingToken)
	if err != nil {
		return nil, err
	}

	// Check backup code attempt limits
	if loginTracker != nil {
		attemptsRemaining := loginTracker.GetTOTPAttemptsRemaining(u.Email)
		if attemptsRemaining <= 0 {
			if securityAudit != nil {
				securityAudit.LogTOTPMaxAttempts(entUserToModel(u), ipAddress)
			}
			return nil, apperrors.ErrTOTPMaxAttempts
		}
	}

	// Verify TOTP is enabled (backup codes only work when 2FA is active)
	if !u.TotpEnabled || !u.TotpVerified {
		return nil, apperrors.NewAppError("TOTP_NOT_ENABLED", "2FA tidak aktif. Silakan login ulang.", 400)
	}

	// Check if account is locked
	lock, err := s.client.SessionLock.
		Query().
		Where(sessionlock.UserIDEQ(u.ID)).
		Order(ent.Desc(sessionlock.FieldCreatedAt)).
		First(ctx)
	if err == nil && lock.ExpiresAt.After(time.Now()) {
		return nil, apperrors.ErrAccountLocked.WithDetails("Akun terkunci hingga " + lock.ExpiresAt.Format("02 Jan 2006 15:04"))
	}

	// Check device status if fingerprint provided
	if deviceFingerprint != "" {
		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, deviceFingerprint); banned {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     u.Email,
						EventType: "backup_login_device_banned",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   "Device banned by admin: " + reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			} else if banErr != nil {
				logger.Debug("Device ban check error (will continue)", zap.Error(banErr))
			}
		}
		if deviceTracker != nil {
			fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
			if blocked, reason := deviceTracker.IsDeviceBlocked(ctx, fingerprintHash); blocked {
				if securityAudit != nil {
					securityAudit.LogEvent(SecurityEvent{
						Email:     u.Email,
						EventType: "backup_login_device_blocked",
						IPAddress: ipAddress,
						UserAgent: userAgent,
						Success:   false,
						Details:   reason,
						Severity:  "warning",
					})
				}
				return nil, apperrors.ErrDeviceBlocked
			}
		}
	}

	// Verify backup code using Ent-based TOTP service
	totpEntService := NewEntTOTPService(logger.GetLogger())
	valid, err := totpEntService.VerifyBackupCode(ctx, u.ID, backupCode)
	if err != nil {
		return nil, err
	}
	if !valid {
		if loginTracker != nil {
			_, attemptsRemaining := loginTracker.RecordTOTPAttempt(u.Email)
			if securityAudit != nil {
				userID := uint(u.ID)
				securityAudit.LogEvent(SecurityEvent{
					UserID:    &userID,
					Email:     u.Email,
					EventType: "backup_code_failed",
					IPAddress: ipAddress,
					UserAgent: userAgent,
					Success:   false,
					Details:   fmt.Sprintf("Attempts remaining: %d", attemptsRemaining),
					Severity:  "warning",
				})
			}
		}
		return nil, apperrors.NewAppError("BACKUP_CODE_INVALID", "Kode backup tidak valid atau sudah digunakan", 401)
	}

	// Reset TOTP attempts on success
	if loginTracker != nil {
		loginTracker.ResetTOTPAttempts(u.Email)
	}

	// Consume pending token only after successful backup code verification.
	if err := s.consumeTOTPPendingToken(ctx, pending.ID); err != nil {
		return nil, err
	}

	// Create session with token pair
	sessionService := NewEntSessionService()
	tokenPair, err := sessionService.CreateSession(ctx, u, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	// Record device login if fingerprint provided
	if deviceFingerprint != "" && deviceTracker != nil {
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)
		if err := deviceTracker.RecordDeviceLogin(ctx, u.ID, fingerprintHash, ipAddress, userAgent); err != nil {
			logger.Warn("Failed to record device login for backup code", zap.Error(err))
		}
	}

	// Record successful login
	if loginTracker != nil {
		_ = loginTracker.RecordSuccessfulLogin(entUserToModel(u), ipAddress)
	}
	if securityAudit != nil {
		userID := uint(u.ID)
		securityAudit.LogEvent(SecurityEvent{
			UserID:    &userID,
			Email:     u.Email,
			EventType: "backup_code_login_success",
			IPAddress: ipAddress,
			UserAgent: userAgent,
			Success:   true,
			Details:   "User logged in using backup code",
			Severity:  "info",
		})
		securityAudit.LogLoginSuccessForEnt(u, ipAddress, userAgent)
		securityAudit.LogSessionCreatedForEnt(u, ipAddress, userAgent)
	}

	username := ""
	if u.Username != nil {
		username = *u.Username
	}

	logger.Info("User completed backup code login",
		zap.Int("user_id", u.ID),
		zap.String("email", u.Email),
		zap.String("ip", ipAddress))

	return &LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		Email:        u.Email,
		Username:     username,
		FullName:     strVal(u.FullName),
		RequiresTOTP: false,
	}, nil
}

// Helper functions

// createVerificationToken creates a verification token for a user
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

// WithTx runs a function in a transaction
func WithTx(ctx context.Context, client *ent.Client, fn func(tx *ent.Tx) error) error {
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()
	if err := fn(tx); err != nil {
		if rerr := tx.Rollback(); rerr != nil {
			err = fmt.Errorf("%w: rolling back transaction: %v", err, rerr)
		}
		return err
	}
	return tx.Commit()
}

// entUserToModel converts Ent User to models.User for compatibility
func entUserToModel(u *ent.User) *User {
	modelUser := &User{
		Email:         u.Email,
		PasswordHash:  u.PasswordHash,
		EmailVerified: u.EmailVerified,
		AvatarURL:     u.AvatarURL,
		Username:      u.Username,
		FullName:      u.FullName,
	}
	modelUser.ID = uint(u.ID)
	modelUser.CreatedAt = u.CreatedAt
	modelUser.UpdatedAt = u.UpdatedAt

	if u.TotpSecret != nil {
		modelUser.TOTPSecret = *u.TotpSecret
	}
	if u.LockedUntil != nil {
		modelUser.LockedUntil = u.LockedUntil
	}
	modelUser.LockReason = u.LockReason

	return modelUser
}
