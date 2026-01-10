package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/backupcode"
	"backend-gin/ent/credential"
	"backend-gin/ent/devicefingerprint"
	"backend-gin/ent/deviceusermapping"
	"backend-gin/ent/emailverificationtoken"
	"backend-gin/ent/passkey"
	"backend-gin/ent/passwordresettoken"
	"backend-gin/ent/securityevent"
	"backend-gin/ent/session"
	"backend-gin/ent/sessionlock"
	"backend-gin/ent/sudosession"
	"backend-gin/ent/thread"
	"backend-gin/ent/totppendingtoken"
	entuser "backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
)

type UpdateAccountRequest struct {
	FullName       *string                `json:"full_name"`
	Bio            *string                `json:"bio"`
	Pronouns       *string                `json:"pronouns"`
	Company        *string                `json:"company"`
	Telegram       *string                `json:"telegram"`
	SocialAccounts map[string]interface{} `json:"social_accounts"` // arbitrary social accounts map
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
	user := userIfc.(*ent.User)

	var socials interface{}
	if len(user.SocialAccounts) > 0 {
		socials = user.SocialAccounts
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
	user := userIfc.(*ent.User)

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	// Update via Ent ORM
	upd := database.GetEntClient().User.UpdateOneID(user.ID)
	if req.FullName != nil {
		upd = upd.SetNillableFullName(req.FullName)
	}
	if req.Bio != nil {
		upd = upd.SetBio(*req.Bio)
	}
	if req.Pronouns != nil {
		upd = upd.SetPronouns(*req.Pronouns)
	}
	if req.Company != nil {
		upd = upd.SetCompany(*req.Company)
	}
	if req.Telegram != nil {
		upd = upd.SetTelegram(*req.Telegram)
	}
	if req.SocialAccounts != nil {
		upd = upd.SetSocialAccounts(req.SocialAccounts)
	}
	if _, err := upd.Save(c.Request.Context()); err != nil {
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
	user := userIfc.(*ent.User)

	var req ChangeUsernameRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.NewUsername) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username baru wajib diisi"})
		return
	}

	// Check username availability via Ent
	exists, err := database.GetEntClient().User.Query().Where(entuser.UsernameEQ(req.NewUsername)).Exist(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memeriksa username"})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
		return
	}
	// Update username via Ent
	if _, err := database.GetEntClient().User.UpdateOneID(user.ID).SetUsername(req.NewUsername).Save(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal memproses perubahan username"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "new_username": req.NewUsername})
}

// BuildPublicProfileFromEnt builds a public profile response from ent.User
func BuildPublicProfileFromEnt(c *gin.Context, u *ent.User) gin.H {
	ctx := c.Request.Context()
	var socials interface{}
	if len(u.SocialAccounts) > 0 {
		socials = u.SocialAccounts
	}
	name := ""
	if u.Username != nil {
		name = *u.Username
	}

	// Get primary badge if set (Ent)
	var primaryBadge interface{}
	var badges []gin.H
	if u.PrimaryBadgeID != nil && *u.PrimaryBadgeID > 0 {
		b, err := database.GetEntClient().Badge.Get(ctx, *u.PrimaryBadgeID)
		if err == nil && b != nil {
			primaryBadge = gin.H{
				"id":       b.ID,
				"name":     b.Name,
				"slug":     b.Slug,
				"icon_url": b.IconURL,
				"color":    b.Color,
			}
		}
	}

	// Get active badges via Ent
	userBadges, _ := database.GetEntClient().UserBadge.Query().
		Where(userbadge.UserIDEQ(u.ID), userbadge.RevokedAtIsNil()).
		WithBadge().
		All(ctx)
	for _, ub := range userBadges {
		if ub.Edges.Badge != nil {
			badges = append(badges, gin.H{
				"id":       ub.Edges.Badge.ID,
				"name":     ub.Edges.Badge.Name,
				"slug":     ub.Edges.Badge.Slug,
				"icon_url": ub.Edges.Badge.IconURL,
				"color":    ub.Edges.Badge.Color,
			})
		}
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
	user := userIfc.(*ent.User)

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
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

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

// DeleteAccountRequest for account deletion
// Note: Password not required here because RequireSudo middleware already verifies identity
type DeleteAccountRequest struct {
	Confirmation string `json:"confirmation" binding:"required"`
}

// DELETE /api/account - Delete user account permanently
// Protected by RequireSudo middleware which already validates user identity
func DeleteAccountHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

	var req DeleteAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Konfirmasi diperlukan"})
		return
	}

	// Validate confirmation text
	if req.Confirmation != "DELETE" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ketik DELETE untuk mengkonfirmasi penghapusan akun"})
		return
	}

	ctx := c.Request.Context()
	client := database.GetEntClient()
	db := database.GetSQLDB()

	// Use Ent transaction for cascading delete
	tx, err := client.Tx(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses penghapusan"})
		return
	}

	// 1. Delete thread chunks (RAG index) for user's threads - only if table exists
	var tableExists bool
	err = db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_name = 'thread_chunks'
		)
	`).Scan(&tableExists)
	if err != nil {
		tableExists = false // Assume not exists on error
	}

	if tableExists {
		if _, err := db.ExecContext(ctx, `
			DELETE FROM thread_chunks 
			WHERE thread_id IN (SELECT id FROM threads WHERE user_id = $1)
		`, user.ID); err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus index thread"})
			return
		}
	}

	// 2. Delete all user's threads
	if _, err := tx.Thread.Delete().Where(thread.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus thread"})
		return
	}

	// 3. Delete all sessions
	if _, err := tx.Session.Delete().Where(session.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi"})
		return
	}

	// 4. Delete sudo sessions
	if _, err := tx.SudoSession.Delete().Where(sudosession.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi sudo"})
		return
	}

	// 5. Delete session locks
	if _, err := tx.SessionLock.Delete().Where(sessionlock.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus session locks"})
		return
	}

	// 6. Delete backup codes
	if _, err := tx.BackupCode.Delete().Where(backupcode.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus backup codes"})
		return
	}

	// 7. Delete passkeys
	if _, err := tx.Passkey.Delete().Where(passkey.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus passkeys"})
		return
	}

	// 8. Delete user credentials
	if _, err := tx.Credential.Delete().Where(credential.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus kredensial"})
		return
	}

	// 9. Delete user badges
	if _, err := tx.UserBadge.Delete().Where(userbadge.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus badge"})
		return
	}

	// 10. Delete security events
	if _, err := tx.SecurityEvent.Delete().Where(securityevent.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus security events"})
		return
	}

	// 11. Delete TOTP pending tokens
	if _, err := tx.TOTPPendingToken.Delete().Where(totppendingtoken.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus TOTP tokens"})
		return
	}

	// 12. Delete email verification tokens
	if _, err := tx.EmailVerificationToken.Delete().Where(emailverificationtoken.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus email tokens"})
		return
	}

	// 13. Delete password reset tokens
	if _, err := tx.PasswordResetToken.Delete().Where(passwordresettoken.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus password tokens"})
		return
	}

	// 14. Delete device fingerprints
	if _, err := tx.DeviceFingerprint.Delete().Where(devicefingerprint.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus device fingerprints"})
		return
	}

	// 15. Delete device user mappings
	if _, err := tx.DeviceUserMapping.Delete().Where(deviceusermapping.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus device mappings"})
		return
	}

	// 16. Clear primary badge reference (set to NULL to avoid FK issues)
	if _, err := tx.User.UpdateOneID(int(user.ID)).ClearPrimaryBadgeID().Save(ctx); err != nil {
		// Ignore error - user might not have primary badge
	}

	// 17. Delete user (finally)
	if err := tx.User.DeleteOneID(int(user.ID)).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus akun"})
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyelesaikan penghapusan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Akun berhasil dihapus"})
}
