package validators

import (
	"encoding/hex"
	"strings"

	apperrors "backend-gin/errors"

	"github.com/ethereum/go-ethereum/common"
)

// CreateOrderInput represents order creation input
type CreateOrderInput struct {
	BuyerWallet  string
	SellerWallet string
	AmountUSDT   uint64
	BuyerUserID  *uint
}

// Validate validates order creation input
func (o *CreateOrderInput) Validate() error {
	// Validate buyer wallet
	buyerWallet := strings.ToLower(strings.TrimSpace(o.BuyerWallet))
	if buyerWallet == "" {
		return apperrors.ErrMissingField.WithDetails("buyer_wallet")
	}
	if !common.IsHexAddress(buyerWallet) {
		return apperrors.ErrInvalidOrderData.WithDetails("buyer_wallet harus berupa alamat hex yang valid")
	}

	// Validate seller wallet
	sellerWallet := strings.ToLower(strings.TrimSpace(o.SellerWallet))
	if sellerWallet == "" {
		return apperrors.ErrMissingField.WithDetails("seller_wallet")
	}
	if !common.IsHexAddress(sellerWallet) {
		return apperrors.ErrInvalidOrderData.WithDetails("seller_wallet harus berupa alamat hex yang valid")
	}

	// Check if buyer and seller are different
	if buyerWallet == sellerWallet {
		return apperrors.ErrInvalidOrderData.WithDetails("buyer dan seller harus berbeda")
	}

	// Validate amount
	if o.AmountUSDT == 0 {
		return apperrors.ErrInvalidOrderData.WithDetails("amount_usdt harus lebih besar dari 0")
	}

	// Optional: Add maximum amount check
	// if o.AmountUSDT > 1_000_000_000_000 { // 1M USDT max
	// 	return apperrors.ErrInvalidOrderData.WithDetails("amount_usdt terlalu besar")
	// }

	return nil
}

// AttachEscrowInput represents escrow attachment input
type AttachEscrowInput struct {
	OrderID       string
	EscrowAddress string
	TxHash        string
}

// Validate validates escrow attachment input
func (a *AttachEscrowInput) Validate() error {
	// Validate order ID
	orderID := normalizeOrderID(a.OrderID)
	if orderID == "" {
		return apperrors.ErrInvalidOrderData.WithDetails("order_id tidak valid")
	}
	a.OrderID = orderID

	// Validate escrow address
	escrowAddress := strings.ToLower(strings.TrimSpace(a.EscrowAddress))
	if escrowAddress == "" {
		return apperrors.ErrMissingField.WithDetails("escrow_address")
	}
	if !common.IsHexAddress(escrowAddress) {
		return apperrors.ErrInvalidOrderData.WithDetails("escrow_address tidak valid")
	}
	a.EscrowAddress = strings.ToLower(common.HexToAddress(escrowAddress).Hex())

	// Validate tx hash
	txHash := strings.TrimSpace(a.TxHash)
	if txHash == "" {
		return apperrors.ErrMissingField.WithDetails("tx_hash")
	}
	normalizedTxHash := strings.ToLower(strings.TrimPrefix(txHash, "0x"))
	if len(normalizedTxHash) != 64 {
		return apperrors.ErrInvalidOrderData.WithDetails("tx_hash harus 64 karakter hex")
	}
	if _, err := hex.DecodeString(normalizedTxHash); err != nil {
		return apperrors.ErrInvalidOrderData.WithDetails("tx_hash tidak valid")
	}
	a.TxHash = "0x" + normalizedTxHash

	return nil
}

// OrderIDInput represents order ID input
type OrderIDInput struct {
	OrderID string
}

// Validate validates order ID input
func (o *OrderIDInput) Validate() error {
	orderID := normalizeOrderID(o.OrderID)
	if orderID == "" {
		return apperrors.ErrInvalidOrderData.WithDetails("order_id tidak valid")
	}
	o.OrderID = orderID
	return nil
}

// normalizeOrderID normalizes order ID to standard format
func normalizeOrderID(raw string) string {
	id := strings.TrimSpace(raw)
	if id == "" {
		return ""
	}

	id = strings.ToLower(id)
	id = strings.TrimPrefix(id, "0x")

	if len(id) != 64 {
		return ""
	}
	if _, err := hex.DecodeString(id); err != nil {
		return ""
	}

	return "0x" + id
}
