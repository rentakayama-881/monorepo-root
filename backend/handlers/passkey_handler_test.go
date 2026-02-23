package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend-gin/ent"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"go.uber.org/zap"
)

type fakePasskeyService struct {
	beginCalled  bool
	finishCalled bool
}

func (f *fakePasskeyService) GetPasskeyCount(ctx context.Context, userID int) (int, error) {
	return 0, nil
}

func (f *fakePasskeyService) ListPasskeys(ctx context.Context, userID int) ([]*ent.Passkey, error) {
	return []*ent.Passkey{}, nil
}

func (f *fakePasskeyService) BeginRegistration(ctx context.Context, userID int) (*protocol.CredentialCreation, string, error) {
	f.beginCalled = true
	return &protocol.CredentialCreation{}, "session-123", nil
}

func (f *fakePasskeyService) FinishRegistration(ctx context.Context, userID int, sessionID string, name string, response *protocol.ParsedCredentialCreationData) (*ent.Passkey, error) {
	f.finishCalled = true
	return &ent.Passkey{Name: name}, nil
}

func (f *fakePasskeyService) DeletePasskey(ctx context.Context, userID int, passkeyID int) error {
	return nil
}

func (f *fakePasskeyService) RenamePasskey(ctx context.Context, userID int, passkeyID int, newName string) error {
	return nil
}

func (f *fakePasskeyService) HasPasskeysByEmail(ctx context.Context, email string) (bool, error) {
	return false, nil
}

func (f *fakePasskeyService) BeginLogin(ctx context.Context, email string) (*protocol.CredentialAssertion, string, error) {
	return &protocol.CredentialAssertion{}, "session-123", nil
}

func (f *fakePasskeyService) BeginDiscoverableLogin() (*protocol.CredentialAssertion, string, error) {
	return &protocol.CredentialAssertion{}, "session-123", nil
}

func (f *fakePasskeyService) FinishLogin(ctx context.Context, email string, sessionID string, response *protocol.ParsedCredentialAssertionData) (*ent.User, error) {
	return &ent.User{ID: 1, Email: "user@example.com"}, nil
}

func (f *fakePasskeyService) FinishDiscoverableLogin(ctx context.Context, sessionID string, response *protocol.ParsedCredentialAssertionData) (*ent.User, error) {
	return &ent.User{ID: 1, Email: "user@example.com"}, nil
}

type fakeAuthService struct{}

func (f *fakeAuthService) LoginWithPasskey(ctx context.Context, u *ent.User, ipAddress, userAgent, deviceFingerprint string) (*services.LoginResponse, error) {
	return &services.LoginResponse{}, nil
}

type fakeWalletStatusClient struct {
	status       *services.FeaturePinStatusResult
	err          error
	verifyResult *services.FeaturePinVerifyResult
	verifyErr    error
	verifyCalled bool
	verifyPin    string
}

func (f *fakeWalletStatusClient) GetPinStatus(ctx context.Context, authHeader string) (*services.FeaturePinStatusResult, error) {
	return f.status, f.err
}

func (f *fakeWalletStatusClient) VerifyPin(ctx context.Context, authHeader, pin string) (*services.FeaturePinVerifyResult, error) {
	f.verifyCalled = true
	f.verifyPin = pin
	return f.verifyResult, f.verifyErr
}

func setupPasskeyProtectedRouter(handlerFn gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", uint(42))
		c.Next()
	})
	router.POST("/passkeys/register/begin", handlerFn)
	router.POST("/passkeys/register/finish", handlerFn)
	return router
}

func decodeBodyMap(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}
	return body
}

func newBeginRegistrationRequest(pin string) *http.Request {
	reqBody := bytes.NewBufferString(`{"pin":"` + pin + `"}`)
	req := httptest.NewRequest(http.MethodPost, "/passkeys/register/begin", reqBody)
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestPasskeyBeginRegistration_Returns403WhenPinNotSet(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		status: &services.FeaturePinStatusResult{PinSet: false},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusForbidden)
	}

	body := decodeBodyMap(t, rec)
	if body["code"] != "PIN_REQUIRED" {
		t.Fatalf("unexpected code: got %v want PIN_REQUIRED", body["code"])
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when PIN is not set")
	}
}

func TestPasskeyBeginRegistration_Returns503WhenPinCheckUnavailable(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		err: context.DeadlineExceeded,
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusServiceUnavailable)
	}

	body := decodeBodyMap(t, rec)
	if body["code"] != "PASSKEY_SECURITY_CHECK_UNAVAILABLE" {
		t.Fatalf("unexpected code: got %v want PASSKEY_SECURITY_CHECK_UNAVAILABLE", body["code"])
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when PIN check is unavailable")
	}
}

func TestPasskeyBeginRegistration_Returns401WhenPinStatusUnauthorized(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		err: &services.FeatureWalletError{
			StatusCode: http.StatusUnauthorized,
			Code:       "UNAUTHORIZED",
			Message:    "Unauthorized",
		},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusUnauthorized)
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when wallet status check is unauthorized")
	}
}

func TestPasskeyBeginRegistration_Returns403WhenWalletRequiresTwoFactor(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		err: &services.FeatureWalletError{
			StatusCode: http.StatusForbidden,
			Code:       "TWO_FACTOR_REQUIRED",
			Message:    "Two-factor authentication required",
		},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusForbidden)
	}

	body := decodeBodyMap(t, rec)
	if body["code"] != "TWO_FACTOR_REQUIRED" {
		t.Fatalf("unexpected code: got %v want TWO_FACTOR_REQUIRED", body["code"])
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when 2FA is required")
	}
}

func TestPasskeyBeginRegistration_Returns403PinRequiredForGenericForbidden(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		err: &services.FeatureWalletError{
			StatusCode: http.StatusForbidden,
			Code:       "FORBIDDEN",
			Message:    "Forbidden",
		},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusForbidden)
	}

	body := decodeBodyMap(t, rec)
	if body["code"] != "PIN_REQUIRED" {
		t.Fatalf("unexpected code: got %v want PIN_REQUIRED", body["code"])
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when wallet returns generic forbidden")
	}
}

func TestPasskeyBeginRegistration_Returns400WhenPinPayloadMissing(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		status: &services.FeaturePinStatusResult{PinSet: true},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := httptest.NewRequest(http.MethodPost, "/passkeys/register/begin", nil)
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusBadRequest)
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when PIN payload is missing")
	}
	if walletSvc.verifyCalled {
		t.Fatalf("verify pin should not be called when PIN payload is invalid")
	}
}

func TestPasskeyBeginRegistration_Returns400WhenPinFormatInvalid(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		status: &services.FeaturePinStatusResult{PinSet: true},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("12ab")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusBadRequest)
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when PIN format is invalid")
	}
	if walletSvc.verifyCalled {
		t.Fatalf("verify pin should not be called when PIN format is invalid")
	}
}

func TestPasskeyBeginRegistration_Returns401WhenPinVerificationFails(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		status: &services.FeaturePinStatusResult{PinSet: true},
		verifyErr: &services.FeatureWalletError{
			StatusCode: http.StatusUnauthorized,
			Code:       "INVALID_PIN",
			Message:    "PIN salah. Sisa percobaan: 2",
		},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusUnauthorized)
	}

	body := decodeBodyMap(t, rec)
	if body["code"] != "INVALID_PIN" {
		t.Fatalf("unexpected code: got %v want INVALID_PIN", body["code"])
	}
	if passkeySvc.beginCalled {
		t.Fatalf("begin registration should not be called when PIN is invalid")
	}
	if !walletSvc.verifyCalled {
		t.Fatalf("verify pin should be called when PIN payload is valid")
	}
}

func TestPasskeyBeginRegistration_AllowsWhenPinSetAndVerified(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		status:       &services.FeaturePinStatusResult{PinSet: true},
		verifyResult: &services.FeaturePinVerifyResult{Valid: true, Message: "PIN valid"},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.BeginRegistration)
	req := newBeginRegistrationRequest("123456")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusOK)
	}

	body := decodeBodyMap(t, rec)
	if body["session_id"] != "session-123" {
		t.Fatalf("unexpected session_id: got %v want session-123", body["session_id"])
	}
	if !passkeySvc.beginCalled {
		t.Fatalf("begin registration should be called when PIN is set")
	}
	if !walletSvc.verifyCalled {
		t.Fatalf("verify pin should be called before begin registration")
	}
	if walletSvc.verifyPin != "123456" {
		t.Fatalf("unexpected verified pin: got %q want %q", walletSvc.verifyPin, "123456")
	}
}

func TestPasskeyFinishRegistration_Returns403WhenPinNotSet(t *testing.T) {
	passkeySvc := &fakePasskeyService{}
	walletSvc := &fakeWalletStatusClient{
		status: &services.FeaturePinStatusResult{PinSet: false},
	}
	handler := &PasskeyHandler{
		passkeyService: passkeySvc,
		authService:    &fakeAuthService{},
		walletClient:   walletSvc,
		logger:         zap.NewNop(),
	}

	router := setupPasskeyProtectedRouter(handler.FinishRegistration)
	reqBody := bytes.NewBufferString(`{"session_id":"abc","credential":{"id":"x"}}`)
	req := httptest.NewRequest(http.MethodPost, "/passkeys/register/finish", reqBody)
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusForbidden)
	}

	body := decodeBodyMap(t, rec)
	if body["code"] != "PIN_REQUIRED" {
		t.Fatalf("unexpected code: got %v want PIN_REQUIRED", body["code"])
	}
	if passkeySvc.finishCalled {
		t.Fatalf("finish registration should not be called when PIN is not set")
	}
}
