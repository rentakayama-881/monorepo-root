package handlers

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/admin"
	"backend-gin/ent/badge"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/logger"
	"backend-gin/middleware"
	"backend-gin/services"

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

	// Query Ent Admin by email using admin predicate
	adminUser, err := database.GetEntClient().Admin.Query().
		Where(admin.EmailEQ(strings.ToLower(req.Email))).
		Only(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "ADMIN006", "message": "Email atau password salah"},
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(adminUser.PasswordHash), []byte(req.Password)); err != nil {
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
		"admin_id": adminUser.ID,
		"email":    adminUser.Email,
		"name":     adminUser.Name,
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
			"id":    adminUser.ID,
			"email": adminUser.Email,
			"name":  adminUser.Name,
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

	// Check duplicate slug using Ent
	exists, err := database.GetEntClient().Badge.Query().
		Where(badge.SlugEQ(req.Slug)).
		Exist(c.Request.Context())
	if err == nil && exists {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE001", "message": "Slug badge sudah digunakan"},
		})
		return
	}

	color := req.Color
	if color == "" {
		color = "#6366f1"
	}

	// Create badge using Ent
	badgeEnt, err := database.GetEntClient().Badge.Create().
		SetName(req.Name).
		SetSlug(req.Slug).
		SetDescription(req.Description).
		SetIconURL(req.IconURL).
		SetColor(color).
		Save(c.Request.Context())
	if err != nil {
		logger.Error("Failed to create badge", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal membuat badge"},
		})
		return
	}

	logger.Info("Badge created", zap.Int("badge_id", badgeEnt.ID), zap.String("slug", badgeEnt.Slug))

	// Map to services.Badge for response
	mappedBadge := services.Badge{
		Name:        badgeEnt.Name,
		Slug:        badgeEnt.Slug,
		Description: badgeEnt.Description,
		IconURL:     badgeEnt.IconURL,
		Color:       badgeEnt.Color,
	}
	mappedBadge.ID = uint(badgeEnt.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Badge berhasil dibuat",
		"badge":   mappedBadge,
	})
}

func ListBadges(c *gin.Context) {
	// Query all badges using Ent, ordered by name
	badges, err := database.GetEntClient().Badge.Query().
		Order(ent.Asc(badge.FieldName)).
		All(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengambil data badge"},
		})
		return
	}

	// Map to services.Badge for response
	var mappedBadges []services.Badge
	for _, b := range badges {
		mb := services.Badge{
			Name:        b.Name,
			Slug:        b.Slug,
			Description: b.Description,
			IconURL:     b.IconURL,
			Color:       b.Color,
		}
		mb.ID = uint(b.ID)
		mappedBadges = append(mappedBadges, mb)
	}

	c.JSON(http.StatusOK, gin.H{"badges": mappedBadges})
}

func GetBadge(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	// Query badge by ID using Ent
	badgeEnt, err := database.GetEntClient().Badge.Get(c.Request.Context(), int(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE002", "message": "Badge tidak ditemukan"},
		})
		return
	}

	// Map to services.Badge
	mappedBadge := services.Badge{
		Name:        badgeEnt.Name,
		Slug:        badgeEnt.Slug,
		Description: badgeEnt.Description,
		IconURL:     badgeEnt.IconURL,
		Color:       badgeEnt.Color,
	}
	mappedBadge.ID = uint(badgeEnt.ID)

	c.JSON(http.StatusOK, gin.H{"badge": mappedBadge})
}

func UpdateBadge(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	// Get badge using Ent
	badgeEnt, err := database.GetEntClient().Badge.Get(c.Request.Context(), int(id))
	if err != nil {
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

	// Check if slug is taken by another badge
	exists, err := database.GetEntClient().Badge.Query().
		Where(
			badge.SlugEQ(req.Slug),
			badge.IDNEQ(int(id)),
		).
		Exist(c.Request.Context())
	if err == nil && exists {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE001", "message": "Slug badge sudah digunakan"},
		})
		return
	}

	color := req.Color
	if color == "" {
		color = badgeEnt.Color // Keep existing if not provided
	}

	// Update badge using Ent
	updatedBadge, err := database.GetEntClient().Badge.UpdateOneID(int(id)).
		SetName(req.Name).
		SetSlug(req.Slug).
		SetDescription(req.Description).
		SetIconURL(req.IconURL).
		SetColor(color).
		Save(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengupdate badge"},
		})
		return
	}

	// Map to services.Badge
	mappedBadge := services.Badge{
		Name:        updatedBadge.Name,
		Slug:        updatedBadge.Slug,
		Description: updatedBadge.Description,
		IconURL:     updatedBadge.IconURL,
		Color:       updatedBadge.Color,
	}
	mappedBadge.ID = uint(updatedBadge.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Badge berhasil diupdate",
		"badge":   mappedBadge,
	})
}

func DeleteBadge(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	// Check if badge is assigned to any user (not revoked)
	count, err := database.GetEntClient().UserBadge.Query().
		Where(
			userbadge.BadgeIDEQ(int(id)),
			userbadge.RevokedAtIsNil(),
		).
		Count(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengecek penggunaan badge"},
		})
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE003", "message": "Badge masih digunakan oleh user. Cabut semua badge terlebih dahulu."},
		})
		return
	}

	// Delete badge using Ent
	err = database.GetEntClient().Badge.DeleteOneID(int(id)).Exec(c.Request.Context())
	if err != nil {
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
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 32)
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

	// Check user exists using Ent
	_, err = database.GetEntClient().User.Get(c.Request.Context(), int(userID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Check badge exists using Ent
	_, err = database.GetEntClient().Badge.Get(c.Request.Context(), int(req.BadgeID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE002", "message": "Badge tidak ditemukan"},
		})
		return
	}

	// Check if already assigned (and not revoked)
	exists, err := database.GetEntClient().UserBadge.Query().
		Where(
			userbadge.UserIDEQ(int(userID)),
			userbadge.BadgeIDEQ(int(req.BadgeID)),
			userbadge.RevokedAtIsNil(),
		).
		Exist(c.Request.Context())
	if err == nil && exists {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{"code": "BADGE004", "message": "User sudah memiliki badge ini"},
		})
		return
	}

	adminID := c.GetUint("admin_id")

	// Create user badge using Ent
	userBadgeEnt, err := database.GetEntClient().UserBadge.Create().
		SetUserID(int(userID)).
		SetBadgeID(int(req.BadgeID)).
		SetReason(req.Reason).
		SetGrantedBy(int(adminID)).
		SetGrantedAt(time.Now()).
		Save(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal memberikan badge"},
		})
		return
	}

	logger.Info("Badge assigned to user",
		zap.Int("user_id", int(userID)),
		zap.Int("badge_id", int(req.BadgeID)),
		zap.Uint("admin_id", adminID),
	)

	// Return response using direct values instead of models
	c.JSON(http.StatusCreated, gin.H{
		"message": "Badge berhasil diberikan",
		"user_badge": gin.H{
			"id":         userBadgeEnt.ID,
			"user_id":    userBadgeEnt.UserID,
			"badge_id":   userBadgeEnt.BadgeID,
			"reason":     userBadgeEnt.Reason,
			"granted_by": userBadgeEnt.GrantedBy,
			"granted_at": userBadgeEnt.GrantedAt,
		},
	})
}

type RevokeBadgeRequest struct {
	Reason string `json:"reason"`
}

func RevokeBadgeFromUser(c *gin.Context) {
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID user tidak valid"},
		})
		return
	}

	badgeID, err := strconv.ParseInt(c.Param("badgeId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID badge tidak valid"},
		})
		return
	}

	var req RevokeBadgeRequest
	_ = c.ShouldBindJSON(&req) // Reason is optional, ignore bind errors

	// Find user badge using Ent
	userBadgeEnt, err := database.GetEntClient().UserBadge.Query().
		Where(
			userbadge.UserIDEQ(int(userID)),
			userbadge.BadgeIDEQ(int(badgeID)),
			userbadge.RevokedAtIsNil(),
		).
		Only(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE005", "message": "User tidak memiliki badge ini"},
		})
		return
	}

	now := time.Now()

	// Update user badge to revoke it using Ent
	_, err = database.GetEntClient().UserBadge.UpdateOneID(userBadgeEnt.ID).
		SetRevokedAt(now).
		SetRevokeReason(req.Reason).
		Save(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mencabut badge"},
		})
		return
	}

	// If this was the user's primary badge, clear it using Ent
	database.GetEntClient().User.UpdateOneID(int(userID)).
		ClearPrimaryBadge().
		Where(user.PrimaryBadgeIDEQ(int(badgeID))).
		Save(c.Request.Context())

	logger.Info("Badge revoked from user",
		zap.Int("user_id", int(userID)),
		zap.Int("badge_id", int(badgeID)),
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

	// Build query with optional search filter
	var total int64
	var users []*ent.User

	if search != "" {
		// We'll query and filter manually since Ent doesn't have built-in COALESCE support
		allUsers, _ := database.GetEntClient().User.Query().All(c.Request.Context())
		var filtered []*ent.User
		searchLower := strings.ToLower(search)
		for _, u := range allUsers {
			username := ""
			if u.Username != nil {
				username = strings.ToLower(*u.Username)
			}
			fullName := ""
			if u.FullName != nil {
				fullName = strings.ToLower(*u.FullName)
			}
			if strings.Contains(strings.ToLower(u.Email), searchLower) ||
				strings.Contains(username, searchLower) ||
				strings.Contains(fullName, searchLower) {
				filtered = append(filtered, u)
			}
		}
		// For pagination, we'll use the filtered set
		total = int64(len(filtered))
		start := offset
		end := offset + limit
		if start >= len(filtered) {
			start = len(filtered)
		}
		if end > len(filtered) {
			end = len(filtered)
		}
		if start < end {
			users = filtered[start:end]
		}
	} else {
		// No search, get all with pagination
		count, countErr := database.GetEntClient().User.Query().Count(c.Request.Context())
		total = int64(count)
		if countErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{"code": "SRV001", "message": "Gagal mengambil data user"},
			})
			return
		}

		// Query users with offset and limit, ordered by created_at DESC
		usersErr := error(nil)
		users, usersErr = database.GetEntClient().User.Query().
			Offset(offset).
			Limit(limit).
			Order(ent.Desc(user.FieldCreatedAt)).
			WithPrimaryBadge().
			All(c.Request.Context())
		if usersErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{"code": "SRV001", "message": "Gagal mengambil data user"},
			})
			return
		}
	}

	// Prepare response with user badges
	type UserWithBadges struct {
		ID           uint             `json:"id"`
		Email        string           `json:"email"`
		Username     *string          `json:"username"`
		AvatarURL    string           `json:"avatar_url"`
		CreatedAt    time.Time        `json:"created_at"`
		PrimaryBadge *services.Badge  `json:"primary_badge"`
		Badges       []services.Badge `json:"badges"`
	}

	var result []UserWithBadges
	for _, u := range users {
		uwb := UserWithBadges{
			ID:        uint(u.ID),
			Email:     u.Email,
			Username:  u.Username,
			AvatarURL: u.AvatarURL,
			CreatedAt: u.CreatedAt,
		}

		// Get primary badge if set using eager loaded data
		if u.Edges.PrimaryBadge != nil {
			pb := services.Badge{
				Name:        u.Edges.PrimaryBadge.Name,
				Slug:        u.Edges.PrimaryBadge.Slug,
				Description: u.Edges.PrimaryBadge.Description,
				IconURL:     u.Edges.PrimaryBadge.IconURL,
				Color:       u.Edges.PrimaryBadge.Color,
			}
			pb.ID = uint(u.Edges.PrimaryBadge.ID)
			uwb.PrimaryBadge = &pb
		}

		// Get user's active badges
		userBadges, err := database.GetEntClient().UserBadge.Query().
			Where(
				userbadge.UserIDEQ(u.ID),
				userbadge.RevokedAtIsNil(),
			).
			WithBadge().
			All(c.Request.Context())
		if err == nil {
			for _, ub := range userBadges {
				if ub.Edges.Badge != nil {
					mb := services.Badge{
						Name:        ub.Edges.Badge.Name,
						Slug:        ub.Edges.Badge.Slug,
						Description: ub.Edges.Badge.Description,
						IconURL:     ub.Edges.Badge.IconURL,
						Color:       ub.Edges.Badge.Color,
					}
					mb.ID = uint(ub.Edges.Badge.ID)
					uwb.Badges = append(uwb.Badges, mb)
				}
			}
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
	userID, err := strconv.ParseInt(c.Param("userId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "ID user tidak valid"},
		})
		return
	}

	// Get user using Ent
	entUser, err := database.GetEntClient().User.Get(c.Request.Context(), int(userID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Get user's badges (including revoked for admin view)
	userBadges, err := database.GetEntClient().UserBadge.Query().
		Where(userbadge.UserIDEQ(int(userID))).
		WithBadge().
		Order(ent.Desc(userbadge.FieldGrantedAt)).
		All(c.Request.Context())
	if err != nil {
		userBadges = []*ent.UserBadge{}
	}

	// Build badges response
	var badgesResponse []gin.H
	for _, ub := range userBadges {
		badgesResponse = append(badgesResponse, gin.H{
			"id":         ub.ID,
			"user_id":    ub.UserID,
			"badge_id":   ub.BadgeID,
			"reason":     ub.Reason,
			"granted_by": ub.GrantedBy,
			"granted_at": ub.GrantedAt,
			"revoked_at": ub.RevokedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":               entUser.ID,
			"email":            entUser.Email,
			"username":         entUser.Username,
			"full_name":        entUser.FullName,
			"bio":              entUser.Bio,
			"avatar_url":       entUser.AvatarURL,
			"pronouns":         entUser.Pronouns,
			"company":          entUser.Company,
			"telegram":         entUser.Telegram,
			"primary_badge_id": entUser.PrimaryBadgeID,
		},
		"badges": badgesResponse,
	})
}
