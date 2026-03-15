package utils

import (
	"os"
	"testing"
)

func TestEmailQueue_ResendAPIKeyEmpty(t *testing.T) {
	// When RESEND_API_KEY is empty, dev mode should succeed without error
	os.Unsetenv("RESEND_API_KEY")
	err := SendVerificationEmail("test@example.com", "fake-token")
	if err != nil {
		t.Errorf("Expected no error in dev mode, got: %v", err)
	}
}
