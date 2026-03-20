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

// RequestConsultation godoc
// @Summary      Submit consultation request
// @Description  Submit a consultation request for a validation case. Requires authentication.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerIDResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      409  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/consultation-requests [post]
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

// ListConsultationRequests godoc
// @Summary      List consultation requests
// @Description  List all consultation requests for a validation case. Only the case owner can view.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerConsultationRequestListResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/consultation-requests [get]
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

// GetMyConsultationRequest godoc
// @Summary      Get my consultation request
// @Description  Get the current user's consultation request for a validation case.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerConsultationRequestSingleResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/consultation-requests/me [get]
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

// ApproveConsultationRequest godoc
// @Summary      Approve consultation request
// @Description  Approve a consultation request. Only the case owner can approve.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id         path  int  true  "Validation Case ID"
// @Param        requestId  path  int  true  "Consultation Request ID"
// @Success      200  {object}  handlers.SwaggerStatusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/consultation-requests/{requestId}/approve [post]
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

// RejectConsultationRequest godoc
// @Summary      Reject consultation request
// @Description  Reject a consultation request with a reason. Only the case owner can reject.
// @Tags         ValidationCases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id         path  int                                       true  "Validation Case ID"
// @Param        requestId  path  int                                       true  "Consultation Request ID"
// @Param        body       body  handlers.SwaggerRejectConsultationRequest  true  "Rejection reason"
// @Success      200  {object}  handlers.SwaggerStatusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/consultation-requests/{requestId}/reject [post]
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

// RevealContact godoc
// @Summary      Get case contact info
// @Description  Reveal the case owner's Telegram contact. Only approved validators can access.
// @Tags         ValidationCases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerContactRevealResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/contact [get]
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
