package validators

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

const (
	// IntakeSchemaVersion identifies the README-first workspace payload format.
	IntakeSchemaVersion = "workspace-readme-v1"

	workspaceBootstrapMaxFiles = 20
)

var (
	validSensitivityLevels = map[string]struct{}{
		"S0": {},
		"S1": {},
		"S2": {},
		"S3": {},
	}
	requiredChecklistKeys = []string{
		"scope_clearly_written",
		"acceptance_criteria_defined",
		"sensitive_data_filtered",
		"no_contact_in_case_record",
	}
	legacyChecklistKeys = []string{
		"intake_complete",
		"evidence_attached",
		"pass_criteria_defined",
		"constraints_defined",
		"no_contact_in_case_record",
	}
)

// StructuredIntake is canonical normalized case payload extracted from content.
type StructuredIntake struct {
	ValidationGoal   string
	OutputType       string
	EvidenceInput    string
	PassCriteria     string
	Constraints      string
	SensitivityLevel string
	CaseRecord       string
	Checklist        map[string]bool
}

type WorkspaceBootstrapFileInput struct {
	DocumentID string
	Kind       string
	Label      string
	Visibility string
}

// CreateValidationCaseInput represents Validation Case creation input.
type CreateValidationCaseInput struct {
	CategorySlug            string
	Title                   string
	Summary                 string
	ContentType             string
	Content                 interface{}
	Meta                    interface{}
	TagSlugs                []string
	BountyAmount            int64
	WorkspaceBootstrapFiles []WorkspaceBootstrapFileInput
	StructuredIntake        *StructuredIntake
}

// UpdateValidationCaseInput represents Validation Case update input.
type UpdateValidationCaseInput struct {
	ValidationCaseID uint
	Title            *string
	Summary          *string
	ContentType      *string
	Content          interface{}
	Meta             interface{}
	TagSlugs         *[]string
	BountyAmount     *int64
	Status           *string
	StructuredIntake *StructuredIntake
}

// CategorySlugInput represents category slug input
type CategorySlugInput struct {
	Slug string
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

func normalizeTagSlugs(tags []string, requireMinimum bool) ([]string, error) {
	seen := make(map[string]struct{})
	normalized := make([]string, 0, len(tags))
	dimensions := make(map[string]string)

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

		if dim := tagDimensionFromSlug(slug); dim != "" {
			if existing, ok := dimensions[dim]; ok {
				return nil, apperrors.ErrInvalidInput.WithDetails(
					fmt.Sprintf("tag dimensi '%s' hanya boleh satu (duplikat: %s dan %s)", dim, existing, slug),
				)
			}
			dimensions[dim] = slug
		}
		normalized = append(normalized, slug)
	}

	if len(normalized) > 4 {
		return nil, apperrors.ErrInvalidInput.WithDetails("maksimal 4 tag per validation case")
	}
	if requireMinimum && len(normalized) < 2 {
		return nil, apperrors.ErrInvalidInput.WithDetails("minimal 2 tag per validation case")
	}

	return normalized, nil
}

func tagDimensionFromSlug(slug string) string {
	switch {
	case strings.HasPrefix(slug, "artifact-"):
		return "artifact"
	case strings.HasPrefix(slug, "stage-"):
		return "stage"
	case strings.HasPrefix(slug, "domain-"):
		return "domain"
	case strings.HasPrefix(slug, "evidence-"):
		return "evidence"
	default:
		return ""
	}
}

func toMap(v interface{}) (map[string]interface{}, error) {
	switch typed := v.(type) {
	case map[string]interface{}:
		return typed, nil
	case nil:
		return nil, apperrors.ErrInvalidInput.WithDetails("object tidak boleh null")
	default:
		raw, err := json.Marshal(typed)
		if err != nil {
			return nil, apperrors.ErrInvalidInput.WithDetails("object tidak valid")
		}
		out := map[string]interface{}{}
		if err := json.Unmarshal(raw, &out); err != nil {
			return nil, apperrors.ErrInvalidInput.WithDetails("object tidak valid")
		}
		return out, nil
	}
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
