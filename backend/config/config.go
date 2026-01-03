package config

import (
	"log"
	"os"
	"strconv"
)

var (
	JWTKey []byte

	// Fee Configuration
	WithdrawalFee    int64   // Flat withdrawal fee in IDR
	EscrowFeePercent float64 // Escrow fee percentage (e.g., 2.0 for 2%)

	// Minimum Withdrawal Thresholds
	MinWithdrawalDefault      int64 // Default minimum withdrawal
	MinWithdrawalTier1        int64 // Min withdrawal for users with tx >= Tier1Threshold
	MinWithdrawalTier2        int64 // Min withdrawal for users with tx >= Tier2Threshold
	Tier1TransactionThreshold int64 // Transaction threshold for Tier 1
	Tier2TransactionThreshold int64 // Transaction threshold for Tier 2

	// Settlement Days (Faspay)
	SettlementDaysBank    int // H+N for bank transfer/VA
	SettlementDaysQRIS    int // H+N for QRIS
	SettlementDaysEwallet int // H+N for e-wallets
	SettlementDaysCard    int // H+N for credit/debit cards
)

func InitConfig() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("ERROR: JWT_SECRET is not set in environment variables")
	}
	JWTKey = []byte(secret)

	// Initialize fee configuration with defaults
	WithdrawalFee = getEnvAsInt64("WITHDRAWAL_FEE", 2500)
	EscrowFeePercent = getEnvAsFloat64("ESCROW_FEE_PERCENT", 2.0)

	// Minimum withdrawal tiers
	MinWithdrawalDefault = getEnvAsInt64("MIN_WITHDRAWAL_DEFAULT", 10000)
	MinWithdrawalTier1 = getEnvAsInt64("MIN_WITHDRAWAL_TIER1", 400000)
	MinWithdrawalTier2 = getEnvAsInt64("MIN_WITHDRAWAL_TIER2", 900000)
	Tier1TransactionThreshold = getEnvAsInt64("TIER1_TX_THRESHOLD", 1000000)
	Tier2TransactionThreshold = getEnvAsInt64("TIER2_TX_THRESHOLD", 30000000)

	// Settlement days (Faspay)
	SettlementDaysBank = getEnvAsInt("SETTLEMENT_DAYS_BANK", 1)
	SettlementDaysQRIS = getEnvAsInt("SETTLEMENT_DAYS_QRIS", 1)
	SettlementDaysEwallet = getEnvAsInt("SETTLEMENT_DAYS_EWALLET", 2)
	SettlementDaysCard = getEnvAsInt("SETTLEMENT_DAYS_CARD", 3)
}

// getEnvAsInt64 returns environment variable as int64 or default value
func getEnvAsInt64(key string, defaultVal int64) int64 {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.ParseInt(val, 10, 64); err == nil {
			return intVal
		}
	}
	return defaultVal
}

// getEnvAsFloat64 returns environment variable as float64 or default value
func getEnvAsFloat64(key string, defaultVal float64) float64 {
	if val := os.Getenv(key); val != "" {
		if floatVal, err := strconv.ParseFloat(val, 64); err == nil {
			return floatVal
		}
	}
	return defaultVal
}

// getEnvAsInt returns environment variable as int or default value
func getEnvAsInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}

// GetMinWithdrawalForUser returns minimum withdrawal based on user's total transaction volume
func GetMinWithdrawalForUser(totalTransactionVolume int64) int64 {
	if totalTransactionVolume >= Tier2TransactionThreshold {
		return MinWithdrawalTier2
	}
	if totalTransactionVolume >= Tier1TransactionThreshold {
		return MinWithdrawalTier1
	}
	return MinWithdrawalDefault
}

// CalculateEscrowFee calculates the escrow fee for a transaction
func CalculateEscrowFee(amount int64) int64 {
	return int64(float64(amount) * EscrowFeePercent / 100)
}

// GetSettlementDays returns settlement days based on payment method
func GetSettlementDays(paymentMethod string) int {
	switch paymentMethod {
	case "bank_transfer", "va", "virtual_account":
		return SettlementDaysBank
	case "qris":
		return SettlementDaysQRIS
	case "ewallet", "ovo", "dana", "gopay", "shopeepay", "linkaja":
		return SettlementDaysEwallet
	case "credit_card", "debit_card", "card":
		return SettlementDaysCard
	default:
		return SettlementDaysBank // Default to bank settlement
	}
}
