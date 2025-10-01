package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"backend-gin/utils"
	"backend-gin/database"
	"backend-gin/models"
)

// GET /api/balance/refill/info
func GetRefillBalanceInfoHandler(c *gin.Context) {
	// 1. Ambil rate realtime (misal ke CoinGecko)
	rate, err := utils.GetTokenToIDRRate(os.Getenv("POLYGONECOSYSTEMTOKEN_COINGECKO_ID"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil rate"})
		return
	}
	// 2. Info jaringan & token
	resp := gin.H{
		"token": "POL",
		"rate_idr": rate,
		"fee_percent": 2,
		"network": gin.H{
			"name": "Polygon Mainnet",
			"explorer": "https://polygonscan.com",
			"rpc_url": "https://polygon-rpc.com",
		},
		"info": "Pastikan hanya mengirim PolygonEcosystemToken ke deposit address yang diberikan. Fee deposit 2% (tidak termasuk biaya jaringan Polygon).",
	}
	c.JSON(http.StatusOK, resp)
}

// GET /api/balance/refill/address
func GetRefillDepositAddressHandler(c *gin.Context) {
	userIfc, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	user := userIfc.(*models.User)

	// 1. Cek di database, apakah sudah punya deposit address
	addr, err := database.GetOrCreateUserDepositAddress(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mendapatkan address"})
		return
	}

	// 2. Compose response (network info, token, dsb)
	resp := gin.H{
		"deposit_address": addr,
		"token": "POL",
		"network": gin.H{
			"name": "Polygon Mainnet",
			"explorer": "https://polygonscan.com",
		},
		"info": "Pastikan Anda hanya mengirim PolygonEcosystemToken pada jaringan Polygon (Chain ID 137/0x89). Fee deposit 2% (tidak termasuk biaya jaringan Polygon).",
	}
	c.JSON(http.StatusOK, resp)
}
