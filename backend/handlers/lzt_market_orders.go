package handlers

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/ent/marketpurchaseorder"
	"backend-gin/ent/marketpurchaseorderstep"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func (h *LZTMarketHandler) saveOrder(order *publicMarketOrder) {
	if order == nil {
		return
	}
	client := database.GetEntClient()
	if client == nil {
		return
	}

	create := client.MarketPurchaseOrder.
		Create().
		SetOrderID(order.ID).
		SetUserID(int(order.UserID)).
		SetItemID(order.ItemID).
		SetTitle(order.Title).
		SetPrice(order.Price).
		SetStatus(order.Status).
		SetSeller(order.Seller).
		SetFailureReason(strings.TrimSpace(order.FailureReason)).
		SetFailureCode(strings.TrimSpace(order.FailureCode)).
		SetSourcePrice(order.SourcePrice).
		SetSourceCurrency(order.SourceCurrency).
		SetSourceSymbol(order.SourceSymbol).
		SetPriceIdr(order.PriceIDR).
		SetFxRateToIdr(order.FXRateToIDR).
		SetPriceDisplay(order.PriceDisplay).
		SetSourceDisplay(order.SourceDisplay).
		SetPricingNote(order.PricingNote).
		SetLastStepCode(order.LastStepCode).
		SetSupplierCurrency(order.SupplierCurrency).
		SetCreatedAt(order.CreatedAt.UTC()).
		SetUpdatedAt(order.UpdatedAt.UTC())

	if len(order.Delivery) > 0 {
		create = create.SetDeliveryJSON(order.Delivery)
	}
	if _, err := create.Save(context.Background()); err == nil {
		return
	}

	upd := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(order.ID)).
		SetItemID(order.ItemID).
		SetTitle(order.Title).
		SetPrice(order.Price).
		SetStatus(order.Status).
		SetSeller(order.Seller).
		SetFailureReason(strings.TrimSpace(order.FailureReason)).
		SetFailureCode(strings.TrimSpace(order.FailureCode)).
		SetSourcePrice(order.SourcePrice).
		SetSourceCurrency(order.SourceCurrency).
		SetSourceSymbol(order.SourceSymbol).
		SetPriceIdr(order.PriceIDR).
		SetFxRateToIdr(order.FXRateToIDR).
		SetPriceDisplay(order.PriceDisplay).
		SetSourceDisplay(order.SourceDisplay).
		SetPricingNote(order.PricingNote).
		SetLastStepCode(order.LastStepCode).
		SetSupplierCurrency(order.SupplierCurrency).
		SetUpdatedAt(order.UpdatedAt.UTC())
	if len(order.Delivery) > 0 {
		upd = upd.SetDeliveryJSON(order.Delivery)
	}
	_, _ = upd.Save(context.Background())
}

func (h *LZTMarketHandler) appendOrderStep(orderID string, step publicOrderStep) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	step.At = step.At.UTC()
	_, _ = client.MarketPurchaseOrderStep.
		Create().
		SetOrderID(orderID).
		SetCode(strings.TrimSpace(step.Code)).
		SetLabel(strings.TrimSpace(step.Label)).
		SetStatus(strings.TrimSpace(step.Status)).
		SetMessage(strings.TrimSpace(step.Message)).
		SetAt(step.At).
		SetCreatedAt(step.At).
		SetUpdatedAt(step.At).
		Save(context.Background())

	_, _ = client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetLastStepCode(strings.TrimSpace(step.Code)).
		SetUpdatedAt(step.At).
		Save(context.Background())
}

func (h *LZTMarketHandler) markOrderFailed(orderID, code, reason string) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	_, _ = client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetStatus("failed").
		SetFailureCode(strings.TrimSpace(code)).
		SetFailureReason(strings.TrimSpace(reason)).
		SetUpdatedAt(time.Now().UTC()).
		Save(context.Background())
}

func (h *LZTMarketHandler) markOrderFulfilled(orderID string, delivery map[string]interface{}) {
	client := database.GetEntClient()
	if client == nil {
		return
	}
	upd := client.MarketPurchaseOrder.
		Update().
		Where(marketpurchaseorder.OrderIDEQ(orderID)).
		SetStatus("fulfilled").
		SetFailureCode("").
		SetFailureReason("").
		SetUpdatedAt(time.Now().UTC())
	if len(delivery) > 0 {
		upd = upd.SetDeliveryJSON(delivery)
	}
	_, _ = upd.Save(context.Background())
}

func (h *LZTMarketHandler) getOrderForUser(orderID string, userID uint) (publicMarketOrder, bool) {
	client := database.GetEntClient()
	if client == nil {
		return publicMarketOrder{}, false
	}

	row, err := client.MarketPurchaseOrder.
		Query().
		Where(
			marketpurchaseorder.OrderIDEQ(orderID),
			marketpurchaseorder.UserIDEQ(int(userID)),
		).
		Only(context.Background())
	if err != nil {
		return publicMarketOrder{}, false
	}
	order := mapEntityToPublicMarketOrder(row)
	order.Steps = h.loadOrderSteps(context.Background(), row.OrderID)
	return order.toClientDTO(true), true
}

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
	_, _ = upd.Save(context.Background())
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
