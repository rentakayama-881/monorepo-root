package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend-gin/ent"

	"github.com/gin-gonic/gin"
)

func TestUploadAvatarHandler_NoUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/account/avatar", nil)

	UploadAvatarHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestUploadAvatarHandler_NoFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	user := &ent.User{ID: 1, Email: "test@example.com"}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/account/avatar", nil)
	c.Set("user", user)

	UploadAvatarHandler(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["error"] != "file tidak ditemukan" {
		t.Fatalf("expected 'file tidak ditemukan', got %v", body["error"])
	}
}

func TestDeleteAvatarHandler_NoUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/account/avatar", nil)

	DeleteAvatarHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestDeleteAvatarHandler_NoAvatar(t *testing.T) {
	gin.SetMode(gin.TestMode)

	user := &ent.User{ID: 1, Email: "test@example.com", AvatarURL: ""}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodDelete, "/api/account/avatar", nil)
	c.Set("user", user)

	DeleteAvatarHandler(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["error"] != "tidak ada foto profil" {
		t.Fatalf("expected 'tidak ada foto profil', got %v", body["error"])
	}
}
