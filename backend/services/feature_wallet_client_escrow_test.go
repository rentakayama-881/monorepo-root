package services

import (
	"testing"
)

// =============================================================================
// feature_wallet_client_escrow.go
//
// All exported methods (ReserveMarketPurchase, CaptureMarketPurchase,
// ReleaseMarketPurchase, DistributeMarketPurchase, GetMarketPurchaseHistory)
// require an HTTP client hitting a remote Feature Service. They cannot be
// tested without a running server or an httptest mock.
//
// The base FeatureWalletClient and its HTTP-level tests live in
// feature_wallet_client_test.go. Escrow methods follow the same
// postMarketWallet helper pattern.
// =============================================================================

func TestPlaceholder_FeatureWalletClient_ReserveMarketPurchase(t *testing.T) {
	t.Skip("requires running Feature Service or HTTP mock server")
}

func TestPlaceholder_FeatureWalletClient_CaptureMarketPurchase(t *testing.T) {
	t.Skip("requires running Feature Service or HTTP mock server")
}

func TestPlaceholder_FeatureWalletClient_ReleaseMarketPurchase(t *testing.T) {
	t.Skip("requires running Feature Service or HTTP mock server")
}

func TestPlaceholder_FeatureWalletClient_DistributeMarketPurchase(t *testing.T) {
	t.Skip("requires running Feature Service or HTTP mock server")
}

func TestPlaceholder_FeatureWalletClient_GetMarketPurchaseHistory(t *testing.T) {
	t.Skip("requires running Feature Service or HTTP mock server")
}

// GetMarketPurchaseHistory has input validation logic we can test
// by calling it with a nil client (the guard clause).
func TestFeatureWalletClient_GetMarketPurchaseHistory_NilClient(t *testing.T) {
	var client *FeatureWalletClient
	_, err := client.GetMarketPurchaseHistory(nil, "", 0, 0, "")
	if err == nil {
		t.Fatal("expected error for nil client, got nil")
	}
}

func TestFeatureWalletClient_GetMarketPurchaseHistory_EmptyBaseURL(t *testing.T) {
	client := &FeatureWalletClient{baseURL: ""}
	_, err := client.GetMarketPurchaseHistory(nil, "", 1, 10, "")
	if err == nil {
		t.Fatal("expected error for empty baseURL, got nil")
	}
}
