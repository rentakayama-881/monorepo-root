package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
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
	client        *services.LZTMarketClient
	featureWallet *services.FeatureWalletClient
	fxRates       *services.FXRateService

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
	cacheSeconds := readPositiveIntEnvLocal("MARKET_CHATGPT_CACHE_SECONDS", 8)
	return &LZTMarketHandler{
		client:        client,
		featureWallet: services.NewFeatureWalletClientFromConfig(),
		fxRates:       services.NewFXRateServiceFromEnv(),
		cacheTTL:      time.Duration(cacheSeconds) * time.Second,
		orders:        make(map[string]*publicMarketOrder),
		userOrders:    make(map[uint][]string),
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
	ID               string                 `json:"id"`
	UserID           uint                   `json:"-"`
	ItemID           string                 `json:"item_id"`
	Title            string                 `json:"title"`
	Price            string                 `json:"price"`
	Status           string                 `json:"status"`
	Seller           string                 `json:"seller"`
	FailureReason    string                 `json:"failure_reason,omitempty"`
	FailureCode      string                 `json:"failure_code,omitempty"`
	Delivery         map[string]interface{} `json:"delivery,omitempty"`
	SourcePrice      float64                `json:"source_price,omitempty"`
	SourceCurrency   string                 `json:"source_currency,omitempty"`
	SourceSymbol     string                 `json:"source_symbol,omitempty"`
	PriceIDR         int64                  `json:"price_idr,omitempty"`
	FXRateToIDR      float64                `json:"fx_rate_to_idr,omitempty"`
	PriceDisplay     string                 `json:"price_display,omitempty"`
	SourceDisplay    string                 `json:"source_display,omitempty"`
	PricingNote      string                 `json:"pricing_note,omitempty"`
	Steps            []publicOrderStep      `json:"steps,omitempty"`
	LastStepCode     string                 `json:"last_step_code,omitempty"`
	SupplierCurrency string                 `json:"supplier_currency,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

type publicOrderStep struct {
	Code    string    `json:"code"`
	Label   string    `json:"label"`
	Status  string    `json:"status"`
	Message string    `json:"message,omitempty"`
	At      time.Time `json:"at"`
}

type supplierBalanceState string

const (
	supplierBalanceStateEnough       supplierBalanceState = "enough"
	supplierBalanceStateInsufficient supplierBalanceState = "insufficient"
	supplierBalanceStateUnknown      supplierBalanceState = "unknown"
)

type supplierBalanceCheckResult struct {
	State   supplierBalanceState
	Balance float64
	Reason  string
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
			payload := h.withDisplayPricing(cached.JSON)
			c.JSON(http.StatusOK, gin.H{
				"cached":          true,
				"upstream_status": cached.StatusCode,
				"json":            payload,
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
			payload := h.withDisplayPricing(cached.JSON)
			c.JSON(http.StatusOK, gin.H{
				"cached":          true,
				"stale":           true,
				"warning":         "Upstream unavailable, serving stale cache",
				"upstream_status": cached.StatusCode,
				"json":            payload,
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
	payload := h.withDisplayPricing(resp.JSON)

	c.JSON(http.StatusOK, gin.H{
		"cached":          false,
		"upstream_status": resp.StatusCode,
		"json":            payload,
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
	if strings.HasPrefix(strings.ToLower(itemID), "row-") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item ID belum valid dari provider. Refresh listing lalu coba lagi."})
		return
	}

	i18n := strings.TrimSpace(req.I18n)
	if i18n == "" {
		i18n = "en-US"
	}

	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	var walletBalance int64 = -1
	if h.featureWallet != nil {
		walletInfo, balErr := h.featureWallet.GetMyWalletBalance(c.Request.Context(), authHeader)
		if balErr == nil && walletInfo != nil {
			walletBalance = walletInfo.Balance
		}
		if balErr == nil && walletInfo != nil && walletInfo.Balance <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Saldo kamu tidak mencukupi."})
			return
		}
	}

	// Step 1 after user balance: resolve latest listing item and check supplier balance first.
	listingItem, listingErr := h.findChatGPTItem(c, itemID, i18n, true)
	if listingErr != nil || listingItem == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akun belum siap untuk dijual saat ini."})
		return
	}
	resolvedItemID := normalizeItemID(listingItem)
	if resolvedItemID == "" {
		resolvedItemID = itemID
	}

	sourcePrice, sourceCurrency, sourceSymbol := h.extractSourcePriceAndCurrency(listingItem)
	if sourcePrice <= 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Checker sedang error. Coba lagi sebentar."})
		return
	}
	priceIDR, fxRate, pricingErr := h.computeIDRPrice(sourcePrice, sourceCurrency)
	if pricingErr != nil || priceIDR <= 0 {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Checker sedang error. Coba lagi sebentar."})
		return
	}
	if walletBalance >= 0 && walletBalance < priceIDR {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Saldo kamu tidak mencukupi."})
		return
	}
	supplierBalance := h.checkSupplierBalance(c.Request.Context(), sourcePrice)
	if supplierBalance.State == supplierBalanceStateInsufficient {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akun belum siap untuk dijual saat ini."})
		return
	}

	if !extractCanBuyItem(listingItem) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akun belum siap untuk dijual saat ini."})
		return
	}

	now := time.Now().UTC()

	order := &publicMarketOrder{
		ID:             newPublicMarketOrderID(),
		UserID:         userID,
		ItemID:         resolvedItemID,
		Title:          normalizeItemTitle(listingItem),
		Price:          normalizeItemPrice(listingItem),
		Status:         "processing",
		Seller:         normalizeSeller(listingItem),
		SourcePrice:    sourcePrice,
		SourceCurrency: sourceCurrency,
		SourceSymbol:   sourceSymbol,
		PriceIDR:       priceIDR,
		FXRateToIDR:    fxRate,
		PriceDisplay:   formatIDR(priceIDR),
		SourceDisplay:  formatSourcePrice(sourcePrice, sourceSymbol, sourceCurrency),
		PricingNote:    "Harga Lolz realtime dikonversi ke IDR lalu dibagi faktor platform",
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	order.Steps = []publicOrderStep{
		{
			Code:   "INIT",
			Label:  "Order dibuat",
			Status: "done",
			At:     now,
		},
	}
	h.saveOrder(order)
	h.appendOrderStep(order.ID, publicOrderStep{
		Code:   "PROCESSING",
		Label:  "Memulai proses pembelian",
		Status: "processing",
		At:     time.Now().UTC(),
	})

	go h.processOrderAsync(order.ID, userID, resolvedItemID, i18n, authHeader)

	detail, _ := h.getOrderForUser(order.ID, userID)
	c.JSON(http.StatusAccepted, gin.H{
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

	// 2) Fast-buy failed. Fallback only for non-hard-fail reasons.
	if !shouldFallbackAfterFastBuy(fastBuyResp) {
		return fastBuyResp, normalizeProviderFailureReason(fastBuyResp, "Fast-buy failed"), nil
	}

	checkResp, checkErr, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        checkPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
	}, maxRetries)
	if checkErr != nil {
		return fastBuyResp, normalizeProviderFailureReason(fastBuyResp, "Fast-buy failed and check-account unavailable"), nil
	}
	if checkResp == nil {
		return fastBuyResp, normalizeProviderFailureReason(fastBuyResp, "Fast-buy failed and check-account returned empty response"), nil
	}
	if isRetryRequestResponse(checkResp) {
		return checkResp, normalizeProviderFailureReason(checkResp, "Check-account requires another retry"), nil
	}
	if isHardFailResponse(checkResp) {
		return checkResp, normalizeProviderFailureReason(checkResp, "Check-account rejected purchase"), nil
	}

	confirmResp, confirmErr, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        confirmPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
		JSONBody: map[string]interface{}{
			"price": toProviderConfirmPrice(price),
		},
	}, maxRetries)
	if confirmErr != nil {
		return checkResp, "Confirm-buy transport error", confirmErr
	}
	if confirmResp == nil {
		return checkResp, "Confirm-buy returned empty response", nil
	}
	if isRetryRequestResponse(confirmResp) {
		return confirmResp, normalizeProviderFailureReason(confirmResp, "Confirm-buy requires another retry"), nil
	}

	if isSuccessfulPurchaseResponse(confirmResp) {
		return confirmResp, "", nil
	}

	return confirmResp, normalizeProviderFailureReason(confirmResp, "Confirm-buy failed"), nil
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

func (h *LZTMarketHandler) fetchChatGPTListing(c *gin.Context, i18n string, forceRefresh bool) (*services.LZTMarketResponse, error) {
	if forceRefresh {
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

func normalizeItemID(item map[string]interface{}) string {
	for _, key := range []string{"chatgpt_item_id", "item_id", "account_id", "id"} {
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

func applyPriceFactor(baseIDR float64) int64 {
	factor := 0.80
	if raw := strings.TrimSpace(os.Getenv("MARKET_PRICE_FACTOR")); raw != "" {
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil && parsed > 0 {
			factor = parsed
		}
	}

	finalValue := baseIDR / factor
	if finalValue < 0 {
		finalValue = 0
	}
	rounded := int64(math.Round(finalValue))
	if rounded <= 0 {
		rounded = int64(math.Ceil(finalValue))
	}
	if rounded <= 0 {
		rounded = 1
	}
	return rounded
}

func formatIDR(amount int64) string {
	return fmt.Sprintf("Rp %s", formatThousands(amount))
}

func formatSourcePrice(price float64, symbol, currency string) string {
	if symbol == "" {
		symbol = currency
	}
	value := strconv.FormatFloat(price, 'f', 2, 64)
	return fmt.Sprintf("%s %s", symbol, value)
}

func formatThousands(value int64) string {
	negative := value < 0
	if negative {
		value = -value
	}
	raw := strconv.FormatInt(value, 10)
	if len(raw) <= 3 {
		if negative {
			return "-" + raw
		}
		return raw
	}

	var out []byte
	mod := len(raw) % 3
	if mod > 0 {
		out = append(out, raw[:mod]...)
		if len(raw) > mod {
			out = append(out, '.')
		}
	}
	for i := mod; i < len(raw); i += 3 {
		out = append(out, raw[i:i+3]...)
		if i+3 < len(raw) {
			out = append(out, '.')
		}
	}
	if negative {
		return "-" + string(out)
	}
	return string(out)
}

func currencySymbol(currency string) string {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "RUB":
		return "₽"
	case "USD":
		return "$"
	case "EUR":
		return "€"
	case "GBP":
		return "£"
	case "CNY":
		return "¥"
	case "JPY":
		return "¥"
	case "TRY":
		return "₺"
	case "UAH":
		return "₴"
	case "KZT":
		return "₸"
	case "IDR":
		return "Rp"
	default:
		return strings.ToUpper(strings.TrimSpace(currency))
	}
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
		item["pricing_note"] = "Harga Lolz realtime dikonversi ke IDR lalu dibagi faktor platform"
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

func evaluateSupplierBalance(needed, balance float64, hasBalance bool) supplierBalanceCheckResult {
	if needed <= 0 {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: "invalid needed amount"}
	}
	if !hasBalance {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown}
	}
	if balance < needed {
		return supplierBalanceCheckResult{State: supplierBalanceStateInsufficient, Balance: balance}
	}
	return supplierBalanceCheckResult{State: supplierBalanceStateEnough, Balance: balance}
}

func extractSupplierBalanceFromProfile(userMap map[string]interface{}) (float64, bool) {
	balance, ok := extractFloatFromMap(userMap, "balance", "Balance", "money")
	if ok {
		return balance, true
	}

	rows, ok := userMap["balances"].([]interface{})
	if !ok || len(rows) == 0 {
		return 0, false
	}

	best := 0.0
	found := false
	for _, row := range rows {
		balanceMap, ok := row.(map[string]interface{})
		if !ok {
			continue
		}
		value, valueOK := extractFloatFromMap(balanceMap, "balance")
		if !valueOK {
			continue
		}
		if !found || value > best {
			best = value
			found = true
		}
	}
	return best, found
}

func extractFloatFromMap(m map[string]interface{}, keys ...string) (float64, bool) {
	for _, key := range keys {
		v, ok := m[key]
		if !ok || v == nil {
			continue
		}
		switch n := v.(type) {
		case float64:
			return n, true
		case float32:
			return float64(n), true
		case int:
			return float64(n), true
		case int32:
			return float64(n), true
		case int64:
			return float64(n), true
		case string:
			parsed, parsedOK := parseProviderNumericString(n)
			if parsedOK {
				return parsed, true
			}
		}
	}
	return 0, false
}

func parseProviderNumericString(value string) (float64, bool) {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return 0, false
	}

	var b strings.Builder
	b.Grow(len(clean))
	for _, r := range clean {
		if (r >= '0' && r <= '9') || r == '.' || r == ',' || r == '-' {
			b.WriteRune(r)
		}
	}
	filtered := b.String()
	if filtered == "" || filtered == "-" {
		return 0, false
	}

	lastComma := strings.LastIndex(filtered, ",")
	lastDot := strings.LastIndex(filtered, ".")

	switch {
	case lastComma >= 0 && lastDot >= 0:
		if lastComma > lastDot {
			filtered = strings.ReplaceAll(filtered, ".", "")
			filtered = strings.ReplaceAll(filtered, ",", ".")
		} else {
			filtered = strings.ReplaceAll(filtered, ",", "")
		}
	case lastComma >= 0:
		if strings.Count(filtered, ",") == 1 {
			parts := strings.Split(filtered, ",")
			if len(parts) == 2 && len(parts[1]) > 0 && len(parts[1]) <= 2 {
				filtered = parts[0] + "." + parts[1]
			} else {
				filtered = strings.ReplaceAll(filtered, ",", "")
			}
		} else {
			filtered = strings.ReplaceAll(filtered, ",", "")
		}
	case lastDot >= 0:
		if strings.Count(filtered, ".") > 1 {
			idx := strings.LastIndex(filtered, ".")
			intPart := strings.ReplaceAll(filtered[:idx], ".", "")
			fracPart := filtered[idx+1:]
			if len(fracPart) > 0 && len(fracPart) <= 2 {
				filtered = intPart + "." + fracPart
			} else {
				filtered = strings.ReplaceAll(filtered, ".", "")
			}
		} else {
			parts := strings.Split(filtered, ".")
			if len(parts) == 2 && len(parts[1]) > 2 {
				filtered = strings.ReplaceAll(filtered, ".", "")
			}
		}
	}

	parsed, err := strconv.ParseFloat(filtered, 64)
	if err != nil {
		return 0, false
	}
	return parsed, true
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

	maxRetries := readPositiveIntEnvLocal("LZT_MARKET_BUY_MAX_RETRIES", 100)
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

func (h *LZTMarketHandler) applyOrderItemSnapshot(orderID string, item map[string]interface{}) {
	sourcePrice, sourceCurrency, sourceSymbol := h.extractSourcePriceAndCurrency(item)
	if sourcePrice <= 0 {
		sourcePrice = extractNumericPrice(item)
	}
	if sourceCurrency == "" {
		sourceCurrency = "RUB"
	}
	priceIDR, fxRate, err := h.computeIDRPrice(sourcePrice, sourceCurrency)
	if err != nil {
		priceIDR = 0
		fxRate = 0
	}

	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	order, ok := h.orders[orderID]
	if !ok {
		return
	}
	order.Title = normalizeItemTitle(item)
	order.Price = normalizeItemPrice(item)
	order.Seller = normalizeSeller(item)
	order.SourcePrice = sourcePrice
	order.SourceCurrency = sourceCurrency
	order.SourceSymbol = sourceSymbol
	order.PriceIDR = priceIDR
	order.FXRateToIDR = fxRate
	if priceIDR > 0 {
		order.PriceDisplay = formatIDR(priceIDR)
	}
	order.SourceDisplay = formatSourcePrice(sourcePrice, sourceSymbol, sourceCurrency)
	order.UpdatedAt = time.Now().UTC()
}

func (h *LZTMarketHandler) saveOrder(order *publicMarketOrder) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	h.orders[order.ID] = order
	h.userOrders[order.UserID] = append(h.userOrders[order.UserID], order.ID)
}

func (h *LZTMarketHandler) appendOrderStep(orderID string, step publicOrderStep) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	order, ok := h.orders[orderID]
	if !ok {
		return
	}
	step.At = step.At.UTC()
	order.Steps = append(order.Steps, step)
	order.LastStepCode = step.Code
	order.UpdatedAt = step.At
}

func (h *LZTMarketHandler) markOrderFailed(orderID, code, reason string) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	order, ok := h.orders[orderID]
	if !ok {
		return
	}
	order.Status = "failed"
	order.FailureCode = strings.TrimSpace(code)
	order.FailureReason = strings.TrimSpace(reason)
	order.UpdatedAt = time.Now().UTC()
}

func (h *LZTMarketHandler) markOrderFulfilled(orderID string, delivery map[string]interface{}) {
	h.ordersMu.Lock()
	defer h.ordersMu.Unlock()
	order, ok := h.orders[orderID]
	if !ok {
		return
	}
	order.Status = "fulfilled"
	order.FailureCode = ""
	order.FailureReason = ""
	order.Delivery = delivery
	order.UpdatedAt = time.Now().UTC()
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

func (h *LZTMarketHandler) processOrderAsync(orderID string, userID uint, itemID, i18n, authHeader string) {
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CHECK",
		Label:  "Memeriksa saldo user",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	if h.featureWallet != nil {
		balanceInfo, balanceErr := h.featureWallet.GetMyWalletBalance(ctx, authHeader)
		if balanceErr == nil && (balanceInfo == nil || balanceInfo.Balance <= 0) {
			h.markOrderFailed(orderID, "USER_BALANCE_NOT_ENOUGH", "Saldo kamu tidak mencukupi.")
			h.appendOrderStep(orderID, publicOrderStep{
				Code:    "USER_BALANCE_CHECK",
				Label:   "Saldo user tidak mencukupi",
				Status:  "failed",
				Message: "Saldo kamu tidak mencukupi.",
				At:      time.Now().UTC(),
			})
			return
		}
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CHECK",
		Label:  "Saldo user terdeteksi",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PROVIDER_DIRECT_BUY_FLOW",
		Label:  "Menggunakan alur direct buy provider",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_RESERVE",
		Label:  "Memeriksa dan reserve saldo user",
		Status: "processing",
		At:     time.Now().UTC(),
	})

	if h.featureWallet == nil {
		h.markOrderFailed(orderID, "SYSTEM_CONFIG_ERROR", "Feature wallet client belum terkonfigurasi")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Reserve saldo user gagal",
			Status:  "failed",
			Message: "Sistem pembayaran internal belum siap.",
			At:      time.Now().UTC(),
		})
		return
	}

	orderSnapshot, ok := h.getOrderForUser(orderID, userID)
	if !ok {
		return
	}
	if orderSnapshot.PriceIDR <= 0 || orderSnapshot.SourcePrice <= 0 {
		h.markOrderFailed(orderID, "PRICING_UNAVAILABLE", "Harga belum tersedia untuk item ini.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Reserve saldo user gagal",
			Status:  "failed",
			Message: "Harga belum tersedia untuk item ini.",
			At:      time.Now().UTC(),
		})
		return
	}

	if _, err := h.featureWallet.ReserveMarketPurchase(ctx, authHeader, orderID, orderSnapshot.PriceIDR); err != nil {
		h.markOrderFailed(orderID, "USER_BALANCE_NOT_ENOUGH", "Saldo kamu tidak mencukupi.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Reserve saldo user gagal",
			Status:  "failed",
			Message: "Saldo kamu tidak mencukupi.",
			At:      time.Now().UTC(),
		})
		return
	}

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_RESERVE",
		Label:  "Reserve saldo user berhasil",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "SUPPLIER_BALANCE_CHECK",
		Label:  "Memeriksa saldo akun supplier",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	supplierBalance := h.checkSupplierBalance(ctx, orderSnapshot.SourcePrice)
	if supplierBalance.State == supplierBalanceStateInsufficient {
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, "Saldo supplier tidak cukup")
		h.markOrderFailed(orderID, "SUPPLIER_BALANCE_NOT_ENOUGH", "Akun belum siap untuk dijual saat ini.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "SUPPLIER_BALANCE_CHECK",
			Label:   "Saldo supplier tidak cukup",
			Status:  "failed",
			Message: "Akun belum siap untuk dijual saat ini.",
			At:      time.Now().UTC(),
		})
		return
	}
	if supplierBalance.State == supplierBalanceStateUnknown {
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "SUPPLIER_BALANCE_UNKNOWN_CONTINUE",
			Label:   "Saldo supplier tidak dapat diverifikasi, lanjutkan pembelian",
			Status:  "done",
			Message: "Precheck saldo supplier tidak pasti; verifikasi final dilakukan saat buy ke provider.",
			At:      time.Now().UTC(),
		})
		h.appendOrderStep(orderID, publicOrderStep{
			Code:   "SUPPLIER_BALANCE_CHECK",
			Label:  "Precheck supplier dilewati (status tidak pasti)",
			Status: "done",
			At:     time.Now().UTC(),
		})
	} else {
		h.appendOrderStep(orderID, publicOrderStep{
			Code:   "SUPPLIER_BALANCE_CHECK",
			Label:  "Saldo supplier cukup",
			Status: "done",
			At:     time.Now().UTC(),
		})
	}

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PROVIDER_PURCHASE",
		Label:  "Memproses pembelian akun",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	resp, failureReason, buyErr := h.buyChatGPTItem(ctx, itemID, i18n, orderSnapshot.SourcePrice)
	if buyErr != nil {
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, "Provider transport error")
		h.markOrderFailed(orderID, "CHECKER_ERROR", "Checker sedang error. Coba lagi sebentar.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PROVIDER_PURCHASE",
			Label:   "Proses pembelian gagal",
			Status:  "failed",
			Message: "Checker sedang error. Coba lagi sebentar.",
			At:      time.Now().UTC(),
		})
		return
	}
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || !isSuccessfulPurchaseResponse(resp) {
		if strings.TrimSpace(failureReason) == "" {
			failureReason = normalizeProviderFailureReason(resp, "Provider purchase failed")
		}
		failureReason = normalizeUserFacingFailureReason(failureReason)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, failureReason)
		h.markOrderFailed(orderID, "PROVIDER_PURCHASE_FAILED", failureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PROVIDER_PURCHASE",
			Label:   "Proses pembelian gagal",
			Status:  "failed",
			Message: failureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PROVIDER_PURCHASE",
		Label:  "Pembelian akun berhasil",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CAPTURE",
		Label:  "Menyelesaikan potongan saldo user",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	if _, err := h.featureWallet.CaptureMarketPurchase(ctx, authHeader, orderID); err != nil {
		// Critical mismatch: provider succeeded but capture failed.
		h.markOrderFailed(orderID, "CAPTURE_FAILED", "Pembelian berhasil di supplier tetapi finalisasi saldo gagal.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_CAPTURE",
			Label:   "Finalisasi saldo gagal",
			Status:  "failed",
			Message: "Hubungi admin: pembelian provider sudah sukses namun capture gagal.",
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CAPTURE",
		Label:  "Saldo user berhasil difinalisasi",
		Status: "done",
		At:     time.Now().UTC(),
	})

	delivery := extractDeliveryPayload(resp)
	h.markOrderFulfilled(orderID, delivery)
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "DELIVERY_READY",
		Label:  "Data akun siap dikirim ke user",
		Status: "done",
		At:     time.Now().UTC(),
	})
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
		"delivered_at": time.Now().UTC(),
	}
	if resp.JSON != nil {
		if extracted := extractCredentialsFromBuyResponse(resp.JSON); len(extracted) > 0 {
			payload["credentials"] = extracted
		}
		if summary := extractPurchasedItemSummary(resp.JSON); len(summary) > 0 {
			payload["account"] = summary
		}
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
		"status":       firstNonEmptyString(item, "item_state"),
		"price":        firstNonEmptyString(item, "price", "priceWithSellerFee"),
		"email_domain": firstNonEmptyString(item, "item_domain"),
		"openai_tier":  firstNonEmptyString(item, "openai_tier"),
		"country":      firstNonEmptyString(item, "chatgpt_country"),
		"subscription": firstNonEmptyString(item, "chatgpt_subscription"),
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
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || resp.JSON == nil {
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
	return !isSuccessfulPurchaseResponse(resp)
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

func normalizeUserFacingFailureReason(reason string) string {
	msg := strings.TrimSpace(reason)
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "current listing") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "ad not found") || strings.Contains(lower, "item not found") || strings.Contains(lower, "not found") {
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
	if strings.Contains(lower, "retry_request") {
		return "Checker sedang error. Coba lagi sebentar."
	}
	if strings.Contains(lower, "invalid or expired access token") {
		return "Integrasi provider sedang bermasalah. Coba lagi beberapa saat."
	}
	return msg
}

func normalizeCheckerErrorMessage(err error) string {
	if err == nil {
		return "Akun belum siap untuk dijual saat ini."
	}
	msg := strings.TrimSpace(err.Error())
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "sold") ||
		strings.Contains(lower, "not found") ||
		strings.Contains(lower, "ad not found") ||
		strings.Contains(lower, "item not found") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "secret answer") ||
		strings.Contains(lower, "secret question") ||
		strings.Contains(lower, "security answer") ||
		strings.Contains(lower, "security question") ||
		strings.Contains(lower, "payment password") {
		return "Akun belum siap untuk dijual saat ini."
	}
	return "Checker sedang error. Coba lagi sebentar."
}

func extractProviderErrors(resp *services.LZTMarketResponse) []string {
	if resp == nil || resp.JSON == nil {
		return nil
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return nil
	}

	seen := make(map[string]struct{})
	out := make([]string, 0, 4)
	appendUnique := func(raw interface{}) {
		msg := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if msg == "" {
			return
		}
		key := strings.ToLower(msg)
		if _, exists := seen[key]; exists {
			return
		}
		seen[key] = struct{}{}
		out = append(out, msg)
	}

	if rawErrors, ok := root["errors"]; ok && rawErrors != nil {
		switch rows := rawErrors.(type) {
		case []interface{}:
			for _, row := range rows {
				appendUnique(row)
			}
		default:
			appendUnique(rows)
		}
	}

	if rawMessage, ok := root["message"]; ok && rawMessage != nil {
		appendUnique(rawMessage)
	}

	if rawStatus, ok := root["status"]; ok && rawStatus != nil {
		status := strings.TrimSpace(fmt.Sprintf("%v", rawStatus))
		if status != "" && !strings.EqualFold(status, "ok") && !strings.EqualFold(status, "success") {
			appendUnique(status)
		}
	}

	if len(out) == 0 {
		return nil
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

func toProviderConfirmPrice(price float64) int64 {
	value := int64(math.Round(price))
	if value <= 0 {
		return 1
	}
	return value
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
