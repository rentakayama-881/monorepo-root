package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend-gin/ent"

	"github.com/gin-gonic/gin"
)

func TestGDPRDataExportHandler_Unauthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/account/data-export", nil)

	// Call without setting user in context → should return 401
	GDPRDataExportHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["error"] != "Unauthorized" {
		t.Fatalf("unexpected error message: %v", body["error"])
	}
}

func TestGDPRDataExportHandler_NilUser(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/account/data-export", nil)

	// Set a nil user → should return 401
	c.Set("user", (*ent.User)(nil))

	GDPRDataExportHandler(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestGDPRDataExportHandler_RequiresDB(t *testing.T) {
	t.Skip("requires database connection")
}

// ---------------------------------------------------------------------------
// Unit tests for sanitisation helpers
// ---------------------------------------------------------------------------

func TestBuildUserProfile_RedactsSensitive(t *testing.T) {
	username := "testuser"
	now := time.Now()

	u := &ent.User{
		ID:           42,
		Email:        "test@example.com",
		Username:     &username,
		PasswordHash: "should-be-redacted",
		TotpEnabled:  true,
		Bio:          "hello",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	// TotpSecret is a *string; sensitive
	secret := "supersecret"
	u.TotpSecret = &secret

	profile := buildUserProfile(u)

	// Verify present fields
	if profile["email"] != "test@example.com" {
		t.Errorf("expected email test@example.com, got %v", profile["email"])
	}
	if profile["username"] != "testuser" {
		t.Errorf("expected username testuser, got %v", profile["username"])
	}
	if profile["totp_enabled"] != true {
		t.Errorf("expected totp_enabled true, got %v", profile["totp_enabled"])
	}

	// Verify sensitive fields are NOT present
	if _, exists := profile["password_hash"]; exists {
		t.Error("password_hash should not be in the export")
	}
	if _, exists := profile["totp_secret"]; exists {
		t.Error("totp_secret should not be in the export")
	}
}

func TestBuildSessionExport_RedactsTokens(t *testing.T) {
	now := time.Now()
	sessions := []*ent.Session{
		{
			ID:               1,
			IPAddress:        "1.2.3.4",
			UserAgent:        "Mozilla/5.0",
			RefreshTokenHash: "should-be-redacted",
			AccessTokenJti:   "should-be-redacted",
			TokenFamily:      "should-be-redacted",
			CreatedAt:        now,
			ExpiresAt:        now.Add(24 * time.Hour),
			LastUsedAt:       now,
		},
	}

	result := buildSessionExport(sessions)

	if len(result) != 1 {
		t.Fatalf("expected 1 session, got %d", len(result))
	}

	s := result[0]
	if s["ip_address"] != "1.2.3.4" {
		t.Errorf("expected ip_address 1.2.3.4, got %v", s["ip_address"])
	}

	// Token fields must not be present
	for _, key := range []string{"refresh_token_hash", "access_token_jti", "token_family"} {
		if _, exists := s[key]; exists {
			t.Errorf("%s should not be in session export", key)
		}
	}
}

func TestBuildPasskeyExport_RedactsKeys(t *testing.T) {
	now := time.Now()
	passkeys := []*ent.Passkey{
		{
			ID:           1,
			Name:         "My YubiKey",
			CredentialID: []byte("credential-data"),
			PublicKey:    []byte("public-key-data"),
			CreatedAt:    now,
			LastUsedAt:   &now,
		},
	}

	result := buildPasskeyExport(passkeys)

	if len(result) != 1 {
		t.Fatalf("expected 1 passkey, got %d", len(result))
	}

	p := result[0]
	if p["name"] != "My YubiKey" {
		t.Errorf("expected name 'My YubiKey', got %v", p["name"])
	}

	for _, key := range []string{"credential_id", "public_key", "aaguid"} {
		if _, exists := p[key]; exists {
			t.Errorf("%s should not be in passkey export", key)
		}
	}
}

func TestBuildBadgeExport(t *testing.T) {
	now := time.Now()
	badge := &ent.Badge{
		ID:   10,
		Name: "Verified",
		Slug: "verified",
	}

	userBadges := []*ent.UserBadge{
		{
			ID:        1,
			BadgeID:   10,
			Reason:    "Verified identity",
			GrantedAt: now,
			Edges: ent.UserBadgeEdges{
				Badge: badge,
			},
		},
	}

	result := buildBadgeExport(userBadges)

	if len(result) != 1 {
		t.Fatalf("expected 1 badge, got %d", len(result))
	}

	b := result[0]
	if b["badge_name"] != "Verified" {
		t.Errorf("expected badge_name 'Verified', got %v", b["badge_name"])
	}
	if b["badge_slug"] != "verified" {
		t.Errorf("expected badge_slug 'verified', got %v", b["badge_slug"])
	}
}

func TestBuildValidationCaseExport(t *testing.T) {
	now := time.Now()
	cases := []*ent.ValidationCase{
		{
			ID:               1,
			Title:            "Test Case",
			Summary:          "A test validation case",
			Status:           "open",
			SensitivityLevel: "S1",
			BountyAmount:     100000,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
	}

	result := buildValidationCaseExport(cases)

	if len(result) != 1 {
		t.Fatalf("expected 1 case, got %d", len(result))
	}

	vc := result[0]
	if vc["title"] != "Test Case" {
		t.Errorf("expected title 'Test Case', got %v", vc["title"])
	}
	if vc["status"] != "open" {
		t.Errorf("expected status 'open', got %v", vc["status"])
	}
}

func TestBuildSecurityEventExport(t *testing.T) {
	now := time.Now()
	events := []*ent.SecurityEvent{
		{
			ID:        1,
			EventType: "login",
			IPAddress: "10.0.0.1",
			UserAgent: "Chrome/100",
			Success:   true,
			Severity:  "info",
			CreatedAt: now,
		},
	}

	result := buildSecurityEventExport(events)

	if len(result) != 1 {
		t.Fatalf("expected 1 event, got %d", len(result))
	}

	e := result[0]
	if e["event_type"] != "login" {
		t.Errorf("expected event_type 'login', got %v", e["event_type"])
	}
	// Details field should not be exported (may contain sensitive info)
	if _, exists := e["details"]; exists {
		t.Error("details should not be in security event export")
	}
}

func TestBuildSessionExport_Empty(t *testing.T) {
	result := buildSessionExport(nil)
	if len(result) != 0 {
		t.Errorf("expected empty slice, got %d items", len(result))
	}
}

func TestBuildUserProfile_NilUsername(t *testing.T) {
	u := &ent.User{
		ID:    1,
		Email: "test@example.com",
		// Username is nil
	}

	profile := buildUserProfile(u)
	if profile["username"] != "" {
		t.Errorf("expected empty username for nil, got %v", profile["username"])
	}
}
