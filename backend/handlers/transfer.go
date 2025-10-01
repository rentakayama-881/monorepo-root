package handlers

import (
	"net/http"
	"time"

	"backend-gin/database"
	"backend-gin/dto"
	"backend-gin/models"
	"github.com/gin-gonic/gin"
)

func TransferBalanceHandler(c *gin.Context) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	sender := userIfc.(*models.User)

	var req dto.TransferBalanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request tidak valid"})
		return
	}

	// Find recipient
	var recipient models.User
	if err := database.DB.Where("name = ?", req.RecipientUsername).First(&recipient).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "penerima tidak ditemukan"})
		return
	}

	if recipient.ID == sender.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tidak bisa transfer ke diri sendiri"})
		return
	}

	if sender.Balance < req.Amount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "saldo tidak cukup"})
		return
	}

	// Calculate hold_until
	var holdDuration time.Duration
	switch req.HoldPeriod {
	case "1h":
		holdDuration = time.Hour
	case "7d":
		holdDuration = 7 * 24 * time.Hour
	case "12m":
		holdDuration = 365 * 24 * time.Hour // approx 12 months
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "masa penahanan tidak valid"})
		return
	}
	holdUntil := time.Now().Add(holdDuration)

	// Deduct sender balance
	if err := database.DB.Model(&sender).Update("balance", sender.Balance-req.Amount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal update saldo pengirim"})
		return
	}

	// Create transfer record as pending
	transfer := models.Transfer{
		SenderID:    sender.ID,
		RecipientID: recipient.ID,
		Amount:      req.Amount,
		HoldUntil:   holdUntil,
		Status:      "pending",
	}
	if err := database.DB.Create(&transfer).Error; err != nil {
		// rollback sender
		database.DB.Model(&sender).Update("balance", sender.Balance)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal mencatat transfer"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "transfer berhasil"})
}
