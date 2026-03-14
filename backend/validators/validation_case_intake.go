package validators

import (
	"strings"
	"time"

	apperrors "backend-gin/errors"
)

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
