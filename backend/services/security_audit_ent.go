package services

import (
	"context"
	"fmt"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/securityevent"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// EntSecurityAuditService handles security event logging using Ent ORM
type EntSecurityAuditService struct{}

// NewEntSecurityAuditService creates a new Ent-based security audit service
func NewEntSecurityAuditService() *EntSecurityAuditService {
	return &EntSecurityAuditService{}
}

// LogEvent logs a security event using Ent
func (s *EntSecurityAuditService) LogEvent(ctx context.Context, eventType SecurityEventType, userID *int, email, ip, userAgent, details, severity string, success bool) {
	// Always log to application logger
	logFields := []zap.Field{
		zap.String("event_type", string(eventType)),
		zap.String("email", email),
		zap.String("ip", ip),
		zap.Bool("success", success),
		zap.String("severity", severity),
	}

	if userID != nil {
		logFields = append(logFields, zap.Int("user_id", *userID))
	}

	if details != "" {
		logFields = append(logFields, zap.String("details", details))
	}

	switch severity {
	case "critical":
		logger.Error("[SECURITY-AUDIT] "+string(eventType), logFields...)
	case "warning":
		logger.Warn("[SECURITY-AUDIT] "+string(eventType), logFields...)
	default:
		logger.Info("[SECURITY-AUDIT] "+string(eventType), logFields...)
	}

	// Persist to database using Ent
	client := database.GetEntClient()
	builder := client.SecurityEvent.Create().
		SetEventType(string(eventType)).
		SetEmail(email).
		SetIPAddress(ip).
		SetUserAgent(userAgent).
		SetSuccess(success).
		SetDetails(details).
		SetSeverity(severity)

	if userID != nil {
		builder.SetUserID(*userID)
	}

	if _, err := builder.Save(ctx); err != nil {
		logger.Error("Failed to persist security event",
			zap.Error(err),
			zap.String("event_type", string(eventType)))
	}
}

// LogLoginSuccess logs a successful login
func (s *EntSecurityAuditService) LogLoginSuccess(ctx context.Context, user *ent.User, ip, userAgent string) {
	userID := user.ID
	s.LogEvent(ctx, EventLoginSuccess, &userID, user.Email, ip, userAgent, "", "info", true)
}

// LogLoginFailed logs a failed login attempt
func (s *EntSecurityAuditService) LogLoginFailed(ctx context.Context, email, ip, userAgent, reason string) {
	s.LogEvent(ctx, EventLoginFailed, nil, email, ip, userAgent, reason, "warning", false)
}

// LogAccountLocked logs when an account is locked
func (s *EntSecurityAuditService) LogAccountLocked(ctx context.Context, user *ent.User, ip, reason string, duration time.Duration) {
	userID := user.ID
	details := reason + " - Locked for " + duration.String()
	s.LogEvent(ctx, EventAccountLocked, &userID, user.Email, ip, "", details, "critical", false)
}

// LogBruteForceDetected logs brute force attack detection
func (s *EntSecurityAuditService) LogBruteForceDetected(ctx context.Context, email, ip string, attempts int) {
	details := fmt.Sprintf("%d failed attempts detected", attempts)
	s.LogEvent(ctx, EventBruteForce, nil, email, ip, "", details, "critical", false)
}

// LogTOTPFailed logs a failed TOTP attempt
func (s *EntSecurityAuditService) LogTOTPFailed(ctx context.Context, user *ent.User, ip, userAgent string, attemptsRemaining int) {
	userID := user.ID
	details := fmt.Sprintf("%d attempts remaining", attemptsRemaining)
	s.LogEvent(ctx, EventTOTPFailed, &userID, user.Email, ip, userAgent, details, "warning", false)
}

// LogTOTPMaxAttempts logs when TOTP max attempts exceeded
func (s *EntSecurityAuditService) LogTOTPMaxAttempts(ctx context.Context, user *ent.User, ip string) {
	userID := user.ID
	s.LogEvent(ctx, EventTOTPMaxAttempts, &userID, user.Email, ip, "", "TOTP verification blocked - max attempts exceeded", "critical", false)
}

// LogTOTPSuccess logs successful TOTP verification
func (s *EntSecurityAuditService) LogTOTPSuccess(ctx context.Context, user *ent.User, ip, userAgent string) {
	userID := user.ID
	s.LogEvent(ctx, EventTOTPSuccess, &userID, user.Email, ip, userAgent, "", "info", true)
}

// LogSessionCreated logs new session creation
func (s *EntSecurityAuditService) LogSessionCreated(ctx context.Context, user *ent.User, ip, userAgent string) {
	userID := user.ID
	s.LogEvent(ctx, EventSessionCreated, &userID, user.Email, ip, userAgent, "", "info", true)
}

// LogTokenReuse logs refresh token reuse detection
func (s *EntSecurityAuditService) LogTokenReuse(ctx context.Context, user *ent.User, ip, userAgent string) {
	userID := user.ID
	s.LogEvent(ctx, EventTokenReuse, &userID, user.Email, ip, userAgent, "Refresh token reuse detected - possible token theft", "critical", false)
}

// LogPasswordChanged logs password change
func (s *EntSecurityAuditService) LogPasswordChanged(ctx context.Context, user *ent.User, ip string) {
	userID := user.ID
	s.LogEvent(ctx, EventPasswordChanged, &userID, user.Email, ip, "", "", "info", true)
}

// LogSudoActivated logs sudo mode activation
func (s *EntSecurityAuditService) LogSudoActivated(ctx context.Context, user *ent.User, ip, userAgent string) {
	userID := user.ID
	s.LogEvent(ctx, EventSudoActivated, &userID, user.Email, ip, userAgent, "", "info", true)
}

// LogPasskeyAdded logs when a passkey is added
func (s *EntSecurityAuditService) LogPasskeyAdded(ctx context.Context, user *ent.User, ip, userAgent, passkeyName string) {
	userID := user.ID
	s.LogEvent(ctx, EventPasskeyAdded, &userID, user.Email, ip, userAgent, "Passkey added: "+passkeyName, "info", true)
}

// LogPasskeyRemoved logs when a passkey is removed
func (s *EntSecurityAuditService) LogPasskeyRemoved(ctx context.Context, user *ent.User, ip, userAgent, passkeyName string) {
	userID := user.ID
	s.LogEvent(ctx, EventPasskeyRemoved, &userID, user.Email, ip, userAgent, "Passkey removed: "+passkeyName, "warning", true)
}

// LogPasskeyLogin logs passkey login
func (s *EntSecurityAuditService) LogPasskeyLogin(ctx context.Context, user *ent.User, ip, userAgent string) {
	userID := user.ID
	s.LogEvent(ctx, EventPasskeyLogin, &userID, user.Email, ip, userAgent, "", "info", true)
}

// LogAccountDeleted logs account deletion
func (s *EntSecurityAuditService) LogAccountDeleted(ctx context.Context, userID int, email, ip, userAgent string) {
	s.LogEvent(ctx, EventAccountDeleted, &userID, email, ip, userAgent, "Account permanently deleted", "critical", true)
}

// GetRecentEvents retrieves recent security events for a user
func (s *EntSecurityAuditService) GetRecentEvents(ctx context.Context, userID int, limit int) ([]*ent.SecurityEvent, error) {
	client := database.GetEntClient()
	return client.SecurityEvent.Query().
		Where(securityevent.UserIDEQ(userID)).
		Order(ent.Desc(securityevent.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
}

// GetFailedLoginsByIP retrieves failed logins from an IP in the last hour
func (s *EntSecurityAuditService) GetFailedLoginsByIP(ctx context.Context, ip string, since time.Time) (int, error) {
	client := database.GetEntClient()
	return client.SecurityEvent.Query().
		Where(
			securityevent.IPAddressEQ(ip),
			securityevent.EventTypeEQ(string(EventLoginFailed)),
			securityevent.CreatedAtGT(since),
		).
		Count(ctx)
}

// CleanupOldEvents removes events older than retention period
func (s *EntSecurityAuditService) CleanupOldEvents(ctx context.Context, retentionDays int) (int, error) {
	client := database.GetEntClient()
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	return client.SecurityEvent.Delete().
		Where(securityevent.CreatedAtLT(cutoff)).
		Exec(ctx)
}
