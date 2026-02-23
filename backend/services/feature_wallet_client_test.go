package services

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestParseFeatureWalletError_ParsesEnvelopeError(t *testing.T) {
	body := []byte(`{"success":false,"error":{"code":"TWO_FACTOR_REQUIRED","message":"Two-factor required"}}`)

	err := parseFeatureWalletError(http.StatusForbidden, body)
	var walletErr *FeatureWalletError
	if !errors.As(err, &walletErr) {
		t.Fatalf("expected FeatureWalletError, got %T", err)
	}
	if walletErr.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status code: got %d want %d", walletErr.StatusCode, http.StatusForbidden)
	}
	if walletErr.Code != "TWO_FACTOR_REQUIRED" {
		t.Fatalf("unexpected code: got %q want %q", walletErr.Code, "TWO_FACTOR_REQUIRED")
	}
	if walletErr.Message != "Two-factor required" {
		t.Fatalf("unexpected message: got %q want %q", walletErr.Message, "Two-factor required")
	}
}

func TestParseFeatureWalletError_ParsesGenericMessage(t *testing.T) {
	body := []byte(`{"code":"PIN_REQUIRED","message":"PIN is required"}`)

	err := parseFeatureWalletError(http.StatusForbidden, body)
	var walletErr *FeatureWalletError
	if !errors.As(err, &walletErr) {
		t.Fatalf("expected FeatureWalletError, got %T", err)
	}
	if walletErr.StatusCode != http.StatusForbidden {
		t.Fatalf("unexpected status code: got %d want %d", walletErr.StatusCode, http.StatusForbidden)
	}
	if walletErr.Code != "PIN_REQUIRED" {
		t.Fatalf("unexpected code: got %q want %q", walletErr.Code, "PIN_REQUIRED")
	}
	if walletErr.Message != "PIN is required" {
		t.Fatalf("unexpected message: got %q want %q", walletErr.Message, "PIN is required")
	}
}

func TestParseFeatureWalletError_FallsBackToStatusOnly(t *testing.T) {
	err := parseFeatureWalletError(http.StatusUnauthorized, []byte(`not-json`))
	var walletErr *FeatureWalletError
	if !errors.As(err, &walletErr) {
		t.Fatalf("expected FeatureWalletError, got %T", err)
	}
	if walletErr.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unexpected status code: got %d want %d", walletErr.StatusCode, http.StatusUnauthorized)
	}
	if walletErr.Code != "" {
		t.Fatalf("unexpected code: got %q want empty", walletErr.Code)
	}
	if walletErr.Message != "" {
		t.Fatalf("unexpected message: got %q want empty", walletErr.Message)
	}
}

func TestFeatureWalletClient_VerifyPin_Success(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.Method != http.MethodPost {
				t.Fatalf("unexpected method: got %s want %s", r.Method, http.MethodPost)
			}
			if r.URL.Path != "/api/v1/wallets/pin/verify" {
				t.Fatalf("unexpected path: got %s", r.URL.Path)
			}
			if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
				t.Fatalf("unexpected auth header: got %q", got)
			}

			rawBody, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("failed to read request body: %v", err)
			}
			if !strings.Contains(string(rawBody), `"pin":"123456"`) {
				t.Fatalf("unexpected request body: %s", string(rawBody))
			}

			return &http.Response{
				StatusCode: http.StatusOK,
				Header: http.Header{
					"Content-Type": []string{"application/json"},
				},
				Body: io.NopCloser(strings.NewReader(`{"valid":true,"message":"PIN valid","remainingAttempts":5}`)),
			}, nil
		}),
	}

	client := &FeatureWalletClient{
		baseURL: "https://feature.example",
		client:  httpClient,
	}

	result, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result == nil {
		t.Fatalf("expected verify pin result, got nil")
	}
	if !result.Valid {
		t.Fatalf("expected pin to be valid")
	}
	if result.Message != "PIN valid" {
		t.Fatalf("unexpected message: got %q", result.Message)
	}
	if result.RemainingAttempts == nil || *result.RemainingAttempts != 5 {
		t.Fatalf("unexpected remaining attempts: %+v", result.RemainingAttempts)
	}
}

func TestFeatureWalletClient_VerifyPin_ReturnsFeatureWalletErrorOnInvalidPin(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusUnauthorized,
				Header: http.Header{
					"Content-Type": []string{"application/json"},
				},
				Body: io.NopCloser(strings.NewReader(`{"success":false,"error":{"code":"INVALID_PIN","message":"PIN salah"}}`)),
			}, nil
		}),
	}

	client := &FeatureWalletClient{
		baseURL: "https://feature.example",
		client:  httpClient,
	}

	_, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456", nil)
	var walletErr *FeatureWalletError
	if !errors.As(err, &walletErr) {
		t.Fatalf("expected FeatureWalletError, got %T", err)
	}
	if walletErr.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unexpected status code: got %d want %d", walletErr.StatusCode, http.StatusUnauthorized)
	}
	if walletErr.Code != "INVALID_PIN" {
		t.Fatalf("unexpected code: got %q want %q", walletErr.Code, "INVALID_PIN")
	}
	if walletErr.Message != "PIN salah" {
		t.Fatalf("unexpected message: got %q want %q", walletErr.Message, "PIN salah")
	}
}

func TestFeatureWalletClient_VerifyPin_ForwardsPqcHeaders(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if got := r.Header.Get("X-PQC-Signature"); got != "dGVzdC1zaWc=" {
				t.Fatalf("unexpected X-PQC-Signature: got %q want %q", got, "dGVzdC1zaWc=")
			}
			if got := r.Header.Get("X-PQC-Key-Id"); got != "pqc_key123" {
				t.Fatalf("unexpected X-PQC-Key-Id: got %q want %q", got, "pqc_key123")
			}
			if got := r.Header.Get("X-PQC-Timestamp"); got != "2025-01-15T10:00:00Z" {
				t.Fatalf("unexpected X-PQC-Timestamp: got %q want %q", got, "2025-01-15T10:00:00Z")
			}

			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"valid":true,"message":"PIN valid"}`)),
			}, nil
		}),
	}

	client := &FeatureWalletClient{
		baseURL: "https://feature.example",
		client:  httpClient,
	}

	pqc := &PqcHeaders{
		Signature: "dGVzdC1zaWc=",
		KeyID:     "pqc_key123",
		Timestamp: "2025-01-15T10:00:00Z",
	}
	result, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456", pqc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Fatalf("expected pin to be valid")
	}
}

func TestFeatureWalletClient_VerifyPin_NilPqcOmitsHeaders(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if got := r.Header.Get("X-PQC-Signature"); got != "" {
				t.Fatalf("X-PQC-Signature should be absent, got %q", got)
			}
			if got := r.Header.Get("X-PQC-Key-Id"); got != "" {
				t.Fatalf("X-PQC-Key-Id should be absent, got %q", got)
			}
			if got := r.Header.Get("X-PQC-Timestamp"); got != "" {
				t.Fatalf("X-PQC-Timestamp should be absent, got %q", got)
			}

			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"valid":true,"message":"PIN valid"}`)),
			}, nil
		}),
	}

	client := &FeatureWalletClient{
		baseURL: "https://feature.example",
		client:  httpClient,
	}

	result, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Fatalf("expected pin to be valid")
	}
}

func TestFeatureWalletClient_VerifyPin_PqcSignatureInvalidError(t *testing.T) {
	httpClient := &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusUnauthorized,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"success":false,"error":{"code":"PQC_SIGNATURE_INVALID","message":"Missing X-PQC-Signature header"}}`)),
			}, nil
		}),
	}

	client := &FeatureWalletClient{
		baseURL: "https://feature.example",
		client:  httpClient,
	}

	_, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456", nil)
	var walletErr *FeatureWalletError
	if !errors.As(err, &walletErr) {
		t.Fatalf("expected FeatureWalletError, got %T", err)
	}
	if walletErr.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unexpected status code: got %d want %d", walletErr.StatusCode, http.StatusUnauthorized)
	}
	if walletErr.Code != "PQC_SIGNATURE_INVALID" {
		t.Fatalf("unexpected code: got %q want %q", walletErr.Code, "PQC_SIGNATURE_INVALID")
	}
	if walletErr.Message != "Missing X-PQC-Signature header" {
		t.Fatalf("unexpected message: got %q want %q", walletErr.Message, "Missing X-PQC-Signature header")
	}
}
