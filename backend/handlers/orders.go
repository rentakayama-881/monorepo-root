package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"math/big"
	"net/http"
	"strings"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/models"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
)

type CreateOrderRequest struct {
	BuyerWallet  string `json:"buyer_wallet" binding:"required"`
	SellerWallet string `json:"seller_wallet" binding:"required"`
	AmountUSDT   uint64 `json:"amount_usdt" binding:"required"`
}

type AttachOrderRequest struct {
	EscrowAddress string `json:"escrow_address" binding:"required"`
	TxHash        string `json:"tx_hash" binding:"required"`
}

// POST /api/orders
func CreateOrderHandler(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	buyerAddr := common.HexToAddress(req.BuyerWallet)
	sellerAddr := common.HexToAddress(req.SellerWallet)
	if buyerAddr == (common.Address{}) || sellerAddr == (common.Address{}) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "buyer_wallet dan seller_wallet wajib berupa alamat hex"})
		return
	}

	orderIDBytes := make([]byte, 32)
	if _, err := rand.Read(orderIDBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal membuat order id"})
		return
	}
	orderIDHex := "0x" + hex.EncodeToString(orderIDBytes)

	var buyerUserID *uint
	if userVal, ok := c.Get("user"); ok {
		if user, ok := userVal.(*models.User); ok {
			buyerUserID = &user.ID
		}
	}

	order := models.Order{
		OrderIDHex:   orderIDHex,
		BuyerUserID:  buyerUserID,
		BuyerWallet:  strings.ToLower(buyerAddr.Hex()),
		SellerWallet: strings.ToLower(sellerAddr.Hex()),
		AmountUSDT:   req.AmountUSDT,
		ChainID:      config.ChainID.Uint64(),
		Status:       models.OrderStatusCreated,
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan order"})
		return
	}

	signature, err := signOrder(orderIDBytes, buyerAddr, sellerAddr, req.AmountUSDT)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menandatangani order"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order_id":  orderIDHex,
		"signature": "0x" + hex.EncodeToString(signature),
		"chain_id":  order.ChainID,
		"factory":   config.EscrowFactoryAddress.Hex(),
		"buyer":     order.BuyerWallet,
		"seller":    order.SellerWallet,
		"amount":    order.AmountUSDT,
	})
}

// POST /api/orders/:orderId/attach
func AttachEscrowHandler(c *gin.Context) {
	orderID := normalizeOrderID(c.Param("orderId"))
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "orderId tidak valid"})
		return
	}

	var req AttachOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	escrowAddr := common.HexToAddress(req.EscrowAddress)
	if escrowAddr == (common.Address{}) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "escrow_address tidak valid"})
		return
	}

	var order models.Order
	if err := database.DB.Where("order_id_hex = ?", orderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order tidak ditemukan"})
		return
	}

	order.EscrowAddress = strings.ToLower(escrowAddr.Hex())
	order.TxHash = req.TxHash
	order.Status = models.OrderStatusDeployed

	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "gagal menyimpan escrow"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": order.Status, "escrow": order.EscrowAddress, "tx_hash": order.TxHash})
}

// GET /api/orders/:orderId
func GetOrderStatusHandler(c *gin.Context) {
	orderID := normalizeOrderID(c.Param("orderId"))
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "orderId tidak valid"})
		return
	}

	var order models.Order
	if err := database.DB.Where("order_id_hex = ?", orderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"order_id":       order.OrderIDHex,
		"status":         order.Status,
		"escrow_address": order.EscrowAddress,
		"tx_hash":        order.TxHash,
		"buyer_wallet":   order.BuyerWallet,
		"seller_wallet":  order.SellerWallet,
		"amount_usdt":    order.AmountUSDT,
		"chain_id":       order.ChainID,
	})
}

func signOrder(orderIDBytes []byte, buyerAddr, sellerAddr common.Address, amount uint64) ([]byte, error) {
	orderID := [32]byte{}
	copy(orderID[:], orderIDBytes)

	arguments := abi.Arguments{
		{Type: mustNewType("bytes32")},
		{Type: mustNewType("address")},
		{Type: mustNewType("address")},
		{Type: mustNewType("uint256")},
		{Type: mustNewType("uint256")},
		{Type: mustNewType("address")},
	}

	packed, err := arguments.Pack(orderID, buyerAddr, sellerAddr, new(big.Int).SetUint64(amount), config.ChainID, config.EscrowFactoryAddress)
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

func normalizeOrderID(raw string) string {
	id := strings.TrimSpace(raw)
	if id == "" {
		return ""
	}
	if !strings.HasPrefix(id, "0x") {
		id = "0x" + id
	}
	if len(id) != 66 {
		return ""
	}
	return strings.ToLower(id)
}
