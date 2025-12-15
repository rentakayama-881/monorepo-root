package handlers

import (
	"net/http"
	"strings"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

func CreateUsernameHandler(c *gin.Context) {
	userCtx, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
		return
	}

	user := userCtx.(*models.User)

	var req dto.CreateUsernameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username wajib diisi"})
		return
	}
	if len(username) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username terlalu panjang (maks 64 karakter)"})
		return
	}

	// Proteksi: hanya boleh set sekali
	if user.Username != nil && *user.Username != "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Username sudah pernah di-set dan tidak bisa diubah"})
		return
	}

	// Cek username sudah dipakai user lain
	var existingUser models.User
	if database.DB.Where("name = ?", username).First(&existingUser).Error == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
		return
	}

	user.Username = &username

	if err := database.DB.Save(user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan username"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"email":      user.Email,
			"name":       *user.Username,
			"avatar_url": user.AvatarURL,
		},
		"setup_completed": true,
	})
}
