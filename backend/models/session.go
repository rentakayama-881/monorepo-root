package models

import (
	"time"

	"gorm.io/gorm"
)

// Session represents an active user session with refresh token
type Session struct {
	gorm.Model
	UserID           uint       `gorm:"index;not null"`
	RefreshTokenHash string     `gorm:"uniqueIndex;size:128;not null"` // SHA-256 hash of refresh token
	AccessTokenJTI   string     `gorm:"size:64"`                       // Current access token ID
	IPAddress        string     `gorm:"size:45"`                       // IPv4/IPv6
	UserAgent        string     `gorm:"size:512"`
	ExpiresAt        time.Time  `gorm:"not null"`
	LastUsedAt       time.Time  `gorm:"not null"`
	RevokedAt        *time.Time // If set, session is revoked
	RevokeReason     string     `gorm:"size:100"` // Why session was revoked

	// For reuse detection
	TokenFamily string `gorm:"index;size:64;not null"` // All rotated tokens share same family
	IsUsed      bool   `gorm:"default:false"`          // Mark old token as used after rotation

	User User `gorm:"foreignKey:UserID"`
}

// IsValid checks if session is still valid
func (s *Session) IsValid() bool {
	if s.RevokedAt != nil {
		return false
	}
	if time.Now().After(s.ExpiresAt) {
		return false
	}
	return true
}

// SessionLock represents account lock due to security violation
type SessionLock struct {
	gorm.Model
	UserID     uint      `gorm:"uniqueIndex;not null"`
	LockedAt   time.Time `gorm:"not null"`
	UnlockedAt *time.Time
	ExpiresAt  time.Time `gorm:"not null"` // Auto-unlock time (for temporary locks)
	Reason     string    `gorm:"size:255;not null"`
	LockedBy   string    `gorm:"size:50"` // "system" or admin username

	User User `gorm:"foreignKey:UserID"`
}

// IsLocked checks if the lock is still active
func (sl *SessionLock) IsLocked() bool {
	if sl.UnlockedAt != nil {
		return false
	}
	// For permanent locks (ExpiresAt is zero), always locked
	if sl.ExpiresAt.IsZero() {
		return true
	}
	return time.Now().Before(sl.ExpiresAt)
}
