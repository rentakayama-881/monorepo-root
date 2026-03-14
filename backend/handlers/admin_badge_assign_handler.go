package handlers

import (
	"net/http"
	"strconv"
	"time"

	"backend-gin/database"
	"backend-gin/ent/user"
	"backend-gin/ent/userbadge"
	"backend-gin/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

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
