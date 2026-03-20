package handlers

import (
	"net/http"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// FeatureFlagHandler handles feature flag CRUD and public check endpoints.
type FeatureFlagHandler struct {
	flagService *services.FeatureFlagService
}

// NewFeatureFlagHandler creates a new FeatureFlagHandler.
func NewFeatureFlagHandler(flagService *services.FeatureFlagService) *FeatureFlagHandler {
	return &FeatureFlagHandler{flagService: flagService}
}

// --- Admin CRUD endpoints ---

// ListFlags godoc
// @Summary      List all feature flags
// @Description  Returns all feature flags. Admin authentication required.
// @Tags         Admin-FeatureFlags
// @Produce      json
// @Security     AdminAuth
// @Success      200  {object}  handlers.SwaggerFeatureFlagListResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /admin/feature-flags [get]
// ListFlags returns all feature flags.
func (h *FeatureFlagHandler) ListFlags(c *gin.Context) {
	flags, err := h.flagService.List(c.Request.Context())
	if err != nil {
		handleError(c, err)
		return
	}

	type flagResponse struct {
		ID                int    `json:"id"`
		Key               string `json:"key"`
		Enabled           bool   `json:"enabled"`
		Description       string `json:"description"`
		RolloutPercentage int    `json:"rollout_percentage"`
		CreatedAt         string `json:"created_at"`
		UpdatedAt         string `json:"updated_at"`
	}

	result := make([]flagResponse, 0, len(flags))
	for _, f := range flags {
		result = append(result, flagResponse{
			ID:                f.ID,
			Key:               f.Key,
			Enabled:           f.Enabled,
			Description:       f.Description,
			RolloutPercentage: f.RolloutPercentage,
			CreatedAt:         f.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt:         f.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{"feature_flags": result})
}

// CreateFlag godoc
// @Summary      Create a feature flag
// @Description  Create a new feature flag. Admin authentication required.
// @Tags         Admin-FeatureFlags
// @Accept       json
// @Produce      json
// @Security     AdminAuth
// @Param        body  body      handlers.SwaggerFeatureFlagCreateRequest  true  "Feature flag data"
// @Success      201   {object}  handlers.SwaggerFeatureFlagCreateResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      409   {object}  handlers.SwaggerErrorResponse  "Key already exists"
// @Router       /admin/feature-flags [post]
// CreateFlag creates a new feature flag.
func (h *FeatureFlagHandler) CreateFlag(c *gin.Context) {
	var req struct {
		Key               string `json:"key" binding:"required"`
		Description       string `json:"description"`
		Enabled           bool   `json:"enabled"`
		RolloutPercentage *int   `json:"rollout_percentage"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	req.Key = strings.TrimSpace(req.Key)

	rolloutPct := 100
	if req.RolloutPercentage != nil {
		rolloutPct = *req.RolloutPercentage
	}

	flag, err := h.flagService.Create(c.Request.Context(), req.Key, req.Description, req.Enabled, rolloutPct)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Feature flag berhasil dibuat",
		"feature_flag": gin.H{
			"id":                 flag.ID,
			"key":                flag.Key,
			"enabled":            flag.Enabled,
			"description":        flag.Description,
			"rollout_percentage": flag.RolloutPercentage,
			"created_at":         flag.CreatedAt.Format("2006-01-02T15:04:05Z"),
			"updated_at":         flag.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	})
}

// UpdateFlag godoc
// @Summary      Update a feature flag
// @Description  Update an existing feature flag by key. Admin authentication required.
// @Tags         Admin-FeatureFlags
// @Accept       json
// @Produce      json
// @Security     AdminAuth
// @Param        key   path      string                                    true  "Feature flag key"
// @Param        body  body      handlers.SwaggerFeatureFlagUpdateRequest  true  "Fields to update"
// @Success      200   {object}  handlers.SwaggerFeatureFlagCreateResponse
// @Failure      400   {object}  handlers.SwaggerErrorResponse
// @Failure      401   {object}  handlers.SwaggerErrorResponse
// @Failure      404   {object}  handlers.SwaggerErrorResponse
// @Router       /admin/feature-flags/{key} [put]
// UpdateFlag updates an existing feature flag by key.
func (h *FeatureFlagHandler) UpdateFlag(c *gin.Context) {
	key := c.Param("key")

	var req struct {
		Enabled           *bool   `json:"enabled"`
		Description       *string `json:"description"`
		RolloutPercentage *int    `json:"rollout_percentage"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	flag, err := h.flagService.Update(c.Request.Context(), key, req.Enabled, req.Description, req.RolloutPercentage)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Feature flag berhasil diperbarui",
		"feature_flag": gin.H{
			"id":                 flag.ID,
			"key":                flag.Key,
			"enabled":            flag.Enabled,
			"description":        flag.Description,
			"rollout_percentage": flag.RolloutPercentage,
			"created_at":         flag.CreatedAt.Format("2006-01-02T15:04:05Z"),
			"updated_at":         flag.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	})
}

// DeleteFlag godoc
// @Summary      Delete a feature flag
// @Description  Soft-delete a feature flag by key. Admin authentication required.
// @Tags         Admin-FeatureFlags
// @Produce      json
// @Security     AdminAuth
// @Param        key  path      string  true  "Feature flag key"
// @Success      200  {object}  handlers.SwaggerMessageResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      404  {object}  handlers.SwaggerErrorResponse
// @Router       /admin/feature-flags/{key} [delete]
// DeleteFlag soft-deletes a feature flag by key.
func (h *FeatureFlagHandler) DeleteFlag(c *gin.Context) {
	key := c.Param("key")

	err := h.flagService.Delete(c.Request.Context(), key)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Feature flag berhasil dihapus",
	})
}

// --- Public endpoint ---

// CheckFlag godoc
// @Summary      Check feature flag status
// @Description  Returns whether a feature flag is enabled. No authentication required.
// @Tags         FeatureFlags
// @Produce      json
// @Param        key  path  string  true  "Feature flag key"
// @Success      200  {object}  handlers.SwaggerFeatureFlagCheckResponse
// @Router       /feature-flags/check/{key} [get]
// CheckFlag returns whether a feature flag is enabled for the current user.
func (h *FeatureFlagHandler) CheckFlag(c *gin.Context) {
	key := c.Param("key")

	// Try to get user_id from context (may be 0 for unauthenticated users)
	userID := c.GetUint("user_id")

	enabled := h.flagService.IsEnabled(c.Request.Context(), key, userID)

	c.JSON(http.StatusOK, gin.H{"enabled": enabled})
}
