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
)

// Ganti dengan kontrak token PolygonEcosystemToken jika bukan MATIC!
const tokenAddress = "0x0000000000000000000000000000000000001010" // contoh: native MATIC, ganti jika pakai ERC20

var rpcURL = "https://polygon-rpc.com"

const erc20ABI = `[{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"}]`

func RunDepositMonitor() {
	go func() {
		for {
			checkAllDeposits()
			time.Sleep(30 * time.Second) // interval scan
		}
	}()
}

func checkAllDeposits() {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Println("Polygon RPC error:", err)
		return
	}
	defer client.Close()

	var addresses []database.DepositAddress
	if err := database.DB.Find(&addresses).Error; err != nil {
		log.Println("DB error:", err)
		return
	}

	erc20, err := abi.JSON(strings.NewReader(erc20ABI))
	if err != nil {
		log.Println("ERC20 ABI error:", err)
		return
	}

	for _, dep := range addresses {
		user := models.User{}
		if err := database.DB.Where("id = ?", dep.UserID).First(&user).Error; err != nil {
			continue
		}
		addr := common.HexToAddress(dep.Address)

		// Cek balance ERC20
		bal, err := getERC20Balance(client, erc20, tokenAddress, addr)
		if err != nil {
			log.Printf("Gagal cek saldo %s: %v", dep.Address, err)
			continue
		}

		// Use per-address last balance tracking to detect deltas
		prev := dep.LastBalance
		balFloat := weiToFloat(bal)

		if balFloat > prev+1e-12 { // threshold to avoid float noise
			received := balFloat - prev
			// Potong fee 2%
			netToken := received * 0.98
			// Konversi realtime ke IDR
			coinID := os.Getenv("POLYGONECOSYSTEMTOKEN_COINGECKO_ID")
			if coinID == "" { coinID = "matic-network" }
			rate, err := utils.GetTokenToIDRRate(coinID)
			if err != nil {
				log.Println("[MONITOR] Gagal ambil rate IDR:", err)
				continue
			}
			netIDR := netToken * rate
			user.Balance += netIDR
			// Update last observed balance on the deposit address
			dep.LastBalance = balFloat
			// Simpan ke DB atomically-ish
			database.DB.Save(&user)
			database.DB.Save(&dep)
			log.Printf("[MONITOR] Deposit ke %s: %.8f token (fee 2%%) => Rp %.2f | Total saldo IDR: Rp %.2f", dep.Address, netToken, netIDR, user.Balance)
		}
	}
}

// Fungsi untuk ambil balance ERC20
func getERC20Balance(client *ethclient.Client, erc20 abi.ABI, tokenAddr string, owner common.Address) (*big.Int, error) {
	contractAddress := common.HexToAddress(tokenAddr)
	data, err := erc20.Pack("balanceOf", owner)
	if err != nil {
		return nil, err
	}
	callMsg := ethereum.CallMsg{
		To:   &contractAddress,
		Data: data,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	output, err := client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return nil, err
	}
	out := new(big.Int)
	erc20.UnpackIntoInterface(&out, "balanceOf", output)
	return out, nil
}

// Konversi wei ke float (token desimal 18)
func weiToFloat(val *big.Int) float64 {
	f := new(big.Float).SetInt(val)
	decimals := new(big.Float).SetFloat64(1e18)
	f.Quo(f, decimals)
	res, _ := f.Float64()
	return res
}
