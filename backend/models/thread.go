package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Category struct {
	gorm.Model
	Slug        string   `gorm:"uniqueIndex;not null"`
	Name        string   `gorm:"not null"`
	Description string
	Threads     []Thread `gorm:"constraint:OnDelete:CASCADE;"`
}

type Thread struct {
	gorm.Model
	CategoryID uint           `gorm:"index;not null"`
	UserID     uint           `gorm:"index;not null"`
	Title      string         `gorm:"not null"`
	Summary    string
	// ContentType determines how frontend renders the content (e.g., "table")
	ContentType string         `gorm:"type:varchar(32);not null;default:table"`
	// ContentJSON stores structured thread content as JSON (rows/sections/etc.)
	ContentJSON datatypes.JSON `gorm:"type:jsonb"`
	// Meta can store extra info (views, tags, etc.)
	Meta datatypes.JSON `gorm:"type:jsonb"`

	User     User     `gorm:"foreignKey:UserID"`
	Category Category `gorm:"foreignKey:CategoryID"`
}
