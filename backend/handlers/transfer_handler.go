package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/database"
	"backend-gin/models"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// TransferHandler handles transfer-related endpoints
type TransferHandler struct {
	transferService *services.TransferService
	walletService   *services.WalletService
}

// NewTransferHandler creates a new transfer handler
func NewTransferHandler() *TransferHandler {
	return &TransferHandler{
		transferService: services.NewTransferService(),
		walletService:   services.NewWalletService(),
	}
}

// CreateTransferRequest represents a request to create a transfer
type CreateTransferRequest struct {
	ReceiverUsername string `json:"receiver_username" binding:"required"`
	Amount           int64  `json:"amount" binding:"required,min=1000"` // Minimum 1,000 IDR
	HoldDays         int    `json:"hold_days" binding:"required,oneof=7 30"`
	Description      string `json:"description"`
	PIN              string `json:"pin" binding:"required,len=6"`
}

// CreateTransfer creates a new escrow transfer
func (h *TransferHandler) CreateTransfer(c *gin.Context) {
	senderID := c.GetUint("user_id")

	var req CreateTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Check if PIN is set
	pinSet, err := h.walletService.IsPINSet(senderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check PIN status"})
		return
	}
	if !pinSet {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "PIN not set",
			"code":     "PIN_NOT_SET",
			"redirect": "/account/wallet/set-pin",
		})
		return
	}

	// Find receiver by username
	var receiver models.User
	if err := database.DB.Where("username = ?", req.ReceiverUsername).First(&receiver).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Receiver not found"})
		return
	}

	// Cannot transfer to self
	if receiver.ID == senderID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot transfer to yourself"})
		return
	}

	// Create transfer
	transfer, err := h.transferService.CreateTransfer(services.CreateTransferInput{
		SenderID:    senderID,
		ReceiverID:  receiver.ID,
		Amount:      req.Amount,
		HoldDays:    req.HoldDays,
		Description: req.Description,
		PIN:         req.PIN,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Transfer created successfully",
		"transfer": transfer,
	})
}

// GetMyTransfers returns the user's transfers
func (h *TransferHandler) GetMyTransfers(c *gin.Context) {
	userID := c.GetUint("user_id")

	role := c.DefaultQuery("role", "") // sender, receiver, or empty for both
	status := c.DefaultQuery("status", "")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	transfers, total, err := h.transferService.GetUserTransfers(userID, role, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get transfers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transfers": transfers,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
	})
}

// GetTransferByID returns a specific transfer
func (h *TransferHandler) GetTransferByID(c *gin.Context) {
	userID := c.GetUint("user_id")
	transferID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transfer ID"})
		return
	}

	transfer, err := h.transferService.GetTransferByID(uint(transferID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transfer not found"})
		return
	}

	// Check if user is part of the transfer
	if transfer.SenderID != userID && transfer.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transfer": transfer})
}

// GetTransferByCode returns a specific transfer by code
func (h *TransferHandler) GetTransferByCode(c *gin.Context) {
	userID := c.GetUint("user_id")
	code := c.Param("code")

	transfer, err := h.transferService.GetTransferByCode(code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transfer not found"})
		return
	}

	// Check if user is part of the transfer
	if transfer.SenderID != userID && transfer.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transfer": transfer})
}

// ReleaseTransferRequest represents a request to release a transfer
type ReleaseTransferRequest struct {
	PIN string `json:"pin" binding:"required,len=6"`
}

// ReleaseTransfer releases held funds to the receiver
func (h *TransferHandler) ReleaseTransfer(c *gin.Context) {
	userID := c.GetUint("user_id")
	transferID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transfer ID"})
		return
	}

	var req ReleaseTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN required"})
		return
	}

	// Verify PIN
	valid, err := h.walletService.VerifyPIN(userID, req.PIN)
	if err != nil || !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid PIN"})
		return
	}

	transfer, err := h.transferService.ReleaseTransfer(uint(transferID), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Transfer released successfully",
		"transfer": transfer,
	})
}

// CancelTransfer cancels a held transfer (receiver action)
func (h *TransferHandler) CancelTransfer(c *gin.Context) {
	userID := c.GetUint("user_id")
	transferID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transfer ID"})
		return
	}

	transfer, err := h.transferService.CancelTransfer(uint(transferID), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Transfer cancelled successfully",
		"transfer": transfer,
	})
}

// SearchUserRequest represents a request to search for a user
type SearchUserRequest struct {
	Username string `form:"username" binding:"required,min=3"`
}

// SearchUser searches for a user by username (for transfer recipient)
func (h *TransferHandler) SearchUser(c *gin.Context) {
	currentUserID := c.GetUint("user_id")

	var req SearchUserRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 3 characters"})
		return
	}

	var users []models.User
	database.DB.Where("username ILIKE ? AND id != ?", "%"+req.Username+"%", currentUserID).
		Limit(10).
		Find(&users)

	// Return only safe user info
	results := make([]gin.H, 0)
	for _, u := range users {
		results = append(results, gin.H{
			"id":         u.ID,
			"username":   u.Username,
			"avatar_url": u.AvatarURL,
		})
	}

	c.JSON(http.StatusOK, gin.H{"users": results})
}

// GetPendingReceivedTransfers returns transfers waiting to be received
func (h *TransferHandler) GetPendingReceivedTransfers(c *gin.Context) {
	userID := c.GetUint("user_id")

	transfers, total, err := h.transferService.GetUserTransfers(userID, "receiver", string(models.TransferStatusHeld), 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get transfers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transfers": transfers,
		"total":     total,
	})
}

// GetPendingSentTransfers returns transfers waiting to be released
func (h *TransferHandler) GetPendingSentTransfers(c *gin.Context) {
	userID := c.GetUint("user_id")

	transfers, total, err := h.transferService.GetUserTransfers(userID, "sender", string(models.TransferStatusHeld), 100, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get transfers"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transfers": transfers,
		"total":     total,
	})
}
