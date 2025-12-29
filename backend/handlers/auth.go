package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/middleware"
	"backend-gin/models"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	loginLimiter    = middleware.NewRateLimiter(10, time.Minute)
	registerLimiter = middleware.NewRateLimiter(6, time.Minute)
	verifyLimiter   = middleware.NewRateLimiter(10, time.Minute)
)

var emailRegex = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// POST /api/auth/register
func RegisterHandler(c *gin.Context) {
	if !registerLimiter.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Terlalu banyak percobaan. Coba lagi nanti."})
		return
	}

	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	password := strings.TrimSpace(req.Password)
	username := ""
	if req.Username != nil {
		username = strings.TrimSpace(*req.Username)
	}

	if !emailRegex.MatchString(email) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email tidak valid"})
		return
	}
	if len(password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password minimal 8 karakter"})
		return
	}
	if username != "" && len(username) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username terlalu panjang"})
		return
	}

	var existing models.User
	if err := database.DB.Where("email = ?", email).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email sudah terdaftar"})
		return
	}

	if username != "" {
		var count int64
		database.DB.Model(&models.User{}).Where("name = ?", username).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Username sudah digunakan"})
			return
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses password"})
		return
	}

	user := models.User{
		Email:         email,
		PasswordHash:  string(hash),
		EmailVerified: false,
		AvatarURL:     "",
	}
	if username != "" {
		user.Username = &username
	}
	if req.FullName != nil {
		user.FullName = req.FullName
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendaftarkan pengguna"})
		return
	}

	if _, _, err := createAndLogVerificationToken(&user, c); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token verifikasi"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registrasi berhasil. Silakan verifikasi email Anda.",
		"verification": gin.H{
			"required": true,
		},
	})
}

// POST /api/auth/login
func LoginHandler(c *gin.Context) {
	if !loginLimiter.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Terlalu banyak percobaan. Coba lagi nanti."})
		return
	}

	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	password := strings.TrimSpace(req.Password)

	var user models.User
	if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
		// Hindari enum
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kredensial tidak valid"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kredensial tidak valid"})
		return
	}

	if !user.EmailVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "Email belum terverifikasi", "verification_required": true})
		return
	}

	token, err := middleware.GenerateJWT(user.Email, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token"})
		return
	}

	username := ""
	if user.Username != nil {
		username = *user.Username
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"email":     user.Email,
			"username":  username,
			"full_name": user.FullName,
		},
	})
}

// POST /api/auth/verify/request
func RequestVerification(c *gin.Context) {
	if !verifyLimiter.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Terlalu banyak permintaan. Coba lagi nanti."})
		return
	}

	var req dto.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	var user models.User
	if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Jika email terdaftar, tautan verifikasi telah dikirim."})
		return
	}

	if _, _, err := createAndLogVerificationToken(&user, c); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token verifikasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Jika email terdaftar, tautan verifikasi telah dikirim."})
}

// POST /api/auth/verify/confirm
func ConfirmVerification(c *gin.Context) {
	var req dto.VerifyConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token wajib diisi"})
		return
	}

	hash := hashToken(token)
	var record models.EmailVerificationToken
	if err := database.DB.Where("token_hash = ?", hash).First(&record).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token tidak valid"})
		return
	}
	if record.UsedAt != nil || time.Now().After(record.ExpiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token sudah tidak berlaku"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, record.UserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pengguna tidak ditemukan"})
		return
	}

	// mark verified
	now := time.Now()
	record.UsedAt = &now
	user.EmailVerified = true
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		if err := tx.Save(&user).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status verifikasi"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email berhasil diverifikasi"})
}

func createAndLogVerificationToken(user *models.User, _ *gin.Context) (string, string, error) {
	raw, err := randomToken()
	if err != nil {
		return "", "", err
	}
	hash := hashToken(raw)
	expires := time.Now().Add(24 * time.Hour)

	token := models.EmailVerificationToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: expires,
	}
	if err := database.DB.Create(&token).Error; err != nil {
		return "", "", err
	}

	frontend := strings.TrimSuffix(os.Getenv("FRONTEND_BASE_URL"), "/")
	if frontend == "" {
		frontend = "http://localhost:3000"
	}
	link := frontend + "/verify-email?token=" + raw

	// Send verification email via Resend
	if err := utils.SendVerificationEmail(user.Email, raw); err != nil {
		log.Printf("Warning: Failed to send verification email to %s: %v", user.Email, err)
		// Continue anyway - don't block registration if email fails
	}

	return raw, link, nil
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
