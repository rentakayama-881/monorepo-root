package services

import (
	"fmt"
	"time"

	"backend-gin/ent"
	"backend-gin/logger"
	"backend-gin/models"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SecurityEventType represents different types of security events
type SecurityEventType string

const (
	// Login events
	EventLoginSuccess    SecurityEventType = "login_success"
	EventLoginFailed     SecurityEventType = "login_failed"
	EventLoginLocked     SecurityEventType = "login_locked"
	EventAccountLocked   SecurityEventType = "account_locked"
	EventAccountUnlocked SecurityEventType = "account_unlocked"

	// TOTP events
	EventTOTPEnabled     SecurityEventType = "totp_enabled"
	EventTOTPDisabled    SecurityEventType = "totp_disabled"
	EventTOTPSuccess     SecurityEventType = "totp_success"
	EventTOTPFailed      SecurityEventType = "totp_failed"
	EventTOTPMaxAttempts SecurityEventType = "totp_max_attempts"

	// Password events
	EventPasswordChanged  SecurityEventType = "password_changed"
	EventPasswordResetReq SecurityEventType = "password_reset_requested"
	EventPasswordReset    SecurityEventType = "password_reset"

	// Session events
	EventSessionCreated   SecurityEventType = "session_created"
	EventSessionRefreshed SecurityEventType = "session_refreshed"
	EventSessionRevoked   SecurityEventType = "session_revoked"
	EventTokenReuse       SecurityEventType = "token_reuse_detected"

	// Passkey events
	EventPasskeyAdded   SecurityEventType = "passkey_added"
	EventPasskeyRemoved SecurityEventType = "passkey_removed"
	EventPasskeyLogin   SecurityEventType = "passkey_login"

	// Critical actions
	EventSudoActivated  SecurityEventType = "sudo_activated"
	EventAccountDeleted SecurityEventType = "account_deleted"
	EventEmailChanged   SecurityEventType = "email_changed"

	// Suspicious activity
	EventSuspiciousIP   SecurityEventType = "suspicious_ip"
	EventDeviceRotation SecurityEventType = "device_rotation"
	EventIPRotation     SecurityEventType = "ip_rotation"
	EventBruteForce     SecurityEventType = "brute_force_detected"
)

// SecurityEvent represents a security audit log entry
type SecurityEvent struct {
	gorm.Model
	UserID    *uint             `gorm:"index"`          // Nullable for pre-auth events
	Email     string            `gorm:"size:255;index"` // Email involved
	EventType SecurityEventType `gorm:"size:50;not null;index"`
	IPAddress string            `gorm:"size:45"`
	UserAgent string            `gorm:"size:512"`
	Success   bool              `gorm:"default:false"`
	Details   string            `gorm:"type:text"`              // JSON details
	Severity  string            `gorm:"size:20;default:'info'"` // info, warning, critical
	Country   string            `gorm:"size:2"`                 // ISO country code
	City      string            `gorm:"size:100"`
}

// SecurityAuditService handles security event logging
type SecurityAuditService struct {
	db *gorm.DB
}

// NewSecurityAuditService creates a new security audit service
func NewSecurityAuditService(db *gorm.DB) *SecurityAuditService {
	return &SecurityAuditService{db: db}
}

// LogEvent logs a security event
func (s *SecurityAuditService) LogEvent(event SecurityEvent) {
	// Always log to application logger
	logFields := []zap.Field{
		zap.String("event_type", string(event.EventType)),
		zap.String("email", event.Email),
		zap.String("ip", event.IPAddress),
		zap.Bool("success", event.Success),
		zap.String("severity", event.Severity),
	}

	if event.UserID != nil {
		logFields = append(logFields, zap.Uint("user_id", *event.UserID))
	}

	if event.Details != "" {
		logFields = append(logFields, zap.String("details", event.Details))
	}

	switch event.Severity {
	case "critical":
		logger.Error("[SECURITY-AUDIT] "+string(event.EventType), logFields...)
	case "warning":
		logger.Warn("[SECURITY-AUDIT] "+string(event.EventType), logFields...)
	default:
		logger.Info("[SECURITY-AUDIT] "+string(event.EventType), logFields...)
	}

	// Persist to database
	if err := s.db.Create(&event).Error; err != nil {
		logger.Error("Failed to persist security event",
			zap.Error(err),
			zap.String("event_type", string(event.EventType)))
	}
}

// LogLoginSuccess logs a successful login
func (s *SecurityAuditService) LogLoginSuccess(user *models.User, ip, userAgent string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventLoginSuccess,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// LogLoginFailed logs a failed login attempt
func (s *SecurityAuditService) LogLoginFailed(email, ip, userAgent, reason string) {
	s.LogEvent(SecurityEvent{
		Email:     email,
		EventType: EventLoginFailed,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   false,
		Details:   reason,
		Severity:  "warning",
	})
}

// LogAccountLocked logs when an account is locked
func (s *SecurityAuditService) LogAccountLocked(user *models.User, ip, reason string, duration time.Duration) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventAccountLocked,
		IPAddress: ip,
		Success:   false,
		Details:   reason + " - Locked for " + duration.String(),
		Severity:  "critical",
	})
}

// LogBruteForceDetected logs brute force attack detection
func (s *SecurityAuditService) LogBruteForceDetected(email, ip string, attempts int) {
	s.LogEvent(SecurityEvent{
		Email:     email,
		EventType: EventBruteForce,
		IPAddress: ip,
		Success:   false,
		Details:   fmt.Sprintf("%d failed attempts detected", attempts),
		Severity:  "critical",
	})
}

// LogTOTPFailed logs a failed TOTP attempt
func (s *SecurityAuditService) LogTOTPFailed(user *models.User, ip, userAgent string, attemptsRemaining int) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventTOTPFailed,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   false,
		Details:   fmt.Sprintf("%d attempts remaining", attemptsRemaining),
		Severity:  "warning",
	})
}

// LogTOTPMaxAttempts logs when TOTP max attempts exceeded
func (s *SecurityAuditService) LogTOTPMaxAttempts(user *models.User, ip string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventTOTPMaxAttempts,
		IPAddress: ip,
		Success:   false,
		Details:   "TOTP verification blocked - max attempts exceeded",
		Severity:  "critical",
	})
}

// LogTOTPSuccess logs successful TOTP verification
func (s *SecurityAuditService) LogTOTPSuccess(user *models.User, ip, userAgent string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventTOTPSuccess,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// LogSessionCreated logs new session creation
func (s *SecurityAuditService) LogSessionCreated(user *models.User, ip, userAgent string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventSessionCreated,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// LogTokenReuse logs refresh token reuse detection
func (s *SecurityAuditService) LogTokenReuse(user *models.User, ip, userAgent string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventTokenReuse,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   false,
		Details:   "Refresh token reuse detected - possible token theft",
		Severity:  "critical",
	})
}

// LogPasswordChanged logs password change
func (s *SecurityAuditService) LogPasswordChanged(user *models.User, ip string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventPasswordChanged,
		IPAddress: ip,
		Success:   true,
		Severity:  "info",
	})
}

// LogSudoActivated logs sudo mode activation
func (s *SecurityAuditService) LogSudoActivated(user *models.User, ip, userAgent string) {
	s.LogEvent(SecurityEvent{
		UserID:    &user.ID,
		Email:     user.Email,
		EventType: EventSudoActivated,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// GetRecentEvents retrieves recent security events for a user
func (s *SecurityAuditService) GetRecentEvents(userID uint, limit int) ([]SecurityEvent, error) {
	var events []SecurityEvent
	err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

// GetFailedLoginsByIP retrieves failed logins from an IP in the last hour
func (s *SecurityAuditService) GetFailedLoginsByIP(ip string, since time.Time) (int64, error) {
	var count int64
	err := s.db.Model(&SecurityEvent{}).
		Where("ip_address = ? AND event_type = ? AND created_at > ?",
			ip, EventLoginFailed, since).
		Count(&count).Error
	return count, err
}

// CleanupOldEvents removes events older than retention period
func (s *SecurityAuditService) CleanupOldEvents(retentionDays int) error {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	return s.db.Where("created_at < ?", cutoff).Delete(&SecurityEvent{}).Error
}

// ========== Ent-compatible helper methods ==========

// LogSessionCreatedForEnt logs new session creation for Ent user
func (s *SecurityAuditService) LogSessionCreatedForEnt(user *ent.User, ip, userAgent string) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventSessionCreated,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// LogTokenReuseForEnt logs refresh token reuse detection for Ent user
func (s *SecurityAuditService) LogTokenReuseForEnt(user *ent.User, ip, userAgent string) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventTokenReuse,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   false,
		Details:   "Refresh token reuse detected - possible token theft",
		Severity:  "critical",
	})
}

// LogLoginSuccessForEnt logs a successful login for Ent user
func (s *SecurityAuditService) LogLoginSuccessForEnt(user *ent.User, ip, userAgent string) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventLoginSuccess,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// LogAccountLockedForEnt logs when an account is locked for Ent user
func (s *SecurityAuditService) LogAccountLockedForEnt(user *ent.User, ip, reason string, duration time.Duration) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventAccountLocked,
		IPAddress: ip,
		Success:   false,
		Details:   reason + " - Locked for " + duration.String(),
		Severity:  "critical",
	})
}

// LogTOTPSuccessForEnt logs successful TOTP verification for Ent user
func (s *SecurityAuditService) LogTOTPSuccessForEnt(user *ent.User, ip, userAgent string) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventTOTPSuccess,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}

// LogTOTPFailedForEnt logs a failed TOTP attempt for Ent user
func (s *SecurityAuditService) LogTOTPFailedForEnt(user *ent.User, ip, userAgent string, attemptsRemaining int) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventTOTPFailed,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   false,
		Details:   fmt.Sprintf("%d attempts remaining", attemptsRemaining),
		Severity:  "warning",
	})
}

// LogPasswordChangedForEnt logs password change for Ent user
func (s *SecurityAuditService) LogPasswordChangedForEnt(user *ent.User, ip string) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventPasswordChanged,
		IPAddress: ip,
		Success:   true,
		Severity:  "info",
	})
}

// LogSudoActivatedForEnt logs sudo mode activation for Ent user
func (s *SecurityAuditService) LogSudoActivatedForEnt(user *ent.User, ip, userAgent string) {
	userID := uint(user.ID)
	s.LogEvent(SecurityEvent{
		UserID:    &userID,
		Email:     user.Email,
		EventType: EventSudoActivated,
		IPAddress: ip,
		UserAgent: userAgent,
		Success:   true,
		Severity:  "info",
	})
}
