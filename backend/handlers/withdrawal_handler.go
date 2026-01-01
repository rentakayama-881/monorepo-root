package handlers

import (
	"encoding/json"
	"fmt"
	"log"
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

// withdrawalPinLimiter limits PIN verification attempts for withdrawals
// 5 attempts per 15 minutes per user
var withdrawalPinLimiter = middleware.NewRateLimiter(5, 15*time.Minute)

// WithdrawalHandler handles withdrawal-related endpoints
type WithdrawalHandler struct {
	walletService *services.WalletService
	xenditClient  *utils.XenditClient
}

// NewWithdrawalHandler creates a new withdrawal handler
func NewWithdrawalHandler() *WithdrawalHandler {
	return &WithdrawalHandler{
		walletService: services.NewWalletService(),
		xenditClient:  utils.NewXenditClient(),
	}
}

// CreateWithdrawalRequest represents a request to create a withdrawal
type CreateWithdrawalRequest struct {
	Amount        int64  `json:"amount" binding:"required,min=50000"` // Minimum 50,000 IDR
	BankCode      string `json:"bank_code" binding:"required"`
	AccountNumber string `json:"account_number" binding:"required"`
	AccountName   string `json:"account_name" binding:"required"`
	PIN           string `json:"pin" binding:"required,len=6"`
}

// CreateWithdrawal creates a new withdrawal request
func (h *WithdrawalHandler) CreateWithdrawal(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req CreateWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: minimum withdrawal is Rp 50,000"})
		return
	}

	// Rate limit PIN verification to prevent brute-force
	if !withdrawalPinLimiter.Allow(fmt.Sprintf("withdrawal-pin:%d", userID)) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many PIN attempts. Please try again later."})
		return
	}

	// Verify PIN
	valid, err := h.walletService.VerifyPIN(userID, req.PIN)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid PIN"})
		return
	}

	// Check balance
	balance, err := h.walletService.GetBalance(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get balance"})
		return
	}

	// Calculate fee (e.g., fixed fee or percentage)
	withdrawalFee := int64(5000) // Fixed Rp 5,000 fee
	totalDeduction := req.Amount + withdrawalFee

	if balance < totalDeduction {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    "Insufficient balance",
			"balance":  balance,
			"required": totalDeduction,
		})
		return
	}

	// Generate withdrawal code
	withdrawalCode := services.GenerateWithdrawalCode()

	// Create withdrawal record
	withdrawal := models.Withdrawal{
		UserID:         userID,
		WithdrawalCode: withdrawalCode,
		Amount:         req.Amount,
		Fee:            withdrawalFee,
		NetAmount:      req.Amount, // Amount sent to user
		BankCode:       req.BankCode,
		AccountNumber:  req.AccountNumber,
		AccountName:    req.AccountName,
		Status:         models.WithdrawalStatusPending,
	}

	// Start transaction
	tx := database.DB.Begin()

	// Create withdrawal record
	if err := tx.Create(&withdrawal).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create withdrawal"})
		return
	}

	// Debit user's wallet (amount + fee)
	if err := h.debitWallet(tx, userID, totalDeduction, withdrawal.ID); err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Process via Xendit if configured
	if h.xenditClient.IsConfigured() {
		disbursement, err := h.xenditClient.CreateDisbursement(utils.DisbursementRequest{
			ExternalID:        withdrawalCode,
			Amount:            req.Amount,
			BankCode:          req.BankCode,
			AccountHolderName: req.AccountName,
			AccountNumber:     req.AccountNumber,
			Description:       "Withdrawal from wallet",
		})
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process withdrawal: " + err.Error()})
			return
		}

		withdrawal.XenditDisbursementID = disbursement.ID
		withdrawal.Status = models.WithdrawalStatusProcessing
		tx.Save(&withdrawal)
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message":    "Withdrawal request created",
		"withdrawal": withdrawal,
	})
}

// debitWallet debits wallet within a transaction
func (h *WithdrawalHandler) debitWallet(tx interface{}, userID uint, amount int64, withdrawalID uint) error {
	gormTx := tx.(interface {
		Save(value interface{}) interface{ Error() error }
		First(dest interface{}, conds ...interface{}) interface{ Error() error }
		Create(value interface{}) interface{ Error() error }
		Set(name string, value interface{}) interface {
			Where(query interface{}, args ...interface{}) interface {
				First(dest interface{}, conds ...interface{}) interface{ Error() error }
			}
		}
	})

	var wallet models.UserWallet
	if err := gormTx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ?", userID).
		First(&wallet).Error(); err != nil {
		return err
	}

	if wallet.Balance < amount {
		return &InsufficientBalanceError{}
	}

	balanceBefore := wallet.Balance
	wallet.Balance -= amount

	if err := gormTx.Save(&wallet).Error(); err != nil {
		return err
	}

	// Create wallet transaction log
	walletTx := models.WalletTransaction{
		UserID:        userID,
		Type:          models.WalletTxTypeWithdrawal,
		Amount:        -amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  wallet.Balance,
		ReferenceType: "withdrawal",
		ReferenceID:   withdrawalID,
		Description:   "Withdrawal to bank account",
	}

	return gormTx.Create(&walletTx).Error()
}

type InsufficientBalanceError struct{}

func (e *InsufficientBalanceError) Error() string {
	return "insufficient balance"
}

// GetMyWithdrawals returns the user's withdrawal history
func (h *WithdrawalHandler) GetMyWithdrawals(c *gin.Context) {
	userID := c.GetUint("user_id")

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var withdrawals []models.Withdrawal
	var total int64

	db := database.DB.Model(&models.Withdrawal{}).Where("user_id = ?", userID)
	db.Count(&total)
	db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&withdrawals)

	c.JSON(http.StatusOK, gin.H{
		"withdrawals": withdrawals,
		"total":       total,
		"limit":       limit,
		"offset":      offset,
	})
}

// GetAvailableBanks returns list of available banks for withdrawal
func (h *WithdrawalHandler) GetAvailableBanks(c *gin.Context) {
	if h.xenditClient.IsConfigured() {
		banks, err := h.xenditClient.GetAvailableBanks()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get banks"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"banks": banks})
		return
	}

	// Return default Indonesian banks if Xendit not configured
	banks := []gin.H{
		{"code": "BCA", "name": "Bank Central Asia"},
		{"code": "BNI", "name": "Bank Negara Indonesia"},
		{"code": "BRI", "name": "Bank Rakyat Indonesia"},
		{"code": "MANDIRI", "name": "Bank Mandiri"},
		{"code": "CIMB", "name": "CIMB Niaga"},
		{"code": "PERMATA", "name": "Bank Permata"},
		{"code": "BSI", "name": "Bank Syariah Indonesia"},
		{"code": "DANAMON", "name": "Bank Danamon"},
		{"code": "BTN", "name": "Bank Tabungan Negara"},
		{"code": "OCBC", "name": "OCBC NISP"},
		{"code": "MAYBANK", "name": "Maybank Indonesia"},
		{"code": "PANIN", "name": "Panin Bank"},
		{"code": "JAGO", "name": "Bank Jago"},
		{"code": "SEABANK", "name": "SeaBank"},
	}

	c.JSON(http.StatusOK, gin.H{"banks": banks})
}

// XenditDisbursementCallback handles Xendit disbursement callbacks
func (h *WithdrawalHandler) XenditDisbursementCallback(c *gin.Context) {
	// Verify callback token
	callbackToken := c.GetHeader("x-callback-token")
	expectedToken := os.Getenv("XENDIT_CALLBACK_TOKEN")
	if expectedToken != "" && callbackToken != expectedToken {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid callback token"})
		return
	}

	var callback utils.DisbursementCallback
	if err := c.ShouldBindJSON(&callback); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid callback payload"})
		return
	}

	// Find withdrawal by external ID (withdrawal code)
	var withdrawal models.Withdrawal
	if err := database.DB.Where("withdrawal_code = ?", callback.ExternalID).First(&withdrawal).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Withdrawal not found"})
		return
	}

	// Update withdrawal based on status
	switch callback.Status {
	case "COMPLETED":
		withdrawal.Status = models.WithdrawalStatusSuccess
		now := callback.Updated
		withdrawal.ProcessedAt = &now

	case "FAILED":
		withdrawal.Status = models.WithdrawalStatusFailed
		withdrawal.FailureReason = callback.FailureCode

		// Refund to user's wallet
		totalRefund := withdrawal.Amount + withdrawal.Fee
		if err := h.walletService.Credit(
			withdrawal.UserID,
			totalRefund,
			models.WalletTxTypeRefund,
			"withdrawal",
			withdrawal.ID,
			"Withdrawal failed - refund",
		); err != nil {
			// Log error but continue processing callback
			log.Printf("Failed to refund withdrawal %d: %v", withdrawal.ID, err)
		}
	}

	callbackData, _ := json.Marshal(callback)
	_ = callbackData // Could store this for audit

	database.DB.Save(&withdrawal)

	c.JSON(http.StatusOK, gin.H{"message": "Callback processed"})
}

// SimulateWithdrawal simulates a successful withdrawal (for demo/testing only)
func (h *WithdrawalHandler) SimulateWithdrawal(c *gin.Context) {
	// Only allow in development
	if os.Getenv("GO_ENV") == "production" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not available in production"})
		return
	}

	withdrawalCode := c.Param("code")

	var withdrawal models.Withdrawal
	if err := database.DB.Where("withdrawal_code = ?", withdrawalCode).First(&withdrawal).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Withdrawal not found"})
		return
	}

	if withdrawal.Status != models.WithdrawalStatusPending && withdrawal.Status != models.WithdrawalStatusProcessing {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Withdrawal cannot be simulated"})
		return
	}

	// Update to success
	withdrawal.Status = models.WithdrawalStatusSuccess

	if err := database.DB.Save(&withdrawal).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update withdrawal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Withdrawal simulated successfully",
		"withdrawal": withdrawal,
	})
}
