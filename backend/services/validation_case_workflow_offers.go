package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
)

func finalOfferSubmissionKey(validationCaseID int, validatorUserID uint, workflowCycle int) string {
	return fmt.Sprintf("vc:%d:validator:%d:cycle:%d", validationCaseID, validatorUserID, workflowCycle)
}

func (s *EntValidationCaseWorkflowService) SubmitFinalOffer(ctx context.Context, validationCaseID uint, validatorUserID uint, holdHours int, terms string) (uint, error) {
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
		return 0, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat mengajukan Final Offer pada kasusnya sendiri")
	}
	if normalizeStatus(vc.Status) != caseStatusOpen {
		return 0, apperrors.ErrInvalidInput.WithDetails("Final Offer hanya dapat diajukan saat status kasus open")
	}
	cycle := currentWorkflowCycle(vc)

	// Require approved consultation to submit an offer.
	approved, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(vc.ID),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusEQ(consultationStatusApproved),
			consultationrequest.WorkflowCycleEQ(cycle),
		).
		Exist(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}
	if !approved {
		// Authenticated validator, but not authorized to submit an offer until consultation is approved.
		return 0, apperrors.ErrFinalOfferRequiresApproval
	}

	// Prevent duplicate submissions from the same validator on the same case.
	// This protects against accidental double-click/request replay.
	existingOffer, err := s.client.FinalOffer.Query().
		Where(
			finaloffer.ValidationCaseIDEQ(vc.ID),
			finaloffer.ValidatorUserIDEQ(int(validatorUserID)),
			finaloffer.WorkflowCycleEQ(cycle),
		).
		Order(ent.Desc(finaloffer.FieldCreatedAt)).
		First(ctx)
	if err == nil && existingOffer != nil {
		return 0, apperrors.ErrInvalidInput.WithDetails("Final Offer untuk kasus ini sudah pernah diajukan")
	}
	if err != nil && !ent.IsNotFound(err) {
		return 0, apperrors.ErrDatabase
	}

	// Final Offer amount is locked to the posted bounty. Validators do not negotiate amount in-platform.
	amount := vc.BountyAmount
	if amount <= 0 {
		return 0, apperrors.ErrInvalidInput.WithDetails("bounty_amount belum diatur")
	}
	if amount < 10_000 {
		return 0, apperrors.ErrInvalidInput.WithDetails("bounty_amount minimal Rp 10.000")
	}

	// Escrow hold windows are discrete options (mirrors wallet transfer UI):
	// 1 day 8 hours (light), 7 days (standard), 30 days (long).
	if holdHours <= 0 {
		holdHours = 7 * 24
	}
	switch holdHours {
	case 32, 7 * 24, 30 * 24:
		// ok
	default:
		return 0, apperrors.ErrInvalidInput.WithDetails("hold_hours harus 32, 168, atau 720")
	}

	submissionKey := finalOfferSubmissionKey(vc.ID, validatorUserID, cycle)

	offer, err := s.client.FinalOffer.Create().
		SetValidationCaseID(vc.ID).
		SetValidatorUserID(int(validatorUserID)).
		SetSubmissionKey(submissionKey).
		SetWorkflowCycle(cycle).
		SetAmount(amount).
		SetHoldHours(holdHours).
		SetTerms(strings.TrimSpace(terms)).
		SetStatus("submitted").
		Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) {
			// Idempotency unique-key hit: request duplicate for same validator+case.
			return 0, apperrors.ErrInvalidInput.WithDetails("Final Offer untuk kasus ini sudah pernah diajukan")
		}
		return 0, apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "final_offer_submitted", map[string]interface{}{
		"final_offer_id": offer.ID,
		"amount":         amount,
		"hold_hours":     holdHours,
		"workflow_cycle": cycle,
	})

	return uint(offer.ID), nil
}

func (s *EntValidationCaseWorkflowService) ListFinalOffers(ctx context.Context, validationCaseID uint, viewerUserID uint) ([]FinalOfferItem, error) {
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

	// Owner can list all offers. Validators can list their own offers.
	isOwner := vc.UserID == int(viewerUserID)
	cycle := currentWorkflowCycle(vc)

	query := s.client.FinalOffer.Query().
		Where(
			finaloffer.ValidationCaseIDEQ(vc.ID),
			finaloffer.WorkflowCycleEQ(cycle),
		).
		WithValidatorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Order(ent.Desc(finaloffer.FieldCreatedAt))

	if !isOwner {
		query = query.Where(finaloffer.ValidatorUserIDEQ(int(viewerUserID)))
	}

	offers, err := query.All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	out := make([]FinalOfferItem, 0, len(offers))
	for _, it := range offers {
		validator := buildUserSummaryFromEnt(it.Edges.ValidatorUser)
		out = append(out, FinalOfferItem{
			ID:               uint(it.ID),
			ValidationCaseID: validationCaseID,
			Validator:        validator,
			Amount:           it.Amount,
			HoldHours:        it.HoldHours,
			Terms:            it.Terms,
			Status:           it.Status,
			AcceptedAt:       unixPtr(it.AcceptedAt),
			RejectedAt:       unixPtr(it.RejectedAt),
			CreatedAt:        it.CreatedAt.Unix(),
		})
	}
	return out, nil
}

func (s *EntValidationCaseWorkflowService) AcceptFinalOffer(ctx context.Context, validationCaseID uint, ownerUserID uint, offerID uint) (*EscrowDraft, error) {
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
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}
	if normalizeStatus(vc.Status) != caseStatusOpen {
		return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer hanya dapat diterima saat status kasus open")
	}
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Lock Funds sudah dilakukan untuk kasus ini")
	}
	if vc.DisputeID != nil && strings.TrimSpace(*vc.DisputeID) != "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Kasus sedang dalam Dispute")
	}
	cycle := currentWorkflowCycle(vc)

	offer, err := s.client.FinalOffer.Query().
		Where(
			finaloffer.IDEQ(int(offerID)),
			finaloffer.ValidationCaseIDEQ(vc.ID),
			finaloffer.WorkflowCycleEQ(cycle),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer tidak ditemukan")
		}
		return nil, apperrors.ErrDatabase
	}

	validator, err := s.client.User.Query().Where(user.IDEQ(offer.ValidatorUserID)).Only(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	if validator.Username == nil || strings.TrimSpace(*validator.Username) == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Validator belum memiliki username. Tidak dapat Lock Funds.")
	}

	// Use transaction to ensure atomicity of offer + case updates
	tx, err := s.client.Tx(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}
	defer func() {
		if v := recover(); v != nil {
			_ = tx.Rollback()
			panic(v)
		}
	}()

	now := time.Now()
	acceptApplied := false

	// Claim offer acceptance atomically.
	// If another request has already accepted the same offer, treat it as idempotent success.
	updatedCases, err := tx.ValidationCase.Update().
		Where(
			validationcase.IDEQ(vc.ID),
			validationcase.UserIDEQ(int(ownerUserID)),
			validationcase.WorkflowCycleEQ(cycle),
			validationcase.StatusEQ(caseStatusOpen),
			validationcase.Or(validationcase.EscrowTransferIDIsNil(), validationcase.EscrowTransferIDEQ("")),
			validationcase.Or(validationcase.DisputeIDIsNil(), validationcase.DisputeIDEQ("")),
			validationcase.AcceptedFinalOfferIDIsNil(),
		).
		SetAcceptedFinalOfferID(offer.ID).
		SetStatus(caseStatusOfferAccepted).
		Save(ctx)
	if err != nil {
		_ = tx.Rollback()
		return nil, apperrors.ErrDatabase
	}

	if updatedCases == 1 {
		updatedOffers, err := tx.FinalOffer.Update().
			Where(
				finaloffer.IDEQ(offer.ID),
				finaloffer.ValidationCaseIDEQ(vc.ID),
				finaloffer.WorkflowCycleEQ(cycle),
				finaloffer.StatusEQ("submitted"),
				finaloffer.AcceptedAtIsNil(),
			).
			SetStatus("accepted_pending_funding").
			SetAcceptedAt(now).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			return nil, apperrors.ErrDatabase
		}
		if updatedOffers != 1 {
			_ = tx.Rollback()
			return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer tidak lagi tersedia untuk diterima")
		}
		acceptApplied = true
	} else {
		currentCase, err := tx.ValidationCase.Query().
			Where(validationcase.IDEQ(vc.ID)).
			Only(ctx)
		if err != nil {
			_ = tx.Rollback()
			if ent.IsNotFound(err) {
				return nil, apperrors.ErrValidationCaseNotFound
			}
			return nil, apperrors.ErrDatabase
		}
		if currentCase.AcceptedFinalOfferID == nil || *currentCase.AcceptedFinalOfferID != offer.ID || normalizeStatus(currentCase.Status) != caseStatusOfferAccepted {
			_ = tx.Rollback()
			return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer sudah diproses atau status kasus berubah. Muat ulang halaman lalu coba lagi.")
		}

		currentOffer, err := tx.FinalOffer.Query().
			Where(
				finaloffer.IDEQ(offer.ID),
				finaloffer.ValidationCaseIDEQ(vc.ID),
				finaloffer.WorkflowCycleEQ(cycle),
			).
			Only(ctx)
		if err != nil {
			_ = tx.Rollback()
			if ent.IsNotFound(err) {
				return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer tidak ditemukan")
			}
			return nil, apperrors.ErrDatabase
		}
		if normalizeStatus(currentOffer.Status) != "accepted_pending_funding" {
			_ = tx.Rollback()
			return nil, apperrors.ErrInvalidInput.WithDetails("Final Offer sedang diproses. Silakan muat ulang halaman.")
		}
		if currentOffer.AcceptedAt != nil {
			now = *currentOffer.AcceptedAt
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, apperrors.ErrDatabase
	}

	if acceptApplied {
		actorID := int(ownerUserID)
		s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "final_offer_accepted", map[string]interface{}{
			"final_offer_id":    offer.ID,
			"validator_user_id": offer.ValidatorUserID,
			"amount":            offer.Amount,
			"hold_hours":        offer.HoldHours,
			"accepted_at_unix":  now.Unix(),
		})
	}

	return &EscrowDraft{
		ReceiverUsername: strings.TrimSpace(*validator.Username),
		Amount:           offer.Amount,
		HoldHours:        offer.HoldHours,
		Message:          fmt.Sprintf("Lock Funds: Validation Case #%d", vc.ID),
	}, nil
}
