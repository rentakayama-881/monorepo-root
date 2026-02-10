package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"backend-gin/ent"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
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
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	id, err := h.workflow.RequestConsultation(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (h *ValidationCaseWorkflowHandler) ListConsultationRequests(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	items, err := h.workflow.ListConsultationRequestsForOwner(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"consultation_requests": items})
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
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	if err := h.workflow.ApproveConsultationRequest(c.Request.Context(), validationCaseID, uint(user.ID), requestID); err != nil {
		h.handleError(c, err)
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
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if len(reason) < 5 {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("reason minimal 5 karakter"))
		return
	}

	if err := h.workflow.RejectConsultationRequest(c.Request.Context(), validationCaseID, uint(user.ID), requestID, reason); err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) RevealContact(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	telegram, err := h.workflow.RevealOwnerTelegramContact(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"telegram": telegram})
}

func (h *ValidationCaseWorkflowHandler) SubmitFinalOffer(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	var req struct {
		HoldHours int    `json:"hold_hours"`
		Terms     string `json:"terms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	id, err := h.workflow.SubmitFinalOffer(c.Request.Context(), validationCaseID, uint(user.ID), req.HoldHours, req.Terms)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (h *ValidationCaseWorkflowHandler) ListFinalOffers(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	items, err := h.workflow.ListFinalOffers(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		h.handleError(c, err)
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
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	draft, err := h.workflow.AcceptFinalOffer(c.Request.Context(), validationCaseID, uint(user.ID), offerID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"escrow_draft": draft})
}

func (h *ValidationCaseWorkflowHandler) ConfirmLockFunds(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	var req struct {
		TransferID string `json:"transfer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.ConfirmLockFunds(c.Request.Context(), validationCaseID, uint(user.ID), req.TransferID, authHeader); err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) SubmitArtifact(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	var req struct {
		DocumentID string `json:"document_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.SubmitArtifact(c.Request.Context(), validationCaseID, uint(user.ID), req.DocumentID, authHeader); err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) MarkEscrowReleased(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.MarkEscrowReleased(c.Request.Context(), validationCaseID, uint(user.ID), authHeader); err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// InternalMarkEscrowReleasedByTransfer is called by Feature Service (auto-release worker).
// Protected by InternalServiceAuth middleware (X-Internal-Api-Key).
func (h *ValidationCaseWorkflowHandler) InternalMarkEscrowReleasedByTransfer(c *gin.Context) {
	var req struct {
		TransferID string `json:"transfer_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	id, err := h.workflow.MarkEscrowReleasedInternalByTransferID(c.Request.Context(), req.TransferID)
	if err != nil {
		h.handleError(c, err)
		return
	}

	validationCaseID := 0
	if id != nil {
		validationCaseID = *id
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "validation_case_id": validationCaseID})
}

func (h *ValidationCaseWorkflowHandler) AttachDispute(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	var req struct {
		DisputeID string `json:"dispute_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	authHeader := c.GetHeader("Authorization")
	if err := h.workflow.AttachDispute(c.Request.Context(), validationCaseID, uint(user.ID), req.DisputeID, authHeader); err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *ValidationCaseWorkflowHandler) GetCaseLog(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := getEntUserFromContext(c)
	if !ok {
		return
	}

	items, err := h.workflow.GetCaseLog(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"case_log": items})
}

func (h *ValidationCaseWorkflowHandler) handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		logger.Debug("ValidationCase workflow handler error",
			zap.String("code", appErr.Code),
			zap.String("message", appErr.Message),
			zap.Int("status", appErr.StatusCode),
		)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	logger.Error("Unexpected error in validation case workflow handler", zap.Error(err))
	c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
}

func parseUintParam(c *gin.Context, paramName string, label string) (uint, bool) {
	raw := strings.TrimSpace(c.Param(paramName))
	v, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || v == 0 {
		c.JSON(http.StatusBadRequest, apperrors.ErrorResponse(apperrors.ErrInvalidInput.WithDetails(label+" harus berupa angka")))
		return 0, false
	}
	return uint(v), true
}

func getEntUserFromContext(c *gin.Context) (*ent.User, bool) {
	userIfc, ok := c.Get("user")
	if !ok {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return nil, false
	}
	u, ok := userIfc.(*ent.User)
	if !ok || u == nil {
		c.JSON(http.StatusUnauthorized, apperrors.ErrorResponse(apperrors.ErrUnauthorized))
		return nil, false
	}
	return u, true
}
