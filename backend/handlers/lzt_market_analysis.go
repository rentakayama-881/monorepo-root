package handlers

import (
	"fmt"
	"strings"

	"backend-gin/services"
)

func isRetryRequestResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return false
	}
	if hasStatusValue(resp, "retry_request") {
		return true
	}
	errorsList := extractProviderErrors(resp)
	for _, msg := range errorsList {
		if strings.EqualFold(strings.TrimSpace(msg), "retry_request") {
			return true
		}
	}
	return false
}

func isSuccessfulPurchaseResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil || resp.StatusCode >= 400 || resp.JSON == nil {
		return false
	}
	if isRetryRequestResponse(resp) {
		return false
	}
	if len(extractProviderErrors(resp)) > 0 {
		return false
	}
	if hasStatusValue(resp, "ok") || hasStatusValue(resp, "success") {
		return true
	}
	return hasPurchasingPayload(resp)
}

func hasPurchasingPayload(resp *services.LZTMarketResponse) bool {
	if resp == nil || resp.StatusCode >= 400 || resp.JSON == nil {
		return false
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return false
	}
	item := readMap(root, "item")
	if len(item) == 0 {
		return false
	}
	loginData := readMap(item, "loginData")
	if len(loginData) > 0 {
		return true
	}
	// Some responses may still be considered success with item summary.
	return firstNonEmptyString(item, "item_id", "title") != ""
}

func shouldFallbackAfterFastBuy(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return true
	}
	if isHardFailResponse(resp) {
		return false
	}
	if isRetryRequestResponse(resp) {
		return true
	}
	if resp.StatusCode >= 500 {
		return true
	}
	if resp.StatusCode >= 400 {
		return true
	}
	return !isSuccessfulPurchaseResponse(resp)
}

func shouldTryConfirmBuyFallback(resp *services.LZTMarketResponse, failureReason string) bool {
	if resp == nil {
		return false
	}

	lowerReason := strings.ToLower(strings.TrimSpace(failureReason))
	providerErrors := strings.ToLower(strings.Join(extractProviderErrors(resp), " | "))
	combined := strings.TrimSpace(lowerReason + " | " + providerErrors)

	disallowSignals := []string{
		"invalid or expired access token",
		"invalid access token",
		"access token",
		"permission",
		"forbidden",
		"unauthorized",
		"ad not found",
		"item not found",
		"this item is sold",
		"removed by the site administration",
		"currently unavailable",
	}
	for _, signal := range disallowSignals {
		if strings.Contains(combined, signal) {
			return false
		}
	}

	if strings.Contains(lowerReason, "retry_request") ||
		strings.Contains(lowerReason, "checker") ||
		strings.Contains(lowerReason, "validation") ||
		strings.Contains(lowerReason, "more than 20 errors occurred during account validation") {
		return true
	}

	return strings.Contains(providerErrors, "retry_request") ||
		strings.Contains(providerErrors, "checker") ||
		strings.Contains(providerErrors, "validation")
}

func isHardFailResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return false
	}
	if resp.StatusCode == 401 || resp.StatusCode == 403 || resp.StatusCode == 404 {
		return true
	}
	errorsList := strings.ToLower(strings.Join(extractProviderErrors(resp), " | "))
	if strings.Contains(errorsList, "invalid or expired access token") {
		return true
	}
	if strings.Contains(errorsList, "no permission") || strings.Contains(errorsList, "do not have permission") {
		return true
	}
	if strings.Contains(errorsList, "ad not found") || strings.Contains(errorsList, "item not found") {
		return true
	}
	if strings.Contains(errorsList, "this item is sold") {
		return true
	}
	return false
}

func normalizeProviderFailureReason(resp *services.LZTMarketResponse, fallback string) string {
	if resp == nil {
		return fallback
	}
	errorsList := extractProviderErrors(resp)
	if len(errorsList) > 0 {
		return strings.TrimSpace(strings.Join(errorsList, "; "))
	}
	if strings.TrimSpace(resp.Raw) != "" {
		return strings.TrimSpace(resp.Raw)
	}
	if resp.StatusCode > 0 {
		return fmt.Sprintf("%s (status %d)", fallback, resp.StatusCode)
	}
	return fallback
}

func normalizeUserFacingFailureReason(reason string) string {
	msg := strings.TrimSpace(reason)
	if msg == "" {
		return "Akun belum siap untuk dijual saat ini."
	}
	if isProviderIntegrationFailureReason(msg) {
		return "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."
	}
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "current listing") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "currently unavailable") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "ad not found") || strings.Contains(lower, "item not found") || strings.Contains(lower, "not found") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "removed by the site administration") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "this item is sold") || strings.Contains(lower, "sold") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "secret answer") ||
		strings.Contains(lower, "secret question") ||
		strings.Contains(lower, "security answer") ||
		strings.Contains(lower, "security question") ||
		strings.Contains(lower, "payment password") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "more than 20 errors occurred during account validation") ||
		strings.Contains(lower, "account validation") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "retry_request") {
		return "Checker sedang error. Coba lagi sebentar."
	}
	return "Terjadi kendala sementara. Silakan coba lagi."
}

func normalizeCheckerErrorMessage(err error) string {
	if err == nil {
		return "Akun belum siap untuk dijual saat ini."
	}
	msg := strings.TrimSpace(err.Error())
	if isProviderIntegrationFailureReason(msg) {
		return "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."
	}
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "currently unavailable") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "sold") ||
		strings.Contains(lower, "not found") ||
		strings.Contains(lower, "ad not found") ||
		strings.Contains(lower, "item not found") ||
		strings.Contains(lower, "removed by the site administration") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "secret answer") ||
		strings.Contains(lower, "secret question") ||
		strings.Contains(lower, "security answer") ||
		strings.Contains(lower, "security question") ||
		strings.Contains(lower, "payment password") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "more than 20 errors occurred during account validation") ||
		strings.Contains(lower, "account validation") {
		return "Akun belum siap untuk dijual saat ini."
	}
	return "Checker sedang error. Coba lagi sebentar."
}

func isProviderIntegrationFailureReason(reason string) bool {
	lower := strings.ToLower(strings.TrimSpace(reason))
	if lower == "" {
		return false
	}
	integrationSignals := []string{
		"invalid or expired access token",
		"invalid access token",
		"access token",
		"do not have permission",
		"no permission",
		"forbidden",
		"unauthorized",
		"permission denied",
		"market scope",
		"insufficient scope",
	}
	for _, signal := range integrationSignals {
		if strings.Contains(lower, signal) {
			return true
		}
	}
	return false
}
