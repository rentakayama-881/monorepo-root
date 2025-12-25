package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/models"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
)

type UpdateAccountRequest struct {
	FullName       *string             `json:"full_name"`
	Bio            *string             `json:"bio"`
	Pronouns       *string             `json:"pronouns"`
	Company        *string             `json:"company"`
	Telegram       *string             `json:"telegram"`
	SocialAccounts []map[string]string `json:"social_accounts"` // arbitrary list of { label, url }
}

type ChangeUsernameRequest struct {
	NewUsername string `json:"new_username" binding:"required"`
}

// GET /api/account/me
func GetMyAccountHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	var socials interface{}
	if len(user.SocialAccounts) > 0 {
		_ = json.Unmarshal(user.SocialAccounts, &socials)
	}
	name := ""
	if user.Username != nil {
		name = *user.Username
	}
	c.JSON(http.StatusOK, gin.H{
		"email":           user.Email,
		"username":        name,
		"full_name":       user.FullName,
		"bio":             user.Bio,
		"pronouns":        user.Pronouns,
		"company":         user.Company,
		"telegram":        user.Telegram,
		"social_accounts": socials,
		"avatar_url":      user.AvatarURL,
	})
}

// PUT /api/account
func UpdateMyAccountHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	if req.FullName != nil {
		user.FullName = req.FullName
	}
	if req.Bio != nil {
		user.Bio = *req.Bio
	}
	if req.Pronouns != nil {
		user.Pronouns = *req.Pronouns
	}
	if req.Company != nil {
		user.Company = *req.Company
	}
	if req.Telegram != nil {
		user.Telegram = *req.Telegram
	}
	if req.SocialAccounts != nil {
		b, _ := json.Marshal(req.SocialAccounts)
		user.SocialAccounts = datatypes.JSON(b)
	}
	if err := database.DB.Save(user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// POST /api/account/change-username
// Updates unique username without balance deductions
func ChangeUsernamePaidHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	var req ChangeUsernameRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.NewUsername) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username baru wajib diisi"})
		return
	}

	// Check username availability
	var count int64
	database.DB.Model(&models.User{}).Where("name = ?", req.NewUsername).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
		return
	}

	if err := database.DB.Model(&models.User{}).Where("id = ?", user.ID).Update("name", req.NewUsername).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses perubahan username"})
		return
	}
	name := req.NewUsername
	user.Username = &name
	c.JSON(http.StatusOK, gin.H{"status": "ok", "new_username": req.NewUsername})
}

// Public projection used by GetPublicUserProfileHandler will include new fields
func BuildPublicProfile(u *models.User) gin.H {
	var socials interface{}
	if len(u.SocialAccounts) > 0 {
		_ = json.Unmarshal(u.SocialAccounts, &socials)
	}
	name := ""
	if u.Username != nil {
		name = *u.Username
	}

	// Get primary badge if set
	var primaryBadge interface{}
	if u.PrimaryBadgeID != nil && *u.PrimaryBadgeID > 0 {
		var badge models.Badge
		if err := database.DB.First(&badge, *u.PrimaryBadgeID).Error; err == nil {
			primaryBadge = gin.H{
				"id":       badge.ID,
				"name":     badge.Name,
				"slug":     badge.Slug,
				"icon_url": badge.IconURL,
				"color":    badge.Color,
			}
		}
	}

	// Get active badges
	var userBadges []models.UserBadge
	database.DB.Preload("Badge").Where("user_id = ? AND revoked_at IS NULL", u.ID).Find(&userBadges)
	var badges []gin.H
	for _, ub := range userBadges {
		badges = append(badges, gin.H{
			"id":       ub.Badge.ID,
			"name":     ub.Badge.Name,
			"slug":     ub.Badge.Slug,
			"icon_url": ub.Badge.IconURL,
			"color":    ub.Badge.Color,
		})
	}

	return gin.H{
		"username":        name,
		"full_name":       u.FullName,
		"bio":             u.Bio,
		"pronouns":        u.Pronouns,
		"company":         u.Company,
		"telegram":        u.Telegram,
		"social_accounts": socials,
		"avatar_url":      u.AvatarURL,
		"id":              u.ID,
		"primary_badge":   primaryBadge,
		"badges":          badges,
	}
}

// PUT /api/account/avatar
func UploadAvatarHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file tidak ditemukan"})
		return
	}
	defer file.Close()

	// Validasi ukuran (misal max 2MB)
	if header.Size > 2*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ukuran file maksimal 2MB"})
		return
	}

	// Validasi ekstensi
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowed[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "format gambar harus .jpg .jpeg .png atau .webp"})
		return
	}

	// Content type mapping
	contentTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".webp": "image/webp",
	}

	// Try Supabase Storage first
	supabase := utils.NewSupabaseStorage()
	if supabase.IsConfigured() {
		filename := fmt.Sprintf("u%d_%d%s", user.ID, time.Now().Unix(), ext)
		avatarURL, err := supabase.UploadFile(file, filename, contentTypes[ext])
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupload ke storage: " + err.Error()})
			return
		}

		user.AvatarURL = avatarURL
		if err := database.DB.Save(user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan avatar ke profil"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
		return
	}

	// Fallback to local storage if Supabase not configured
	// Pastikan folder ada
	if err := os.MkdirAll("public/avatars", 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuat folder penyimpanan"})
		return
	}

	// Simpan file
	filename := fmt.Sprintf("avatars/u%d_%d%s", user.ID, time.Now().Unix(), ext)
	dst := filepath.Join("public", filename)

	// Simpan dari stream
	out, err := os.Create(dst)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuat file"})
		return
	}
	defer out.Close()
	if _, err := out.ReadFrom(file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan file"})
		return
	}

	avatarURL := fmt.Sprintf("/static/%s", filename)

	// Update user
	user.AvatarURL = avatarURL
	if err := database.DB.Save(user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan avatar ke profil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
}
