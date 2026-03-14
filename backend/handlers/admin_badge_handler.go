package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/badge"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/logger"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type CreateBadgeRequest struct {
	Name        string `json:"name" binding:"required"`
	Slug        string `json:"slug" binding:"required"`
	Description string `json:"description"`
	IconType    string `json:"icon_type"`
	Color       string `json:"color"`
}

// Valid icon types for badges
var validIconTypes = map[string]bool{
	"verified": true, "admin": true, "moderator": true,
	"contributor": true, "premium": true, "trusted": true,
	"checkmark": true, "default": true,
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

	iconType := req.IconType
	if iconType == "" || !validIconTypes[iconType] {
		iconType = "verified"
	}

	// Create badge using Ent
	badgeEnt, err := database.GetEntClient().Badge.Create().
		SetName(req.Name).
		SetSlug(req.Slug).
		SetDescription(req.Description).
		SetIconType(iconType).
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
		IconType:    badgeEnt.IconType,
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
			IconType:    b.IconType,
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
		IconType:    badgeEnt.IconType,
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

	iconType := req.IconType
	if iconType == "" || !validIconTypes[iconType] {
		iconType = badgeEnt.IconType // Keep existing if not provided
	}

	// Update badge using Ent
	updatedBadge, err := database.GetEntClient().Badge.UpdateOneID(int(id)).
		SetName(req.Name).
		SetSlug(req.Slug).
		SetDescription(req.Description).
		SetIconType(iconType).
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
		IconType:    updatedBadge.IconType,
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

	// Check if badge exists first
	_, err = database.GetEntClient().Badge.Get(c.Request.Context(), int(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "BADGE002", "message": "Badge tidak ditemukan"},
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
			"error": gin.H{"code": "BADGE003", "message": "Badge masih digunakan oleh user.  Cabut semua badge terlebih dahulu."},
		})
		return
	}

	// Clear primary_badge_id from users who have this as primary badge
	_, err = database.GetEntClient().User.Update().
		Where(user.PrimaryBadgeIDEQ(int(id))).
		ClearPrimaryBadgeID().
		Save(c.Request.Context())
	if err != nil {
		// Log but don't fail - this is cleanup
		logger.Warn("Failed to clear primary badge from users", zap.Error(err))
	}

	// Delete all user_badges records (including revoked ones) to satisfy foreign key constraint
	_, err = database.GetEntClient().UserBadge.Delete().
		Where(userbadge.BadgeIDEQ(int(id))).
		Exec(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal menghapus riwayat badge"},
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

	logger.Info("Badge deleted", zap.Int64("badge_id", id))

	c.JSON(http.StatusOK, gin.H{"message": "Badge berhasil dihapus"})
}
