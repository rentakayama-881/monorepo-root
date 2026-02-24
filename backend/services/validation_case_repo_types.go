package services

// Repo-validation workflow DTOs.

type RepoCaseFileItem struct {
	ID         string `json:"id"`
	DocumentID string `json:"document_id"`
	Kind       string `json:"kind"`
	Label      string `json:"label"`
	Visibility string `json:"visibility"`
	UploadedBy uint   `json:"uploaded_by"`
	UploadedAt int64  `json:"uploaded_at"`
}

type RepoAssignmentItem struct {
	ValidatorUserID uint   `json:"validator_user_id"`
	Status          string `json:"status"`
	AssignedAt      int64  `json:"assigned_at"`
}

type RepoVerdictItem struct {
	ValidatorUserID uint   `json:"validator_user_id"`
	Verdict         string `json:"verdict"`
	Confidence      int    `json:"confidence"`
	Notes           string `json:"notes,omitempty"`
	DocumentID      string `json:"document_id,omitempty"`
	SubmittedAt     int64  `json:"submitted_at"`
}

type RepoPayoutEntry struct {
	ValidatorUserID uint   `json:"validator_user_id"`
	BaseAmount      int64  `json:"base_amount"`
	QualityAmount   int64  `json:"quality_amount"`
	ChainLocked     int64  `json:"chain_locked"`
	ChainUnlocked   int64  `json:"chain_unlocked"`
	ChainStatus     string `json:"chain_status"`
}

type RepoPayoutLedger struct {
	BountyAmount int64             `json:"bounty_amount"`
	BasePool     int64             `json:"base_pool"`
	QualityPool  int64             `json:"quality_pool"`
	ChainPool    int64             `json:"chain_pool"`
	Entries      []RepoPayoutEntry `json:"entries"`
	CreatedAt    int64             `json:"created_at"`
}

type RepoTreeResponse struct {
	CaseID              uint                 `json:"case_id"`
	ProtocolMode        string               `json:"protocol_mode"`
	RepoStage           string               `json:"repo_stage"`
	CompletionMode      string               `json:"completion_mode"`
	ConsensusStatus     string               `json:"consensus_status"`
	ConsensusResult     string               `json:"consensus_result,omitempty"`
	RequiredStake       int64                `json:"required_stake"`
	ViewerStake         int64                `json:"viewer_stake"`
	StakeEligible       bool                 `json:"stake_eligible"`
	CanPublish          bool                 `json:"can_publish"`
	HasRequiredReadme   bool                 `json:"has_required_readme"`
	HasTaskInput        bool                 `json:"has_task_input"`
	IsOwner             bool                 `json:"is_owner"`
	IsAssignedValidator bool                 `json:"is_assigned_validator"`
	Files               []RepoCaseFileItem   `json:"files"`
	Applicants          []UserSummary        `json:"applicants"`
	Assignments         []RepoAssignmentView `json:"assignments"`
	Verdicts            []RepoVerdictView    `json:"verdicts"`
}

type RepoAssignmentView struct {
	Validator  UserSummary `json:"validator"`
	Status     string      `json:"status"`
	AssignedAt int64       `json:"assigned_at"`
}

type RepoVerdictView struct {
	Validator   UserSummary `json:"validator"`
	Verdict     string      `json:"verdict"`
	Confidence  int         `json:"confidence"`
	Notes       string      `json:"notes,omitempty"`
	DocumentID  string      `json:"document_id,omitempty"`
	SubmittedAt int64       `json:"submitted_at"`
}

type RepoConsensusResponse struct {
	CaseID          uint              `json:"case_id"`
	CompletionMode  string            `json:"completion_mode"`
	ConsensusStatus string            `json:"consensus_status"`
	ConsensusResult string            `json:"consensus_result,omitempty"`
	RequiredVotes   int               `json:"required_votes"`
	SubmittedVotes  int               `json:"submitted_votes"`
	Breakdown       map[string]int    `json:"breakdown"`
	Payout          *RepoPayoutLedger `json:"payout,omitempty"`
}
