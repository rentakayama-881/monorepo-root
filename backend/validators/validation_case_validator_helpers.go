package validators

import (
	"fmt"
	"strings"

	apperrors "backend-gin/errors"
	"backend-gin/utils"
)

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
