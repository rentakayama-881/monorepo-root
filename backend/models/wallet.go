package models

import (
	"time"

	"gorm.io/gorm"
)

// UserWallet represents the internal wallet for each user
type UserWallet struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"uniqueIndex;not null" json:"user_id"`
	User      User           `gorm:"foreignKey:UserID" json:"-"`
	Balance   int64          `gorm:"default:0" json:"balance"` // Balance in IDR (smallest unit)
	PINHash   string         `gorm:"size:255" json:"-"`        // Hashed PIN for transactions
	PINSet    bool           `gorm:"default:false" json:"pin_set"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Deposit represents a deposit transaction from Xendit
type Deposit struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	UserID             uint           `gorm:"index;not null" json:"user_id"`
	User               User           `gorm:"foreignKey:UserID" json:"-"`
	ExternalID         string         `gorm:"size:100;uniqueIndex" json:"external_id"` // Xendit invoice/payment ID
	Amount             int64          `gorm:"not null" json:"amount"`                  // Amount in IDR
	PaymentMethod      string         `gorm:"size:50" json:"payment_method"`           // QRIS, OVO, DANA, BCA_VA, etc.
	PaymentChannel     string         `gorm:"size:50" json:"payment_channel"`          // Specific channel
	Status             DepositStatus  `gorm:"size:20;default:'pending'" json:"status"` // pending, success, failed, expired
	XenditCallbackData string         `gorm:"type:text" json:"-"`                      // JSON callback data from Xendit
	InvoiceURL         string         `gorm:"size:500" json:"invoice_url"`             // Payment URL from Xendit
	ExpiresAt          *time.Time     `json:"expires_at"`
	PaidAt             *time.Time     `json:"paid_at"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

type DepositStatus string

const (
	DepositStatusPending DepositStatus = "pending"
	DepositStatusSuccess DepositStatus = "success"
	DepositStatusFailed  DepositStatus = "failed"
	DepositStatusExpired DepositStatus = "expired"
)

// Transfer represents an internal transfer/escrow between users
type Transfer struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	TransferCode string         `gorm:"size:20;uniqueIndex" json:"transfer_code"` // TRF-XXXXXX
	SenderID     uint           `gorm:"index;not null" json:"sender_id"`
	Sender       User           `gorm:"foreignKey:SenderID" json:"sender,omitempty"`
	ReceiverID   uint           `gorm:"index;not null" json:"receiver_id"`
	Receiver     User           `gorm:"foreignKey:ReceiverID" json:"receiver,omitempty"`
	Amount       int64          `gorm:"not null" json:"amount"` // Amount in IDR
	HoldDays     int            `gorm:"not null" json:"hold_days"`
	HoldUntil    time.Time      `gorm:"not null" json:"hold_until"`
	Description  string         `gorm:"size:500" json:"description"`
	Status       TransferStatus `gorm:"size:20;default:'held'" json:"status"`
	// held: money is being held
	// released: money has been released to receiver
	// refunded: money has been returned to sender
	// disputed: under dispute
	// cancelled: cancelled by receiver before release
	ReleasedAt *time.Time     `json:"released_at"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

type TransferStatus string

const (
	TransferStatusHeld      TransferStatus = "held"
	TransferStatusReleased  TransferStatus = "released"
	TransferStatusRefunded  TransferStatus = "refunded"
	TransferStatusDisputed  TransferStatus = "disputed"
	TransferStatusCancelled TransferStatus = "cancelled"
)

// Dispute represents a dispute on a transfer
type Dispute struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	DisputeCode string        `gorm:"size:20;uniqueIndex" json:"dispute_code"` // DSP-XXXXXX
	TransferID  uint          `gorm:"index;not null" json:"transfer_id"`
	Transfer    Transfer      `gorm:"foreignKey:TransferID" json:"transfer,omitempty"`
	InitiatedBy uint          `gorm:"not null" json:"initiated_by"` // User ID who initiated
	Initiator   User          `gorm:"foreignKey:InitiatedBy" json:"initiator,omitempty"`
	Reason      string        `gorm:"type:text;not null" json:"reason"`
	Status      DisputeStatus `gorm:"size:30;default:'open'" json:"status"`
	// open: dispute just opened
	// mutual_resolution: waiting for parties to resolve
	// evidence_phase: collecting evidence
	// under_review: admin is reviewing
	// resolved_to_sender: resolved in favor of sender (refund)
	// resolved_to_receiver: resolved in favor of receiver (release)
	Phase         DisputePhase   `gorm:"size:30;default:'mutual_resolution'" json:"phase"`
	PhaseDeadline *time.Time     `json:"phase_deadline"`
	AdminID       *uint          `json:"admin_id"`
	AdminDecision string         `gorm:"type:text" json:"admin_decision"`
	AdminNotes    string         `gorm:"type:text" json:"-"` // Internal notes
	ResolvedAt    *time.Time     `json:"resolved_at"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type DisputeStatus string

const (
	DisputeStatusOpen               DisputeStatus = "open"
	DisputeStatusMutualResolution   DisputeStatus = "mutual_resolution"
	DisputeStatusEvidencePhase      DisputeStatus = "evidence_phase"
	DisputeStatusUnderReview        DisputeStatus = "under_review"
	DisputeStatusResolvedToSender   DisputeStatus = "resolved_to_sender"
	DisputeStatusResolvedToReceiver DisputeStatus = "resolved_to_receiver"
)

type DisputePhase string

const (
	DisputePhaseMutualResolution DisputePhase = "mutual_resolution"
	DisputePhaseEvidence         DisputePhase = "evidence_phase"
	DisputePhaseAdminReview      DisputePhase = "admin_review"
	DisputePhaseResolved         DisputePhase = "resolved"
)

// DisputeEvidence represents evidence submitted for a dispute
type DisputeEvidence struct {
	ID           uint         `gorm:"primaryKey" json:"id"`
	DisputeID    uint         `gorm:"index;not null" json:"dispute_id"`
	Dispute      Dispute      `gorm:"foreignKey:DisputeID" json:"-"`
	UserID       uint         `gorm:"not null" json:"user_id"`
	User         User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	EvidenceType EvidenceType `gorm:"size:20" json:"evidence_type"` // text, image, file
	Content      string       `gorm:"type:text" json:"content"`     // Text content or URL to file
	FileName     string       `gorm:"size:255" json:"file_name"`
	FileSize     int64        `json:"file_size"`
	CreatedAt    time.Time    `json:"created_at"`
}

type EvidenceType string

const (
	EvidenceTypeText  EvidenceType = "text"
	EvidenceTypeImage EvidenceType = "image"
	EvidenceTypeFile  EvidenceType = "file"
)

// DisputeMessage represents a message in the dispute chat room
type DisputeMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	DisputeID uint      `gorm:"index;not null" json:"dispute_id"`
	Dispute   Dispute   `gorm:"foreignKey:DisputeID" json:"-"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Message   string    `gorm:"type:text;not null" json:"message"`
	IsAdmin   bool      `gorm:"default:false" json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
}

// Withdrawal represents a withdrawal request to bank/e-wallet
type Withdrawal struct {
	ID                   uint             `gorm:"primaryKey" json:"id"`
	UserID               uint             `gorm:"index;not null" json:"user_id"`
	User                 User             `gorm:"foreignKey:UserID" json:"-"`
	WithdrawalCode       string           `gorm:"size:20;uniqueIndex" json:"withdrawal_code"` // WDR-XXXXXX
	Amount               int64            `gorm:"not null" json:"amount"`                     // Amount in IDR
	Fee                  int64            `gorm:"default:0" json:"fee"`                       // Withdrawal fee
	NetAmount            int64            `gorm:"not null" json:"net_amount"`                 // Amount after fee
	BankCode             string           `gorm:"size:20" json:"bank_code"`
	AccountNumber        string           `gorm:"size:50" json:"account_number"`
	AccountName          string           `gorm:"size:100" json:"account_name"`
	Status               WithdrawalStatus `gorm:"size:20;default:'pending'" json:"status"`
	XenditDisbursementID string           `gorm:"size:100" json:"xendit_disbursement_id"`
	FailureReason        string           `gorm:"size:500" json:"failure_reason"`
	ProcessedAt          *time.Time       `json:"processed_at"`
	CreatedAt            time.Time        `json:"created_at"`
	UpdatedAt            time.Time        `json:"updated_at"`
	DeletedAt            gorm.DeletedAt   `gorm:"index" json:"-"`
}

type WithdrawalStatus string

const (
	WithdrawalStatusPending    WithdrawalStatus = "pending"
	WithdrawalStatusProcessing WithdrawalStatus = "processing"
	WithdrawalStatusSuccess    WithdrawalStatus = "success"
	WithdrawalStatusFailed     WithdrawalStatus = "failed"
)

// WalletTransaction represents an audit log entry for wallet transactions
type WalletTransaction struct {
	ID            uint                  `gorm:"primaryKey" json:"id"`
	UserID        uint                  `gorm:"index;not null" json:"user_id"`
	User          User                  `gorm:"foreignKey:UserID" json:"-"`
	Type          WalletTransactionType `gorm:"size:20;not null" json:"type"`
	Amount        int64                 `gorm:"not null" json:"amount"` // Positive for credit, negative for debit
	BalanceBefore int64                 `gorm:"not null" json:"balance_before"`
	BalanceAfter  int64                 `gorm:"not null" json:"balance_after"`
	ReferenceType string                `gorm:"size:20" json:"reference_type"` // deposit, transfer, withdrawal, dispute
	ReferenceID   uint                  `json:"reference_id"`
	Description   string                `gorm:"size:255" json:"description"`
	CreatedAt     time.Time             `json:"created_at"`
}

type WalletTransactionType string

const (
	WalletTxTypeDeposit     WalletTransactionType = "deposit"
	WalletTxTypeTransferOut WalletTransactionType = "transfer_out"
	WalletTxTypeTransferIn  WalletTransactionType = "transfer_in"
	WalletTxTypeRefund      WalletTransactionType = "refund"
	WalletTxTypeWithdrawal  WalletTransactionType = "withdrawal"
	WalletTxTypeFee         WalletTransactionType = "fee"
)
