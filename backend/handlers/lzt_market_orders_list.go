package handlers

import (
	"net/http"
	"sort"
	"strings"

	"backend-gin/database"
	"backend-gin/ent/marketpurchaseorder"

	"github.com/gin-gonic/gin"
)

// ListMyPublicChatGPTOrders godoc
// @Summary      List my orders
// @Description  Returns the authenticated user's fulfilled market purchase orders.
// @Tags         Market
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerMarketOrderListResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Failure      500  {object}  handlers.SwaggerErrorResponse
// @Failure      503  {object}  handlers.SwaggerErrorResponse
// @Router       /market/chatgpt/orders [get]
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

// GetMyPublicChatGPTOrderDetail godoc
// @Summary      Get order detail
// @Description  Returns details of a single market purchase order for the authenticated user.
// @Tags         Market
// @Produce      json
// @Security     BearerAuth
// @Param        orderId  path      string  true  "Order ID"
// @Success      200      {object}  handlers.SwaggerMarketOrderResponse
// @Failure      400      {object}  handlers.SwaggerErrorResponse
// @Failure      401      {object}  handlers.SwaggerErrorResponse
// @Failure      404      {object}  handlers.SwaggerErrorResponse
// @Router       /market/chatgpt/orders/{orderId} [get]
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

	order, ok := h.getOrderForUser(c.Request.Context(), orderID, userID)
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
