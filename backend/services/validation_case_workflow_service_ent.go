package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
	"backend-gin/ent/validationcaselog"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// EntValidationCaseWorkflowService implements the Validation Protocol workflow for Validation Cases.
// Financial actions (escrow/dispute) are verified against Feature Service using the caller's Authorization header.
type EntValidationCaseWorkflowService struct {
	client *ent.Client
}

func NewEntValidationCaseWorkflowService() *EntValidationCaseWorkflowService {
	return &EntValidationCaseWorkflowService{client: database.GetEntClient()}
}

// minCredibilityStakeIDR returns minimum required active guarantee/stake for validators to request consultation.
//
// Evidence basis:
// Feature Service enforces a minimum guarantee lock of Rp 100.000 for `GuaranteeService.SetGuaranteeAsync`.
// We mirror that as the default stake gate in Go backend (configurable via env).
func minCredibilityStakeIDR() int64 {
	const defaultMin = int64(100_000)
	raw := strings.TrimSpace(os.Getenv("MIN_CREDIBILITY_STAKE_IDR"))
	if raw == "" {
		return defaultMin
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || v < 0 {
		return defaultMin
	}
	return v
}

func normalizeStatus(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func unixPtr(t *time.Time) *int64 {
	if t == nil {
		return nil
	}
	v := t.Unix()
	return &v
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

func (s *EntValidationCaseWorkflowService) RequestConsultation(ctx context.Context, validationCaseID uint, validatorUserID uint) (uint, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrValidationCaseNotFound
		}
		return 0, apperrors.ErrDatabase
	}

	if vc.UserID == int(validatorUserID) {
		return 0, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat Request Consultation pada kasusnya sendiri")
	}

	validator, err := s.client.User.Get(ctx, int(validatorUserID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrUserNotFound
		}
		return 0, apperrors.ErrDatabase
	}

	requiredStake := minCredibilityStakeIDR()
	if validator.GuaranteeAmount < requiredStake {
		return 0, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("Credibility Stake tidak memenuhi syarat. Minimal Rp %d", requiredStake))
	}

	exists, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(int(validationCaseID)),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
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
		SetStatus("pending").
		Save(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "consultation_requested", map[string]interface{}{
		"validator_user_id": validatorUserID,
		"required_stake":    requiredStake,
	})

	return uint(req.ID), nil
}

func (s *EntValidationCaseWorkflowService) ListConsultationRequestsForOwner(ctx context.Context, validationCaseID uint, ownerUserID uint) ([]ConsultationRequestItem, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}

	items, err := s.client.ConsultationRequest.Query().
		Where(consultationrequest.ValidationCaseIDEQ(int(validationCaseID))).
		WithValidatorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Order(ent.Desc(consultationrequest.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	out := make([]ConsultationRequestItem, 0, len(items))
	for _, it := range items {
		validator := buildUserSummaryFromEnt(it.Edges.ValidatorUser)
		out = append(out, ConsultationRequestItem{
			ID:               uint(it.ID),
			ValidationCaseID: validationCaseID,
			Validator:        validator,
			Status:           it.Status,
			ApprovedAt:       unixPtr(it.ApprovedAt),
			RejectedAt:       unixPtr(it.RejectedAt),
			CreatedAt:        it.CreatedAt.Unix(),
		})
	}
	return out, nil
}

func (s *EntValidationCaseWorkflowService) ApproveConsultationRequest(ctx context.Context, validationCaseID uint, ownerUserID uint, requestID uint) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
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

	if normalizeStatus(req.Status) != "pending" {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak dalam status pending")
	}

	now := time.Now()
	if _, err := s.client.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus("approved").
		SetApprovedAt(now).
		ClearRejectedAt().
		Save(ctx); err != nil {
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

	if normalizeStatus(req.Status) != "pending" {
		return apperrors.ErrInvalidInput.WithDetails("Consultation Request tidak dalam status pending")
	}

	now := time.Now()
	if _, err := s.client.ConsultationRequest.UpdateOneID(req.ID).
		SetStatus("rejected").
		SetRejectedAt(now).
		ClearApprovedAt().
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

func (s *EntValidationCaseWorkflowService) RevealOwnerTelegramContact(ctx context.Context, validationCaseID uint, validatorUserID uint) (string, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return "", apperrors.ErrValidationCaseNotFound
		}
		return "", apperrors.ErrDatabase
	}

	req, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(vc.ID),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusEQ("approved"),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return "", apperrors.ErrUnauthorized.WithDetails("Consultation Request belum disetujui")
		}
		return "", apperrors.ErrDatabase
	}
	_ = req

	owner, err := s.client.User.Get(ctx, vc.UserID)
	if err != nil {
		return "", apperrors.ErrDatabase
	}

	telegram := strings.TrimSpace(owner.Telegram)
	if telegram == "" {
		return "", apperrors.ErrInvalidInput.WithDetails("Pemilik kasus belum mengatur Telegram di akun")
	}
	if !strings.HasPrefix(telegram, "@") {
		telegram = "@" + strings.TrimPrefix(telegram, "@")
	}

	// Log reveal at most once per validator to avoid spam.
	alreadyLogged, err := s.client.ValidationCaseLog.Query().
		Where(
			validationcaselog.ValidationCaseIDEQ(vc.ID),
			validationcaselog.ActorUserIDEQ(int(validatorUserID)),
			validationcaselog.EventTypeEQ("contact_revealed"),
		).
		Exist(ctx)
	if err == nil && !alreadyLogged {
		actorID := int(validatorUserID)
		s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "contact_revealed", map[string]interface{}{
			"channel":        "telegram",
			"owner_user_id":  vc.UserID,
			"validator_user_id": validatorUserID,
			"telegram":       telegram,
		})
	}

	return telegram, nil
}

func (s *EntValidationCaseWorkflowService) SubmitFinalOffer(ctx context.Context, validationCaseID uint, validatorUserID uint, amount int64, holdHours int, terms string) (uint, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return 0, apperrors.ErrValidationCaseNotFound
		}
		return 0, apperrors.ErrDatabase
	}

	if vc.UserID == int(validatorUserID) {
		return 0, apperrors.ErrInvalidInput.WithDetails("pemilik kasus tidak dapat mengajukan Final Offer pada kasusnya sendiri")
	}

	// Require approved consultation to submit an offer.
	approved, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidationCaseIDEQ(vc.ID),
			consultationrequest.ValidatorUserIDEQ(int(validatorUserID)),
			consultationrequest.StatusEQ("approved"),
		).
		Exist(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}
	if !approved {
		return 0, apperrors.ErrUnauthorized.WithDetails("Final Offer hanya dapat diajukan setelah Consultation disetujui")
	}

	if amount <= 0 {
		return 0, apperrors.ErrInvalidInput.WithDetails("amount harus lebih dari 0")
	}
	if amount < 10_000 {
		return 0, apperrors.ErrInvalidInput.WithDetails("amount minimal Rp 10.000")
	}
	if vc.BountyAmount > 0 && amount > vc.BountyAmount {
		return 0, apperrors.ErrInvalidInput.WithDetails("amount tidak boleh melebihi bounty_amount")
	}

	// Align with Feature Service escrow limits: default 7 days, max 30 days.
	const maxHoldHours = 30 * 24
	if holdHours <= 0 {
		holdHours = 7 * 24
	}
	if holdHours > maxHoldHours {
		holdHours = maxHoldHours
	}

	offer, err := s.client.FinalOffer.Create().
		SetValidationCaseID(vc.ID).
		SetValidatorUserID(int(validatorUserID)).
		SetAmount(amount).
		SetHoldHours(holdHours).
		SetTerms(strings.TrimSpace(terms)).
		SetStatus("submitted").
		Save(ctx)
	if err != nil {
		return 0, apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "final_offer_submitted", map[string]interface{}{
		"final_offer_id": offer.ID,
		"amount":         amount,
		"hold_hours":     holdHours,
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

	// Owner can list all offers. Validators can list their own offers.
	isOwner := vc.UserID == int(viewerUserID)

	query := s.client.FinalOffer.Query().
		Where(finaloffer.ValidationCaseIDEQ(vc.ID)).
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
	if vc.UserID != int(ownerUserID) {
		return nil, apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Lock Funds sudah dilakukan untuk kasus ini")
	}
	if vc.DisputeID != nil && strings.TrimSpace(*vc.DisputeID) != "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Kasus sedang dalam Dispute")
	}

	offer, err := s.client.FinalOffer.Query().
		Where(
			finaloffer.IDEQ(int(offerID)),
			finaloffer.ValidationCaseIDEQ(vc.ID),
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

	now := time.Now()

	// Mark offer accepted (pending funding confirmation).
	if _, err := s.client.FinalOffer.UpdateOneID(offer.ID).
		SetStatus("accepted_pending_funding").
		SetAcceptedAt(now).
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	// Remember accepted offer on the case.
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetAcceptedFinalOfferID(offer.ID).
		SetStatus("offer_accepted").
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "final_offer_accepted", map[string]interface{}{
		"final_offer_id":      offer.ID,
		"validator_user_id":   offer.ValidatorUserID,
		"amount":              offer.Amount,
		"hold_hours":          offer.HoldHours,
		"accepted_at_unix":    now.Unix(),
	})

	return &EscrowDraft{
		ReceiverUsername: strings.TrimSpace(*validator.Username),
		Amount:           offer.Amount,
		HoldHours:        offer.HoldHours,
		Message:          fmt.Sprintf("Lock Funds: Validation Case #%d", vc.ID),
	}, nil
}

type featureServiceError struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Details []string `json:"details"`
}

type featureServiceResponse[T any] struct {
	Success bool               `json:"success"`
	Data    *T                 `json:"data"`
	Error   *featureServiceError `json:"error"`
	Message string             `json:"message"`
}

type featureTransferDto struct {
	ID        string     `json:"id"`
	SenderID  uint       `json:"senderId"`
	ReceiverID uint      `json:"receiverId"`
	Amount    int64      `json:"amount"`
	Status    string     `json:"status"`
	HoldUntil *time.Time `json:"holdUntil"`
}

type featureDisputeDto struct {
	ID        string `json:"id"`
	TransferID string `json:"transferId"`
	Status    string `json:"status"`
}

func (s *EntValidationCaseWorkflowService) getFeatureTransfer(ctx context.Context, authHeader string, transferID string) (*featureTransferDto, error) {
	url := fmt.Sprintf("%s/api/v1/wallets/transfers/%s", strings.TrimRight(config.FeatureServiceURL, "/"), transferID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed featureServiceResponse[featureTransferDto]
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK || !parsed.Success || parsed.Data == nil {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return nil, fmt.Errorf("feature-service: %s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("feature-service: unexpected response")
	}
	return parsed.Data, nil
}

func (s *EntValidationCaseWorkflowService) getFeatureDispute(ctx context.Context, authHeader string, disputeID string) (*featureDisputeDto, error) {
	url := fmt.Sprintf("%s/api/v1/disputes/%s", strings.TrimRight(config.FeatureServiceURL, "/"), disputeID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed featureServiceResponse[featureDisputeDto]
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK || !parsed.Success || parsed.Data == nil {
		if parsed.Error != nil && parsed.Error.Message != "" {
			return nil, fmt.Errorf("feature-service: %s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("feature-service: unexpected response")
	}
	return parsed.Data, nil
}

func (s *EntValidationCaseWorkflowService) ConfirmLockFunds(ctx context.Context, validationCaseID uint, ownerUserID uint, transferID string, authHeader string) error {
	transferID = strings.TrimSpace(transferID)
	if transferID == "" {
		return apperrors.ErrMissingField.WithDetails("transfer_id")
	}

	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Lock Funds sudah dikonfirmasi untuk kasus ini")
	}
	if vc.AcceptedFinalOfferID == nil || *vc.AcceptedFinalOfferID <= 0 {
		return apperrors.ErrInvalidInput.WithDetails("Final Offer belum diterima")
	}

	offer, err := s.client.FinalOffer.Get(ctx, *vc.AcceptedFinalOfferID)
	if err != nil {
		return apperrors.ErrDatabase
	}

	ft, err := s.getFeatureTransfer(ctx, authHeader, transferID)
	if err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}

	if ft.SenderID != ownerUserID {
		return apperrors.ErrInvalidInput.WithDetails("transfer_id tidak valid (sender tidak sesuai)")
	}
	if ft.ReceiverID != uint(offer.ValidatorUserID) {
		return apperrors.ErrInvalidInput.WithDetails("transfer_id tidak valid (receiver tidak sesuai)")
	}
	if ft.Amount != offer.Amount {
		return apperrors.ErrInvalidInput.WithDetails("transfer_id tidak valid (amount tidak sesuai)")
	}
	if normalizeStatus(ft.Status) != "pending" {
		return apperrors.ErrInvalidInput.WithDetails("transfer harus berstatus pending untuk Lock Funds")
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetEscrowTransferID(transferID).
		SetStatus("funds_locked").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	if _, err := s.client.FinalOffer.UpdateOneID(offer.ID).
		SetStatus("accepted").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "funds_locked", map[string]interface{}{
		"escrow_transfer_id": transferID,
		"final_offer_id":     offer.ID,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) SubmitArtifact(ctx context.Context, validationCaseID uint, validatorUserID uint, documentID string, authHeader string) error {
	documentID = strings.TrimSpace(documentID)
	if documentID == "" {
		return apperrors.ErrMissingField.WithDetails("document_id")
	}

	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.AcceptedFinalOfferID == nil || *vc.AcceptedFinalOfferID <= 0 {
		return apperrors.ErrInvalidInput.WithDetails("Final Offer belum diterima")
	}
	if vc.EscrowTransferID == nil || strings.TrimSpace(*vc.EscrowTransferID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("Lock Funds belum dilakukan")
	}
	if vc.ArtifactDocumentID != nil && strings.TrimSpace(*vc.ArtifactDocumentID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Artifact Submission sudah ada")
	}

	offer, err := s.client.FinalOffer.Get(ctx, *vc.AcceptedFinalOfferID)
	if err != nil {
		return apperrors.ErrDatabase
	}
	if uint(offer.ValidatorUserID) != validatorUserID {
		return apperrors.ErrUnauthorized.WithDetails("hanya validator yang disetujui yang dapat mengunggah Artifact Submission")
	}

	// Share the document with the case owner in Feature Service (validator must be the document owner).
	if err := s.shareDocumentWithCaseOwner(ctx, authHeader, documentID, uint(vc.UserID)); err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}

	if _, err := s.client.ArtifactSubmission.Create().
		SetValidationCaseID(vc.ID).
		SetValidatorUserID(int(validatorUserID)).
		SetDocumentID(documentID).
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetArtifactDocumentID(documentID).
		SetStatus("artifact_submitted").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "artifact_submitted", map[string]interface{}{
		"document_id": documentID,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) shareDocumentWithCaseOwner(ctx context.Context, authHeader string, documentID string, ownerUserID uint) error {
	url := fmt.Sprintf("%s/api/v1/documents/%s/sharing", strings.TrimRight(config.FeatureServiceURL, "/"), documentID)
	payload := map[string]interface{}{
		"sharedWithUserIds": []uint{ownerUserID},
	}
	b, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

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
		return fmt.Errorf("feature-service: failed to share document (status %d)", resp.StatusCode)
	}
	return nil
}

func (s *EntValidationCaseWorkflowService) MarkEscrowReleased(ctx context.Context, validationCaseID uint, ownerUserID uint, authHeader string) error {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}
	if vc.EscrowTransferID == nil || strings.TrimSpace(*vc.EscrowTransferID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("escrow_transfer_id belum ada")
	}

	ft, err := s.getFeatureTransfer(ctx, authHeader, strings.TrimSpace(*vc.EscrowTransferID))
	if err != nil {
		return apperrors.ErrInvalidInput.WithDetails(err.Error())
	}

	if normalizeStatus(ft.Status) != "released" {
		return apperrors.ErrInvalidInput.WithDetails("transfer belum berstatus released")
	}

	// Promote Artifact Submission to Certified Artifact (in this model: same document id).
	certifiedID := vc.ArtifactDocumentID
	if certifiedID == nil || strings.TrimSpace(*certifiedID) == "" {
		return apperrors.ErrInvalidInput.WithDetails("Artifact Submission belum ada")
	}

	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetCertifiedArtifactDocumentID(strings.TrimSpace(*certifiedID)).
		SetStatus("completed").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "escrow_released_confirmed", map[string]interface{}{
		"escrow_transfer_id": strings.TrimSpace(*vc.EscrowTransferID),
	})
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "certified_artifact_issued", map[string]interface{}{
		"certified_artifact_document_id": strings.TrimSpace(*certifiedID),
	})

	return nil
}

// MarkEscrowReleasedInternalByTransferID is called by Feature Service (auto-release worker)
// to finalize a Validation Case after escrow funds are released.
//
// This endpoint is protected by internal API key auth and therefore does NOT re-fetch transfer state
// from Feature Service (which would require a user token). Instead, we validate local case invariants.
func (s *EntValidationCaseWorkflowService) MarkEscrowReleasedInternalByTransferID(ctx context.Context, transferID string) (*int, error) {
	transferID = strings.TrimSpace(transferID)
	if transferID == "" {
		return nil, apperrors.ErrMissingField.WithDetails("transfer_id")
	}

	vc, err := s.client.ValidationCase.Query().
		Where(validationcase.EscrowTransferIDEQ(transferID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	// Promote Artifact Submission to Certified Artifact (in this model: same document id).
	artifactID := vc.ArtifactDocumentID
	if artifactID == nil || strings.TrimSpace(*artifactID) == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Artifact Submission belum ada")
	}

	// Idempotent: if already completed and certified artifact set, no-op.
	if normalizeStatus(vc.Status) == "completed" && vc.CertifiedArtifactDocumentID != nil && strings.TrimSpace(*vc.CertifiedArtifactDocumentID) != "" {
		return &vc.ID, nil
	}

	certified := strings.TrimSpace(*artifactID)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetCertifiedArtifactDocumentID(certified).
		SetStatus("completed").
		Save(ctx); err != nil {
		return nil, apperrors.ErrDatabase
	}

	// System-generated case log entries (actor_user_id = NULL).
	s.appendCaseLogBestEffort(ctx, vc.ID, nil, "escrow_released_confirmed", map[string]interface{}{
		"escrow_transfer_id": transferID,
		"source":             "feature_service_auto_release",
	})
	s.appendCaseLogBestEffort(ctx, vc.ID, nil, "certified_artifact_issued", map[string]interface{}{
		"certified_artifact_document_id": certified,
		"source":                         "feature_service_auto_release",
	})

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
		SetStatus("disputed").
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(ownerUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "dispute_attached", map[string]interface{}{
		"dispute_id": disputeID,
		"transfer_id": strings.TrimSpace(*vc.EscrowTransferID),
		"dispute_status": fd.Status,
	})

	return nil
}

func (s *EntValidationCaseWorkflowService) GetCaseLog(ctx context.Context, validationCaseID uint, viewerUserID uint) ([]CaseLogItem, error) {
	vc, err := s.client.ValidationCase.Get(ctx, int(validationCaseID))
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	isOwner := vc.UserID == int(viewerUserID)
	if !isOwner {
		approved, err := s.client.ConsultationRequest.Query().
			Where(
				consultationrequest.ValidationCaseIDEQ(vc.ID),
				consultationrequest.ValidatorUserIDEQ(int(viewerUserID)),
				consultationrequest.StatusEQ("approved"),
			).
			Exist(ctx)
		if err != nil {
			return nil, apperrors.ErrDatabase
		}
		if !approved {
			return nil, apperrors.ErrUnauthorized
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
