package services

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"backend-gin/logger"
	"go.uber.org/zap"
)

// FeatureServiceDeviceBanChecker checks device bans via Feature Service
type FeatureServiceDeviceBanChecker struct {
	httpClient     *http.Client
	featureURL     string
	serviceToken   string
}

// CheckDeviceBanRequest matches Feature Service request (camelCase to match .NET serialization)
type CheckDeviceBanRequest struct {
	DeviceFingerprint string `json:"deviceFingerprint"`
}

// CheckDeviceBanResponse matches Feature Service response (camelCase to match .NET serialization)
type CheckDeviceBanResponse struct {
	IsBanned bool   `json:"isBanned"`
	Message  string `json:"message"`
}

// NewFeatureServiceDeviceBanChecker creates a new device ban checker
func NewFeatureServiceDeviceBanChecker(featureURL, serviceToken string) *FeatureServiceDeviceBanChecker {
	return &FeatureServiceDeviceBanChecker{
		httpClient: &http.Client{
			Timeout: 500 * time.Millisecond, // 500ms timeout for quick failure
		},
		featureURL:   featureURL,
		serviceToken: serviceToken,
	}
}

// IsDeviceBanned checks if a device is banned via Feature Service
// Returns (isBanned, reason, error)
// On error, returns (false, "", error) to allow graceful fallback
func (c *FeatureServiceDeviceBanChecker) IsDeviceBanned(ctx context.Context, deviceFingerprint string) (bool, string, error) {
	if deviceFingerprint == "" {
		return false, "", nil // No fingerprint, not banned
	}

	if c.featureURL == "" || c.serviceToken == "" {
		logger.Warn("Feature Service not configured for device ban checking")
		return false, "", nil // Not configured, allow access
	}

	checkURL := c.featureURL + "/api/v1/admin/moderation/device-bans/check"

	// Prepare request
	reqBody := CheckDeviceBanRequest{
		DeviceFingerprint: deviceFingerprint,
	}
	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		logger.Error("Failed to marshal device ban check request", zap.Error(err))
		return false, "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", checkURL, bytes.NewReader(jsonBody))
	if err != nil {
		logger.Warn("Failed to create device ban check request", zap.Error(err))
		return false, "", err // Allow on error
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Token", c.serviceToken)

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		logger.Warn("Feature Service device ban check failed (timeout or connection error)", zap.Error(err))
		return false, "", nil // Graceful fallback - allow access if Feature Service unavailable
	}
	defer resp.Body.Close()

	// Read response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Warn("Failed to read Feature Service device ban response", zap.Error(err))
		return false, "", nil // Graceful fallback
	}

	// Handle non-200 responses
	if resp.StatusCode != http.StatusOK {
		logger.Warn("Feature Service device ban check returned error status",
			zap.Int("status_code", resp.StatusCode),
			zap.String("response", string(bodyBytes)))
		return false, "", nil // Graceful fallback
	}

	// Parse response
	var checkResp CheckDeviceBanResponse
	if err := json.Unmarshal(bodyBytes, &checkResp); err != nil {
		logger.Warn("Failed to parse Feature Service device ban response", zap.Error(err))
		return false, "", nil // Graceful fallback
	}

	if checkResp.IsBanned {
		logger.Warn("Device is banned",
			zap.String("fingerprint", deviceFingerprint[:min(len(deviceFingerprint), 16)]+"..."),
			zap.String("message", checkResp.Message))
	}

	return checkResp.IsBanned, checkResp.Message, nil
}
