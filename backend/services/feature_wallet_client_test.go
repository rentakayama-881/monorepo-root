package services

import (
	"errors"
	"net/http"
	"testing"
)

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
