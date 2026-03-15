package utils

import (
	"encoding/json"
	"testing"
)

func TestFlattenJSONText_EmptyInput(t *testing.T) {
	if got := FlattenJSONText(nil); got != "" {
		t.Errorf("nil input: got %q, want empty", got)
	}
	if got := FlattenJSONText([]byte{}); got != "" {
		t.Errorf("empty input: got %q, want empty", got)
	}
}

func TestFlattenJSONText_SimpleString(t *testing.T) {
	raw, _ := json.Marshal("hello world")
	got := FlattenJSONText(raw)
	if got != "hello world" {
		t.Errorf("got %q, want 'hello world'", got)
	}
}

func TestFlattenJSONText_StringArray(t *testing.T) {
	raw, _ := json.Marshal([]string{"alpha", "beta", "gamma"})
	got := FlattenJSONText(raw)
	if got != "alpha beta gamma" {
		t.Errorf("got %q, want 'alpha beta gamma'", got)
	}
}

func TestFlattenJSONText_NestedObject(t *testing.T) {
	data := map[string]interface{}{
		"title":   "Test Title",
		"content": "Test Content",
	}
	raw, _ := json.Marshal(data)
	got := FlattenJSONText(raw)
	// All string values should be present (order may vary)
	if got == "" {
		t.Error("expected non-empty result for nested object")
	}
	// Check both values are present
	if !containsAll(got, "Test Title", "Test Content") {
		t.Errorf("got %q, expected it to contain 'Test Title' and 'Test Content'", got)
	}
}

func TestFlattenJSONText_InvalidJSON(t *testing.T) {
	raw := []byte("this is not json")
	got := FlattenJSONText(raw)
	if got != "this is not json" {
		t.Errorf("invalid JSON: got %q, want 'this is not json'", got)
	}
}

func TestFlattenJSONText_NumbersSkipped(t *testing.T) {
	data := map[string]interface{}{
		"name":  "alice",
		"count": 42,
		"flag":  true,
	}
	raw, _ := json.Marshal(data)
	got := FlattenJSONText(raw)
	// Numbers and booleans should be skipped, only "alice" should appear
	if got != "alice" {
		t.Errorf("got %q, want 'alice'", got)
	}
}

func TestFlattenJSONText_DeeplyNested(t *testing.T) {
	data := map[string]interface{}{
		"level1": map[string]interface{}{
			"level2": map[string]interface{}{
				"deep": "deep value",
			},
		},
	}
	raw, _ := json.Marshal(data)
	got := FlattenJSONText(raw)
	if got != "deep value" {
		t.Errorf("got %q, want 'deep value'", got)
	}
}

func containsAll(s string, substrs ...string) bool {
	for _, sub := range substrs {
		found := false
		for i := 0; i <= len(s)-len(sub); i++ {
			if s[i:i+len(sub)] == sub {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
