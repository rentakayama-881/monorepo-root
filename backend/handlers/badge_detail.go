package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/database"

	"github.com/gin-gonic/gin"
)

// GetBadgeDetailHandler returns details of a specific badge by ID
func GetBadgeDetailHandler(c *gin.Context) {
	id := c.Param("id")
	badgeID, err := strconv.Atoi(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tidak valid"})
		return
	}

	ctx := c.Request.Context()
	badge, err := database.GetEntClient().Badge.Get(ctx, badgeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "badge tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          badge.ID,
		"name":        badge.Name,
		"slug":        badge.Slug,
		"description": badge.Description,
		"icon_url":    badge.IconURL,
		"color":       badge.Color,
		"created_at":  badge.CreatedAt.Unix(),
	})
}
