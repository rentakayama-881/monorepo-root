package handlers

import (
	"net/http"
	"strconv"

	"backend-gin/ent"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/services"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ValidationCaseHandler handles HTTP requests for Validation Cases.
type ValidationCaseHandler struct {
	caseService services.ValidationCaseServiceInterface
}

// NewValidationCaseHandler creates a new Validation Case handler.
func NewValidationCaseHandler(caseService services.ValidationCaseServiceInterface) *ValidationCaseHandler {
	return &ValidationCaseHandler{
		caseService: caseService,
	}
}

// GetCategories handles GET /api/categories
func (h *ValidationCaseHandler) GetCategories(c *gin.Context) {
	categories, err := h.caseService.GetCategories(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

// GetValidationCasesByCategory handles GET /api/validation-cases/category/:slug
func (h *ValidationCaseHandler) GetValidationCasesByCategory(c *gin.Context) {
	slug := c.Param("slug")

	result, err := h.caseService.ListValidationCasesByCategory(c.Request.Context(), slug, 100)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"category":         result.Category,
		"validation_cases": result.Cases,
	})
}

// GetLatestValidationCases handles GET /api/validation-cases/latest
func (h *ValidationCaseHandler) GetLatestValidationCases(c *gin.Context) {
	// Parse limit
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	// Parse optional category filter
	categorySlug := c.Query("category")

	cases, err := h.caseService.ListLatestValidationCases(c.Request.Context(), categorySlug, limit)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"validation_cases": cases})
}

// GetValidationCaseDetail handles GET /api/validation-cases/:id (auth required)
func (h *ValidationCaseHandler) GetValidationCaseDetail(c *gin.Context) {
	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	vc, err := h.caseService.GetValidationCaseByID(c.Request.Context(), uint(validationCaseID), uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, vc)
}

// GetPublicValidationCaseDetail handles GET /api/validation-cases/:id/public (no auth)
func (h *ValidationCaseHandler) GetPublicValidationCaseDetail(c *gin.Context) {
	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	vc, err := h.caseService.GetValidationCaseByID(c.Request.Context(), uint(validationCaseID), 0)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, vc)
}

// CreateValidationCase handles POST /api/validation-cases (auth required)
func (h *ValidationCaseHandler) CreateValidationCase(c *gin.Context) {
	// Get user from context
	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	// Parse request
	var req struct {
		CategorySlug string      `json:"category_slug" binding:"required"`
		Title        string      `json:"title" binding:"required"`
		Summary      string      `json:"summary"`
		ContentType  string      `json:"content_type"`
		Content      interface{} `json:"content" binding:"required"`
		BountyAmount int64       `json:"bounty_amount" binding:"required"`
		Meta         interface{} `json:"meta"`
		TagSlugs     []string    `json:"tag_slugs"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	// Create input
	input := validators.CreateValidationCaseInput{
		CategorySlug: req.CategorySlug,
		Title:        req.Title,
		Summary:      req.Summary,
		ContentType:  req.ContentType,
		Content:      req.Content,
		BountyAmount: req.BountyAmount,
		Meta:         req.Meta,
		TagSlugs:     req.TagSlugs,
	}

	// Create validation case
	vc, err := h.caseService.CreateValidationCase(c.Request.Context(), uint(user.ID), input)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": vc.ID})
}

// UpdateValidationCase handles PUT /api/validation-cases/:id (auth required)
func (h *ValidationCaseHandler) UpdateValidationCase(c *gin.Context) {
	// Get user from context
	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	// Parse validation case ID
	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	// Parse request
	var req struct {
		Title       *string      `json:"title"`
		Summary     *string      `json:"summary"`
		ContentType *string      `json:"content_type"`
		Content     interface{}  `json:"content"`
		BountyAmount *int64      `json:"bounty_amount"`
		Meta        interface{}  `json:"meta"`
		TagSlugs    *[]string    `json:"tag_slugs"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	// Create input
	input := validators.UpdateValidationCaseInput{
		ValidationCaseID: uint(validationCaseID),
		Title:       req.Title,
		Summary:     req.Summary,
		ContentType: req.ContentType,
		Content:     req.Content,
		BountyAmount: req.BountyAmount,
		Meta:        req.Meta,
		TagSlugs:    req.TagSlugs,
	}

	// Update validation case
	if err := h.caseService.UpdateValidationCase(c.Request.Context(), uint(user.ID), input); err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "id": validationCaseID})
}

// GetUserValidationCases handles GET /api/validation-cases/me (auth required)
func (h *ValidationCaseHandler) GetUserValidationCases(c *gin.Context) {
	// Get user from context
	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	cases, err := h.caseService.ListUserValidationCases(c.Request.Context(), uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"validation_cases": cases})
}

// GetMyValidationCases is an alias for GetUserValidationCases for /api/validation-cases/me endpoint.
func (h *ValidationCaseHandler) GetMyValidationCases(c *gin.Context) {
	h.GetUserValidationCases(c)
}

// GetValidationCasesByUsername handles GET /api/user/:username/validation-cases
func (h *ValidationCaseHandler) GetValidationCasesByUsername(c *gin.Context) {
	username := c.Param("username")

	cases, err := h.caseService.ListValidationCasesByUsername(c.Request.Context(), username)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"validation_cases": cases})
}

// DeleteValidationCase handles DELETE /api/validation-cases/:id (auth required)
func (h *ValidationCaseHandler) DeleteValidationCase(c *gin.Context) {
	// Get user from context
	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	// Parse validation case ID
	idStr := c.Param("id")
	validationCaseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("validation_case_id harus berupa angka"))
		return
	}

	// Delete validation case
	if err := h.caseService.DeleteValidationCase(c.Request.Context(), uint(user.ID), uint(validationCaseID)); err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Validation Case berhasil dihapus"})
}

// handleError handles errors consistently
func (h *ValidationCaseHandler) handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		logger.Debug("ValidationCase handler error",
			zap.String("code", appErr.Code),
			zap.String("message", appErr.Message),
			zap.Int("status", appErr.StatusCode),
		)
		c.JSON(appErr.StatusCode, apperrors.ErrorResponse(appErr))
		return
	}

	// Unknown error
	logger.Error("Unexpected error in validation case handler",
		zap.Error(err),
	)
	c.JSON(http.StatusInternalServerError, apperrors.ErrorResponse(apperrors.ErrInternalServer))
}
