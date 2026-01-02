package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
)

// GetBadgeDetailHandler returns details of a specific badge
func GetBadgeDetailHandler(c *gin.Context) {
	id := c.Param("id")
	var badge models.Badge
	if err := database.DB.First(&badge, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "badge tidak ditemukan"})
		return
	}

	// Count how many users have this badge
	var count int64
	database.DB.Model(&models.UserBadge{}).Where("badge_id = ? AND revoked_at IS NULL", badge.ID).Count(&count)

	c.JSON(http.StatusOK, gin.H{
		"id":          badge.ID,
		"name":        badge.Name,
		"slug":        badge.Slug,
		"description": badge.Description,
		"icon_url":    badge.IconURL,
		"color":       badge.Color,
		"user_count":  count,
		"created_at":  badge.CreatedAt.Unix(),
	})
}
