package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
)

// GetUserBadgesHandler returns badges for a public user profile
func GetUserBadgesHandler(c *gin.Context) {
	username := c.Param("username")
	var user models.User
	if err := database.DB.Where("name = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}

	// Get user badges with badge details
	var userBadges []models.UserBadge
	if err := database.DB.Preload("Badge").
		Where("user_id = ? AND revoked_at IS NULL", user.ID).
		Order("granted_at desc").
		Find(&userBadges).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca badges"})
		return
	}

	res := make([]gin.H, 0, len(userBadges))
	for _, ub := range userBadges {
		res = append(res, gin.H{
			"id":          ub.Badge.ID,
			"name":        ub.Badge.Name,
			"slug":        ub.Badge.Slug,
			"description": ub.Badge.Description,
			"icon_url":    ub.Badge.IconURL,
			"color":       ub.Badge.Color,
			"granted_at":  ub.GrantedAt.Unix(),
			"reason":      ub.Reason,
		})
	}
	c.JSON(http.StatusOK, gin.H{"badges": res})
}
