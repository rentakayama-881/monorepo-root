package services

import (
	"errors"
	"time"

	"backend-gin/database"
	"backend-gin/models"

	"gorm.io/gorm"
)

// DisputeService handles dispute operations
type DisputeService struct {
	transferService *TransferService
	walletService   *WalletService
}

// NewDisputeService creates a new dispute service
func NewDisputeService() *DisputeService {
	return &DisputeService{
		transferService: NewTransferService(),
		walletService:   NewWalletService(),
	}
}

// CreateDisputeInput represents input for creating a dispute
type CreateDisputeInput struct {
	TransferID  uint
	InitiatedBy uint // User ID
	Reason      string
}

// CreateDispute creates a new dispute for a transfer
func (s *DisputeService) CreateDispute(input CreateDisputeInput) (*models.Dispute, error) {
	// Get transfer
	transfer, err := s.transferService.GetTransferByID(input.TransferID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("transfer not found")
		}
		return nil, err
	}

	// Verify user is part of the transfer
	if transfer.SenderID != input.InitiatedBy && transfer.ReceiverID != input.InitiatedBy {
		return nil, errors.New("you are not part of this transfer")
	}

	// Can only dispute held transfers
	if transfer.Status != models.TransferStatusHeld {
		return nil, errors.New("can only dispute transfers that are being held")
	}

	// Check if dispute already exists
	var existingDispute models.Dispute
	err = database.DB.Where("transfer_id = ? AND status NOT IN (?)",
		input.TransferID,
		[]string{string(models.DisputeStatusResolvedToSender), string(models.DisputeStatusResolvedToReceiver)}).
		First(&existingDispute).Error
	if err == nil {
		return nil, errors.New("an active dispute already exists for this transfer")
	}

	// Calculate phase deadline (24 hours for mutual resolution)
	phaseDeadline := time.Now().Add(24 * time.Hour)

	dispute := models.Dispute{
		DisputeCode:   GenerateDisputeCode(),
		TransferID:    input.TransferID,
		InitiatedBy:   input.InitiatedBy,
		Reason:        input.Reason,
		Status:        models.DisputeStatusMutualResolution,
		Phase:         models.DisputePhaseMutualResolution,
		PhaseDeadline: &phaseDeadline,
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Create dispute
		if err := tx.Create(&dispute).Error; err != nil {
			return err
		}

		// Update transfer status to disputed
		transfer.Status = models.TransferStatusDisputed
		return tx.Save(transfer).Error
	})

	if err != nil {
		return nil, err
	}

	// Load relations
	database.DB.Preload("Transfer").Preload("Transfer.Sender").Preload("Transfer.Receiver").
		Preload("Initiator").First(&dispute, dispute.ID)

	return &dispute, nil
}

// GetDisputeByID gets a dispute by ID
func (s *DisputeService) GetDisputeByID(disputeID uint) (*models.Dispute, error) {
	var dispute models.Dispute
	err := database.DB.Preload("Transfer").Preload("Transfer.Sender").Preload("Transfer.Receiver").
		Preload("Initiator").First(&dispute, disputeID).Error
	if err != nil {
		return nil, err
	}
	return &dispute, nil
}

// GetDisputeByCode gets a dispute by code
func (s *DisputeService) GetDisputeByCode(code string) (*models.Dispute, error) {
	var dispute models.Dispute
	err := database.DB.Preload("Transfer").Preload("Transfer.Sender").Preload("Transfer.Receiver").
		Preload("Initiator").Where("dispute_code = ?", code).First(&dispute).Error
	if err != nil {
		return nil, err
	}
	return &dispute, nil
}

// GetUserDisputes gets all disputes for a user
func (s *DisputeService) GetUserDisputes(userID uint, limit, offset int) ([]models.Dispute, int64, error) {
	var disputes []models.Dispute
	var total int64

	// Get dispute IDs where user is sender or receiver of the transfer
	subQuery := database.DB.Model(&models.Transfer{}).
		Select("id").
		Where("sender_id = ? OR receiver_id = ?", userID, userID)

	query := database.DB.Model(&models.Dispute{}).Where("transfer_id IN (?)", subQuery)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Preload("Transfer").Preload("Transfer.Sender").Preload("Transfer.Receiver").
		Preload("Initiator").
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&disputes).Error

	if err != nil {
		return nil, 0, err
	}

	return disputes, total, nil
}

// AddEvidence adds evidence to a dispute
func (s *DisputeService) AddEvidence(disputeID uint, userID uint, evidenceType models.EvidenceType, content string, fileName string, fileSize int64) (*models.DisputeEvidence, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	// Verify user is part of the transfer
	if dispute.Transfer.SenderID != userID && dispute.Transfer.ReceiverID != userID {
		return nil, errors.New("you are not part of this dispute")
	}

	// Can only add evidence during certain phases
	if dispute.Phase != models.DisputePhaseMutualResolution && dispute.Phase != models.DisputePhaseEvidence {
		return nil, errors.New("cannot add evidence in current phase")
	}

	evidence := models.DisputeEvidence{
		DisputeID:    disputeID,
		UserID:       userID,
		EvidenceType: evidenceType,
		Content:      content,
		FileName:     fileName,
		FileSize:     fileSize,
	}

	if err := database.DB.Create(&evidence).Error; err != nil {
		return nil, err
	}

	database.DB.Preload("User").First(&evidence, evidence.ID)
	return &evidence, nil
}

// GetDisputeEvidence gets all evidence for a dispute
func (s *DisputeService) GetDisputeEvidence(disputeID uint) ([]models.DisputeEvidence, error) {
	var evidence []models.DisputeEvidence
	err := database.DB.Preload("User").
		Where("dispute_id = ?", disputeID).
		Order("created_at ASC").
		Find(&evidence).Error
	return evidence, err
}

// AddMessage adds a message to the dispute chat
func (s *DisputeService) AddMessage(disputeID uint, userID uint, message string, isAdmin bool) (*models.DisputeMessage, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	// Verify user is part of the transfer or is admin
	if !isAdmin && dispute.Transfer.SenderID != userID && dispute.Transfer.ReceiverID != userID {
		return nil, errors.New("you are not part of this dispute")
	}

	// Can only add messages if dispute is not resolved
	if dispute.Phase == models.DisputePhaseResolved {
		return nil, errors.New("dispute is already resolved")
	}

	msg := models.DisputeMessage{
		DisputeID: disputeID,
		UserID:    userID,
		Message:   message,
		IsAdmin:   isAdmin,
	}

	if err := database.DB.Create(&msg).Error; err != nil {
		return nil, err
	}

	database.DB.Preload("User").First(&msg, msg.ID)
	return &msg, nil
}

// GetDisputeMessages gets all messages for a dispute
func (s *DisputeService) GetDisputeMessages(disputeID uint) ([]models.DisputeMessage, error) {
	var messages []models.DisputeMessage
	err := database.DB.Preload("User").
		Where("dispute_id = ?", disputeID).
		Order("created_at ASC").
		Find(&messages).Error
	return messages, err
}

// EscalateToEvidence moves dispute to evidence phase
func (s *DisputeService) EscalateToEvidence(disputeID uint) (*models.Dispute, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	if dispute.Phase != models.DisputePhaseMutualResolution {
		return nil, errors.New("dispute is not in mutual resolution phase")
	}

	// 48 hours for evidence phase
	phaseDeadline := time.Now().Add(48 * time.Hour)
	dispute.Phase = models.DisputePhaseEvidence
	dispute.Status = models.DisputeStatusEvidencePhase
	dispute.PhaseDeadline = &phaseDeadline

	if err := database.DB.Save(dispute).Error; err != nil {
		return nil, err
	}

	return dispute, nil
}

// EscalateToAdmin moves dispute to admin review phase
func (s *DisputeService) EscalateToAdmin(disputeID uint) (*models.Dispute, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	if dispute.Phase != models.DisputePhaseEvidence && dispute.Phase != models.DisputePhaseMutualResolution {
		return nil, errors.New("cannot escalate to admin from current phase")
	}

	dispute.Phase = models.DisputePhaseAdminReview
	dispute.Status = models.DisputeStatusUnderReview
	dispute.PhaseDeadline = nil // Admin will resolve when ready

	if err := database.DB.Save(dispute).Error; err != nil {
		return nil, err
	}

	return dispute, nil
}

// ResolveDispute resolves a dispute (admin action)
func (s *DisputeService) ResolveDispute(disputeID uint, adminID uint, resolveToSender bool, decision string) (*models.Dispute, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	if dispute.Phase == models.DisputePhaseResolved {
		return nil, errors.New("dispute is already resolved")
	}

	transfer, err := s.transferService.GetTransferByID(dispute.TransferID)
	if err != nil {
		return nil, err
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		if resolveToSender {
			// Refund to sender
			if err := s.creditWithTx(tx, transfer.SenderID, transfer.Amount); err != nil {
				return err
			}

			dispute.Status = models.DisputeStatusResolvedToSender
			transfer.Status = models.TransferStatusRefunded

			// Create wallet transaction log
			walletTx := models.WalletTransaction{
				UserID:        transfer.SenderID,
				Type:          models.WalletTxTypeRefund,
				Amount:        transfer.Amount,
				ReferenceType: "dispute",
				ReferenceID:   dispute.ID,
				Description:   "Dispute resolved - refund",
			}
			if err := tx.Create(&walletTx).Error; err != nil {
				return err
			}
		} else {
			// Release to receiver
			if err := s.creditWithTx(tx, transfer.ReceiverID, transfer.Amount); err != nil {
				return err
			}

			dispute.Status = models.DisputeStatusResolvedToReceiver
			transfer.Status = models.TransferStatusReleased
			transfer.ReleasedAt = &now

			// Create wallet transaction log
			walletTx := models.WalletTransaction{
				UserID:        transfer.ReceiverID,
				Type:          models.WalletTxTypeTransferIn,
				Amount:        transfer.Amount,
				ReferenceType: "dispute",
				ReferenceID:   dispute.ID,
				Description:   "Dispute resolved - released",
			}
			if err := tx.Create(&walletTx).Error; err != nil {
				return err
			}
		}

		dispute.Phase = models.DisputePhaseResolved
		dispute.AdminID = &adminID
		dispute.AdminDecision = decision
		dispute.ResolvedAt = &now

		if err := tx.Save(dispute).Error; err != nil {
			return err
		}

		return tx.Save(transfer).Error
	})

	if err != nil {
		return nil, err
	}

	return s.GetDisputeByID(disputeID)
}

// creditWithTx credits wallet within a transaction
func (s *DisputeService) creditWithTx(tx *gorm.DB, userID uint, amount int64) error {
	var wallet models.UserWallet
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("user_id = ?", userID).
		First(&wallet).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
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

// MutualRelease allows the parties to mutually release during dispute
func (s *DisputeService) MutualRelease(disputeID uint, userID uint) (*models.Dispute, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	// Only sender can release
	if dispute.Transfer.SenderID != userID {
		return nil, errors.New("only sender can release funds")
	}

	if dispute.Phase == models.DisputePhaseResolved {
		return nil, errors.New("dispute is already resolved")
	}

	transfer, err := s.transferService.GetTransferByID(dispute.TransferID)
	if err != nil {
		return nil, err
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// Release to receiver
		if err := s.creditWithTx(tx, transfer.ReceiverID, transfer.Amount); err != nil {
			return err
		}

		dispute.Status = models.DisputeStatusResolvedToReceiver
		dispute.Phase = models.DisputePhaseResolved
		dispute.AdminDecision = "Sender released funds mutually"
		dispute.ResolvedAt = &now

		transfer.Status = models.TransferStatusReleased
		transfer.ReleasedAt = &now

		// Create wallet transaction log
		walletTx := models.WalletTransaction{
			UserID:        transfer.ReceiverID,
			Type:          models.WalletTxTypeTransferIn,
			Amount:        transfer.Amount,
			ReferenceType: "dispute",
			ReferenceID:   dispute.ID,
			Description:   "Dispute resolved - sender released",
		}
		if err := tx.Create(&walletTx).Error; err != nil {
			return err
		}

		if err := tx.Save(dispute).Error; err != nil {
			return err
		}

		return tx.Save(transfer).Error
	})

	if err != nil {
		return nil, err
	}

	return s.GetDisputeByID(disputeID)
}

// MutualRefund allows the receiver to agree to refund during dispute
func (s *DisputeService) MutualRefund(disputeID uint, userID uint) (*models.Dispute, error) {
	dispute, err := s.GetDisputeByID(disputeID)
	if err != nil {
		return nil, err
	}

	// Only receiver can agree to refund
	if dispute.Transfer.ReceiverID != userID {
		return nil, errors.New("only receiver can agree to refund")
	}

	if dispute.Phase == models.DisputePhaseResolved {
		return nil, errors.New("dispute is already resolved")
	}

	transfer, err := s.transferService.GetTransferByID(dispute.TransferID)
	if err != nil {
		return nil, err
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// Refund to sender
		if err := s.creditWithTx(tx, transfer.SenderID, transfer.Amount); err != nil {
			return err
		}

		dispute.Status = models.DisputeStatusResolvedToSender
		dispute.Phase = models.DisputePhaseResolved
		dispute.AdminDecision = "Receiver agreed to refund"
		dispute.ResolvedAt = &now

		transfer.Status = models.TransferStatusRefunded

		// Create wallet transaction log
		walletTx := models.WalletTransaction{
			UserID:        transfer.SenderID,
			Type:          models.WalletTxTypeRefund,
			Amount:        transfer.Amount,
			ReferenceType: "dispute",
			ReferenceID:   dispute.ID,
			Description:   "Dispute resolved - receiver refunded",
		}
		if err := tx.Create(&walletTx).Error; err != nil {
			return err
		}

		if err := tx.Save(dispute).Error; err != nil {
			return err
		}

		return tx.Save(transfer).Error
	})

	if err != nil {
		return nil, err
	}

	return s.GetDisputeByID(disputeID)
}

// ProcessExpiredPhases checks and escalates disputes with expired phase deadlines
func (s *DisputeService) ProcessExpiredPhases() (int, error) {
	var disputes []models.Dispute
	now := time.Now()

	err := database.DB.Where("phase IN (?, ?) AND phase_deadline < ?",
		models.DisputePhaseMutualResolution,
		models.DisputePhaseEvidence,
		now).Find(&disputes).Error

	if err != nil {
		return 0, err
	}

	count := 0
	for _, dispute := range disputes {
		var escalateErr error
		switch dispute.Phase {
		case models.DisputePhaseMutualResolution:
			_, escalateErr = s.EscalateToEvidence(dispute.ID)
		case models.DisputePhaseEvidence:
			_, escalateErr = s.EscalateToAdmin(dispute.ID)
		}
		if escalateErr == nil {
			count++
		}
	}

	return count, nil
}
