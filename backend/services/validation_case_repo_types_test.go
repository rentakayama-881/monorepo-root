package services

import (
	"testing"
)

func TestRepoCaseFileItemType(t *testing.T) {
	item := RepoCaseFileItem{
		ID:         "file-1",
		DocumentID: "doc-123",
		Kind:       "case_readme",
		Label:      "README",
		Visibility: "public",
		UploadedBy: 42,
		UploadedAt: 1234567890,
	}
	if item.Kind != "case_readme" {
		t.Errorf("Kind = %q", item.Kind)
	}
}

func TestRepoAssignmentItemType(t *testing.T) {
	item := RepoAssignmentItem{
		ValidatorUserID: 7,
		Status:          "active",
		AssignedAt:      1234567890,
	}
	if item.ValidatorUserID != 7 {
		t.Errorf("ValidatorUserID = %d", item.ValidatorUserID)
	}
}

func TestRepoVerdictItemType(t *testing.T) {
	item := RepoVerdictItem{
		ValidatorUserID: 7,
		Verdict:         "valid",
		Confidence:      85,
		Notes:           "Looks good",
	}
	if item.Verdict != "valid" {
		t.Errorf("Verdict = %q", item.Verdict)
	}
	if item.Confidence != 85 {
		t.Errorf("Confidence = %d", item.Confidence)
	}
}

func TestRepoPayoutLedgerType(t *testing.T) {
	ledger := RepoPayoutLedger{
		BountyAmount: 100000,
		Entries: []RepoPayoutEntry{
			{ValidatorUserID: 1, Amount: 50000},
			{ValidatorUserID: 2, Amount: 50000},
		},
	}
	if ledger.BountyAmount != 100000 {
		t.Errorf("BountyAmount = %d", ledger.BountyAmount)
	}
	if len(ledger.Entries) != 2 {
		t.Errorf("Entries len = %d", len(ledger.Entries))
	}
}
