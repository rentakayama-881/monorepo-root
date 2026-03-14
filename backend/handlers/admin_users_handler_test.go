package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminGetUser_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/admin/users/:userId", AdminGetUser)

	req := httptest.NewRequest(http.MethodGet, "/admin/users/abc", nil)
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

func TestAdminGetUser_NegativeID(t *testing.T) {
	// This test requires a database connection — skip in unit test context
	// The handler will panic on nil DB client
	t.Skip("requires database connection")
}

func TestMustGetUser_MissingContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/test", nil)

	user, ok := mustGetUser(c)
	if ok {
		t.Fatal("expected ok=false when no user in context")
	}
	if user != nil {
		t.Fatal("expected nil user")
	}
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestParseUintParam_Valid(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/test/42", nil)
	c.Params = gin.Params{{Key: "id", Value: "42"}}

	val, ok := parseUintParam(c, "id", "ID")
	if !ok {
		t.Fatal("expected ok=true for valid uint")
	}
	if val != 42 {
		t.Fatalf("expected 42, got %d", val)
	}
}

func TestParseUintParam_Zero(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/test/0", nil)
	c.Params = gin.Params{{Key: "id", Value: "0"}}

	_, ok := parseUintParam(c, "id", "ID")
	if ok {
		t.Fatal("expected ok=false for zero value")
	}
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestParseUintParam_NotANumber(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/test/abc", nil)
	c.Params = gin.Params{{Key: "id", Value: "abc"}}

	_, ok := parseUintParam(c, "id", "ID")
	if ok {
		t.Fatal("expected ok=false for non-numeric")
	}
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
