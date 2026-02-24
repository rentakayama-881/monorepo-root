package validators

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

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

func normalizeWorkspaceBootstrapFiles(files []WorkspaceBootstrapFileInput) ([]WorkspaceBootstrapFileInput, error) {
	if len(files) == 0 {
		return nil, nil
	}
	if len(files) > workspaceBootstrapMaxFiles {
		return nil, apperrors.ErrInvalidInput.WithDetails(
			fmt.Sprintf("workspace_bootstrap_files maksimal %d item", workspaceBootstrapMaxFiles),
		)
	}

	seen := make(map[string]struct{}, len(files))
	out := make([]WorkspaceBootstrapFileInput, 0, len(files))
	for i, raw := range files {
		documentID := strings.TrimSpace(raw.DocumentID)
		kind := strings.ToLower(strings.TrimSpace(raw.Kind))
		label := strings.TrimSpace(raw.Label)
		visibility := strings.ToLower(strings.TrimSpace(raw.Visibility))

		if documentID == "" {
			return nil, apperrors.ErrMissingField.WithDetails(fmt.Sprintf("workspace_bootstrap_files[%d].document_id", i))
		}
		if len(documentID) > 200 {
			return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("workspace_bootstrap_files[%d].document_id terlalu panjang", i))
		}

		switch kind {
		case "case_readme", "task_input", "sensitive_context":
			// allowed
		default:
			return nil, apperrors.ErrInvalidInput.WithDetails(
				fmt.Sprintf("workspace_bootstrap_files[%d].kind tidak valid", i),
			)
		}

		if label == "" {
			return nil, apperrors.ErrMissingField.WithDetails(fmt.Sprintf("workspace_bootstrap_files[%d].label", i))
		}
		if len(label) > 120 {
			return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("workspace_bootstrap_files[%d].label terlalu panjang", i))
		}
		if !utils.ValidateNoXSS(label) {
			return nil, apperrors.ErrInvalidInput.WithDetails(fmt.Sprintf("workspace_bootstrap_files[%d].label tidak valid", i))
		}
		label = utils.SanitizeText(label)

		switch visibility {
		case "", "public", "assigned_validators":
			// allowed
		default:
			return nil, apperrors.ErrInvalidInput.WithDetails(
				fmt.Sprintf("workspace_bootstrap_files[%d].visibility tidak valid", i),
			)
		}
		if visibility == "" {
			visibility = "public"
		}
		if kind == "sensitive_context" {
			visibility = "assigned_validators"
		}

		dedupeKey := documentID + "|" + kind
		if _, ok := seen[dedupeKey]; ok {
			continue
		}
		seen[dedupeKey] = struct{}{}

		out = append(out, WorkspaceBootstrapFileInput{
			DocumentID: documentID,
			Kind:       kind,
			Label:      label,
			Visibility: visibility,
		})
	}

	return out, nil
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

// ParseStructuredIntakeContent validates and normalizes README-first protocol payload.
func ParseStructuredIntakeContent(content interface{}) (*StructuredIntake, error) {
	contentMap, err := toMap(content)
	if err != nil {
		return nil, err
	}

	intake := &StructuredIntake{}

	// Case record is the source of truth and intentionally unlimited in length.
	caseRecord, err := optionalSanitizedText(
		contentMap,
		[]string{"case_record_text", "case_record", "readme", "readme_markdown"},
		"content.case_record_text",
		0,
	)
	if err != nil {
		return nil, err
	}
	if caseRecord == "" {
		return nil, apperrors.ErrMissingField.WithDetails("content.case_record_text")
	}
	if containsBlockedContactHint(caseRecord) {
		return nil, apperrors.ErrInvalidInput.WithDetails("Case Record tidak boleh memuat detail kontak langsung. Gunakan protocol consultation.")
	}
	intake.CaseRecord = caseRecord

	quickIntake, hasLegacyQuickIntake, err := extractLegacyQuickIntake(contentMap)
	if err != nil {
		return nil, err
	}

	// Optional structured hints. New payload can omit these.
	intake.ValidationGoal, err = optionalSanitizedText(
		contentMap,
		[]string{"validation_goal", "objective", "goal"},
		"content.validation_goal",
		800,
	)
	if err != nil {
		return nil, err
	}
	if intake.OutputType, err = optionalSanitizedText(contentMap, []string{"output_type", "expected_output_type"}, "content.output_type", 240); err != nil {
		return nil, err
	}
	if intake.EvidenceInput, err = optionalSanitizedText(contentMap, []string{"evidence_input", "evidence_scope"}, "content.evidence_input", 2000); err != nil {
		return nil, err
	}
	if intake.PassCriteria, err = optionalSanitizedText(contentMap, []string{"pass_criteria", "acceptance_criteria", "pass_gate"}, "content.pass_criteria", 2000); err != nil {
		return nil, err
	}
	if intake.Constraints, err = optionalSanitizedText(contentMap, []string{"constraints"}, "content.constraints", 2000); err != nil {
		return nil, err
	}

	// Legacy quick-intake fallback (read compatibility).
	if hasLegacyQuickIntake {
		if intake.ValidationGoal == "" {
			intake.ValidationGoal, err = optionalSanitizedText(quickIntake, []string{"validation_goal", "tujuan_validasi"}, "content.quick_intake.validation_goal", 800)
			if err != nil {
				return nil, err
			}
		}
		if intake.OutputType == "" {
			intake.OutputType, err = optionalSanitizedText(quickIntake, []string{"output_type", "jenis_output"}, "content.quick_intake.output_type", 240)
			if err != nil {
				return nil, err
			}
		}
		if intake.EvidenceInput == "" {
			intake.EvidenceInput, err = optionalSanitizedText(quickIntake, []string{"evidence_input", "bukti_input"}, "content.quick_intake.evidence_input", 2000)
			if err != nil {
				return nil, err
			}
		}
		if intake.PassCriteria == "" {
			intake.PassCriteria, err = optionalSanitizedText(quickIntake, []string{"pass_criteria", "kriteria_lulus"}, "content.quick_intake.pass_criteria", 2000)
			if err != nil {
				return nil, err
			}
		}
		if intake.Constraints == "" {
			intake.Constraints, err = optionalSanitizedText(quickIntake, []string{"constraints", "batasan"}, "content.quick_intake.constraints", 2000)
			if err != nil {
				return nil, err
			}
		}
	}

	sensitivity, err := optionalSanitizedText(
		contentMap,
		[]string{"sensitivity_level", "sensitivity", "case_sensitivity"},
		"content.sensitivity_level",
		16,
	)
	if err != nil {
		return nil, err
	}
	if sensitivity == "" && hasLegacyQuickIntake {
		sensitivity, err = optionalSanitizedText(quickIntake, []string{"sensitivity", "sensitivity_level", "sensitivitas"}, "content.quick_intake.sensitivity", 16)
		if err != nil {
			return nil, err
		}
	}
	if sensitivity == "" {
		return nil, apperrors.ErrMissingField.WithDetails("content.sensitivity_level")
	}
	sensitivity = strings.ToUpper(strings.TrimSpace(sensitivity))
	if _, ok := validSensitivityLevels[sensitivity]; !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("sensitivity harus salah satu: S0, S1, S2, S3")
	}
	intake.SensitivityLevel = sensitivity

	checklistRaw, ok := contentMap["checklist"]
	if !ok {
		return nil, apperrors.ErrMissingField.WithDetails("content.checklist")
	}
	checklistMap, err := toMap(checklistRaw)
	if err != nil {
		return nil, apperrors.ErrInvalidInput.WithDetails("content.checklist harus berupa object")
	}

	intake.Checklist, err = normalizeProtocolChecklist(checklistMap)
	if err != nil {
		return nil, err
	}

	return intake, nil
}

// BuildAutoSummary derives list summary from README-first payload.
func BuildAutoSummary(intake *StructuredIntake) string {
	if intake == nil {
		return ""
	}
	parts := make([]string, 0, 4)
	if strings.TrimSpace(intake.ValidationGoal) != "" {
		parts = append(parts, "Tujuan: "+strings.TrimSpace(intake.ValidationGoal))
	}
	if strings.TrimSpace(intake.OutputType) != "" {
		parts = append(parts, "Output: "+strings.TrimSpace(intake.OutputType))
	}
	if strings.TrimSpace(intake.PassCriteria) != "" {
		parts = append(parts, "Lulus jika: "+strings.TrimSpace(intake.PassCriteria))
	}
	if strings.TrimSpace(intake.Constraints) != "" {
		parts = append(parts, "Batasan: "+strings.TrimSpace(intake.Constraints))
	}
	summary := strings.Join(parts, ". ")
	if summary == "" {
		summary = strings.Join(strings.Fields(strings.TrimSpace(intake.CaseRecord)), " ")
	}
	summary = strings.TrimSpace(summary)
	if len(summary) <= 500 {
		return summary
	}
	return summary[:500]
}

// BuildAutoValidationBrief returns protocol brief derived from README-first payload.
func BuildAutoValidationBrief(intake *StructuredIntake) map[string]interface{} {
	if intake == nil {
		return map[string]interface{}{}
	}

	objective := intake.ValidationGoal
	if strings.TrimSpace(objective) == "" {
		objective = "Lihat README case pada case_record_text."
	}
	expectedOutput := intake.OutputType
	if strings.TrimSpace(expectedOutput) == "" {
		expectedOutput = "Mengikuti deskripsi output pada README case."
	}
	passGate := intake.PassCriteria
	if strings.TrimSpace(passGate) == "" {
		passGate = "Mengikuti acceptance criteria pada README case."
	}
	evidenceScope := intake.EvidenceInput
	if strings.TrimSpace(evidenceScope) == "" {
		evidenceScope = "Lihat workspace files berjenis task_input."
	}
	constraints := intake.Constraints
	if strings.TrimSpace(constraints) == "" {
		constraints = "Mengikuti batasan yang ditulis owner di README case."
	}

	return map[string]interface{}{
		"source_of_truth":      "case_record_text",
		"objective":            objective,
		"expected_output_type": expectedOutput,
		"evidence_scope":       evidenceScope,
		"pass_gate":            passGate,
		"constraints":          constraints,
		"sensitivity":          intake.SensitivityLevel,
		"sensitivity_policy":   SensitivityPolicyByLevel(intake.SensitivityLevel),
		"owner_response_sla": map[string]interface{}{
			"max_hours":         12,
			"reminder_hours":    []int{2, 8},
			"timeout_outcome":   "on_hold_owner_inactive",
			"reassignment":      false,
			"validator_penalty": false,
		},
		"generated_at_unix": time.Now().Unix(),
	}
}

// BuildCanonicalStructuredContent normalizes payload so validator can read directly from README.
func BuildCanonicalStructuredContent(intake *StructuredIntake) map[string]interface{} {
	brief := BuildAutoValidationBrief(intake)
	sections := []map[string]interface{}{
		{
			"title": "Case README (Owner Authored)",
			"rows": []map[string]interface{}{
				{"label": "README", "value": intake.CaseRecord},
			},
		},
		{
			"title": "Protocol Guardrails",
			"rows": []map[string]interface{}{
				{"label": "Sensitivity", "value": intake.SensitivityLevel},
				{"label": "Checklist", "value": intake.Checklist},
				{"label": "Source of Truth", "value": "case_record_text"},
			},
		},
		{
			"title": "Auto Validation Brief",
			"rows": []map[string]interface{}{
				{"label": "Objective", "value": brief["objective"]},
				{"label": "Expected Output", "value": brief["expected_output_type"]},
				{"label": "Evidence Scope", "value": brief["evidence_scope"]},
				{"label": "Pass Gate", "value": brief["pass_gate"]},
				{"label": "Constraints", "value": brief["constraints"]},
				{"label": "Sensitivity Policy", "value": brief["sensitivity_policy"]},
				{"label": "Owner Response SLA", "value": brief["owner_response_sla"]},
			},
		},
	}

	content := map[string]interface{}{
		"schema_version":        IntakeSchemaVersion,
		"source_of_truth":       "case_readme_markdown",
		"sensitivity_level":     intake.SensitivityLevel,
		"checklist":             intake.Checklist,
		"auto_validation_brief": brief,
		"case_record_text":      intake.CaseRecord,
		"sections":              sections,
	}
	if strings.TrimSpace(intake.ValidationGoal) != "" {
		content["validation_goal"] = intake.ValidationGoal
	}
	if strings.TrimSpace(intake.OutputType) != "" {
		content["output_type"] = intake.OutputType
	}
	if strings.TrimSpace(intake.EvidenceInput) != "" {
		content["evidence_input"] = intake.EvidenceInput
	}
	if strings.TrimSpace(intake.PassCriteria) != "" {
		content["pass_criteria"] = intake.PassCriteria
	}
	if strings.TrimSpace(intake.Constraints) != "" {
		content["constraints"] = intake.Constraints
	}
	return content
}

func extractLegacyQuickIntake(contentMap map[string]interface{}) (map[string]interface{}, bool, error) {
	raw, ok := contentMap["quick_intake"]
	if !ok {
		return nil, false, nil
	}
	quickIntake, err := toMap(raw)
	if err != nil {
		return nil, false, apperrors.ErrInvalidInput.WithDetails("content.quick_intake harus berupa object")
	}
	return quickIntake, true, nil
}

func normalizeProtocolChecklist(checklistMap map[string]interface{}) (map[string]bool, error) {
	if hasAllChecklistKeys(checklistMap, requiredChecklistKeys) {
		out := make(map[string]bool, len(requiredChecklistKeys))
		for _, key := range requiredChecklistKeys {
			v, ok := checklistMap[key]
			if !ok {
				return nil, apperrors.ErrMissingField.WithDetails("content.checklist." + key)
			}
			checked, ok := v.(bool)
			if !ok {
				return nil, apperrors.ErrInvalidInput.WithDetails("content.checklist." + key + " harus boolean")
			}
			if !checked {
				return nil, apperrors.ErrInvalidInput.WithDetails("checklist '" + key + "' harus dicentang")
			}
			out[key] = true
		}
		return out, nil
	}

	// Legacy checklist compatibility path.
	if hasAllChecklistKeys(checklistMap, legacyChecklistKeys) {
		for _, key := range legacyChecklistKeys {
			v, ok := checklistMap[key]
			if !ok {
				return nil, apperrors.ErrMissingField.WithDetails("content.checklist." + key)
			}
			checked, ok := v.(bool)
			if !ok {
				return nil, apperrors.ErrInvalidInput.WithDetails("content.checklist." + key + " harus boolean")
			}
			if !checked {
				return nil, apperrors.ErrInvalidInput.WithDetails("checklist '" + key + "' harus dicentang")
			}
		}
		return map[string]bool{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		}, nil
	}

	return nil, apperrors.ErrMissingField.WithDetails("content.checklist.scope_clearly_written")
}

func hasAllChecklistKeys(checklistMap map[string]interface{}, keys []string) bool {
	for _, key := range keys {
		if _, ok := checklistMap[key]; !ok {
			return false
		}
	}
	return true
}

// SensitivityPolicyByLevel defines visibility and telegram gate by tier.
func SensitivityPolicyByLevel(level string) map[string]interface{} {
	switch strings.ToUpper(strings.TrimSpace(level)) {
	case "S0":
		return map[string]interface{}{
			"visibility":              "public",
			"telegram_allowed":        true,
			"requires_admin_gate":     false,
			"requires_pre_moderation": false,
		}
	case "S1":
		return map[string]interface{}{
			"visibility":              "restricted",
			"telegram_allowed":        true,
			"requires_admin_gate":     false,
			"requires_pre_moderation": false,
		}
	case "S2":
		return map[string]interface{}{
			"visibility":              "confidential",
			"telegram_allowed":        false,
			"requires_admin_gate":     true,
			"requires_pre_moderation": true,
		}
	case "S3":
		return map[string]interface{}{
			"visibility":              "critical",
			"telegram_allowed":        false,
			"requires_admin_gate":     true,
			"requires_pre_moderation": true,
		}
	default:
		return map[string]interface{}{
			"visibility":              "restricted",
			"telegram_allowed":        true,
			"requires_admin_gate":     false,
			"requires_pre_moderation": false,
		}
	}
}

func optionalSanitizedText(input map[string]interface{}, keys []string, label string, maxLen int) (string, error) {
	for _, key := range keys {
		v, ok := input[key]
		if !ok {
			continue
		}
		s, ok := v.(string)
		if !ok {
			return "", apperrors.ErrInvalidInput.WithDetails(label + " harus string")
		}
		value := strings.TrimSpace(s)
		if maxLen > 0 && len(value) > maxLen {
			return "", apperrors.ErrInvalidInput.WithDetails(label + " melebihi batas panjang")
		}
		if value != "" && !utils.ValidateNoXSS(value) {
			return "", apperrors.ErrInvalidInput.WithDetails(label + " mengandung karakter atau pola yang tidak diizinkan")
		}
		return value, nil
	}
	return "", nil
}

func containsBlockedContactHint(s string) bool {
	lower := strings.ToLower(s)
	blocked := []string{"t.me/", "telegram.me/", "whatsapp", "wa.me/", "line.me/", "discord.gg/", "kontak langsung"}
	for _, needle := range blocked {
		if strings.Contains(lower, needle) {
			return true
		}
	}
	return false
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
