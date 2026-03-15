package handlers

import (
	"testing"

	"backend-gin/services"
)

func TestExtractCredentialsFromBuyResponse(t *testing.T) {
	t.Run("nil payload", func(t *testing.T) {
		got := extractCredentialsFromBuyResponse(nil)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("non-map payload", func(t *testing.T) {
		got := extractCredentialsFromBuyResponse("string")
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("with login data", func(t *testing.T) {
		payload := map[string]interface{}{
			"item": map[string]interface{}{
				"loginData": map[string]interface{}{
					"login":    "user@example.com",
					"password": "secret123",
				},
			},
		}
		got := extractCredentialsFromBuyResponse(payload)
		if got == nil {
			t.Fatal("expected non-nil credentials")
		}
		if got["account_login"] != "user@example.com" {
			t.Errorf("account_login = %v, want 'user@example.com'", got["account_login"])
		}
		if got["account_password"] != "secret123" {
			t.Errorf("account_password = %v, want 'secret123'", got["account_password"])
		}
	})

	t.Run("no item key", func(t *testing.T) {
		payload := map[string]interface{}{"other": "data"}
		got := extractCredentialsFromBuyResponse(payload)
		if got != nil {
			t.Errorf("expected nil when no item key, got %v", got)
		}
	})
}

func TestExtractPurchasedItemSummary(t *testing.T) {
	t.Run("nil payload", func(t *testing.T) {
		got := extractPurchasedItemSummary(nil)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("with item data", func(t *testing.T) {
		payload := map[string]interface{}{
			"item": map[string]interface{}{
				"title_en":              "ChatGPT Plus Account",
				"item_state":            "active",
				"price":                 "100",
				"chatgpt_subscription":  "Plus",
				"seller_name":           "TestSeller",
			},
		}
		got := extractPurchasedItemSummary(payload)
		if got == nil {
			t.Fatal("expected non-nil summary")
		}
		if got["title"] != "ChatGPT Plus Account" {
			t.Errorf("title = %v, want 'ChatGPT Plus Account'", got["title"])
		}
		if got["seller"] != "TestSeller" {
			t.Errorf("seller = %v, want 'TestSeller'", got["seller"])
		}
	})
}

func TestExtractDeliveryPayload(t *testing.T) {
	resp := &services.LZTMarketResponse{
		JSON: map[string]interface{}{
			"item": map[string]interface{}{
				"loginData": map[string]interface{}{
					"login":    "test",
					"password": "pass",
				},
			},
		},
	}
	payload := extractDeliveryPayload(resp)
	if payload == nil {
		t.Fatal("expected non-nil payload")
	}
	if _, ok := payload["delivered_at"]; !ok {
		t.Error("expected delivered_at field")
	}
}

func TestCloneLZTMarketResponse_DeepClone(t *testing.T) {
	t.Run("nil", func(t *testing.T) {
		if got := cloneLZTMarketResponse(nil); got != nil {
			t.Error("expected nil")
		}
	})

	t.Run("with data", func(t *testing.T) {
		original := &services.LZTMarketResponse{
			StatusCode: 200,
			Headers:    map[string]string{"X-Test": "value"},
			JSON:       map[string]interface{}{"key": "val"},
			Raw:        "raw data",
		}
		cloned := cloneLZTMarketResponse(original)
		if cloned == nil {
			t.Fatal("expected non-nil clone")
		}
		if cloned.StatusCode != 200 {
			t.Errorf("StatusCode = %d, want 200", cloned.StatusCode)
		}
		if cloned.Raw != "raw data" {
			t.Errorf("Raw = %q, want 'raw data'", cloned.Raw)
		}
		// Modifying clone headers should not affect original
		cloned.Headers["X-New"] = "new"
		if _, ok := original.Headers["X-New"]; ok {
			t.Error("cloning headers should be independent")
		}
	})
}
