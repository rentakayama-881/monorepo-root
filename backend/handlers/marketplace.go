package handlers

import (
	"net/http"
	"strings"

	"backend-gin/database"
	"backend-gin/models"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
)

// NOTE: Handlers are skeletons. Per instruction, backend must update state only after on-chain events.
// Implement event listeners and signature verification before mutating DB for orders/disputes.

// GET /api/orders/:id
func GetOrderHandler(c *gin.Context) {
	id := c.Param("id")
	_ = id
	// TODO: load order + related dispute/escrow info, join with user context
	c.JSON(http.StatusOK, gin.H{"todo": "GetOrderHandler not implemented yet"})
}

// PUT /api/orders/:id
func UpdateOrderHandler(c *gin.Context) {
	id := c.Param("id")
	_ = id
	// IMPORTANT: Do not change status here unless triggered by verified on-chain events.
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Order update only via on-chain events"})
}

// GET /api/disputes/escrow/:escrowAddress
func GetDisputeByEscrowID(c *gin.Context) {
	escrowAddress := strings.ToLower(strings.TrimSpace(c.Param("escrowAddress")))

	if !common.IsHexAddress(escrowAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "escrow_address tidak valid"})
		return
	}

	// Find order by escrow address
	var order models.Order
	if err := database.DB.Where("escrow_address = ?", escrowAddress).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	// Find dispute by order ID
	var dispute models.Dispute
	if err := database.DB.Where("order_id = ?", order.ID).First(&dispute).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dispute tidak ditemukan untuk escrow ini"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":               dispute.ID,
		"order_id":         dispute.OrderID,
		"escrow_address":   order.EscrowAddress,
		"evidence_hashes":  dispute.EvidenceHashes,
		"initiator":        dispute.Initiator,
		"status":           dispute.Status,
		"ruling_reference": dispute.RulingReference,
		"created_at":       dispute.CreatedAt,
	})
}

// POST /api/disputes/:escrowAddress/arbitrate
type ArbitrationVoteRequest struct {
	Decision       bool   `json:"decision" binding:"required"`      // true = release to seller, false = refund to buyer
	FeeOverrideBps uint16 `json:"fee_override_bps"`                 // optional fee override
	Reason         string `json:"reason" binding:"required,min=10"` // arbitration reasoning
}

func SubmitArbitrationVote(c *gin.Context) {
	escrowAddress := strings.ToLower(strings.TrimSpace(c.Param("escrowAddress")))

	if !common.IsHexAddress(escrowAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "escrow_address tidak valid"})
		return
	}

	var req ArbitrationVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format request tidak valid"})
		return
	}

	// Find order by escrow address
	var order models.Order
	if err := database.DB.Where("escrow_address = ?", escrowAddress).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order tidak ditemukan"})
		return
	}

	// Verify order is in disputed state
	if order.Status != models.OrderStatusDisputed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Order tidak dalam status disputed"})
		return
	}

	// Find or create dispute record
	var dispute models.Dispute
	if err := database.DB.Where("order_id = ?", order.ID).First(&dispute).Error; err != nil {
		// Create dispute if doesn't exist
		dispute = models.Dispute{
			OrderID:   order.ID,
			Initiator: "system",
			Status:    "open",
		}
		if err := database.DB.Create(&dispute).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat record dispute"})
			return
		}
	}

	// Update dispute with arbitration decision
	dispute.Status = "arbitrated"
	dispute.RulingReference = req.Reason
	if err := database.DB.Save(&dispute).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan keputusan arbitrasi"})
		return
	}

	// TODO: Call smart contract resolveAndExecute via ArbitrationAdapter
	// This requires:
	// 1. Arbitrator signature generation (EIP-712)
	// 2. Transaction submission to ArbitrationAdapter
	// 3. Event listener to update order status after on-chain resolution

	c.JSON(http.StatusOK, gin.H{
		"message":    "Keputusan arbitrasi berhasil disimpan",
		"dispute_id": dispute.ID,
		"decision":   req.Decision,
		"next_step":  "Keputusan akan dieksekusi on-chain melalui ArbitrationAdapter",
		"note":       "Smart contract integration belum lengkap - implementasi on-chain execution diperlukan",
	})
}

// GET /api/chainlink/rate
// Returns Chainlink USDT/IDR rate. For sprint draft, provide stubbed value with TODO to wire on-chain read.
func GetChainlinkRateHandler(c *gin.Context) {
	// TODO: Replace with on-chain call via Chainlink AggregatorV3 interface for USDT/IDR on Polygon.
	c.JSON(http.StatusOK, gin.H{
		"pair":   "USDT/IDR",
		"source": "chainlink",
		"value":  nil, // placeholder, front-end should handle null until wired
		"note":   "To be implemented using on-chain read",
	})
}
