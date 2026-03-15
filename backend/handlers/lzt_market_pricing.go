package handlers

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"

	"backend-gin/services"
)

// computePmaxForProvider calculates the provider-side max price (in provider
// currency, typically RUB) that corresponds to the configured max display price
// in IDR. This allows the provider API to pre-filter expensive accounts.
//
// Formula: pmax = floor(maxDisplayIDR × priceFactor / fxRate)
func (h *LZTMarketHandler) computePmaxForProvider() (int, error) {
	if h.fxRates == nil {
		return 0, fmt.Errorf("fx service not configured")
	}

	maxDisplayIDR := readPositiveIntEnvLocal("MARKET_MAX_DISPLAY_PRICE_IDR", 50000)

	priceFactor := 0.80
	if raw := strings.TrimSpace(os.Getenv("MARKET_PRICE_FACTOR")); raw != "" {
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil && parsed > 0 {
			priceFactor = parsed
		}
	}

	// Get current FX rate (provider currency → IDR). Default source = RUB.
	_, fxRate, err := h.fxRates.ConvertToIDR(1, "RUB")
	if err != nil {
		return 0, fmt.Errorf("fx rate unavailable: %w", err)
	}
	if fxRate <= 0 {
		return 0, fmt.Errorf("invalid fx rate: %f", fxRate)
	}

	pmax := int(math.Floor(float64(maxDisplayIDR) * priceFactor / fxRate))
	if pmax <= 0 {
		return 0, fmt.Errorf("computed pmax is zero (display=%d, factor=%.2f, fx=%.2f)", maxDisplayIDR, priceFactor, fxRate)
	}

	return pmax, nil
}

func (h *LZTMarketHandler) extractSourcePriceAndCurrency(item map[string]interface{}) (float64, string, string) {
	price := extractNumericPrice(item)
	currency := strings.ToUpper(strings.TrimSpace(fmt.Sprintf("%v", item["price_currency"])))
	if currency == "" || currency == "<nil>" {
		currency = strings.ToUpper(strings.TrimSpace(fmt.Sprintf("%v", item["currency"])))
	}
	if currency == "" || currency == "<nil>" {
		currency = "RUB"
	}
	return price, currency, currencySymbol(currency)
}

func (h *LZTMarketHandler) computeIDRPrice(sourcePrice float64, sourceCurrency string) (int64, float64, error) {
	if h.fxRates == nil {
		return 0, 0, fmt.Errorf("fx service is not configured")
	}
	baseIDR, fxRate, err := h.fxRates.ConvertToIDR(sourcePrice, sourceCurrency)
	if err != nil {
		return 0, 0, err
	}
	finalIDR := applyPriceFactor(baseIDR)
	return finalIDR, fxRate, nil
}

func (h *LZTMarketHandler) withDisplayPricing(payload interface{}) interface{} {
	root, ok := payload.(map[string]interface{})
	if !ok {
		return payload
	}

	items := extractListMaps(root)
	for _, item := range items {
		sourcePrice, sourceCurrency, sourceSymbol := h.extractSourcePriceAndCurrency(item)
		if sourcePrice <= 0 {
			continue
		}
		priceIDR, fxRate, err := h.computeIDRPrice(sourcePrice, sourceCurrency)
		if err != nil {
			continue
		}

		item["display_price_source"] = formatSourcePrice(sourcePrice, sourceSymbol, sourceCurrency)
		item["display_price_idr"] = formatIDR(priceIDR)
		item["price_idr"] = priceIDR
		item["price_source_currency"] = sourceCurrency
		item["price_source_symbol"] = sourceSymbol
		item["fx_rate_to_idr"] = fxRate
		item["pricing_note"] = "Harga sumber real-time dikonversi ke IDR lalu disesuaikan faktor platform"
	}
	return root
}

func (h *LZTMarketHandler) checkSupplierBalance(ctx context.Context, needed float64) supplierBalanceCheckResult {
	if needed <= 0 {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: "invalid needed amount"}
	}

	resp, err := h.client.Do(ctx, services.LZTMarketRequest{
		Method: http.MethodGet,
		Path:   "/me",
		Query:  map[string]string{"fields_include": "*"},
	})
	if err != nil {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: err.Error()}
	}
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || resp.JSON == nil {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: normalizeProviderFailureReason(resp, "supplier balance check failed")}
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: "provider profile response invalid"}
	}

	userMap, ok := root["user"].(map[string]interface{})
	if !ok {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: "provider profile user payload missing"}
	}

	balance, hasBalance := extractSupplierBalanceFromProfile(userMap)
	result := evaluateSupplierBalance(needed, balance, hasBalance)
	if result.State == supplierBalanceStateUnknown && strings.TrimSpace(result.Reason) == "" {
		result.Reason = "supplier balance is unavailable"
	}
	return result
}

func (h *LZTMarketHandler) checkAccountItem(ctx context.Context, itemID, i18n string) (map[string]interface{}, error) {
	method := strings.ToUpper(strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_METHOD")))
	if method == "" {
		method = http.MethodPost
	}
	contentType := strings.ToLower(strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_CONTENT_TYPE")))
	if contentType == "" {
		contentType = "json"
	}

	maxRetries := readPositiveIntEnvLocal("LZT_MARKET_CHECK_MAX_RETRIES", 8)
	if maxRetries < 1 {
		maxRetries = 1
	}

	checkPath := normalizeProviderPath(
		strings.TrimSpace(os.Getenv("LZT_MARKET_CHECK_PATH_TEMPLATE")),
		"/{item_id}/check-account",
		itemID,
	)

	resp, err, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        checkPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
	}, maxRetries)
	if err != nil {
		return nil, err
	}
	if isRetryRequestResponse(resp) {
		return nil, errors.New("retry_request")
	}
	if resp == nil || resp.StatusCode >= http.StatusBadRequest {
		return nil, errors.New(normalizeProviderFailureReason(resp, "Provider check-account failed"))
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("Provider response invalid")
	}
	item := readMap(root, "item")
	if len(item) == 0 {
		return nil, fmt.Errorf("Item not found in provider response")
	}
	return item, nil
}

func (h *LZTMarketHandler) getProviderItemReadiness(ctx context.Context, itemID string) (*providerItemReadiness, error) {
	maxRetries := readPositiveIntEnvLocal("LZT_MARKET_ITEM_DETAIL_MAX_RETRIES", 2)
	if maxRetries < 1 {
		maxRetries = 1
	}

	itemPath := normalizeProviderPath(
		strings.TrimSpace(os.Getenv("LZT_MARKET_ITEM_PATH_TEMPLATE")),
		"/{item_id}",
		itemID,
	)

	resp, err, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method: http.MethodGet,
		Path:   itemPath,
		Query:  map[string]string{"parse_same_item_ids": "0"},
	}, maxRetries)
	if err != nil {
		return nil, err
	}
	if isRetryRequestResponse(resp) {
		return nil, errors.New("retry_request")
	}
	if resp == nil || resp.StatusCode >= http.StatusBadRequest {
		return nil, errors.New(normalizeProviderFailureReason(resp, "Provider item detail failed"))
	}

	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return nil, errors.New("Provider item detail response invalid")
	}

	item := readMap(root, "item")
	if len(item) == 0 {
		return nil, errors.New("Item not found in provider response")
	}

	canBuy := extractCanBuyItem(root) && extractCanBuyItem(item)
	cannotBuyReason := extractCannotBuyItemError(root)
	if cannotBuyReason == "" {
		cannotBuyReason = extractCannotBuyItemError(item)
	}

	return &providerItemReadiness{
		Item:            item,
		CanBuy:          canBuy,
		CannotBuyReason: strings.TrimSpace(cannotBuyReason),
	}, nil
}
