package models

import (
	"time"

	"gorm.io/datatypes"
)

const (
	OrderStatusCreated  = "created"
	OrderStatusDeployed = "deployed"
)

// Order is the off-chain record backing a non-custodial escrow deployment request.
// order_id_hex uses a 0x-prefixed bytes32 hex string.
// amount_usdt is stored as integer minor units (e.g. 1 USDT = 1_000_000).
type Order struct {
	ID            uint      `gorm:"primaryKey"`
	OrderIDHex    string    `gorm:"size:66;uniqueIndex;not null"`
	BuyerUserID   *uint     `gorm:"index"`
	BuyerWallet   string    `gorm:"size:64;not null"`
	SellerWallet  string    `gorm:"size:64;not null"`
	AmountUSDT    uint64    `gorm:"not null"`
	EscrowAddress string    `gorm:"size:64"`
	TxHash        string    `gorm:"size:80"`
	ChainID       uint64    `gorm:"not null"`
	Status        string    `gorm:"size:32;index;not null"`
	CreatedAt     time.Time `gorm:"not null"`
	UpdatedAt     time.Time `gorm:"not null"`
}

// Dispute captures off-chain and on-chain linkage of a dispute.
// evidence_hashes: array of evidence IPFS hashes.
// initiator: address or role (e.g., buyer/seller) – for now store as string.
// ruling_reference: could be an IPFS CID or off-chain reference ID from arbitrator.
// IMPORTANT: resolution execution must be on-chain via arbitrator adapter.
type Dispute struct {
	ID              uint           `gorm:"primaryKey"`
	OrderID         uint           `gorm:"index;not null"`
	EvidenceHashes  datatypes.JSON `gorm:"type:jsonb"`
	Initiator       string         `gorm:"size:64"`
	Status          string         `gorm:"size:32;index"`
	RulingReference string         `gorm:"type:text"`
	CreatedAt       time.Time      `gorm:"not null"`
}

// Promotion records optional paid boosts for listings.
// listing_id is a reference to your content/listing entity (thread or future listing table).
// tier is a named level for promotion placement.
type Promotion struct {
	ID         uint      `gorm:"primaryKey"`
	SellerID   uint      `gorm:"index;not null"`
	ListingID  uint      `gorm:"index;not null"`
	Tier       string    `gorm:"size:32;not null"`
	StartAt    time.Time `gorm:"index;not null"`
	EndAt      time.Time `gorm:"index;not null"`
	PaidAmount float64   `gorm:"not null"`
	CreatedAt  time.Time `gorm:"not null"`
	UpdatedAt  time.Time `gorm:"not null"`
}

// VolumeLedger tracks rolling volume for fee tiering.
// period should be normalized to the beginning of window (e.g., month/day) for aggregation.
// seller_addr is the wallet address used on-chain.
type VolumeLedger struct {
	ID           uint      `gorm:"primaryKey"`
	SellerAddr   string    `gorm:"size:42;index:idx_seller_period,priority:1"`
	Period       time.Time `gorm:"index:idx_seller_period,priority:2"`
	VolumeAmount float64   `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null"`
	UpdatedAt    time.Time `gorm:"not null"`
}
