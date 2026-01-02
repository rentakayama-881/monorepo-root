package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email          string  `gorm:"unique;not null"`
	Username       *string `gorm:"unique;column:name"`
	PasswordHash   string  `gorm:"not null"`
	EmailVerified  bool    `gorm:"default:false"`
	AvatarURL      string
	FullName       *string `gorm:"default:null"`
	Bio            string  `gorm:"type:text"`
	Pronouns       string
	Company        string
	Telegram       string
	SocialAccounts datatypes.JSON `gorm:"type:jsonb"`
	PrimaryBadgeID *uint          `gorm:"default:null"`

	// TOTP / 2FA fields
	TOTPSecret     string     `gorm:"column:totp_secret"`                // Encrypted TOTP secret
	TOTPEnabled    bool       `gorm:"column:totp_enabled;default:false"` // Is 2FA enabled
	TOTPVerifiedAt *time.Time `gorm:"column:totp_verified_at"`           // When 2FA was first verified
}

// BackupCode represents a single-use recovery code for 2FA
type BackupCode struct {
	gorm.Model
	UserID   uint   `gorm:"not null;index"`
	CodeHash string `gorm:"not null"` // Hashed backup code
	UsedAt   *time.Time
}

// IsTOTPEnabled returns true if user has TOTP enabled
func (u *User) IsTOTPEnabled() bool {
	return u.TOTPEnabled && u.TOTPSecret != ""
}
