package services

import (
	"context"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

func (s *EntValidationCaseWorkflowService) ProcessOwnerResponseSLA(ctx context.Context) (int, int, error) {
	now := time.Now()
	reminderEvents := 0
	timeoutEvents := 0

	recovered, err := s.normalizeLegacyClarificationFlow(ctx, now)
	if err != nil {
		return 0, 0, err
	}
	if recovered > 0 {
		logger.Info("Normalized legacy clarification workflow states",
			zap.Int("recovered_items", recovered),
		)
	}

	items, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.StatusEQ(consultationStatusWaitingOwnerResponse),
			consultationrequest.OwnerResponseDueAtNotNil(),
		).
		All(ctx)
	if err != nil {
		return 0, 0, apperrors.ErrDatabase
	}

	for _, req := range items {
		if req.OwnerResponseDueAt == nil {
			continue
		}
		vc, err := s.client.ValidationCase.Get(ctx, req.ValidationCaseID)
		if err != nil {
			if ent.IsNotFound(err) {
				continue
			}
			return reminderEvents, timeoutEvents, apperrors.ErrDatabase
		}
		if err := ensureWorkflowV1Case(vc); err != nil {
			continue
		}
		if req.WorkflowCycle != currentWorkflowCycle(vc) {
			continue
		}

		due := req.OwnerResponseDueAt
		start := due.Add(-ownerResponseSLAHours * time.Hour)
		elapsed := now.Sub(start)

		newReminderCount := req.ReminderCount
		if elapsed >= ownerReminderFirstHour*time.Hour && newReminderCount < 1 {
			s.appendCaseLogBestEffort(ctx, vc.ID, nil, "owner_response_sla_reminder", map[string]interface{}{
				"consultation_request_id": req.ID,
				"reminder_hour":           ownerReminderFirstHour,
				"owner_response_due_at":   due.Unix(),
			})
			newReminderCount = 1
			reminderEvents++
		}
		if elapsed >= ownerReminderSecondHour*time.Hour && newReminderCount < 2 {
			s.appendCaseLogBestEffort(ctx, vc.ID, nil, "owner_response_sla_reminder", map[string]interface{}{
				"consultation_request_id": req.ID,
				"reminder_hour":           ownerReminderSecondHour,
				"owner_response_due_at":   due.Unix(),
			})
			newReminderCount = 2
			reminderEvents++
		}
		if newReminderCount != req.ReminderCount {
			_, _ = s.client.ConsultationRequest.UpdateOneID(req.ID).
				SetReminderCount(newReminderCount).
				Save(ctx)
		}

		if now.Before(*due) {
			continue
		}

		if _, err := s.client.ConsultationRequest.UpdateOneID(req.ID).
			SetStatus(consultationStatusOwnerTimeout).
			SetReminderCount(newReminderCount).
			SetExpiresAt(now).
			SetAutoClosedReason("owner_inactive_sla_timeout").
			Save(ctx); err != nil {
			return reminderEvents, timeoutEvents, apperrors.ErrDatabase
		}

		caseUpdate := s.client.ValidationCase.UpdateOneID(vc.ID).
			SetStatus(caseStatusOnHoldOwnerInactive).
			SetClarificationState(clarificationStateOwnerInactiveSLAExpired)
		if normalizeStatus(vc.Status) != caseStatusOnHoldOwnerInactive {
			caseUpdate.AddOwnerInactivityCount(1)
		}
		if _, err := caseUpdate.Save(ctx); err != nil {
			return reminderEvents, timeoutEvents, apperrors.ErrDatabase
		}

		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "owner_response_sla_expired", map[string]interface{}{
			"consultation_request_id": req.ID,
			"owner_response_due_at":   due.Unix(),
			"timeout_reason":          "owner_inactive_sla_timeout",
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "case_status_changed", map[string]interface{}{
			"from":   normalizeStatus(vc.Status),
			"to":     caseStatusOnHoldOwnerInactive,
			"reason": "owner_inactive_sla_timeout",
		})
		s.appendCaseLogBestEffort(ctx, vc.ID, nil, "validator_released_without_penalty", map[string]interface{}{
			"validator_user_id":       req.ValidatorUserID,
			"consultation_request_id": req.ID,
			"reassignment":            false,
			"reputation_impact":       "none",
		})
		timeoutEvents++
	}

	return reminderEvents, timeoutEvents, nil
}
