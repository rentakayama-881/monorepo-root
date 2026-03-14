package services

import (
	"context"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/validationcase"
	"backend-gin/ent/validationcaselog"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

func deriveCaseStatusFromWorkflowLinkage(vc *ent.ValidationCase) string {
	if vc == nil {
		return caseStatusOpen
	}
	if strings.TrimSpace(valueOrEmpty(vc.DisputeID)) != "" {
		return caseStatusDisputed
	}
	if strings.TrimSpace(valueOrEmpty(vc.CertifiedArtifactDocumentID)) != "" {
		return caseStatusCompleted
	}
	if strings.TrimSpace(valueOrEmpty(vc.ArtifactDocumentID)) != "" {
		return caseStatusArtifactSubmitted
	}
	if strings.TrimSpace(valueOrEmpty(vc.EscrowTransferID)) != "" {
		return caseStatusFundsLocked
	}
	if vc.AcceptedFinalOfferID != nil && *vc.AcceptedFinalOfferID > 0 {
		return caseStatusOfferAccepted
	}
	return caseStatusOpen
}

func (s *EntValidationCaseWorkflowService) appendCaseLogBestEffort(ctx context.Context, validationCaseID int, actorUserID *int, eventType string, detail map[string]interface{}) {
	create := s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(validationCaseID).
		SetEventType(eventType).
		SetDetailJSON(detail)
	if actorUserID != nil && *actorUserID > 0 {
		create.SetActorUserID(*actorUserID)
	}
	if _, err := create.Save(ctx); err != nil {
		logger.Warn("Failed to append case log (best effort)",
			zap.Error(err),
			zap.Int("validation_case_id", validationCaseID),
			zap.String("event_type", eventType),
		)
	}
}

func (s *EntValidationCaseWorkflowService) normalizeLegacyClarificationFlow(ctx context.Context, now time.Time) (int, error) {
	recovered := 0

	legacyRequests, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.StatusIn(
				consultationStatusWaitingOwnerResponse,
				consultationStatusOwnerTimeout,
			),
		).
		All(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}

	for _, req := range legacyRequests {
		vc, err := s.client.ValidationCase.Get(ctx, req.ValidationCaseID)
		if err != nil {
			if ent.IsNotFound(err) {
				continue
			}
			return recovered, apperrors.ErrDatabase
		}
		if err := ensureWorkflowV1Case(vc); err != nil {
			continue
		}
		if req.WorkflowCycle != currentWorkflowCycle(vc) {
			continue
		}

		updateReq := s.client.ConsultationRequest.UpdateOneID(req.ID).
			SetStatus(consultationStatusApproved).
			SetReminderCount(0).
			ClearOwnerResponseDueAt().
			ClearExpiresAt().
			ClearAutoClosedReason().
			ClearRejectedAt()
		if req.ApprovedAt == nil {
			updateReq.SetApprovedAt(now)
		}
		if _, err := updateReq.Save(ctx); err != nil {
			return recovered, apperrors.ErrDatabase
		}

		previousStatus := normalizeStatus(vc.Status)
		nextStatus := deriveCaseStatusFromWorkflowLinkage(vc)

		caseChanged := false
		caseStatusChanged := false
		caseUpdate := s.client.ValidationCase.UpdateOneID(vc.ID)
		if previousStatus == caseStatusWaitingOwnerResponse || previousStatus == caseStatusOnHoldOwnerInactive {
			caseUpdate.SetStatus(nextStatus)
			caseChanged = true
			caseStatusChanged = previousStatus != nextStatus
		}
		if normalizeStatus(vc.ClarificationState) != clarificationStateNone {
			caseUpdate.SetClarificationState(clarificationStateNone)
			caseChanged = true
		}
		if caseChanged {
			if _, err := caseUpdate.Save(ctx); err != nil {
				return recovered, apperrors.ErrDatabase
			}
			if caseStatusChanged {
				s.appendCaseLogBestEffort(ctx, vc.ID, nil, "case_status_changed", map[string]interface{}{
					"from":   previousStatus,
					"to":     nextStatus,
					"reason": "clarification_flow_retired",
				})
			}
			s.appendCaseLogBestEffort(ctx, vc.ID, nil, "clarification_flow_retired", map[string]interface{}{
				"consultation_request_id": req.ID,
				"request_status_from":     normalizeStatus(req.Status),
				"request_status_to":       consultationStatusApproved,
				"reason":                  "clarification_feature_removed",
			})
		}

		recovered++
	}

	legacyCases, err := s.client.ValidationCase.Query().
		Where(
			validationcase.Or(
				validationcase.StatusEQ(caseStatusWaitingOwnerResponse),
				validationcase.StatusEQ(caseStatusOnHoldOwnerInactive),
				validationcase.ClarificationStateNEQ(clarificationStateNone),
			),
		).
		All(ctx)
	if err != nil {
		return recovered, apperrors.ErrDatabase
	}

	for _, vc := range legacyCases {
		if err := ensureWorkflowV1Case(vc); err != nil {
			continue
		}
		previousStatus := normalizeStatus(vc.Status)
		needsStatusRecovery := previousStatus == caseStatusWaitingOwnerResponse || previousStatus == caseStatusOnHoldOwnerInactive
		nextStatus := deriveCaseStatusFromWorkflowLinkage(vc)

		caseChanged := false
		caseStatusChanged := false
		caseUpdate := s.client.ValidationCase.UpdateOneID(vc.ID)
		if needsStatusRecovery {
			caseUpdate.SetStatus(nextStatus)
			caseChanged = true
			caseStatusChanged = previousStatus != nextStatus
		}
		if normalizeStatus(vc.ClarificationState) != clarificationStateNone {
			caseUpdate.SetClarificationState(clarificationStateNone)
			caseChanged = true
		}
		if !caseChanged {
			continue
		}
		if _, err := caseUpdate.Save(ctx); err != nil {
			return recovered, apperrors.ErrDatabase
		}

		if caseStatusChanged {
			s.appendCaseLogBestEffort(ctx, vc.ID, nil, "case_status_changed", map[string]interface{}{
				"from":   previousStatus,
				"to":     nextStatus,
				"reason": "clarification_flow_retired",
			})
		}
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "clarification_flow_retired", map[string]interface{}{
			"reason": "clarification_feature_removed",
			"source": "residual_case_cleanup",
		})
		recovered++
	}

	return recovered, nil
}

func (s *EntValidationCaseWorkflowService) GetCaseLog(ctx context.Context, validationCaseID uint, viewerUserID uint) ([]CaseLogItem, error) {
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

	isOwner := vc.UserID == int(viewerUserID)
	if !isOwner {
		approved, err := s.client.ConsultationRequest.Query().
			Where(
				consultationrequest.ValidationCaseIDEQ(vc.ID),
				consultationrequest.ValidatorUserIDEQ(int(viewerUserID)),
				consultationrequest.StatusIn(
					consultationStatusApproved,
					consultationStatusWaitingOwnerResponse,
					consultationStatusOwnerTimeout,
				),
			).
			Exist(ctx)
		if err != nil {
			return nil, apperrors.ErrDatabase
		}
		if !approved {
			// Authenticated viewer, but Case Log is restricted to owner or approved validators.
			return nil, apperrors.ErrCaseLogAccessDenied
		}
	}

	logs, err := s.client.ValidationCaseLog.Query().
		Where(validationcaselog.ValidationCaseIDEQ(vc.ID)).
		WithActorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Order(ent.Asc(validationcaselog.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	out := make([]CaseLogItem, 0, len(logs))
	for _, it := range logs {
		var actor *UserSummary
		if it.Edges.ActorUser != nil {
			u := buildUserSummaryFromEnt(it.Edges.ActorUser)
			actor = &u
		}
		detail := it.DetailJSON
		if detail == nil {
			detail = map[string]interface{}{}
		}
		out = append(out, CaseLogItem{
			ID:               uint(it.ID),
			ValidationCaseID: validationCaseID,
			Actor:            actor,
			EventType:        it.EventType,
			Detail:           detail,
			CreatedAt:        it.CreatedAt.Unix(),
		})
	}
	return out, nil
}
