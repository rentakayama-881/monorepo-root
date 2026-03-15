package middleware

import (
	"testing"
)

func TestCorrelationIDConstants(t *testing.T) {
	if RequestIDHeader == "" {
		t.Error("RequestIDHeader should not be empty")
	}
	if RequestIDKey == "" {
		t.Error("RequestIDKey should not be empty")
	}
}
