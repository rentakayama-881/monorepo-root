package validators

import (
	"encoding/json"
	"net/url"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

// CreateThreadInput represents thread creation input
type CreateThreadInput struct {
	CategorySlug string
	Title        string
	Summary      string
	ContentType  string
	Content      interface{}
	Meta         interface{}
}

// UpdateThreadInput represents thread update input
type UpdateThreadInput struct {
	ThreadID    uint
	Title       *string
	Summary     *string
	ContentType *string
	Content     interface{}
	Meta        interface{}
}

// CategorySlugInput represents category slug input
type CategorySlugInput struct {
	Slug string
}

// Validate validates thread creation input
func (c *CreateThreadInput) Validate() error {
	// Validate category slug
	categorySlug := strings.TrimSpace(c.CategorySlug)
	if categorySlug == "" {
		return apperrors.ErrMissingField.WithDetails("category_slug")
	}
	c.CategorySlug = categorySlug

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

	return nil
}

// Validate validates thread update input
func (u *UpdateThreadInput) Validate() error {
	// ThreadID is required
	if u.ThreadID == 0 {
		return apperrors.ErrMissingField.WithDetails("thread_id")
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

	// Validate telegram format if provided
	if telegram, ok := metaMap["telegram"].(string); ok {
		telegram = strings.TrimSpace(telegram)
		if telegram != "" {
			// Add @ prefix if not present
			if !strings.HasPrefix(telegram, "@") {
				telegram = "@" + telegram
			}
			metaMap["telegram"] = telegram
		}
	}

	return nil
}

// NormalizeMeta normalizes meta fields (applies telegram @ prefix)
func NormalizeMeta(meta interface{}) ([]byte, error) {
	if meta == nil {
		return json.Marshal(map[string]interface{}{})
	}

	metaMap, ok := meta.(map[string]interface{})
	if !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("meta harus berupa object")
	}

	// Normalize telegram handle
	if telegram, ok := metaMap["telegram"].(string); ok {
		telegram = strings.TrimSpace(telegram)
		if telegram != "" && !strings.HasPrefix(telegram, "@") {
			metaMap["telegram"] = "@" + telegram
		}
	}

	return json.Marshal(metaMap)
}
