package models

import (
	"time"

	"gorm.io/gorm"
)

type Transfer struct {
	gorm.Model
	SenderID    uint      `json:"sender_id"`
	RecipientID uint      `json:"recipient_id"`
	Amount      float64   `json:"amount"`
	HoldUntil   time.Time `json:"hold_until"`
	Status      string    `json:"status"` // pending, completed, cancelled
}
