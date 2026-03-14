package services

import (
"context"
"fmt"
"sort"
"strings"
"time"

"backend-gin/ent"
apperrors "backend-gin/errors"
)

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

	// Idempotency guard: retries after timeout should not create duplicate file rows.
	for _, existing := range state.RepoFiles {
		if strings.TrimSpace(existing.DocumentID) != documentID {
			continue
		}
		if normalizeRepoFileKind(existing.Kind) != kind {
			continue
		}
		if existing.UploadedBy != actorUserID {
			continue
		}
		return s.buildRepoTreeResponse(ctx, vc, state, actorUserID)
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
