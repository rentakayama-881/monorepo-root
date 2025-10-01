package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

func GetUserInfoHandler(c *gin.Context) {
	userIfc, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)
	name := ""
	if user.Name != nil { name = *user.Name }
	c.JSON(http.StatusOK, gin.H{
		"email":      user.Email,
		"name":       name,
		"avatar_url": user.AvatarURL,
		"balance":    user.Balance,
	})
}

// Public profile by username
func GetPublicUserProfileHandler(c *gin.Context) {
	username := c.Param("username")
	var user models.User
	if err := database.DB.Where("name = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user tidak ditemukan"})
		return
	}
	c.JSON(http.StatusOK, BuildPublicProfile(&user))
}
