package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"

	"github.com/gin-gonic/gin"
)

// SetPrimaryBadge allows user to set their primary (display) badge
func SetPrimaryBadge(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "AUTH001", "message": "Unauthorized"},
		})
		return
	}

	var req struct {
		BadgeID *int `json:"badge_id"` // nil to clear primary badge
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Data tidak valid"},
		})
		return
	}

	// If setting a badge (not clearing)
	if req.BadgeID != nil && *req.BadgeID > 0 {
		// Check user has this badge (Ent)
		exists, err := database.GetEntClient().UserBadge.Query().
			Where(userbadge.UserIDEQ(int(userID)), userbadge.BadgeIDEQ(*req.BadgeID), userbadge.RevokedAtIsNil()).
			Exist(c.Request.Context())
		if err != nil || !exists {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{"code": "BADGE005", "message": "Anda tidak memiliki badge ini"},
			})
			return
		}
	}

	// Update user's primary badge (Ent)
	_, err := database.GetEntClient().User.UpdateOneID(int(userID)).SetNillablePrimaryBadgeID(req.BadgeID).Save(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengupdate primary badge"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Primary badge berhasil diupdate",
	})
}

// GetUserBadgesPublic returns a user's active badges (public endpoint)
func GetUserBadgesPublic(c *gin.Context) {
	username := c.Param("username")

	// Get user via Ent
	u, err := database.GetEntClient().User.Query().Where(user.UsernameEQ(username)).Only(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Get active badges via Ent
	userBadges, _ := database.GetEntClient().UserBadge.Query().
		Where(userbadge.UserIDEQ(u.ID), userbadge.RevokedAtIsNil()).
		WithBadge().
		Order(userbadge.ByGrantedAt()).
		All(c.Request.Context())

	var badges []gin.H
	for _, ub := range userBadges {
		if ub.Edges.Badge != nil {
			badges = append(badges, gin.H{
				"id":          ub.Edges.Badge.ID,
				"name":        ub.Edges.Badge.Name,
				"slug":        ub.Edges.Badge.Slug,
				"description": ub.Edges.Badge.Description,
				"icon_url":    ub.Edges.Badge.IconURL,
				"color":       ub.Edges.Badge.Color,
				"granted_at":  ub.GrantedAt,
			})
		}
	}

	// Get primary badge
	var primaryBadge *gin.H
	if u.PrimaryBadgeID != nil {
		b, err := database.GetEntClient().Badge.Get(c.Request.Context(), *u.PrimaryBadgeID)
		if err == nil && b != nil {
			primaryBadge = &gin.H{
				"id":       b.ID,
				"name":     b.Name,
				"slug":     b.Slug,
				"icon_url": b.IconURL,
				"color":    b.Color,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"badges":        badges,
		"primary_badge": primaryBadge,
	})
}

// GetMyBadges returns current user's badges
func GetMyBadges(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Get active badges for user (Ent)
	userBadges, _ := database.GetEntClient().UserBadge.Query().
		Where(userbadge.UserIDEQ(int(userID)), userbadge.RevokedAtIsNil()).
		WithBadge().
		Order(userbadge.ByGrantedAt()).
		All(c.Request.Context())

	var badges []gin.H
	for _, ub := range userBadges {
		if ub.Edges.Badge != nil {
			badges = append(badges, gin.H{
				"id":          ub.Edges.Badge.ID,
				"name":        ub.Edges.Badge.Name,
				"slug":        ub.Edges.Badge.Slug,
				"description": ub.Edges.Badge.Description,
				"icon_url":    ub.Edges.Badge.IconURL,
				"color":       ub.Edges.Badge.Color,
				"granted_at":  ub.GrantedAt,
			})
		}
	}

	// Get user to fetch primary_badge_id
	u, _ := database.GetEntClient().User.Get(c.Request.Context(), int(userID))
	var primaryBadgeID *int
	if u != nil && u.PrimaryBadgeID != nil {
		primaryBadgeID = u.PrimaryBadgeID
	}

	c.JSON(http.StatusOK, gin.H{
		"badges":           badges,
		"primary_badge_id": primaryBadgeID,
	})
}
