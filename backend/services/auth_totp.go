package services

import (
	"context"
	"fmt"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/sessionlock"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

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
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, fingerprintHash); banned {
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
		fingerprintHash := HashFingerprint(deviceFingerprint, userAgent)

		if deviceBanChecker != nil {
			if banned, reason, banErr := deviceBanChecker.IsDeviceBanned(ctx, fingerprintHash); banned {
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


