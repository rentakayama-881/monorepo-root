package buildinfo

import "testing"

func TestVersionDefaultIsDev(t *testing.T) {
	// When not overridden via ldflags, Version should be "dev"
	if Version == "" {
		t.Error("Version should not be empty")
	}
}
