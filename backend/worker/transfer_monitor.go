package worker

import (
	"log"
	"time"

	"backend-gin/database"
	"backend-gin/models"
	"gorm.io/gorm"
)

func RunTransferMonitor() {
	go func() {
		for {
			processPendingTransfers()
			time.Sleep(30 * time.Second) // check every 30 seconds
		}
	}()
}

func processPendingTransfers() {
	var transfers []models.Transfer
	if err := database.DB.Where("status = ? AND hold_until <= ?", "pending", time.Now()).Find(&transfers).Error; err != nil {
		log.Println("Error fetching pending transfers:", err)
		return
	}

	for _, transfer := range transfers {
		err := database.DB.Transaction(func(tx *gorm.DB) error {
			// Get fresh sender and recipient data
			var sender, recipient models.User
			if err := tx.First(&sender, transfer.SenderID).Error; err != nil {
				return err
			}
			if err := tx.First(&recipient, transfer.RecipientID).Error; err != nil {
				return err
			}

			// Check if sender still has balance (in case of multiple transfers)
			if sender.Balance < transfer.Amount {
				// Cancel the transfer
				return tx.Model(&transfer).Update("status", "cancelled").Error
			}

			// Add to recipient
			if err := tx.Model(&recipient).Update("balance", recipient.Balance+transfer.Amount).Error; err != nil {
				return err
			}

			// Mark as completed
			return tx.Model(&transfer).Update("status", "completed").Error
		})

		if err != nil {
			log.Printf("Error processing transfer %d: %v", transfer.ID, err)
		} else {
			log.Printf("Processed transfer %d: %.2f IDR from user %d to %d", transfer.ID, transfer.Amount, transfer.SenderID, transfer.RecipientID)
		}
	}
}
