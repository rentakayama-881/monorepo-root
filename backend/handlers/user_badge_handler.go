package handlers

import (
	"net/http"

	"backend-gin/database"
	"backend-gin/models"

	"github.com/gin-gonic/gin"
)

// SetPrimaryBadge allows user to set their primary (display) badge
func SetPrimaryBadge(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "AUTH001", "message": "Unauthorized"},
		})
		return
	}

	var req struct {
		BadgeID *uint `json:"badge_id"` // nil to clear primary badge
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VAL001", "message": "Data tidak valid"},
		})
		return
	}

	// If setting a badge (not clearing)
	if req.BadgeID != nil && *req.BadgeID > 0 {
		// Check user has this badge
		var userBadge models.UserBadge
		if err := database.DB.Where("user_id = ? AND badge_id = ? AND revoked_at IS NULL", userID, *req.BadgeID).First(&userBadge).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{"code": "BADGE005", "message": "Anda tidak memiliki badge ini"},
			})
			return
		}
	}

	// Update user's primary badge
	if err := database.DB.Model(&models.User{}).Where("id = ?", userID).Update("primary_badge_id", req.BadgeID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "SRV001", "message": "Gagal mengupdate primary badge"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Primary badge berhasil diupdate",
	})
}

// GetUserBadgesPublic returns a user's active badges (public endpoint)
func GetUserBadgesPublic(c *gin.Context) {
	username := c.Param("username")

	var user models.User
	if err := database.DB.Where("name = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Get active badges
	var userBadges []models.UserBadge
	database.DB.Preload("Badge").Where("user_id = ? AND revoked_at IS NULL", user.ID).Order("granted_at ASC").Find(&userBadges)

	var badges []gin.H
	for _, ub := range userBadges {
		badges = append(badges, gin.H{
			"id":          ub.Badge.ID,
			"name":        ub.Badge.Name,
			"slug":        ub.Badge.Slug,
			"description": ub.Badge.Description,
			"icon_url":    ub.Badge.IconURL,
			"color":       ub.Badge.Color,
			"granted_at":  ub.GrantedAt,
		})
	}

	// Get primary badge
	var primaryBadge *gin.H
	if user.PrimaryBadgeID != nil {
		var badge models.Badge
		if database.DB.First(&badge, *user.PrimaryBadgeID).Error == nil {
			primaryBadge = &gin.H{
				"id":       badge.ID,
				"name":     badge.Name,
				"slug":     badge.Slug,
				"icon_url": badge.IconURL,
				"color":    badge.Color,
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"badges":        badges,
		"primary_badge": primaryBadge,
	})
}

// GetMyBadges returns current user's badges
func GetMyBadges(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "USER001", "message": "User tidak ditemukan"},
		})
		return
	}

	// Get active badges
	var userBadges []models.UserBadge
	database.DB.Preload("Badge").Where("user_id = ? AND revoked_at IS NULL", user.ID).Order("granted_at ASC").Find(&userBadges)

	var badges []gin.H
	for _, ub := range userBadges {
		badges = append(badges, gin.H{
			"id":          ub.Badge.ID,
			"name":        ub.Badge.Name,
			"slug":        ub.Badge.Slug,
			"description": ub.Badge.Description,
			"icon_url":    ub.Badge.IconURL,
			"color":       ub.Badge.Color,
			"granted_at":  ub.GrantedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"badges":           badges,
		"primary_badge_id": user.PrimaryBadgeID,
	})
}
