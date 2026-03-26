package services

import (
	"os"
	"testing"
	"time"
)

func TestOwnerResponseSLAInterval_Default(t *testing.T) {
	os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")
	got := ownerResponseSLAInterval()
	if got != time.Minute {
		t.Errorf("default interval = %v, want %v", got, time.Minute)
	}
}

func TestOwnerResponseSLAInterval_CustomValid(t *testing.T) {
	os.Setenv("OWNER_RESPONSE_SLA_TICK_SECONDS", "30")
	defer os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")

	got := ownerResponseSLAInterval()
	if got != 30*time.Second {
		t.Errorf("interval = %v, want 30s", got)
	}
}

func TestOwnerResponseSLAInterval_TooSmallClampedTo15(t *testing.T) {
	os.Setenv("OWNER_RESPONSE_SLA_TICK_SECONDS", "5")
	defer os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")

	got := ownerResponseSLAInterval()
	if got != 15*time.Second {
		t.Errorf("interval = %v, want 15s (clamped)", got)
	}
}

func TestOwnerResponseSLAInterval_ZeroFallback(t *testing.T) {
	os.Setenv("OWNER_RESPONSE_SLA_TICK_SECONDS", "0")
	defer os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")

	got := ownerResponseSLAInterval()
	if got != time.Minute {
		t.Errorf("interval = %v, want fallback %v", got, time.Minute)
	}
}

func TestOwnerResponseSLAInterval_NegativeFallback(t *testing.T) {
	os.Setenv("OWNER_RESPONSE_SLA_TICK_SECONDS", "-10")
	defer os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")

	got := ownerResponseSLAInterval()
	if got != time.Minute {
		t.Errorf("interval = %v, want fallback %v", got, time.Minute)
	}
}

func TestOwnerResponseSLAInterval_InvalidStringFallback(t *testing.T) {
	os.Setenv("OWNER_RESPONSE_SLA_TICK_SECONDS", "abc")
	defer os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")

	got := ownerResponseSLAInterval()
	if got != time.Minute {
		t.Errorf("interval = %v, want fallback %v", got, time.Minute)
	}
}

func TestOwnerResponseSLAInterval_Exactly15(t *testing.T) {
	os.Setenv("OWNER_RESPONSE_SLA_TICK_SECONDS", "15")
	defer os.Unsetenv("OWNER_RESPONSE_SLA_TICK_SECONDS")

	got := ownerResponseSLAInterval()
	if got != 15*time.Second {
		t.Errorf("interval = %v, want 15s", got)
	}
}

func TestOwnerResponseSLAWorker_Stop_NilSafe(t *testing.T) {
	var w *OwnerResponseSLAWorker
	// Should not panic
	w.Stop()
}

func TestOwnerResponseSLAWorker_Stop_NotStarted(t *testing.T) {
	w := &OwnerResponseSLAWorker{
		stopCh: make(chan struct{}),
		doneCh: make(chan struct{}),
	}
	// Should not panic when not started
	w.Stop()
}

func TestOwnerResponseSLAWorker_Start_NilSafe(t *testing.T) {
	var w *OwnerResponseSLAWorker
	// Should not panic
	w.Start()
}

func TestNewOwnerResponseSLAWorker_NilWorkflow(t *testing.T) {
	w := NewOwnerResponseSLAWorker(nil)
	if w == nil {
		t.Fatal("expected non-nil worker")
	}
	if w.instanceID == "" {
		t.Error("expected non-empty instanceID")
	}
	// Start with nil workflow should be a no-op
	w.Start()
	if w.started {
		t.Error("should not start with nil workflow")
	}
}

func TestPlaceholder_SLAWorker_RunIteration(t *testing.T) {
	t.Skip("requires database connection and distributed lock")
}
