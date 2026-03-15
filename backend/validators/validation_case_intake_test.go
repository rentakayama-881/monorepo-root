package validators

import (
	"testing"
)

func TestParseStructuredIntakeContent_MissingCaseRecord(t *testing.T) {
	content := map[string]interface{}{
		"sensitivity_level": "S0",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
	}
	_, err := ParseStructuredIntakeContent(content)
	if err == nil {
		t.Error("expected error for missing case_record_text")
	}
}

func TestParseStructuredIntakeContent_MissingSensitivity(t *testing.T) {
	content := map[string]interface{}{
		"case_record_text": "Some case record content",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
	}
	_, err := ParseStructuredIntakeContent(content)
	if err == nil {
		t.Error("expected error for missing sensitivity level")
	}
}

func TestParseStructuredIntakeContent_InvalidSensitivity(t *testing.T) {
	content := map[string]interface{}{
		"case_record_text":  "Some case record content",
		"sensitivity_level": "INVALID",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
	}
	_, err := ParseStructuredIntakeContent(content)
	if err == nil {
		t.Error("expected error for invalid sensitivity level")
	}
}

func TestParseStructuredIntakeContent_BlockedContact(t *testing.T) {
	content := map[string]interface{}{
		"case_record_text":  "Contact me at t.me/user for details",
		"sensitivity_level": "S0",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
	}
	_, err := ParseStructuredIntakeContent(content)
	if err == nil {
		t.Error("expected error for blocked contact hint")
	}
}

func TestParseStructuredIntakeContent_MissingChecklist(t *testing.T) {
	content := map[string]interface{}{
		"case_record_text":  "Some case record content",
		"sensitivity_level": "S0",
	}
	_, err := ParseStructuredIntakeContent(content)
	if err == nil {
		t.Error("expected error for missing checklist")
	}
}

func TestParseStructuredIntakeContent_Valid(t *testing.T) {
	content := map[string]interface{}{
		"case_record_text":  "A detailed case record that explains the situation clearly.",
		"sensitivity_level": "S0",
		"validation_goal":   "Verify the claim",
		"output_type":       "Report",
		"checklist": map[string]interface{}{
			"scope_clearly_written":       true,
			"acceptance_criteria_defined": true,
			"sensitive_data_filtered":     true,
			"no_contact_in_case_record":   true,
		},
	}
	intake, err := ParseStructuredIntakeContent(content)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if intake.CaseRecord == "" {
		t.Error("CaseRecord should not be empty")
	}
	if intake.SensitivityLevel != "S0" {
		t.Errorf("SensitivityLevel = %q, want 'S0'", intake.SensitivityLevel)
	}
	if intake.ValidationGoal != "Verify the claim" {
		t.Errorf("ValidationGoal = %q", intake.ValidationGoal)
	}
}
