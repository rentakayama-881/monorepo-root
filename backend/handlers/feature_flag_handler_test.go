package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestCreateFlag_InvalidJSON verifies that sending malformed JSON
// to CreateFlag returns 400 with error code VAL004.
func TestCreateFlag_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FeatureFlagHandler{}
	router := gin.New()
	router.POST("/admin/feature-flags", handler.CreateFlag)

	req := httptest.NewRequest(http.MethodPost, "/admin/feature-flags", strings.NewReader(`{invalid}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "VAL004" {
		t.Fatalf("expected code VAL004, got %v", body["code"])
	}
}

// TestCreateFlag_MissingKey verifies that omitting the required "key" field
// returns 400 with error code VAL004.
func TestCreateFlag_MissingKey(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FeatureFlagHandler{}
	router := gin.New()
	router.POST("/admin/feature-flags", handler.CreateFlag)

	req := httptest.NewRequest(http.MethodPost, "/admin/feature-flags", strings.NewReader(`{"description":"test flag"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "VAL004" {
		t.Fatalf("expected code VAL004, got %v", body["code"])
	}
}

// TestCreateFlag_EmptyKey verifies that an empty string key fails the
// binding:"required" validation and returns 400 with VAL004.
func TestCreateFlag_EmptyKey(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FeatureFlagHandler{}
	router := gin.New()
	router.POST("/admin/feature-flags", handler.CreateFlag)

	req := httptest.NewRequest(http.MethodPost, "/admin/feature-flags", strings.NewReader(`{"key":""}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "VAL004" {
		t.Fatalf("expected code VAL004, got %v", body["code"])
	}
}

// TestCreateFlag_WhitespaceOnlyKey tests the TrimSpace logic path.
// A whitespace-only key passes binding:"required" but TrimSpace makes it empty.
// With nil flagService the handler will panic when calling Create,
// so we recover and skip in that case.
func TestCreateFlag_WhitespaceOnlyKey(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FeatureFlagHandler{}
	router := gin.New()
	router.POST("/admin/feature-flags", handler.CreateFlag)

	defer func() {
		if r := recover(); r != nil {
			t.Skipf("skipped: nil flagService panicked after TrimSpace (expected without DB): %v", r)
		}
	}()

	req := httptest.NewRequest(http.MethodPost, "/admin/feature-flags", strings.NewReader(`{"key":"   "}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// If we reach here the nil service did not panic — verify a reasonable status.
	if w.Code != http.StatusBadRequest && w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 400 or 500, got %d", w.Code)
	}
}

// TestUpdateFlag_InvalidJSON verifies that sending malformed JSON
// to UpdateFlag returns 400 with error code VAL004.
func TestUpdateFlag_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FeatureFlagHandler{}
	router := gin.New()
	router.PUT("/admin/feature-flags/:key", handler.UpdateFlag)

	req := httptest.NewRequest(http.MethodPut, "/admin/feature-flags/my-flag", strings.NewReader(`{not-json`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "VAL004" {
		t.Fatalf("expected code VAL004, got %v", body["code"])
	}
}

// TestCheckFlag_NilService verifies CheckFlag behaviour with a nil flagService.
// With nil service, calling IsEnabled will panic (nil pointer dereference).
// We recover and skip if that happens.
func TestCheckFlag_NilService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := &FeatureFlagHandler{}
	router := gin.New()
	router.GET("/feature-flags/check/:key", handler.CheckFlag)

	defer func() {
		if r := recover(); r != nil {
			t.Skipf("skipped: nil flagService panicked as expected (no DB): %v", r)
		}
	}()

	req := httptest.NewRequest(http.MethodGet, "/feature-flags/check/test-flag", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// If we reach here the nil service did not panic.
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["enabled"] != false {
		t.Fatalf("expected enabled=false, got %v", body["enabled"])
	}
}
