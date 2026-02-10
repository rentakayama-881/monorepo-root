package services

import (
	"context"
	"encoding/json"
	"strings"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/category"
	"backend-gin/ent/tag"
	"backend-gin/ent/user"
	"backend-gin/ent/validationcase"
	"backend-gin/ent/validationcaselog"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/validators"

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
	return s.validationCaseToDetailResponse(vc), nil
}

func (s *EntValidationCaseService) CreateValidationCase(ctx context.Context, ownerUserID uint, input validators.CreateValidationCaseInput) (*ValidationCaseDetailResponse, error) {
	if err := input.Validate(); err != nil {
		logger.Error("ValidationCase validation failed", zap.Uint("user_id", ownerUserID), zap.Error(err))
		return nil, err
	}

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

	metaJSON, err := validators.NormalizeMeta(input.Meta)
	if err != nil {
		logger.Error("Failed to normalize meta", zap.Uint("user_id", ownerUserID), zap.Error(err))
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

	contentMap := coerceContentToMap(input.Content)

	create := s.client.ValidationCase.
		Create().
		SetCategoryID(cat.ID).
		SetUserID(int(ownerUserID)).
		SetTitle(input.Title).
		SetSummary(input.Summary).
		SetContentType(input.ContentType).
		SetContentJSON(contentMap).
		SetMeta(sanitizeCaseMeta(metaMap)).
		SetBountyAmount(input.BountyAmount).
		SetStatus("open")

	if len(tags) > 0 {
		create.AddTags(tags...)
	}

	vc, err := create.Save(ctx)
	if err != nil {
		logger.Error("Failed to create validation case", zap.Uint("user_id", ownerUserID), zap.Error(err))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal membuat Validation Case")
	}

	// Append Case Log entry (best effort).
	_, _ = s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(vc.ID).
		SetActorUserID(int(ownerUserID)).
		SetEventType("validation_case_created").
		SetDetailJSON(map[string]interface{}{
			"bounty_amount": input.BountyAmount,
		}).
		Save(ctx)

	vc, err = s.client.ValidationCase.
		Query().
		Where(validationcase.IDEQ(vc.ID)).
		WithUser(func(q *ent.UserQuery) { q.WithPrimaryBadge() }).
		WithCategory().
		WithTags(func(q *ent.TagQuery) { q.Where(tag.IsActiveEQ(true)) }).
		Only(ctx)
	if err != nil {
		return nil, apperrors.ErrDatabase
	}

	return s.validationCaseToDetailResponse(vc), nil
}

func (s *EntValidationCaseService) UpdateValidationCase(ctx context.Context, ownerUserID uint, input validators.UpdateValidationCaseInput) error {
	if err := input.Validate(); err != nil {
		return err
	}

	vc, err := s.client.ValidationCase.
		Query().
		Where(validationcase.IDEQ(int(input.ValidationCaseID))).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}

	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}

	update := s.client.ValidationCase.UpdateOneID(int(input.ValidationCaseID))

	if input.Title != nil {
		update.SetTitle(*input.Title)
	}
	if input.Summary != nil {
		update.SetSummary(*input.Summary)
	}
	if input.ContentType != nil {
		update.SetContentType(*input.ContentType)
	}
	if input.Content != nil {
		update.SetContentJSON(coerceContentToMap(input.Content))
	}
	if input.Meta != nil {
		metaJSON, err := validators.NormalizeMeta(input.Meta)
		if err != nil {
			return err
		}
		var metaMap map[string]interface{}
		if err := json.Unmarshal(metaJSON, &metaMap); err != nil {
			metaMap = make(map[string]interface{})
		}
		update.SetMeta(sanitizeCaseMeta(metaMap))
	}
	if input.BountyAmount != nil {
		// Conservative: allow bounty edits only while still open.
		if strings.ToLower(strings.TrimSpace(vc.Status)) != "open" {
			return apperrors.ErrInvalidInput.WithDetails("bounty_amount hanya bisa diubah saat status masih 'open'")
		}
		update.SetBountyAmount(*input.BountyAmount)
	}

	if input.TagSlugs != nil {
		tags, err := s.resolveActiveTagsBySlug(ctx, *input.TagSlugs)
		if err != nil {
			return err
		}
		update.ClearTags()
		if len(tags) > 0 {
			update.AddTags(tags...)
		}
	}

	if _, err := update.Save(ctx); err != nil {
		return apperrors.ErrDatabase
	}

	// Append Case Log entry (best effort).
	_, _ = s.client.ValidationCaseLog.
		Create().
		SetValidationCaseID(int(input.ValidationCaseID)).
		SetActorUserID(int(ownerUserID)).
		SetEventType("validation_case_updated").
		SetDetailJSON(map[string]interface{}{}).
		Save(ctx)

	return nil
}

func (s *EntValidationCaseService) DeleteValidationCase(ctx context.Context, ownerUserID uint, validationCaseID uint) error {
	vc, err := s.client.ValidationCase.
		Query().
		Where(validationcase.IDEQ(int(validationCaseID))).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return apperrors.ErrValidationCaseNotFound
		}
		return apperrors.ErrDatabase
	}
	if vc.UserID != int(ownerUserID) {
		return apperrors.ErrValidationCaseOwnership
	}

	// Conservative delete: refuse if escrow already linked.
	if vc.EscrowTransferID != nil && strings.TrimSpace(*vc.EscrowTransferID) != "" {
		return apperrors.ErrInvalidInput.WithDetails("Validation Case tidak dapat dihapus setelah Lock Funds dilakukan")
	}

	if err := s.client.ValidationCase.DeleteOneID(int(validationCaseID)).Exec(ctx); err != nil {
		return apperrors.ErrDatabase
	}
	return nil
}

func (s *EntValidationCaseService) resolveActiveTagsBySlug(ctx context.Context, slugs []string) ([]*ent.Tag, error) {
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

func coerceContentToMap(content interface{}) map[string]interface{} {
	contentMap := make(map[string]interface{})
	if content == nil {
		return contentMap
	}

	switch v := content.(type) {
	case map[string]interface{}:
		return v
	case string:
		return map[string]interface{}{"text": v}
	default:
		b, err := json.Marshal(content)
		if err != nil {
			return contentMap
		}
		// Check if it's a JSON string (quoted)
		var str string
		if json.Unmarshal(b, &str) == nil {
			return map[string]interface{}{"text": str}
		}
		_ = json.Unmarshal(b, &contentMap)
		return contentMap
	}
}

func sanitizeCaseMeta(meta map[string]interface{}) map[string]interface{} {
	if meta == nil {
		return map[string]interface{}{}
	}
	// Defensive: ensure no contact info leaks through legacy records.
	out := make(map[string]interface{}, len(meta))
	for k, v := range meta {
		if strings.EqualFold(strings.TrimSpace(k), "telegram") {
			continue
		}
		out[k] = v
	}
	return out
}

func (s *EntValidationCaseService) validationCasesToListItems(cases []*ent.ValidationCase) []ValidationCaseListItem {
	result := make([]ValidationCaseListItem, len(cases))
	for i, vc := range cases {
		result[i] = s.validationCaseToListItem(vc)
	}
	return result
}

func (s *EntValidationCaseService) validationCaseToListItem(vc *ent.ValidationCase) ValidationCaseListItem {
	owner := buildUserSummaryFromEnt(vc.Edges.User)
	cat := buildCategoryResponseFromEnt(vc.Edges.Category)
	tags := buildTagResponsesFromEnt(vc.Edges.Tags)

	return ValidationCaseListItem{
		ID:           uint(vc.ID),
		Title:        vc.Title,
		Summary:      vc.Summary,
		Status:       vc.Status,
		BountyAmount: vc.BountyAmount,
		Owner:        owner,
		Category:     cat,
		Tags:         tags,
		Meta:         sanitizeCaseMeta(vc.Meta),
		CreatedAt:    vc.CreatedAt.Unix(),
	}
}

func (s *EntValidationCaseService) validationCaseToDetailResponse(vc *ent.ValidationCase) *ValidationCaseDetailResponse {
	owner := buildUserSummaryFromEnt(vc.Edges.User)
	cat := buildCategoryResponseFromEnt(vc.Edges.Category)
	tags := buildTagResponsesFromEnt(vc.Edges.Tags)

	var acceptedOfferID *uint
	if vc.AcceptedFinalOfferID != nil && *vc.AcceptedFinalOfferID > 0 {
		v := uint(*vc.AcceptedFinalOfferID)
		acceptedOfferID = &v
	}

	return &ValidationCaseDetailResponse{
		ID:            uint(vc.ID),
		Title:         vc.Title,
		Summary:       vc.Summary,
		ContentType:   vc.ContentType,
		Content:       vc.ContentJSON,
		Meta:          sanitizeCaseMeta(vc.Meta),
		Status:        vc.Status,
		BountyAmount:  vc.BountyAmount,
		EscrowTransferID: vc.EscrowTransferID,
		DisputeID:        vc.DisputeID,
		AcceptedFinalOfferID: acceptedOfferID,
		ArtifactDocumentID: vc.ArtifactDocumentID,
		CertifiedArtifactDocumentID: vc.CertifiedArtifactDocumentID,
		CreatedAt:     vc.CreatedAt.Unix(),
		Owner:         owner,
		Category:      cat,
		Tags:          tags,
	}
}

func buildUserSummaryFromEnt(u *ent.User) UserSummary {
	if u == nil {
		return UserSummary{}
	}
	username := ""
	if u.Username != nil {
		username = *u.Username
	}
	var primaryBadge *Badge
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
	return UserSummary{
		ID:              uint(u.ID),
		Username:        username,
		AvatarURL:       u.AvatarURL,
		PrimaryBadge:    primaryBadge,
		GuaranteeAmount: u.GuaranteeAmount,
	}
}

func buildCategoryResponseFromEnt(c *ent.Category) CategoryResponse {
	if c == nil {
		return CategoryResponse{}
	}
	return CategoryResponse{
		Slug:        c.Slug,
		Name:        c.Name,
		Description: c.Description,
	}
}

func buildTagResponsesFromEnt(tagsEnt []*ent.Tag) []TagResponse {
	if tagsEnt == nil {
		return nil
	}
	out := make([]TagResponse, 0, len(tagsEnt))
	for _, t := range tagsEnt {
		out = append(out, TagResponse{
			ID:    uint(t.ID),
			Name:  t.Name,
			Slug:  t.Slug,
			Color: t.Color,
			Icon:  t.Icon,
		})
	}
	return out
}

// Ensure we reference validationcaselog package so unused import isn't stripped by refactors.
var _ = validationcaselog.FieldEventType

