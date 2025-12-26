package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"backend-gin/database"
	"backend-gin/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// WalletService handles wallet operations
type WalletService struct{}

// NewWalletService creates a new wallet service
func NewWalletService() *WalletService {
	return &WalletService{}
}

// GetOrCreateWallet gets the user's wallet or creates one if it doesn't exist
func (s *WalletService) GetOrCreateWallet(userID uint) (*models.UserWallet, error) {
	var wallet models.UserWallet
	err := database.DB.Where("user_id = ?", userID).First(&wallet).Error
	if err == nil {
		return &wallet, nil
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		wallet = models.UserWallet{
			UserID:  userID,
			Balance: 0,
			PINSet:  false,
		}
		if err := database.DB.Create(&wallet).Error; err != nil {
			return nil, err
		}
		return &wallet, nil
	}

	return nil, err
}

// GetBalance returns the user's wallet balance
func (s *WalletService) GetBalance(userID uint) (int64, error) {
	wallet, err := s.GetOrCreateWallet(userID)
	if err != nil {
		return 0, err
	}
	return wallet.Balance, nil
}

// SetPIN sets or updates the user's transaction PIN
func (s *WalletService) SetPIN(userID uint, pin string) error {
	if len(pin) != 6 {
		return errors.New("PIN must be exactly 6 digits")
	}

	// Validate PIN is numeric
	for _, c := range pin {
		if c < '0' || c > '9' {
			return errors.New("PIN must contain only digits")
		}
	}

	wallet, err := s.GetOrCreateWallet(userID)
	if err != nil {
		return err
	}

	hashedPIN, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	wallet.PINHash = string(hashedPIN)
	wallet.PINSet = true

	return database.DB.Save(wallet).Error
}

// VerifyPIN verifies the user's transaction PIN
func (s *WalletService) VerifyPIN(userID uint, pin string) (bool, error) {
	wallet, err := s.GetOrCreateWallet(userID)
	if err != nil {
		return false, err
	}

	if !wallet.PINSet {
		return false, errors.New("PIN not set")
	}

	err = bcrypt.CompareHashAndPassword([]byte(wallet.PINHash), []byte(pin))
	if err != nil {
		return false, nil
	}

	return true, nil
}

// IsPINSet checks if the user has set their PIN
func (s *WalletService) IsPINSet(userID uint) (bool, error) {
	wallet, err := s.GetOrCreateWallet(userID)
	if err != nil {
		return false, err
	}
	return wallet.PINSet, nil
}

// Credit adds funds to user's wallet (used for deposits and refunds)
func (s *WalletService) Credit(userID uint, amount int64, txType models.WalletTransactionType, refType string, refID uint, description string) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	return database.DB.Transaction(func(tx *gorm.DB) error {
		wallet, err := s.getWalletForUpdate(tx, userID)
		if err != nil {
			return err
		}

		balanceBefore := wallet.Balance
		wallet.Balance += amount

		if err := tx.Save(wallet).Error; err != nil {
			return err
		}

		// Create audit log
		walletTx := models.WalletTransaction{
			UserID:        userID,
			Type:          txType,
			Amount:        amount,
			BalanceBefore: balanceBefore,
			BalanceAfter:  wallet.Balance,
			ReferenceType: refType,
			ReferenceID:   refID,
			Description:   description,
		}

		return tx.Create(&walletTx).Error
	})
}

// Debit removes funds from user's wallet (used for transfers and withdrawals)
func (s *WalletService) Debit(userID uint, amount int64, txType models.WalletTransactionType, refType string, refID uint, description string) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	return database.DB.Transaction(func(tx *gorm.DB) error {
		wallet, err := s.getWalletForUpdate(tx, userID)
		if err != nil {
			return err
		}

		if wallet.Balance < amount {
			return errors.New("insufficient balance")
		}

		balanceBefore := wallet.Balance
		wallet.Balance -= amount

		if err := tx.Save(wallet).Error; err != nil {
			return err
		}

		// Create audit log
		walletTx := models.WalletTransaction{
			UserID:        userID,
			Type:          txType,
			Amount:        -amount, // Negative for debit
			BalanceBefore: balanceBefore,
			BalanceAfter:  wallet.Balance,
			ReferenceType: refType,
			ReferenceID:   refID,
			Description:   description,
		}

		return tx.Create(&walletTx).Error
	})
}

// getWalletForUpdate gets wallet with row lock for atomic operations
func (s *WalletService) getWalletForUpdate(tx *gorm.DB, userID uint) (*models.UserWallet, error) {
	var wallet models.UserWallet
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ?", userID).
		First(&wallet).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create wallet if not exists
		wallet = models.UserWallet{
			UserID:  userID,
			Balance: 0,
			PINSet:  false,
		}
		if err := tx.Create(&wallet).Error; err != nil {
			return nil, err
		}
		return &wallet, nil
	}

	if err != nil {
		return nil, err
	}

	return &wallet, nil
}

// GetTransactionHistory returns wallet transaction history
func (s *WalletService) GetTransactionHistory(userID uint, limit, offset int) ([]models.WalletTransaction, int64, error) {
	var transactions []models.WalletTransaction
	var total int64

	db := database.DB.Model(&models.WalletTransaction{}).Where("user_id = ?", userID)

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&transactions).Error; err != nil {
		return nil, 0, err
	}

	return transactions, total, nil
}

// GenerateTransferCode generates a unique transfer code
func GenerateTransferCode() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return fmt.Sprintf("TRF-%s", hex.EncodeToString(bytes))
}

// GenerateDisputeCode generates a unique dispute code
func GenerateDisputeCode() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return fmt.Sprintf("DSP-%s", hex.EncodeToString(bytes))
}

// GenerateWithdrawalCode generates a unique withdrawal code
func GenerateWithdrawalCode() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return fmt.Sprintf("WDR-%s", hex.EncodeToString(bytes))
}

// GenerateDepositExternalID generates a unique external ID for deposits
func GenerateDepositExternalID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return fmt.Sprintf("DEP-%d-%s", time.Now().Unix(), hex.EncodeToString(bytes))
}
