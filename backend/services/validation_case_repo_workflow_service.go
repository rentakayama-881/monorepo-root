package services

import (
"context"
"encoding/json"
"strings"

"backend-gin/database"
"backend-gin/ent"
apperrors "backend-gin/errors"
"backend-gin/logger"

"go.uber.org/zap"
)

const (
	workspaceWorkflowFamily = "evidence_validation_workspace"
	workspaceWorkflowName   = "Evidence Validation Workspace"

	// Legacy marker (read compatibility only). New writes use workflow_family.
	repoProtocolModeV2 = "repo_validation_v2"
	// Legacy consultation workflow marker.
	workflowProtocolV1 = "workflow_v1"

	repoCompletionOpen = "open"
	// Legacy constants retained for backward-compatibility of historical payload parsing.
	repoCompletionPanel3  = "panel_3"
	repoCompletionPanel10 = "panel_10"

	repoConsensusPending    = "pending"
	repoConsensusConclusive = "conclusive"
	repoConsensusEscalated  = "escalated"
	repoConsensusFinalized  = "finalized"

	repoStageReady     = "ready"
	repoStageDraft     = "draft"
	repoStagePublished = "published"
	repoStageInReview  = "in_review"
	repoStageFinalized = "finalized"

	repoFileKindReadme    = "case_readme"
	repoFileKindTaskInput = "task_input"
	repoFileKindOutput    = "validator_output"
	repoFileKindSensitive = "sensitive_context"

	repoFileVisibilityPublic             = "public"
	repoFileVisibilityAssignedValidators = "assigned_validators"

	repoAssignmentStatusActive = "active"

	repoMinimumValidatorUploads = 3

	repoBountyReserveStatusNone      = ""
	repoBountyReserveStatusReserved  = "reserved"
	repoBountyReserveStatusDisbursed = "disbursed"

	repoVerdictValid         = "valid"
	repoVerdictNeedsRevision = "needs_revision"
	repoVerdictReject        = "reject"

	repoChainStatusLocked   = "locked"
	repoChainStatusUnlocked = "unlocked"
)

type EntValidationCaseRepoWorkflowService struct {
	client *ent.Client
}

func NewEntValidationCaseRepoWorkflowService() *EntValidationCaseRepoWorkflowService {
	return &EntValidationCaseRepoWorkflowService{client: database.GetEntClient()}
}

type repoMetaState struct {
	WorkflowFamily       string                   `json:"workflow_family"`
	ProtocolMode         string                   `json:"protocol_mode"`
	CompletionMode       string                   `json:"completion_mode"`
	ConsensusStatus      string                   `json:"consensus_status"`
	ConsensusResult      string                   `json:"consensus_result,omitempty"`
	RepoStage            string                   `json:"repo_stage"`
	RepoFiles            []RepoCaseFileItem       `json:"repo_files"`
	RepoApplicants       []uint                   `json:"repo_applicants"`
	RepoAssignments      []RepoAssignmentItem     `json:"repo_assignments"`
	RepoVerdicts         []RepoVerdictItem        `json:"repo_verdicts"`
	RepoConfidenceVotes  []RepoConfidenceVoteItem `json:"repo_confidence_votes"`
	RepoPayout           *RepoPayoutLedger        `json:"repo_payout,omitempty"`
	BountyReserveOrderID string                   `json:"repo_bounty_reserve_order_id,omitempty"`
	BountyReserveStatus  string                   `json:"repo_bounty_reserve_status,omitempty"`
}

func defaultRepoMetaState() repoMetaState {
	return repoMetaState{
		WorkflowFamily:      workspaceWorkflowFamily,
		CompletionMode:      repoCompletionOpen,
		ConsensusStatus:     repoConsensusPending,
		RepoStage:           repoStageReady,
		RepoFiles:           []RepoCaseFileItem{},
		RepoApplicants:      []uint{},
		RepoAssignments:     []RepoAssignmentItem{},
		RepoVerdicts:        []RepoVerdictItem{},
		RepoConfidenceVotes: []RepoConfidenceVoteItem{},
	}
}

func normalizeRepoMode(s string) string {
	mode := strings.ToLower(strings.TrimSpace(s))
	switch mode {
	case repoProtocolModeV2:
		return repoProtocolModeV2
	case workflowProtocolV1:
		return workflowProtocolV1
	default:
		return mode
	}
}

func normalizeWorkflowFamily(s string) string {
	if strings.EqualFold(strings.TrimSpace(s), workspaceWorkflowFamily) {
		return workspaceWorkflowFamily
	}
	return strings.ToLower(strings.TrimSpace(s))
}

func isWorkspaceMetaState(state repoMetaState) bool {
	return normalizeWorkflowFamily(state.WorkflowFamily) == workspaceWorkflowFamily ||
		normalizeRepoMode(state.ProtocolMode) == repoProtocolModeV2
}

func normalizeRepoStage(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoStageReady:
		return repoStageReady
	case "published", "draft":
		return repoStageReady
	case repoStageInReview:
		return repoStageInReview
	case repoStageFinalized:
		return repoStageFinalized
	default:
		return repoStageReady
	}
}

func normalizeRepoCompletionMode(s string) string {
	_ = s
	return repoCompletionOpen
}

func normalizeRepoConsensusStatus(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoConsensusFinalized:
		return repoConsensusFinalized
	default:
		return repoConsensusPending
	}
}

func normalizeRepoBountyReserveStatus(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoBountyReserveStatusReserved:
		return repoBountyReserveStatusReserved
	case repoBountyReserveStatusDisbursed:
		return repoBountyReserveStatusDisbursed
	default:
		return repoBountyReserveStatusNone
	}
}

func normalizeRepoFileKind(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoFileKindReadme:
		return repoFileKindReadme
	case repoFileKindTaskInput:
		return repoFileKindTaskInput
	case repoFileKindOutput:
		return repoFileKindOutput
	case repoFileKindSensitive:
		return repoFileKindSensitive
	default:
		return ""
	}
}

func normalizeRepoFileVisibility(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoFileVisibilityAssignedValidators:
		return repoFileVisibilityAssignedValidators
	default:
		return repoFileVisibilityPublic
	}
}

func normalizeRepoVerdict(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoVerdictValid:
		return repoVerdictValid
	case repoVerdictNeedsRevision:
		return repoVerdictNeedsRevision
	case repoVerdictReject:
		return repoVerdictReject
	default:
		return ""
	}
}

func loadRepoMetaState(meta map[string]interface{}) repoMetaState {
	state := defaultRepoMetaState()
	if meta == nil {
		return state
	}

	raw, err := json.Marshal(meta)
	if err != nil {
		return state
	}
	_ = json.Unmarshal(raw, &state)

	state.WorkflowFamily = normalizeWorkflowFamily(state.WorkflowFamily)
	state.ProtocolMode = normalizeRepoMode(state.ProtocolMode)
	if state.WorkflowFamily == "" && state.ProtocolMode == repoProtocolModeV2 {
		state.WorkflowFamily = workspaceWorkflowFamily
	}
	state.CompletionMode = normalizeRepoCompletionMode(state.CompletionMode)
	state.ConsensusStatus = normalizeRepoConsensusStatus(state.ConsensusStatus)
	state.RepoStage = normalizeRepoStage(state.RepoStage)
	state.BountyReserveStatus = normalizeRepoBountyReserveStatus(state.BountyReserveStatus)
	state.BountyReserveOrderID = strings.TrimSpace(state.BountyReserveOrderID)
	if state.RepoFiles == nil {
		state.RepoFiles = []RepoCaseFileItem{}
	}
	if state.RepoApplicants == nil {
		state.RepoApplicants = []uint{}
	}
	if state.RepoAssignments == nil {
		state.RepoAssignments = []RepoAssignmentItem{}
	}
	if state.RepoVerdicts == nil {
		state.RepoVerdicts = []RepoVerdictItem{}
	}
	if state.RepoConfidenceVotes == nil {
		state.RepoConfidenceVotes = []RepoConfidenceVoteItem{}
	}
	return state
}

func isWorkspaceCaseMeta(meta map[string]interface{}) bool {
	return isWorkspaceMetaState(loadRepoMetaState(meta))
}

func cloneMeta(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return map[string]interface{}{}
	}
	out := make(map[string]interface{}, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func metaString(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return ""
	}
}

func mergeRepoMeta(existing map[string]interface{}, state repoMetaState) map[string]interface{} {
	meta := cloneMeta(existing)
	meta["workflow_family"] = workspaceWorkflowFamily
	meta["workflow_name"] = workspaceWorkflowName
	meta["completion_mode"] = normalizeRepoCompletionMode(state.CompletionMode)
	meta["consensus_status"] = normalizeRepoConsensusStatus(state.ConsensusStatus)
	meta["consensus_result"] = strings.TrimSpace(state.ConsensusResult)
	meta["workspace_stage"] = normalizeRepoStage(state.RepoStage)
	meta["repo_stage"] = normalizeRepoStage(state.RepoStage)
	meta["workspace_files"] = state.RepoFiles
	meta["repo_files"] = state.RepoFiles
	meta["workspace_applicants"] = state.RepoApplicants
	meta["repo_applicants"] = state.RepoApplicants
	meta["workspace_assignments"] = state.RepoAssignments
	meta["repo_assignments"] = state.RepoAssignments
	meta["workspace_verdicts"] = state.RepoVerdicts
	meta["repo_verdicts"] = state.RepoVerdicts
	meta["workspace_confidence_votes"] = state.RepoConfidenceVotes
	meta["repo_confidence_votes"] = state.RepoConfidenceVotes
	meta["workspace_bounty_reserve_order_id"] = strings.TrimSpace(state.BountyReserveOrderID)
	meta["repo_bounty_reserve_order_id"] = strings.TrimSpace(state.BountyReserveOrderID)
	meta["workspace_bounty_reserve_status"] = normalizeRepoBountyReserveStatus(state.BountyReserveStatus)
	meta["repo_bounty_reserve_status"] = normalizeRepoBountyReserveStatus(state.BountyReserveStatus)
	if state.RepoPayout != nil {
		meta["workspace_payout"] = state.RepoPayout
		meta["repo_payout"] = state.RepoPayout
	} else {
		delete(meta, "workspace_payout")
		delete(meta, "repo_payout")
	}

	// Keep legacy protocol marker only for old records that already used it.
	if normalizeRepoMode(metaString(meta["protocol_mode"])) == repoProtocolModeV2 {
		meta["protocol_mode"] = repoProtocolModeV2
	} else {
		delete(meta, "protocol_mode")
	}
	return sanitizeCaseMeta(meta)
}

func (s *EntValidationCaseRepoWorkflowService) getValidationCase(ctx context.Context, validationCaseID uint) (*ent.ValidationCase, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	state := loadRepoMetaState(vc.Meta)
	if !isWorkspaceMetaState(state) {
		return nil, apperrors.ErrInvalidInput.WithDetails("case ini menggunakan workflow legacy Consultation/Final Offer. Gunakan endpoint workflow legacy.")
	}
	return vc, nil
}

func (s *EntValidationCaseRepoWorkflowService) ensureRepoState(state repoMetaState) repoMetaState {
	state.WorkflowFamily = workspaceWorkflowFamily
	if normalizeRepoMode(state.ProtocolMode) != repoProtocolModeV2 {
		state.ProtocolMode = ""
	}
	state.CompletionMode = normalizeRepoCompletionMode(state.CompletionMode)
	state.ConsensusStatus = normalizeRepoConsensusStatus(state.ConsensusStatus)
	state.RepoStage = normalizeRepoStage(state.RepoStage)
	state.BountyReserveStatus = normalizeRepoBountyReserveStatus(state.BountyReserveStatus)
	state.BountyReserveOrderID = strings.TrimSpace(state.BountyReserveOrderID)
	if state.RepoConfidenceVotes == nil {
		state.RepoConfidenceVotes = []RepoConfidenceVoteItem{}
	}
	return state
}

func requiredStakeForRepoCase(vc *ent.ValidationCase) int64 {
	// Keep stake formula aligned with legacy consultation workflow:
	// S0=0, S1=100k, S2=500k, S3=bounty.
	return requiredStakeForConsultation(vc)
}

func (s *EntValidationCaseRepoWorkflowService) appendCaseLogBestEffort(
	ctx context.Context,
	validationCaseID int,
	actorUserID *int,
	eventType string,
	detail map[string]interface{},
) {
	create := s.client.ValidationCaseLog.Create().
		SetValidationCaseID(validationCaseID).
		SetEventType(strings.TrimSpace(eventType)).
		SetDetailJSON(detail)
	if actorUserID != nil && *actorUserID > 0 {
		create.SetActorUserID(*actorUserID)
	}
	if _, err := create.Save(ctx); err != nil {
		logger.Warn("Failed appending repo case log",
			zap.Int("validation_case_id", validationCaseID),
			zap.String("event_type", eventType),
			zap.Error(err),
		)
	}
}
