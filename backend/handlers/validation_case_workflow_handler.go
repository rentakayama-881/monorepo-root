package handlers

import (
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
