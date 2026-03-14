package services

import (
	"context"
	"encoding/json"
	"strings"

	"backend-gin/ent"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/tag"
	"backend-gin/ent/validationcaselog"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

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
		if err := json.Unmarshal(b, &contentMap); err != nil {
			logger.Warn("failed to unmarshal case content as map", zap.Error(err))
		}
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
		ID:                   uint(vc.ID),
		Title:                vc.Title,
		Summary:              vc.Summary,
		Status:               vc.Status,
		SensitivityLevel:     vc.SensitivityLevel,
		ClarificationState:   vc.ClarificationState,
		BountyAmount:         vc.BountyAmount,
		OwnerInactivityCount: vc.OwnerInactivityCount,
		Owner:                owner,
		Category:             cat,
		Tags:                 tags,
		Meta:                 sanitizeCaseMeta(vc.Meta),
		CreatedAt:            vc.CreatedAt.Unix(),
	}
}

func (s *EntValidationCaseService) validationCaseToDetailResponse(vc *ent.ValidationCase, assignedValidator *UserSummary) *ValidationCaseDetailResponse {
	owner := buildUserSummaryFromEnt(vc.Edges.User)
	cat := buildCategoryResponseFromEnt(vc.Edges.Category)
	tags := buildTagResponsesFromEnt(vc.Edges.Tags)

	var acceptedOfferID *uint
	if vc.AcceptedFinalOfferID != nil && *vc.AcceptedFinalOfferID > 0 {
		v := uint(*vc.AcceptedFinalOfferID)
		acceptedOfferID = &v
	}

	return &ValidationCaseDetailResponse{
		ID:                          uint(vc.ID),
		Title:                       vc.Title,
		Summary:                     vc.Summary,
		ContentType:                 vc.ContentType,
		Content:                     vc.ContentJSON,
		Meta:                        sanitizeCaseMeta(vc.Meta),
		SensitivityLevel:            vc.SensitivityLevel,
		IntakeSchemaVersion:         vc.IntakeSchemaVersion,
		ClarificationState:          vc.ClarificationState,
		OwnerInactivityCount:        vc.OwnerInactivityCount,
		Status:                      vc.Status,
		BountyAmount:                vc.BountyAmount,
		EscrowTransferID:            vc.EscrowTransferID,
		DisputeID:                   vc.DisputeID,
		AcceptedFinalOfferID:        acceptedOfferID,
		ArtifactDocumentID:          vc.ArtifactDocumentID,
		CertifiedArtifactDocumentID: vc.CertifiedArtifactDocumentID,
		CreatedAt:                   vc.CreatedAt.Unix(),
		Owner:                       owner,
		AssignedValidator:           assignedValidator,
		Category:                    cat,
		Tags:                        tags,
	}
}

func (s *EntValidationCaseService) resolveAssignedValidator(ctx context.Context, acceptedFinalOfferID *int) *UserSummary {
	if acceptedFinalOfferID == nil || *acceptedFinalOfferID <= 0 {
		return nil
	}

	offer, err := s.client.FinalOffer.
		Query().
		Where(finaloffer.IDEQ(*acceptedFinalOfferID)).
		WithValidatorUser(func(q *ent.UserQuery) {
			q.WithPrimaryBadge()
		}).
		Only(ctx)
	if err != nil {
		logger.Warn("Failed to resolve assigned validator for validation case detail",
			zap.Int("accepted_final_offer_id", *acceptedFinalOfferID),
			zap.Error(err),
		)
		return nil
	}

	validator := buildUserSummaryFromEnt(offer.Edges.ValidatorUser)
	return &validator
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
