package services

import (
"context"
"fmt"
"math/rand"
"strings"
"time"

"backend-gin/ent"
"backend-gin/ent/user"
"backend-gin/ent/validationcase"
apperrors "backend-gin/errors"
)

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
