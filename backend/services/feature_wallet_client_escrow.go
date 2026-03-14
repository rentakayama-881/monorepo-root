package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

func (c *FeatureWalletClient) ReserveMarketPurchase(ctx context.Context, authHeader, orderID string, amountIDR int64) (*FeatureMarketWalletResult, error) {
	payload := map[string]interface{}{
		"orderId":       orderID,
		"amountIdr":     amountIDR,
		"description":   "Reserve saldo pembelian Market ChatGPT",
		"referenceType": "market_chatgpt",
	}
	return c.postMarketWallet(ctx, authHeader, "/api/v1/wallets/market-purchases/reserve", payload)
}

func (c *FeatureWalletClient) CaptureMarketPurchase(ctx context.Context, authHeader, orderID string) (*FeatureMarketWalletResult, error) {
	payload := map[string]interface{}{
		"orderId": orderID,
		"reason":  "Pembelian akun berhasil",
	}
	return c.postMarketWallet(ctx, authHeader, "/api/v1/wallets/market-purchases/capture", payload)
}

func (c *FeatureWalletClient) ReleaseMarketPurchase(ctx context.Context, authHeader, orderID, reason string) (*FeatureMarketWalletResult, error) {
	payload := map[string]interface{}{
		"orderId": orderID,
		"reason":  reason,
	}
	return c.postMarketWallet(ctx, authHeader, "/api/v1/wallets/market-purchases/release", payload)
}

func (c *FeatureWalletClient) DistributeMarketPurchase(
	ctx context.Context,
	authHeader string,
	orderID string,
	recipients []FeatureMarketDistributionRecipient,
	reason string,
	referenceType string,
) (*FeatureMarketWalletResult, error) {
	payload := map[string]interface{}{
		"orderId":       orderID,
		"recipients":    recipients,
		"reason":        reason,
		"referenceType": referenceType,
	}
	return c.postMarketWallet(ctx, authHeader, "/api/v1/wallets/market-purchases/distribute", payload)
}

func (c *FeatureWalletClient) GetMarketPurchaseHistory(
	ctx context.Context,
	authHeader string,
	page int,
	pageSize int,
	status string,
) (*FeatureMarketPurchaseHistoryResult, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("feature wallet client is not configured")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 50
	}
	path := fmt.Sprintf("/api/v1/wallets/market-purchases/history?page=%d&pageSize=%d", page, pageSize)
	if strings.TrimSpace(status) != "" {
		path = path + "&status=" + url.QueryEscape(strings.TrimSpace(status))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed featureApiEnvelope[FeatureMarketPurchaseHistoryResult]
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusBadRequest || !parsed.Success {
		if parsed.Error != nil && strings.TrimSpace(parsed.Error.Message) != "" {
			return nil, fmt.Errorf("%s", parsed.Error.Message)
		}
		return nil, fmt.Errorf("feature wallet request failed with status %d", resp.StatusCode)
	}
	return &parsed.Data, nil
}
