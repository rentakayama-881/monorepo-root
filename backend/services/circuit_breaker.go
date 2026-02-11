package services

import (
	"sync"
	"time"

	"backend-gin/logger"

	"go.uber.org/zap"
)

// CircuitState represents the current state of the circuit breaker
type CircuitState int

const (
	CircuitClosed   CircuitState = iota // Normal operation
	CircuitOpen                         // Failing, reject requests
	CircuitHalfOpen                     // Testing if service recovered
)

// CircuitBreaker implements the circuit breaker pattern for inter-service communication.
type CircuitBreaker struct {
	name           string
	maxFailures    int
	resetTimeout   time.Duration
	halfOpenMax    int
	mu             sync.Mutex
	state          CircuitState
	failures       int
	lastFailure    time.Time
	halfOpenCount  int
}

// CircuitBreakerConfig holds configuration for a circuit breaker.
type CircuitBreakerConfig struct {
	Name         string
	MaxFailures  int           // Failures before opening circuit
	ResetTimeout time.Duration // Time before trying half-open
	HalfOpenMax  int           // Max requests to allow in half-open state
}

// NewCircuitBreaker creates a new circuit breaker with the given config.
func NewCircuitBreaker(cfg CircuitBreakerConfig) *CircuitBreaker {
	if cfg.MaxFailures <= 0 {
		cfg.MaxFailures = 5
	}
	if cfg.ResetTimeout <= 0 {
		cfg.ResetTimeout = 30 * time.Second
	}
	if cfg.HalfOpenMax <= 0 {
		cfg.HalfOpenMax = 1
	}
	return &CircuitBreaker{
		name:         cfg.Name,
		maxFailures:  cfg.MaxFailures,
		resetTimeout: cfg.ResetTimeout,
		halfOpenMax:  cfg.HalfOpenMax,
		state:        CircuitClosed,
	}
}

// ErrCircuitOpen is returned when the circuit breaker is open.
type ErrCircuitOpen struct {
	Name string
}

func (e *ErrCircuitOpen) Error() string {
	return "circuit breaker open: " + e.Name + " is unavailable"
}

// Allow checks if a request should be allowed through.
func (cb *CircuitBreaker) Allow() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return nil
	case CircuitOpen:
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = CircuitHalfOpen
			cb.halfOpenCount = 0
			logger.Info("Circuit breaker transitioning to half-open",
				zap.String("breaker", cb.name))
			return nil
		}
		return &ErrCircuitOpen{Name: cb.name}
	case CircuitHalfOpen:
		if cb.halfOpenCount >= cb.halfOpenMax {
			return &ErrCircuitOpen{Name: cb.name}
		}
		cb.halfOpenCount++
		return nil
	}
	return nil
}

// RecordSuccess records a successful request.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == CircuitHalfOpen {
		cb.state = CircuitClosed
		cb.failures = 0
		logger.Info("Circuit breaker closed (service recovered)",
			zap.String("breaker", cb.name))
	}
	cb.failures = 0
}

// RecordFailure records a failed request.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailure = time.Now()

	if cb.state == CircuitHalfOpen {
		cb.state = CircuitOpen
		logger.Warn("Circuit breaker re-opened (half-open test failed)",
			zap.String("breaker", cb.name))
		return
	}

	if cb.failures >= cb.maxFailures {
		cb.state = CircuitOpen
		logger.Warn("Circuit breaker opened",
			zap.String("breaker", cb.name),
			zap.Int("failures", cb.failures))
	}
}

// State returns the current state.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

// Global circuit breakers for inter-service communication
var (
	featureServiceBreaker *CircuitBreaker
	featureBreakerOnce    sync.Once
)

// GetFeatureServiceBreaker returns the circuit breaker for Feature Service calls.
func GetFeatureServiceBreaker() *CircuitBreaker {
	featureBreakerOnce.Do(func() {
		featureServiceBreaker = NewCircuitBreaker(CircuitBreakerConfig{
			Name:         "feature-service",
			MaxFailures:  5,
			ResetTimeout: 30 * time.Second,
			HalfOpenMax:  1,
		})
	})
	return featureServiceBreaker
}
