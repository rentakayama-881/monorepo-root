package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCreateBadge_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.POST("/admin/badges", CreateBadge)

	req := httptest.NewRequest(http.MethodPost, "/admin/badges", strings.NewReader(`{invalid}`))
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
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected error object, got %v", body["error"])
	}
	if errObj["code"] != "VAL001" {
		t.Fatalf("expected code VAL001, got %v", errObj["code"])
	}
}

func TestCreateBadge_MissingRequiredFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.POST("/admin/badges", CreateBadge)

	req := httptest.NewRequest(http.MethodPost, "/admin/badges", strings.NewReader(`{"description":"test"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestGetBadge_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/admin/badges/:id", GetBadge)

	req := httptest.NewRequest(http.MethodGet, "/admin/badges/abc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected error object, got %v", body["error"])
	}
	if errObj["code"] != "VAL001" {
		t.Fatalf("expected code VAL001, got %v", errObj["code"])
	}
}

func TestUpdateBadge_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.PUT("/admin/badges/:id", UpdateBadge)

	req := httptest.NewRequest(http.MethodPut, "/admin/badges/notanumber", strings.NewReader(`{"name":"x","slug":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestDeleteBadge_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.DELETE("/admin/badges/:id", DeleteBadge)

	req := httptest.NewRequest(http.MethodDelete, "/admin/badges/xyz", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
