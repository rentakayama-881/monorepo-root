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

	repoCompletionPanel3  = "panel_3"
	repoCompletionPanel10 = "panel_10"

	repoConsensusPending    = "pending"
	repoConsensusConclusive = "conclusive"
	repoConsensusEscalated  = "escalated"
	repoConsensusFinalized  = "finalized"

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
	WorkflowFamily  string               `json:"workflow_family"`
	ProtocolMode    string               `json:"protocol_mode"`
	CompletionMode  string               `json:"completion_mode"`
	ConsensusStatus string               `json:"consensus_status"`
	ConsensusResult string               `json:"consensus_result,omitempty"`
	RepoStage       string               `json:"repo_stage"`
	RepoFiles       []RepoCaseFileItem   `json:"repo_files"`
	RepoApplicants  []uint               `json:"repo_applicants"`
	RepoAssignments []RepoAssignmentItem `json:"repo_assignments"`
	RepoVerdicts    []RepoVerdictItem    `json:"repo_verdicts"`
	RepoPayout      *RepoPayoutLedger    `json:"repo_payout,omitempty"`
}

func defaultRepoMetaState() repoMetaState {
	return repoMetaState{
		WorkflowFamily:  workspaceWorkflowFamily,
		CompletionMode:  repoCompletionPanel3,
		ConsensusStatus: repoConsensusPending,
		RepoStage:       repoStageDraft,
		RepoFiles:       []RepoCaseFileItem{},
		RepoApplicants:  []uint{},
		RepoAssignments: []RepoAssignmentItem{},
		RepoVerdicts:    []RepoVerdictItem{},
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
	case repoStageDraft:
		return repoStageDraft
	case repoStagePublished:
		return repoStagePublished
	case repoStageInReview:
		return repoStageInReview
	case repoStageFinalized:
		return repoStageFinalized
	default:
		return repoStageDraft
	}
}

func normalizeRepoCompletionMode(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoCompletionPanel10:
		return repoCompletionPanel10
	default:
		return repoCompletionPanel3
	}
}

func normalizeRepoConsensusStatus(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case repoConsensusConclusive:
		return repoConsensusConclusive
	case repoConsensusEscalated:
		return repoConsensusEscalated
	case repoConsensusFinalized:
		return repoConsensusFinalized
	default:
		return repoConsensusPending
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
	canPublish := isOwner && hasReadme && hasTaskInput && normalizeRepoStage(state.RepoStage) != repoStageFinalized
	requiredStake := requiredStakeForRepoCase(vc)

	userIDs := make([]uint, 0, len(state.RepoApplicants)+len(state.RepoAssignments)+len(state.RepoVerdicts))
	userIDs = append(userIDs, state.RepoApplicants...)
	for _, asn := range state.RepoAssignments {
		userIDs = append(userIDs, asn.ValidatorUserID)
	}
	for _, verdict := range state.RepoVerdicts {
		userIDs = append(userIDs, verdict.ValidatorUserID)
	}
	summaries, err := s.userSummariesByID(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	files := make([]RepoCaseFileItem, 0, len(state.RepoFiles))
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
		files = append(files, item)
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

	return &RepoTreeResponse{
		CaseID:              uint(vc.ID),
		WorkflowFamily:      workspaceWorkflowFamily,
		WorkflowName:        workspaceWorkflowName,
		ProtocolMode:        normalizeRepoMode(state.ProtocolMode),
		WorkspaceStage:      normalizeRepoStage(state.RepoStage),
		RepoStage:           normalizeRepoStage(state.RepoStage),
		CompletionMode:      normalizeRepoCompletionMode(state.CompletionMode),
		ConsensusStatus:     normalizeRepoConsensusStatus(state.ConsensusStatus),
		ConsensusResult:     strings.TrimSpace(state.ConsensusResult),
		RequiredStake:       requiredStake,
		ViewerStake:         viewerStake,
		StakeEligible:       stakeEligible,
		CanPublish:          canPublish,
		HasRequiredReadme:   hasReadme,
		HasTaskInput:        hasTaskInput,
		IsOwner:             isOwner,
		IsAssignedValidator: isAssigned,
		Files:               files,
		Applicants:          applicants,
		Assignments:         assignments,
		Verdicts:            verdicts,
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
	hasReadmeFile, hasTaskInput := repoFileRequirements(state.RepoFiles)
	hasReadme := hasReadmeFile || validationCaseHasReadmeContent(vc)
	if !hasReadme {
		return nil, apperrors.ErrInvalidInput.WithDetails("publish membutuhkan CASE_README (markdown case record) atau file kind=case_readme")
	}
	if !hasTaskInput {
		return nil, apperrors.ErrInvalidInput.WithDetails("publish membutuhkan minimal 1 file kind=task_input")
	}

	state.RepoStage = repoStagePublished
	state.ConsensusStatus = repoConsensusPending

	meta := mergeRepoMeta(vc.Meta, state)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetMeta(meta).
		SetStatus(caseStatusOpen).
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_case_published", map[string]interface{}{
		"completion_mode": state.CompletionMode,
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
	if normalizeRepoStage(state.RepoStage) != repoStagePublished && normalizeRepoStage(state.RepoStage) != repoStageInReview {
		return nil, apperrors.ErrInvalidInput.WithDetails("case belum dipublish")
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

	activeCount, err := s.countActiveRepoAssignmentsForValidator(ctx, validatorUserID)
	if err != nil {
		return nil, err
	}
	if activeCount >= 2 {
		return nil, apperrors.ErrInvalidInput.WithDetails("validator sudah mencapai batas maksimal 2 task aktif")
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
	if normalizeRepoStage(state.RepoStage) == repoStageDraft {
		return nil, apperrors.ErrInvalidInput.WithDetails("publish case terlebih dahulu sebelum assign validator")
	}

	panelSize = normalizeRequestedPanelSize(panelSize)
	if panelSize == 10 {
		state.CompletionMode = repoCompletionPanel10
	} else {
		state.CompletionMode = repoCompletionPanel3
	}

	validatorUserIDs = dedupeUint(validatorUserIDs)
	if len(validatorUserIDs) == 0 {
		validatorUserIDs = append(validatorUserIDs, state.RepoApplicants...)
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

	if len(filtered) < panelSize {
		return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("validator terpilih minimal %d", panelSize))
	}
	filtered = filtered[:panelSize]

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

	activeCounts, countErr := s.countActiveRepoAssignmentsForValidators(ctx, filtered)
	if countErr != nil {
		return nil, countErr
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

		activeCount := activeCounts[id]
		if !s.isAssignedValidator(id, state.RepoAssignments) && activeCount >= 2 {
			return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("validator %d sudah mencapai batas 2 task aktif", id))
		}
	}

	cutoff := time.Now().Add(-30 * 24 * time.Hour)
	pairSet, err := s.buildRecentPanelPairSet(ctx, validationCaseID, cutoff)
	if err != nil {
		return nil, err
	}
	for i := 0; i < len(filtered); i++ {
		for j := i + 1; j < len(filtered); j++ {
			_, seen := pairSet[validatorPairKey(filtered[i], filtered[j])]
			if seen {
				return nil, apperrors.ErrInvalidInput.WithDetails(
					fmt.Sprintf("validator %d dan %d pernah satu panel dalam 30 hari terakhir", filtered[i], filtered[j]),
				)
			}
		}
	}

	now := time.Now().Unix()
	nextAssignments := make([]RepoAssignmentItem, 0, len(filtered))
	for _, id := range filtered {
		nextAssignments = append(nextAssignments, RepoAssignmentItem{
			ValidatorUserID: id,
			Status:          repoAssignmentStatusActive,
			AssignedAt:      now,
		})
	}
	state.RepoAssignments = nextAssignments
	state.RepoVerdicts = []RepoVerdictItem{}
	state.RepoStage = repoStageInReview
	state.ConsensusStatus = repoConsensusPending
	state.ConsensusResult = ""
	state.RepoPayout = nil

	remainingApplicants := make([]uint, 0, len(state.RepoApplicants))
	for _, id := range state.RepoApplicants {
		if containsUint(filtered, id) {
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
		"panel_size":         panelSize,
		"completion_mode":    state.CompletionMode,
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
	if normalizeRepoStage(state.RepoStage) == repoStageDraft {
		return nil, apperrors.ErrInvalidInput.WithDetails("publish case terlebih dahulu sebelum auto-match validator")
	}

	panelSize = normalizeRequestedPanelSize(panelSize)
	candidateIDs := dedupeUint(state.RepoApplicants)
	if len(candidateIDs) < panelSize {
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf("applicant validator belum cukup untuk panel %d", panelSize),
		)
	}

	intIDs := make([]int, 0, len(candidateIDs))
	for _, id := range candidateIDs {
		if id == 0 || id == ownerUserID {
			continue
		}
		intIDs = append(intIDs, int(id))
	}
	usersByID := make(map[uint]*ent.User, len(intIDs))
	if len(intIDs) > 0 {
		users, qErr := s.client.User.Query().Where(user.IDIn(intIDs...)).All(ctx)
		if qErr != nil {
			return nil, apperrors.ErrDatabase
		}
		for _, u := range users {
			usersByID[uint(u.ID)] = u
		}
	}

	requiredStake := requiredStakeForRepoCase(vc)
	activeCounts, countErr := s.countActiveRepoAssignmentsForValidators(ctx, candidateIDs)
	if countErr != nil {
		return nil, countErr
	}
	eligible := make([]uint, 0, len(candidateIDs))
	for _, id := range candidateIDs {
		validator := usersByID[id]
		if validator == nil {
			continue
		}
		if validator.GuaranteeAmount < requiredStake {
			continue
		}

		activeCount := activeCounts[id]
		if !s.isAssignedValidator(id, state.RepoAssignments) && activeCount >= 2 {
			continue
		}
		eligible = append(eligible, id)
	}
	if len(eligible) < panelSize {
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf("validator eligible belum cukup untuk panel %d", panelSize),
		)
	}

	eligible = shuffledUint(eligible)
	cutoff := time.Now().Add(-30 * 24 * time.Hour)
	pairSet, err := s.buildRecentPanelPairSet(ctx, validationCaseID, cutoff)
	if err != nil {
		return nil, err
	}
	selected := make([]uint, 0, panelSize)

	var pick func(start int) (bool, error)
	pick = func(start int) (bool, error) {
		if len(selected) == panelSize {
			return true, nil
		}
		remainingNeeded := panelSize - len(selected)
		for i := start; i <= len(eligible)-remainingNeeded; i++ {
			candidate := eligible[i]
			conflict := false
			for _, existing := range selected {
				_, seen := pairSet[validatorPairKey(candidate, existing)]
				if seen {
					conflict = true
					break
				}
			}
			if conflict {
				continue
			}

			selected = append(selected, candidate)
			ok, err := pick(i + 1)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
			selected = selected[:len(selected)-1]
		}
		return false, nil
	}

	ok, err := pick(0)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("tidak ditemukan kombinasi panel validator yang lolos aturan anti-pairing")
	}

	tree, err := s.AssignRepoValidators(ctx, validationCaseID, ownerUserID, selected, panelSize, authHeader)
	if err != nil {
		return nil, err
	}

	actor := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, int(validationCaseID), &actor, "workspace_validators_auto_matched", map[string]interface{}{
		"validator_user_ids": selected,
		"panel_size":         panelSize,
	})
	return tree, nil
}

func (s *EntValidationCaseRepoWorkflowService) buildConsensusResponse(
	validationCaseID uint,
	state repoMetaState,
	latest map[uint]RepoVerdictItem,
) *RepoConsensusResponse {
	requiredVotes := requiredVotesByMode(state.CompletionMode)
	breakdown := consensusBreakdown(latest)
	return &RepoConsensusResponse{
		CaseID:          validationCaseID,
		CompletionMode:  normalizeRepoCompletionMode(state.CompletionMode),
		ConsensusStatus: normalizeRepoConsensusStatus(state.ConsensusStatus),
		ConsensusResult: strings.TrimSpace(state.ConsensusResult),
		RequiredVotes:   requiredVotes,
		SubmittedVotes:  len(latest),
		Breakdown:       breakdown,
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
	vc, err := s.getValidationCase(ctx, validationCaseID)
	if err != nil {
		return nil, err
	}

	state := s.ensureRepoState(loadRepoMetaState(vc.Meta))
	if !s.isAssignedValidator(validatorUserID, state.RepoAssignments) {
		return nil, apperrors.ErrInvalidInput.WithDetails("hanya validator terpilih yang dapat submit verdict")
	}
	if normalizeRepoStage(state.RepoStage) == repoStageFinalized {
		return nil, apperrors.ErrInvalidInput.WithDetails("case sudah finalized")
	}

	verdict = normalizeRepoVerdict(verdict)
	notes = strings.TrimSpace(notes)
	documentID = strings.TrimSpace(documentID)
	if verdict == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("verdict harus valid, needs_revision, atau reject")
	}
	if confidence < 0 || confidence > 100 {
		return nil, apperrors.ErrInvalidInput.WithDetails("confidence harus 0-100")
	}
	if len(notes) > 1000 {
		return nil, apperrors.ErrInvalidInput.WithDetails("notes maksimal 1000 karakter")
	}

	now := time.Now().Unix()
	nextVerdicts := make([]RepoVerdictItem, 0, len(state.RepoVerdicts)+1)
	updated := false
	for _, item := range state.RepoVerdicts {
		if item.ValidatorUserID == validatorUserID {
			item.Verdict = verdict
			item.Confidence = confidence
			item.Notes = notes
			item.DocumentID = documentID
			item.SubmittedAt = now
			nextVerdicts = append(nextVerdicts, item)
			updated = true
			continue
		}
		nextVerdicts = append(nextVerdicts, item)
	}
	if !updated {
		nextVerdicts = append(nextVerdicts, RepoVerdictItem{
			ValidatorUserID: validatorUserID,
			Verdict:         verdict,
			Confidence:      confidence,
			Notes:           notes,
			DocumentID:      documentID,
			SubmittedAt:     now,
		})
	}
	state.RepoVerdicts = nextVerdicts

	latest := latestVerdictsByValidator(state.RepoVerdicts, state.RepoAssignments)
	requiredVotes := requiredVotesByMode(state.CompletionMode)
	breakdown := consensusBreakdown(latest)
	winner, winnerCount, _ := consensusWinner(breakdown)
	finalized := false

	if len(latest) >= requiredVotes {
		if normalizeRepoCompletionMode(state.CompletionMode) == repoCompletionPanel3 {
			if winnerCount >= 2 {
				state.ConsensusStatus = repoConsensusFinalized
				state.ConsensusResult = winner
				state.RepoStage = repoStageFinalized
				state.RepoPayout = buildRepoPayoutLedger(vc.BountyAmount, winner, latest)
				finalized = true
			} else {
				state.CompletionMode = repoCompletionPanel10
				state.ConsensusStatus = repoConsensusEscalated
				state.RepoStage = repoStagePublished
				state.ConsensusResult = ""
			}
		} else {
			// Panel 10: supermajority threshold.
			if winnerCount >= 7 {
				state.ConsensusStatus = repoConsensusFinalized
				state.ConsensusResult = winner
				state.RepoStage = repoStageFinalized
				state.RepoPayout = buildRepoPayoutLedger(vc.BountyAmount, winner, latest)
				finalized = true
			} else {
				state.ConsensusStatus = repoConsensusEscalated
				state.RepoStage = repoStageInReview
				state.ConsensusResult = ""
			}
		}
	} else {
		state.ConsensusStatus = repoConsensusPending
	}

	meta := mergeRepoMeta(vc.Meta, state)
	update := s.client.ValidationCase.UpdateOneID(vc.ID).SetMeta(meta)
	if finalized {
		update.SetStatus(caseStatusCompleted)
	}
	if _, err := update.Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actor := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_verdict_submitted", map[string]interface{}{
		"validator_user_id": validatorUserID,
		"verdict":           verdict,
		"confidence":        confidence,
		"submitted_votes":   len(latest),
		"required_votes":    requiredVotes,
	})
	if normalizeRepoConsensusStatus(state.ConsensusStatus) == repoConsensusEscalated {
		s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_consensus_escalated", map[string]interface{}{
			"completion_mode": state.CompletionMode,
			"breakdown":       breakdown,
		})
	}
	if normalizeRepoConsensusStatus(state.ConsensusStatus) == repoConsensusFinalized {
		s.appendCaseLogBestEffort(ctx, vc.ID, &actor, "repo_consensus_finalized", map[string]interface{}{
			"result":     state.ConsensusResult,
			"breakdown":  breakdown,
			"payout_set": state.RepoPayout != nil,
		})
	}

	// Unlock locked chain vesting from previous finalized cases once validator contributes to another case.
	s.unlockChainVestingForValidator(ctx, validatorUserID, validationCaseID)

	latest = latestVerdictsByValidator(state.RepoVerdicts, state.RepoAssignments)
	return s.buildConsensusResponse(validationCaseID, state, latest), nil
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
	latest := latestVerdictsByValidator(state.RepoVerdicts, state.RepoAssignments)
	return s.buildConsensusResponse(validationCaseID, state, latest), nil
}
