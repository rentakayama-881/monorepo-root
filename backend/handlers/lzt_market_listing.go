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
	"time"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

func (h *LZTMarketHandler) fetchChatGPTListing(c *gin.Context, i18n string, forceRefresh bool) (*services.LZTMarketResponse, error) {
	resp, _, _, err := h.loadChatGPTListing(c.Request.Context(), i18n, forceRefresh)
	return resp, err
}

func (h *LZTMarketHandler) loadChatGPTListing(ctx context.Context, i18n string, forceRefresh bool) (*services.LZTMarketResponse, bool, bool, error) {
	if !forceRefresh {
		if cached, ok := h.getCachedChatGPT(i18n); ok {
			return cached, true, false, nil
		}
	}

	resp, err := h.refreshChatGPTListing(ctx, i18n)
	if err == nil {
		return resp, false, false, nil
	}

	if cached, ok := h.getCachedChatGPT(i18n); ok {
		return cached, true, true, nil
	}
	if cached, ok := h.getAnyCachedChatGPT(); ok {
		return cached, true, true, nil
	}
	return nil, false, false, err
}

func (h *LZTMarketHandler) refreshChatGPTListing(ctx context.Context, i18n string) (*services.LZTMarketResponse, error) {
	flight, waitForExisting := h.startChatGPTListingFlight(i18n)
	if waitForExisting {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-flight.done:
			return cloneLZTMarketResponse(flight.resp), flight.err
		}
	}

	resp, err := h.fetchAggregatedChatGPTListing(ctx, i18n)
	if err == nil {
		h.setCachedChatGPT(i18n, resp)
	}
	h.finishChatGPTListingFlight(i18n, flight, resp, err)
	return cloneLZTMarketResponse(resp), err
}

func (h *LZTMarketHandler) startChatGPTListingFlight(i18n string) (*chatGPTListingFlight, bool) {
	h.listingFlightMu.Lock()
	defer h.listingFlightMu.Unlock()

	if h.listingFlights == nil {
		h.listingFlights = make(map[string]*chatGPTListingFlight)
	}
	if flight, ok := h.listingFlights[i18n]; ok {
		return flight, true
	}

	flight := &chatGPTListingFlight{done: make(chan struct{})}
	h.listingFlights[i18n] = flight
	return flight, false
}

func (h *LZTMarketHandler) finishChatGPTListingFlight(i18n string, flight *chatGPTListingFlight, resp *services.LZTMarketResponse, err error) {
	h.listingFlightMu.Lock()
	defer h.listingFlightMu.Unlock()

	if flight == nil {
		return
	}
	flight.resp = cloneLZTMarketResponse(resp)
	flight.err = err
	close(flight.done)
	delete(h.listingFlights, i18n)
}

func (h *LZTMarketHandler) fetchAggregatedChatGPTListing(ctx context.Context, i18n string) (*services.LZTMarketResponse, error) {
	if h == nil || h.client == nil {
		return nil, fmt.Errorf("%w: LZT client not initialized", services.ErrLZTRequestInvalid)
	}

	// Keep provider usage conservative because /chatgpt is a category search endpoint.
	maxPages := readPositiveIntEnvLocal("MARKET_CHATGPT_MAX_PAGES", 3)
	hardCapPages := readPositiveIntEnvLocal("MARKET_CHATGPT_HARD_CAP_PAGES", 6)
	if hardCapPages < 1 {
		hardCapPages = 6
	}
	if maxPages < 1 {
		maxPages = 1
	}
	if maxPages > hardCapPages {
		maxPages = hardCapPages
	}

	firstResp, err := h.fetchChatGPTListingPage(ctx, i18n, 1)
	if err != nil {
		return nil, err
	}
	if firstResp == nil {
		return nil, errors.New("chatgpt listing response is empty")
	}

	root, ok := firstResp.JSON.(map[string]interface{})
	if !ok {
		return firstResp, nil
	}

	totalItems, hasTotalItems := extractPositiveIntFromMap(root, "totalItems", "total_items")
	perPage, hasPerPage := extractPositiveIntFromMap(root, "perPage", "per_page")
	hasNextPage, hasHasNextPage := extractBoolFromMap(root, "hasNextPage", "has_next_page")
	if hasTotalItems && hasPerPage && perPage > 0 {
		expectedPages := int(math.Ceil(float64(totalItems) / float64(perPage)))
		if expectedPages > maxPages {
			if expectedPages > hardCapPages {
				maxPages = hardCapPages
			} else {
				maxPages = expectedPages
			}
		}
	}

	firstItems := extractListMaps(root)
	if len(firstItems) == 0 || maxPages == 1 {
		merged := cloneStringAnyMap(root)
		merged["total_items"] = len(firstItems)
		merged["loaded_items"] = len(firstItems)
		merged["aggregated_pages"] = 1
		firstResp.JSON = merged
		return firstResp, nil
	}

	aggregatedItems := make([]interface{}, 0, len(firstItems))
	seen := make(map[string]struct{}, len(firstItems))
	addItems := func(items []map[string]interface{}, page int) int {
		added := 0
		for idx, item := range items {
			key := normalizeItemID(item)
			if key == "" {
				key = fmt.Sprintf("page:%d:idx:%d:%v", page, idx, item)
			}
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			aggregatedItems = append(aggregatedItems, item)
			added++
		}
		return added
	}

	firstPageCount := len(firstItems)
	_ = addItems(firstItems, 1)
	fetchedPages := 1
	for page := 2; page <= maxPages; page++ {
		if hasHasNextPage && !hasNextPage {
			break
		}

		resp, pageErr := h.fetchChatGPTListingPage(ctx, i18n, page)
		if pageErr != nil || resp == nil {
			break
		}
		items := extractListMaps(resp.JSON)
		if len(items) == 0 {
			break
		}
		added := addItems(items, page)
		if added == 0 {
			// The provider likely ignores page params or repeated the same rows.
			break
		}
		fetchedPages = page

		if pageRoot, ok := resp.JSON.(map[string]interface{}); ok {
			if nextFlag, ok := extractBoolFromMap(pageRoot, "hasNextPage", "has_next_page"); ok {
				hasHasNextPage = true
				hasNextPage = nextFlag
			}
			if !hasTotalItems {
				if nextTotal, ok := extractPositiveIntFromMap(pageRoot, "totalItems", "total_items"); ok {
					totalItems = nextTotal
					hasTotalItems = true
				}
			}
			if !hasPerPage {
				if nextPerPage, ok := extractPositiveIntFromMap(pageRoot, "perPage", "per_page"); ok {
					perPage = nextPerPage
					hasPerPage = true
				}
			}
		}
		if hasHasNextPage {
			if !hasNextPage {
				break
			}
			continue
		}

		if len(items) < firstPageCount {
			break
		}
	}

	merged := cloneStringAnyMap(root)
	merged["items"] = aggregatedItems
	merged["total_items"] = len(aggregatedItems)
	merged["loaded_items"] = len(aggregatedItems)
	merged["aggregated_pages"] = fetchedPages
	if hasTotalItems {
		merged["totalItems"] = totalItems
	}
	if hasPerPage {
		merged["perPage"] = perPage
	}
	if hasHasNextPage {
		merged["hasNextPage"] = hasNextPage && fetchedPages < maxPages
	}
	firstResp.JSON = merged
	return firstResp, nil
}

func (h *LZTMarketHandler) fetchChatGPTListingPage(ctx context.Context, i18n string, page int) (*services.LZTMarketResponse, error) {
	if page < 1 {
		page = 1
	}
	query := map[string]string{
		"i18n": i18n,
		"page": strconv.Itoa(page),
	}
	return h.client.Do(ctx, services.LZTMarketRequest{
		Method:         http.MethodGet,
		Path:           "/chatgpt",
		Query:          query,
		RateLimitClass: services.LZTRateLimitClassSearch,
	})
}

func (h *LZTMarketHandler) findChatGPTItem(c *gin.Context, itemID, i18n string, forceRefresh bool) (map[string]interface{}, error) {
	resp, err := h.fetchChatGPTListing(c, i18n, forceRefresh)
	if err != nil {
		return nil, err
	}
	items := extractListMaps(resp.JSON)
	for _, item := range items {
		id := normalizeItemID(item)
		if id == itemID {
			return item, nil
		}
	}
	return nil, nil
}

func (h *LZTMarketHandler) resolveOrderItemForCheckout(c *gin.Context, itemID, i18n string) (map[string]interface{}, string, error) {
	listingItem, listingErr := h.findChatGPTItem(c, itemID, i18n, true)
	if listingErr == nil && listingItem != nil {
		return listingItem, "listing", nil
	}

	// Provider item detail endpoint includes canBuyItem/cannotBuyItemError.
	itemReadiness, itemReadinessErr := h.getProviderItemReadiness(c.Request.Context(), itemID)
	if itemReadinessErr == nil && itemReadiness != nil {
		if !itemReadiness.CanBuy {
			reason := strings.TrimSpace(itemReadiness.CannotBuyReason)
			if reason == "" {
				reason = "This account is currently unavailable."
			}
			return nil, "item_detail", errors.New(reason)
		}
		if len(itemReadiness.Item) > 0 {
			return itemReadiness.Item, "item_detail", nil
		}
	}

	checkItem, checkErr := h.checkAccountItem(c.Request.Context(), itemID, i18n)
	if checkErr == nil && checkItem != nil {
		return checkItem, "check_account", nil
	}

	joinErrors := make([]error, 0, 3)
	if listingErr != nil {
		joinErrors = append(joinErrors, fmt.Errorf("listing lookup failed: %w", listingErr))
	}
	if itemReadinessErr != nil {
		joinErrors = append(joinErrors, fmt.Errorf("item detail lookup failed: %w", itemReadinessErr))
	}
	if checkErr != nil {
		joinErrors = append(joinErrors, fmt.Errorf("check-account failed: %w", checkErr))
	}
	if len(joinErrors) > 0 {
		return nil, "", errors.Join(joinErrors...)
	}
	return nil, "", nil
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

func (h *LZTMarketHandler) getCachedChatGPT(i18n string) (*services.LZTMarketResponse, bool) {
	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()
	if h.cachedChatGPT == nil {
		return nil, false
	}
	if !h.cachedChatGPTAt.IsZero() && time.Since(h.cachedChatGPTAt) > h.cacheTTL {
		return nil, false
	}
	if h.cachedChatGPTI18n != i18n {
		return nil, false
	}
	return cloneLZTMarketResponse(h.cachedChatGPT), true
}

func (h *LZTMarketHandler) getAnyCachedChatGPT() (*services.LZTMarketResponse, bool) {
	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()
	if h.cachedChatGPT == nil {
		return nil, false
	}
	return cloneLZTMarketResponse(h.cachedChatGPT), true
}

func (h *LZTMarketHandler) setCachedChatGPT(i18n string, resp *services.LZTMarketResponse) {
	h.cacheMu.Lock()
	defer h.cacheMu.Unlock()
	h.cachedChatGPT = cloneLZTMarketResponse(resp)
	h.cachedChatGPTAt = time.Now()
	h.cachedChatGPTI18n = i18n
}
