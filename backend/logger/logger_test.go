package logger

import (
"testing"
)

func TestInitLogger(t *testing.T) {
// InitLogger should not panic
InitLogger()
if Log == nil {
t.Error("Log should not be nil after InitLogger")
}
}

func TestLogFunctions_NoPanic(t *testing.T) {
InitLogger()

// These should not panic
Info("test info message")
Debug("test debug message")
Warn("test warn message")
// Skip Error since it adds stack trace to test output
}
