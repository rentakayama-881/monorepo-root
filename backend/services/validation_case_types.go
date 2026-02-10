package services

// Validation Case service response types.
// These types are used by both interfaces and implementations.

// CategoryResponse represents a category (used as Validation Case "type") in API responses.
type CategoryResponse struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// TagResponse represents a tag in API responses.
type TagResponse struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Color string `json:"color,omitempty"`
	Icon  string `json:"icon,omitempty"`
}

// UserSummary represents public, informational credentials about a user.
// NOTE: This is intentionally non-interactive (no likes/reactions).
type UserSummary struct {
	ID              uint   `json:"id"`
	Username        string `json:"username"`
	AvatarURL       string `json:"avatar_url"`
	PrimaryBadge    *Badge `json:"primary_badge,omitempty"`
	GuaranteeAmount int64  `json:"guarantee_amount"`
}

// ValidationCaseListItem represents a Validation Case in index/list responses.
type ValidationCaseListItem struct {
	ID                   uint                   `json:"id"`
	Title                string                 `json:"title"`
	Summary              string                 `json:"summary"`
	Status               string                 `json:"status"`
	SensitivityLevel     string                 `json:"sensitivity_level,omitempty"`
	ClarificationState   string                 `json:"clarification_state,omitempty"`
	BountyAmount         int64                  `json:"bounty_amount"`
	OwnerInactivityCount int                    `json:"owner_inactivity_count"`
	Owner                UserSummary            `json:"owner"`
	Category             CategoryResponse       `json:"category"`
	Tags                 []TagResponse          `json:"tags,omitempty"`
	Meta                 map[string]interface{} `json:"meta,omitempty"`
	CreatedAt            int64                  `json:"created_at"`
}

// ValidationCaseDetailResponse represents the core Validation Case record.
// Sections like Case Log / Final Offer / Artifact Submission are fetched via dedicated endpoints.
type ValidationCaseDetailResponse struct {
	ID                   uint                   `json:"id"`
	Title                string                 `json:"title"`
	Summary              string                 `json:"summary"`
	ContentType          string                 `json:"content_type"`
	Content              map[string]interface{} `json:"content"`
	Meta                 map[string]interface{} `json:"meta,omitempty"`
	SensitivityLevel     string                 `json:"sensitivity_level,omitempty"`
	IntakeSchemaVersion  string                 `json:"intake_schema_version,omitempty"`
	ClarificationState   string                 `json:"clarification_state,omitempty"`
	OwnerInactivityCount int                    `json:"owner_inactivity_count"`

	Status       string `json:"status"`
	BountyAmount int64  `json:"bounty_amount"`

	EscrowTransferID            *string `json:"escrow_transfer_id,omitempty"`
	DisputeID                   *string `json:"dispute_id,omitempty"`
	AcceptedFinalOfferID        *uint   `json:"accepted_final_offer_id,omitempty"`
	ArtifactDocumentID          *string `json:"artifact_document_id,omitempty"`
	CertifiedArtifactDocumentID *string `json:"certified_artifact_document_id,omitempty"`

	CreatedAt int64            `json:"created_at"`
	Owner     UserSummary      `json:"owner"`
	Category  CategoryResponse `json:"category"`
	Tags      []TagResponse    `json:"tags,omitempty"`
}

// CategoryWithValidationCasesResponse represents a case type (category) with its cases.
type CategoryWithValidationCasesResponse struct {
	Category CategoryResponse         `json:"category"`
	Cases    []ValidationCaseListItem `json:"validation_cases"`
}
