package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email                string         `gorm:"unique;not null"`
	Name                 *string        `gorm:"unique"`
	AvatarURL            string
	Balance              float64        `gorm:"default:0"`

	FullName             *string        `gorm:"default:null"`
	Bio                  string         `gorm:"type:text"`
	Pronouns             string
	Company              string
	Telegram             string
	SocialAccounts       datatypes.JSON `gorm:"type:jsonb"`
}
