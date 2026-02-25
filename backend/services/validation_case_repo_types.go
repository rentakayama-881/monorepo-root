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

type RepoConfidenceVoteItem struct {
	VoterUserID     uint  `json:"voter_user_id"`
	ValidatorUserID uint  `json:"validator_user_id"`
	VotedAt         int64 `json:"voted_at"`
}

type RepoConfidenceScore struct {
	Validator         UserSummary `json:"validator"`
	Votes             int         `json:"votes"`
	ViewerVoted       bool        `json:"viewer_voted"`
	HasUploadedOutput bool        `json:"has_uploaded_output"`
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
	ValidatorUserID uint  `json:"validator_user_id"`
	Amount          int64 `json:"amount"`
	ConfidenceVotes int   `json:"confidence_votes"`
	// Legacy fields retained for compatibility with historical payloads.
	BaseAmount    int64  `json:"base_amount"`
	QualityAmount int64  `json:"quality_amount"`
	ChainLocked   int64  `json:"chain_locked"`
	ChainUnlocked int64  `json:"chain_unlocked"`
	ChainStatus   string `json:"chain_status"`
}

type RepoPayoutLedger struct {
	BountyAmount      int64             `json:"bounty_amount"`
	WinnerValidatorID []uint            `json:"winner_validator_ids,omitempty"`
	Confidence        map[string]int    `json:"confidence,omitempty"`
	Entries           []RepoPayoutEntry `json:"entries"`
	CreatedAt         int64             `json:"created_at"`
	// Legacy fields retained for compatibility with historical payloads.
	BasePool    int64 `json:"base_pool"`
	QualityPool int64 `json:"quality_pool"`
	ChainPool   int64 `json:"chain_pool"`
}

type RepoCaseFileView struct {
	ID             string      `json:"id"`
	DocumentID     string      `json:"document_id"`
	Kind           string      `json:"kind"`
	Label          string      `json:"label"`
	Visibility     string      `json:"visibility"`
	UploadedBy     uint        `json:"uploaded_by"`
	UploadedByUser UserSummary `json:"uploaded_by_user"`
	UploadedAt     int64       `json:"uploaded_at"`
}

type RepoTreeResponse struct {
	CaseID                          uint                  `json:"case_id"`
	WorkflowFamily                  string                `json:"workflow_family"`
	WorkflowName                    string                `json:"workflow_name"`
	ProtocolMode                    string                `json:"protocol_mode,omitempty"`
	WorkspaceStage                  string                `json:"workspace_stage"`
	RepoStage                       string                `json:"repo_stage"`
	CompletionMode                  string                `json:"completion_mode"`
	ConsensusStatus                 string                `json:"consensus_status"`
	ConsensusResult                 string                `json:"consensus_result,omitempty"`
	RequiredStake                   int64                 `json:"required_stake"`
	ViewerStake                     int64                 `json:"viewer_stake"`
	StakeEligible                   bool                  `json:"stake_eligible"`
	CanPublish                      bool                  `json:"can_publish"`
	HasRequiredReadme               bool                  `json:"has_required_readme"`
	HasTaskInput                    bool                  `json:"has_task_input"`
	IsOwner                         bool                  `json:"is_owner"`
	IsAssignedValidator             bool                  `json:"is_assigned_validator"`
	Files                           []RepoCaseFileView    `json:"files"`
	Applicants                      []UserSummary         `json:"applicants"`
	Assignments                     []RepoAssignmentView  `json:"assignments"`
	Verdicts                        []RepoVerdictView     `json:"verdicts"`
	ConfidenceScores                []RepoConfidenceScore `json:"confidence_scores"`
	ViewerConfidenceVoteValidatorID *uint                 `json:"viewer_confidence_vote_validator_id,omitempty"`
	MinimumValidatorUploads         int                   `json:"minimum_validator_uploads"`
	UploadedValidatorCount          int                   `json:"uploaded_validator_count"`
	CanFinalize                     bool                  `json:"can_finalize"`
	Payout                          *RepoPayoutLedger     `json:"payout,omitempty"`
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
