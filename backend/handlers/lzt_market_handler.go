package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

type LZTMarketHandler struct {
	client *services.LZTMarketClient

	cacheMu           sync.RWMutex
	cachedChatGPT     *services.LZTMarketResponse
	cachedChatGPTAt   time.Time
	cachedChatGPTI18n string
	cacheTTL          time.Duration

	ordersMu   sync.RWMutex
	orders     map[string]*publicMarketOrder
	userOrders map[uint][]string
}

func NewLZTMarketHandler(client *services.LZTMarketClient) *LZTMarketHandler {
	return &LZTMarketHandler{
		client:     client,
		cacheTTL:   30 * time.Second,
		orders:     make(map[string]*publicMarketOrder),
		userOrders: make(map[uint][]string),
	}
}

type lztProxyRequest struct {
	Method      string            `json:"method" binding:"required"`
	Path        string            `json:"path" binding:"required"`
	Query       map[string]string `json:"query"`
	ContentType string            `json:"content_type"`
	JSONBody    interface{}       `json:"json_body"`
	FormBody    map[string]string `json:"form_body"`
}

type createPublicMarketOrderRequest struct {
	ItemID string `json:"item_id" binding:"required"`
	I18n   string `json:"i18n"`
}

type publicMarketOrder struct {
	ID            string                 `json:"id"`
	UserID        uint                   `json:"-"`
	ItemID        string                 `json:"item_id"`
	Title         string                 `json:"title"`
	Price         string                 `json:"price"`
	Status        string                 `json:"status"`
	Seller        string                 `json:"seller"`
	FailureReason string                 `json:"failure_reason,omitempty"`
	Delivery      map[string]interface{} `json:"delivery,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

func (h *LZTMarketHandler) GetConfig(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"enabled": false,
			"error":   "LZT client not initialized",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled":                  h.client.IsEnabled(),
		"base_url":                 h.client.BaseURL(),
		"timeout_seconds":          int(h.client.Timeout().Seconds()),
		"min_interval_millis":      int(h.client.MinInterval().Milliseconds()),
		"token_configured":         h.client.IsEnabled(),
		"integration_instructions": "Gunakan endpoint POST /admin/integrations/lzt/request dari frontend/admin panel agar token tetap aman di backend.",
	})
}

func (h *LZTMarketHandler) ProxyRequest(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "LZT client not initialized"})
		return
	}

	var req lztProxyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request payload",
		})
		return
	}

	resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method:      req.Method,
		Path:        req.Path,
		Query:       req.Query,
		ContentType: req.ContentType,
		JSONBody:    req.JSONBody,
		FormBody:    req.FormBody,
	})
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upstream_status":  resp.StatusCode,
		"upstream_headers": resp.Headers,
		"json":             resp.JSON,
		"raw":              resp.Raw,
	})
}

// GetChatGPTAccounts fetches /chatgpt from LZT Market API via backend.
func (h *LZTMarketHandler) GetChatGPTAccounts(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "LZT client not initialized"})
		return
	}

	resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method: http.MethodGet,
		Path:   "/chatgpt",
		Query: map[string]string{
			"i18n": "en-US",
		},
	})
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upstream_status":  resp.StatusCode,
		"upstream_headers": resp.Headers,
		"json":             resp.JSON,
		"raw":              resp.Raw,
	})
}

// GetPublicChatGPTAccounts exposes public listing with cache + graceful stale fallback.
func (h *LZTMarketHandler) GetPublicChatGPTAccounts(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "LZT client not initialized"})
		return
	}

	i18n := strings.TrimSpace(c.Query("i18n"))
	if i18n == "" {
		i18n = "en-US"
	}
	forceRefresh := strings.EqualFold(strings.TrimSpace(c.Query("refresh")), "true")

	if !forceRefresh {
		if cached, ok := h.getCachedChatGPT(i18n); ok {
			c.JSON(http.StatusOK, gin.H{
				"cached":          true,
				"upstream_status": cached.StatusCode,
				"json":            cached.JSON,
				"raw":             cached.Raw,
			})
			return
		}
	}

	resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method: http.MethodGet,
		Path:   "/chatgpt",
		Query: map[string]string{
			"i18n": i18n,
		},
	})
	if err != nil {
		if cached, ok := h.getAnyCachedChatGPT(); ok {
			c.JSON(http.StatusOK, gin.H{
				"cached":          true,
				"stale":           true,
				"warning":         "Upstream unavailable, serving stale cache",
				"upstream_status": cached.StatusCode,
				"json":            cached.JSON,
				"raw":             cached.Raw,
			})
			return
		}

		status := http.StatusBadGateway
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	h.setCachedChatGPT(i18n, resp)

	c.JSON(http.StatusOK, gin.H{
		"cached":          false,
		"upstream_status": resp.StatusCode,
		"json":            resp.JSON,
		"raw":             resp.Raw,
	})
}

var itemIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)

// GetPublicChatGPTCheckout returns checkout URL for a selected item.
func (h *LZTMarketHandler) GetPublicChatGPTCheckout(c *gin.Context) {
	itemID := strings.TrimSpace(c.Param("itemId"))
	if !itemIDPattern.MatchString(itemID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"item_id":      itemID,
		"checkout_url": buildLZTItemURL(itemID),
		"note":         "Deprecated: gunakan endpoint POST /api/market/chatgpt/orders untuk checkout internal.",
	})
}

// CreatePublicChatGPTOrder creates and executes a direct buy using backend LZT token.
func (h *LZTMarketHandler) CreatePublicChatGPTOrder(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "LZT client not initialized"})
		return
	}

	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req createPublicMarketOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	itemID := strings.TrimSpace(req.ItemID)
	if !itemIDPattern.MatchString(itemID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}

	i18n := strings.TrimSpace(req.I18n)
	if i18n == "" {
		i18n = "en-US"
	}

	item, err := h.findChatGPTItem(c, itemID, i18n)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	if item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found in current listing"})
		return
	}

	now := time.Now()
	order := &publicMarketOrder{
		ID:        newPublicMarketOrderID(),
		UserID:    userID,
		ItemID:    itemID,
		Title:     normalizeItemTitle(item),
		Price:     normalizeItemPrice(item),
		Status:    "processing",
		Seller:    normalizeSeller(item),
		CreatedAt: now,
		UpdatedAt: now,
	}
	h.saveOrder(order)

	price := extractNumericPrice(item)
	if price <= 0 {
		h.markOrderFailed(order.ID, "Invalid item price from provider")
		detail, _ := h.getOrderForUser(order.ID, userID)
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Invalid item price from provider",
			"order": detail,
		})
		return
	}

	if !extractCanBuyItem(item) {
		h.markOrderFailed(order.ID, "Item cannot be purchased right now")
		detail, _ := h.getOrderForUser(order.ID, userID)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Item cannot be purchased right now",
			"order": detail,
		})
		return
	}

	resp, failureReason, buyErr := h.buyChatGPTItem(c, itemID, i18n, price)
	if buyErr != nil {
		h.markOrderFailed(order.ID, buyErr.Error())
		detail, _ := h.getOrderForUser(order.ID, userID)
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Failed to purchase item from provider",
			"order": detail,
		})
		return
	}

	if resp == nil || resp.StatusCode >= http.StatusBadRequest || !hasPurchasingPayload(resp) {
		if strings.TrimSpace(failureReason) == "" {
			failureReason = normalizeProviderFailureReason(resp, "Provider purchase failed")
		}
		h.markOrderFailed(order.ID, failureReason)
		detail, _ := h.getOrderForUser(order.ID, userID)
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "Provider purchase failed",
			"order": detail,
		})
		return
	}

	delivery := extractDeliveryPayload(resp)
	h.markOrderFulfilled(order.ID, delivery)
	detail, _ := h.getOrderForUser(order.ID, userID)

	c.JSON(http.StatusCreated, gin.H{
		"order": detail,
	})
}

// ListMyPublicChatGPTOrders returns user's own market orders.
func (h *LZTMarketHandler) ListMyPublicChatGPTOrders(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	h.ordersMu.RLock()
	defer h.ordersMu.RUnlock()

	ids := append([]string(nil), h.userOrders[userID]...)
	orders := make([]publicMarketOrder, 0, len(ids))
	for _, id := range ids {
		if order, ok := h.orders[id]; ok {
			orders = append(orders, order.toClientDTO(false))
		}
	}
	sort.SliceStable(orders, func(i, j int) bool {
		return orders[i].CreatedAt.After(orders[j].CreatedAt)
	})

	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
	})
}

// GetMyPublicChatGPTOrderDetail returns one order detail for the authenticated user.
func (h *LZTMarketHandler) GetMyPublicChatGPTOrderDetail(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	orderID := strings.TrimSpace(c.Param("orderId"))
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	order, ok := h.getOrderForUser(orderID, userID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order": order,
	})
}

func buildLZTItemURL(itemID string) string {
	template := strings.TrimSpace(os.Getenv("LZT_MARKET_ITEM_URL_TEMPLATE"))
	if template == "" {
		template = "https://lzt.market/%s"
	}
	if strings.Contains(template, "{item_id}") {
		return strings.ReplaceAll(template, "{item_id}", itemID)
	}
	return fmt.Sprintf(template, itemID)
}

func (h *LZTMarketHandler) buyChatGPTItem(c *gin.Context, itemID, i18n string, price float64) (*services.LZTMarketResponse, string, error) {
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
	checkPath := normalizeProviderPath(
		strings.TrimSpace(os.Getenv("LZT_MARKET_CHECK_PATH_TEMPLATE")),
		"/{item_id}/check-account",
		itemID,
	)
	confirmPath := normalizeProviderPath(
		strings.TrimSpace(os.Getenv("LZT_MARKET_CONFIRM_PATH_TEMPLATE")),
		"/{item_id}/confirm-buy",
		itemID,
	)

	var lastResp *services.LZTMarketResponse
	var lastErr error

	// 1) Fast-buy with retry_request handling.
	for attempt := 0; attempt < maxRetries; attempt++ {
		resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
			Method:      method,
			Path:        fastBuyPath,
			Query:       map[string]string{"i18n": i18n},
			ContentType: contentType,
			JSONBody: map[string]interface{}{
				"price": price,
			},
		})
		if err != nil {
			lastErr = err
			break
		}
		lastResp = resp
		if !isRetryRequestResponse(resp) {
			break
		}
	}

	if lastErr != nil {
		return nil, "Provider transport error", lastErr
	}
	if lastResp == nil {
		return nil, "Provider returned empty response", errors.New("provider buy request returned no response")
	}

	if isSuccessfulPurchaseResponse(lastResp) {
		return lastResp, "", nil
	}

	// 2) Fast-buy failed. Fallback only for non-hard-fail reasons.
	if !shouldFallbackAfterFastBuy(lastResp) {
		return lastResp, normalizeProviderFailureReason(lastResp, "Fast-buy failed"), nil
	}

	checkResp, checkErr := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method:      method,
		Path:        checkPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
	})
	if checkErr != nil {
		return lastResp, normalizeProviderFailureReason(lastResp, "Fast-buy failed and check-account unavailable"), nil
	}
	if isHardFailResponse(checkResp) {
		return checkResp, normalizeProviderFailureReason(checkResp, "Check-account rejected purchase"), nil
	}

	confirmResp, confirmErr := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method:      method,
		Path:        confirmPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
		JSONBody: map[string]interface{}{
			"price": price,
		},
	})
	if confirmErr != nil {
		return checkResp, "Confirm-buy transport error", confirmErr
	}

	if isSuccessfulPurchaseResponse(confirmResp) {
		return confirmResp, "", nil
	}

	return confirmResp, normalizeProviderFailureReason(confirmResp, "Confirm-buy failed"), nil
}

func (h *LZTMarketHandler) fetchChatGPTListing(c *gin.Context, i18n string) (*services.LZTMarketResponse, error) {
	if cached, ok := h.getCachedChatGPT(i18n); ok {
		return cached, nil
	}
	resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method: http.MethodGet,
		Path:   "/chatgpt",
		Query:  map[string]string{"i18n": i18n},
	})
	if err != nil {
		if cached, ok := h.getAnyCachedChatGPT(); ok {
			return cached, nil
		}
		return nil, err
	}
	h.setCachedChatGPT(i18n, resp)
	return resp, nil
}

func (h *LZTMarketHandler) findChatGPTItem(c *gin.Context, itemID, i18n string) (map[string]interface{}, error) {
	resp, err := h.fetchChatGPTListing(c, i18n)
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

func normalizeItemID(item map[string]interface{}) string {
	for _, key := range []string{"id", "item_id", "account_id"} {
		if v, ok := item[key]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" {
				return s
			}
		}
	}
	return ""
}

func normalizeItemTitle(item map[string]interface{}) string {
	for _, key := range []string{"title", "name", "account_title", "description"} {
		if v, ok := item[key]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" {
				return s
			}
		}
	}
	return "ChatGPT Account"
}

func normalizeItemPrice(item map[string]interface{}) string {
	for _, key := range []string{"price", "amount", "cost"} {
		if v, ok := item[key]; ok {
			switch n := v.(type) {
			case float64:
				return strconv.FormatFloat(n, 'f', -1, 64)
			case float32:
				return strconv.FormatFloat(float64(n), 'f', -1, 64)
			default:
				s := strings.TrimSpace(fmt.Sprintf("%v", v))
				if s != "" {
					return s
				}
			}
		}
	}
	return "-"
}

func extractNumericPrice(item map[string]interface{}) float64 {
	for _, key := range []string{"price", "priceWithSellerFee", "rub_price", "amount", "cost"} {
		v, ok := item[key]
		if !ok || v == nil {
			continue
		}
		switch n := v.(type) {
		case float64:
			if n > 0 {
				return n
			}
		case float32:
			if n > 0 {
				return float64(n)
			}
		case int:
			if n > 0 {
				return float64(n)
			}
		case int32:
			if n > 0 {
				return float64(n)
			}
		case int64:
			if n > 0 {
				return float64(n)
			}
		case string:
			value := strings.TrimSpace(n)
			if value == "" {
				continue
			}
			parsed, err := strconv.ParseFloat(value, 64)
			if err == nil && parsed > 0 {
				return parsed
			}
		}
	}
	return 0
}

func normalizeItemState(item map[string]interface{}) string {
	for _, key := range []string{"item_state", "status", "state", "availability"} {
		if v, ok := item[key]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" {
				return s
			}
		}
	}
	return "-"
}

func normalizeSeller(item map[string]interface{}) string {
	for _, key := range []string{"seller_name", "seller", "owner"} {
		v, ok := item[key]
		if !ok || v == nil {
			continue
		}
		switch s := v.(type) {
		case string:
			if strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		case map[string]interface{}:
			for _, nested := range []string{"username", "title", "name", "id"} {
				if nv, ok := s[nested]; ok {
					ns := strings.TrimSpace(fmt.Sprintf("%v", nv))
					if ns != "" {
						return ns
					}
				}
			}
		default:
			candidate := strings.TrimSpace(fmt.Sprintf("%v", v))
			if candidate != "" {
				return candidate
			}
		}
	}
	return "-"
}

func extractCanBuyItem(item map[string]interface{}) bool {
	v, ok := item["canBuyItem"]
	if !ok || v == nil {
		return true
	}
	switch b := v.(type) {
	case bool:
		return b
	case string:
		return strings.EqualFold(strings.TrimSpace(b), "true") || strings.TrimSpace(b) == "1"
	case float64:
		return b > 0
	case int:
		return b > 0
	default:
		return true
	}
}

func extractListMaps(payload interface{}) []map[string]interface{} {
	candidates := []interface{}{payload}
	if root, ok := payload.(map[string]interface{}); ok {
		candidates = append(candidates,
			root["items"],
			root["accounts"],
			root["data"],
			root["result"],
			root["chatgpt"],
			root["rows"],
			root["list"],
		)
	}

	for _, candidate := range candidates {
		if rows, ok := candidate.([]interface{}); ok {
			out := make([]map[string]interface{}, 0, len(rows))
			for _, row := range rows {
				if m, ok := row.(map[string]interface{}); ok {
					out = append(out, m)
				}
			}
			if len(out) > 0 {
				return out
			}
		}
		if m, ok := candidate.(map[string]interface{}); ok {
			if rows, ok := m["items"].([]interface{}); ok {
				out := make([]map[string]interface{}, 0, len(rows))
				for _, row := range rows {
					if item, ok := row.(map[string]interface{}); ok {
						out = append(out, item)
					}
				}
				if len(out) > 0 {
					return out
				}
			}
		}
	}
	return []map[string]interface{}{}
}

func (h *LZTMarketHandler) saveOrder(order *publicMarketOrder) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	h.orders[order.ID] = order
	h.userOrders[order.UserID] = append(h.userOrders[order.UserID], order.ID)
}

func (h *LZTMarketHandler) markOrderFailed(orderID, reason string) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	order, ok := h.orders[orderID]
	if !ok {
		return
	}
	order.Status = "failed"
	order.FailureReason = strings.TrimSpace(reason)
	order.UpdatedAt = time.Now()
}

func (h *LZTMarketHandler) markOrderFulfilled(orderID string, delivery map[string]interface{}) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	order, ok := h.orders[orderID]
	if !ok {
		return
	}
	order.Status = "fulfilled"
	order.FailureReason = ""
	order.Delivery = delivery
	order.UpdatedAt = time.Now()
}

func (h *LZTMarketHandler) getOrderForUser(orderID string, userID uint) (publicMarketOrder, bool) {
	h.ordersMu.RLock()
	defer h.ordersMu.RUnlock()
	order, ok := h.orders[orderID]
	if !ok || order.UserID != userID {
		return publicMarketOrder{}, false
	}
	return order.toClientDTO(true), true
}

func (o *publicMarketOrder) toClientDTO(withDelivery bool) publicMarketOrder {
	copy := *o
	if !withDelivery {
		copy.Delivery = nil
	}
	return copy
}

func extractDeliveryPayload(resp *services.LZTMarketResponse) map[string]interface{} {
	payload := map[string]interface{}{
		"provider_status": resp.StatusCode,
	}
	if resp.JSON != nil {
		if extracted := extractCredentialsFromBuyResponse(resp.JSON); len(extracted) > 0 {
			payload["credentials"] = extracted
		}
		if summary := extractPurchasedItemSummary(resp.JSON); len(summary) > 0 {
			payload["item"] = summary
		}
		payload["provider_response"] = resp.JSON
	}
	if strings.TrimSpace(resp.Raw) != "" {
		payload["provider_raw"] = resp.Raw
	}
	return payload
}

func extractCredentialsFromBuyResponse(jsonPayload interface{}) map[string]interface{} {
	root, ok := jsonPayload.(map[string]interface{})
	if !ok {
		return nil
	}

	item := readMap(root, "item")
	if len(item) == 0 {
		return nil
	}

	out := map[string]interface{}{}
	login := readMap(item, "loginData")
	if len(login) > 0 {
		out["account_login"] = firstNonEmptyString(login, "login")
		out["account_password"] = firstNonEmptyString(login, "password")
		out["account_raw"] = firstNonEmptyString(login, "raw")
	}

	email := readMap(item, "emailLoginData")
	if len(email) > 0 {
		out["email_login"] = firstNonEmptyString(email, "login")
		out["email_password"] = firstNonEmptyString(email, "password")
		out["email_raw"] = firstNonEmptyString(email, "raw")
	}

	for key, value := range out {
		if strings.TrimSpace(fmt.Sprintf("%v", value)) == "" {
			delete(out, key)
		}
	}
	return out
}

func extractPurchasedItemSummary(jsonPayload interface{}) map[string]interface{} {
	root, ok := jsonPayload.(map[string]interface{})
	if !ok {
		return nil
	}
	item := readMap(root, "item")
	if len(item) == 0 {
		return nil
	}

	summary := map[string]interface{}{
		"item_id":      firstNonEmptyString(item, "item_id"),
		"title":        firstNonEmptyString(item, "title"),
		"item_state":   firstNonEmptyString(item, "item_state"),
		"price":        firstNonEmptyString(item, "price", "priceWithSellerFee"),
		"email_domain": firstNonEmptyString(item, "item_domain"),
	}
	for key, value := range summary {
		if strings.TrimSpace(fmt.Sprintf("%v", value)) == "" {
			delete(summary, key)
		}
	}
	return summary
}

func readMap(parent map[string]interface{}, key string) map[string]interface{} {
	raw, ok := parent[key]
	if !ok || raw == nil {
		return nil
	}
	child, ok := raw.(map[string]interface{})
	if !ok {
		return nil
	}
	return child
}

func firstNonEmptyString(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		raw, ok := m[key]
		if !ok || raw == nil {
			continue
		}
		value := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if value != "" {
			return value
		}
	}
	return ""
}

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
	return hasPurchasingPayload(resp)
}

func hasPurchasingPayload(resp *services.LZTMarketResponse) bool {
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || resp.JSON == nil {
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
	if resp.StatusCode >= http.StatusInternalServerError {
		return true
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return true
	}
	return !hasPurchasingPayload(resp)
}

func isHardFailResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return false
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound {
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

func extractProviderErrors(resp *services.LZTMarketResponse) []string {
	if resp == nil || resp.JSON == nil {
		return nil
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return nil
	}

	rawErrors, ok := root["errors"]
	if !ok || rawErrors == nil {
		return nil
	}
	rows, ok := rawErrors.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(rows))
	for _, row := range rows {
		msg := strings.TrimSpace(fmt.Sprintf("%v", row))
		if msg != "" {
			out = append(out, msg)
		}
	}
	return out
}

func hasStatusValue(resp *services.LZTMarketResponse, wanted string) bool {
	if resp == nil || resp.JSON == nil {
		return false
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return false
	}
	value := strings.TrimSpace(fmt.Sprintf("%v", root["status"]))
	if value == "" {
		return false
	}
	return strings.EqualFold(value, wanted)
}

func normalizeProviderPath(pathTemplate, fallbackTemplate, itemID string) string {
	template := strings.TrimSpace(pathTemplate)
	if template == "" {
		template = fallbackTemplate
	}
	path := strings.ReplaceAll(template, "{item_id}", itemID)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return path
}

func newPublicMarketOrderID() string {
	buf := make([]byte, 10)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("ord_%d", time.Now().UnixNano())
	}
	return "ord_" + hex.EncodeToString(buf)
}

func readPositiveIntEnvLocal(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
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
	return h.cachedChatGPT, true
}

func (h *LZTMarketHandler) getAnyCachedChatGPT() (*services.LZTMarketResponse, bool) {
	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()
	if h.cachedChatGPT == nil {
		return nil, false
	}
	return h.cachedChatGPT, true
}

func (h *LZTMarketHandler) setCachedChatGPT(i18n string, resp *services.LZTMarketResponse) {
	h.cacheMu.Lock()
	defer h.cacheMu.Unlock()
	h.cachedChatGPT = resp
	h.cachedChatGPTAt = time.Now()
	h.cachedChatGPTI18n = i18n
}
