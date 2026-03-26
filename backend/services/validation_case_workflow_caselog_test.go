package services

import (
	"backend-gin/ent"
	"testing"
)

func TestDeriveCaseStatusFromWorkflowLinkage(t *testing.T) {
	strPtr := func(s string) *string { return &s }
	intPtr := func(i int) *int { return &i }

	tests := []struct {
		name string
		vc   *ent.ValidationCase
		want string
	}{
		{
			name: "nil case returns open",
			vc:   nil,
			want: caseStatusOpen,
		},
		{
			name: "empty case returns open",
			vc:   &ent.ValidationCase{},
			want: caseStatusOpen,
		},
		{
			name: "disputed takes highest priority",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.DisputeID = strPtr("dispute-123")
				vc.CertifiedArtifactDocumentID = strPtr("cert-456")
				vc.ArtifactDocumentID = strPtr("art-789")
				vc.EscrowTransferID = strPtr("esc-abc")
				offerID := 1
				vc.AcceptedFinalOfferID = &offerID
				return vc
			}(),
			want: caseStatusDisputed,
		},
		{
			name: "certified artifact means completed",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.CertifiedArtifactDocumentID = strPtr("cert-456")
				vc.ArtifactDocumentID = strPtr("art-789")
				vc.EscrowTransferID = strPtr("esc-abc")
				offerID := 1
				vc.AcceptedFinalOfferID = &offerID
				return vc
			}(),
			want: caseStatusCompleted,
		},
		{
			name: "artifact submitted without certified",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.ArtifactDocumentID = strPtr("art-789")
				vc.EscrowTransferID = strPtr("esc-abc")
				offerID := 1
				vc.AcceptedFinalOfferID = &offerID
				return vc
			}(),
			want: caseStatusArtifactSubmitted,
		},
		{
			name: "escrow locked without artifact",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.EscrowTransferID = strPtr("esc-abc")
				offerID := 1
				vc.AcceptedFinalOfferID = &offerID
				return vc
			}(),
			want: caseStatusFundsLocked,
		},
		{
			name: "accepted offer without escrow",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.AcceptedFinalOfferID = intPtr(5)
				return vc
			}(),
			want: caseStatusOfferAccepted,
		},
		{
			name: "accepted offer ID zero treated as open",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.AcceptedFinalOfferID = intPtr(0)
				return vc
			}(),
			want: caseStatusOpen,
		},
		{
			name: "empty string dispute ID treated as absent",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.DisputeID = strPtr("")
				return vc
			}(),
			want: caseStatusOpen,
		},
		{
			name: "whitespace-only escrow transfer ID treated as absent",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.EscrowTransferID = strPtr("   ")
				return vc
			}(),
			want: caseStatusOpen,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := deriveCaseStatusFromWorkflowLinkage(tt.vc)
			if got != tt.want {
				t.Errorf("deriveCaseStatusFromWorkflowLinkage() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestPlaceholder_AppendCaseLogBestEffort(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_NormalizeLegacyClarificationFlow(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_GetCaseLog(t *testing.T) {
	t.Skip("requires database connection")
}
