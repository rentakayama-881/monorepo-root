package services

import (
	"context"
	"strings"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/category"
	"backend-gin/ent/tag"
	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"entgo.io/ent/dialect/sql"
	"go.uber.org/zap"
)

// byPinnedDesc orders cases by pinned status (pinned first), then by created_at descending.
func byPinnedDesc() validationcase.OrderOption {
	return func(s *sql.Selector) {
		// COALESCE handles NULL meta or missing pinned key.
		s.OrderExpr(sql.Expr("COALESCE((meta->>'pinned')::boolean, false) DESC"))
	}
}

// EntValidationCaseService handles Validation Case business logic using Ent ORM.
type EntValidationCaseService struct {
	client *ent.Client
}

// NewEntValidationCaseService creates a new Validation Case service with Ent.
func NewEntValidationCaseService() *EntValidationCaseService {
	return &EntValidationCaseService{client: database.GetEntClient()}
}

// GetCategories returns all categories using Ent (used as Validation Case "types").
func (s *EntValidationCaseService) GetCategories(ctx context.Context) ([]CategoryResponse, error) {
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

func (s *EntValidationCaseService) ListLatestValidationCases(ctx context.Context, categorySlug string, limit int) ([]ValidationCaseListItem, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	query := s.client.ValidationCase.
		Query().
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		})

	if strings.TrimSpace(categorySlug) != "" {
		cat, err := s.client.Category.Query().Where(category.SlugEQ(categorySlug)).Only(ctx)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, apperrors.ErrCategoryNotFound.WithDetails(categorySlug)
			}
			return nil, apperrors.ErrDatabase
		}
		query = query.Where(validationcase.CategoryIDEQ(cat.ID))
	}

	cases, err := query.
		Order(ent.Desc(validationcase.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get latest validation cases", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	return s.validationCasesToListItems(cases), nil
}

func (s *EntValidationCaseService) ListValidationCasesByCategory(ctx context.Context, slug string, limit int) (*CategoryWithValidationCasesResponse, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}

	cat, err := s.client.Category.
		Query().
		Where(category.SlugEQ(slug)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrCategoryNotFound.WithDetails(slug)
		}
		logger.Error("Failed to get category", zap.Error(err), zap.String("slug", slug))
		return nil, apperrors.ErrDatabase
	}

	cases, err := s.client.ValidationCase.
		Query().
		Where(validationcase.CategoryIDEQ(cat.ID)).
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Order(byPinnedDesc(), ent.Desc(validationcase.FieldCreatedAt)).
		Limit(limit).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get validation cases by category", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	return &CategoryWithValidationCasesResponse{
		Category: CategoryResponse{
			Slug:        cat.Slug,
			Name:        cat.Name,
			Description: cat.Description,
		},
		Cases: s.validationCasesToListItems(cases),
	}, nil
}

func (s *EntValidationCaseService) ListUserValidationCases(ctx context.Context, ownerUserID uint) ([]ValidationCaseListItem, error) {
	cases, err := s.client.ValidationCase.
		Query().
		Where(validationcase.UserIDEQ(int(ownerUserID))).
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Order(ent.Desc(validationcase.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		logger.Error("Failed to get user validation cases", zap.Error(err), zap.Uint("user_id", ownerUserID))
		return nil, apperrors.ErrDatabase
	}
	return s.validationCasesToListItems(cases), nil
}

func (s *EntValidationCaseService) ListValidationCasesByUsername(ctx context.Context, usernameStr string) ([]ValidationCaseListItem, error) {
	u, err := s.client.User.
		Query().
		Where(user.UsernameEQ(usernameStr)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrUserNotFound
		}
		return nil, apperrors.ErrDatabase
	}
	return s.ListUserValidationCases(ctx, uint(u.ID))
}

func (s *EntValidationCaseService) GetValidationCaseByID(ctx context.Context, validationCaseID uint, viewerUserID uint) (*ValidationCaseDetailResponse, error) {
	vc, err := s.client.ValidationCase.
		Query().
		Where(validationcase.IDEQ(int(validationCaseID))).
		WithUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		WithCategory().
		WithTags(func(q *ent.TagQuery) {
			q.Where(tag.IsActiveEQ(true))
		}).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.ErrValidationCaseNotFound
		}
		logger.Error("Failed to get validation case", zap.Error(err), zap.Uint("validation_case_id", validationCaseID))
		return nil, apperrors.ErrDatabase
	}

	_ = viewerUserID // reserved for future authz rules (private sections)
	assignedValidator := s.resolveAssignedValidator(ctx, vc.AcceptedFinalOfferID)
	return s.validationCaseToDetailResponse(vc, assignedValidator), nil
}

