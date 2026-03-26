package handlers

import (
	"net/http"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/securityevent"
	"backend-gin/ent/session"
	"backend-gin/ent/user"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GDPRDataExportHandler godoc
// @Summary      Export personal data (GDPR)
// @Description  Returns all personal data stored for the authenticated user.
//
//	Sensitive fields (password hash, TOTP secret, refresh token hashes)
//	are redacted.
//
// @Tags         Account
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      429  {object}  handlers.SwaggerErrorResponse
// @Failure      500  {object}  handlers.SwaggerErrorResponse
// @Router       /account/data-export [get]
func GDPRDataExportHandler(c *gin.Context) {
	authedUser, ok := mustGetUser(c)
	if !ok {
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Fetch user with all personal-data edges in a single query.
	u, err := client.User.
		Query().
		Where(user.IDEQ(authedUser.ID)).
		WithSessions(func(q *ent.SessionQuery) {
			q.Where(session.RevokedAtIsNil()).
				Order(ent.Desc(session.FieldLastUsedAt)).
				Limit(100)
		}).
		WithUserBadges(func(q *ent.UserBadgeQuery) {
			q.WithBadge()
		}).
		WithValidationCases(func(q *ent.ValidationCaseQuery) {
			q.Order(ent.Desc("created_at")).
				Limit(500)
		}).
		WithSecurityEvents(func(q *ent.SecurityEventQuery) {
			q.Order(ent.Desc(securityevent.FieldCreatedAt)).
				Limit(500)
		}).
		WithPasskeys().
		Only(ctx)

	if err != nil {
		logger.Error("GDPR data export: failed to query user data",
			zap.Int("user_id", authedUser.ID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengambil data pengguna"})
		return
	}

	// Build sanitised user profile (redact sensitive fields).
	userProfile := buildUserProfile(u)

	// Build sanitised session list (redact token hashes).
	sessions := buildSessionExport(u.Edges.Sessions)

	// Build badge list.
	badges := buildBadgeExport(u.Edges.UserBadges)

	// Build validation case summary (owner data only).
	validationCases := buildValidationCaseExport(u.Edges.ValidationCases)

	// Build security event list.
	securityEvents := buildSecurityEventExport(u.Edges.SecurityEvents)

	// Build passkey summary (redact credential/public key bytes).
	passkeys := buildPasskeyExport(u.Edges.Passkeys)

	c.JSON(http.StatusOK, gin.H{
		"exported_at":      time.Now().UTC().Format(time.RFC3339),
		"user":             userProfile,
		"sessions":         sessions,
		"badges":           badges,
		"validation_cases": validationCases,
		"security_events":  securityEvents,
		"passkeys":         passkeys,
	})
}

// ---------------------------------------------------------------------------
// Sanitisation helpers
// ---------------------------------------------------------------------------

func buildUserProfile(u *ent.User) gin.H {
	username := ""
	if u.Username != nil {
		username = *u.Username
	}

	return gin.H{
		"id":              u.ID,
		"email":           u.Email,
		"username":        username,
		"email_verified":  u.EmailVerified,
		"avatar_url":      u.AvatarURL,
		"full_name":       u.FullName,
		"bio":             u.Bio,
		"pronouns":        u.Pronouns,
		"company":         u.Company,
		"telegram":        u.Telegram,
		"social_accounts": u.SocialAccounts,
		"totp_enabled":    u.TotpEnabled,
		"created_at":      u.CreatedAt,
		"updated_at":      u.UpdatedAt,
		"last_login_at":   u.LastLoginAt,
		// Redacted: password_hash, totp_secret
	}
}

func buildSessionExport(sessions []*ent.Session) []gin.H {
	out := make([]gin.H, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, gin.H{
			"id":           s.ID,
			"ip_address":   s.IPAddress,
			"user_agent":   s.UserAgent,
			"created_at":   s.CreatedAt,
			"expires_at":   s.ExpiresAt,
			"last_used_at": s.LastUsedAt,
			// Redacted: refresh_token_hash, access_token_jti, token_family
		})
	}
	return out
}

func buildBadgeExport(userBadges []*ent.UserBadge) []gin.H {
	out := make([]gin.H, 0, len(userBadges))
	for _, ub := range userBadges {
		entry := gin.H{
			"id":         ub.ID,
			"badge_id":   ub.BadgeID,
			"reason":     ub.Reason,
			"granted_at": ub.GrantedAt,
			"revoked_at": ub.RevokedAt,
		}
		if ub.Edges.Badge != nil {
			entry["badge_name"] = ub.Edges.Badge.Name
			entry["badge_slug"] = ub.Edges.Badge.Slug
		}
		out = append(out, entry)
	}
	return out
}

func buildValidationCaseExport(cases []*ent.ValidationCase) []gin.H {
	out := make([]gin.H, 0, len(cases))
	for _, vc := range cases {
		out = append(out, gin.H{
			"id":               vc.ID,
			"title":            vc.Title,
			"summary":          vc.Summary,
			"status":           vc.Status,
			"sensitivity_level": vc.SensitivityLevel,
			"bounty_amount":    vc.BountyAmount,
			"created_at":       vc.CreatedAt,
			"updated_at":       vc.UpdatedAt,
		})
	}
	return out
}

func buildSecurityEventExport(events []*ent.SecurityEvent) []gin.H {
	out := make([]gin.H, 0, len(events))
	for _, e := range events {
		out = append(out, gin.H{
			"id":         e.ID,
			"event_type": e.EventType,
			"ip_address": e.IPAddress,
			"user_agent": e.UserAgent,
			"success":    e.Success,
			"severity":   e.Severity,
			"created_at": e.CreatedAt,
		})
	}
	return out
}

func buildPasskeyExport(passkeys []*ent.Passkey) []gin.H {
	out := make([]gin.H, 0, len(passkeys))
	for _, p := range passkeys {
		out = append(out, gin.H{
			"id":          p.ID,
			"name":        p.Name,
			"created_at":  p.CreatedAt,
			"last_used_at": p.LastUsedAt,
			// Redacted: credential_id, public_key, aaguid
		})
	}
	return out
}
