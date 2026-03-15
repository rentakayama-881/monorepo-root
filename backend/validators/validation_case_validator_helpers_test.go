package validators

import (
	"testing"
)

func TestSensitivityPolicyByLevel(t *testing.T) {
	tests := []struct {
		level           string
		wantVisibility  string
		wantTeleAllowed bool
	}{
		{"S0", "public", true},
		{"S1", "restricted", true},
		{"S2", "confidential", false},
		{"S3", "critical", false},
		{"s0", "public", true},            // case insensitive
		{"  S1  ", "restricted", true},    // trimmed
		{"", "restricted", true},          // default
		{"UNKNOWN", "restricted", true},   // default
	}
	for _, tt := range tests {
		t.Run(tt.level, func(t *testing.T) {
			got := SensitivityPolicyByLevel(tt.level)
			if got["visibility"] != tt.wantVisibility {
				t.Errorf("visibility = %v, want %q", got["visibility"], tt.wantVisibility)
			}
			if got["telegram_allowed"] != tt.wantTeleAllowed {
				t.Errorf("telegram_allowed = %v, want %v", got["telegram_allowed"], tt.wantTeleAllowed)
			}
		})
	}
}

func TestContainsBlockedContactHint(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"normal text", false},
		{"contact me at t.me/user", true},
		{"use telegram.me/group", true},
		{"call via whatsapp", true},
		{"wa.me/123456", true},
		{"line.me/ti/p/xxx", true},
		{"discord.gg/invite", true},
		{"kontak langsung via DM", true},
		{"", false},
		{"no blocked content here", false},
	}
	for _, tt := range tests {
		got := containsBlockedContactHint(tt.input)
		if got != tt.want {
			t.Errorf("containsBlockedContactHint(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestHasAllChecklistKeys(t *testing.T) {
	m := map[string]interface{}{
		"key1": true,
		"key2": false,
		"key3": true,
	}

	if !hasAllChecklistKeys(m, []string{"key1", "key2"}) {
		t.Error("should have all keys")
	}
	if hasAllChecklistKeys(m, []string{"key1", "missing"}) {
		t.Error("should not have missing key")
	}
	if !hasAllChecklistKeys(m, []string{}) {
		t.Error("empty keys should return true")
	}
}

func TestIntakeSchemaVersionConstant(t *testing.T) {
	if IntakeSchemaVersion == "" {
		t.Error("IntakeSchemaVersion should not be empty")
	}
}

func TestBuildAutoSummary(t *testing.T) {
	t.Run("nil intake", func(t *testing.T) {
		got := BuildAutoSummary(nil)
		if got != "" {
			t.Errorf("expected empty, got %q", got)
		}
	})

	t.Run("with all fields", func(t *testing.T) {
		intake := &StructuredIntake{
			ValidationGoal: "Verify claim",
			OutputType:     "Report",
			PassCriteria:   "All checks pass",
			Constraints:    "No contact info",
		}
		got := BuildAutoSummary(intake)
		if got == "" {
			t.Error("expected non-empty summary")
		}
	})

	t.Run("with partial fields", func(t *testing.T) {
		intake := &StructuredIntake{
			ValidationGoal: "Verify claim",
		}
		got := BuildAutoSummary(intake)
		if got == "" {
			t.Error("expected non-empty summary")
		}
	})
}
