package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/logger"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// PUT /api/account/avatar
func UploadAvatarHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file tidak ditemukan"})
		return
	}
	defer func() { _ = file.Close() }()

	// Validasi ukuran (misal max 2MB)
	if header.Size > 2*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ukuran file maksimal 2MB"})
		return
	}

	// Validasi ekstensi - hanya JPG dan PNG
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true}
	if !allowed[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "format gambar harus JPG atau PNG"})
		return
	}

	// Content type mapping
	contentTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
	}

	// Upload to Supabase Storage
	supabase := utils.NewSupabaseStorage()
	if !supabase.IsConfigured() {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "storage tidak dikonfigurasi, hubungi admin"})
		return
	}

	filename := fmt.Sprintf("u%d_%d%s", user.ID, time.Now().Unix(), ext)
	avatarURL, err := supabase.UploadFile(file, filename, contentTypes[ext])
	if err != nil {
		logger.Error("Failed to upload avatar to storage",
			zap.Int("user_id", user.ID),
			zap.String("filename", filename),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupload ke storage"})
		return
	}

	if _, err := database.GetEntClient().User.UpdateOneID(user.ID).
		SetAvatarURL(avatarURL).
		Save(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan avatar ke profil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
}

// DELETE /api/account/avatar
func DeleteAvatarHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	if user.AvatarURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tidak ada foto profil"})
		return
	}

	// Clear avatar URL in database
	if _, err := database.GetEntClient().User.UpdateOneID(user.ID).
		ClearAvatarURL().
		Save(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menghapus foto profil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "foto profil dihapus"})
}
