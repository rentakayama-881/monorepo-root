package validators

import (
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

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
		*u.ContentType = contentType
	}
	if u.Content != nil {
		structuredIntake, err := ParseStructuredIntakeContent(u.Content)
		if err != nil {
			return err
		}
		u.StructuredIntake = structuredIntake
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
		normalized, err := normalizeTagSlugs(*u.TagSlugs, true)
		if err != nil {
			return err
		}
		*u.TagSlugs = normalized
	}

	return nil
}
