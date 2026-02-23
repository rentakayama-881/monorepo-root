package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"backend-gin/config"
)

type FeatureWalletClient struct {
	baseURL string
	client  *http.Client
}

type FeatureWalletBalanceResult struct {
	UserID  uint  `json:"userId"`
	Balance int64 `json:"balance"`
}

type FeaturePinStatusResult struct {
	PinSet         bool       `json:"pinSet"`
	IsLocked       bool       `json:"isLocked"`
	LockedUntil    *time.Time `json:"lockedUntil"`
	FailedAttempts int        `json:"failedAttempts"`
	MaxAttempts    int        `json:"maxAttempts"`
}

type FeatureWalletError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *FeatureWalletError) Error() string {
	if e == nil {
		return "feature wallet request failed"
	}
	if strings.TrimSpace(e.Message) != "" {
		return e.Message
	}
	if strings.TrimSpace(e.Code) != "" {
		return fmt.Sprintf("feature wallet request failed (%s) with status %d", e.Code, e.StatusCode)
	}
	return fmt.Sprintf("feature wallet request failed with status %d", e.StatusCode)
}

type featureApiEnvelope[T any] struct {
	Success bool `json:"success"`
	Data    T    `json:"data"`
	Error   *struct {
		Code    string   `json:"code"`
		Message string   `json:"message"`
		Details []string `json:"details"`
	} `json:"error"`
}

type FeatureMarketWalletResult struct {
	ReservationID string `json:"reservationId"`
	OrderID       string `json:"orderId"`
	Status        string `json:"status"`
	AmountIDR     int64  `json:"amountIdr"`
}

func NewFeatureWalletClientFromConfig() *FeatureWalletClient {
	return &FeatureWalletClient{
		baseURL: strings.TrimRight(config.FeatureServiceURL, "/"),
		client: &http.Client{
			Timeout: 12 * time.Second,
		},
	}
}

func (c *FeatureWalletClient) ReserveMarketPurchase(ctx context.Context, authHeader, orderID string, amountIDR int64) (*FeatureMarketWalletResult, error) {
	payload := map[string]interface{}{
		"orderId":       orderID,
		"amountIdr":     amountIDR,
		"description":   "Reserve saldo pembelian Market ChatGPT",
		"referenceType": "market_chatgpt",
	}
	return c.postMarketWallet(ctx, authHeader, "/api/v1/wallets/market-purchases/reserve", payload)
}

func (c *FeatureWalletClient) GetMyWalletBalance(ctx context.Context, authHeader string) (*FeatureWalletBalanceResult, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("feature wallet client is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/wallets/me", nil)
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

	var parsed featureApiEnvelope[FeatureWalletBalanceResult]
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

func (c *FeatureWalletClient) GetPinStatus(ctx context.Context, authHeader string) (*FeaturePinStatusResult, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("feature wallet client is not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/v1/wallets/pin/status", nil)
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

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, parseFeatureWalletError(resp.StatusCode, body)
	}

	// Wallet PIN status endpoint can be returned either in a wrapped envelope
	// or as raw JSON object depending on deployment/version.
	var wrapped featureApiEnvelope[FeaturePinStatusResult]
	if err := json.Unmarshal(body, &wrapped); err == nil && wrapped.Success {
		return &wrapped.Data, nil
	}

	var raw FeaturePinStatusResult
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to decode pin status response: %w", err)
	}

	return &raw, nil
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

func (c *FeatureWalletClient) postMarketWallet(ctx context.Context, authHeader, path string, payload interface{}) (*FeatureMarketWalletResult, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("feature wallet client is not configured")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed featureApiEnvelope[FeatureMarketWalletResult]
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

func parseFeatureWalletError(statusCode int, body []byte) error {
	var wrapped featureApiEnvelope[json.RawMessage]
	wrappedCode := ""
	wrappedMessage := ""
	if err := json.Unmarshal(body, &wrapped); err == nil {
		if wrapped.Error != nil {
			wrappedCode = strings.TrimSpace(wrapped.Error.Code)
			wrappedMessage = strings.TrimSpace(wrapped.Error.Message)
			if wrappedMessage != "" {
				return &FeatureWalletError{
					StatusCode: statusCode,
					Code:       wrappedCode,
					Message:    wrappedMessage,
				}
			}
		}
	}

	var generic map[string]interface{}
	if err := json.Unmarshal(body, &generic); err == nil {
		code := wrappedCode
		if code == "" {
			if v, ok := generic["code"].(string); ok {
				code = strings.TrimSpace(v)
			} else if errObj, ok := generic["error"].(map[string]interface{}); ok {
				if v, ok := errObj["code"].(string); ok {
					code = strings.TrimSpace(v)
				}
			}
		}

		if msg, ok := generic["message"].(string); ok && strings.TrimSpace(msg) != "" {
			return &FeatureWalletError{
				StatusCode: statusCode,
				Code:       code,
				Message:    strings.TrimSpace(msg),
			}
		}
		if errObj, ok := generic["error"].(map[string]interface{}); ok {
			if msg, ok := errObj["message"].(string); ok && strings.TrimSpace(msg) != "" {
				return &FeatureWalletError{
					StatusCode: statusCode,
					Code:       code,
					Message:    strings.TrimSpace(msg),
				}
			}
		}
	}

	return &FeatureWalletError{
		StatusCode: statusCode,
		Code:       wrappedCode,
		Message:    wrappedMessage,
	}
}
