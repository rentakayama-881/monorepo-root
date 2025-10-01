package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

func GetBadgeDetailHandler(c *gin.Context) {
	id := c.Param("id")
	var cr models.Credential
	if err := database.DB.First(&cr, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "badge tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":          cr.ID,
		"user_id":     cr.UserID,
		"platform":    cr.Platform,
		"description": cr.Description,
		"created_at":  cr.CreatedAt.Unix(),
	})
}
