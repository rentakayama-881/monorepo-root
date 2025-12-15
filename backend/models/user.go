package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email         string  `gorm:"unique;not null"`
	Username      *string `gorm:"unique;column:name"`
	PasswordHash  string  `gorm:"not null"`
	EmailVerified bool    `gorm:"default:false"`
	AvatarURL     string
	Balance       float64 `gorm:"default:0"`

	FullName       *string `gorm:"default:null"`
	Bio            string  `gorm:"type:text"`
	Pronouns       string
	Company        string
	Telegram       string
	SocialAccounts datatypes.JSON `gorm:"type:jsonb"`
}
