package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"

	"github.com/gin-gonic/gin"
)

// SetPrimaryBadge godoc
// @Summary      Set primary badge
// @Description  Set or clear the authenticated user's primary (display) badge. Send badge_id=null to clear.
// @Tags         Account
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      SwaggerSetPrimaryBadgeRequest  true  "Badge ID to set as primary (null to clear)"
// @Success      200   {object}  handlers.SwaggerMessageResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      500   {object}  handlers.SwaggerErrorResponse
// @Router       /account/primary-badge [put]
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
	update := database.GetEntClient().User.UpdateOneID(int(userID))
	if req.BadgeID != nil && *req.BadgeID > 0 {
		update = update.SetPrimaryBadgeID(*req.BadgeID)
	} else {
		update = update.ClearPrimaryBadgeID()
	}
	_, err := update.Save(c.Request.Context())
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

// GetUserBadgesPublic godoc
// @Summary      Get user's public badges
// @Description  Returns all active badges and primary badge for a user by username.
// @Tags         User
// @Produce      json
// @Param        username  path      string  true  "Username"
// @Success      200       {object}  handlers.SwaggerUserBadgesPublicResponse
// @Failure      404       {object}  handlers.SwaggerErrorResponse
// @Router       /user/{username}/badges [get]
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
				"icon_type":   ub.Edges.Badge.IconType,
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
				"id":        b.ID,
				"name":      b.Name,
				"slug":      b.Slug,
				"icon_type": b.IconType,
				"color":     b.Color,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"badges":        badges,
		"primary_badge": primaryBadge,
	})
}

// GetMyBadges godoc
// @Summary      Get my badges
// @Description  Returns all active badges and primary badge ID for the authenticated user.
// @Tags         Account
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerMyBadgesResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /account/badges [get]
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
				"icon_type":   ub.Edges.Badge.IconType,
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
