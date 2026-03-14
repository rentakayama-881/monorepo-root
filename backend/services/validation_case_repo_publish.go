package services

import (
"context"
"fmt"
"strings"

apperrors "backend-gin/errors"
)

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
