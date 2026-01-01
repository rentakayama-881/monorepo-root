package services

import (
	"context"
	"encoding/json"

	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/models"
	"backend-gin/validators"

	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ThreadService handles thread business logic
type ThreadService struct {
	db *gorm.DB
}

// NewThreadService creates a new thread service
func NewThreadService(db *gorm.DB) *ThreadService {
	return &ThreadService{db: db}
}

// CategoryResponse represents category output
type CategoryResponse struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ThreadListItem represents a thread in list view
type ThreadListItem struct {
	ID        uint             `json:"id"`
	Title     string           `json:"title"`
	Summary   string           `json:"summary"`
	Username  string           `json:"username"`
	Category  CategoryResponse `json:"category"`
	CreatedAt int64            `json:"created_at"`
}

// ThreadDetailResponse represents detailed thread information
type ThreadDetailResponse struct {
	ID          uint                   `json:"id"`
	Title       string                 `json:"title"`
	Summary     string                 `json:"summary"`
	ContentType string                 `json:"content_type"`
	Content     interface{}            `json:"content"`
	Meta        map[string]interface{} `json:"meta"`
	CreatedAt   int64                  `json:"created_at"`
	User        UserInfo               `json:"user"`
	Category    CategoryResponse       `json:"category"`
}

// UserInfo represents user information in thread response
type UserInfo struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

// CreateThread creates a new thread
func (s *ThreadService) CreateThread(ctx context.Context, userID uint, input validators.CreateThreadInput) (*ThreadDetailResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		logger.Error("Thread validation failed",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return nil, err
	}

	// Check if category exists
	var category models.Category
	if err := s.db.Where("slug = ?", input.CategorySlug).First(&category).Error; err != nil {
		logger.Error("Category not found",
			zap.String("category_slug", input.CategorySlug),
			zap.Uint("user_id", userID),
		)
		return nil, apperrors.ErrCategoryNotFound.WithDetails(input.CategorySlug)
	}

	// Marshal content
	contentJSON, err := json.Marshal(input.Content)
	if err != nil {
		logger.Error("Failed to marshal content",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return nil, apperrors.ErrInvalidInput.WithDetails("content tidak valid")
	}

	// Normalize and marshal meta
	metaJSON, err := validators.NormalizeMeta(input.Meta)
	if err != nil {
		logger.Error("Failed to normalize meta",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return nil, err
	}

	// Create thread
	thread := models.Thread{
		CategoryID:  category.ID,
		UserID:      userID,
		Title:       input.Title,
		Summary:     input.Summary,
		ContentType: input.ContentType,
		ContentJSON: datatypes.JSON(contentJSON),
		Meta:        datatypes.JSON(metaJSON),
	}

	if err := s.db.Create(&thread).Error; err != nil {
		logger.Error("Failed to create thread",
			zap.Uint("user_id", userID),
			zap.String("title", input.Title),
			zap.Error(err),
		)
		return nil, apperrors.ErrDatabase.WithDetails("gagal membuat thread")
	}

	logger.Info("Thread created successfully",
		zap.Uint("thread_id", thread.ID),
		zap.Uint("user_id", userID),
		zap.String("category", category.Slug),
	)

	// Load user and category for response
	s.db.Preload("User").Preload("Category").First(&thread, thread.ID)

	return s.mapThreadToDetailResponse(&thread), nil
}

// UpdateThread updates an existing thread
func (s *ThreadService) UpdateThread(ctx context.Context, userID uint, input validators.UpdateThreadInput) error {
	// Validate input
	if err := input.Validate(); err != nil {
		logger.Error("Thread update validation failed",
			zap.Uint("user_id", userID),
			zap.Uint("thread_id", input.ThreadID),
			zap.Error(err),
		)
		return err
	}

	// Get thread
	var thread models.Thread
	if err := s.db.First(&thread, input.ThreadID).Error; err != nil {
		logger.Error("Thread not found for update",
			zap.Uint("thread_id", input.ThreadID),
			zap.Uint("user_id", userID),
		)
		return apperrors.ErrThreadNotFound
	}

	// Check ownership
	if thread.UserID != userID {
		logger.Warn("Unauthorized thread update attempt",
			zap.Uint("thread_id", input.ThreadID),
			zap.Uint("user_id", userID),
			zap.Uint("owner_id", thread.UserID),
		)
		return apperrors.ErrThreadOwnership
	}

	// Apply updates
	if input.Title != nil {
		thread.Title = *input.Title
	}
	if input.Summary != nil {
		thread.Summary = *input.Summary
	}
	if input.ContentType != nil {
		thread.ContentType = *input.ContentType
	}
	if input.Content != nil {
		contentJSON, err := json.Marshal(input.Content)
		if err != nil {
			logger.Error("Failed to marshal updated content",
				zap.Uint("thread_id", input.ThreadID),
				zap.Error(err),
			)
			return apperrors.ErrInvalidInput.WithDetails("content tidak valid")
		}
		thread.ContentJSON = datatypes.JSON(contentJSON)
	}
	if input.Meta != nil {
		metaJSON, err := validators.NormalizeMeta(input.Meta)
		if err != nil {
			logger.Error("Failed to normalize updated meta",
				zap.Uint("thread_id", input.ThreadID),
				zap.Error(err),
			)
			return err
		}
		thread.Meta = datatypes.JSON(metaJSON)
	}

	// Save thread
	if err := s.db.Save(&thread).Error; err != nil {
		logger.Error("Failed to update thread",
			zap.Uint("thread_id", input.ThreadID),
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return apperrors.ErrDatabase.WithDetails("gagal update thread")
	}

	logger.Info("Thread updated successfully",
		zap.Uint("thread_id", input.ThreadID),
		zap.Uint("user_id", userID),
	)

	return nil
}

// GetThreadByID retrieves a thread by ID
func (s *ThreadService) GetThreadByID(ctx context.Context, threadID uint) (*ThreadDetailResponse, error) {
	var thread models.Thread
	if err := s.db.Preload("User").Preload("Category").First(&thread, threadID).Error; err != nil {
		logger.Debug("Thread not found",
			zap.Uint("thread_id", threadID),
		)
		return nil, apperrors.ErrThreadNotFound
	}

	return s.mapThreadToDetailResponse(&thread), nil
}

// CategoryWithThreadsResponse represents a category with its threads
type CategoryWithThreadsResponse struct {
	Category CategoryResponse `json:"category"`
	Threads  []ThreadListItem `json:"threads"`
}

// ListThreadsByCategory lists threads for a specific category and returns category info
func (s *ThreadService) ListThreadsByCategory(ctx context.Context, categorySlug string, limit int) (*CategoryWithThreadsResponse, error) {
	// Validate category
	input := validators.CategorySlugInput{Slug: categorySlug}
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Find category
	var category models.Category
	if err := s.db.Where("slug = ?", input.Slug).First(&category).Error; err != nil {
		logger.Debug("Category not found",
			zap.String("category_slug", categorySlug),
		)
		return nil, apperrors.ErrCategoryNotFound.WithDetails(categorySlug)
	}

	// Get threads
	var threads []models.Thread
	query := s.db.Preload("User").Preload("Category").
		Where("category_id = ?", category.ID).
		Order("created_at desc")

	if limit > 0 {
		query = query.Limit(limit)
	} else {
		query = query.Limit(100)
	}

	if err := query.Find(&threads).Error; err != nil {
		logger.Error("Failed to list threads by category",
			zap.String("category_slug", categorySlug),
			zap.Error(err),
		)
		return nil, apperrors.ErrDatabase.WithDetails("gagal membaca threads")
	}

	return &CategoryWithThreadsResponse{
		Category: CategoryResponse{
			Slug:        category.Slug,
			Name:        category.Name,
			Description: category.Description,
		},
		Threads: s.mapThreadsToListItems(threads),
	}, nil
}

// ListLatestThreads lists latest threads with optional category filter
func (s *ThreadService) ListLatestThreads(ctx context.Context, categorySlug string, limit int) ([]ThreadListItem, error) {
	query := s.db.Preload("User").Preload("Category").Order("created_at desc")

	// Apply category filter if provided
	if categorySlug != "" {
		var category models.Category
		if err := s.db.Where("slug = ?", categorySlug).First(&category).Error; err != nil {
			return nil, apperrors.ErrCategoryNotFound.WithDetails(categorySlug)
		}
		query = query.Where("category_id = ?", category.ID)
	}

	// Apply limit
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	query = query.Limit(limit)

	var threads []models.Thread
	if err := query.Find(&threads).Error; err != nil {
		logger.Error("Failed to list latest threads",
			zap.String("category_slug", categorySlug),
			zap.Int("limit", limit),
			zap.Error(err),
		)
		return nil, apperrors.ErrDatabase.WithDetails("gagal membaca threads")
	}

	return s.mapThreadsToListItems(threads), nil
}

// ListUserThreads lists threads created by a specific user
func (s *ThreadService) ListUserThreads(ctx context.Context, userID uint) ([]ThreadListItem, error) {
	var threads []models.Thread
	if err := s.db.Preload("User").Preload("Category").
		Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(100).
		Find(&threads).Error; err != nil {
		logger.Error("Failed to list user threads",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
		return nil, apperrors.ErrDatabase.WithDetails("gagal membaca threads")
	}

	return s.mapThreadsToListItems(threads), nil
}

// ListThreadsByUsername lists threads by username
func (s *ThreadService) ListThreadsByUsername(ctx context.Context, username string) ([]ThreadListItem, error) {
	var user models.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		logger.Debug("User not found by username",
			zap.String("username", username),
		)
		return nil, apperrors.ErrUserNotFound
	}

	return s.ListUserThreads(ctx, user.ID)
}

// GetCategories retrieves all categories
func (s *ThreadService) GetCategories(ctx context.Context) ([]CategoryResponse, error) {
	var categories []models.Category
	if err := s.db.Order("name asc").Find(&categories).Error; err != nil {
		logger.Error("Failed to get categories",
			zap.Error(err),
		)
		return nil, apperrors.ErrDatabase.WithDetails("gagal membaca kategori")
	}

	result := make([]CategoryResponse, len(categories))
	for i, cat := range categories {
		result[i] = CategoryResponse{
			Slug:        cat.Slug,
			Name:        cat.Name,
			Description: cat.Description,
		}
	}

	return result, nil
}

// Helper methods

func (s *ThreadService) mapThreadToDetailResponse(thread *models.Thread) *ThreadDetailResponse {
	username := ""
	if thread.User.Username != nil {
		username = *thread.User.Username
	}

	var content interface{}
	_ = json.Unmarshal(thread.ContentJSON, &content)

	var meta map[string]interface{}
	_ = json.Unmarshal(thread.Meta, &meta)
	if meta == nil {
		meta = make(map[string]interface{})
	}

	return &ThreadDetailResponse{
		ID:          thread.ID,
		Title:       thread.Title,
		Summary:     thread.Summary,
		ContentType: thread.ContentType,
		Content:     content,
		Meta:        meta,
		CreatedAt:   thread.CreatedAt.Unix(),
		User: UserInfo{
			ID:        thread.UserID,
			Username:  username,
			AvatarURL: thread.User.AvatarURL,
		},
		Category: CategoryResponse{
			Slug: thread.Category.Slug,
			Name: thread.Category.Name,
		},
	}
}

func (s *ThreadService) mapThreadsToListItems(threads []models.Thread) []ThreadListItem {
	items := make([]ThreadListItem, len(threads))
	for i, thread := range threads {
		username := ""
		if thread.User.Username != nil {
			username = *thread.User.Username
		}

		items[i] = ThreadListItem{
			ID:       thread.ID,
			Title:    thread.Title,
			Summary:  thread.Summary,
			Username: username,
			Category: CategoryResponse{
				Slug: thread.Category.Slug,
				Name: thread.Category.Name,
			},
			CreatedAt: thread.CreatedAt.Unix(),
		}
	}
	return items
}
