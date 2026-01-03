package handlers

import (
	"net/http"
	"time"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SecurityStatusHandler handles security status endpoints
type SecurityStatusHandler struct {
	db             *gorm.DB
	sessionService *services.SessionService
}

// NewSecurityStatusHandler creates a new security status handler
func NewSecurityStatusHandler(db *gorm.DB, sessionService *services.SessionService) *SecurityStatusHandler {
	return &SecurityStatusHandler{
		db:             db,
		sessionService: sessionService,
	}
}

// SecurityStatusResponse represents the security status response
type SecurityStatusResponse struct {
	// Account security
	EmailVerified       bool       `json:"email_verified"`
	TOTPEnabled         bool       `json:"totp_enabled"`
	PasskeysCount       int        `json:"passkeys_count"`
	PasswordLastChanged *time.Time `json:"password_last_changed,omitempty"`

	// Session security
	ActiveSessions    int64 `json:"active_sessions"`
	MaxSessions       int   `json:"max_sessions"`
	SessionsIn30Days  int64 `json:"sessions_30_days"`
	RevokedSessions   int64 `json:"revoked_sessions_30_days"`
	UniqueIPsIn30Days int   `json:"unique_ips_30_days"`

	// Anomaly detection
	HasAnomaly     bool   `json:"has_anomaly"`
	AnomalyDetails string `json:"anomaly_details,omitempty"`

	// Security events
	FailedLogins24h      int64                  `json:"failed_logins_24h"`
	SuccessfulLogins24h  int64                  `json:"successful_logins_24h"`
	RecentSecurityEvents []SecurityEventSummary `json:"recent_security_events"`

	// Recommendations
	SecurityScore   int      `json:"security_score"` // 0-100
	Recommendations []string `json:"recommendations"`
}

// SecurityEventSummary represents a summary of a security event
type SecurityEventSummary struct {
	EventType string    `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
	IPAddress string    `json:"ip_address"`
	Success   bool      `json:"success"`
	Severity  string    `json:"severity"`
}

// GetSecurityStatus returns the current user's security status
func (h *SecurityStatusHandler) GetSecurityStatus(c *gin.Context) {
	userID := c.GetUint("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH001",
				"message": "Autentikasi diperlukan",
			},
		})
		return
	}

	// Get user info
	var user struct {
		ID                  uint
		Email               string
		EmailVerified       bool
		TOTPEnabled         bool
		PasswordLastChanged *time.Time
	}
	if err := h.db.Table("users").
		Select("id, email, email_verified, totp_enabled, password_last_changed").
		Where("id = ?", userID).
		First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "USER_NOT_FOUND",
				"message": "User tidak ditemukan",
			},
		})
		return
	}

	// Get passkeys count
	var passkeysCount int64
	h.db.Table("credentials").Where("user_id = ?", userID).Count(&passkeysCount)

	// Get session security stats
	sessionStats := h.sessionService.GetSessionSecurityStats(userID)

	// Get failed logins in 24h
	var failedLogins24h int64
	h.db.Table("security_events").
		Where("user_id = ? AND event_type = ? AND created_at > ?",
			userID, "login_failed", time.Now().Add(-24*time.Hour)).
		Count(&failedLogins24h)

	// Get successful logins in 24h
	var successfulLogins24h int64
	h.db.Table("security_events").
		Where("user_id = ? AND event_type = ? AND created_at > ?",
			userID, "login_success", time.Now().Add(-24*time.Hour)).
		Count(&successfulLogins24h)

	// Get recent security events
	var events []services.SecurityEvent
	h.db.Table("security_events").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(10).
		Find(&events)

	eventSummaries := make([]SecurityEventSummary, len(events))
	for i, e := range events {
		// Mask IP address for privacy (show only first 2 octets)
		maskedIP := maskIP(e.IPAddress)
		eventSummaries[i] = SecurityEventSummary{
			EventType: string(e.EventType),
			Timestamp: e.CreatedAt,
			IPAddress: maskedIP,
			Success:   e.Success,
			Severity:  e.Severity,
		}
	}

	// Calculate security score and recommendations
	score, recommendations := calculateSecurityScore(user.EmailVerified, user.TOTPEnabled, int(passkeysCount), user.PasswordLastChanged)

	// Build response
	response := SecurityStatusResponse{
		EmailVerified:       user.EmailVerified,
		TOTPEnabled:         user.TOTPEnabled,
		PasskeysCount:       int(passkeysCount),
		PasswordLastChanged: user.PasswordLastChanged,

		ActiveSessions:    sessionStats["active_sessions"].(int64),
		MaxSessions:       5, // services.MaxConcurrentSessions
		SessionsIn30Days:  sessionStats["sessions_30_days"].(int64),
		RevokedSessions:   sessionStats["revoked_sessions_30_days"].(int64),
		UniqueIPsIn30Days: sessionStats["unique_ips_30_days"].(int),

		HasAnomaly: sessionStats["has_anomaly"].(bool),

		FailedLogins24h:      failedLogins24h,
		SuccessfulLogins24h:  successfulLogins24h,
		RecentSecurityEvents: eventSummaries,

		SecurityScore:   score,
		Recommendations: recommendations,
	}

	if details, ok := sessionStats["anomaly_details"].(string); ok {
		response.AnomalyDetails = details
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// GetActiveSessions returns active sessions for current user
func (h *SecurityStatusHandler) GetActiveSessions(c *gin.Context) {
	userID := c.GetUint("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH001",
				"message": "Autentikasi diperlukan",
			},
		})
		return
	}

	sessions, err := h.sessionService.GetActiveSessions(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Gagal mengambil data sesi",
			},
		})
		return
	}

	// Transform sessions for response (hide sensitive data)
	type SessionInfo struct {
		ID         uint      `json:"id"`
		IPAddress  string    `json:"ip_address"`
		UserAgent  string    `json:"user_agent"`
		CreatedAt  time.Time `json:"created_at"`
		LastUsedAt time.Time `json:"last_used_at"`
		ExpiresAt  time.Time `json:"expires_at"`
		IsCurrent  bool      `json:"is_current"`
	}

	// Get current session from request
	currentSessionID := c.GetUint("sessionID")

	sessionInfos := make([]SessionInfo, len(sessions))
	for i, s := range sessions {
		sessionInfos[i] = SessionInfo{
			ID:         s.ID,
			IPAddress:  maskIP(s.IPAddress),
			UserAgent:  truncateUserAgent(s.UserAgent),
			CreatedAt:  s.CreatedAt,
			LastUsedAt: s.LastUsedAt,
			ExpiresAt:  s.ExpiresAt,
			IsCurrent:  s.ID == currentSessionID,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"sessions": sessionInfos,
			"total":    len(sessionInfos),
		},
	})
}

// RevokeSession revokes a specific session
func (h *SecurityStatusHandler) RevokeSession(c *gin.Context) {
	userID := c.GetUint("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH001",
				"message": "Autentikasi diperlukan",
			},
		})
		return
	}

	var req struct {
		SessionID uint `json:"session_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_INPUT",
				"message": "session_id diperlukan",
			},
		})
		return
	}

	// Verify session belongs to user
	var session struct {
		ID     uint
		UserID uint
	}
	if err := h.db.Table("sessions").
		Select("id, user_id").
		Where("id = ?", req.SessionID).
		First(&session).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SESSION_NOT_FOUND",
				"message": "Sesi tidak ditemukan",
			},
		})
		return
	}

	if session.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "FORBIDDEN",
				"message": "Tidak diizinkan mencabut sesi ini",
			},
		})
		return
	}

	// Revoke session
	if err := h.sessionService.RevokeSession(req.SessionID, "User requested revocation"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Gagal mencabut sesi",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Sesi berhasil dicabut",
	})
}

// RevokeAllOtherSessions revokes all sessions except current
func (h *SecurityStatusHandler) RevokeAllOtherSessions(c *gin.Context) {
	userID := c.GetUint("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTH001",
				"message": "Autentikasi diperlukan",
			},
		})
		return
	}

	currentSessionID := c.GetUint("sessionID")

	// Revoke all other sessions
	result := h.db.Table("sessions").
		Where("user_id = ? AND id != ? AND revoked_at IS NULL", userID, currentSessionID).
		Updates(map[string]interface{}{
			"revoked_at":    time.Now(),
			"revoke_reason": "User revoked all other sessions",
		})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SERVER_ERROR",
				"message": "Gagal mencabut sesi",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Semua sesi lain berhasil dicabut",
		"data": gin.H{
			"revoked_count": result.RowsAffected,
		},
	})
}

// Helper functions

// maskIP masks an IP address for privacy
func maskIP(ip string) string {
	if ip == "" {
		return ""
	}

	// For IPv4: show only first 2 octets
	// For IPv6: show only first 4 groups
	parts := splitIP(ip)
	if len(parts) == 4 {
		// IPv4: xxx.xxx.xxx.xxx -> xxx.xxx.*.*
		return parts[0] + "." + parts[1] + ".*.*"
	}
	// IPv6 or other - just show first part
	if len(parts) > 2 {
		return parts[0] + ":" + parts[1] + ":****"
	}
	return ip[:len(ip)/2] + "****"
}

func splitIP(ip string) []string {
	// Try IPv4 first
	parts := make([]string, 0)
	current := ""
	for _, c := range ip {
		if c == '.' {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}

// truncateUserAgent shortens user agent for display
func truncateUserAgent(ua string) string {
	if len(ua) <= 100 {
		return ua
	}
	return ua[:97] + "..."
}

// calculateSecurityScore calculates a security score 0-100
func calculateSecurityScore(emailVerified, totpEnabled bool, passkeysCount int, passwordLastChanged *time.Time) (int, []string) {
	score := 0
	recommendations := []string{}

	// Email verified: +20 points
	if emailVerified {
		score += 20
	} else {
		recommendations = append(recommendations, "Verifikasi email Anda untuk keamanan akun")
	}

	// TOTP enabled: +30 points
	if totpEnabled {
		score += 30
	} else {
		recommendations = append(recommendations, "Aktifkan Two-Factor Authentication (2FA) untuk perlindungan ekstra")
	}

	// Passkeys: +20 points (max if at least 1)
	if passkeysCount > 0 {
		score += 20
	} else {
		recommendations = append(recommendations, "Tambahkan Passkey untuk login tanpa password yang lebih aman")
	}

	// Password age: +30 points if changed within 90 days
	if passwordLastChanged != nil {
		daysSinceChange := time.Since(*passwordLastChanged).Hours() / 24
		if daysSinceChange < 90 {
			score += 30
		} else if daysSinceChange < 180 {
			score += 15
			recommendations = append(recommendations, "Pertimbangkan untuk mengubah password Anda (sudah "+formatDays(int(daysSinceChange))+")")
		} else {
			recommendations = append(recommendations, "Password sudah lama tidak diubah ("+formatDays(int(daysSinceChange))+"). Pertimbangkan untuk mengubahnya.")
		}
	} else {
		recommendations = append(recommendations, "Pertimbangkan untuk mengubah password secara berkala")
	}

	// Cap at 100
	if score > 100 {
		score = 100
	}

	return score, recommendations
}

func formatDays(days int) string {
	if days < 30 {
		return "beberapa hari lalu"
	} else if days < 60 {
		return "~1 bulan lalu"
	} else if days < 90 {
		return "~2 bulan lalu"
	} else if days < 180 {
		return "~3-6 bulan lalu"
	} else if days < 365 {
		return "~6-12 bulan lalu"
	}
	return "lebih dari 1 tahun lalu"
}
