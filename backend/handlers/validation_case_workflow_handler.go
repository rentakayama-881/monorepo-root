package handlers

import (
	"errors"
	"io"
	"net/http"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

type ValidationCaseWorkflowHandler struct {
	workflow *services.EntValidationCaseWorkflowService
}

func NewValidationCaseWorkflowHandler(workflow *services.EntValidationCaseWorkflowService) *ValidationCaseWorkflowHandler {
	return &ValidationCaseWorkflowHandler{workflow: workflow}
}

func (h *ValidationCaseWorkflowHandler) RequestConsultation(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	id, err := h.workflow.RequestConsultation(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (h *ValidationCaseWorkflowHandler) ListConsultationRequests(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	items, err := h.workflow.ListConsultationRequestsForOwner(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"consultation_requests": items})
}

func (h *ValidationCaseWorkflowHandler) GetMyConsultationRequest(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	item, err := h.workflow.GetConsultationRequestForValidator(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"consultation_request": item})
}

func (h *ValidationCaseWorkflowHandler) ApproveConsultationRequest(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	requestID, ok := parseUintParam(c, "requestId", "consultation_request_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	if err := h.workflow.ApproveConsultationRequest(c.Request.Context(), validationCaseID, uint(user.ID), requestID); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) RejectConsultationRequest(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	requestID, ok := parseUintParam(c, "requestId", "consultation_request_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if len(reason) < 5 {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("reason minimal 5 karakter"))
		return
	}

	if err := h.workflow.RejectConsultationRequest(c.Request.Context(), validationCaseID, uint(user.ID), requestID, reason); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) RequestOwnerClarification(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	requestID, ok := parseUintParam(c, "requestId", "consultation_request_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req services.ClarificationRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	if err := h.workflow.RequestOwnerClarification(c.Request.Context(), validationCaseID, requestID, uint(user.ID), req); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) RequestOwnerClarificationFromValidator(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req services.ClarificationRequestInput
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	if err := h.workflow.RequestOwnerClarificationForValidator(c.Request.Context(), validationCaseID, uint(user.ID), req); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) RespondOwnerClarification(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	requestID, ok := parseUintParam(c, "requestId", "consultation_request_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req services.ClarificationResponseInput
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	if err := h.workflow.RespondOwnerClarification(c.Request.Context(), validationCaseID, requestID, uint(user.ID), req); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) RevealContact(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	telegram, err := h.workflow.RevealOwnerTelegramContact(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"telegram": telegram})
}

func (h *ValidationCaseWorkflowHandler) SubmitFinalOffer(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		HoldHours int    `json:"hold_hours"`
		Terms     string `json:"terms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	id, err := h.workflow.SubmitFinalOffer(c.Request.Context(), validationCaseID, uint(user.ID), req.HoldHours, req.Terms)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (h *ValidationCaseWorkflowHandler) ListFinalOffers(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	items, err := h.workflow.ListFinalOffers(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"final_offers": items})
}

func (h *ValidationCaseWorkflowHandler) AcceptFinalOffer(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	offerID, ok := parseUintParam(c, "offerId", "final_offer_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	draft, err := h.workflow.AcceptFinalOffer(c.Request.Context(), validationCaseID, uint(user.ID), offerID)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"escrow_draft": draft})
}

func (h *ValidationCaseWorkflowHandler) ConfirmLockFunds(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		TransferID string `json:"transfer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.ConfirmLockFunds(c.Request.Context(), validationCaseID, uint(user.ID), req.TransferID, authHeader); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) SubmitArtifact(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		DocumentID string `json:"document_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.SubmitArtifact(c.Request.Context(), validationCaseID, uint(user.ID), req.DocumentID, authHeader); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) MarkEscrowReleased(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.MarkEscrowReleased(c.Request.Context(), validationCaseID, uint(user.ID), authHeader); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// Called by Feature Service (auto-release worker).
// Protected by InternalServiceAuth middleware (X-Internal-Api-Key).
func (h *ValidationCaseWorkflowHandler) InternalMarkEscrowReleasedByTransfer(c *gin.Context) {
	var req struct {
		TransferID string `json:"transfer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	id, err := h.workflow.MarkEscrowReleasedInternalByTransferID(c.Request.Context(), req.TransferID)
	if err != nil {
		handleError(c, err)
		return
	}

	validationCaseID := 0
	if id != nil {
		validationCaseID = *id
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "validation_case_id": validationCaseID})
}

// Called by Feature Service after dispute settlement (refund/release).
// Protected by InternalServiceAuth middleware (X-Internal-Api-Key).
func (h *ValidationCaseWorkflowHandler) InternalSettleDisputeByTransfer(c *gin.Context) {
	var req struct {
		TransferID string `json:"transfer_id" binding:"required"`
		DisputeID  string `json:"dispute_id" binding:"required"`
		Outcome    string `json:"outcome" binding:"required"`
		Source     string `json:"source"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	id, err := h.workflow.SettleDisputeInternalByTransferID(
		c.Request.Context(),
		req.TransferID,
		req.DisputeID,
		req.Outcome,
		req.Source,
	)
	if err != nil {
		handleError(c, err)
		return
	}

	validationCaseID := 0
	if id != nil {
		validationCaseID = *id
	}
	c.JSON(http.StatusOK, gin.H{
		"status":             "ok",
		"validation_case_id": validationCaseID,
	})
}

// Called by Feature Service before guarantee release.
// Protected by InternalServiceAuth middleware (X-Internal-Api-Key).
func (h *ValidationCaseWorkflowHandler) InternalGetValidatorConsultationLocks(c *gin.Context) {
	validatorUserID, ok := parseUintParam(c, "id", "validator_user_id")
	if !ok {
		return
	}

	locks, err := h.workflow.ListConsultationGuaranteeLocksForValidator(c.Request.Context(), validatorUserID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"validator_user_id":            validatorUserID,
		"has_active_consultation_lock": len(locks) > 0,
		"locks":                        locks,
	})
}

func (h *ValidationCaseWorkflowHandler) AttachDispute(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		DisputeID string `json:"dispute_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.AttachDispute(c.Request.Context(), validationCaseID, uint(user.ID), req.DisputeID, authHeader); err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) GetCaseLog(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	items, err := h.workflow.GetCaseLog(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"case_log": items})
}
