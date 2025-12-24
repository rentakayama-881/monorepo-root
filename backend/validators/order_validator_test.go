package validators

import (
	"testing"

	apperrors "backend-gin/errors"

	"github.com/stretchr/testify/assert"
)

func TestCreateOrderInput_Validate_Valid(t *testing.T) {
	tests := []struct {
		name  string
		input CreateOrderInput
	}{
		{
			name: "Valid order with small amount",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
				AmountUSDT:   1000000, // 1 USDT
			},
		},
		{
			name: "Valid order with large amount",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
				AmountUSDT:   1000000000000, // 1M USDT
			},
		},
		{
			name: "Valid order with user ID",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
				AmountUSDT:   500000,
				BuyerUserID:  uintPtr(123),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.NoError(t, err)
		})
	}
}

func TestCreateOrderInput_Validate_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		input       CreateOrderInput
		expectedErr *apperrors.AppError
	}{
		{
			name: "Empty buyer wallet",
			input: CreateOrderInput{
				BuyerWallet:  "",
				SellerWallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
				AmountUSDT:   1000000,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Empty seller wallet",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "",
				AmountUSDT:   1000000,
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Invalid buyer wallet format",
			input: CreateOrderInput{
				BuyerWallet:  "not-an-address",
				SellerWallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
				AmountUSDT:   1000000,
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Invalid seller wallet format",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "invalid",
				AmountUSDT:   1000000,
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Same buyer and seller",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				AmountUSDT:   1000000,
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Zero amount",
			input: CreateOrderInput{
				BuyerWallet:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				SellerWallet: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
				AmountUSDT:   0,
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.Error(t, err)
			if appErr, ok := err.(*apperrors.AppError); ok {
				assert.Equal(t, tt.expectedErr.Code, appErr.Code)
			}
		})
	}
}

func TestAttachEscrowInput_Validate_Valid(t *testing.T) {
	input := AttachEscrowInput{
		OrderID:       "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		EscrowAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
		TxHash:        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
	}

	err := input.Validate()
	assert.NoError(t, err)
	// Check normalization
	assert.Equal(t, "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", input.OrderID)
	assert.Contains(t, input.EscrowAddress, "0x")
	assert.Equal(t, "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890", input.TxHash)
}

func TestAttachEscrowInput_Validate_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		input       AttachEscrowInput
		expectedErr *apperrors.AppError
	}{
		{
			name: "Invalid order ID - too short",
			input: AttachEscrowInput{
				OrderID:       "0x123",
				EscrowAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				TxHash:        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Invalid order ID - not hex",
			input: AttachEscrowInput{
				OrderID:       "not-a-valid-order-id-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
				EscrowAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				TxHash:        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Empty escrow address",
			input: AttachEscrowInput{
				OrderID:       "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				EscrowAddress: "",
				TxHash:        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Invalid escrow address",
			input: AttachEscrowInput{
				OrderID:       "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				EscrowAddress: "not-an-address",
				TxHash:        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Empty tx hash",
			input: AttachEscrowInput{
				OrderID:       "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				EscrowAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				TxHash:        "",
			},
			expectedErr: apperrors.ErrMissingField,
		},
		{
			name: "Invalid tx hash - too short",
			input: AttachEscrowInput{
				OrderID:       "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				EscrowAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				TxHash:        "0x123",
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
		{
			name: "Invalid tx hash - not hex",
			input: AttachEscrowInput{
				OrderID:       "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				EscrowAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
				TxHash:        "0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
			},
			expectedErr: apperrors.ErrInvalidOrderData,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.input.Validate()
			assert.Error(t, err)
			if appErr, ok := err.(*apperrors.AppError); ok {
				assert.Equal(t, tt.expectedErr.Code, appErr.Code)
			}
		})
	}
}

func TestOrderIDInput_Validate(t *testing.T) {
	t.Run("Valid order ID", func(t *testing.T) {
		input := OrderIDInput{
			OrderID: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		}
		err := input.Validate()
		assert.NoError(t, err)
		assert.Equal(t, "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", input.OrderID)
	})

	t.Run("Valid order ID without 0x prefix", func(t *testing.T) {
		input := OrderIDInput{
			OrderID: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		}
		err := input.Validate()
		assert.NoError(t, err)
		assert.Equal(t, "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", input.OrderID)
	})

	t.Run("Invalid order ID - empty", func(t *testing.T) {
		input := OrderIDInput{
			OrderID: "",
		}
		err := input.Validate()
		assert.Error(t, err)
		appErr, ok := err.(*apperrors.AppError)
		assert.True(t, ok)
		assert.Equal(t, apperrors.ErrInvalidOrderData.Code, appErr.Code)
	})

	t.Run("Invalid order ID - too short", func(t *testing.T) {
		input := OrderIDInput{
			OrderID: "0x123",
		}
		err := input.Validate()
		assert.Error(t, err)
	})
}

// Helper function to create uint pointer
func uintPtr(u uint) *uint {
	return &u
}
