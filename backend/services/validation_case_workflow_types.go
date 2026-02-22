package services

// Workflow DTOs for Validation Case protocol endpoints.

type ConsultationRequestItem struct {
	ID                 uint                    `json:"id"`
	ValidationCaseID   uint                    `json:"validation_case_id"`
	Validator          UserSummary             `json:"validator"`
	Status             string                  `json:"status"`
	ApprovedAt         *int64                  `json:"approved_at,omitempty"`
	RejectedAt         *int64                  `json:"rejected_at,omitempty"`
	ExpiresAt          *int64                  `json:"expires_at,omitempty"`
	OwnerResponseDueAt *int64                  `json:"owner_response_due_at,omitempty"`
	ReminderCount      int                     `json:"reminder_count"`
	AutoClosedReason   string                  `json:"auto_closed_reason,omitempty"`
	MatchingScore      *MatchingScoreBreakdown `json:"matching_score,omitempty"`
	CreatedAt          int64                   `json:"created_at"`
}

type ValidatorConsultationRequestSummary struct {
	ID                 uint   `json:"id"`
	Status             string `json:"status"`
	ApprovedAt         *int64 `json:"approved_at,omitempty"`
	RejectedAt         *int64 `json:"rejected_at,omitempty"`
	ExpiresAt          *int64 `json:"expires_at,omitempty"`
	OwnerResponseDueAt *int64 `json:"owner_response_due_at,omitempty"`
	CreatedAt          int64  `json:"created_at"`
}

type ConsultationGuaranteeLockItem struct {
	ValidationCaseID   uint   `json:"validation_case_id"`
	ValidationStatus   string `json:"validation_status"`
	ConsultationStatus string `json:"consultation_status"`
	EscrowTransferID   string `json:"escrow_transfer_id,omitempty"`
	DisputeID          string `json:"dispute_id,omitempty"`
}

type MatchingScoreBreakdown struct {
	Total             int `json:"total"`
	DomainFit         int `json:"domain_fit"`
	EvidenceFit       int `json:"evidence_fit"`
	HistoryDispute    int `json:"history_dispute"`
	ResponsivenessSLA int `json:"responsiveness_sla"`
	StakeGuarantee    int `json:"stake_guarantee"`
}

type FinalOfferItem struct {
	ID               uint        `json:"id"`
	ValidationCaseID uint        `json:"validation_case_id"`
	Validator        UserSummary `json:"validator"`
	Amount           int64       `json:"amount"`
	HoldHours        int         `json:"hold_hours"`
	Terms            string      `json:"terms"`
	Status           string      `json:"status"`
	AcceptedAt       *int64      `json:"accepted_at,omitempty"`
	RejectedAt       *int64      `json:"rejected_at,omitempty"`
	CreatedAt        int64       `json:"created_at"`
}

type CaseLogItem struct {
	ID               uint                   `json:"id"`
	ValidationCaseID uint                   `json:"validation_case_id"`
	Actor            *UserSummary           `json:"actor,omitempty"`
	EventType        string                 `json:"event_type"`
	Detail           map[string]interface{} `json:"detail"`
	CreatedAt        int64                  `json:"created_at"`
}

// EscrowDraft is a client-facing instruction for how to Lock Funds in Feature Service.
// The client should call Feature Service transfers endpoint using these fields, then confirm to Go backend.
type EscrowDraft struct {
	ReceiverUsername string `json:"receiver_username"`
	Amount           int64  `json:"amount"`
	HoldHours        int    `json:"hold_hours"`
	Message          string `json:"message,omitempty"`
}
