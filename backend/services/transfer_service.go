package services

import (
	"errors"
	"time"

	"backend-gin/database"
	"backend-gin/models"

	"gorm.io/gorm"
)

// TransferService handles transfer/escrow operations
type TransferService struct {
	walletService *WalletService
}

// NewTransferService creates a new transfer service
func NewTransferService() *TransferService {
	return &TransferService{
		walletService: NewWalletService(),
	}
}

// CreateTransferInput represents input for creating a transfer
type CreateTransferInput struct {
	SenderID    uint
	ReceiverID  uint
	Amount      int64
	HoldDays    int // 7 or 30
	Description string
	PIN         string
}

// CreateTransfer creates a new escrow transfer
func (s *TransferService) CreateTransfer(input CreateTransferInput) (*models.Transfer, error) {
	// Validate input
	if input.SenderID == input.ReceiverID {
		return nil, errors.New("cannot transfer to yourself")
	}

	if input.Amount <= 0 {
		return nil, errors.New("amount must be greater than 0")
	}

	if input.HoldDays != 7 && input.HoldDays != 30 {
		return nil, errors.New("hold days must be 7 or 30")
	}

	// Verify PIN
	valid, err := s.walletService.VerifyPIN(input.SenderID, input.PIN)
	if err != nil {
		return nil, err
	}
	if !valid {
		return nil, errors.New("invalid PIN")
	}

	// Check sender has sufficient balance
	balance, err := s.walletService.GetBalance(input.SenderID)
	if err != nil {
		return nil, err
	}
	if balance < input.Amount {
		return nil, errors.New("insufficient balance")
	}

	// Verify receiver exists
	var receiver models.User
	if err := database.DB.First(&receiver, input.ReceiverID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("receiver not found")
		}
		return nil, err
	}

	var transfer models.Transfer

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Debit sender's wallet
		if err := s.debitWithTx(tx, input.SenderID, input.Amount); err != nil {
			return err
		}

		// Create transfer record
		transfer = models.Transfer{
			TransferCode: GenerateTransferCode(),
			SenderID:     input.SenderID,
			ReceiverID:   input.ReceiverID,
			Amount:       input.Amount,
			HoldDays:     input.HoldDays,
			HoldUntil:    time.Now().AddDate(0, 0, input.HoldDays),
			Description:  input.Description,
			Status:       models.TransferStatusHeld,
		}

		if err := tx.Create(&transfer).Error; err != nil {
			return err
		}

		// Create wallet transaction log for sender
		walletTx := models.WalletTransaction{
			UserID:        input.SenderID,
			Type:          models.WalletTxTypeTransferOut,
			Amount:        -input.Amount,
			ReferenceType: "transfer",
			ReferenceID:   transfer.ID,
			Description:   "Transfer to user",
		}

		return tx.Create(&walletTx).Error
	})

	if err != nil {
		return nil, err
	}

	// Load relations
	database.DB.Preload("Sender").Preload("Receiver").First(&transfer, transfer.ID)

	return &transfer, nil
}

// debitWithTx debits wallet within a transaction
func (s *TransferService) debitWithTx(tx *gorm.DB, userID uint, amount int64) error {
	var wallet models.UserWallet
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ?", userID).
		First(&wallet).Error

	if err != nil {
		return err
	}

	if wallet.Balance < amount {
		return errors.New("insufficient balance")
	}

	wallet.Balance -= amount
	return tx.Save(&wallet).Error
}

// creditWithTx credits wallet within a transaction
func (s *TransferService) creditWithTx(tx *gorm.DB, userID uint, amount int64) error {
	var wallet models.UserWallet
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ?", userID).
		First(&wallet).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create wallet if not exists
		wallet = models.UserWallet{
			UserID:  userID,
			Balance: amount,
			PINSet:  false,
		}
		return tx.Create(&wallet).Error
	}

	if err != nil {
		return err
	}

	wallet.Balance += amount
	return tx.Save(&wallet).Error
}

// ReleaseTransfer releases held funds to receiver (by sender or auto-release)
func (s *TransferService) ReleaseTransfer(transferID uint, releasedByUserID uint) (*models.Transfer, error) {
	var transfer models.Transfer
	err := database.DB.First(&transfer, transferID).Error
	if err != nil {
		return nil, err
	}

	// Only sender can manually release, or system for auto-release
	if releasedByUserID != 0 && transfer.SenderID != releasedByUserID {
		return nil, errors.New("only sender can release the transfer")
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Re-fetch with lock to prevent race conditions
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&transfer, transferID).Error; err != nil {
			return err
		}

		// Check status inside transaction (idempotency)
		if transfer.Status != models.TransferStatusHeld {
			return errors.New("transfer is not in held status")
		}

		// Credit receiver's wallet
		if err := s.creditWithTx(tx, transfer.ReceiverID, transfer.Amount); err != nil {
			return err
		}

		// Update transfer status
		now := time.Now()
		transfer.Status = models.TransferStatusReleased
		transfer.ReleasedAt = &now

		if err := tx.Save(&transfer).Error; err != nil {
			return err
		}

		// Create wallet transaction log for receiver
		walletTx := models.WalletTransaction{
			UserID:        transfer.ReceiverID,
			Type:          models.WalletTxTypeTransferIn,
			Amount:        transfer.Amount,
			ReferenceType: "transfer",
			ReferenceID:   transfer.ID,
			Description:   "Received transfer",
		}

		return tx.Create(&walletTx).Error
	})

	if err != nil {
		return nil, err
	}

	database.DB.Preload("Sender").Preload("Receiver").First(&transfer, transfer.ID)
	return &transfer, nil
}

// CancelTransfer cancels a held transfer (by receiver) - refunds to sender
func (s *TransferService) CancelTransfer(transferID uint, cancelledByUserID uint) (*models.Transfer, error) {
	var transfer models.Transfer
	err := database.DB.First(&transfer, transferID).Error
	if err != nil {
		return nil, err
	}

	// Only receiver can cancel
	if transfer.ReceiverID != cancelledByUserID {
		return nil, errors.New("only receiver can cancel the transfer")
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Re-fetch with lock to prevent race conditions
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&transfer, transferID).Error; err != nil {
			return err
		}

		// Check status inside transaction (idempotency)
		if transfer.Status != models.TransferStatusHeld {
			return errors.New("transfer is not in held status")
		}

		// Refund to sender's wallet
		if err := s.creditWithTx(tx, transfer.SenderID, transfer.Amount); err != nil {
			return err
		}

		// Update transfer status
		transfer.Status = models.TransferStatusCancelled

		if err := tx.Save(&transfer).Error; err != nil {
			return err
		}

		// Create wallet transaction log for sender (refund)
		walletTx := models.WalletTransaction{
			UserID:        transfer.SenderID,
			Type:          models.WalletTxTypeRefund,
			Amount:        transfer.Amount,
			ReferenceType: "transfer",
			ReferenceID:   transfer.ID,
			Description:   "Transfer cancelled by receiver",
		}

		return tx.Create(&walletTx).Error
	})

	if err != nil {
		return nil, err
	}

	database.DB.Preload("Sender").Preload("Receiver").First(&transfer, transfer.ID)
	return &transfer, nil
}

// GetTransferByID gets a transfer by ID
func (s *TransferService) GetTransferByID(transferID uint) (*models.Transfer, error) {
	var transfer models.Transfer
	err := database.DB.Preload("Sender").Preload("Receiver").First(&transfer, transferID).Error
	if err != nil {
		return nil, err
	}
	return &transfer, nil
}

// GetTransferByCode gets a transfer by code
func (s *TransferService) GetTransferByCode(code string) (*models.Transfer, error) {
	var transfer models.Transfer
	err := database.DB.Preload("Sender").Preload("Receiver").
		Where("transfer_code = ?", code).First(&transfer).Error
	if err != nil {
		return nil, err
	}
	return &transfer, nil
}

// GetUserTransfers gets all transfers for a user (as sender or receiver)
func (s *TransferService) GetUserTransfers(userID uint, role string, status string, limit, offset int) ([]models.Transfer, int64, error) {
	var transfers []models.Transfer
	var total int64

	query := database.DB.Model(&models.Transfer{})

	switch role {
	case "sender":
		query = query.Where("sender_id = ?", userID)
	case "receiver":
		query = query.Where("receiver_id = ?", userID)
	default:
		query = query.Where("sender_id = ? OR receiver_id = ?", userID, userID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Preload("Sender").Preload("Receiver").
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&transfers).Error

	if err != nil {
		return nil, 0, err
	}

	return transfers, total, nil
}

// AutoReleaseExpiredTransfers releases all transfers that have passed their hold period
func (s *TransferService) AutoReleaseExpiredTransfers() (int, error) {
	var transfers []models.Transfer
	err := database.DB.Where("status = ? AND hold_until < ?", models.TransferStatusHeld, time.Now()).
		Find(&transfers).Error

	if err != nil {
		return 0, err
	}

	count := 0
	for _, transfer := range transfers {
		_, err := s.ReleaseTransfer(transfer.ID, 0) // 0 = system release
		if err == nil {
			count++
		}
	}

	return count, nil
}
