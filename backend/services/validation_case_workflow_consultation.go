package services

import (
	"context"
	"fmt"
	"strings"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	apperrors "backend-gin/errors"
)

func requiredStakeForConsultation(vc *ent.ValidationCase) int64 {
	if vc == nil {
		return minCredibilityStakeIDR()
	}

	switch strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)) {
	case "S0":
		return 0
	case "S1":
		return consultationStakeMinS1
	case "S2":
		return consultationStakeMinS2
	case "S3":
		if vc.BountyAmount > 0 {
			return vc.BountyAmount
		}
		return minCredibilityStakeIDR()
	default:
		return minCredibilityStakeIDR()
	}
}

func (s *EntValidationCaseWorkflowService) RequestConsultation(ctx context.Context, validationCaseID uint, validatorUserID uint) (uint, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrValidationCaseNotFound
		}
		return 0, apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return 0, err
	}

	if vc.UserID == int(validatorUserID) {
		return 0, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat Request Consultation pada kasusnya sendiri")
	}
	switch normalizeStatus(vc.Status) {
	case caseStatusOpen:
		// allowed
	case caseStatusWaitingOwnerResponse, caseStatusOnHoldOwnerInactive:
		return 0, apperrors.ErrInvalidInput.WithDetails("kasus sedang menunggu respons owner. Tidak dapat menerima validator baru.")
	default:
		return 0, apperrors.ErrInvalidInput.WithDetails("Request Consultation hanya dapat diajukan saat status kasus masih open")
	}

	validator, err := s.client.User.Get(ctx, int(validatorUserID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrUserNotFound
		}
		return 0, apperrors.ErrDatabase
	}

	requiredStake := requiredStakeForConsultation(vc)
	if validator.GuaranteeAmount < requiredStake {
		return 0, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf(
				"Credibility Stake tidak memenuhi syarat untuk sensitivity %s. Minimal Rp %d",
				strings.ToUpper(strings.TrimSpace(vc.SensitivityLevel)),
				requiredStake,
			),
		)
	}

	cycle := currentWorkflowCycle(vc)
	exists, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.WorkflowCycleEQ(cycle),
		).
		Exist(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}
	if exists {
		return 0, apperrors.ErrInvalidInput.WithDetails("Request Consultation sudah pernah diajukan untuk kasus ini")
	}

	req, err := s.client.ConsultationRequest.
		Create().
		SetValidationCaseID(int(validationCaseID)).
		SetValidatorUserID(int(validatorUserID)).
		SetWorkflowCycle(cycle).
		SetStatus(consultationStatusPending).
		SetReminderCount(0).
		Save(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_requested", map[string]interface{}{
		"validator_user_id": validatorUserID,
		"required_stake":    requiredStake,
		"workflow_cycle":    cycle,
	})

	return uint(req.ID), nil
}

func (s *EntValidationCaseWorkflowService) GetConsultationRequestForValidator(
	ctx context.Context,
	validationCaseID uint,
	validatorUserID uint,
) (*ValidatorConsultationRequestSummary, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return nil, err
	}
	cycle := currentWorkflowCycle(vc)

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.WorkflowCycleEQ(cycle),
		).
		Order(ent.Desc(consultationrequest.FieldCreatedAt)).
		First(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, nil
		}
		return nil, apperrors.ErrDatabase
	}

	return &ValidatorConsultationRequestSummary{
		ID:                 uint(req.ID),
		Status:             normalizeStatus(req.Status),
		ApprovedAt:         unixPtr(req.ApprovedAt),
		RejectedAt:         unixPtr(req.RejectedAt),
		ExpiresAt:          unixPtr(req.ExpiresAt),
		OwnerResponseDueAt: unixPtr(req.OwnerResponseDueAt),
		CreatedAt:          req.CreatedAt.Unix(),
	}, nil
}
