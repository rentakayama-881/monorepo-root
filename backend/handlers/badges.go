package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"

	"github.com/gin-gonic/gin"
)

// GetUserBadgesHandler returns all active badges for a user by username
func GetUserBadgesHandler(c *gin.Context) {
	username := c.Param("username")
	ctx := c.Request.Context()
	client := database.GetEntClient()

	// Find user by username
	u, err := client.User.Query().Where(user.UsernameEQ(username)).Only(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}

	// Get active (non-revoked) user badges with badge details
	userBadges, err := client.UserBadge.Query().
		Where(
			userbadge.UserIDEQ(u.ID),
			userbadge.RevokedAtIsNil(),
		).
		WithBadge().
		Order(ent.Desc(userbadge.FieldGrantedAt)).
		All(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca badges"})
		return
	}

	res := make([]gin.H, 0, len(userBadges))
	for _, ub := range userBadges {
		if ub.Edges.Badge != nil {
			badge := ub.Edges.Badge
			res = append(res, gin.H{
				"id":          badge.ID,
				"name":        badge.Name,
				"slug":        badge.Slug,
				"description": badge.Description,
				"icon_url":    badge.IconURL,
				"color":       badge.Color,
				"granted_at":  ub.GrantedAt.Unix(),
				"reason":      ub.Reason,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"badges": res})
}
