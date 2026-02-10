package validators

import (
	"encoding/json"
	"net/url"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

// CreateValidationCaseInput represents Validation Case creation input.
type CreateValidationCaseInput struct {
	CategorySlug string
	Title        string
	Summary      string
	ContentType  string
	Content      interface{}
	Meta         interface{}
	TagSlugs     []string
	BountyAmount int64
}

// UpdateValidationCaseInput represents Validation Case update input.
type UpdateValidationCaseInput struct {
	ValidationCaseID uint
	Title       *string
	Summary     *string
	ContentType *string
	Content     interface{}
	Meta        interface{}
	TagSlugs    *[]string
	BountyAmount *int64
	Status       *string
}

// CategorySlugInput represents category slug input
type CategorySlugInput struct {
	Slug string
}

// Validate validates Validation Case creation input.
func (c *CreateValidationCaseInput) Validate() error {
	// Validate category slug
	categorySlug := strings.TrimSpace(c.CategorySlug)
	if categorySlug == "" {
		return apperrors.ErrMissingField.WithDetails("category_slug")
	}
	c.CategorySlug = categorySlug

	// Validate bounty amount (IDR). Keep consistent with wallet transfer minimums.
	if c.BountyAmount <= 0 {
		return apperrors.ErrMissingField.WithDetails("bounty_amount")
	}
	if c.BountyAmount < 10_000 {
		return apperrors.ErrInvalidInput.WithDetails("bounty_amount minimal Rp 10.000")
	}

	// Validate title
	title := strings.TrimSpace(c.Title)
	if title == "" {
		return apperrors.ErrMissingField.WithDetails("title")
	}
	if len(title) < 3 {
		return apperrors.ErrInvalidInput.WithDetails("title minimal 3 karakter")
	}
	if len(title) > 200 {
		return apperrors.ErrInvalidInput.WithDetails("title maksimal 200 karakter")
	}
	// Check for XSS patterns
	if !utils.ValidateNoXSS(title) {
		return apperrors.ErrInvalidInput.WithDetails("title mengandung karakter atau pola yang tidak diizinkan")
	}
	c.Title = utils.SanitizeText(title)

	// Validate summary
	summary := strings.TrimSpace(c.Summary)
	if len(summary) > 500 {
		return apperrors.ErrInvalidInput.WithDetails("summary maksimal 500 karakter")
	}
	// Check for XSS patterns in summary
	if summary != "" && !utils.ValidateNoXSS(summary) {
		return apperrors.ErrInvalidInput.WithDetails("summary mengandung karakter atau pola yang tidak diizinkan")
	}
	c.Summary = utils.SanitizeText(summary)

	// Validate content type
	contentType := strings.ToLower(strings.TrimSpace(c.ContentType))
	if contentType == "" {
		contentType = "table" // default
	}
	validContentTypes := map[string]bool{
		"text":  true,
		"table": true,
		"json":  true,
	}
	if !validContentTypes[contentType] {
		return apperrors.ErrInvalidInput.WithDetails("content_type harus 'text', 'table', atau 'json'")
	}
	c.ContentType = contentType

	// Validate content
	if c.Content == nil {
		return apperrors.ErrMissingField.WithDetails("content")
	}

	// Validate meta if provided
	if c.Meta != nil {
		if err := validateMeta(c.Meta); err != nil {
			return err
		}
	}

	// Normalize tag slugs if provided
	if len(c.TagSlugs) > 0 {
		normalized, err := normalizeTagSlugs(c.TagSlugs)
		if err != nil {
			return err
		}
		c.TagSlugs = normalized
	}

	return nil
}

// Validate validates Validation Case update input.
func (u *UpdateValidationCaseInput) Validate() error {
	// ValidationCaseID is required
	if u.ValidationCaseID == 0 {
		return apperrors.ErrMissingField.WithDetails("validation_case_id")
	}

	// Validate title if provided
	if u.Title != nil {
		title := strings.TrimSpace(*u.Title)
		if title == "" {
			return apperrors.ErrInvalidInput.WithDetails("title tidak boleh kosong")
		}
		if len(title) < 3 {
			return apperrors.ErrInvalidInput.WithDetails("title minimal 3 karakter")
		}
		if len(title) > 200 {
			return apperrors.ErrInvalidInput.WithDetails("title maksimal 200 karakter")
		}
		// Check for XSS patterns
		if !utils.ValidateNoXSS(title) {
			return apperrors.ErrInvalidInput.WithDetails("title mengandung karakter atau pola yang tidak diizinkan")
		}
		sanitized := utils.SanitizeText(title)
		*u.Title = sanitized
	}

	// Validate summary if provided
	if u.Summary != nil {
		summary := strings.TrimSpace(*u.Summary)
		if len(summary) > 500 {
			return apperrors.ErrInvalidInput.WithDetails("summary maksimal 500 karakter")
		}
		// Check for XSS patterns
		if summary != "" && !utils.ValidateNoXSS(summary) {
			return apperrors.ErrInvalidInput.WithDetails("summary mengandung karakter atau pola yang tidak diizinkan")
		}
		sanitized := utils.SanitizeText(summary)
		*u.Summary = sanitized
	}

	// Validate content type if provided
	if u.ContentType != nil {
		contentType := strings.ToLower(strings.TrimSpace(*u.ContentType))
		if contentType == "" {
			contentType = "table"
		}
		validContentTypes := map[string]bool{
			"text":  true,
			"table": true,
			"json":  true,
		}
		if !validContentTypes[contentType] {
			return apperrors.ErrInvalidInput.WithDetails("content_type harus 'text', 'table', atau 'json'")
		}
		*u.ContentType = contentType
	}

	// Validate meta if provided
	if u.Meta != nil {
		if err := validateMeta(u.Meta); err != nil {
			return err
		}
	}

	// Validate bounty amount if provided
	if u.BountyAmount != nil {
		if *u.BountyAmount <= 0 {
			return apperrors.ErrInvalidInput.WithDetails("bounty_amount harus lebih dari 0")
		}
		if *u.BountyAmount < 10_000 {
			return apperrors.ErrInvalidInput.WithDetails("bounty_amount minimal Rp 10.000")
		}
	}

	// Validate status if provided (kept loose here; enforced server-side in workflow handlers).
	if u.Status != nil {
		normalized := strings.ToLower(strings.TrimSpace(*u.Status))
		if normalized == "" {
			return apperrors.ErrInvalidInput.WithDetails("status tidak boleh kosong")
		}
		*u.Status = normalized
	}

	// Normalize tag slugs if provided
	if u.TagSlugs != nil {
		normalized, err := normalizeTagSlugs(*u.TagSlugs)
		if err != nil {
			return err
		}
		*u.TagSlugs = normalized
	}

	return nil
}

// Validate validates category slug input
func (c *CategorySlugInput) Validate() error {
	slug := strings.TrimSpace(c.Slug)
	if slug == "" {
		return apperrors.ErrMissingField.WithDetails("category_slug")
	}
	c.Slug = slug
	return nil
}

// validateMeta validates meta fields
func validateMeta(meta interface{}) error {
	metaMap, ok := meta.(map[string]interface{})
	if !ok {
		return apperrors.ErrInvalidInput.WithDetails("meta harus berupa object")
	}

	// Validate image URL if provided
	if imageURL, ok := metaMap["image"].(string); ok && imageURL != "" {
		imageURL = strings.TrimSpace(imageURL)
		if imageURL != "" {
			parsedURL, err := url.ParseRequestURI(imageURL)
			if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
				return apperrors.ErrInvalidInput.WithDetails("image harus berupa URL yang valid (http/https)")
			}
		}
	}

	// Disallow contact info in case meta. Contact sharing is handled via Consultation approval workflow.
	if _, ok := metaMap["telegram"]; ok {
		return apperrors.ErrInvalidInput.WithDetails("meta.telegram tidak diizinkan. Gunakan workflow Request Consultation + persetujuan pemilik kasus.")
	}

	return nil
}

func normalizeTagSlugs(tags []string) ([]string, error) {
	seen := make(map[string]struct{})
	normalized := make([]string, 0, len(tags))

	for _, raw := range tags {
		slug := strings.ToLower(strings.TrimSpace(raw))
		if slug == "" {
			continue
		}
		if !utils.ValidateNoXSS(slug) {
			return nil, apperrors.ErrInvalidInput.WithDetails("tag slug mengandung karakter atau pola yang tidak diizinkan")
		}
		if _, exists := seen[slug]; exists {
			continue
		}
		seen[slug] = struct{}{}
		normalized = append(normalized, slug)
	}

	if len(normalized) > 5 {
		return nil, apperrors.ErrInvalidInput.WithDetails("maksimal 5 tag per validation case")
	}

	return normalized, nil
}

// NormalizeMeta normalizes meta fields for persistence.
func NormalizeMeta(meta interface{}) ([]byte, error) {
	if meta == nil {
		return json.Marshal(map[string]interface{}{})
	}

	metaMap, ok := meta.(map[string]interface{})
	if !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("meta harus berupa object")
	}

	if _, ok := metaMap["telegram"]; ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("meta.telegram tidak diizinkan")
	}

	return json.Marshal(metaMap)
}
