package models

import "time"

// ChainCursor menyimpan posisi block terakhir yang telah diproses worker event.
type ChainCursor struct {
	ID            uint      `gorm:"primaryKey"`
	Name          string    `gorm:"size:64;uniqueIndex:idx_chain_cursor"`
	ChainID       uint64    `gorm:"uniqueIndex:idx_chain_cursor"`
	LastProcessed uint64    `gorm:"not null;default:0"`
	CreatedAt     time.Time `gorm:"not null"`
	UpdatedAt     time.Time `gorm:"not null"`
}
