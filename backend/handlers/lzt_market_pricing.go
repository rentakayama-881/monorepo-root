package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"backend-gin/services"
)

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
