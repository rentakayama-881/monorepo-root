package handlers

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
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

	// Serve stale cache instead of blocking on a slow provider fetch.
	// Background refresh goroutine will update the cache asynchronously.
	if cached, ok := h.getAnyCachedChatGPT(); ok {
		return cached, true, true, nil
	}

	// No cache at all (cold start) — must fetch synchronously.
	resp, err := h.refreshChatGPTListing(ctx, i18n)
	if err == nil {
		return resp, false, false, nil
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

	// Compute pmax to filter expensive accounts at the provider level.
	pmax, pmaxErr := h.computePmaxForProvider()
	if pmaxErr != nil {
		// Non-fatal: fetch without price filter if FX rate unavailable.
		pmax = 0
	}

	firstResp, err := h.fetchChatGPTListingPage(ctx, i18n, 1, pmax)
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

	// Calculate expected pages dynamically — no hardcoded caps.
	// The loop below stops naturally when: hasNextPage=false, empty items, or all duplicates.
	maxPages := 200
	if hasTotalItems && hasPerPage && perPage > 0 {
		maxPages = int(math.Ceil(float64(totalItems) / float64(perPage)))
	}

	firstItems := extractListMaps(root)
	if len(firstItems) == 0 {
		merged := cloneStringAnyMap(root)
		merged["total_items"] = len(firstItems)
		merged["loaded_items"] = len(firstItems)
		merged["provider_total_items"] = totalItems
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
	consecutiveFailures := 0
	const maxConsecutiveFailures = 3

	for page := 2; page <= maxPages; page++ {
		if hasHasNextPage && !hasNextPage {
			break
		}

		resp, pageErr := h.fetchChatGPTPageWithRetry(ctx, i18n, page, pmax)
		if pageErr != nil || resp == nil {
			consecutiveFailures++
			if consecutiveFailures >= maxConsecutiveFailures {
				break
			}
			continue
		}

		// Check for non-OK status (429, 5xx) — treat as transient failure.
		if resp.StatusCode >= 400 {
			consecutiveFailures++
			if consecutiveFailures >= maxConsecutiveFailures {
				break
			}
			continue
		}

		items := extractListMaps(resp.JSON)
		if len(items) == 0 {
			consecutiveFailures++
			if consecutiveFailures >= maxConsecutiveFailures {
				break
			}
			continue
		}
		consecutiveFailures = 0
		added := addItems(items, page)
		if added == 0 {
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
	merged["provider_total_items"] = totalItems
	merged["aggregated_pages"] = fetchedPages
	if hasTotalItems {
		merged["totalItems"] = totalItems
	}
	if hasPerPage {
		merged["perPage"] = perPage
	}
	if hasHasNextPage {
		merged["hasNextPage"] = false
	}
	firstResp.JSON = merged
	return firstResp, nil
}

func (h *LZTMarketHandler) fetchChatGPTPageWithRetry(ctx context.Context, i18n string, page int, pmax int) (*services.LZTMarketResponse, error) {
	resp, err := h.fetchChatGPTListingPage(ctx, i18n, page, pmax)
	if err == nil && resp != nil && resp.StatusCode < 400 {
		return resp, nil
	}
	// Retry once after delay
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(3 * time.Second):
	}
	return h.fetchChatGPTListingPage(ctx, i18n, page, pmax)
}

func (h *LZTMarketHandler) fetchChatGPTListingPage(ctx context.Context, i18n string, page int, pmax int) (*services.LZTMarketResponse, error) {
	if page < 1 {
		page = 1
	}
	query := map[string]string{
		"i18n": i18n,
		"page": strconv.Itoa(page),
	}
	if pmax > 0 {
		query["pmax"] = strconv.Itoa(pmax)
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
