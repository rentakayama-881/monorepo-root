package services

import (
	"os"
	"testing"
)

func TestMinCredibilityStakeIDR_Default(t *testing.T) {
	os.Unsetenv("MIN_CREDIBILITY_STAKE_IDR")
	got := minCredibilityStakeIDR()
	if got != 100_000 {
		t.Errorf("default stake = %d, want 100000", got)
	}
}

func TestMinCredibilityStakeIDR_EnvOverride(t *testing.T) {
	t.Setenv("MIN_CREDIBILITY_STAKE_IDR", "200000")
	got := minCredibilityStakeIDR()
	if got != 200_000 {
		t.Errorf("env stake = %d, want 200000", got)
	}
}

func TestMinCredibilityStakeIDR_InvalidEnv(t *testing.T) {
	t.Setenv("MIN_CREDIBILITY_STAKE_IDR", "invalid")
	got := minCredibilityStakeIDR()
	if got != 100_000 {
		t.Errorf("invalid env should fallback to default, got %d", got)
	}
}

func TestMinCredibilityStakeIDR_NegativeEnv(t *testing.T) {
	t.Setenv("MIN_CREDIBILITY_STAKE_IDR", "-50")
	got := minCredibilityStakeIDR()
	if got != 100_000 {
		t.Errorf("negative env should fallback to default, got %d", got)
	}
}

func TestNormalizeStatus(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"OPEN", "open"},
		{"  Completed  ", "completed"},
		{"disputed", "disputed"},
		{"", ""},
	}
	for _, tt := range tests {
		got := normalizeStatus(tt.input)
		if got != tt.want {
			t.Errorf("normalizeStatus(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestCaseStatusConstants(t *testing.T) {
	statuses := []string{
		caseStatusOpen,
		caseStatusDisputed,
		caseStatusCompleted,
		caseStatusOfferAccepted,
		caseStatusFundsLocked,
		caseStatusArtifactSubmitted,
		caseStatusWaitingOwnerResponse,
		caseStatusOnHoldOwnerInactive,
	}
	seen := make(map[string]bool)
	for _, s := range statuses {
		if s == "" {
			t.Error("status constant should not be empty")
		}
		if seen[s] {
			t.Errorf("duplicate status constant: %q", s)
		}
		seen[s] = true
	}
}

func TestConsultationStakeConstants(t *testing.T) {
	if consultationStakeMinS1 <= 0 {
		t.Error("consultationStakeMinS1 should be positive")
	}
	if consultationStakeMinS2 <= consultationStakeMinS1 {
		t.Error("consultationStakeMinS2 should be > consultationStakeMinS1")
	}
}
