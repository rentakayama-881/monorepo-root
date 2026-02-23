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

	result, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456")
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

	_, err := client.VerifyPin(context.Background(), "Bearer test-token", "123456")
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
