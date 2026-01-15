package services

import (
	"context"
	"encoding/json"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/category"
	"backend-gin/ent/tag"
	"backend-gin/ent/thread"
	"backend-gin/ent/user"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/validators"

	"entgo.io/ent/dialect/sql"
	"go.uber.org/zap"
)

// byPinnedDesc returns an OrderOption that orders threads by pinned status (pinned first)
func byPinnedDesc() thread.OrderOption {
	return func(s *sql.Selector) {
		// Order by pinned status descending (true first), then by created_at descending
		// COALESCE handles NULL meta or missing pinned key
		s.OrderExpr(sql.Expr("COALESCE((meta->>'pinned')::boolean, false) DESC"))
	}
}

// EntThreadService handles thread business logic using Ent ORM
type EntThreadService struct {
	client *ent.Client
}

// NewEntThreadService creates a new thread service with Ent
func NewEntThreadService() *EntThreadService {
	return &EntThreadService{client: database.GetEntClient()}
}

// GetCategories returns all categories using Ent
func (s *EntThreadService) GetCategories(ctx context.Context) ([]CategoryResponse, error) {
	categories, err := s.client.Category.
		Query().
		Order(ent.Asc(category.FieldName)).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get categories", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	result := make([]CategoryResponse, len(categories))
	for i, c := range categories {
		result[i] = CategoryResponse{
			Slug:        c.Slug,
			Name:        c.Name,
			Description: c.Description,
		}
	}
	return result, nil
}

// GetLatestThreads returns the latest threads with pagination using Ent
func (s *EntThreadService) GetLatestThreads(ctx context.Context, limit, offset int) ([]ThreadListItem, error) {
	threads, err := s.client.Thread.
		Query().
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags().
		Order(ent.Desc(thread.FieldCreatedAt)).
		Limit(limit).
		Offset(offset).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get latest threads", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	return s.threadsToListItems(threads), nil
}

// GetThreadsByCategory returns threads for a specific category using Ent
func (s *EntThreadService) GetThreadsByCategory(ctx context.Context, slug string, limit, offset int) ([]ThreadListItem, string, error) {
	// Get category first
	cat, err := s.client.Category.
		Query().
		Where(category.SlugEQ(slug)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, "", apperrors.ErrCategoryNotFound.WithDetails(slug)
		}
		logger.Error("Failed to get category", zap.Error(err), zap.String("slug", slug))
		return nil, "", apperrors.ErrDatabase
	}

	// Get threads for this category
	// Order: pinned threads first, then by created_at descending
	threads, err := s.client.Thread.
		Query().
		Where(thread.CategoryIDEQ(cat.ID)).
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags().
		Order(byPinnedDesc(), ent.Desc(thread.FieldCreatedAt)).
		Limit(limit).
		Offset(offset).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get threads by category", zap.Error(err))
		return nil, "", apperrors.ErrDatabase
	}

	return s.threadsToListItems(threads), cat.Name, nil
}

// GetThreadsByUserID returns threads created by a specific user using Ent
func (s *EntThreadService) GetThreadsByUserID(ctx context.Context, userID int, limit, offset int) ([]ThreadListItem, error) {
	threads, err := s.client.Thread.
		Query().
		Where(thread.UserIDEQ(userID)).
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags().
		Order(ent.Desc(thread.FieldCreatedAt)).
		Limit(limit).
		Offset(offset).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get user threads", zap.Error(err), zap.Int("user_id", userID))
		return nil, apperrors.ErrDatabase
	}

	return s.threadsToListItems(threads), nil
}

// GetThreadDetail returns detailed thread information using Ent
func (s *EntThreadService) GetThreadDetail(ctx context.Context, threadID int) (*ThreadDetailResponse, error) {
	t, err := s.client.Thread.
		Query().
		Where(thread.IDEQ(threadID)).
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrThreadNotFound
		}
		logger.Error("Failed to get thread", zap.Error(err), zap.Int("thread_id", threadID))
		return nil, apperrors.ErrDatabase
	}

	return s.threadToDetailResponse(t), nil
}

// createThreadInternal creates a new thread using Ent (internal with int)
func (s *EntThreadService) createThreadInternal(ctx context.Context, userID int, input validators.CreateThreadInput) (*ThreadDetailResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		logger.Error("Thread validation failed", zap.Int("user_id", userID), zap.Error(err))
		return nil, err
	}

	// Check if category exists
	cat, err := s.client.Category.
		Query().
		Where(category.SlugEQ(input.CategorySlug)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrCategoryNotFound.WithDetails(input.CategorySlug)
		}
		logger.Error("Failed to get category", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	// Normalize and marshal meta
	metaJSON, err := validators.NormalizeMeta(input.Meta)
	if err != nil {
		logger.Error("Failed to normalize meta", zap.Int("user_id", userID), zap.Error(err))
		return nil, err
	}

	var metaMap map[string]interface{}
	if err := json.Unmarshal(metaJSON, &metaMap); err != nil {
		metaMap = make(map[string]interface{})
	}

	var tags []*ent.Tag
	if len(input.TagSlugs) > 0 {
		tags, err = s.resolveActiveTagsBySlug(ctx, input.TagSlugs)
		if err != nil {
			return nil, err
		}
	}

	// Convert content to map[string]interface{}
	contentMap := make(map[string]interface{})
	if input.Content != nil {
		switch v := input.Content.(type) {
		case map[string]interface{}:
			contentMap = v
		case string:
			// For text content, wrap string in a map
			contentMap = map[string]interface{}{"text": v}
		default:
			// Try to marshal and unmarshal to convert
			contentBytes, err := json.Marshal(input.Content)
			if err == nil {
				// Check if it's a JSON string (quoted)
				var str string
				if json.Unmarshal(contentBytes, &str) == nil {
					// It's a string, wrap it
					contentMap = map[string]interface{}{"text": str}
				} else {
					// Try to unmarshal as object
					_ = json.Unmarshal(contentBytes, &contentMap)
				}
			}
		}
	}

	// Create thread
	create := s.client.Thread.
		Create().
		SetCategoryID(cat.ID).
		SetUserID(userID).
		SetTitle(input.Title).
		SetSummary(input.Summary).
		SetContentType(input.ContentType).
		SetContentJSON(contentMap).
		SetMeta(metaMap)

	if len(tags) > 0 {
		create.AddTags(tags...)
	}

	t, err := create.Save(ctx)
	if err != nil {
		logger.Error("Failed to create thread", zap.Int("user_id", userID), zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal membuat thread")
	}

	// Reload with edges
	t, err = s.client.Thread.
		Query().
		Where(thread.IDEQ(t.ID)).
		WithUser().
		WithCategory().
		WithTags().
		Only(ctx)
	if err != nil {
		logger.Error("Failed to reload thread", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	logger.Info("Thread created successfully",
		zap.Int("thread_id", t.ID),
		zap.Int("user_id", userID),
		zap.String("title", input.Title),
	)

	return s.threadToDetailResponse(t), nil
}

// updateThreadInternal updates an existing thread using Ent (internal with int)
func (s *EntThreadService) updateThreadInternal(ctx context.Context, threadID, userID int, input validators.UpdateThreadInput) (*ThreadDetailResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Get existing thread
	t, err := s.client.Thread.
		Query().
		Where(thread.IDEQ(threadID)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrThreadNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	// Check ownership
	if t.UserID != userID {
		return nil, apperrors.ErrThreadOwnership
	}

	// Build update
	update := s.client.Thread.UpdateOneID(threadID)

	if input.Title != nil {
		update.SetTitle(*input.Title)
	}
	if input.Summary != nil {
		update.SetSummary(*input.Summary)
	}
	if input.Content != nil {
		// Convert content to map[string]interface{}
		contentMap := make(map[string]interface{})
		switch v := input.Content.(type) {
		case map[string]interface{}:
			contentMap = v
		case string:
			// For text content, wrap string in a map
			contentMap = map[string]interface{}{"text": v}
		default:
			contentBytes, err := json.Marshal(input.Content)
			if err == nil {
				// Check if it's a JSON string (quoted)
				var str string
				if json.Unmarshal(contentBytes, &str) == nil {
					// It's a string, wrap it
					contentMap = map[string]interface{}{"text": str}
				} else {
					// Try to unmarshal as object
					_ = json.Unmarshal(contentBytes, &contentMap)
				}
			}
		}
		update.SetContentJSON(contentMap)
	}
	if input.ContentType != nil {
		update.SetContentType(*input.ContentType)
	}
	if input.Meta != nil {
		metaJSON, err := validators.NormalizeMeta(input.Meta)
		if err != nil {
			return nil, err
		}
		var metaMap map[string]interface{}
		if err := json.Unmarshal(metaJSON, &metaMap); err != nil {
			metaMap = make(map[string]interface{})
		}
		update.SetMeta(metaMap)
	}
	if input.TagSlugs != nil {
		tags, err := s.resolveActiveTagsBySlug(ctx, *input.TagSlugs)
		if err != nil {
			return nil, err
		}
		update.ClearTags()
		if len(tags) > 0 {
			update.AddTags(tags...)
		}
	}

	// Execute update
	t, err = update.Save(ctx)
	if err != nil {
		logger.Error("Failed to update thread", zap.Error(err), zap.Int("thread_id", threadID))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal mengupdate thread")
	}

	// Reload with edges
	t, err = s.client.Thread.
		Query().
		Where(thread.IDEQ(t.ID)).
		WithUser().
		WithCategory().
		WithTags().
		Only(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	return s.threadToDetailResponse(t), nil
}

// Helper: convert threads to list items
func (s *EntThreadService) threadsToListItems(threads []*ent.Thread) []ThreadListItem {
	result := make([]ThreadListItem, len(threads))
	for i, t := range threads {
		username := ""
		avatarURL := ""
		var primaryBadge *Badge
		if u := t.Edges.User; u != nil {
			if u.Username != nil {
				username = *u.Username
			}
			avatarURL = u.AvatarURL
			// Add primary badge if exists
			if pb := u.Edges.PrimaryBadge; pb != nil {
				primaryBadge = &Badge{
					ID:          uint(pb.ID),
					Name:        pb.Name,
					Slug:        pb.Slug,
					Description: pb.Description,
					IconType:    pb.IconType,
					Color:       pb.Color,
				}
			}
		}

		var cat CategoryResponse
		if c := t.Edges.Category; c != nil {
			cat = CategoryResponse{
				Slug:        c.Slug,
				Name:        c.Name,
				Description: c.Description,
			}
		}

		// Build tags slice
		var tags []TagResponse
		if t.Edges.Tags != nil {
			tags = make([]TagResponse, len(t.Edges.Tags))
			for j, tag := range t.Edges.Tags {
				tags[j] = TagResponse{
					ID:    uint(tag.ID),
					Name:  tag.Name,
					Slug:  tag.Slug,
					Color: tag.Color,
					Icon:  tag.Icon,
				}
			}
		}

		result[i] = ThreadListItem{
			ID:           uint(t.ID),
			Title:        t.Title,
			Summary:      t.Summary,
			Username:     username,
			AvatarURL:    avatarURL,
			PrimaryBadge: primaryBadge,
			Category:     cat,
			Tags:         tags,
			Meta:         t.Meta,
			CreatedAt:    t.CreatedAt.Unix(),
		}
	}
	return result
}

// Helper: convert thread to detail response
func (s *EntThreadService) threadToDetailResponse(t *ent.Thread) *ThreadDetailResponse {
	var userInfo UserInfo
	if u := t.Edges.User; u != nil {
		username := ""
		if u.Username != nil {
			username = *u.Username
		}
		userInfo = UserInfo{
			ID:        uint(u.ID),
			Username:  username,
			AvatarURL: u.AvatarURL,
		}
		// Add primary badge if exists
		if pb := u.Edges.PrimaryBadge; pb != nil {
			userInfo.PrimaryBadge = &Badge{
				ID:          uint(pb.ID),
				Name:        pb.Name,
				Slug:        pb.Slug,
				Description: pb.Description,
				IconType:    pb.IconType,
				Color:       pb.Color,
			}
		}
	}

	var cat CategoryResponse
	if c := t.Edges.Category; c != nil {
		cat = CategoryResponse{
			Slug:        c.Slug,
			Name:        c.Name,
			Description: c.Description,
		}
	}

	var tags []TagResponse
	if t.Edges.Tags != nil {
		tags = make([]TagResponse, len(t.Edges.Tags))
		for i, tag := range t.Edges.Tags {
			tags[i] = TagResponse{
				ID:    uint(tag.ID),
				Name:  tag.Name,
				Slug:  tag.Slug,
				Color: tag.Color,
				Icon:  tag.Icon,
			}
		}
	}

	return &ThreadDetailResponse{
		ID:          uint(t.ID),
		Title:       t.Title,
		Summary:     t.Summary,
		ContentType: t.ContentType,
		Content:     t.ContentJSON,
		Meta:        t.Meta,
		CreatedAt:   t.CreatedAt.Unix(),
		User:        userInfo,
		Category:    cat,
		Tags:        tags,
	}
}

func (s *EntThreadService) resolveActiveTagsBySlug(ctx context.Context, slugs []string) ([]*ent.Tag, error) {
	if len(slugs) == 0 {
		return nil, nil
	}
	tags, err := s.client.Tag.
		Query().
		Where(tag.SlugIn(slugs...), tag.IsActiveEQ(true)).
		All(ctx)
	if err != nil {
		logger.Error("Failed to resolve tags", zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("gagal memvalidasi tags")
	}
	if len(tags) != len(slugs) {
		return nil, apperrors.ErrInvalidInput.WithDetails("tag tidak ditemukan atau tidak aktif")
	}
	return tags, nil
}

// getThreadsByUsernameInternal returns threads for a specific username using Ent (internal method)
func (s *EntThreadService) getThreadsByUsernameInternal(ctx context.Context, username string, limit, offset int) ([]ThreadListItem, error) {
	// Get user by username
	u, err := s.client.User.
		Query().
		Where(user.UsernameEQ(username)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, apperrors.ErrDatabase
	}

	return s.GetThreadsByUserID(ctx, u.ID, limit, offset)
}

// =============================================================================
// Interface Adapter Methods
// These methods provide compatibility with ThreadServiceInterface
// to allow EntThreadService to be used interchangeably with GORM ThreadService
// =============================================================================

// CreateThread wraps createThreadInternal to match interface signature (uint userID)
func (s *EntThreadService) CreateThread(ctx context.Context, userID uint, input validators.CreateThreadInput) (*ThreadDetailResponse, error) {
	return s.createThreadInternal(ctx, int(userID), input)
}

// UpdateThread wraps updateThreadInternal to match interface signature
func (s *EntThreadService) UpdateThread(ctx context.Context, userID uint, input validators.UpdateThreadInput) error {
	_, err := s.updateThreadInternal(ctx, int(input.ThreadID), int(userID), input)
	return err
}

// GetThreadByID wraps GetThreadDetail to match interface signature
func (s *EntThreadService) GetThreadByID(ctx context.Context, threadID uint) (*ThreadDetailResponse, error) {
	return s.GetThreadDetail(ctx, int(threadID))
}

// ListLatestThreads wraps GetLatestThreads to match interface signature
func (s *EntThreadService) ListLatestThreads(ctx context.Context, categorySlug string, limit int) ([]ThreadListItem, error) {
	if categorySlug != "" {
		// If category specified, filter by category
		items, _, err := s.GetThreadsByCategory(ctx, categorySlug, limit, 0)
		return items, err
	}
	return s.GetLatestThreads(ctx, limit, 0)
}

// ListThreadsByCategory wraps GetThreadsByCategory to match interface signature
func (s *EntThreadService) ListThreadsByCategory(ctx context.Context, categorySlug string, limit int) (*CategoryWithThreadsResponse, error) {
	items, categoryName, err := s.GetThreadsByCategory(ctx, categorySlug, limit, 0)
	if err != nil {
		return nil, err
	}

	// Get full category info
	cat, err := s.client.Category.
		Query().
		Where(category.SlugEQ(categorySlug)).
		Only(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	return &CategoryWithThreadsResponse{
		Category: CategoryResponse{
			Slug:        cat.Slug,
			Name:        categoryName,
			Description: cat.Description,
		},
		Threads: items,
	}, nil
}

// ListUserThreads wraps GetThreadsByUserID to match interface signature
func (s *EntThreadService) ListUserThreads(ctx context.Context, userID uint) ([]ThreadListItem, error) {
	return s.GetThreadsByUserID(ctx, int(userID), 100, 0)
}

// ListThreadsByUsername wraps getThreadsByUsernameInternal to match interface signature
func (s *EntThreadService) ListThreadsByUsername(ctx context.Context, username string) ([]ThreadListItem, error) {
	return s.getThreadsByUsernameInternal(ctx, username, 100, 0)
}

// DeleteThread deletes a thread and its related thread_chunks (hard delete)
// Only the thread owner can delete their thread
func (s *EntThreadService) DeleteThread(ctx context.Context, userID uint, threadID uint) error {
	// Get the thread to verify ownership
	t, err := s.client.Thread.
		Query().
		Where(thread.IDEQ(int(threadID))).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrThreadNotFound
		}
		logger.Error("Failed to get thread for delete", zap.Error(err), zap.Uint("thread_id", threadID))
		return apperrors.ErrDatabase
	}

	// Check ownership
	if t.UserID != int(userID) {
		logger.Warn("Attempt to delete thread by non-owner",
			zap.Uint("thread_id", threadID),
			zap.Uint("user_id", userID),
			zap.Int("owner_id", t.UserID),
		)
		return apperrors.ErrThreadOwnership
	}

	// Delete thread_chunks first (RAG index) - only if table exists
	db := database.GetSQLDB()
	var tableExists bool
	err = db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_name = 'thread_chunks'
		)
	`).Scan(&tableExists)
	if err != nil {
		logger.Warn("Failed to check thread_chunks table existence", zap.Error(err))
		tableExists = false
	}

	if tableExists {
		_, err = db.ExecContext(ctx, `DELETE FROM thread_chunks WHERE thread_id = $1`, threadID)
		if err != nil {
			logger.Error("Failed to delete thread_chunks", zap.Error(err), zap.Uint("thread_id", threadID))
			// Continue anyway - not critical
		}
	}

	// Delete the thread
	err = s.client.Thread.DeleteOneID(int(threadID)).Exec(ctx)
	if err != nil {
		logger.Error("Failed to delete thread", zap.Error(err), zap.Uint("thread_id", threadID))
		return apperrors.ErrDatabase.WithDetails("Gagal menghapus thread")
	}

	logger.Info("Thread deleted successfully",
		zap.Uint("thread_id", threadID),
		zap.Uint("user_id", userID),
		zap.String("title", t.Title),
	)

	return nil
}

// Ensure EntThreadService satisfies the interface
var _ ThreadServiceInterface = (*EntThreadService)(nil)
