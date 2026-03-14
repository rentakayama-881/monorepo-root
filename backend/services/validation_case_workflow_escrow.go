package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/ent"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"go.uber.org/zap"
)

type featureServiceError struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Details []string `json:"details"`
}

type featureServiceResponse[T any] struct {
	Success bool                 `json:"success"`
	Data    *T                   `json:"data"`
	Error   *featureServiceError `json:"error"`
	Message string               `json:"message"`
}

type featureTransferDto struct {
	ID         string     `json:"id"`
	SenderID   uint       `json:"senderId"`
	ReceiverID uint       `json:"receiverId"`
	Amount     int64      `json:"amount"`
	Status     string     `json:"status"`
	HoldUntil  *time.Time `json:"holdUntil"`
}

type featureDisputeDto struct {
	ID         string `json:"id"`
	TransferID string `json:"transferId"`
	Status     string `json:"status"`
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
	if err := ensureWorkflowV1Case(vc); err != nil {
		return err
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
	if offer.WorkflowCycle != currentWorkflowCycle(vc) {
		return apperrors.ErrInvalidInput.WithDetails("Final Offer berasal dari siklus workflow sebelumnya")
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
		SetStatus(caseStatusFundsLocked).
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
	isManualSubmission := false
	if documentID == "" {
		// Manual artifact mark (no file upload): create a stable internal marker.
		documentID = fmt.Sprintf("artifact-submission-auto-%d-%d-%d", validationCaseID, validatorUserID, time.Now().Unix())
		isManualSubmission = true
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
		// Authenticated user, but only the accepted validator may upload the artifact.
		return apperrors.ErrArtifactSubmissionAccessDenied
	}

	// Share document only when the submission references a real document in Feature Service.
	if !isManualSubmission {
		if err := s.shareDocumentWithCaseOwner(ctx, authHeader, documentID, uint(vc.UserID)); err != nil {
			return apperrors.ErrInvalidInput.WithDetails(err.Error())
		}
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
		SetStatus(caseStatusArtifactSubmitted).
		Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	actorID := int(validatorUserID)
	s.appendCaseLogBestEffort(ctx, vc.ID, &actorID, "artifact_submitted", map[string]interface{}{
		"document_id":       documentID,
		"manual_submission": isManualSubmission,
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
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			logger.Warn("failed to decode feature-service error response", zap.Error(err))
		}
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
	if err := ensureWorkflowV1Case(vc); err != nil {
		return err
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
		SetStatus(caseStatusCompleted).
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
	if err := ensureWorkflowV1Case(vc); err != nil {
		return nil, err
	}

	// Promote Artifact Submission to Certified Artifact (in this model: same document id).
	artifactID := vc.ArtifactDocumentID
	if artifactID == nil || strings.TrimSpace(*artifactID) == "" {
		return nil, apperrors.ErrInvalidInput.WithDetails("Artifact Submission belum ada")
	}

	// Idempotent: if already completed and certified artifact set, no-op.
	if normalizeStatus(vc.Status) == caseStatusCompleted && vc.CertifiedArtifactDocumentID != nil && strings.TrimSpace(*vc.CertifiedArtifactDocumentID) != "" {
		return &vc.ID, nil
	}

	certified := strings.TrimSpace(*artifactID)
	if _, err := s.client.ValidationCase.UpdateOneID(vc.ID).
		SetCertifiedArtifactDocumentID(certified).
		SetStatus(caseStatusCompleted).
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
