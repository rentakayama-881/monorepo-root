package services

import (
	"testing"
)

func TestCoerceContentToMap(t *testing.T) {
	t.Run("nil", func(t *testing.T) {
		got := coerceContentToMap(nil)
		if got == nil || len(got) != 0 {
			t.Errorf("expected empty map, got %v", got)
		}
	})

	t.Run("map input", func(t *testing.T) {
		input := map[string]interface{}{"key": "value"}
		got := coerceContentToMap(input)
		if got["key"] != "value" {
			t.Errorf("expected key=value, got %v", got["key"])
		}
	})

	t.Run("string input", func(t *testing.T) {
		got := coerceContentToMap("hello world")
		if got["text"] != "hello world" {
			t.Errorf("expected text='hello world', got %v", got)
		}
	})
}

func TestSanitizeCaseMeta(t *testing.T) {
	t.Run("nil", func(t *testing.T) {
		got := sanitizeCaseMeta(nil)
		if got == nil || len(got) != 0 {
			t.Error("expected empty map for nil input")
		}
	})

	t.Run("removes telegram key", func(t *testing.T) {
		input := map[string]interface{}{
			"telegram": "@user",
			"title":    "Test",
		}
		got := sanitizeCaseMeta(input)
		if _, ok := got["telegram"]; ok {
			t.Error("telegram key should be removed")
		}
		if got["title"] != "Test" {
			t.Errorf("title = %v, want 'Test'", got["title"])
		}
	})

	t.Run("case insensitive telegram", func(t *testing.T) {
		input := map[string]interface{}{
			"Telegram": "@user",
			"data":     "ok",
		}
		got := sanitizeCaseMeta(input)
		if _, ok := got["Telegram"]; ok {
			t.Error("Telegram key should be removed (case insensitive)")
		}
	})
}

func TestBuildTagResponsesFromEnt(t *testing.T) {
	t.Run("nil input", func(t *testing.T) {
		got := buildTagResponsesFromEnt(nil)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})
}

func TestBadgeType(t *testing.T) {
	// Verify Badge struct can be instantiated
	b := Badge{
		ID:          1,
		Name:        "Test Badge",
		Slug:        "test-badge",
		Description: "A test badge",
		IconType:    "emoji",
		Color:       "#ff0000",
	}
	if b.Name != "Test Badge" {
		t.Errorf("Badge.Name = %q, want 'Test Badge'", b.Name)
	}
}
