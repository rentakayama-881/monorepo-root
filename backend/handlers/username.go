package handlers

import (
	"net/http"
	"strings"

	"backend-gin/database"
	"backend-gin/dto"
	entuser "backend-gin/ent/user"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
)

func CreateUsernameHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req dto.CreateUsernameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	username := strings.TrimSpace(strings.ToLower(req.Username))

	// Validate username dengan aturan baru
	if err := validators.ValidateUsernameStrict(username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Proteksi: hanya boleh set sekali
	if user.Username != nil && *user.Username != "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Username sudah pernah di-set dan tidak bisa diubah"})
		return
	}

	// Cek username sudah dipakai user lain (Ent)
	exists, err := database.GetEntClient().User.Query().Where(entuser.UsernameEQ(username)).Exist(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memeriksa username"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
		return
	}

	// Update via Ent
	if _, err := database.GetEntClient().User.UpdateOneID(user.ID).SetUsername(username).Save(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan username"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"email":      user.Email,
			"name":       username,
			"avatar_url": user.AvatarURL,
		},
		"setup_completed": true,
	})
}
