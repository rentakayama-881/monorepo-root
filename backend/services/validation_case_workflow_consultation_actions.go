package services

import (
	"context"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"go.uber.org/zap"
)

func (s *EntValidationCaseWorkflowService) ApproveConsultationRequest(ctx context.Context, validationCaseID uint, ownerUserID uint, requestID uint) error {
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

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.IDEQ(int(requestID)),
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak ditemukan")
		}
		return apperrors.ErrDatabase
	}
	if req.WorkflowCycle != currentWorkflowCycle(vc) {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request berasal dari siklus workflow sebelumnya")
	}

	if normalizeStatus(req.Status) != consultationStatusPending {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak dalam status pending")
	}

	// Use transaction to ensure atomicity of consultation request + case log updates
	tx, err := s.client.Tx(ctx)
	if err != nil {
		return apperrors.ErrDatabase
	}
	defer func() {
		if v := recover(); v != nil {
			logger.Error("transaction panic recovered in consultation approval", zap.Any("panic", v), zap.Stack("stack"))
			_ = tx.Rollback()
			panic(v)
		}
	}()

	now := time.Now()
	if _, err := tx.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus(consultationStatusApproved).
		SetApprovedAt(now).
		ClearRejectedAt().
		ClearOwnerResponseDueAt().
		ClearExpiresAt().
		SetReminderCount(0).
		ClearAutoClosedReason().
		Save(ctx); err != nil {
		_ = tx.Rollback()
		return apperrors.ErrDatabase
	}

	if err := tx.Commit(); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_approved", map[string]interface{}{
		"validator_user_id": req.ValidatorUserID,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) RejectConsultationRequest(ctx context.Context, validationCaseID uint, ownerUserID uint, requestID uint, reason string) error {
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

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.IDEQ(int(requestID)),
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak ditemukan")
		}
		return apperrors.ErrDatabase
	}
	if req.WorkflowCycle != currentWorkflowCycle(vc) {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request berasal dari siklus workflow sebelumnya")
	}

	if normalizeStatus(req.Status) != consultationStatusPending {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak dalam status pending")
	}

	now := time.Now()
	if _, err := s.client.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus(consultationStatusRejected).
		SetRejectedAt(now).
		ClearApprovedAt().
		ClearOwnerResponseDueAt().
		ClearExpiresAt().
		SetReminderCount(0).
		ClearAutoClosedReason().
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_rejected", map[string]interface{}{
		"validator_user_id": req.ValidatorUserID,
		"reason":            strings.TrimSpace(reason),
	})

	return nil
}
