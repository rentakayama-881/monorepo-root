package worker

import (
	"context"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	"backend-gin/database"
	"backend-gin/models"
	"backend-gin/utils"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
)

const erc20ABI = `[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}]`

func RunDepositMonitor() {
	go func() {
		for {
			checkAllDeposits()
			time.Sleep(30 * time.Second)
		}
	}()
}

func checkAllDeposits() {
	// ===== 0) Distributed lock (hindari double-credit kalau ada >1 instance) =====
	// Ganti key sesuai selera (harus konsisten)
	const lockKey int64 = 991234567
	var locked bool
	if err := database.DB.Raw("SELECT pg_try_advisory_lock(?)", lockKey).Scan(&locked).Error; err != nil {
		log.Println("[MONITOR] advisory lock error:", err)
		return
	}
	if !locked {
		// instance lain sedang memproses
		return
	}
	defer func() {
		_ = database.DB.Exec("SELECT pg_advisory_unlock(?)", lockKey).Error
	}()

	// ===== 1) Ambil semua deposit addresses =====
	var addresses []database.DepositAddress
	if err := database.DB.Find(&addresses).Error; err != nil {
		log.Println("[MONITOR] DB error:", err)
		return
	}
	if len(addresses) == 0 {
		return
	}

	// ===== 2) Init RPC client (sekali per siklus) =====
	rpcURL := os.Getenv("POLYGON_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://polygon-rpc.com"
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Println("[MONITOR] Polygon RPC error:", err)
		return
	}
	defer client.Close()

	// ===== 3) Parse ABI (sekali per siklus) =====
	erc20, err := abi.JSON(strings.NewReader(erc20ABI))
	if err != nil {
		log.Println("[MONITOR] ERC20 ABI error:", err)
		return
	}

	// ===== 4) Ambil rate CoinGecko SEKALI (bukan per address) =====
	coinID := os.Getenv("POLYGONECOSYSTEMTOKEN_COINGECKO_ID")
	if coinID == "" {
		coinID = "matic-network"
	}
	rateIDR, err := utils.GetTokenToIDRRate(coinID)
	if err != nil {
		log.Println("[MONITOR] Gagal ambil rate IDR:", err)
		return
	}

	// ===== 5) Token address (Polygon “Matic Token” address yang expose balanceOf) =====
	// Kalau kamu pakai ERC20 lain, override via env.
	tokenAddress := os.Getenv("DEPOSIT_TOKEN_ADDRESS")
	if tokenAddress == "" {
		tokenAddress = "0x0000000000000000000000000000000000001010"
	}

	// ===== 6) Loop addresses =====
	for _, dep := range addresses {
		userID := dep.UserID
		addr := common.HexToAddress(dep.Address)

		balWei, err := getERC20Balance(client, erc20, tokenAddress, addr)
		if err != nil {
			log.Printf("[MONITOR] Gagal cek saldo %s: %v", dep.Address, err)
			continue
		}

		// ===== 6a) Ambil prevWei dari DB (string), baseline kalau kosong =====
		prevWei := new(big.Int)
		if dep.LastBalanceWei != "" && dep.LastBalanceWei != "0" {
			_, ok := prevWei.SetString(dep.LastBalanceWei, 10)
			if !ok {
				// kalau format kacau, baseline ulang
				prevWei = big.NewInt(0)
			}
		}

		// Kalau ini pertama kali migrasi (prevWei==0 dan lastBalance legacy ada),
		// kita baseline ke saldo saat ini agar tidak double-credit.
		if prevWei.Sign() == 0 && dep.LastBalance > 0 {
			// baseline saja (no credit)
			_ = database.DB.Model(&database.DepositAddress{}).
				Where("id = ?", dep.ID).
				Updates(map[string]any{
					"last_balance_wei": balWei.String(),
					"last_balance":     weiToFloat(balWei), // opsional, tetap sync legacy
				}).Error
			continue
		}

		cmp := balWei.Cmp(prevWei)

		// ===== 6b) Jika saldo turun (karena sweep/withdraw), reset baseline =====
		if cmp < 0 {
			if err := database.DB.Model(&database.DepositAddress{}).
				Where("id = ?", dep.ID).
				Updates(map[string]any{
					"last_balance_wei": balWei.String(),
					"last_balance":     weiToFloat(balWei),
				}).Error; err != nil {
				log.Println("[MONITOR] gagal reset baseline:", err)
			}
			continue
		}

		// ===== 6c) Jika tidak naik, skip =====
		if cmp == 0 {
			continue
		}

		// ===== 6d) Naik: hitung delta =====
		deltaWei := new(big.Int).Sub(balWei, prevWei)
		receivedToken := weiToFloat(deltaWei) // token desimal 18 → float (sementara)
		if receivedToken <= 0 {
			continue
		}

		// Fee deposit 2%
		netToken := receivedToken * 0.98
		netIDR := netToken * rateIDR
		if netIDR <= 0 {
			continue
		}

		// ===== 6e) Update atomik dalam transaction =====
		err = database.DB.Transaction(func(tx *gorm.DB) error {
			// 1) increment saldo user (pakai expr supaya aman dari race)
			if err := tx.Model(&models.User{}).
				Where("id = ?", userID).
				Update("balance", gorm.Expr("balance + ?", netIDR)).Error; err != nil {
				return err
			}

			// 2) update last balance (wei) untuk idempotency
			if err := tx.Model(&database.DepositAddress{}).
				Where("id = ?", dep.ID).
				Updates(map[string]any{
					"last_balance_wei": balWei.String(),
					"last_balance":     weiToFloat(balWei), // legacy sync (opsional)
				}).Error; err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			log.Println("[MONITOR] tx update error:", err)
			continue
		}

		log.Printf("[MONITOR] Deposit %s: +%.8f token (fee 2%%) => Rp %.2f (rate %.2f)",
			dep.Address, netToken, netIDR, rateIDR)
	}
}

// balanceOf ERC20
func getERC20Balance(client *ethclient.Client, erc20 abi.ABI, tokenAddr string, owner common.Address) (*big.Int, error) {
	contractAddress := common.HexToAddress(tokenAddr)
	data, err := erc20.Pack("balanceOf", owner)
	if err != nil {
		return nil, err
	}
	callMsg := ethereum.CallMsg{To: &contractAddress, Data: data}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	output, err := client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return nil, err
	}
	out := new(big.Int)
	// UnpackIntoInterface untuk big.Int agak “nyeleneh”; cara aman: Unpack dan cast
	var res []any
	res, err = erc20.Unpack("balanceOf", output)
	if err != nil {
		return nil, err
	}
	if len(res) != 1 {
		return nil, err
	}
	b, ok := res[0].(*big.Int)
	if !ok {
		return nil, err
	}
	out.Set(b)
	return out, nil
}

// wei (1e18) -> float token (sementara)
func weiToFloat(val *big.Int) float64 {
	f := new(big.Float).SetInt(val)
	decimals := new(big.Float).SetFloat64(1e18)
	f.Quo(f, decimals)
	res, _ := f.Float64()
	return res
}

