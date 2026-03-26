package services

import (
	"testing"
)

func TestLatestVerdictsByValidator(t *testing.T) {
	assignments := []RepoAssignmentItem{
		{ValidatorUserID: 1, Status: "active"},
		{ValidatorUserID: 2, Status: "active"},
		{ValidatorUserID: 3, Status: "removed"},
	}
	verdicts := []RepoVerdictItem{
		{ValidatorUserID: 1, Verdict: "valid", SubmittedAt: 100},
		{ValidatorUserID: 1, Verdict: "needs_revision", SubmittedAt: 200},
		{ValidatorUserID: 2, Verdict: "reject", SubmittedAt: 150},
		{ValidatorUserID: 3, Verdict: "valid", SubmittedAt: 300},
	}

	got := latestVerdictsByValidator(verdicts, assignments)

	if len(got) != 2 {
		t.Fatalf("got %d entries, want 2 (removed validator 3 excluded)", len(got))
	}

	if v, ok := got[1]; !ok {
		t.Error("missing validator 1")
	} else if v.SubmittedAt != 200 {
		t.Errorf("validator 1 SubmittedAt = %d, want 200 (latest)", v.SubmittedAt)
	}

	if v, ok := got[2]; !ok {
		t.Error("missing validator 2")
	} else if v.Verdict != "reject" {
		t.Errorf("validator 2 verdict = %q, want reject", v.Verdict)
	}

	if _, ok := got[3]; ok {
		t.Error("validator 3 should be excluded (status removed)")
	}
}

func TestLatestVerdictsByValidator_Empty(t *testing.T) {
	got := latestVerdictsByValidator(nil, nil)
	if len(got) != 0 {
		t.Errorf("expected empty map, got %v", got)
	}
}

func TestRequiredVotesByMode(t *testing.T) {
	// normalizeRepoCompletionMode always returns "open", so all inputs yield 3.
	tests := []struct {
		mode string
		want int
	}{
		{"panel_10", 3},
		{"panel_3", 3},
		{"open", 3},
		{"", 3},
		{"unknown", 3},
	}
	for _, tt := range tests {
		t.Run(tt.mode, func(t *testing.T) {
			got := requiredVotesByMode(tt.mode)
			if got != tt.want {
				t.Errorf("requiredVotesByMode(%q) = %d, want %d", tt.mode, got, tt.want)
			}
		})
	}
}

func TestConsensusBreakdown(t *testing.T) {
	latest := map[uint]RepoVerdictItem{
		1: {Verdict: "valid"},
		2: {Verdict: "valid"},
		3: {Verdict: "reject"},
		4: {Verdict: "needs_revision"},
	}
	breakdown := consensusBreakdown(latest)

	if breakdown["valid"] != 2 {
		t.Errorf("valid = %d, want 2", breakdown["valid"])
	}
	if breakdown["reject"] != 1 {
		t.Errorf("reject = %d, want 1", breakdown["reject"])
	}
	if breakdown["needs_revision"] != 1 {
		t.Errorf("needs_revision = %d, want 1", breakdown["needs_revision"])
	}
}

func TestConsensusBreakdown_Empty(t *testing.T) {
	breakdown := consensusBreakdown(map[uint]RepoVerdictItem{})
	for _, key := range []string{"valid", "needs_revision", "reject"} {
		if breakdown[key] != 0 {
			t.Errorf("%s = %d, want 0", key, breakdown[key])
		}
	}
}

func TestConsensusBreakdown_UnknownVerdictIgnored(t *testing.T) {
	latest := map[uint]RepoVerdictItem{
		1: {Verdict: "unknown_verdict"},
	}
	breakdown := consensusBreakdown(latest)
	total := breakdown["valid"] + breakdown["needs_revision"] + breakdown["reject"]
	if total != 0 {
		t.Errorf("unknown verdict should not count, total = %d", total)
	}
}

func TestConsensusWinner(t *testing.T) {
	tests := []struct {
		name       string
		breakdown  map[string]int
		wantWinner string
		wantMax    int
		wantSecond int
	}{
		{
			"clear winner",
			map[string]int{"valid": 3, "needs_revision": 1, "reject": 0},
			"valid", 3, 1,
		},
		{
			"all zeros",
			map[string]int{"valid": 0, "needs_revision": 0, "reject": 0},
			"valid", 0, 0,
		},
		{
			"reject wins",
			map[string]int{"valid": 1, "needs_revision": 0, "reject": 2},
			"reject", 2, 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			winner, maxCount, second := consensusWinner(tt.breakdown)
			if winner != tt.wantWinner {
				t.Errorf("winner = %q, want %q", winner, tt.wantWinner)
			}
			if maxCount != tt.wantMax {
				t.Errorf("maxCount = %d, want %d", maxCount, tt.wantMax)
			}
			if second != tt.wantSecond {
				t.Errorf("second = %d, want %d", second, tt.wantSecond)
			}
		})
	}
}

func TestSplitAmountEvenly(t *testing.T) {
	tests := []struct {
		name      string
		total     int64
		winnerIDs []uint
		wantSum   int64
	}{
		{"even split", 100, []uint{1, 2}, 100},
		{"remainder", 100, []uint{1, 2, 3}, 100},
		{"single winner", 99, []uint{1}, 99},
		{"zero total", 0, []uint{1, 2}, 0},
		{"no winners", 100, []uint{}, 0},
		{"negative total", -100, []uint{1, 2}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := splitAmountEvenly(tt.total, tt.winnerIDs)
			sum := int64(0)
			for _, v := range got {
				sum += v
			}
			if sum != tt.wantSum {
				t.Errorf("sum = %d, want %d", sum, tt.wantSum)
			}
		})
	}
}

func TestSplitAmountEvenly_RemainderDistribution(t *testing.T) {
	got := splitAmountEvenly(10, []uint{1, 2, 3})
	// 10 / 3 = 3 remainder 1 → first winner gets +1
	if got[1] != 4 {
		t.Errorf("winner 1 = %d, want 4", got[1])
	}
	if got[2] != 3 {
		t.Errorf("winner 2 = %d, want 3", got[2])
	}
	if got[3] != 3 {
		t.Errorf("winner 3 = %d, want 3", got[3])
	}
}

func TestSortedKeysUint(t *testing.T) {
	m := map[uint]int{30: 1, 10: 2, 20: 3}
	got := sortedKeysUint(m)
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	if got[0] != 10 || got[1] != 20 || got[2] != 30 {
		t.Errorf("got %v, want [10, 20, 30]", got)
	}
}

func TestSortedKeysUint_Empty(t *testing.T) {
	got := sortedKeysUint(map[uint]int{})
	if len(got) != 0 {
		t.Errorf("len = %d, want 0", len(got))
	}
}

func TestPlaceholder_RepoVerdict_SubmitRepoVerdict(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_RepoVerdict_VoteRepoValidatorConfidence(t *testing.T) {
	t.Skip("requires database connection")
}
