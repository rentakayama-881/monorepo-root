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

// ThreadHandler handles HTTP requests for threads
type ThreadHandler struct {
	threadService services.ThreadServiceInterface
}

// NewThreadHandler creates a new thread handler
func NewThreadHandler(threadService services.ThreadServiceInterface) *ThreadHandler {
	return &ThreadHandler{
		threadService: threadService,
	}
}

// GetCategories handles GET /api/categories
func (h *ThreadHandler) GetCategories(c *gin.Context) {
	categories, err := h.threadService.GetCategories(c.Request.Context())
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

// GetThreadsByCategory handles GET /api/category/:slug
func (h *ThreadHandler) GetThreadsByCategory(c *gin.Context) {
	slug := c.Param("slug")

	result, err := h.threadService.ListThreadsByCategory(c.Request.Context(), slug, 100)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"category": result.Category,
		"threads":  result.Threads,
	})
}

// GetLatestThreads handles GET /api/threads/latest
func (h *ThreadHandler) GetLatestThreads(c *gin.Context) {
	// Parse limit
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	// Parse optional category filter
	categorySlug := c.Query("category")

	threads, err := h.threadService.ListLatestThreads(c.Request.Context(), categorySlug, limit)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"threads": threads})
}

// GetThreadDetail handles GET /api/threads/:id (auth required)
func (h *ThreadHandler) GetThreadDetail(c *gin.Context) {
	idStr := c.Param("id")
	threadID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("thread_id harus berupa angka"))
		return
	}

	thread, err := h.threadService.GetThreadByID(c.Request.Context(), uint(threadID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, thread)
}

// GetPublicThreadDetail handles GET /api/threads/:id/public (no auth)
func (h *ThreadHandler) GetPublicThreadDetail(c *gin.Context) {
	idStr := c.Param("id")
	threadID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("thread_id harus berupa angka"))
		return
	}

	thread, err := h.threadService.GetThreadByID(c.Request.Context(), uint(threadID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, thread)
}

// CreateThread handles POST /api/threads (auth required)
func (h *ThreadHandler) CreateThread(c *gin.Context) {
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
		Meta         interface{} `json:"meta"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	// Create input
	input := validators.CreateThreadInput{
		CategorySlug: req.CategorySlug,
		Title:        req.Title,
		Summary:      req.Summary,
		ContentType:  req.ContentType,
		Content:      req.Content,
		Meta:         req.Meta,
	}

	// Create thread
	thread, err := h.threadService.CreateThread(c.Request.Context(), uint(user.ID), input)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": thread.ID})
}

// UpdateThread handles PUT /api/threads/:id (auth required)
func (h *ThreadHandler) UpdateThread(c *gin.Context) {
	// Get user from context
	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	// Parse thread ID
	idStr := c.Param("id")
	threadID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		h.handleError(c, apperrors.ErrInvalidInput.WithDetails("thread_id harus berupa angka"))
		return
	}

	// Parse request
	var req struct {
		Title       *string     `json:"title"`
		Summary     *string     `json:"summary"`
		ContentType *string     `json:"content_type"`
		Content     interface{} `json:"content"`
		Meta        interface{} `json:"meta"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, apperrors.ErrInvalidRequestBody.WithDetails(err.Error()))
		return
	}

	// Create input
	input := validators.UpdateThreadInput{
		ThreadID:    uint(threadID),
		Title:       req.Title,
		Summary:     req.Summary,
		ContentType: req.ContentType,
		Content:     req.Content,
		Meta:        req.Meta,
	}

	// Update thread
	if err := h.threadService.UpdateThread(c.Request.Context(), uint(user.ID), input); err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "id": threadID})
}

// GetUserThreads handles GET /api/user/threads (auth required)
func (h *ThreadHandler) GetUserThreads(c *gin.Context) {
	// Get user from context
	userIfc, ok := c.Get("user")
	if !ok {
		h.handleError(c, apperrors.ErrUnauthorized)
		return
	}
	user := userIfc.(*ent.User)

	threads, err := h.threadService.ListUserThreads(c.Request.Context(), uint(user.ID))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"threads": threads})
}

// GetMyThreads is an alias for GetUserThreads for /api/threads/me endpoint
func (h *ThreadHandler) GetMyThreads(c *gin.Context) {
	h.GetUserThreads(c)
}

// GetThreadsByUsername handles GET /api/user/:username/threads
func (h *ThreadHandler) GetThreadsByUsername(c *gin.Context) {
	username := c.Param("username")

	threads, err := h.threadService.ListThreadsByUsername(c.Request.Context(), username)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"threads": threads})
}

// handleError handles errors consistently
func (h *ThreadHandler) handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		logger.Debug("Thread handler error",
			zap.String("code", appErr.Code),
			zap.String("message", appErr.Message),
			zap.Int("status", appErr.StatusCode),
		)
		c.JSON(appErr.StatusCode, gin.H{
			"error": appErr.Message,
			"code":  appErr.Code,
		})
		return
	}

	// Unknown error
	logger.Error("Unexpected error in thread handler",
		zap.Error(err),
	)
	c.JSON(http.StatusInternalServerError, gin.H{
		"error": "Terjadi kesalahan internal",
		"code":  "SRV001",
	})
}
