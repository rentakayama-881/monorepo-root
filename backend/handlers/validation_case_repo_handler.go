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

type ValidationCaseRepoWorkflowHandler struct {
	repo *services.EntValidationCaseRepoWorkflowService
}

func NewValidationCaseRepoWorkflowHandler(repo *services.EntValidationCaseRepoWorkflowService) *ValidationCaseRepoWorkflowHandler {
	return &ValidationCaseRepoWorkflowHandler{repo: repo}
}

// AttachRepoFile godoc
// @Summary      Upload workspace files
// @Description  Attach a file to the validation case workspace. Requires authentication.
// @Tags         ValidationCases-Workspace
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                   true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerAttachRepoFileRequest  true  "File details"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/files [post]
func (h *ValidationCaseRepoWorkflowHandler) AttachRepoFile(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		DocumentID string `json:"document_id" binding:"required"`
		Kind       string `json:"kind" binding:"required"`
		Label      string `json:"label" binding:"required"`
		Visibility string `json:"visibility"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	tree, err := h.repo.AttachRepoFile(
		c.Request.Context(),
		validationCaseID,
		uint(user.ID),
		strings.TrimSpace(req.DocumentID),
		req.Kind,
		req.Label,
		req.Visibility,
		strings.TrimSpace(c.GetHeader("Authorization")),
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// GetRepoTree godoc
// @Summary      Get workspace file tree
// @Description  Get the file tree for a validation case workspace. Requires authentication.
// @Tags         ValidationCases-Workspace
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/tree [get]
func (h *ValidationCaseRepoWorkflowHandler) GetRepoTree(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	tree, err := h.repo.GetRepoTree(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// PublishRepoCase godoc
// @Summary      Publish workspace
// @Description  Publish the workspace for a validation case. Only the case owner can publish.
// @Tags         ValidationCases-Workspace
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/publish [post]
func (h *ValidationCaseRepoWorkflowHandler) PublishRepoCase(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	tree, err := h.repo.PublishRepoCase(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// ApplyForRepoCase godoc
// @Summary      Apply to validate
// @Description  Apply as a validator for a validation case. Requires authentication.
// @Tags         ValidationCases-Workspace
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      409  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/apply [post]
func (h *ValidationCaseRepoWorkflowHandler) ApplyForRepoCase(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	tree, err := h.repo.ApplyForRepoValidation(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// AssignValidators godoc
// @Summary      Assign validators
// @Description  Assign specific validators to a validation case. Only the case owner can assign.
// @Tags         ValidationCases-Workspace
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                      true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerAssignValidatorsRequest   true  "Validator IDs and panel size"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/validators/assign [post]
func (h *ValidationCaseRepoWorkflowHandler) AssignValidators(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		ValidatorUserIDs []uint `json:"validator_user_ids"`
		PanelSize        int    `json:"panel_size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	tree, err := h.repo.AssignRepoValidators(
		c.Request.Context(),
		validationCaseID,
		uint(user.ID),
		req.ValidatorUserIDs,
		req.PanelSize,
		strings.TrimSpace(c.GetHeader("Authorization")),
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// VoteConfidence godoc
// @Summary      Vote confidence
// @Description  Vote confidence for a validator in a validation case workspace.
// @Tags         ValidationCases-Workspace
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                    true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerVoteConfidenceRequest   true  "Validator user ID"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/confidence/vote [post]
func (h *ValidationCaseRepoWorkflowHandler) VoteConfidence(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		ValidatorUserID uint `json:"validator_user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	tree, err := h.repo.VoteRepoValidatorConfidence(
		c.Request.Context(),
		validationCaseID,
		uint(user.ID),
		req.ValidatorUserID,
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// FinalizeRepoCase godoc
// @Summary      Finalize validation
// @Description  Finalize the validation process for a case. Only the case owner can finalize.
// @Tags         ValidationCases-Workspace
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/finalize [post]
func (h *ValidationCaseRepoWorkflowHandler) FinalizeRepoCase(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	tree, err := h.repo.FinalizeRepoCase(
		c.Request.Context(),
		validationCaseID,
		uint(user.ID),
		strings.TrimSpace(c.GetHeader("Authorization")),
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// AutoAssignValidators godoc
// @Summary      Auto-assign validators
// @Description  Automatically assign validators to a validation case. Only the case owner can trigger.
// @Tags         ValidationCases-Workspace
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                          true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerAutoAssignValidatorsRequest   true  "Panel size (optional)"
// @Success      200  {object}  handlers.SwaggerRepoTreeResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/validators/auto-assign [post]
func (h *ValidationCaseRepoWorkflowHandler) AutoAssignValidators(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		PanelSize int `json:"panel_size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	tree, err := h.repo.AutoAssignRepoValidators(
		c.Request.Context(),
		validationCaseID,
		uint(user.ID),
		req.PanelSize,
		strings.TrimSpace(c.GetHeader("Authorization")),
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

// SubmitVerdict godoc
// @Summary      Submit verdicts
// @Description  Submit a validation verdict for a case. Only assigned validators can submit.
// @Tags         ValidationCases-Workspace
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  int                                   true  "Validation Case ID"
// @Param        body  body  handlers.SwaggerVerdictSubmitRequest   true  "Verdict details"
// @Success      200  {object}  handlers.SwaggerConsensusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      403  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/verdicts [post]
func (h *ValidationCaseRepoWorkflowHandler) SubmitVerdict(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		Verdict    string `json:"verdict" binding:"required"`
		Confidence int    `json:"confidence"`
		Notes      string `json:"notes"`
		DocumentID string `json:"document_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	consensus, err := h.repo.SubmitRepoVerdict(
		c.Request.Context(),
		validationCaseID,
		uint(user.ID),
		req.Verdict,
		req.Confidence,
		req.Notes,
		req.DocumentID,
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"consensus": consensus})
}

// GetConsensus godoc
// @Summary      Get consensus status
// @Description  Get the current consensus status for a validation case workspace.
// @Tags         ValidationCases-Workspace
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  int  true  "Validation Case ID"
// @Success      200  {object}  handlers.SwaggerConsensusResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /validation-cases/{id}/workspace/consensus [get]
func (h *ValidationCaseRepoWorkflowHandler) GetConsensus(c *gin.Context) {
	validationCaseID, ok := parseUintParam(c, "id", "validation_case_id")
	if !ok {
		return
	}
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	consensus, err := h.repo.GetRepoConsensus(c.Request.Context(), validationCaseID, uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"consensus": consensus})
}
