package handlers

import (
	"testing"
)

func TestNormalizeItemID(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  string
	}{
		{"from item_id", map[string]interface{}{"item_id": "12345"}, "12345"},
		{"from id", map[string]interface{}{"id": 42}, "42"},
		{"from float64 id", map[string]interface{}{"id": float64(99)}, "99"},
		{"from account_id", map[string]interface{}{"account_id": "777"}, "777"},
		{"prefers chatgpt_item_id", map[string]interface{}{"chatgpt_item_id": "1", "item_id": "2"}, "1"},
		{"empty map", map[string]interface{}{}, ""},
		{"nil values", map[string]interface{}{"item_id": nil}, ""},
		{"zero int", map[string]interface{}{"id": 0}, ""},
		{"negative int", map[string]interface{}{"id": -1}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeItemID(tt.input)
			if got != tt.want {
				t.Errorf("normalizeItemID() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeProviderIDValue(t *testing.T) {
	tests := []struct {
		name  string
		input interface{}
		want  string
	}{
		{"nil", nil, ""},
		{"string int", "12345", "12345"},
		{"string float", "12345.0", "12345"},
		{"empty string", "", ""},
		{"whitespace string", "  ", ""},
		{"float64 int", float64(42), "42"},
		{"float64 zero", float64(0), ""},
		{"float64 negative", float64(-5), ""},
		{"int positive", 99, "99"},
		{"int zero", 0, ""},
		{"int negative", -1, ""},
		{"uint positive", uint(10), "10"},
		{"uint zero", uint(0), ""},
		{"int64", int64(100), "100"},
		{"non-numeric string", "abc123", "abc123"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeProviderIDValue(tt.input)
			if got != tt.want {
				t.Errorf("normalizeProviderIDValue(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestContainsCyrillic(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"hello world", false},
		{"Привет", true},
		{"mix Привет mix", true},
		{"", false},
		{"12345", false},
		{"日本語", false}, // Japanese, not Cyrillic
	}
	for _, tt := range tests {
		got := containsCyrillic(tt.input)
		if got != tt.want {
			t.Errorf("containsCyrillic(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeItemTitle(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  string
	}{
		{"from title_en", map[string]interface{}{"title_en": "English Title"}, "English Title"},
		{"from title", map[string]interface{}{"title": "My Title"}, "My Title"},
		{"skips cyrillic title", map[string]interface{}{"title": "Привет", "name_en": "English Name"}, "English Name"},
		{"chatgpt subscription fallback", map[string]interface{}{"chatgpt_subscription": "Plus"}, "Plus Account"},
		{"empty fallback", map[string]interface{}{}, "ChatGPT Account"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeItemTitle(tt.input)
			if got != tt.want {
				t.Errorf("normalizeItemTitle() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeItemState(t *testing.T) {
	tests := []struct {
		input map[string]interface{}
		want  string
	}{
		{map[string]interface{}{"item_state": "active"}, "active"},
		{map[string]interface{}{"status": "sold"}, "sold"},
		{map[string]interface{}{}, "-"},
	}
	for _, tt := range tests {
		got := normalizeItemState(tt.input)
		if got != tt.want {
			t.Errorf("normalizeItemState(%v) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeSeller(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  string
	}{
		{"string seller", map[string]interface{}{"seller_name": "John"}, "John"},
		{"nested seller", map[string]interface{}{"seller": map[string]interface{}{"username": "jane"}}, "jane"},
		{"fallback to owner", map[string]interface{}{"owner": "Bob"}, "Bob"},
		{"empty", map[string]interface{}{}, "-"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeSeller(tt.input)
			if got != tt.want {
				t.Errorf("normalizeSeller() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractCanBuyItem(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  bool
	}{
		{"no key defaults true", map[string]interface{}{}, true},
		{"nil defaults true", map[string]interface{}{"canBuyItem": nil}, true},
		{"bool true", map[string]interface{}{"canBuyItem": true}, true},
		{"bool false", map[string]interface{}{"canBuyItem": false}, false},
		{"string true", map[string]interface{}{"canBuyItem": "true"}, true},
		{"string false", map[string]interface{}{"canBuyItem": "false"}, false},
		{"float positive", map[string]interface{}{"canBuyItem": float64(1)}, true},
		{"float zero", map[string]interface{}{"canBuyItem": float64(0)}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractCanBuyItem(tt.input)
			if got != tt.want {
				t.Errorf("extractCanBuyItem() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractCannotBuyItemError(t *testing.T) {
	tests := []struct {
		name  string
		input map[string]interface{}
		want  string
	}{
		{"empty", map[string]interface{}{}, ""},
		{"nil map", nil, ""},
		{"from cannotBuyItemError", map[string]interface{}{"cannotBuyItemError": "sold out"}, "sold out"},
		{"from message", map[string]interface{}{"message": "error msg"}, "error msg"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractCannotBuyItemError(tt.input)
			if got != tt.want {
				t.Errorf("extractCannotBuyItemError() = %q, want %q", got, tt.want)
			}
		})
	}
}
