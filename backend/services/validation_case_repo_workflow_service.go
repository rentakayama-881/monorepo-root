package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
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
	BountyReserveOrderID string                   `json:"bounty_reserve_order_id,omitempty"`
	BountyReserveStatus  string                   `json:"bounty_reserve_status,omitempty"`
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

func containsUint(values []uint, target uint) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

func dedupeUint(values []uint) []uint {
	seen := make(map[uint]struct{}, len(values))
	out := make([]uint, 0, len(values))
	for _, v := range values {
		if v == 0 {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func validatorIDSet(values []uint) map[uint]struct{} {
	set := make(map[uint]struct{}, len(values))
	for _, id := range values {
		if id == 0 {
			continue
		}
		set[id] = struct{}{}
	}
	return set
}

func validatorPairKey(a uint, b uint) string {
	if a > b {
		a, b = b, a
	}
	return fmt.Sprintf("%d:%d", a, b)
}

func activeAssignmentValidatorIDs(assignments []RepoAssignmentItem) []uint {
	out := make([]uint, 0, len(assignments))
	for _, asn := range assignments {
		if strings.EqualFold(strings.TrimSpace(asn.Status), repoAssignmentStatusActive) && asn.ValidatorUserID > 0 {
			out = append(out, asn.ValidatorUserID)
		}
	}
	return dedupeUint(out)
}

func activeValidatorOutputCounts(files []RepoCaseFileItem, assignments []RepoAssignmentItem) map[uint]int {
	activeSet := validatorIDSet(activeAssignmentValidatorIDs(assignments))
	out := make(map[uint]int, len(activeSet))
	for _, file := range files {
		if normalizeRepoFileKind(file.Kind) != repoFileKindOutput {
			continue
		}
		if _, ok := activeSet[file.UploadedBy]; !ok {
			continue
		}
		out[file.UploadedBy]++
	}
	return out
}

func hasValidatorUploadedOutput(files []RepoCaseFileItem, validatorUserID uint) bool {
	for _, file := range files {
		if normalizeRepoFileKind(file.Kind) != repoFileKindOutput {
			continue
		}
		if file.UploadedBy == validatorUserID {
			return true
		}
	}
	return false
}

func normalizeConfidenceVotes(votes []RepoConfidenceVoteItem, validValidatorIDs map[uint]struct{}) []RepoConfidenceVoteItem {
	if len(votes) == 0 {
		return []RepoConfidenceVoteItem{}
	}

	latestByVoter := make(map[uint]RepoConfidenceVoteItem, len(votes))
	for _, vote := range votes {
		if vote.VoterUserID == 0 || vote.ValidatorUserID == 0 {
			continue
		}
		if len(validValidatorIDs) > 0 {
			if _, ok := validValidatorIDs[vote.ValidatorUserID]; !ok {
				continue
			}
		}
		prev, exists := latestByVoter[vote.VoterUserID]
		if !exists || vote.VotedAt >= prev.VotedAt {
			latestByVoter[vote.VoterUserID] = vote
		}
	}

	out := make([]RepoConfidenceVoteItem, 0, len(latestByVoter))
	for _, vote := range latestByVoter {
		out = append(out, vote)
	}
	return out
}

func confidenceVoteCountByValidator(votes []RepoConfidenceVoteItem) map[uint]int {
	counts := make(map[uint]int)
	for _, vote := range votes {
		if vote.ValidatorUserID == 0 {
			continue
		}
		counts[vote.ValidatorUserID]++
	}
	return counts
}

func viewerConfidenceVote(votes []RepoConfidenceVoteItem, viewerUserID uint) *uint {
	if viewerUserID == 0 {
		return nil
	}
	for _, vote := range votes {
		if vote.VoterUserID != viewerUserID {
			continue
		}
		id := vote.ValidatorUserID
		return &id
	}
	return nil
}

func shouldSyncWorkspaceFileSharing(file RepoCaseFileItem) bool {
	switch normalizeRepoFileKind(file.Kind) {
	case repoFileKindReadme, repoFileKindTaskInput, repoFileKindSensitive, repoFileKindOutput:
		return strings.TrimSpace(file.DocumentID) != ""
	default:
		return false
	}
}

func (s *EntValidationCaseRepoWorkflowService) isAssignedValidator(validatorUserID uint, assignments []RepoAssignmentItem) bool {
	for _, it := range assignments {
		if it.ValidatorUserID == validatorUserID && strings.EqualFold(it.Status, repoAssignmentStatusActive) {
			return true
		}
	}
	return false
}

func (s *EntValidationCaseRepoWorkflowService) workspaceFileShareTargets(
	vc *ent.ValidationCase,
	state repoMetaState,
	file RepoCaseFileItem,
) []uint {
	if vc == nil {
		return []uint{}
	}

	assignedValidatorIDs := activeAssignmentValidatorIDs(state.RepoAssignments)
	kind := normalizeRepoFileKind(file.Kind)
	targets := make([]uint, 0, len(assignedValidatorIDs)+1)

	switch kind {
	case repoFileKindSensitive, repoFileKindReadme, repoFileKindTaskInput:
		targets = append(targets, assignedValidatorIDs...)
	case repoFileKindOutput:
		targets = append(targets, uint(vc.UserID))
		targets = append(targets, assignedValidatorIDs...)
	default:
		return []uint{}
	}

	filtered := make([]uint, 0, len(targets))
	for _, id := range dedupeUint(targets) {
		if id == 0 || id == file.UploadedBy {
			continue
		}
		filtered = append(filtered, id)
	}
	return dedupeUint(filtered)
}

func (s *EntValidationCaseRepoWorkflowService) updateWorkspaceDocumentSharing(
	ctx context.Context,
	authHeader string,
	documentID string,
	sharedWithUserIDs []uint,
) error {
	documentID = strings.TrimSpace(documentID)
	authHeader = strings.TrimSpace(authHeader)
	if documentID == "" || authHeader == "" {
		return nil
	}

	url := fmt.Sprintf("%s/api/v1/documents/%s/sharing", strings.TrimRight(config.FeatureServiceURL, "/"), documentID)
	payload := map[string]interface{}{
		"sharedWithUserIds": dedupeUint(sharedWithUserIDs),
	}
	b, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var body map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&body)
		if msg, ok := body["error"].(string); ok && strings.TrimSpace(msg) != "" {
			return fmt.Errorf("feature-service: %s", msg)
		}
		return fmt.Errorf("feature-service: gagal update sharing document (status %d)", resp.StatusCode)
	}
	return nil
}

func (s *EntValidationCaseRepoWorkflowService) syncWorkspaceFileSharing(
	ctx context.Context,
	authHeader string,
	vc *ent.ValidationCase,
	state repoMetaState,
	file RepoCaseFileItem,
) error {
	if !shouldSyncWorkspaceFileSharing(file) {
		return nil
	}
	targets := s.workspaceFileShareTargets(vc, state, file)
	return s.updateWorkspaceDocumentSharing(ctx, authHeader, file.DocumentID, targets)
}

func (s *EntValidationCaseRepoWorkflowService) countActiveRepoAssignmentsForValidators(
	ctx context.Context,
	validatorUserIDs []uint,
) (map[uint]int, error) {
	targets := validatorIDSet(validatorUserIDs)
	counts := make(map[uint]int, len(targets))

	cases, err := s.client.ValidationCase.Query().
		Where(validationcase.StatusNEQ(caseStatusCompleted)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	for _, vc := range cases {
		state := loadRepoMetaState(vc.Meta)
		if !isWorkspaceMetaState(state) {
			continue
		}
		if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
			continue
		}
		for _, validatorID := range activeAssignmentValidatorIDs(state.RepoAssignments) {
			if len(targets) > 0 {
				if _, ok := targets[validatorID]; !ok {
					continue
				}
			}
			counts[validatorID]++
		}
	}
	return counts, nil
}

func (s *EntValidationCaseRepoWorkflowService) countActiveRepoAssignmentsForValidator(ctx context.Context, validatorUserID uint) (int, error) {
	counts, err := s.countActiveRepoAssignmentsForValidators(ctx, []uint{validatorUserID})
	if err != nil {
		return 0, err
	}
	return counts[validatorUserID], nil
}

func (s *EntValidationCaseRepoWorkflowService) buildRecentPanelPairSet(
	ctx context.Context,
	currentValidationCaseID uint,
	cutoff time.Time,
) (map[string]struct{}, error) {
	pairSet := make(map[string]struct{})

	cases, err := s.client.ValidationCase.Query().
		Where(validationcase.CreatedAtGTE(cutoff)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	for _, vc := range cases {
		if uint(vc.ID) == currentValidationCaseID {
			continue
		}
		state := loadRepoMetaState(vc.Meta)
		if !isWorkspaceMetaState(state) {
			continue
		}

		ids := activeAssignmentValidatorIDs(state.RepoAssignments)
		for i := 0; i < len(ids); i++ {
			for j := i + 1; j < len(ids); j++ {
				pairSet[validatorPairKey(ids[i], ids[j])] = struct{}{}
			}
		}
	}
	return pairSet, nil
}

func (s *EntValidationCaseRepoWorkflowService) pairSeenInRecentPanels(
	ctx context.Context,
	currentValidationCaseID uint,
	validatorA uint,
	validatorB uint,
	cutoff time.Time,
) (bool, error) {
	pairSet, err := s.buildRecentPanelPairSet(ctx, currentValidationCaseID, cutoff)
	if err != nil {
		return false, err
	}
	if _, seen := pairSet[validatorPairKey(validatorA, validatorB)]; seen {
		return true, nil
	}
	return false, nil
}

func repoFileRequirements(files []RepoCaseFileItem) (bool, bool) {
	hasReadme := false
	hasTaskInput := false
	for _, file := range files {
		switch normalizeRepoFileKind(file.Kind) {
		case repoFileKindReadme:
			hasReadme = true
		case repoFileKindTaskInput:
			hasTaskInput = true
		}
	}
	return hasReadme, hasTaskInput
}

func validationCaseHasReadmeContent(vc *ent.ValidationCase) bool {
	if vc == nil || vc.ContentJSON == nil {
		return false
	}
	caseRecord := strings.TrimSpace(metaString(vc.ContentJSON["case_record_text"]))
	if caseRecord != "" {
		return true
	}

	// Fallback for older payload shapes where free text was stored directly.
	contentText := strings.TrimSpace(metaString(vc.ContentJSON["text"]))
	return contentText != ""
}

func latestVerdictsByValidator(verdicts []RepoVerdictItem, activeAssignments []RepoAssignmentItem) map[uint]RepoVerdictItem {
	active := make(map[uint]struct{}, len(activeAssignments))
	for _, asn := range activeAssignments {
		if strings.EqualFold(asn.Status, repoAssignmentStatusActive) {
			active[asn.ValidatorUserID] = struct{}{}
		}
	}

	out := make(map[uint]RepoVerdictItem)
	for _, item := range verdicts {
		if _, ok := active[item.ValidatorUserID]; !ok {
			continue
		}
		prev, exists := out[item.ValidatorUserID]
		if !exists || item.SubmittedAt >= prev.SubmittedAt {
			out[item.ValidatorUserID] = item
		}
	}
	return out
}

func requiredVotesByMode(mode string) int {
	if normalizeRepoCompletionMode(mode) == repoCompletionPanel10 {
		return 10
	}
	return 3
}

func normalizeRequestedPanelSize(panelSize int) int {
	if panelSize == 10 {
		return 10
	}
	return 3
}

func shuffledUint(values []uint) []uint {
	out := append([]uint(nil), values...)
	if len(out) <= 1 {
		return out
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(len(out), func(i, j int) {
		out[i], out[j] = out[j], out[i]
	})
	return out
}

func consensusBreakdown(latest map[uint]RepoVerdictItem) map[string]int {
	breakdown := map[string]int{
		repoVerdictValid:         0,
		repoVerdictNeedsRevision: 0,
		repoVerdictReject:        0,
	}
	for _, v := range latest {
		key := normalizeRepoVerdict(v.Verdict)
		if key == "" {
			continue
		}
		breakdown[key]++
	}
	return breakdown
}

func consensusWinner(breakdown map[string]int) (string, int, int) {
	winner := ""
	maxCount := -1
	second := -1
	keys := []string{repoVerdictValid, repoVerdictNeedsRevision, repoVerdictReject}
	for _, key := range keys {
		v := breakdown[key]
		if v > maxCount {
			second = maxCount
			maxCount = v
			winner = key
			continue
		}
		if v > second {
			second = v
		}
	}
	if second < 0 {
		second = 0
	}
	return winner, maxCount, second
}

func buildRepoPayoutLedger(bounty int64, winner string, latest map[uint]RepoVerdictItem) *RepoPayoutLedger {
	if bounty <= 0 || len(latest) == 0 {
		return nil
	}

	validatorIDs := make([]uint, 0, len(latest))
	for validatorID := range latest {
		validatorIDs = append(validatorIDs, validatorID)
	}
	sort.Slice(validatorIDs, func(i, j int) bool { return validatorIDs[i] < validatorIDs[j] })

	basePool := (bounty * 70) / 100
	qualityPool := (bounty * 20) / 100
	chainPool := bounty - basePool - qualityPool

	n := int64(len(validatorIDs))
	basePer := int64(0)
	baseRemainder := int64(0)
	if n > 0 {
		basePer = basePool / n
		baseRemainder = basePool % n
	}

	chainPer := int64(0)
	chainRemainder := int64(0)
	if n > 0 {
		chainPer = chainPool / n
		chainRemainder = chainPool % n
	}

	points := make(map[uint]int64, len(validatorIDs))
	totalPoints := int64(0)
	for _, validatorID := range validatorIDs {
		verdict := latest[validatorID]
		if normalizeRepoVerdict(verdict.Verdict) == winner {
			p := int64(verdict.Confidence)
			if p < 1 {
				p = 1
			}
			points[validatorID] = p
			totalPoints += p
			continue
		}
		points[validatorID] = 0
	}

	qualityByValidator := make(map[uint]int64, len(validatorIDs))
	qualityAssigned := int64(0)
	if totalPoints <= 0 && n > 0 {
		qPer := qualityPool / n
		qRem := qualityPool % n
		for i, validatorID := range validatorIDs {
			qualityByValidator[validatorID] = qPer
			if int64(i) < qRem {
				qualityByValidator[validatorID]++
			}
			qualityAssigned += qualityByValidator[validatorID]
		}
	} else if totalPoints > 0 {
		for _, validatorID := range validatorIDs {
			share := (qualityPool * points[validatorID]) / totalPoints
			qualityByValidator[validatorID] = share
			qualityAssigned += share
		}
		remaining := qualityPool - qualityAssigned
		for i := 0; i < len(validatorIDs) && remaining > 0; i++ {
			qualityByValidator[validatorIDs[i]]++
			remaining--
		}
	}

	entries := make([]RepoPayoutEntry, 0, len(validatorIDs))
	for i, validatorID := range validatorIDs {
		baseAmount := basePer
		if int64(i) < baseRemainder {
			baseAmount++
		}
		chainLocked := chainPer
		if int64(i) < chainRemainder {
			chainLocked++
		}
		entries = append(entries, RepoPayoutEntry{
			ValidatorUserID: validatorID,
			BaseAmount:      baseAmount,
			QualityAmount:   qualityByValidator[validatorID],
			ChainLocked:     chainLocked,
			ChainStatus:     repoChainStatusLocked,
		})
	}

	return &RepoPayoutLedger{
		BountyAmount: bounty,
		BasePool:     basePool,
		QualityPool:  qualityPool,
		ChainPool:    chainPool,
		Entries:      entries,
		CreatedAt:    time.Now().Unix(),
	}
}

func (s *EntValidationCaseRepoWorkflowService) unlockChainVestingForValidator(
	ctx context.Context,
	validatorUserID uint,
	currentValidationCaseID uint,
) {
	cases, err := s.client.ValidationCase.Query().
		Where(validationcase.StatusEQ(caseStatusCompleted)).
		All(ctx)
	if err != nil {
		return
	}

	for _, vc := range cases {
		if uint(vc.ID) == currentValidationCaseID {
			continue
		}
		state := loadRepoMetaState(vc.Meta)
		if !isWorkspaceMetaState(state) || state.RepoPayout == nil {
			continue
		}

		changed := false
		for i := range state.RepoPayout.Entries {
			entry := &state.RepoPayout.Entries[i]
			if entry.ValidatorUserID != validatorUserID {
				continue
			}
			if !strings.EqualFold(entry.ChainStatus, repoChainStatusLocked) || entry.ChainLocked <= 0 {
				continue
			}
			entry.ChainUnlocked += entry.ChainLocked
			entry.ChainLocked = 0
			entry.ChainStatus = repoChainStatusUnlocked
			changed = true
		}
		if !changed {
			continue
		}

		meta := mergeRepoMeta(vc.Meta, state)
		if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
			continue
		}
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "repo_chain_vesting_unlocked", map[string]interface{}{
			"validator_user_id": validatorUserID,
			"source_case_id":    currentValidationCaseID,
		})
	}
}

func (s *EntValidationCaseRepoWorkflowService) userSummariesByID(
	ctx context.Context,
	userIDs []uint,
) (map[uint]UserSummary, error) {
	out := make(map[uint]UserSummary)
	userIDs = dedupeUint(userIDs)
	if len(userIDs) == 0 {
		return out, nil
	}

	intIDs := make([]int, 0, len(userIDs))
	for _, id := range userIDs {
		intIDs = append(intIDs, int(id))
	}
	users, err := s.client.User.Query().
		Where(user.IDIn(intIDs...)).
		WithPrimaryBadge().
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	for _, u := range users {
		out[uint(u.ID)] = buildUserSummaryFromEnt(u)
	}
	return out, nil
}

func (s *EntValidationCaseRepoWorkflowService) buildRepoTreeResponse(
	ctx context.Context,
	vc *ent.ValidationCase,
	state repoMetaState,
	viewerUserID uint,
) (*RepoTreeResponse, error) {
	isOwner := vc.UserID == int(viewerUserID)
	isAssigned := s.isAssignedValidator(viewerUserID, state.RepoAssignments)
	hasReadmeFile, hasTaskInput := repoFileRequirements(state.RepoFiles)
	hasReadme := hasReadmeFile || validationCaseHasReadmeContent(vc)
	requiredStake := requiredStakeForRepoCase(vc)

	userIDs := make([]uint, 0, len(state.RepoApplicants)+len(state.RepoAssignments)+len(state.RepoVerdicts)+len(state.RepoFiles)+len(state.RepoConfidenceVotes)*2+1)
	userIDs = append(userIDs, state.RepoApplicants...)
	userIDs = append(userIDs, uint(vc.UserID))
	for _, asn := range state.RepoAssignments {
		userIDs = append(userIDs, asn.ValidatorUserID)
	}
	for _, verdict := range state.RepoVerdicts {
		userIDs = append(userIDs, verdict.ValidatorUserID)
	}
	for _, file := range state.RepoFiles {
		userIDs = append(userIDs, file.UploadedBy)
	}
	for _, vote := range state.RepoConfidenceVotes {
		userIDs = append(userIDs, vote.VoterUserID, vote.ValidatorUserID)
	}
	summaries, err := s.userSummariesByID(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	files := make([]RepoCaseFileView, 0, len(state.RepoFiles))
	for _, file := range state.RepoFiles {
		kind := normalizeRepoFileKind(file.Kind)
		visibility := normalizeRepoFileVisibility(file.Visibility)
		restrictedToAssignments := visibility == repoFileVisibilityAssignedValidators
		if restrictedToAssignments && !isOwner && !isAssigned {
			continue
		}
		if kind == repoFileKindSensitive && !isOwner && !isAssigned {
			continue
		}
		item := file
		item.Kind = kind
		item.Visibility = visibility
		uploadedBy := summaries[item.UploadedBy]
		if uploadedBy.ID == 0 {
			uploadedBy = UserSummary{ID: item.UploadedBy}
		}
		files = append(files, RepoCaseFileView{
			ID:             item.ID,
			DocumentID:     item.DocumentID,
			Kind:           item.Kind,
			Label:          item.Label,
			Visibility:     item.Visibility,
			UploadedBy:     item.UploadedBy,
			UploadedByUser: uploadedBy,
			UploadedAt:     item.UploadedAt,
		})
	}

	applicants := make([]UserSummary, 0, len(state.RepoApplicants))
	for _, userID := range state.RepoApplicants {
		if summary, ok := summaries[userID]; ok {
			applicants = append(applicants, summary)
			continue
		}
		applicants = append(applicants, UserSummary{ID: userID})
	}

	assignments := make([]RepoAssignmentView, 0, len(state.RepoAssignments))
	for _, item := range state.RepoAssignments {
		summary, ok := summaries[item.ValidatorUserID]
		if !ok {
			summary = UserSummary{ID: item.ValidatorUserID}
		}
		assignments = append(assignments, RepoAssignmentView{
			Validator:  summary,
			Status:     strings.ToLower(strings.TrimSpace(item.Status)),
			AssignedAt: item.AssignedAt,
		})
	}

	verdicts := make([]RepoVerdictView, 0, len(state.RepoVerdicts))
	for _, item := range state.RepoVerdicts {
		summary, ok := summaries[item.ValidatorUserID]
		if !ok {
			summary = UserSummary{ID: item.ValidatorUserID}
		}
		verdicts = append(verdicts, RepoVerdictView{
			Validator:   summary,
			Verdict:     normalizeRepoVerdict(item.Verdict),
			Confidence:  item.Confidence,
			Notes:       item.Notes,
			DocumentID:  item.DocumentID,
			SubmittedAt: item.SubmittedAt,
		})
	}

	activeAssignedIDs := activeAssignmentValidatorIDs(state.RepoAssignments)
	activeAssignedSet := validatorIDSet(activeAssignedIDs)
	normalizedVotes := normalizeConfidenceVotes(state.RepoConfidenceVotes, activeAssignedSet)
	voteCountByValidator := confidenceVoteCountByValidator(normalizedVotes)
	viewerVote := viewerConfidenceVote(normalizedVotes, viewerUserID)
	outputCountByValidator := activeValidatorOutputCounts(state.RepoFiles, state.RepoAssignments)
	uploadedValidatorCount := len(outputCountByValidator)

	confidenceScores := make([]RepoConfidenceScore, 0, len(activeAssignedIDs))
	for _, validatorID := range activeAssignedIDs {
		summary, ok := summaries[validatorID]
		if !ok {
			summary = UserSummary{ID: validatorID}
		}
		_, hasOutput := outputCountByValidator[validatorID]
		viewerVoted := viewerVote != nil && *viewerVote == validatorID
		confidenceScores = append(confidenceScores, RepoConfidenceScore{
			Validator:         summary,
			Votes:             voteCountByValidator[validatorID],
			ViewerVoted:       viewerVoted,
			HasUploadedOutput: hasOutput,
		})
	}
	sort.SliceStable(confidenceScores, func(i, j int) bool {
		if confidenceScores[i].Votes == confidenceScores[j].Votes {
			return confidenceScores[i].Validator.ID < confidenceScores[j].Validator.ID
		}
		return confidenceScores[i].Votes > confidenceScores[j].Votes
	})

	viewerStake := int64(0)
	if viewerUserID > 0 {
		if summary, ok := summaries[viewerUserID]; ok {
			viewerStake = summary.GuaranteeAmount
		} else {
			viewer, err := s.client.User.Get(ctx, int(viewerUserID))
			if err != nil && !ent.IsNotFound(err) {
				return nil, apperrors.ErrDatabase
			}
			if err == nil && viewer != nil {
				viewerStake = viewer.GuaranteeAmount
			}
		}
	}
	stakeEligible := requiredStake <= 0 || viewerStake >= requiredStake
	canFinalize := isOwner &&
		normalizeRepoStage(state.RepoStage) != repoStageFinalized &&
		uploadedValidatorCount >= repoMinimumValidatorUploads

	return &RepoTreeResponse{
		CaseID:                          uint(vc.ID),
		WorkflowFamily:                  workspaceWorkflowFamily,
		WorkflowName:                    workspaceWorkflowName,
		ProtocolMode:                    normalizeRepoMode(state.ProtocolMode),
		WorkspaceStage:                  normalizeRepoStage(state.RepoStage),
		RepoStage:                       normalizeRepoStage(state.RepoStage),
		CompletionMode:                  normalizeRepoCompletionMode(state.CompletionMode),
		ConsensusStatus:                 normalizeRepoConsensusStatus(state.ConsensusStatus),
		ConsensusResult:                 strings.TrimSpace(state.ConsensusResult),
		RequiredStake:                   requiredStake,
		ViewerStake:                     viewerStake,
		StakeEligible:                   stakeEligible,
		CanPublish:                      false,
		HasRequiredReadme:               hasReadme,
		HasTaskInput:                    hasTaskInput,
		IsOwner:                         isOwner,
		IsAssignedValidator:             isAssigned,
		Files:                           files,
		Applicants:                      applicants,
		Assignments:                     assignments,
		Verdicts:                        verdicts,
		ConfidenceScores:                confidenceScores,
		ViewerConfidenceVoteValidatorID: viewerVote,
		MinimumValidatorUploads:         repoMinimumValidatorUploads,
		UploadedValidatorCount:          uploadedValidatorCount,
		CanFinalize:                     canFinalize,
		Payout:                          state.RepoPayout,
	}, nil
}

func (s *EntValidationCaseRepoWorkflowService) ensureActorCanEditRepoFiles(
	vc *ent.ValidationCase,
	state repoMetaState,
	actorUserID uint,
	fileKind string,
) error {
	isOwner := vc.UserID == int(actorUserID)
	isAssigned := s.isAssignedValidator(actorUserID, state.RepoAssignments)

	switch normalizeRepoFileKind(fileKind) {
	case repoFileKindReadme, repoFileKindTaskInput, repoFileKindSensitive:
		if !isOwner {
			return apperrors.ErrValidationCaseOwnership
		}
	case repoFileKindOutput:
		if !isAssigned {
			return apperrors.ErrInvalidInput.WithDetails("hanya validator terpilih yang dapat mengunggah validator_output")
		}
	default:
		return apperrors.ErrInvalidInput.WithDetails("kind file tidak dikenali")
	}
	return nil
}

func (s *EntValidationCaseRepoWorkflowService) AttachRepoFile(
	ctx context.Context,
	validationCaseID uint,
	actorUserID uint,
	documentID string,
	kind string,
	label string,
	visibility string,
	authHeader string,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}

	documentID = strings.TrimSpace(documentID)
	label = strings.TrimSpace(label)
	kind = normalizeRepoFileKind(kind)
	if documentID == "" {
		return nil, apperrors.ErrMissingField.WithDetails("document_id")
	}
	if kind == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("kind harus case_readme, task_input, validator_output, atau sensitive_context")
	}
	if label == "" {
		return nil, apperrors.ErrMissingField.WithDetails("label")
	}
	if len(label) > 120 {
		return nil, apperrors.ErrInvalidInput.WithDetails("label maksimal 120 karakter")
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized, tidak dapat menambah file baru")
	}
	if err := s.ensureActorCanEditRepoFiles(vc, state, actorUserID, kind); err != nil {
		return nil, err
	}

	fileVisibility := normalizeRepoFileVisibility(visibility)
	if kind == repoFileKindSensitive {
		fileVisibility = repoFileVisibilityAssignedValidators
	}

	item := RepoCaseFileItem{
		ID:         fmt.Sprintf("rcf_%d_%d", time.Now().UnixNano(), actorUserID),
		DocumentID: documentID,
		Kind:       kind,
		Label:      label,
		Visibility: fileVisibility,
		UploadedBy: actorUserID,
		UploadedAt: time.Now().Unix(),
	}

	state.RepoFiles = append(state.RepoFiles, item)
	if err := s.syncWorkspaceFileSharing(ctx, authHeader, vc, state, item); err != nil {
		return nil, apperrors.ErrInvalidInput.WithDetails(err.Error())
	}

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(actorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_file_attached", map[string]interface{}{
		"document_id": item.DocumentID,
		"kind":        item.Kind,
		"label":       item.Label,
		"visibility":  item.Visibility,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, actorUserID)
}

func (s *EntValidationCaseRepoWorkflowService) GetRepoTree(
	ctx context.Context,
	validationCaseID uint,
	viewerUserID uint,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	return s.buildRepoTreeResponse(ctx, vc, state, viewerUserID)
}

func (s *EntValidationCaseRepoWorkflowService) PublishRepoCase(
	ctx context.Context,
	validationCaseID uint,
	ownerUserID uint,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	state.RepoStage = repoStageReady
	state.ConsensusStatus = repoConsensusPending

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetMeta(meta).
		SetStatus(caseStatusOpen).
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_case_ready", map[string]interface{}{
		"repo_stage": state.RepoStage,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, ownerUserID)
}

func (s *EntValidationCaseRepoWorkflowService) ApplyForRepoValidation(
	ctx context.Context,
	validationCaseID uint,
	validatorUserID uint,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	if vc.UserID == int(validatorUserID) {
		return nil, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat apply sebagai validator")
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}
	if containsUint(state.RepoApplicants, validatorUserID) || s.isAssignedValidator(validatorUserID, state.RepoAssignments) {
		return s.buildRepoTreeResponse(ctx, vc, state, validatorUserID)
	}

	validator, err := s.client.User.Get(ctx, int(validatorUserID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	requiredStake := requiredStakeForRepoCase(vc)
	if validator.GuaranteeAmount < requiredStake {
		actor := int(validatorUserID)
		s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_validator_apply_rejected_stake", map[string]interface{}{
			"validator_user_id": validatorUserID,
			"required_stake":    requiredStake,
			"validator_stake":   validator.GuaranteeAmount,
			"sensitivity_level": strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)),
		})
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf(
				"Credibility Stake tidak memenuhi syarat untuk sensitivity %s. Minimal Rp %d",
				strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)),
				requiredStake,
			),
		)
	}

	state.RepoApplicants = append(state.RepoApplicants, validatorUserID)
	state.RepoApplicants = dedupeUint(state.RepoApplicants)

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_validator_applied", map[string]interface{}{
		"validator_user_id": validatorUserID,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, validatorUserID)
}

func (s *EntValidationCaseRepoWorkflowService) AssignRepoValidators(
	ctx context.Context,
	validationCaseID uint,
	ownerUserID uint,
	validatorUserIDs []uint,
	panelSize int,
	authHeader string,
) (*RepoTreeResponse, error) {
	_ = panelSize
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}

	validatorUserIDs = dedupeUint(validatorUserIDs)
	if len(validatorUserIDs) == 0 {
		return nil, apperrors.ErrMissingField.WithDetails("validator_user_ids")
	}

	filtered := make([]uint, 0, len(validatorUserIDs))
	for _, id := range validatorUserIDs {
		if id == 0 || id == ownerUserID {
			continue
		}
		if !containsUint(state.RepoApplicants, id) && !s.isAssignedValidator(id, state.RepoAssignments) {
			continue
		}
		filtered = append(filtered, id)
	}
	if len(filtered) == 0 {
		return nil, apperrors.ErrInvalidInput.WithDetails("validator terpilih tidak valid. Pastikan validator sudah apply.")
	}

	requiredStake := requiredStakeForRepoCase(vc)
	intIDs := make([]int, 0, len(filtered))
	for _, id := range filtered {
		intIDs = append(intIDs, int(id))
	}
	usersByID := make(map[uint]*ent.User)
	if len(intIDs) > 0 {
		users, qErr := s.client.User.Query().Where(user.IDIn(intIDs...)).All(ctx)
		if qErr != nil {
			return nil, apperrors.ErrDatabase
		}
		for _, u := range users {
			usersByID[uint(u.ID)] = u
		}
	}
	for _, id := range filtered {
		validator := usersByID[id]
		if validator == nil {
			return nil, apperrors.ErrUserNotFound.WithDetails(fmt.Sprintf("validator %d tidak ditemukan", id))
		}
		if validator.GuaranteeAmount < requiredStake {
			actor := int(ownerUserID)
			s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_validator_assign_rejected_stake", map[string]interface{}{
				"validator_user_id": id,
				"required_stake":    requiredStake,
				"validator_stake":   validator.GuaranteeAmount,
				"sensitivity_level": strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)),
			})
			return nil, apperrors.ErrInvalidInput.WithDetails(
				fmt.Sprintf(
					"Validator %d tidak memenuhi Credibility Stake untuk sensitivity %s (minimal Rp %d)",
					id,
					strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)),
					requiredStake,
				),
			)
		}
	}

	existingAssignedSet := validatorIDSet(activeAssignmentValidatorIDs(state.RepoAssignments))
	now := time.Now().Unix()
	nextAssignments := append([]RepoAssignmentItem(nil), state.RepoAssignments...)
	for _, id := range filtered {
		if _, exists := existingAssignedSet[id]; exists {
			continue
		}
		nextAssignments = append(nextAssignments, RepoAssignmentItem{
			ValidatorUserID: id,
			Status:          repoAssignmentStatusActive,
			AssignedAt:      now,
		})
	}
	state.RepoAssignments = nextAssignments
	if len(activeAssignmentValidatorIDs(state.RepoAssignments)) > 0 {
		state.RepoStage = repoStageInReview
	} else {
		state.RepoStage = repoStageReady
	}
	if normalizeRepoStage(state.RepoStage) != repoStageFinalized {
		state.ConsensusStatus = repoConsensusPending
		state.ConsensusResult = ""
	}

	activeSet := validatorIDSet(activeAssignmentValidatorIDs(state.RepoAssignments))
	state.RepoConfidenceVotes = normalizeConfidenceVotes(state.RepoConfidenceVotes, activeSet)

	remainingApplicants := make([]uint, 0, len(state.RepoApplicants))
	for _, id := range state.RepoApplicants {
		if _, assigned := activeSet[id]; assigned {
			continue
		}
		remainingApplicants = append(remainingApplicants, id)
	}
	state.RepoApplicants = dedupeUint(remainingApplicants)

	for _, file := range state.RepoFiles {
		if file.UploadedBy != ownerUserID {
			continue
		}
		if err := s.syncWorkspaceFileSharing(ctx, authHeader, vc, state, file); err != nil {
			return nil, apperrors.ErrInvalidInput.WithDetails(err.Error())
		}
	}

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_validators_assigned", map[string]interface{}{
		"validator_user_ids": filtered,
		"total_assignments":  len(activeAssignmentValidatorIDs(state.RepoAssignments)),
	})

	return s.buildRepoTreeResponse(ctx, vc, state, ownerUserID)
}

func (s *EntValidationCaseRepoWorkflowService) AutoAssignRepoValidators(
	ctx context.Context,
	validationCaseID uint,
	ownerUserID uint,
	panelSize int,
	authHeader string,
) (*RepoTreeResponse, error) {
	_ = ctx
	_ = validationCaseID
	_ = ownerUserID
	_ = panelSize
	_ = authHeader
	return nil, apperrors.ErrInvalidInput.WithDetails("auto-match validator sudah dihapus. Owner harus assign validator secara manual.")
}

func buildConfidenceBreakdownByValidator(
	assignments []RepoAssignmentItem,
	votes []RepoConfidenceVoteItem,
) map[string]int {
	activeSet := validatorIDSet(activeAssignmentValidatorIDs(assignments))
	normalized := normalizeConfidenceVotes(votes, activeSet)
	countByValidator := confidenceVoteCountByValidator(normalized)
	breakdown := make(map[string]int, len(countByValidator))
	for validatorID, count := range countByValidator {
		breakdown[fmt.Sprintf("validator_%d", validatorID)] = count
	}
	return breakdown
}

func (s *EntValidationCaseRepoWorkflowService) buildConsensusResponse(
	validationCaseID uint,
	state repoMetaState,
) *RepoConsensusResponse {
	uploadedCount := len(activeValidatorOutputCounts(state.RepoFiles, state.RepoAssignments))
	return &RepoConsensusResponse{
		CaseID:          validationCaseID,
		CompletionMode:  normalizeRepoCompletionMode(state.CompletionMode),
		ConsensusStatus: normalizeRepoConsensusStatus(state.ConsensusStatus),
		ConsensusResult: strings.TrimSpace(state.ConsensusResult),
		RequiredVotes:   repoMinimumValidatorUploads,
		SubmittedVotes:  uploadedCount,
		Breakdown:       buildConfidenceBreakdownByValidator(state.RepoAssignments, state.RepoConfidenceVotes),
		Payout:          state.RepoPayout,
	}
}

func (s *EntValidationCaseRepoWorkflowService) SubmitRepoVerdict(
	ctx context.Context,
	validationCaseID uint,
	validatorUserID uint,
	verdict string,
	confidence int,
	notes string,
	documentID string,
) (*RepoConsensusResponse, error) {
	_ = ctx
	_ = validationCaseID
	_ = validatorUserID
	_ = verdict
	_ = confidence
	_ = notes
	_ = documentID
	return nil, apperrors.ErrInvalidInput.WithDetails("submit verdict sudah tidak digunakan. Gunakan upload validator_output + confidence vote.")
}

func splitAmountEvenly(total int64, winnerIDs []uint) map[uint]int64 {
	out := make(map[uint]int64, len(winnerIDs))
	if total <= 0 || len(winnerIDs) == 0 {
		return out
	}
	base := total / int64(len(winnerIDs))
	remainder := total % int64(len(winnerIDs))
	for i, id := range winnerIDs {
		amount := base
		if int64(i) < remainder {
			amount++
		}
		out[id] = amount
	}
	return out
}

func sortedKeysUint(m map[uint]int) []uint {
	keys := make([]uint, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
	return keys
}

func (s *EntValidationCaseRepoWorkflowService) VoteRepoValidatorConfidence(
	ctx context.Context,
	validationCaseID uint,
	voterUserID uint,
	validatorUserID uint,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}
	if !s.isAssignedValidator(validatorUserID, state.RepoAssignments) {
		return nil, apperrors.ErrInvalidInput.WithDetails("validator belum diassign owner")
	}

	activeSet := validatorIDSet(activeAssignmentValidatorIDs(state.RepoAssignments))
	if _, ok := activeSet[validatorUserID]; !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("validator tidak aktif pada case ini")
	}

	now := time.Now().Unix()
	nextVotes := make([]RepoConfidenceVoteItem, 0, len(state.RepoConfidenceVotes)+1)
	updated := false
	for _, vote := range normalizeConfidenceVotes(state.RepoConfidenceVotes, activeSet) {
		if vote.VoterUserID == voterUserID {
			nextVotes = append(nextVotes, RepoConfidenceVoteItem{
				VoterUserID:     voterUserID,
				ValidatorUserID: validatorUserID,
				VotedAt:         now,
			})
			updated = true
			continue
		}
		nextVotes = append(nextVotes, vote)
	}
	if !updated {
		nextVotes = append(nextVotes, RepoConfidenceVoteItem{
			VoterUserID:     voterUserID,
			ValidatorUserID: validatorUserID,
			VotedAt:         now,
		})
	}
	state.RepoConfidenceVotes = nextVotes

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta).Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(voterUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_confidence_vote_submitted", map[string]interface{}{
		"validator_user_id": validatorUserID,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, voterUserID)
}

func (s *EntValidationCaseRepoWorkflowService) FinalizeRepoCase(
	ctx context.Context,
	validationCaseID uint,
	ownerUserID uint,
	authHeader string,
) (*RepoTreeResponse, error) {
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}

	outputCountByValidator := activeValidatorOutputCounts(state.RepoFiles, state.RepoAssignments)
	if len(outputCountByValidator) < repoMinimumValidatorUploads {
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf("finalisasi membutuhkan minimal %d validator yang upload hasil", repoMinimumValidatorUploads),
		)
	}

	eligibleVoteBase := make(map[uint]int, len(outputCountByValidator))
	for validatorID := range outputCountByValidator {
		eligibleVoteBase[validatorID] = 0
	}
	eligibleSet := validatorIDSet(sortedKeysUint(eligibleVoteBase))
	normalizedVotes := normalizeConfidenceVotes(state.RepoConfidenceVotes, eligibleSet)
	confidenceByValidator := confidenceVoteCountByValidator(normalizedVotes)

	maxVotes := -1
	winnerIDs := make([]uint, 0, len(eligibleVoteBase))
	for _, validatorID := range sortedKeysUint(eligibleVoteBase) {
		votes := confidenceByValidator[validatorID]
		if votes > maxVotes {
			maxVotes = votes
			winnerIDs = []uint{validatorID}
			continue
		}
		if votes == maxVotes {
			winnerIDs = append(winnerIDs, validatorID)
		}
	}
	if len(winnerIDs) == 0 {
		return nil, apperrors.ErrInvalidInput.WithDetails("tidak ada validator eligible untuk finalisasi")
	}

	payoutByValidator := splitAmountEvenly(vc.BountyAmount, winnerIDs)
	payoutEntries := make([]RepoPayoutEntry, 0, len(winnerIDs))
	for _, validatorID := range winnerIDs {
		payoutEntries = append(payoutEntries, RepoPayoutEntry{
			ValidatorUserID: validatorID,
			Amount:          payoutByValidator[validatorID],
			ConfidenceVotes: confidenceByValidator[validatorID],
		})
	}

	if strings.TrimSpace(state.BountyReserveOrderID) == "" || normalizeRepoBountyReserveStatus(state.BountyReserveStatus) != repoBountyReserveStatusReserved {
		return nil, apperrors.ErrInvalidInput.WithDetails("reserve bounty belum aktif. Case tidak bisa difinalisasi.")
	}

	featureWallet := NewFeatureWalletClientFromConfig()
	recipients := make([]FeatureMarketDistributionRecipient, 0, len(payoutEntries))
	for _, entry := range payoutEntries {
		recipients = append(recipients, FeatureMarketDistributionRecipient{
			UserID:    entry.ValidatorUserID,
			AmountIDR: entry.Amount,
		})
	}
	if _, err := featureWallet.DistributeMarketPurchase(
		ctx,
		strings.TrimSpace(authHeader),
		state.BountyReserveOrderID,
		recipients,
		fmt.Sprintf("Validation Case #%d finalized payout", vc.ID),
		"validation_case",
	); err != nil {
		return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("gagal mencairkan bounty: %s", err.Error()))
	}

	confidenceStringMap := make(map[string]int, len(confidenceByValidator))
	for validatorID, votes := range confidenceByValidator {
		confidenceStringMap[fmt.Sprintf("%d", validatorID)] = votes
	}
	state.RepoPayout = &RepoPayoutLedger{
		BountyAmount:      vc.BountyAmount,
		WinnerValidatorID: winnerIDs,
		Confidence:        confidenceStringMap,
		Entries:           payoutEntries,
		CreatedAt:         time.Now().Unix(),
	}
	state.ConsensusStatus = repoConsensusFinalized
	state.ConsensusResult = "confidence_vote"
	state.RepoStage = repoStageFinalized
	state.BountyReserveStatus = repoBountyReserveStatusDisbursed

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetMeta(meta).
		SetStatus(caseStatusCompleted).
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_case_finalized", map[string]interface{}{
		"winner_validator_ids": winnerIDs,
		"bounty_amount":        vc.BountyAmount,
	})

	return s.buildRepoTreeResponse(ctx, vc, state, ownerUserID)
}

func (s *EntValidationCaseRepoWorkflowService) GetRepoConsensus(
	ctx context.Context,
	validationCaseID uint,
	viewerUserID uint,
) (*RepoConsensusResponse, error) {
	_ = viewerUserID
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}
	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	return s.buildConsensusResponse(validationCaseID, state), nil
}
