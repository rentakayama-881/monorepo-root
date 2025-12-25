package models

import (
	"time"

	"gorm.io/gorm"
)

// Admin represents an administrator account (separate from regular users)
type Admin struct {
	gorm.Model
	Email        string `gorm:"unique;not null" json:"email"`
	PasswordHash string `gorm:"not null" json:"-"`
	Name         string `gorm:"not null" json:"name"`
}

// Badge represents an achievement/appreciation badge
type Badge struct {
	gorm.Model
	Name        string `gorm:"not null" json:"name"`
	Slug        string `gorm:"unique;not null" json:"slug"`
	Description string `gorm:"type:text" json:"description"`
	IconURL     string `gorm:"not null" json:"icon_url"`
	Color       string `gorm:"default:'#6366f1'" json:"color"`
}

// UserBadge represents a badge assigned to a user
type UserBadge struct {
	gorm.Model
	UserID       uint       `gorm:"not null;index" json:"user_id"`
	BadgeID      uint       `gorm:"not null;index" json:"badge_id"`
	Reason       string     `gorm:"type:text" json:"reason"`
	GrantedBy    uint       `gorm:"not null" json:"granted_by"`
	GrantedAt    time.Time  `gorm:"not null" json:"granted_at"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"`
	RevokeReason string     `gorm:"type:text" json:"revoke_reason,omitempty"`

	// Relations
	User  User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Badge Badge `gorm:"foreignKey:BadgeID" json:"badge,omitempty"`
	Admin Admin `gorm:"foreignKey:GrantedBy" json:"admin,omitempty"`
}

// TableName sets the table name for UserBadge
func (UserBadge) TableName() string {
	return "user_badges"
}
