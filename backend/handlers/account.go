package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/logger"
	"backend-gin/models"
	"backend-gin/services"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mengupload ke storage: " + err.Error()})
		return
	}

	user.AvatarURL = avatarURL
	if err := database.DB.Save(user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan avatar ke profil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"avatar_url": avatarURL})
}

// DELETE /api/account/avatar
func DeleteAvatarHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	if user.AvatarURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tidak ada foto profil"})
		return
	}

	// Clear avatar URL in database
	user.AvatarURL = ""
	if err := database.DB.Save(user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menghapus foto profil"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "foto profil dihapus"})
}

// DeleteAccountRequest for account deletion
type DeleteAccountRequest struct {
	Password     string `json:"password" binding:"required"`
	TOTPCode     string `json:"totp_code" binding:"required"`
	Confirmation string `json:"confirmation" binding:"required"`
}

// DELETE /api/account - Delete user account permanently
func DeleteAccountHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	var req DeleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password, kode 2FA, dan konfirmasi diperlukan"})
		return
	}

	// Validate confirmation text
	if req.Confirmation != "DELETE" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ketik DELETE untuk mengkonfirmasi penghapusan akun"})
		return
	}

	// Validate TOTP code
	totpService := services.NewTOTPService(database.DB, logger.GetLogger())
	status, _ := totpService.GetStatus(user.ID)
	if !status.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "2FA harus diaktifkan untuk menghapus akun"})
		return
	}
	if !totpService.VerifyCode(user.ID, req.TOTPCode) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kode 2FA tidak valid"})
		return
	}

	// Validate password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Password salah"})
		return
	}

	// Check for pending transfers/disputes - user cannot delete if has active transactions
	var pendingTransfers int64
	database.DB.Model(&models.Transfer{}).Where(
		"(buyer_id = ? OR seller_id = ?) AND status IN ('pending', 'in_progress')",
		user.ID, user.ID,
	).Count(&pendingTransfers)
	if pendingTransfers > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tidak dapat menghapus akun. Anda memiliki transaksi yang masih berjalan."})
		return
	}

	// Start transaction - delete all user data
	tx := database.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses penghapusan"})
		return
	}

	// 1. Delete thread chunks (RAG index) for user's threads
	if err := tx.Exec(`
		DELETE FROM thread_chunks 
		WHERE thread_id IN (SELECT id FROM threads WHERE user_id = ?)
	`, user.ID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus index thread"})
		return
	}

	// 2. Delete all user's threads
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.Thread{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus thread"})
		return
	}

	// 3. Delete user badges
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.UserBadge{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus badge"})
		return
	}

	// 4. Delete wallet transactions
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.WalletTransaction{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus riwayat transaksi"})
		return
	}

	// 5. Delete deposits
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.Deposit{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus riwayat deposit"})
		return
	}

	// 6. Delete withdrawals
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.Withdrawal{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus riwayat withdrawal"})
		return
	}

	// 7. Delete dispute messages by user
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.DisputeMessage{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus pesan dispute"})
		return
	}

	// 8. Delete dispute evidence by user
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.DisputeEvidence{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus bukti dispute"})
		return
	}

	// 9. Delete user wallet
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.UserWallet{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus wallet"})
		return
	}

	// 10. Delete user badges
	if err := tx.Where("user_id = ?", user.ID).Delete(&models.UserBadge{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus badges"})
		return
	}

	// 11. Delete user (finally)
	if err := tx.Delete(user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus akun"})
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan penghapusan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Akun berhasil dihapus"})
}
