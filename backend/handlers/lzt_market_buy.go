package handlers

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"

	"backend-gin/services"
)

func (h *LZTMarketHandler) buyChatGPTItem(ctx context.Context, itemID, i18n string, price float64) (*services.LZTMarketResponse, string, error) {
	method := strings.ToUpper(strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_METHOD")))
	if method == "" {
		method = http.MethodPost
	}

	contentType := strings.ToLower(strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_CONTENT_TYPE")))
	if contentType == "" {
		contentType = "json"
	}

	maxRetries := readPositiveIntEnvLocal("LZT_MARKET_BUY_MAX_RETRIES", 100)
	if maxRetries < 1 {
		maxRetries = 1
	}

	fastBuyPath := normalizeProviderPath(
		strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_PATH_TEMPLATE")),
		"/{item_id}/fast-buy",
		itemID,
	)

	fastBuyResp, fastBuyErr, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        fastBuyPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
		JSONBody: map[string]interface{}{
			"price": price,
		},
	}, maxRetries)
	if fastBuyErr != nil {
		return nil, "Provider transport error", fastBuyErr
	}
	if fastBuyResp == nil {
		return nil, "Provider returned empty response", errors.New("provider buy request returned no response")
	}
	if isSuccessfulPurchaseResponse(fastBuyResp) {
		return fastBuyResp, "", nil
	}

	fastBuyFailureReason := normalizeProviderFailureReason(fastBuyResp, "Fast-buy failed")
	if !readBoolEnvLocal("LZT_MARKET_BUY_ALLOW_CONFIRM_FALLBACK", false) {
		return fastBuyResp, fastBuyFailureReason, nil
	}
	if !shouldTryConfirmBuyFallback(fastBuyResp, fastBuyFailureReason) {
		return fastBuyResp, fastBuyFailureReason, nil
	}

	confirmPathTemplate := strings.TrimSpace(os.Getenv("LZT_MARKET_CONFIRM_PATH_TEMPLATE"))
	if confirmPathTemplate == "" {
		confirmPathTemplate = strings.TrimSpace(os.Getenv("LZT_MARKET_CONFIRM_BUY_PATH_TEMPLATE"))
	}
	confirmBuyPath := normalizeProviderPath(confirmPathTemplate, "/{item_id}/confirm-buy", itemID)
	confirmBuyResp, confirmBuyErr, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        confirmBuyPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
		JSONBody: map[string]interface{}{
			"price": toProviderConfirmPrice(price),
		},
	}, maxRetries)
	if confirmBuyErr != nil {
		return nil, "Provider transport error", confirmBuyErr
	}
	if confirmBuyResp == nil {
		return nil, "Provider returned empty response", errors.New("provider confirm-buy request returned no response")
	}
	if isSuccessfulPurchaseResponse(confirmBuyResp) {
		return confirmBuyResp, "", nil
	}

	confirmBuyFailureReason := normalizeProviderFailureReason(confirmBuyResp, "Confirm-buy failed")
	if strings.TrimSpace(confirmBuyFailureReason) == "" {
		return confirmBuyResp, fastBuyFailureReason, nil
	}
	if strings.EqualFold(strings.TrimSpace(confirmBuyFailureReason), strings.TrimSpace(fastBuyFailureReason)) {
		return confirmBuyResp, confirmBuyFailureReason, nil
	}
	return confirmBuyResp, strings.TrimSpace(fastBuyFailureReason + " | " + confirmBuyFailureReason), nil
}

func (h *LZTMarketHandler) doProviderRequestWithRetry(
	ctx context.Context,
	req services.LZTMarketRequest,
	maxRetries int,
) (*services.LZTMarketResponse, error, int) {
	if maxRetries < 1 {
		maxRetries = 1
	}

	var retries int
	var lastResp *services.LZTMarketResponse
	for attempt := 0; attempt < maxRetries; attempt++ {
		resp, err := h.client.Do(ctx, req)
		if err != nil {
			return lastResp, err, retries
		}
		lastResp = resp
		if !isRetryRequestResponse(resp) {
			return resp, nil, retries
		}
		retries++
	}
	return lastResp, nil, retries
}
