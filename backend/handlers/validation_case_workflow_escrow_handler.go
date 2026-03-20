package handlers

import (
	"errors"
	"io"
	"net/http"

	apperrors "backend-gin/errors"

	"github.com/gin-gonic/gin"
)

// SubmitFinalOffer godoc
// @Summary      Submit final offer
// @Description  Submit a final offer for a validation case. Requires authentication.
// @Tags         ValidationCases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                     true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerFinalOfferSubmitRequest  true  "Offer details"
// @Success      200  {object}  handlers.SwaggerIDResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/final-offers [post]
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

// ListFinalOffers godoc
// @Summary      List final offers
// @Description  List all final offers for a validation case. Requires authentication.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerFinalOfferListResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/final-offers [get]
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

// AcceptFinalOffer godoc
// @Summary      Accept final offer
// @Description  Accept a final offer, generating an escrow draft. Only the case owner can accept.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id       path  int  true  "Validation Case ID"
// @Param        offerId  path  int  true  "Final Offer ID"
// @Success      200  {object}  handlers.SwaggerEscrowDraftResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/final-offers/{offerId}/accept [post]
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

// ConfirmLockFunds godoc
// @Summary      Lock funds in escrow
// @Description  Confirm fund locking for a validation case escrow. Requires authentication.
// @Tags         ValidationCases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                              true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerLockFundsRequest  true  "Transfer ID"
// @Success      200  {object}  handlers.SwaggerStatusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/lock-funds [post]
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

// SubmitArtifact godoc
// @Summary      Submit artifact
// @Description  Submit an artifact (evidence document) for a validation case. Requires authentication.
// @Tags         ValidationCases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                   true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerArtifactSubmitRequest  true  "Artifact document ID"
// @Success      200  {object}  handlers.SwaggerStatusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/artifact-submission [post]
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

// MarkEscrowReleased godoc
// @Summary      Release escrow
// @Description  Mark escrow as released for a validation case. Requires authentication.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerStatusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/escrow/released [post]
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

// InternalMarkEscrowReleasedByTransfer godoc
// @Summary      Escrow released callback
// @Description  Called by Feature Service when escrow funds are auto-released. Protected by X-Internal-Api-Key.
// @Tags         Internal
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        body  body      handlers.SwaggerInternalEscrowReleasedRequest  true  "Transfer info"
// @Success      200   {object}  handlers.SwaggerInternalCallbackResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      404   {object}  handlers.SwaggerErrorResponse
// @Router       /internal/validation-cases/escrow/released [post]
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

// InternalSettleDisputeByTransfer godoc
// @Summary      Dispute settled callback
// @Description  Called by Feature Service after a dispute is settled (refund or release). Protected by X-Internal-Api-Key.
// @Tags         Internal
// @Accept       json
// @Produce      json
// @Security     ApiKeyAuth
// @Param        body  body      handlers.SwaggerInternalDisputeSettledRequest  true  "Dispute settlement info"
// @Success      200   {object}  handlers.SwaggerInternalCallbackResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      404   {object}  handlers.SwaggerErrorResponse
// @Router       /internal/validation-cases/disputes/settled [post]
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

// InternalGetValidatorConsultationLocks godoc
// @Summary      Get consultation locks
// @Description  Returns active consultation guarantee locks for a validator user. Protected by X-Internal-Api-Key.
// @Tags         Internal
// @Produce      json
// @Security     ApiKeyAuth
// @Param        id   path      int  true  "Validator user ID"
// @Success      200  {object}  handlers.SwaggerInternalConsultationLocksResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      500  {object}  handlers.SwaggerErrorResponse
// @Router       /internal/users/{id}/consultation-locks [get]
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

// AttachDispute godoc
// @Summary      Attach dispute
// @Description  Attach a dispute to a validation case. Requires authentication.
// @Tags         ValidationCases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                  true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerDisputeAttachRequest  true  "Dispute ID"
// @Success      200  {object}  handlers.SwaggerStatusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/dispute/attach [post]
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

// GetCaseLog godoc
// @Summary      Get case audit log
// @Description  Get the audit log for a validation case. Requires authentication.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerCaseLogResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/case-log [get]
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
