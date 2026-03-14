package services

import (
	"context"
	"strings"

	"backend-gin/ent"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
)

func normalizeDisputeSettlementOutcome(outcome string) string {
	switch normalizeStatus(outcome) {
	case disputeSettlementOutcomeOwnerRefund:
		return disputeSettlementOutcomeOwnerRefund
	case disputeSettlementOutcomeValidatorRelease:
		return disputeSettlementOutcomeValidatorRelease
	default:
		return ""
	}
}

// SettleDisputeInternalByTransferID is called by Feature Service after dispute settlement.
// Protected by InternalServiceAuth middleware (X-Internal-Api-Key).
func (s *EntValidationCaseWorkflowService) SettleDisputeInternalByTransferID(
	ctx context.Context,
	transferID string,
	disputeID string,
	outcome string,
	source string,
) (*int, error) {
	transferID = strings.TrimSpace(transferID)
	if transferID == "" {
		return nil, apperrors.ErrMissingField.WithDetails("transfer_id")
	}
	disputeID = strings.TrimSpace(disputeID)
	if disputeID == "" {
		return nil, apperrors.ErrMissingField.WithDetails("dispute_id")
	}
	normalizedOutcome := normalizeDisputeSettlementOutcome(outcome)
	if normalizedOutcome == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("outcome harus owner_refund atau validator_release")
	}
	source = strings.TrimSpace(source)

	vc, err := s.client.ValidationCase.Query().
		Where(validationcase.EscrowTransferIDEQ(transferID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return nil, err
	}

	currentDisputeID := strings.TrimSpace(valueOrEmpty(vc.DisputeID))
	if currentDisputeID != "" && currentDisputeID != disputeID {
		return nil, apperrors.ErrInvalidInput.WithDetails("dispute_id tidak sesuai dengan transfer pada kasus ini")
	}

	previousStatus := normalizeStatus(vc.Status)
	cycle := currentWorkflowCycle(vc)

	switch normalizedOutcome {
	case disputeSettlementOutcomeOwnerRefund:
		nextCycle := cycle + 1
		if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
			SetStatus(caseStatusOpen).
			SetClarificationState(clarificationStateNone).
			SetWorkflowCycle(nextCycle).
			ClearDisputeID().
			ClearEscrowTransferID().
			ClearAcceptedFinalOfferID().
			ClearArtifactDocumentID().
			ClearCertifiedArtifactDocumentID().
			Save(ctx); err != nil {
			return nil, apperrors.ErrDatabase
		}

		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "dispute_settled", map[string]interface{}{
			"transfer_id":     transferID,
			"dispute_id":      disputeID,
			"outcome":         normalizedOutcome,
			"source":          source,
			"workflow_cycle":  cycle,
			"next_cycle":      nextCycle,
			"previous_status": previousStatus,
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "case_status_changed", map[string]interface{}{
			"from":   previousStatus,
			"to":     caseStatusOpen,
			"reason": "dispute_refund_to_owner",
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "workflow_cycle_incremented", map[string]interface{}{
			"from_cycle": cycle,
			"to_cycle":   nextCycle,
			"reason":     "dispute_refund_to_owner",
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "financial_linkage_cleared", map[string]interface{}{
			"cleared_fields": []string{
				"dispute_id",
				"escrow_transfer_id",
				"accepted_final_offer_id",
				"artifact_document_id",
				"certified_artifact_document_id",
			},
			"reason": "dispute_refund_to_owner",
		})

	case disputeSettlementOutcomeValidatorRelease:
		if previousStatus == caseStatusCompleted && currentDisputeID == "" {
			return &vc.ID, nil
		}
		if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
			SetStatus(caseStatusCompleted).
			ClearDisputeID().
			Save(ctx); err != nil {
			return nil, apperrors.ErrDatabase
		}

		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "dispute_settled", map[string]interface{}{
			"transfer_id":     transferID,
			"dispute_id":      disputeID,
			"outcome":         normalizedOutcome,
			"source":          source,
			"workflow_cycle":  cycle,
			"previous_status": previousStatus,
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "case_status_changed", map[string]interface{}{
			"from":   previousStatus,
			"to":     caseStatusCompleted,
			"reason": "dispute_release_to_validator",
		})
	}

	return &vc.ID, nil
}

func (s *EntValidationCaseWorkflowService) AttachDispute(ctx context.Context, validationCaseID uint, ownerUserID uint, disputeID string, authHeader string) error {
	disputeID = strings.TrimSpace(disputeID)
	if disputeID == "" {
		return apperrors.ErrMissingField.WithDetails("dispute_id")
	}

	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if err := ensureWorkflowV1Case(vc); err != nil {
		return err
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID == nil || strings.TrimSpace(*vc.EscrowTransferID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("escrow_transfer_id belum ada")
	}
	if vc.DisputeID != nil && strings.TrimSpace(*vc.DisputeID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Dispute sudah terpasang pada kasus ini")
	}

	fd, err := s.getFeatureDispute(ctx, authHeader, disputeID)
	if err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}
	if strings.TrimSpace(fd.TransferID) != strings.TrimSpace(*vc.EscrowTransferID) {
		return apperrors.ErrInvalidInput.WithDetails("dispute_id tidak sesuai dengan escrow_transfer_id kasus ini")
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetDisputeID(disputeID).
		SetStatus(caseStatusDisputed).
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "dispute_attached", map[string]interface{}{
		"dispute_id":     disputeID,
		"transfer_id":    strings.TrimSpace(*vc.EscrowTransferID),
		"dispute_status": fd.Status,
	})

	return nil
}
