package handlers

import (
	"net/http"
	"strings"

	"backend-gin/database"
	"backend-gin/ent"
	entuser "backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/ent/validationcase"

	"github.com/gin-gonic/gin"
)

func BuildPublicProfileFromEnt(c *gin.Context, u *ent.User) gin.H {
	ctx := c.Request.Context()
	socials := normalizeSocialAccounts(u.SocialAccounts)
	name := ""
	if u.Username != nil {
		name = *u.Username
	}

	// Get primary badge if set (Ent)
	var primaryBadge interface{}
	var badges []gin.H
	if u.PrimaryBadgeID != nil && *u.PrimaryBadgeID > 0 {
		b, err := database.GetEntClient().Badge.Get(ctx, *u.PrimaryBadgeID)
		if err == nil && b != nil {
			primaryBadge = gin.H{
				"id":        b.ID,
				"name":      b.Name,
				"slug":      b.Slug,
				"icon_type": b.IconType,
				"color":     b.Color,
			}
		}
	}

	// Get active badges via Ent
	userBadges, err := database.GetEntClient().UserBadge.Query().
		Where(userbadge.UserIDEQ(u.ID), userbadge.RevokedAtIsNil()).
		WithBadge().
		All(ctx)
	if err == nil {
		for _, ub := range userBadges {
			if ub.Edges.Badge != nil {
				badges = append(badges, gin.H{
					"id":        ub.Edges.Badge.ID,
					"name":      ub.Edges.Badge.Name,
					"slug":      ub.Edges.Badge.Slug,
					"icon_type": ub.Edges.Badge.IconType,
					"color":     ub.Edges.Badge.Color,
				})
			}
		}
	}

	validationCaseCount, err := database.GetEntClient().ValidationCase.
		Query().
		Where(validationcase.UserIDEQ(u.ID)).
		Count(ctx)
	if err != nil {
		validationCaseCount = 0
	}

	return gin.H{
		"username":              name,
		"full_name":             u.FullName,
		"bio":                   u.Bio,
		"pronouns":              u.Pronouns,
		"company":               u.Company,
		"social_accounts":       socials,
		"avatar_url":            u.AvatarURL,
		"id":                    u.ID,
		"validation_case_count": validationCaseCount,
		"guarantee_amount":      u.GuaranteeAmount,
		"primary_badge":         primaryBadge,
		"badges":                badges,
	}
}

// POST /api/account/change-username
// Updates unique username without balance deductions
func ChangeUsernamePaidHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req ChangeUsernameRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.NewUsername) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username baru wajib diisi"})
		return
	}

	// Check username availability via Ent
	exists, err := database.GetEntClient().User.Query().Where(entuser.UsernameEQ(req.NewUsername)).Exist(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memeriksa username"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
		return
	}
	// Update username via Ent
	if _, err := database.GetEntClient().User.UpdateOneID(user.ID).SetUsername(req.NewUsername).Save(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses perubahan username"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "new_username": req.NewUsername})
}
