package services

import (
	"backend-gin/ent"
	"testing"
	"time"
)

func TestCurrentWorkflowCycle(t *testing.T) {
	tests := []struct {
		name string
		vc   *ent.ValidationCase
		want int
	}{
		{
			name: "nil case returns 1",
			vc:   nil,
			want: 1,
		},
		{
			name: "zero cycle returns 1",
			vc:   &ent.ValidationCase{},
			want: 1,
		},
		{
			name: "negative cycle returns 1",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.WorkflowCycle = -5
				return vc
			}(),
			want: 1,
		},
		{
			name: "cycle 1 returns 1",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.WorkflowCycle = 1
				return vc
			}(),
			want: 1,
		},
		{
			name: "cycle 3 returns 3",
			vc: func() *ent.ValidationCase {
				vc := &ent.ValidationCase{}
				vc.WorkflowCycle = 3
				return vc
			}(),
			want: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := currentWorkflowCycle(tt.vc)
			if got != tt.want {
				t.Errorf("currentWorkflowCycle() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestUnixPtr(t *testing.T) {
	t.Run("nil returns nil", func(t *testing.T) {
		got := unixPtr(nil)
		if got != nil {
			t.Errorf("unixPtr(nil) = %v, want nil", got)
		}
	})

	t.Run("valid time returns pointer", func(t *testing.T) {
		ts := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
		got := unixPtr(&ts)
		if got == nil {
			t.Fatal("unixPtr should not return nil for valid time")
		}
		want := ts.Unix()
		if *got != want {
			t.Errorf("unixPtr() = %d, want %d", *got, want)
		}
	})

	t.Run("zero time returns pointer", func(t *testing.T) {
		ts := time.Time{}
		got := unixPtr(&ts)
		if got == nil {
			t.Fatal("unixPtr should not return nil for zero time")
		}
		want := ts.Unix()
		if *got != want {
			t.Errorf("unixPtr() = %d, want %d", *got, want)
		}
	})
}

func TestValueOrEmpty(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name  string
		input *string
		want  string
	}{
		{name: "nil returns empty", input: nil, want: ""},
		{name: "empty string returns empty", input: strPtr(""), want: ""},
		{name: "non-empty string returns value", input: strPtr("hello"), want: "hello"},
		{name: "whitespace string returns whitespace", input: strPtr("  "), want: "  "},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := valueOrEmpty(tt.input)
			if got != tt.want {
				t.Errorf("valueOrEmpty() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestDueTimeFromNow(t *testing.T) {
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	got := dueTimeFromNow(now)
	want := now.Add(time.Duration(ownerResponseSLAHours) * time.Hour)

	if !got.Equal(want) {
		t.Errorf("dueTimeFromNow() = %v, want %v", got, want)
	}

	// Verify it uses the configured SLA hours constant.
	diff := got.Sub(now)
	expectedDiff := time.Duration(ownerResponseSLAHours) * time.Hour
	if diff != expectedDiff {
		t.Errorf("dueTimeFromNow() adds %v, want %v", diff, expectedDiff)
	}
}

func TestReminderScheduleHours(t *testing.T) {
	hours := reminderScheduleHours()
	if len(hours) != 2 {
		t.Fatalf("reminderScheduleHours() length = %d, want 2", len(hours))
	}
	if hours[0] != ownerReminderFirstHour {
		t.Errorf("first reminder = %d, want %d", hours[0], ownerReminderFirstHour)
	}
	if hours[1] != ownerReminderSecondHour {
		t.Errorf("second reminder = %d, want %d", hours[1], ownerReminderSecondHour)
	}
	// Reminders should be in ascending order.
	if hours[0] >= hours[1] {
		t.Errorf("reminder hours should be ascending: got %v", hours)
	}
	// Both should be less than SLA duration.
	for _, h := range hours {
		if h >= ownerResponseSLAHours {
			t.Errorf("reminder hour %d should be less than SLA hours %d", h, ownerResponseSLAHours)
		}
	}
}

func TestEnsureWorkflowV1Case(t *testing.T) {
	t.Run("nil case returns error", func(t *testing.T) {
		err := ensureWorkflowV1Case(nil)
		if err == nil {
			t.Error("ensureWorkflowV1Case(nil) should return error")
		}
	})

	t.Run("explicit v1 workflow_family passes", func(t *testing.T) {
		vc := &ent.ValidationCase{}
		vc.Meta = map[string]interface{}{
			"workflow_family": "v1",
		}
		err := ensureWorkflowV1Case(vc)
		if err != nil {
			t.Errorf("ensureWorkflowV1Case(v1 case) should pass, got: %v", err)
		}
	})

	t.Run("nil meta treated as workspace defaults to error", func(t *testing.T) {
		// defaultRepoMetaState() has WorkflowFamily = workspace,
		// so nil meta is treated as workspace case.
		vc := &ent.ValidationCase{}
		err := ensureWorkflowV1Case(vc)
		if err == nil {
			t.Error("ensureWorkflowV1Case(nil meta) should return error (defaults to workspace)")
		}
	})

	t.Run("empty meta treated as workspace defaults to error", func(t *testing.T) {
		vc := &ent.ValidationCase{}
		vc.Meta = map[string]interface{}{}
		err := ensureWorkflowV1Case(vc)
		if err == nil {
			t.Error("ensureWorkflowV1Case(empty meta) should return error (defaults to workspace)")
		}
	})

	t.Run("explicit workspace meta fails", func(t *testing.T) {
		vc := &ent.ValidationCase{}
		vc.Meta = map[string]interface{}{
			"workflow_family": "evidence_validation_workspace",
		}
		err := ensureWorkflowV1Case(vc)
		if err == nil {
			t.Error("ensureWorkflowV1Case(workspace case) should return error")
		}
	})
}

func TestClarificationStateConstants(t *testing.T) {
	states := []string{
		clarificationStateNone,
		clarificationStateWaitingOwnerResponse,
		clarificationStateAssumptionPending,
		clarificationStateOwnerResponded,
		clarificationStateAssumptionApproved,
		clarificationStateAssumptionRejected,
		clarificationStateOwnerInactiveSLAExpired,
	}
	seen := make(map[string]bool)
	for _, s := range states {
		if s == "" {
			t.Error("clarification state constant should not be empty")
		}
		if seen[s] {
			t.Errorf("duplicate clarification state: %q", s)
		}
		seen[s] = true
	}
}

func TestConsultationStatusConstants(t *testing.T) {
	statuses := []string{
		consultationStatusPending,
		consultationStatusApproved,
		consultationStatusRejected,
		consultationStatusWaitingOwnerResponse,
		consultationStatusOwnerTimeout,
	}
	seen := make(map[string]bool)
	for _, s := range statuses {
		if s == "" {
			t.Error("consultation status constant should not be empty")
		}
		if seen[s] {
			t.Errorf("duplicate consultation status: %q", s)
		}
		seen[s] = true
	}
}

func TestSLATimingConstants(t *testing.T) {
	if ownerResponseSLAHours <= 0 {
		t.Error("ownerResponseSLAHours should be positive")
	}
	if ownerReminderFirstHour <= 0 {
		t.Error("ownerReminderFirstHour should be positive")
	}
	if ownerReminderSecondHour <= ownerReminderFirstHour {
		t.Error("ownerReminderSecondHour should be greater than ownerReminderFirstHour")
	}
	if ownerReminderSecondHour >= ownerResponseSLAHours {
		t.Error("ownerReminderSecondHour should be less than ownerResponseSLAHours")
	}
}
