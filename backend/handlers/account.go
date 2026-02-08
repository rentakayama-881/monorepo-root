package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"backend-gin/config"
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
	"backend-gin/ent/threadcredential"
	"backend-gin/ent/totppendingtoken"
	entuser "backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/logger"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func normalizeSocialAccounts(socialAccounts map[string]interface{}) interface{} {
	if len(socialAccounts) == 0 {
		return nil
	}
	if items, ok := socialAccounts["items"]; ok {
		return items
	}

	normalized := make([]map[string]interface{}, 0, len(socialAccounts))
	for label, value := range socialAccounts {
		entry := map[string]interface{}{"label": label}
		switch v := value.(type) {
		case string:
			entry["url"] = v
		default:
			entry["url"] = fmt.Sprint(value)
		}
		normalized = append(normalized, entry)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

type UpdateAccountRequest struct {
	FullName       *string         `json:"full_name"`
	Bio            *string         `json:"bio"`
	Pronouns       *string         `json:"pronouns"`
	Company        *string         `json:"company"`
	Telegram       *string         `json:"telegram"`
	SocialAccounts json.RawMessage `json:"social_accounts"` // allow array or map payloads
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

	socials := normalizeSocialAccounts(user.SocialAccounts)
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
	if len(req.SocialAccounts) > 0 {
		var socialList []map[string]interface{}
		var socialMap map[string]interface{}

		if err := json.Unmarshal(req.SocialAccounts, &socialList); err == nil {
			if len(socialList) == 0 {
				upd = upd.ClearSocialAccounts()
			} else {
				upd = upd.SetSocialAccounts(map[string]interface{}{"items": socialList})
			}
		} else if err := json.Unmarshal(req.SocialAccounts, &socialMap); err == nil {
			if len(socialMap) == 0 {
				upd = upd.ClearSocialAccounts()
			} else {
				upd = upd.SetSocialAccounts(socialMap)
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "format social account tidak valid"})
			return
		}
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
	socials := normalizeSocialAccounts(u.SocialAccounts)
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
				"id":        b.ID,
				"name":      b.Name,
				"slug":      b.Slug,
				"icon_type": b.IconType,
				"color":     b.Color,
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
				"id":        ub.Edges.Badge.ID,
				"name":      ub.Edges.Badge.Name,
				"slug":      ub.Edges.Badge.Slug,
				"icon_type": ub.Edges.Badge.IconType,
				"color":     ub.Edges.Badge.Color,
			})
		}
	}

	// Credential score = total credentials across all threads owned by this user.
	credentialScore, err := database.GetEntClient().ThreadCredential.
		Query().
		Where(threadcredential.HasThreadWith(thread.UserIDEQ(u.ID))).
		Count(ctx)
	if err != nil {
		credentialScore = 0
	}

	return gin.H{
		"username":         name,
		"full_name":        u.FullName,
		"bio":              u.Bio,
		"pronouns":         u.Pronouns,
		"company":          u.Company,
		"telegram":         u.Telegram,
		"social_accounts":  socials,
		"avatar_url":       u.AvatarURL,
		"id":               u.ID,
		"credential_score": credentialScore,
		"guarantee_amount": u.GuaranteeAmount,
		"primary_badge":    primaryBadge,
		"badges":           badges,
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

// FeatureServiceValidationResult represents the response from Feature-Service validation
type FeatureServiceValidationResult struct {
	CanDelete          bool     `json:"canDelete"`
	BlockingReasons    []string `json:"blockingReasons"`
	Warnings           []string `json:"warnings"`
	WalletBalance      int64    `json:"walletBalance"`
	PendingTransfers   int      `json:"pendingTransfers"`
	DisputedTransfers  int      `json:"disputedTransfers"`
	PendingWithdrawals int      `json:"pendingWithdrawals"`
}

// FeatureServiceCleanupResult represents the response from Feature-Service cleanup
type FeatureServiceCleanupResult struct {
	Success        bool             `json:"success"`
	BlockingReason string           `json:"blockingReason"`
	DeletedCounts  map[string]int64 `json:"deletedCounts"`
}

// GET /api/account/can-delete - Check if user can delete their account
// Returns blocking reasons and warnings
func CanDeleteAccountHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*ent.User)

	// Call Feature-Service to check validation
	result, err := callFeatureServiceValidation(c, uint(user.ID))
	if err != nil {
		// STRICT MODE: If Feature-Service is unavailable, block deletion for safety
		// This prevents users with wallet balance or pending transactions from deleting
		c.JSON(http.StatusOK, gin.H{
			"can_delete":          false,
			"blocking_reasons":    []string{"Layanan verifikasi wallet tidak tersedia. Coba lagi nanti."},
			"warnings":            []string{},
			"wallet_balance":      0,
			"pending_transfers":   0,
			"disputed_transfers":  0,
			"pending_withdrawals": 0,
			"service_unavailable": true,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"can_delete":          result.CanDelete,
		"blocking_reasons":    result.BlockingReasons,
		"warnings":            result.Warnings,
		"wallet_balance":      result.WalletBalance,
		"pending_transfers":   result.PendingTransfers,
		"disputed_transfers":  result.DisputedTransfers,
		"pending_withdrawals": result.PendingWithdrawals,
	})
}

// callFeatureServiceValidation calls Feature-Service to validate account deletion
func callFeatureServiceValidation(c *gin.Context, userID uint) (*FeatureServiceValidationResult, error) {
	url := fmt.Sprintf("%s/api/v1/user/%d/can-delete", config.FeatureServiceURL, userID)

	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Forward the JWT token for authentication
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("feature-service error: %s", string(body))
	}

	var result FeatureServiceValidationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// callFeatureServiceCleanup calls Feature-Service to delete user data from MongoDB
func callFeatureServiceCleanup(c *gin.Context, userID uint) (*FeatureServiceCleanupResult, error) {
	url := fmt.Sprintf("%s/api/v1/user/%d/cleanup", config.FeatureServiceURL, userID)

	req, err := http.NewRequestWithContext(c.Request.Context(), "DELETE", url, nil)
	if err != nil {
		return nil, err
	}

	// Forward the JWT token for authentication
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result FeatureServiceCleanupResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		if result.BlockingReason != "" {
			return &result, fmt.Errorf("%s", result.BlockingReason)
		}
		return nil, fmt.Errorf("feature-service cleanup failed")
	}

	return &result, nil
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

	// Step 1: Validate with Feature-Service (check wallet balance, pending transfers, disputes)
	// STRICT MODE: Feature-Service MUST be available and validation MUST pass
	validation, err := callFeatureServiceValidation(c, uint(user.ID))
	if err != nil {
		// Feature-Service unavailable - BLOCK deletion for financial safety
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":               "Layanan verifikasi wallet tidak tersedia. Tidak dapat memproses penghapusan akun.",
			"service_unavailable": true,
		})
		return
	}

	if validation != nil && !validation.CanDelete {
		// Validation failed - user has blocking conditions
		c.JSON(http.StatusBadRequest, gin.H{
			"error":               "Tidak dapat menghapus akun",
			"blocking_reasons":    validation.BlockingReasons,
			"wallet_balance":      validation.WalletBalance,
			"pending_transfers":   validation.PendingTransfers,
			"disputed_transfers":  validation.DisputedTransfers,
			"pending_withdrawals": validation.PendingWithdrawals,
		})
		return
	}

	// Step 2: Call Feature-Service cleanup (hard delete MongoDB data)
	_, cleanupErr := callFeatureServiceCleanup(c, uint(user.ID))
	if cleanupErr != nil {
		// Check if it's a blocking error (wallet balance, pending transfer discovered during cleanup)
		if strings.Contains(cleanupErr.Error(), "saldo") ||
			strings.Contains(cleanupErr.Error(), "transfer") ||
			strings.Contains(cleanupErr.Error(), "dispute") {
			c.JSON(http.StatusBadRequest, gin.H{"error": cleanupErr.Error()})
			return
		}
		// For other errors (network, etc.), log but continue with PostgreSQL deletion
		// Data in MongoDB becomes orphan but user can still delete account
	}

	// Step 3: Delete from PostgreSQL
	client := database.GetEntClient()

	// Use Ent transaction for cascading delete
	tx, err := client.Tx(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses penghapusan"})
		return
	}

	// 1. Delete all user's threads
	if _, err := tx.Thread.Delete().Where(thread.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus thread"})
		return
	}

	// 2. Delete all sessions
	if _, err := tx.Session.Delete().Where(session.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi"})
		return
	}

	// 3. Delete sudo sessions
	if _, err := tx.SudoSession.Delete().Where(sudosession.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus sesi sudo"})
		return
	}

	// 4. Delete session locks
	if _, err := tx.SessionLock.Delete().Where(sessionlock.UserIDEQ(int(user.ID))).Exec(ctx); err != nil {
		_ = tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus session locks"})
		return
	}

	// 5. Delete backup codes
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
