package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/middleware"
	"backend-gin/models"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// withdrawalPinLimiter limits PIN verification attempts for withdrawals
// 5 attempts per 15 minutes per user
var withdrawalPinLimiter = middleware.NewRateLimiter(5, 15*time.Minute)

// WithdrawalHandler handles withdrawal-related endpoints
type WithdrawalHandler struct {
	walletService *services.WalletService
	// TODO: Add faspayClient when API integration is ready
}

// NewWithdrawalHandler creates a new withdrawal handler
func NewWithdrawalHandler() *WithdrawalHandler {
	return &WithdrawalHandler{
		walletService: services.NewWalletService(),
	}
}

// CreateWithdrawalRequest represents a request to create a withdrawal
type CreateWithdrawalRequest struct {
	Amount        int64  `json:"amount" binding:"required,min=10000"` // Minimum 10,000 IDR (tiered)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get user's total transaction volume for tiered minimum
	totalTxVolume := h.getUserTotalTransactionVolume(userID)
	minWithdrawal := config.GetMinWithdrawalForUser(totalTxVolume)

	if req.Amount < minWithdrawal {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          fmt.Sprintf("Minimum penarikan untuk akun Anda adalah Rp %d", minWithdrawal),
			"min_withdrawal": minWithdrawal,
			"tx_volume":      totalTxVolume,
		})
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

	// Get fee from config
	withdrawalFee := config.WithdrawalFee
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

	// TODO: Process via Faspay when API integration is ready
	// For now, withdrawal stays in "pending" status until manual processing
	// if h.faspayClient.IsConfigured() {
	//     disbursement, err := h.faspayClient.CreateDisbursement(...)
	//     ...
	// }

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message":        "Permintaan penarikan berhasil dibuat",
		"withdrawal":     withdrawal,
		"min_withdrawal": config.GetMinWithdrawalForUser(totalTxVolume),
		"fee":            withdrawalFee,
		"note":           "Pencairan dana akan diproses dalam 1-3 hari kerja",
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

// getUserTotalTransactionVolume calculates total transaction volume for a user
// This is used to determine the minimum withdrawal tier
func (h *WithdrawalHandler) getUserTotalTransactionVolume(userID uint) int64 {
	var totalVolume int64

	// Sum all completed escrow transactions where user was sender or receiver
	database.DB.Model(&models.Transfer{}).
		Where("(sender_id = ? OR receiver_id = ?) AND status = ?", userID, userID, models.TransferStatusReleased).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalVolume)

	return totalVolume
}

// GetWithdrawalInfo returns withdrawal requirements and limits for the user
func (h *WithdrawalHandler) GetWithdrawalInfo(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Get user's total transaction volume
	totalTxVolume := h.getUserTotalTransactionVolume(userID)
	minWithdrawal := config.GetMinWithdrawalForUser(totalTxVolume)

	// Get user's wallet balance
	balance, _ := h.walletService.GetBalance(userID)

	// Determine tier
	tier := "Pengguna Baru"
	if totalTxVolume >= config.Tier2TransactionThreshold {
		tier = "Pengguna Premium"
	} else if totalTxVolume >= config.Tier1TransactionThreshold {
		tier = "Pengguna Aktif"
	}

	c.JSON(http.StatusOK, gin.H{
		"min_withdrawal":  minWithdrawal,
		"withdrawal_fee":  config.WithdrawalFee,
		"balance":         balance,
		"total_tx_volume": totalTxVolume,
		"tier":            tier,
		"can_withdraw":    balance >= (minWithdrawal + config.WithdrawalFee),
		"settlement_info": "Pencairan dana diproses dalam H+1 hingga H+3 hari kerja tergantung metode pembayaran asal.",
		"tiers": []gin.H{
			{"name": "Pengguna Baru", "threshold": 0, "min_withdrawal": config.MinWithdrawalDefault},
			{"name": "Pengguna Aktif", "threshold": config.Tier1TransactionThreshold, "min_withdrawal": config.MinWithdrawalTier1},
			{"name": "Pengguna Premium", "threshold": config.Tier2TransactionThreshold, "min_withdrawal": config.MinWithdrawalTier2},
		},
	})
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
	// List of Indonesian banks supported for withdrawal
	// TODO: Fetch from Faspay API when integration is ready
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

// FaspayDisbursementCallback handles Faspay disbursement callbacks
// TODO: Implement when Faspay API integration is ready
func (h *WithdrawalHandler) FaspayDisbursementCallback(c *gin.Context) {
	// Verify callback signature
	// callbackSignature := c.GetHeader("X-Faspay-Signature")
	// ... verify signature ...

	var callback struct {
		TrxID      string `json:"trx_id"`
		MerchantID string `json:"merchant_id"`
		Status     string `json:"status"`
		Amount     string `json:"amount"`
		DateTime   string `json:"date_time"`
	}

	if err := c.ShouldBindJSON(&callback); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid callback payload"})
		return
	}

	// Find withdrawal by external ID (withdrawal code)
	var withdrawal models.Withdrawal
	if err := database.DB.Where("withdrawal_code = ?", callback.TrxID).First(&withdrawal).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Withdrawal not found"})
		return
	}

	// Update withdrawal based on status
	// Faspay status codes: 0 = pending, 1 = success, 2 = failed
	switch callback.Status {
	case "1": // Success
		withdrawal.Status = models.WithdrawalStatusSuccess
		now := time.Now()
		withdrawal.ProcessedAt = &now

	case "2": // Failed
		withdrawal.Status = models.WithdrawalStatusFailed
		withdrawal.FailureReason = "Disbursement failed by payment gateway"

		// Refund to user's wallet
		if err := h.refundWithdrawal(&withdrawal); err != nil {
			log.Printf("Failed to refund withdrawal %s: %v", withdrawal.WithdrawalCode, err)
		}
	}

	if err := database.DB.Save(&withdrawal).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update withdrawal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// refundWithdrawal refunds a failed withdrawal to user's wallet
func (h *WithdrawalHandler) refundWithdrawal(withdrawal *models.Withdrawal) error {
	totalRefund := withdrawal.Amount + withdrawal.Fee
	return h.walletService.Credit(
		withdrawal.UserID,
		totalRefund,
		models.WalletTxTypeRefund,
		"withdrawal",
		withdrawal.ID,
		"Withdrawal failed - refund",
	)
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
