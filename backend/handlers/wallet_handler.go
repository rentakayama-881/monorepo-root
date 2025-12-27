package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"backend-gin/database"
	"backend-gin/middleware"
	"backend-gin/models"
	"backend-gin/services"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
)

// pinVerifyLimiter limits PIN verification attempts to prevent brute-force attacks
// 5 attempts per 15 minutes per user
var pinVerifyLimiter = middleware.NewRateLimiter(5, 15*time.Minute)

// WalletHandler handles wallet-related endpoints
type WalletHandler struct {
	walletService *services.WalletService
	xenditClient  *utils.XenditClient
}

// NewWalletHandler creates a new wallet handler
func NewWalletHandler() *WalletHandler {
	return &WalletHandler{
		walletService: services.NewWalletService(),
		xenditClient:  utils.NewXenditClient(),
	}
}

// GetBalance returns the user's wallet balance
func (h *WalletHandler) GetBalance(c *gin.Context) {
	userID := c.GetUint("user_id")

	wallet, err := h.walletService.GetOrCreateWallet(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get wallet"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"balance": wallet.Balance,
		"pin_set": wallet.PINSet,
	})
}

// SetPINRequest represents a request to set PIN
type SetPINRequest struct {
	PIN        string `json:"pin" binding:"required,len=6"`
	ConfirmPIN string `json:"confirm_pin" binding:"required,len=6"`
}

// SetPIN sets the user's transaction PIN
func (h *WalletHandler) SetPIN(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req SetPINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN must be 6 digits"})
		return
	}

	if req.PIN != req.ConfirmPIN {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN confirmation does not match"})
		return
	}

	if err := h.walletService.SetPIN(userID, req.PIN); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PIN set successfully"})
}

// ChangePINRequest represents a request to change PIN
type ChangePINRequest struct {
	CurrentPIN string `json:"current_pin" binding:"required,len=6"`
	NewPIN     string `json:"new_pin" binding:"required,len=6"`
	ConfirmPIN string `json:"confirm_pin" binding:"required,len=6"`
}

// ChangePIN changes the user's transaction PIN
func (h *WalletHandler) ChangePIN(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req ChangePINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.NewPIN != req.ConfirmPIN {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN confirmation does not match"})
		return
	}

	// Verify current PIN
	valid, err := h.walletService.VerifyPIN(userID, req.CurrentPIN)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current PIN is incorrect"})
		return
	}

	if err := h.walletService.SetPIN(userID, req.NewPIN); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PIN changed successfully"})
}

// VerifyPINRequest represents a request to verify PIN
type VerifyPINRequest struct {
	PIN string `json:"pin" binding:"required,len=6"`
}

// VerifyPIN verifies the user's transaction PIN
func (h *WalletHandler) VerifyPIN(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Rate limit PIN verification to prevent brute-force attacks
	if !pinVerifyLimiter.Allow(fmt.Sprintf("pin:%d", userID)) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many PIN verification attempts. Please try again later."})
		return
	}

	var req VerifyPINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN must be 6 digits"})
		return
	}

	valid, err := h.walletService.VerifyPIN(userID, req.PIN)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"valid": valid})
}

// CreateDepositRequest represents a request to create a deposit
type CreateDepositRequest struct {
	Amount int64 `json:"amount" binding:"required,min=10000"` // Minimum 10,000 IDR
}

// CreateDeposit creates a new deposit request
func (h *WalletHandler) CreateDeposit(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req CreateDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimum deposit is Rp 10,000"})
		return
	}

	// Get user for email
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	// Generate external ID
	externalID := services.GenerateDepositExternalID()

	// Get redirect URLs
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	// Create invoice via Xendit (if configured)
	var invoiceURL string
	var xenditID string

	if h.xenditClient.IsConfigured() {
		customerName := ""
		if user.Username != nil {
			customerName = *user.Username
		}
		invoice, err := h.xenditClient.CreateInvoice(utils.CreateInvoiceRequest{
			ExternalID:         externalID,
			Amount:             req.Amount,
			Description:        "Deposit to wallet",
			InvoiceDuration:    86400, // 24 hours
			CustomerEmail:      user.Email,
			CustomerName:       customerName,
			SuccessRedirectURL: frontendURL + "/account/wallet?deposit=success",
			FailureRedirectURL: frontendURL + "/account/wallet?deposit=failed",
			Currency:           "IDR",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment: " + err.Error()})
			return
		}
		invoiceURL = invoice.InvoiceURL
		xenditID = invoice.ID
	} else {
		// Demo mode - just create a pending deposit
		invoiceURL = frontendURL + "/account/wallet/deposit/" + externalID + "/demo"
	}

	// Create deposit record
	deposit := models.Deposit{
		UserID:     userID,
		ExternalID: externalID,
		Amount:     req.Amount,
		Status:     models.DepositStatusPending,
		InvoiceURL: invoiceURL,
	}

	if xenditID != "" {
		callbackData, _ := json.Marshal(map[string]string{"xendit_id": xenditID})
		deposit.XenditCallbackData = string(callbackData)
	}

	if err := database.DB.Create(&deposit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create deposit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deposit_id":  deposit.ID,
		"external_id": deposit.ExternalID,
		"amount":      deposit.Amount,
		"invoice_url": deposit.InvoiceURL,
		"status":      deposit.Status,
	})
}

// GetDeposits returns the user's deposit history
func (h *WalletHandler) GetDeposits(c *gin.Context) {
	userID := c.GetUint("user_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var deposits []models.Deposit
	var total int64

	db := database.DB.Model(&models.Deposit{}).Where("user_id = ?", userID)
	db.Count(&total)
	db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&deposits)

	c.JSON(http.StatusOK, gin.H{
		"deposits": deposits,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// GetTransactionHistory returns the user's wallet transaction history
func (h *WalletHandler) GetTransactionHistory(c *gin.Context) {
	userID := c.GetUint("user_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	transactions, total, err := h.walletService.GetTransactionHistory(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get transaction history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transactions": transactions,
		"total":        total,
		"limit":        limit,
		"offset":       offset,
	})
}

// XenditInvoiceCallback handles Xendit invoice payment callbacks
func (h *WalletHandler) XenditInvoiceCallback(c *gin.Context) {
	// Verify callback token (optional, for security)
	callbackToken := c.GetHeader("x-callback-token")
	expectedToken := os.Getenv("XENDIT_CALLBACK_TOKEN")
	if expectedToken != "" && callbackToken != expectedToken {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid callback token"})
		return
	}

	var callback utils.InvoiceCallback
	if err := c.ShouldBindJSON(&callback); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid callback payload"})
		return
	}

	// Find deposit by external ID
	var deposit models.Deposit
	if err := database.DB.Where("external_id = ?", callback.ExternalID).First(&deposit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deposit not found"})
		return
	}

	// Update deposit based on status
	switch callback.Status {
	case "PAID", "SETTLED":
		if deposit.Status == models.DepositStatusSuccess {
			// Already processed
			c.JSON(http.StatusOK, gin.H{"message": "Already processed"})
			return
		}

		deposit.Status = models.DepositStatusSuccess
		deposit.PaymentMethod = callback.PaymentMethod
		deposit.PaymentChannel = callback.PaymentChannel
		deposit.PaidAt = &callback.PaidAt

		callbackData, _ := json.Marshal(callback)
		deposit.XenditCallbackData = string(callbackData)

		if err := database.DB.Save(&deposit).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update deposit"})
			return
		}

		// Credit user's wallet
		err := h.walletService.Credit(
			deposit.UserID,
			deposit.Amount,
			models.WalletTxTypeDeposit,
			"deposit",
			deposit.ID,
			"Deposit via "+callback.PaymentMethod,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to credit wallet"})
			return
		}

	case "EXPIRED":
		deposit.Status = models.DepositStatusExpired
		database.DB.Save(&deposit)

	case "FAILED":
		deposit.Status = models.DepositStatusFailed
		database.DB.Save(&deposit)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Callback processed"})
}

// SimulateDeposit simulates a successful deposit (for demo/testing only)
func (h *WalletHandler) SimulateDeposit(c *gin.Context) {
	// Only allow in development
	if os.Getenv("GO_ENV") == "production" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not available in production"})
		return
	}

	externalID := c.Param("external_id")

	var deposit models.Deposit
	if err := database.DB.Where("external_id = ?", externalID).First(&deposit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deposit not found"})
		return
	}

	if deposit.Status != models.DepositStatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Deposit is not pending"})
		return
	}

	// Update deposit status
	deposit.Status = models.DepositStatusSuccess
	deposit.PaymentMethod = "SIMULATED"
	deposit.PaymentChannel = "DEMO"

	if err := database.DB.Save(&deposit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update deposit"})
		return
	}

	// Credit user's wallet
	err := h.walletService.Credit(
		deposit.UserID,
		deposit.Amount,
		models.WalletTxTypeDeposit,
		"deposit",
		deposit.ID,
		"Deposit (simulated)",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to credit wallet"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Deposit simulated successfully",
		"deposit": deposit,
	})
}
