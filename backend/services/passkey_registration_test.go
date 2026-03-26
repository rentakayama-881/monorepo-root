package services

import (
	"testing"
)

func TestOriginAndHostFromCreation_Nil(t *testing.T) {
	origin, host := originAndHostFromCreation(nil)
	if origin != "" {
		t.Errorf("origin = %q, want empty", origin)
	}
	if host != "" {
		t.Errorf("host = %q, want empty", host)
	}
}

func TestPlaceholder_PasskeyRegistration_BeginRegistration(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_PasskeyRegistration_FinishRegistration(t *testing.T) {
	t.Skip("requires database connection")
}
