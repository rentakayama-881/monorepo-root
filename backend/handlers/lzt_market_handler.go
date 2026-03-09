package handlers

import (
	"context"
	"errors"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"backend-gin/database"
	"backend-gin/ent/marketpurchaseorder"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
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

	listingFlightMu sync.Mutex
	listingFlights  map[string]*chatGPTListingFlight
}

func NewLZTMarketHandler(client *services.LZTMarketClient) *LZTMarketHandler {
	cacheSeconds := readPositiveIntEnvLocal("MARKET_CHATGPT_CACHE_SECONDS", 60)
	return &LZTMarketHandler{
		client:         client,
		featureWallet:  services.NewFeatureWalletClientFromConfig(),
		fxRates:        services.NewFXRateServiceFromEnv(),
		cacheTTL:       time.Duration(cacheSeconds) * time.Second,
		listingFlights: make(map[string]*chatGPTListingFlight),
	}
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
		"enabled":                    h.client.IsEnabled(),
		"base_url":                   h.client.BaseURL(),
		"timeout_seconds":            int(h.client.Timeout().Seconds()),
		"min_interval_millis":        int(h.client.MinInterval().Milliseconds()),
		"search_min_interval_millis": int(h.client.SearchMinInterval().Milliseconds()),
		"token_configured":           h.client.IsEnabled(),
		"integration_instructions":   "Gunakan endpoint POST /admin/integrations/lzt/request dari frontend/admin panel agar token tetap aman di backend.",
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
		Method:         http.MethodGet,
		Path:           "/chatgpt",
		RateLimitClass: services.LZTRateLimitClassSearch,
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
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Layanan marketplace tidak tersedia"})
		return
	}

	i18n := strings.TrimSpace(c.Query("i18n"))
	if i18n == "" {
		i18n = "en-US"
	}
	forceRefresh := strings.EqualFold(strings.TrimSpace(c.Query("refresh")), "true")
	resp, cached, stale, err := h.loadChatGPTListing(c.Request.Context(), i18n, forceRefresh)
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": "Gagal memuat data marketplace"})
		return
	}

	payload := h.withDisplayPricing(resp.JSON)
	response := gin.H{
		"cached": cached,
		"json":   payload,
	}
	if stale {
		response["stale"] = true
		response["warning"] = "Marketplace sedang memuat cache sementara."
	}
	c.JSON(http.StatusOK, response)
}

var itemIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)

const publicChatGPTCheckoutSunsetHeader = "Mon, 04 May 2026 00:00:00 GMT"

// GetPublicChatGPTCheckout returns checkout URL for a selected item.
func (h *LZTMarketHandler) GetPublicChatGPTCheckout(c *gin.Context) {
	itemID := strings.TrimSpace(c.Param("itemId"))
	if !itemIDPattern.MatchString(itemID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}

	c.Header("Deprecation", "true")
	c.Header("Sunset", publicChatGPTCheckoutSunsetHeader)

	c.JSON(http.StatusOK, gin.H{
		"item_id":      itemID,
		"checkout_url": buildLZTItemURL(itemID),
		"note":         "Deprecated: gunakan endpoint POST /api/market/chatgpt/orders untuk checkout internal.",
	})
}

// CreatePublicChatGPTOrder creates and executes a direct buy using backend LZT token.
func (h *LZTMarketHandler) CreatePublicChatGPTOrder(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Layanan marketplace tidak tersedia"})
		return
	}

	userID := c.GetUint("user_id")
	if userID == 0 {
		logMarketOrderReject("unauthorized")
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
		logMarketOrderReject("invalid_item_id", zap.Uint("user_id", userID), zap.String("item_id", itemID))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}
	if strings.HasPrefix(strings.ToLower(itemID), "row-") {
		logMarketOrderReject("invalid_provider_item_id", zap.Uint("user_id", userID), zap.String("item_id", itemID))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Item belum siap diproses. Silakan muat ulang daftar akun."})
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
			logMarketOrderReject("wallet_balance_not_enough", zap.Uint("user_id", userID), zap.String("item_id", itemID), zap.Int64("wallet_balance_idr", walletInfo.Balance))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Saldo wallet Anda tidak mencukupi."})
			return
		}
	}

	// Step 1 after user balance: resolve item snapshot from listing; fallback to check-account when
	// listing page changes and selected item is no longer present on the first page.
	listingItem, resolveSource, listingErr := h.resolveOrderItemForCheckout(c, itemID, i18n)
	if listingErr != nil || listingItem == nil {
		logMarketOrderReject(
			"listing_item_unavailable",
			zap.Uint("user_id", userID),
			zap.String("item_id", itemID),
			zap.String("resolve_source", resolveSource),
			zap.Error(listingErr),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akun belum siap untuk dijual saat ini."})
		return
	}
	resolvedItemID := normalizeItemID(listingItem)
	if resolvedItemID == "" {
		resolvedItemID = itemID
	}

	sourcePrice, sourceCurrency, sourceSymbol := h.extractSourcePriceAndCurrency(listingItem)
	if sourcePrice <= 0 {
		logMarketOrderReject("source_price_unavailable",
			zap.Uint("user_id", userID),
			zap.String("item_id", resolvedItemID),
			zap.Float64("source_price", sourcePrice),
			zap.String("source_currency", sourceCurrency),
		)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Checker sedang error. Coba lagi sebentar."})
		return
	}
	priceIDR, fxRate, pricingErr := h.computeIDRPrice(sourcePrice, sourceCurrency)
	if pricingErr != nil || priceIDR <= 0 {
		logMarketOrderReject("pricing_unavailable",
			zap.Uint("user_id", userID),
			zap.String("item_id", resolvedItemID),
			zap.Float64("source_price", sourcePrice),
			zap.String("source_currency", sourceCurrency),
			zap.Error(pricingErr),
		)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Checker sedang error. Coba lagi sebentar."})
		return
	}
	if walletBalance >= 0 && walletBalance < priceIDR {
		logMarketOrderReject("wallet_balance_less_than_item_price",
			zap.Uint("user_id", userID),
			zap.String("item_id", resolvedItemID),
			zap.Int64("wallet_balance_idr", walletBalance),
			zap.Int64("price_idr", priceIDR),
			zap.Float64("source_price", sourcePrice),
			zap.String("source_currency", sourceCurrency),
			zap.Float64("fx_rate_to_idr", fxRate),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Saldo wallet Anda tidak mencukupi."})
		return
	}
	supplierBalance := h.checkSupplierBalance(c.Request.Context(), sourcePrice)
	if supplierBalance.State == supplierBalanceStateInsufficient {
		logMarketOrderReject("supplier_balance_not_enough",
			zap.Uint("user_id", userID),
			zap.String("item_id", resolvedItemID),
			zap.Float64("supplier_balance", supplierBalance.Balance),
			zap.Float64("source_price", sourcePrice),
			zap.String("source_currency", sourceCurrency),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Akun belum siap untuk dijual saat ini."})
		return
	}
	if supplierBalance.State == supplierBalanceStateUnknown && isProviderIntegrationFailureReason(supplierBalance.Reason) {
		logMarketOrderReject("supplier_balance_integration_error",
			zap.Uint("user_id", userID),
			zap.String("item_id", resolvedItemID),
			zap.String("reason", supplierBalance.Reason),
		)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."})
		return
	}

	if !extractCanBuyItem(listingItem) {
		cannotBuyReason := normalizeUserFacingFailureReason(extractCannotBuyItemError(listingItem))
		if strings.TrimSpace(cannotBuyReason) == "" {
			cannotBuyReason = "Akun belum siap untuk dijual saat ini."
		}
		logMarketOrderReject(
			"item_not_purchasable",
			zap.Uint("user_id", userID),
			zap.String("item_id", resolvedItemID),
			zap.String("cannot_buy_reason", cannotBuyReason),
		)
		c.JSON(http.StatusBadRequest, gin.H{"error": cannotBuyReason})
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
		PricingNote:    "Harga sumber realtime dikonversi ke IDR lalu dibagi faktor platform",
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

	client := database.GetEntClient()
	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Service unavailable"})
		return
	}

	rows, err := client.MarketPurchaseOrder.
		Query().
		Where(
			marketpurchaseorder.UserIDEQ(int(userID)),
			marketpurchaseorder.StatusEQ("fulfilled"),
		).
		All(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat riwayat pembelian"})
		return
	}

	orders := make([]publicMarketOrder, 0, len(rows))
	seenOrderIDs := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		order := mapEntityToPublicMarketOrder(row)
		order.Steps = h.loadOrderSteps(c.Request.Context(), row.OrderID)
		orders = append(orders, order.toClientDTO(false))
		seenOrderIDs[row.OrderID] = struct{}{}
	}

	if h.featureWallet != nil {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader != "" {
			history, err := h.featureWallet.GetMarketPurchaseHistory(c.Request.Context(), authHeader, 1, 200, "captured")
			if err == nil && history != nil {
				for _, item := range history.Items {
					orderID := strings.TrimSpace(item.OrderID)
					if orderID == "" {
						continue
					}
					if _, exists := seenOrderIDs[orderID]; exists {
						continue
					}
					if !isMarketPurchaseOrderID(orderID) {
						continue
					}

					fallback := publicMarketOrder{
						ID:           orderID,
						UserID:       userID,
						ItemID:       "",
						Title:        "ChatGPT Account",
						Price:        formatIDR(item.AmountIDR),
						Status:       "fulfilled",
						PriceIDR:     item.AmountIDR,
						PriceDisplay: formatIDR(item.AmountIDR),
						PricingNote:  "Riwayat dipulihkan dari catatan wallet",
						CreatedAt:    item.CreatedAt.UTC(),
						UpdatedAt:    item.UpdatedAt.UTC(),
					}
					orders = append(orders, fallback.toClientDTO(false))
					seenOrderIDs[orderID] = struct{}{}
				}
			}
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
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if h.featureWallet != nil && authHeader != "" {
			history, err := h.featureWallet.GetMarketPurchaseHistory(c.Request.Context(), authHeader, 1, 200, "")
			if err == nil && history != nil {
				for _, item := range history.Items {
					if strings.TrimSpace(item.OrderID) != orderID {
						continue
					}
					if !isMarketPurchaseOrderID(strings.TrimSpace(item.OrderID)) {
						continue
					}
					order = publicMarketOrder{
						ID:           orderID,
						UserID:       userID,
						Title:        "ChatGPT Account",
						Price:        formatIDR(item.AmountIDR),
						Status:       "fulfilled",
						PriceIDR:     item.AmountIDR,
						PriceDisplay: formatIDR(item.AmountIDR),
						PricingNote:  "Riwayat dipulihkan dari catatan wallet",
						CreatedAt:    item.CreatedAt.UTC(),
						UpdatedAt:    item.UpdatedAt.UTC(),
					}
					c.JSON(http.StatusOK, gin.H{"order": order})
					return
				}
			}
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order": order,
	})
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
			h.markOrderFailed(orderID, "USER_BALANCE_NOT_ENOUGH", "Saldo wallet Anda tidak mencukupi.")
			h.appendOrderStep(orderID, publicOrderStep{
				Code:    "USER_BALANCE_CHECK",
				Label:   "Saldo user tidak mencukupi",
				Status:  "failed",
				Message: "Saldo wallet Anda tidak mencukupi.",
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
		Code:   "PURCHASE_WORKFLOW",
		Label:  "Menggunakan alur pembelian otomatis",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_RESERVE",
		Label:  "Mengunci saldo pembayaran",
		Status: "processing",
		At:     time.Now().UTC(),
	})

	if h.featureWallet == nil {
		h.markOrderFailed(orderID, "SYSTEM_CONFIG_ERROR", "Feature wallet client belum terkonfigurasi")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Gagal mengunci saldo pembayaran",
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
			Label:   "Gagal mengunci saldo pembayaran",
			Status:  "failed",
			Message: "Harga belum tersedia untuk item ini.",
			At:      time.Now().UTC(),
		})
		return
	}

	if _, err := h.featureWallet.ReserveMarketPurchase(ctx, authHeader, orderID, orderSnapshot.PriceIDR); err != nil {
		h.markOrderFailed(orderID, "USER_BALANCE_NOT_ENOUGH", "Saldo wallet Anda tidak mencukupi.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Gagal mengunci saldo pembayaran",
			Status:  "failed",
			Message: "Saldo wallet Anda tidak mencukupi.",
			At:      time.Now().UTC(),
		})
		return
	}

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_RESERVE",
		Label:  "Saldo pembayaran berhasil dikunci",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PLATFORM_READINESS_CHECK",
		Label:  "Memverifikasi kesiapan sistem penjualan",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	supplierBalance := h.checkSupplierBalance(ctx, orderSnapshot.SourcePrice)
	if supplierBalance.State == supplierBalanceStateInsufficient {
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, "Saldo sumber belum mencukupi")
		h.markOrderFailed(orderID, "PLATFORM_READINESS_NOT_ENOUGH", "Akun belum siap untuk dijual saat ini.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PLATFORM_READINESS_CHECK",
			Label:   "Kesiapan sistem belum mencukupi",
			Status:  "failed",
			Message: "Akun belum siap untuk dijual saat ini.",
			At:      time.Now().UTC(),
		})
		return
	}
	if supplierBalance.State == supplierBalanceStateUnknown && isProviderIntegrationFailureReason(supplierBalance.Reason) {
		userFailureReason := "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "PLATFORM_READINESS_CHECK_FAILED", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PLATFORM_READINESS_CHECK",
			Label:   "Gagal memverifikasi kesiapan sistem",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	if supplierBalance.State == supplierBalanceStateUnknown {
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PLATFORM_READINESS_DEFERRED",
			Label:   "Kesiapan sistem belum dapat dipastikan, proses dilanjutkan",
			Status:  "done",
			Message: "Verifikasi akhir dilakukan pada tahap eksekusi pembelian.",
			At:      time.Now().UTC(),
		})
		h.appendOrderStep(orderID, publicOrderStep{
			Code:   "PLATFORM_READINESS_CHECK",
			Label:  "Pemeriksaan awal kesiapan dilewati (status belum pasti)",
			Status: "done",
			At:     time.Now().UTC(),
		})
	} else {
		h.appendOrderStep(orderID, publicOrderStep{
			Code:   "PLATFORM_READINESS_CHECK",
			Label:  "Kesiapan sistem terverifikasi",
			Status: "done",
			At:     time.Now().UTC(),
		})
	}

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "ITEM_AVAILABILITY_CHECK",
		Label:  "Memverifikasi ketersediaan akun",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	itemReadiness, itemReadinessErr := h.getProviderItemReadiness(ctx, itemID)
	if itemReadinessErr != nil {
		userFailureReason := normalizeCheckerErrorMessage(itemReadinessErr)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "ITEM_AVAILABILITY_CHECK_FAILED", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "ITEM_AVAILABILITY_CHECK",
			Label:   "Verifikasi ketersediaan akun gagal",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	if itemReadiness != nil && len(itemReadiness.Item) > 0 {
		h.applyOrderItemSnapshot(orderID, itemReadiness.Item)
		if refreshedOrder, found := h.getOrderForUser(orderID, userID); found {
			orderSnapshot = refreshedOrder
		}
	}
	if itemReadiness != nil && !itemReadiness.CanBuy {
		userFailureReason := normalizeUserFacingFailureReason(itemReadiness.CannotBuyReason)
		if strings.TrimSpace(userFailureReason) == "" {
			userFailureReason = "Akun belum siap untuk dijual saat ini."
		}
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "ITEM_UNAVAILABLE", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "ITEM_AVAILABILITY_CHECK",
			Label:   "Akun tidak tersedia untuk dibeli",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "ITEM_AVAILABILITY_CHECK",
		Label:  "Akun tersedia untuk dibeli",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PURCHASE_EXECUTION",
		Label:  "Memproses pembelian akun",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	resp, failureReason, buyErr := h.buyChatGPTItem(ctx, itemID, i18n, orderSnapshot.SourcePrice)
	if buyErr != nil {
		logMarketOrderReject(
			"provider_purchase_transport_error",
			zap.String("order_id", orderID),
			zap.Uint("user_id", userID),
			zap.String("item_id", itemID),
			zap.Error(buyErr),
		)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, "Provider transport error")
		h.markOrderFailed(orderID, "CHECKER_ERROR", "Checker sedang error. Coba lagi sebentar.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PURCHASE_EXECUTION",
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
		providerFailureReason := failureReason
		userFailureReason := normalizeUserFacingFailureReason(failureReason)
		providerStatusCode := 0
		if resp != nil {
			providerStatusCode = resp.StatusCode
		}
		logMarketOrderReject(
			"provider_purchase_failed",
			zap.String("order_id", orderID),
			zap.Uint("user_id", userID),
			zap.String("item_id", itemID),
			zap.Int("provider_status_code", providerStatusCode),
			zap.String("provider_reason_raw", providerFailureReason),
			zap.String("user_reason", userFailureReason),
			zap.Strings("provider_errors", extractProviderErrors(resp)),
		)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "PURCHASE_FAILED", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PURCHASE_EXECUTION",
			Label:   "Proses pembelian gagal",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PURCHASE_EXECUTION",
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
		h.markOrderFailed(orderID, "CAPTURE_FAILED", "Pembelian berhasil, tetapi finalisasi saldo gagal.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_CAPTURE",
			Label:   "Finalisasi saldo gagal",
			Status:  "failed",
			Message: "Hubungi admin: pembelian sudah berhasil namun finalisasi saldo gagal.",
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
