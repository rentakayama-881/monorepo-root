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
	// IntakeSchemaVersion identifies the currently enforced quick-intake format.
	IntakeSchemaVersion = "quick-intake-v1"

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
		"intake_complete",
		"evidence_attached",
		"pass_criteria_defined",
		"constraints_defined",
		"no_contact_in_case_record",
	}
)

// StructuredIntake is canonical normalized intake extracted from content payload.
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

// ParseStructuredIntakeContent validates and normalizes protocol payload inside content.
func ParseStructuredIntakeContent(content interface{}) (*StructuredIntake, error) {
	contentMap, err := toMap(content)
	if err != nil {
		return nil, err
	}

	quickIntakeRaw, ok := contentMap["quick_intake"]
	if !ok {
		return nil, apperrors.ErrMissingField.WithDetails("content.quick_intake")
	}
	quickIntake, err := toMap(quickIntakeRaw)
	if err != nil {
		return nil, apperrors.ErrInvalidInput.WithDetails("content.quick_intake harus berupa object")
	}

	intake := &StructuredIntake{}
	if intake.ValidationGoal, err = requiredSanitizedText(quickIntake, []string{"validation_goal", "tujuan_validasi"}, "content.quick_intake.validation_goal", 12, 800); err != nil {
		return nil, err
	}
	if intake.OutputType, err = requiredSanitizedText(quickIntake, []string{"output_type", "jenis_output"}, "content.quick_intake.output_type", 4, 240); err != nil {
		return nil, err
	}
	if intake.EvidenceInput, err = requiredSanitizedText(quickIntake, []string{"evidence_input", "bukti_input"}, "content.quick_intake.evidence_input", 8, 2000); err != nil {
		return nil, err
	}
	if intake.PassCriteria, err = requiredSanitizedText(quickIntake, []string{"pass_criteria", "kriteria_lulus"}, "content.quick_intake.pass_criteria", 8, 2000); err != nil {
		return nil, err
	}
	if intake.Constraints, err = requiredSanitizedText(quickIntake, []string{"constraints", "batasan"}, "content.quick_intake.constraints", 4, 2000); err != nil {
		return nil, err
	}

	sensitivity, err := requiredSanitizedText(quickIntake, []string{"sensitivity", "sensitivity_level", "sensitivitas"}, "content.quick_intake.sensitivity", 2, 16)
	if err != nil {
		return nil, err
	}
	sensitivity = strings.ToUpper(strings.TrimSpace(sensitivity))
	if _, ok := validSensitivityLevels[sensitivity]; !ok {
		return nil, apperrors.ErrInvalidInput.WithDetails("sensitivity harus salah satu: S0, S1, S2, S3")
	}
	intake.SensitivityLevel = sensitivity

	// Case record is intentionally unlimited in length to support long markdown copy/paste.
	caseRecord, err := optionalSanitizedText(contentMap, []string{"case_record_text", "case_record"}, "content.case_record_text", 0)
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

	checklistRaw, ok := contentMap["checklist"]
	if !ok {
		return nil, apperrors.ErrMissingField.WithDetails("content.checklist")
	}
	checklistMap, err := toMap(checklistRaw)
	if err != nil {
		return nil, apperrors.ErrInvalidInput.WithDetails("content.checklist harus berupa object")
	}

	intake.Checklist = make(map[string]bool, len(requiredChecklistKeys))
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
		intake.Checklist[key] = checked
	}

	return intake, nil
}

// BuildAutoSummary generates Layer-2 summary from Quick Intake.
func BuildAutoSummary(intake *StructuredIntake) string {
	if intake == nil {
		return ""
	}
	base := fmt.Sprintf(
		"Tujuan: %s. Output: %s. Bukti yang diperiksa: %s. Lulus jika: %s.",
		intake.ValidationGoal,
		intake.OutputType,
		intake.EvidenceInput,
		intake.PassCriteria,
	)
	if len(base) <= 500 {
		return base
	}
	return base[:500]
}

// BuildAutoValidationBrief returns structured brief for validators.
func BuildAutoValidationBrief(intake *StructuredIntake) map[string]interface{} {
	if intake == nil {
		return map[string]interface{}{}
	}
	return map[string]interface{}{
		"objective":            intake.ValidationGoal,
		"expected_output_type": intake.OutputType,
		"evidence_scope":       intake.EvidenceInput,
		"pass_gate":            intake.PassCriteria,
		"constraints":          intake.Constraints,
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

// BuildCanonicalStructuredContent normalizes payload so validator can read without chat.
func BuildCanonicalStructuredContent(intake *StructuredIntake) map[string]interface{} {
	brief := BuildAutoValidationBrief(intake)
	sections := []map[string]interface{}{
		{
			"title": "Layer 1 — Quick Intake (60-90 detik)",
			"rows": []map[string]interface{}{
				{"label": "Tujuan Validasi", "value": intake.ValidationGoal},
				{"label": "Jenis Output", "value": intake.OutputType},
				{"label": "Bukti / Input", "value": intake.EvidenceInput},
				{"label": "Kriteria Lulus", "value": intake.PassCriteria},
				{"label": "Batasan", "value": intake.Constraints},
				{"label": "Sensitivitas", "value": intake.SensitivityLevel},
			},
		},
		{
			"title": "Layer 2 — Auto Validation Brief",
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
		{
			"title": "Case Record (Free Text)",
			"rows": []map[string]interface{}{
				{"label": "Record", "value": intake.CaseRecord},
			},
		},
	}

	return map[string]interface{}{
		"schema_version": IntakeSchemaVersion,
		"quick_intake": map[string]interface{}{
			"validation_goal": intake.ValidationGoal,
			"output_type":     intake.OutputType,
			"evidence_input":  intake.EvidenceInput,
			"pass_criteria":   intake.PassCriteria,
			"constraints":     intake.Constraints,
			"sensitivity":     intake.SensitivityLevel,
		},
		"checklist":             intake.Checklist,
		"auto_validation_brief": brief,
		"case_record_text":      intake.CaseRecord,
		"sections":              sections,
	}
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

func requiredSanitizedText(input map[string]interface{}, keys []string, label string, minLen int, maxLen int) (string, error) {
	var raw string
	for _, key := range keys {
		if v, ok := input[key]; ok {
			if s, ok := v.(string); ok {
				raw = s
				break
			}
		}
	}
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", apperrors.ErrMissingField.WithDetails(label)
	}
	if len(value) < minLen {
		return "", apperrors.ErrInvalidInput.WithDetails(label + " terlalu pendek")
	}
	if maxLen > 0 && len(value) > maxLen {
		return "", apperrors.ErrInvalidInput.WithDetails(label + " melebihi batas panjang")
	}
	if !utils.ValidateNoXSS(value) {
		return "", apperrors.ErrInvalidInput.WithDetails(label + " mengandung karakter atau pola yang tidak diizinkan")
	}
	return utils.SanitizeText(value), nil
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
