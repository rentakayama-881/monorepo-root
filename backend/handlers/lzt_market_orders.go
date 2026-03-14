package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent/marketpurchaseorder"
	"backend-gin/ent/marketpurchaseorderstep"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func (h *LZTMarketHandler) loadOrderSteps(ctx context.Context, orderID string) []publicOrderStep {
	client := database.GetEntClient()
	if client == nil {
		return nil
	}
	rows, err := client.MarketPurchaseOrderStep.
		Query().
		Where(marketpurchaseorderstep.OrderIDEQ(orderID)).
		Order(marketpurchaseorderstep.ByAt()).
		All(ctx)
	if err != nil {
		return nil
	}

	out := make([]publicOrderStep, 0, len(rows))
	for _, row := range rows {
		out = append(out, publicOrderStep{
			Code:    strings.TrimSpace(row.Code),
			Label:   strings.TrimSpace(row.Label),
			Status:  strings.TrimSpace(row.Status),
			Message: strings.TrimSpace(row.Message),
			At:      row.At.UTC(),
		})
	}
	return out
}

func (h *LZTMarketHandler) applyOrderItemSnapshot(ctx context.Context, orderID string, item map[string]interface{}) {
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

	client := database.GetEntClient()
	if client == nil {
		return
	}
	upd := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetTitle(normalizeItemTitle(item)).
		SetPrice(normalizeItemPrice(item)).
		SetSeller(normalizeSeller(item)).
		SetSourcePrice(sourcePrice).
		SetSourceCurrency(sourceCurrency).
		SetSourceSymbol(sourceSymbol).
		SetPriceIdr(priceIDR).
		SetFxRateToIdr(fxRate).
		SetSourceDisplay(formatSourcePrice(sourcePrice, sourceSymbol, sourceCurrency)).
		SetUpdatedAt(time.Now().UTC())
	if priceIDR > 0 {
		upd = upd.SetPriceDisplay(formatIDR(priceIDR))
	}
	_, _ = upd.Save(ctx)
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
	h.saveOrder(c.Request.Context(), order)
	h.appendOrderStep(c.Request.Context(), order.ID, publicOrderStep{
		Code:   "PROCESSING",
		Label:  "Memulai proses pembelian",
		Status: "processing",
		At:     time.Now().UTC(),
	})

	go h.processOrderAsync(order.ID, userID, resolvedItemID, i18n, authHeader)

	detail, _ := h.getOrderForUser(c.Request.Context(), order.ID, userID)
	c.JSON(http.StatusAccepted, gin.H{
		"order": detail,
	})
}

