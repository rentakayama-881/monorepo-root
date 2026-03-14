package validators

import (
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

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
		contentType = "json"
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
	structuredIntake, err := ParseStructuredIntakeContent(c.Content)
	if err != nil {
		return err
	}
	c.StructuredIntake = structuredIntake
	// Enforce protocol payload as JSON object.
	c.ContentType = "json"

	// Validate meta if provided
	if c.Meta != nil {
		if err := validateMeta(c.Meta); err != nil {
			return err
		}
	}

	// Normalize tag slugs (minimum 2 required by taxonomy).
	normalized, err := normalizeTagSlugs(c.TagSlugs, true)
	if err != nil {
		return err
	}
	c.TagSlugs = normalized

	bootstrapFiles, err := normalizeWorkspaceBootstrapFiles(c.WorkspaceBootstrapFiles)
	if err != nil {
		return err
	}
	c.WorkspaceBootstrapFiles = bootstrapFiles

	return nil
}
