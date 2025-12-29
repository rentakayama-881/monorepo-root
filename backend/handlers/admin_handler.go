package handlers

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// adminLoginLimiter limits admin login attempts to prevent brute-force attacks
// 5 attempts per 15 minutes per IP
var adminLoginLimiter = middleware.NewRateLimiter(5, 15*time.Minute)

// ==================== Admin Auth ====================

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func AdminLogin(c *gin.Context) {
	// Rate limit admin login attempts
	if !adminLoginLimiter.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": gin.H{"code": "RATE001", "message": "Terlalu banyak percobaan. Coba lagi nanti."},
		})
		return
	}

	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Email dan password wajib diisi"},
		})
		return
	}

	var admin models.Admin
	if err := database.DB.Where("email = ?", strings.ToLower(req.Email)).First(&admin).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "ADMIN006", "message": "Email atau password salah"},
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "ADMIN006", "message": "Email atau password salah"},
		})
		return
	}

	// Generate admin JWT - secret is REQUIRED
	secret := os.Getenv("ADMIN_JWT_SECRET")
	if secret == "" {
		logger.Error("ADMIN_JWT_SECRET not configured")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Server configuration error"},
		})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"type":     "admin",
		"admin_id": admin.ID,
		"email":    admin.Email,
		"name":     admin.Name,
		"exp":      time.Now().Add(8 * time.Hour).Unix(), // 8 hour expiry
		"iat":      time.Now().Unix(),
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		logger.Error("Failed to sign admin token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal membuat token"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"admin": gin.H{
			"id":    admin.ID,
			"email": admin.Email,
			"name":  admin.Name,
		},
	})
}

// ==================== Badge CRUD ====================

type CreateBadgeRequest struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
	IconURL     string `json:"icon_url" binding:"required"`
	Color       string `json:"color"`
}

func CreateBadge(c *gin.Context) {
	var req CreateBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Data badge tidak valid"},
		})
		return
	}

	// Normalize slug
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.Slug = strings.ReplaceAll(req.Slug, " ", "-")

	// Check duplicate slug
	var existing models.Badge
	if database.DB.Where("slug = ?", req.Slug).First(&existing).Error == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE001", "message": "Slug badge sudah digunakan"},
		})
		return
	}

	badge := models.Badge{
		Name:        req.Name,
		Slug:        req.Slug,
		Description: req.Description,
		IconURL:     req.IconURL,
		Color:       req.Color,
	}

	if badge.Color == "" {
		badge.Color = "#6366f1"
	}

	if err := database.DB.Create(&badge).Error; err != nil {
		logger.Error("Failed to create badge", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal membuat badge"},
		})
		return
	}

	logger.Info("Badge created", zap.Uint("badge_id", badge.ID), zap.String("slug", badge.Slug))

	c.JSON(http.StatusCreated, gin.H{
		"message": "Badge berhasil dibuat",
		"badge":   badge,
	})
}

func ListBadges(c *gin.Context) {
	var badges []models.Badge
	if err := database.DB.Order("name ASC").Find(&badges).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengambil data badge"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"badges": badges})
}

func GetBadge(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	var badge models.Badge
	if err := database.DB.First(&badge, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE002", "message": "Badge tidak ditemukan"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"badge": badge})
}

func UpdateBadge(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	var badge models.Badge
	if err := database.DB.First(&badge, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE002", "message": "Badge tidak ditemukan"},
		})
		return
	}

	var req CreateBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Data badge tidak valid"},
		})
		return
	}

	// Check slug conflict
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.Slug = strings.ReplaceAll(req.Slug, " ", "-")

	var existing models.Badge
	if database.DB.Where("slug = ? AND id != ?", req.Slug, id).First(&existing).Error == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE001", "message": "Slug badge sudah digunakan"},
		})
		return
	}

	badge.Name = req.Name
	badge.Slug = req.Slug
	badge.Description = req.Description
	badge.IconURL = req.IconURL
	if req.Color != "" {
		badge.Color = req.Color
	}

	if err := database.DB.Save(&badge).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengupdate badge"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Badge berhasil diupdate",
		"badge":   badge,
	})
}

func DeleteBadge(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	// Check if badge is assigned to any user
	var count int64
	database.DB.Model(&models.UserBadge{}).Where("badge_id = ? AND revoked_at IS NULL", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE003", "message": "Badge masih digunakan oleh user. Cabut semua badge terlebih dahulu."},
		})
		return
	}

	if err := database.DB.Delete(&models.Badge{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal menghapus badge"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Badge berhasil dihapus"})
}

// ==================== User Badge Management ====================

type AssignBadgeRequest struct {
	BadgeID uint   `json:"badge_id" binding:"required"`
	Reason  string `json:"reason"`
}

func AssignBadgeToUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("userId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID user tidak valid"},
		})
		return
	}

	var req AssignBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Badge ID wajib diisi"},
		})
		return
	}

	// Check user exists
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Check badge exists
	var badge models.Badge
	if err := database.DB.First(&badge, req.BadgeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE002", "message": "Badge tidak ditemukan"},
		})
		return
	}

	// Check if already assigned (and not revoked)
	var existing models.UserBadge
	if database.DB.Where("user_id = ? AND badge_id = ? AND revoked_at IS NULL", userID, req.BadgeID).First(&existing).Error == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE004", "message": "User sudah memiliki badge ini"},
		})
		return
	}

	adminID := c.GetUint("admin_id")

	userBadge := models.UserBadge{
		UserID:    uint(userID),
		BadgeID:   req.BadgeID,
		Reason:    req.Reason,
		GrantedBy: adminID,
		GrantedAt: time.Now(),
	}

	if err := database.DB.Create(&userBadge).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal memberikan badge"},
		})
		return
	}

	logger.Info("Badge assigned to user",
		zap.Uint("user_id", uint(userID)),
		zap.Uint("badge_id", req.BadgeID),
		zap.Uint("admin_id", adminID),
	)

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Badge berhasil diberikan",
		"user_badge": userBadge,
	})
}

type RevokeBadgeRequest struct {
	Reason string `json:"reason"`
}

func RevokeBadgeFromUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("userId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID user tidak valid"},
		})
		return
	}

	badgeID, err := strconv.ParseUint(c.Param("badgeId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	var req RevokeBadgeRequest
	c.ShouldBindJSON(&req)

	var userBadge models.UserBadge
	if err := database.DB.Where("user_id = ? AND badge_id = ? AND revoked_at IS NULL", userID, badgeID).First(&userBadge).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE005", "message": "User tidak memiliki badge ini"},
		})
		return
	}

	now := time.Now()
	userBadge.RevokedAt = &now
	userBadge.RevokeReason = req.Reason

	if err := database.DB.Save(&userBadge).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mencabut badge"},
		})
		return
	}

	// If this was the user's primary badge, clear it
	database.DB.Model(&models.User{}).Where("id = ? AND primary_badge_id = ?", userID, badgeID).
		Update("primary_badge_id", nil)

	logger.Info("Badge revoked from user",
		zap.Uint("user_id", uint(userID)),
		zap.Uint("badge_id", uint(badgeID)),
	)

	c.JSON(http.StatusOK, gin.H{"message": "Badge berhasil dicabut"})
}

// ==================== Admin User List ====================

func AdminListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var users []models.User
	var total int64

	query := database.DB.Model(&models.User{})

	if search != "" {
		searchPattern := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(email) LIKE ? OR LOWER(COALESCE(name, '')) LIKE ? OR LOWER(COALESCE(full_name, '')) LIKE ?",
			searchPattern, searchPattern, searchPattern,
		)
	}

	query.Count(&total)
	query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&users)

	// Prepare response with user badges
	type UserWithBadges struct {
		ID           uint           `json:"id"`
		Email        string         `json:"email"`
		Username     *string        `json:"username"`
		AvatarURL    string         `json:"avatar_url"`
		CreatedAt    time.Time      `json:"created_at"`
		PrimaryBadge *models.Badge  `json:"primary_badge"`
		Badges       []models.Badge `json:"badges"`
	}

	var result []UserWithBadges
	for _, u := range users {
		uwb := UserWithBadges{
			ID:        u.ID,
			Email:     u.Email,
			Username:  u.Username,
			AvatarURL: u.AvatarURL,
			CreatedAt: u.CreatedAt,
		}

		// Get primary badge if set
		if u.PrimaryBadgeID != nil && *u.PrimaryBadgeID > 0 {
			var badge models.Badge
			if database.DB.First(&badge, *u.PrimaryBadgeID).Error == nil {
				uwb.PrimaryBadge = &badge
			}
		}

		// Get user's active badges
		var userBadges []models.UserBadge
		database.DB.Preload("Badge").Where("user_id = ? AND revoked_at IS NULL", u.ID).Find(&userBadges)
		for _, ub := range userBadges {
			uwb.Badges = append(uwb.Badges, ub.Badge)
		}

		result = append(result, uwb)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": result,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func AdminGetUser(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("userId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID user tidak valid"},
		})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Get user's badges (including revoked for admin view)
	var userBadges []models.UserBadge
	database.DB.Preload("Badge").Preload("Admin").Where("user_id = ?", userID).Order("granted_at DESC").Find(&userBadges)

	c.JSON(http.StatusOK, gin.H{
		"user":   user,
		"badges": userBadges,
	})
}
