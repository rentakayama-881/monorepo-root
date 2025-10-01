package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

// For now, use existing Credential model as badges
func GetUserBadgesHandler(c *gin.Context) {
	username := c.Param("username")
	var user models.User
	if err := database.DB.Where("name = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}
	var creds []models.Credential
	if err := database.DB.Where("user_id = ?", user.ID).Order("created_at desc").Find(&creds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membaca badges"})
		return
	}
	res := make([]gin.H, 0, len(creds))
	for _, cr := range creds {
		res = append(res, gin.H{
			"id":          cr.ID,
			"platform":    cr.Platform,
			"description": cr.Description,
			"created_at":  cr.CreatedAt.Unix(),
		})
	}
	c.JSON(http.StatusOK, gin.H{"badges": res})
}
