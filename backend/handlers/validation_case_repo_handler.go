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
	)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

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

	tree, err := h.repo.AssignRepoValidators(c.Request.Context(), validationCaseID, uint(user.ID), req.ValidatorUserIDs, req.PanelSize)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

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

	tree, err := h.repo.AutoAssignRepoValidators(c.Request.Context(), validationCaseID, uint(user.ID), req.PanelSize)
	if err != nil {
		handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"repo_tree": tree})
}

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
