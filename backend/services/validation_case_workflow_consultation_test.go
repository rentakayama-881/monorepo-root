package services

import (
	"backend-gin/ent"
	"os"
	"testing"
)

func TestRequiredStakeForConsultation(t *testing.T) {
	// Ensure env is clean for default baseline.
	os.Unsetenv("MIN_CREDIBILITY_STAKE_IDR")

	tests := []struct {
		name             string
		sensitivityLevel string
		bountyAmount     int64
		want             int64
	}{
		{
			name:             "nil case returns default baseline",
			sensitivityLevel: "", // nil case handled separately
			bountyAmount:     0,
			want:             100_000, // minCredibilityStakeIDR default
		},
		{
			name:             "S0 returns zero stake",
			sensitivityLevel: "S0",
			bountyAmount:     0,
			want:             0,
		},
		{
			name:             "S0 lowercase returns zero stake",
			sensitivityLevel: "s0",
			bountyAmount:     0,
			want:             0,
		},
		{
			name:             "S0 with whitespace returns zero stake",
			sensitivityLevel: "  S0  ",
			bountyAmount:     0,
			want:             0,
		},
		{
			name:             "S1 returns consultationStakeMinS1",
			sensitivityLevel: "S1",
			bountyAmount:     0,
			want:             consultationStakeMinS1,
		},
		{
			name:             "S1 lowercase",
			sensitivityLevel: "s1",
			bountyAmount:     0,
			want:             consultationStakeMinS1,
		},
		{
			name:             "S2 returns consultationStakeMinS2",
			sensitivityLevel: "S2",
			bountyAmount:     0,
			want:             consultationStakeMinS2,
		},
		{
			name:             "S3 with positive bounty returns bounty amount",
			sensitivityLevel: "S3",
			bountyAmount:     500_000,
			want:             500_000,
		},
		{
			name:             "S3 with zero bounty returns default baseline",
			sensitivityLevel: "S3",
			bountyAmount:     0,
			want:             100_000,
		},
		{
			name:             "S3 with negative bounty returns default baseline",
			sensitivityLevel: "S3",
			bountyAmount:     -100,
			want:             100_000,
		},
		{
			name:             "unknown sensitivity returns default baseline",
			sensitivityLevel: "S99",
			bountyAmount:     0,
			want:             100_000,
		},
		{
			name:             "empty sensitivity returns default baseline",
			sensitivityLevel: "",
			bountyAmount:     0,
			want:             100_000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.name == "nil case returns default baseline" {
				got := requiredStakeForConsultation(nil)
				if got != tt.want {
					t.Errorf("requiredStakeForConsultation(nil) = %d, want %d", got, tt.want)
				}
				return
			}

			vc := &ent.ValidationCase{}
			vc.SensitivityLevel = tt.sensitivityLevel
			vc.BountyAmount = tt.bountyAmount

			got := requiredStakeForConsultation(vc)
			if got != tt.want {
				t.Errorf("requiredStakeForConsultation(%q, bounty=%d) = %d, want %d",
					tt.sensitivityLevel, tt.bountyAmount, got, tt.want)
			}
		})
	}
}

func TestRequiredStakeForConsultation_EnvOverride(t *testing.T) {
	// When MIN_CREDIBILITY_STAKE_IDR is overridden, S3 with zero bounty should use the overridden value.
	t.Setenv("MIN_CREDIBILITY_STAKE_IDR", "250000")

	vc := &ent.ValidationCase{}
	vc.SensitivityLevel = "S3"
	vc.BountyAmount = 0

	got := requiredStakeForConsultation(vc)
	if got != 250_000 {
		t.Errorf("S3 with env override: got %d, want 250000", got)
	}
}

func TestPlaceholder_RequestConsultation(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_GetConsultationRequestForValidator(t *testing.T) {
	t.Skip("requires database connection")
}
