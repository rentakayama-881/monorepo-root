package services

import "testing"

func TestNormalizeDisputeSettlementOutcome(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "owner_refund exact",
			input: "owner_refund",
			want:  disputeSettlementOutcomeOwnerRefund,
		},
		{
			name:  "owner_refund uppercase",
			input: "OWNER_REFUND",
			want:  disputeSettlementOutcomeOwnerRefund,
		},
		{
			name:  "owner_refund with whitespace",
			input: "  Owner_Refund  ",
			want:  disputeSettlementOutcomeOwnerRefund,
		},
		{
			name:  "validator_release exact",
			input: "validator_release",
			want:  disputeSettlementOutcomeValidatorRelease,
		},
		{
			name:  "validator_release uppercase",
			input: "VALIDATOR_RELEASE",
			want:  disputeSettlementOutcomeValidatorRelease,
		},
		{
			name:  "validator_release with whitespace",
			input: "  Validator_Release  ",
			want:  disputeSettlementOutcomeValidatorRelease,
		},
		{
			name:  "empty string returns empty",
			input: "",
			want:  "",
		},
		{
			name:  "unknown outcome returns empty",
			input: "partial_refund",
			want:  "",
		},
		{
			name:  "random string returns empty",
			input: "foobar",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeDisputeSettlementOutcome(tt.input)
			if got != tt.want {
				t.Errorf("normalizeDisputeSettlementOutcome(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDisputeSettlementOutcomeConstants(t *testing.T) {
	if disputeSettlementOutcomeOwnerRefund == "" {
		t.Error("disputeSettlementOutcomeOwnerRefund should not be empty")
	}
	if disputeSettlementOutcomeValidatorRelease == "" {
		t.Error("disputeSettlementOutcomeValidatorRelease should not be empty")
	}
	if disputeSettlementOutcomeOwnerRefund == disputeSettlementOutcomeValidatorRelease {
		t.Error("dispute settlement outcomes should be distinct")
	}
}

func TestPlaceholder_SettleDisputeInternalByTransferID(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_AttachDispute(t *testing.T) {
	t.Skip("requires database connection")
}
