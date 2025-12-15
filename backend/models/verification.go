package models

import (
	"time"

	"gorm.io/gorm"
)

// EmailVerificationToken stores hashed token for email verification flows.
type EmailVerificationToken struct {
	gorm.Model
	UserID    uint
	TokenHash string `gorm:"uniqueIndex;size:128"`
	ExpiresAt time.Time
	UsedAt    *time.Time
}
