package models

import (
	"time"

	"gorm.io/datatypes"
)

// NOTE: Amount fields use float64 for draft purposes.
// In production, prefer fixed-point (e.g., integer minor units) to avoid float rounding issues.

// OrderStatus is a simple string-based enum for order lifecycle.
// Event-driven: backend must only update status after verifying on-chain events.
const (
	OrderStatusPending    = "pending"   // created off-chain, awaiting on-chain funding
	OrderStatusFunded     = "funded"    // escrow funded on-chain
	OrderStatusDelivered  = "delivered" // seller delivered (evidence submitted)
	OrderStatusDisputed   = "disputed"  // dispute opened
	OrderStatusResolved   = "resolved"  // dispute resolved (release/refund executed)
	OrderStatusRefunded   = "refunded"  // fully refunded
	OrderStatusCancelled  = "cancelled" // cancelled before funding or by arbitrator
)

// Order maps an off-chain record to an on-chain escrow instance.
// Non-custodial: amount is informational; escrowAddress holds the real funds.
// ipfsDeliverableHashes holds the content references delivered by seller.
// currency is expected to be "USDT" for this sprint.
// closed_at is set when the order is terminal (resolved/refunded/cancelled).
// IMPORTANT: Do NOT update status without on-chain event verification.
// Use a dedicated event listener/worker to advance statuses.
//
// GORM model uses explicit timestamps to match requested columns.
// ID will be the primary key (uint auto-increment).
//
// For future: consider storing tx hashes for funding/release/refund.
//
type Order struct {
	ID                     uint           `gorm:"primaryKey"`
	EscrowAddress          string         `gorm:"size:42;index"`
	BuyerAddr              string         `gorm:"size:42;index"`
	SellerAddr             string         `gorm:"size:42;index"`
	Amount                 float64        `gorm:"not null"`
	Currency               string         `gorm:"size:16;not null;default:USDT"`
	Status                 string         `gorm:"size:32;index"`
	IpfsDeliverableHashes  datatypes.JSON `gorm:"type:jsonb"`
	CreatedAt              time.Time      `gorm:"not null"`
	ClosedAt               *time.Time     `gorm:"index"`
}

// Dispute captures off-chain and on-chain linkage of a dispute.
// evidence_hashes: array of evidence IPFS hashes.
// initiator: address or role (e.g., buyer/seller) – for now store as string.
// ruling_reference: could be an IPFS CID or off-chain reference ID from arbitrator.
// IMPORTANT: resolution execution must be on-chain via arbitrator adapter.
//
type Dispute struct {
	ID               uint           `gorm:"primaryKey"`
	OrderID          uint           `gorm:"index;not null"`
	EvidenceHashes   datatypes.JSON `gorm:"type:jsonb"`
	Initiator        string         `gorm:"size:64"`
	Status           string         `gorm:"size:32;index"`
	RulingReference  string         `gorm:"type:text"`
	CreatedAt        time.Time      `gorm:"not null"`
}

// Promotion records optional paid boosts for listings.
// listing_id is a reference to your content/listing entity (thread or future listing table).
// tier is a named level for promotion placement.
//
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
//
type VolumeLedger struct {
	ID           uint      `gorm:"primaryKey"`
	SellerAddr   string    `gorm:"size:42;index:idx_seller_period,priority:1"`
	Period       time.Time `gorm:"index:idx_seller_period,priority:2"`
	VolumeAmount float64   `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null"`
	UpdatedAt    time.Time `gorm:"not null"`
}
