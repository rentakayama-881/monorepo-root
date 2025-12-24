package services

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	"strings"
	"time"

	"backend-gin/config"
	apperrors "backend-gin/errors"
	"backend-gin/logger"
	"backend-gin/models"
	"backend-gin/validators"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// OrderService handles order business logic
type OrderService struct {
	db *gorm.DB
}

// NewOrderService creates a new order service
func NewOrderService(db *gorm.DB) *OrderService {
	return &OrderService{db: db}
}

// CreateOrderResponse represents order creation response
type CreateOrderResponse struct {
	OrderID   string `json:"order_id"`
	Signature string `json:"signature"`
	ChainID   uint64 `json:"chain_id"`
	Factory   string `json:"factory"`
	Buyer     string `json:"buyer"`
	Seller    string `json:"seller"`
	Amount    uint64 `json:"amount"`
	ExpiresAt int64  `json:"expires_at"`
}

// CreateOrder creates a new order
func (s *OrderService) CreateOrder(input validators.CreateOrderInput) (*CreateOrderResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Normalize addresses
	buyerAddr := common.HexToAddress(input.BuyerWallet)
	sellerAddr := common.HexToAddress(input.SellerWallet)

	// Generate order ID
	orderIDBytes := make([]byte, 32)
	if _, err := rand.Read(orderIDBytes); err != nil {
		logger.Error("Failed to generate order ID", zap.Error(err))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal membuat order ID")
	}
	orderIDHex := "0x" + hex.EncodeToString(orderIDBytes)

	// Create order record
	order := models.Order{
		OrderIDHex:   orderIDHex,
		BuyerUserID:  input.BuyerUserID,
		BuyerWallet:  strings.ToLower(buyerAddr.Hex()),
		SellerWallet: strings.ToLower(sellerAddr.Hex()),
		AmountUSDT:   input.AmountUSDT,
		ChainID:      config.ChainID.Uint64(),
		Status:       models.OrderStatusCreated,
	}

	if err := s.db.Create(&order).Error; err != nil {
		logger.Error("Failed to create order", zap.Error(err), zap.String("order_id", orderIDHex))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal menyimpan order")
	}

	// Sign order
	signature, err := s.signOrder(orderIDBytes, buyerAddr, sellerAddr, input.AmountUSDT)
	if err != nil {
		logger.Error("Failed to sign order", zap.Error(err), zap.String("order_id", orderIDHex))
		return nil, apperrors.ErrInternalServer.WithDetails("Gagal menandatangani order")
	}

	// Calculate expiration
	expirationTimestamp := time.Now().Add(24 * time.Hour).Unix()

	logger.Info("Order created successfully",
		zap.String("order_id", orderIDHex),
		zap.String("buyer", order.BuyerWallet),
		zap.String("seller", order.SellerWallet),
		zap.Uint64("amount", input.AmountUSDT))

	return &CreateOrderResponse{
		OrderID:   orderIDHex,
		Signature: "0x" + hex.EncodeToString(signature),
		ChainID:   order.ChainID,
		Factory:   config.EscrowFactoryAddress.Hex(),
		Buyer:     order.BuyerWallet,
		Seller:    order.SellerWallet,
		Amount:    order.AmountUSDT,
		ExpiresAt: expirationTimestamp,
	}, nil
}

// AttachEscrowResponse represents escrow attachment response
type AttachEscrowResponse struct {
	Status        string `json:"status"`
	EscrowAddress string `json:"escrow"`
	TxHash        string `json:"tx_hash"`
}

// AttachEscrow attaches escrow address and tx hash to an order
func (s *OrderService) AttachEscrow(input validators.AttachEscrowInput) (*AttachEscrowResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Find order
	var order models.Order
	if err := s.db.Where("order_id_hex = ?", input.OrderID).First(&order).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Debug("Order not found for attach", zap.String("order_id", input.OrderID))
			return nil, apperrors.ErrOrderNotFound
		}
		logger.Error("Database error finding order", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	// Check if already attached
	if order.EscrowAddress != "" {
		logger.Warn("Attempted to attach escrow to already attached order",
			zap.String("order_id", input.OrderID),
			zap.String("existing_escrow", order.EscrowAddress))
		return nil, apperrors.ErrInvalidOrderData.WithDetails("Order sudah memiliki escrow address")
	}

	// Update order
	order.EscrowAddress = input.EscrowAddress
	order.TxHash = input.TxHash
	order.Status = models.OrderStatusDeployed

	if err := s.db.Save(&order).Error; err != nil {
		logger.Error("Failed to attach escrow", zap.Error(err), zap.String("order_id", input.OrderID))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal menyimpan escrow")
	}

	logger.Info("Escrow attached to order",
		zap.String("order_id", input.OrderID),
		zap.String("escrow_address", input.EscrowAddress),
		zap.String("tx_hash", input.TxHash))

	return &AttachEscrowResponse{
		Status:        order.Status,
		EscrowAddress: order.EscrowAddress,
		TxHash:        order.TxHash,
	}, nil
}

// OrderStatusResponse represents order status response
type OrderStatusResponse struct {
	OrderID       string `json:"order_id"`
	Status        string `json:"status"`
	EscrowAddress string `json:"escrow_address"`
	TxHash        string `json:"tx_hash"`
	BuyerWallet   string `json:"buyer_wallet"`
	SellerWallet  string `json:"seller_wallet"`
	AmountUSDT    uint64 `json:"amount_usdt"`
	ChainID       uint64 `json:"chain_id"`
}

// GetOrderStatus gets order status by ID
func (s *OrderService) GetOrderStatus(input validators.OrderIDInput) (*OrderStatusResponse, error) {
	// Validate input
	if err := input.Validate(); err != nil {
		return nil, err
	}

	// Find order
	var order models.Order
	if err := s.db.Where("order_id_hex = ?", input.OrderID).First(&order).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logger.Debug("Order not found", zap.String("order_id", input.OrderID))
			return nil, apperrors.ErrOrderNotFound
		}
		logger.Error("Database error finding order", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}

	return &OrderStatusResponse{
		OrderID:       order.OrderIDHex,
		Status:        order.Status,
		EscrowAddress: order.EscrowAddress,
		TxHash:        order.TxHash,
		BuyerWallet:   order.BuyerWallet,
		SellerWallet:  order.SellerWallet,
		AmountUSDT:    order.AmountUSDT,
		ChainID:       order.ChainID,
	}, nil
}

// OrderListItem represents a single order in the list
type OrderListItem struct {
	OrderID               string    `json:"order_id"`
	Status                string    `json:"status"`
	EscrowAddress         string    `json:"escrow_address"`
	TxHash                string    `json:"tx_hash"`
	BuyerWallet           string    `json:"buyer_wallet"`
	SellerWallet          string    `json:"seller_wallet"`
	AmountUSDT            uint64    `json:"amount_usdt"`
	ChainID               uint64    `json:"chain_id"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
	FundingDeadlineHours  int       `json:"funding_deadline_hours"`
	DeliveryDeadlineHours int       `json:"delivery_deadline_hours"`
	ReviewWindowHours     int       `json:"review_window_hours"`
}

// ListUserOrders lists all orders for a user
func (s *OrderService) ListUserOrders(userID uint) ([]OrderListItem, error) {
	var orders []models.Order
	if err := s.db.Where("buyer_user_id = ?", userID).Order("created_at DESC").Find(&orders).Error; err != nil {
		logger.Error("Failed to list orders", zap.Error(err), zap.Uint("user_id", userID))
		return nil, apperrors.ErrDatabase.WithDetails("Gagal memuat order")
	}

	result := make([]OrderListItem, 0, len(orders))
	for _, order := range orders {
		result = append(result, OrderListItem{
			OrderID:               order.OrderIDHex,
			Status:                order.Status,
			EscrowAddress:         order.EscrowAddress,
			TxHash:                order.TxHash,
			BuyerWallet:           order.BuyerWallet,
			SellerWallet:          order.SellerWallet,
			AmountUSDT:            order.AmountUSDT,
			ChainID:               order.ChainID,
			CreatedAt:             order.CreatedAt,
			UpdatedAt:             order.UpdatedAt,
			FundingDeadlineHours:  24,
			DeliveryDeadlineHours: 72,
			ReviewWindowHours:     48,
		})
	}

	logger.Info("Orders listed", zap.Uint("user_id", userID), zap.Int("count", len(result)))

	return result, nil
}

// signOrder signs an order with the backend private key
func (s *OrderService) signOrder(orderIDBytes []byte, buyerAddr, sellerAddr common.Address, amount uint64) ([]byte, error) {
	orderID := [32]byte{}
	copy(orderID[:], orderIDBytes)

	// Add expiration timestamp (24 hours from now) to signature
	expirationTimestamp := time.Now().Add(24 * time.Hour).Unix()

	arguments := abi.Arguments{
		{Type: mustNewType("bytes32")},
		{Type: mustNewType("address")},
		{Type: mustNewType("address")},
		{Type: mustNewType("uint256")},
		{Type: mustNewType("uint256")},
		{Type: mustNewType("address")},
		{Type: mustNewType("uint256")}, // expiration timestamp
	}

	packed, err := arguments.Pack(
		orderID,
		buyerAddr,
		sellerAddr,
		new(big.Int).SetUint64(amount),
		config.ChainID,
		config.EscrowFactoryAddress,
		new(big.Int).SetInt64(expirationTimestamp),
	)
	if err != nil {
		return nil, err
	}

	digest := crypto.Keccak256Hash(packed)
	ethMessage := crypto.Keccak256Hash([]byte("\x19Ethereum Signed Message:\n32"), digest.Bytes())

	return crypto.Sign(ethMessage.Bytes(), config.BackendSignerPrivateKey)
}

func mustNewType(t string) abi.Type {
	ty, err := abi.NewType(t, "", nil)
	if err != nil {
		panic(err)
	}
	return ty
}
