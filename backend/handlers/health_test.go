package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend-gin/buildinfo"

	"github.com/gin-gonic/gin"
)

func TestHealthVersionHandler_ReturnsRuntimeMetadata(t *testing.T) {
	t.Setenv("GIT_SHA", "")
	t.Setenv("SOURCE_VERSION", "")
	t.Setenv("BUILD_TIME_UTC", "2026-02-21T00:00:00Z")

	originalVersion := buildinfo.Version
	buildinfo.Version = "test-sha-123"
	t.Cleanup(func() {
		buildinfo.Version = originalVersion
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/health/version", HealthVersionHandler)

	req := httptest.NewRequest(http.MethodGet, "/health/version", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status code: got %d want %d", rec.Code, http.StatusOK)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if got := body["service"]; got != "backend-gin" {
		t.Fatalf("unexpected service: got %v want backend-gin", got)
	}
	if got := body["git_sha"]; got != "test-sha-123" {
		t.Fatalf("unexpected git_sha: got %v want test-sha-123", got)
	}
	if got := body["build_time_utc"]; got != "2026-02-21T00:00:00Z" {
		t.Fatalf("unexpected build_time_utc: got %v", got)
	}
	if got := body["status"]; got != "ok" {
		t.Fatalf("unexpected status: got %v want ok", got)
	}
}
