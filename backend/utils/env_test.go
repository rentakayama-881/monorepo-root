package utils

import (
	"os"
	"testing"
)

func TestGetEnv_WithValue(t *testing.T) {
	os.Setenv("TEST_ENV_KEY_UTILS", "hello")
	defer os.Unsetenv("TEST_ENV_KEY_UTILS")

	got := GetEnv("TEST_ENV_KEY_UTILS", "default")
	if got != "hello" {
		t.Errorf("GetEnv = %q, want 'hello'", got)
	}
}

func TestGetEnv_WithDefault(t *testing.T) {
	os.Unsetenv("TEST_ENV_KEY_MISSING")

	got := GetEnv("TEST_ENV_KEY_MISSING", "fallback")
	if got != "fallback" {
		t.Errorf("GetEnv = %q, want 'fallback'", got)
	}
}

func TestGetEnv_EmptyValueUsesDefault(t *testing.T) {
	os.Setenv("TEST_ENV_KEY_EMPTY", "")
	defer os.Unsetenv("TEST_ENV_KEY_EMPTY")

	got := GetEnv("TEST_ENV_KEY_EMPTY", "default_val")
	if got != "default_val" {
		t.Errorf("GetEnv = %q, want 'default_val'", got)
	}
}
