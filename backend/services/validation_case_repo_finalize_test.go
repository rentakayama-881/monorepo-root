package services

import (
	"testing"
)

func TestBuildRepoPayoutLedger_ZeroBounty(t *testing.T) {
	latest := map[uint]RepoVerdictItem{
		1: {ValidatorUserID: 1, Verdict: "valid", Confidence: 5},
	}
	got := buildRepoPayoutLedger(0, "valid", latest)
	if got != nil {
		t.Error("expected nil for zero bounty")
	}
}

func TestBuildRepoPayoutLedger_NegativeBounty(t *testing.T) {
	latest := map[uint]RepoVerdictItem{
		1: {ValidatorUserID: 1, Verdict: "valid", Confidence: 5},
	}
	got := buildRepoPayoutLedger(-100, "valid", latest)
	if got != nil {
		t.Error("expected nil for negative bounty")
	}
}

func TestBuildRepoPayoutLedger_EmptyVerdicts(t *testing.T) {
	got := buildRepoPayoutLedger(100000, "valid", map[uint]RepoVerdictItem{})
	if got != nil {
		t.Error("expected nil for empty verdicts")
	}
}

func TestBuildRepoPayoutLedger_SingleValidator(t *testing.T) {
	bounty := int64(100000)
	latest := map[uint]RepoVerdictItem{
		10: {ValidatorUserID: 10, Verdict: "valid", Confidence: 5},
	}
	got := buildRepoPayoutLedger(bounty, "valid", latest)
	if got == nil {
		t.Fatal("expected non-nil ledger")
	}
	if got.BountyAmount != bounty {
		t.Errorf("BountyAmount = %d, want %d", got.BountyAmount, bounty)
	}
	if len(got.Entries) != 1 {
		t.Fatalf("entries = %d, want 1", len(got.Entries))
	}

	total := got.Entries[0].BaseAmount + got.Entries[0].QualityAmount + got.Entries[0].ChainLocked
	if total != bounty {
		t.Errorf("total payout = %d, want %d", total, bounty)
	}
}

func TestBuildRepoPayoutLedger_PoolSplit(t *testing.T) {
	bounty := int64(100000)
	got := buildRepoPayoutLedger(bounty, "valid", map[uint]RepoVerdictItem{
		1: {ValidatorUserID: 1, Verdict: "valid", Confidence: 5},
		2: {ValidatorUserID: 2, Verdict: "valid", Confidence: 5},
	})
	if got == nil {
		t.Fatal("expected non-nil")
	}
	if got.BasePool != 70000 {
		t.Errorf("BasePool = %d, want 70000", got.BasePool)
	}
	if got.QualityPool != 20000 {
		t.Errorf("QualityPool = %d, want 20000", got.QualityPool)
	}
	chainExpect := bounty - 70000 - 20000
	if got.ChainPool != chainExpect {
		t.Errorf("ChainPool = %d, want %d", got.ChainPool, chainExpect)
	}
}

func TestBuildRepoPayoutLedger_EntriesTotalEqualsBounty(t *testing.T) {
	bounty := int64(99999)
	latest := map[uint]RepoVerdictItem{
		1: {ValidatorUserID: 1, Verdict: "valid", Confidence: 8},
		2: {ValidatorUserID: 2, Verdict: "reject", Confidence: 3},
		3: {ValidatorUserID: 3, Verdict: "valid", Confidence: 5},
	}
	got := buildRepoPayoutLedger(bounty, "valid", latest)
	if got == nil {
		t.Fatal("expected non-nil")
	}
	var totalBase, totalQuality, totalChain int64
	for _, e := range got.Entries {
		totalBase += e.BaseAmount
		totalQuality += e.QualityAmount
		totalChain += e.ChainLocked
	}
	if totalBase != got.BasePool {
		t.Errorf("sum base = %d, want %d", totalBase, got.BasePool)
	}
	if totalQuality != got.QualityPool {
		t.Errorf("sum quality = %d, want %d", totalQuality, got.QualityPool)
	}
	if totalChain != got.ChainPool {
		t.Errorf("sum chain = %d, want %d", totalChain, got.ChainPool)
	}
}

func TestBuildConfidenceBreakdownByValidator(t *testing.T) {
	assignments := []RepoAssignmentItem{
		{ValidatorUserID: 1, Status: "active"},
		{ValidatorUserID: 2, Status: "active"},
	}
	votes := []RepoConfidenceVoteItem{
		{VoterUserID: 10, ValidatorUserID: 1, VotedAt: 100},
		{VoterUserID: 11, ValidatorUserID: 1, VotedAt: 101},
		{VoterUserID: 12, ValidatorUserID: 2, VotedAt: 102},
	}
	breakdown := buildConfidenceBreakdownByValidator(assignments, votes)
	if breakdown["validator_1"] != 2 {
		t.Errorf("validator_1 = %d, want 2", breakdown["validator_1"])
	}
	if breakdown["validator_2"] != 1 {
		t.Errorf("validator_2 = %d, want 1", breakdown["validator_2"])
	}
}

func TestBuildConfidenceBreakdownByValidator_Empty(t *testing.T) {
	breakdown := buildConfidenceBreakdownByValidator(nil, nil)
	if len(breakdown) != 0 {
		t.Errorf("expected empty breakdown, got %v", breakdown)
	}
}

func TestPlaceholder_RepoFinalize_FinalizeRepoCase(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_RepoFinalize_GetRepoConsensus(t *testing.T) {
	t.Skip("requires database connection")
}
