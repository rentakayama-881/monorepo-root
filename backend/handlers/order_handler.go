package handlers

import (
	"net/http"

	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/models"
	"backend-gin/services"
	"backend-gin/validators"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// OrderHandler handles order HTTP requests
type OrderHandler struct {
	orderService *services.OrderService
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(orderService *services.OrderService) *OrderHandler {
	return &OrderHandler{
		orderService: orderService,
	}
}

// CreateOrder handles order creation
// POST /api/orders
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req struct {
		BuyerWallet  string `json:"buyer_wallet" binding:"required"`
		SellerWallet string `json:"seller_wallet" binding:"required"`
		AmountUSDT   uint64 `json:"amount_usdt" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid create order request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	// Get buyer user ID from context (if authenticated)
	var buyerUserID *uint
	if userVal, ok := c.Get("user"); ok {
		if user, ok := userVal.(*models.User); ok {
			buyerUserID = &user.ID
		}
	}

	input := validators.CreateOrderInput{
		BuyerWallet:  req.BuyerWallet,
		SellerWallet: req.SellerWallet,
		AmountUSDT:   req.AmountUSDT,
		BuyerUserID:  buyerUserID,
	}

	response, err := h.orderService.CreateOrder(input)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// AttachEscrow handles escrow attachment
// POST /api/orders/:orderId/attach
func (h *OrderHandler) AttachEscrow(c *gin.Context) {
	orderID := c.Param("orderId")

	var req struct {
		EscrowAddress string `json:"escrow_address" binding:"required"`
		TxHash        string `json:"tx_hash" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Debug("Invalid attach escrow request", zap.Error(err))
		handleError(c, apperrors.ErrInvalidInput.WithDetails("Format request tidak valid"))
		return
	}

	input := validators.AttachEscrowInput{
		OrderID:       orderID,
		EscrowAddress: req.EscrowAddress,
		TxHash:        req.TxHash,
	}

	response, err := h.orderService.AttachEscrow(input)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetOrderStatus handles getting order status
// GET /api/orders/:orderId
func (h *OrderHandler) GetOrderStatus(c *gin.Context) {
	orderID := c.Param("orderId")

	input := validators.OrderIDInput{
		OrderID: orderID,
	}

	response, err := h.orderService.GetOrderStatus(input)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, response)
}

// ListOrders handles listing user orders
// GET /api/orders
func (h *OrderHandler) ListOrders(c *gin.Context) {
	userVal, ok := c.Get("user")
	if !ok {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	user, ok := userVal.(*models.User)
	if !ok {
		handleError(c, apperrors.ErrUnauthorized)
		return
	}

	orders, err := h.orderService.ListUserOrders(user.ID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, orders)
}
