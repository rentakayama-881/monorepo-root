package services

import (
	"backend-gin/logger"
	"testing"
	"time"
)

func init() {
	logger.InitLogger()
}

func TestNewCircuitBreaker_Defaults(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{Name: "test"})
	if cb.name != "test" {
		t.Errorf("name = %q, want 'test'", cb.name)
	}
	if cb.maxFailures != 5 {
		t.Errorf("maxFailures = %d, want 5", cb.maxFailures)
	}
	if cb.resetTimeout != 30*time.Second {
		t.Errorf("resetTimeout = %v, want 30s", cb.resetTimeout)
	}
	if cb.halfOpenMax != 1 {
		t.Errorf("halfOpenMax = %d, want 1", cb.halfOpenMax)
	}
	if cb.State() != CircuitClosed {
		t.Errorf("initial state = %d, want CircuitClosed", cb.State())
	}
}

func TestNewCircuitBreaker_CustomConfig(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Name:         "custom",
		MaxFailures:  3,
		ResetTimeout: 10 * time.Second,
		HalfOpenMax:  2,
	})
	if cb.maxFailures != 3 {
		t.Errorf("maxFailures = %d, want 3", cb.maxFailures)
	}
	if cb.resetTimeout != 10*time.Second {
		t.Errorf("resetTimeout = %v, want 10s", cb.resetTimeout)
	}
	if cb.halfOpenMax != 2 {
		t.Errorf("halfOpenMax = %d, want 2", cb.halfOpenMax)
	}
}

func TestCircuitBreaker_AllowWhenClosed(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{Name: "test", MaxFailures: 3})
	if err := cb.Allow(); err != nil {
		t.Errorf("Allow() should succeed when closed, got: %v", err)
	}
}

func TestCircuitBreaker_OpensAfterMaxFailures(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Name:         "test",
		MaxFailures:  3,
		ResetTimeout: 1 * time.Hour, // long timeout so it doesn't auto-recover
	})

	for i := 0; i < 3; i++ {
		cb.RecordFailure()
	}

	if cb.State() != CircuitOpen {
		t.Errorf("state = %d, want CircuitOpen after %d failures", cb.State(), 3)
	}

	err := cb.Allow()
	if err == nil {
		t.Error("Allow() should fail when circuit is open")
	}
	if _, ok := err.(*ErrCircuitOpen); !ok {
		t.Errorf("error should be *ErrCircuitOpen, got %T", err)
	}
}

func TestCircuitBreaker_RecordSuccess_ResetsClosed(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{Name: "test", MaxFailures: 5})
	cb.RecordFailure()
	cb.RecordFailure()
	cb.RecordSuccess()
	if cb.failures != 0 {
		t.Errorf("failures = %d, want 0 after success", cb.failures)
	}
}

func TestCircuitBreaker_HalfOpenRecovery(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Name:         "test",
		MaxFailures:  2,
		ResetTimeout: 1 * time.Millisecond,
		HalfOpenMax:  1,
	})

	// Trip the circuit
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.State() != CircuitOpen {
		t.Fatal("expected CircuitOpen")
	}

	// Wait for reset timeout
	time.Sleep(5 * time.Millisecond)

	// Should transition to half-open
	if err := cb.Allow(); err != nil {
		t.Errorf("Allow() should succeed after timeout (half-open): %v", err)
	}
	if cb.State() != CircuitHalfOpen {
		t.Errorf("state = %d, want CircuitHalfOpen", cb.State())
	}

	// Success should close it
	cb.RecordSuccess()
	if cb.State() != CircuitClosed {
		t.Errorf("state = %d, want CircuitClosed after success in half-open", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenFailure_ReOpens(t *testing.T) {
	cb := NewCircuitBreaker(CircuitBreakerConfig{
		Name:         "test",
		MaxFailures:  2,
		ResetTimeout: 1 * time.Millisecond,
		HalfOpenMax:  1,
	})

	// Trip the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	// Wait for reset timeout
	time.Sleep(5 * time.Millisecond)

	// Transition to half-open
	cb.Allow()

	// Failure in half-open should re-open
	cb.RecordFailure()
	if cb.State() != CircuitOpen {
		t.Errorf("state = %d, want CircuitOpen after failure in half-open", cb.State())
	}
}

func TestErrCircuitOpen_Error(t *testing.T) {
	err := &ErrCircuitOpen{Name: "my-service"}
	want := "circuit breaker open: my-service is unavailable"
	if got := err.Error(); got != want {
		t.Errorf("Error() = %q, want %q", got, want)
	}
}
