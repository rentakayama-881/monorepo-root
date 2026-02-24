package handlers

import (
	"net/http"
	"strconv"

	apperrors "backend-gin/errors"
	"backend-gin/services"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
)

type ValidationCaseHandler struct {
	caseService services.ValidationCaseServiceInterface
}

func NewValidationCaseHandler(caseService services.ValidationCaseServiceInterface) *ValidationCaseHandler {
	return &ValidationCaseHandler{
		caseService: caseService,
	}
}

// GET /api/categories
func (h *ValidationCaseHandler) GetCategories(c *gin.Context) {
	categories, err := h.caseService.GetCategories(c.Request.Context())
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

// GET /api/validation-cases/category/:slug
func (h *ValidationCaseHandler) GetValidationCasesByCategory(c *gin.Context) {
	slug := c.Param("slug")

	result, err := h.caseService.ListValidationCasesByCategory(c.Request.Context(), slug, 100)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"category":         result.Category,
		"validation_cases": result.Cases,
	})
}

// GET /api/validation-cases/latest
func (h *ValidationCaseHandler) GetLatestValidationCases(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	categorySlug := c.Query("category")

	cases, err := h.caseService.ListLatestValidationCases(c.Request.Context(), categorySlug, limit)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"validation_cases": cases})
}

// GET /api/validation-cases/:id (auth required)
func (h *ValidationCaseHandler) GetValidationCaseDetail(c *gin.Context) {
	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	vc, err := h.caseService.GetValidationCaseByID(c.Request.Context(), uint(validationCaseID), uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, vc)
}

// GET /api/validation-cases/:id/public (no auth)
func (h *ValidationCaseHandler) GetPublicValidationCaseDetail(c *gin.Context) {
	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	vc, err := h.caseService.GetValidationCaseByID(c.Request.Context(), uint(validationCaseID), 0)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, vc)
}

// POST /api/validation-cases (auth required)
func (h *ValidationCaseHandler) CreateValidationCase(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	var req struct {
		CategorySlug            string      `json:"category_slug" binding:"required"`
		Title                   string      `json:"title" binding:"required"`
		Summary                 string      `json:"summary"`
		ContentType             string      `json:"content_type"`
		Content                 interface{} `json:"content" binding:"required"`
		BountyAmount            int64       `json:"bounty_amount" binding:"required"`
		Meta                    interface{} `json:"meta"`
		TagSlugs                []string    `json:"tag_slugs"`
		WorkspaceBootstrapFiles []struct {
			DocumentID string `json:"document_id"`
			Kind       string `json:"kind"`
			Label      string `json:"label"`
			Visibility string `json:"visibility"`
		} `json:"workspace_bootstrap_files"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	bootstrapFiles := make([]validators.WorkspaceBootstrapFileInput, 0, len(req.WorkspaceBootstrapFiles))
	for _, file := range req.WorkspaceBootstrapFiles {
		bootstrapFiles = append(bootstrapFiles, validators.WorkspaceBootstrapFileInput{
			DocumentID: file.DocumentID,
			Kind:       file.Kind,
			Label:      file.Label,
			Visibility: file.Visibility,
		})
	}

	input := validators.CreateValidationCaseInput{
		CategorySlug:            req.CategorySlug,
		Title:                   req.Title,
		Summary:                 req.Summary,
		ContentType:             req.ContentType,
		Content:                 req.Content,
		BountyAmount:            req.BountyAmount,
		Meta:                    req.Meta,
		TagSlugs:                req.TagSlugs,
		WorkspaceBootstrapFiles: bootstrapFiles,
	}

	vc, err := h.caseService.CreateValidationCase(c.Request.Context(), uint(user.ID), input)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": vc.ID})
}

// PUT /api/validation-cases/:id (auth required)
func (h *ValidationCaseHandler) UpdateValidationCase(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	var req struct {
		Title        *string     `json:"title"`
		Summary      *string     `json:"summary"`
		ContentType  *string     `json:"content_type"`
		Content      interface{} `json:"content"`
		BountyAmount *int64      `json:"bounty_amount"`
		Meta         interface{} `json:"meta"`
		TagSlugs     *[]string   `json:"tag_slugs"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	input := validators.UpdateValidationCaseInput{
		ValidationCaseID: uint(validationCaseID),
		Title:            req.Title,
		Summary:          req.Summary,
		ContentType:      req.ContentType,
		Content:          req.Content,
		BountyAmount:     req.BountyAmount,
		Meta:             req.Meta,
		TagSlugs:         req.TagSlugs,
	}

	if err := h.caseService.UpdateValidationCase(c.Request.Context(), uint(user.ID), input); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "id": validationCaseID})
}

// GET /api/validation-cases/me (auth required)
func (h *ValidationCaseHandler) GetUserValidationCases(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	cases, err := h.caseService.ListUserValidationCases(c.Request.Context(), uint(user.ID))
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"validation_cases": cases})
}

func (h *ValidationCaseHandler) GetMyValidationCases(c *gin.Context) {
	h.GetUserValidationCases(c)
}

// GET /api/user/:username/validation-cases
func (h *ValidationCaseHandler) GetValidationCasesByUsername(c *gin.Context) {
	username := c.Param("username")

	cases, err := h.caseService.ListValidationCasesByUsername(c.Request.Context(), username)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"validation_cases": cases})
}

// DELETE /api/validation-cases/:id (auth required)
func (h *ValidationCaseHandler) DeleteValidationCase(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	if err := h.caseService.DeleteValidationCase(c.Request.Context(), uint(user.ID), uint(validationCaseID)); err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Validation Case berhasil dihapus"})
}
