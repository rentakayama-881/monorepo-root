package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend-gin/ent"

	"github.com/gin-gonic/gin"
)

func TestGetMyAccountHandler_NoUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/account/me", nil)

	GetMyAccountHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["error"] != "Unauthorized" {
		t.Fatalf("expected Unauthorized error, got %v", body["error"])
	}
}

func TestGetMyAccountHandler_InvalidUserType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/account/me", nil)
	c.Set("user", "not-a-user-object")

	GetMyAccountHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestGetMyAccountHandler_NilUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/account/me", nil)
	c.Set("user", (*ent.User)(nil))

	GetMyAccountHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestUpdateMyAccountHandler_NoUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/account", nil)

	UpdateMyAccountHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestNormalizeSocialAccounts_Nil(t *testing.T) {
	result := normalizeSocialAccounts(nil)
	if result != nil {
		t.Fatalf("expected nil, got %v", result)
	}
}

func TestNormalizeSocialAccounts_Empty(t *testing.T) {
	result := normalizeSocialAccounts(map[string]interface{}{})
	if result != nil {
		t.Fatalf("expected nil, got %v", result)
	}
}

func TestNormalizeSocialAccounts_WithItems(t *testing.T) {
	input := map[string]interface{}{
		"items": []map[string]string{{"label": "github", "url": "https://github.com"}},
	}
	result := normalizeSocialAccounts(input)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestNormalizeSocialAccounts_LegacyMap(t *testing.T) {
	input := map[string]interface{}{
		"github": "https://github.com/user",
	}
	result := normalizeSocialAccounts(input)
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	items, ok := result.([]map[string]interface{})
	if !ok {
		t.Fatalf("expected slice of maps, got %T", result)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0]["label"] != "github" {
		t.Fatalf("expected label=github, got %v", items[0]["label"])
	}
	if items[0]["url"] != "https://github.com/user" {
		t.Fatalf("expected url=https://github.com/user, got %v", items[0]["url"])
	}
}
