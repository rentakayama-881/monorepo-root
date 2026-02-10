package services

// Workflow DTOs for Validation Case protocol endpoints.

type ConsultationRequestItem struct {
	ID              uint        `json:"id"`
	ValidationCaseID uint       `json:"validation_case_id"`
	Validator        UserSummary `json:"validator"`
	Status          string      `json:"status"`
	ApprovedAt      *int64      `json:"approved_at,omitempty"`
	RejectedAt      *int64      `json:"rejected_at,omitempty"`
	CreatedAt       int64       `json:"created_at"`
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
	ID              uint                   `json:"id"`
	ValidationCaseID uint                  `json:"validation_case_id"`
	Actor            *UserSummary          `json:"actor,omitempty"`
	EventType        string                `json:"event_type"`
	Detail           map[string]interface{} `json:"detail"`
	CreatedAt        int64                 `json:"created_at"`
}

// EscrowDraft is a client-facing instruction for how to Lock Funds in Feature Service.
// The client should call Feature Service transfers endpoint using these fields, then confirm to Go backend.
type EscrowDraft struct {
	ReceiverUsername string `json:"receiver_username"`
	Amount           int64  `json:"amount"`
	HoldHours        int    `json:"hold_hours"`
	Message          string `json:"message,omitempty"`
}

