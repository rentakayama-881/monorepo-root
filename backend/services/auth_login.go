package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/sessionlock"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/validators"

	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

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
			_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(input.Password))
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
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

		// Check Feature Service admin bans first (highest priority)
		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, fingerprintHash); banned {
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
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

		// Check Feature Service admin bans (highest priority)
		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, fingerprintHash); banned {
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
