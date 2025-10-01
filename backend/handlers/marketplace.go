package handlers

import (
	"net/http"

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

// GET /api/disputes/:id
func GetDisputeHandler(c *gin.Context) {
	id := c.Param("id")
	_ = id
	c.JSON(http.StatusOK, gin.H{"todo": "GetDisputeHandler not implemented yet"})
}

// POST /api/disputes/:id
// Accepts client intents like "addEvidence" or "open" but real state moves on-chain.
func PostDisputeActionHandler(c *gin.Context) {
	id := c.Param("id")
	_ = id
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Dispute actions must be executed on-chain via arbitrator"})
}

// GET /api/chainlink/rate
// Returns Chainlink USDT/IDR rate. For sprint draft, provide stubbed value with TODO to wire on-chain read.
func GetChainlinkRateHandler(c *gin.Context) {
	// TODO: Replace with on-chain call via Chainlink AggregatorV3 interface for USDT/IDR on Polygon.
	c.JSON(http.StatusOK, gin.H{
		"pair": "USDT/IDR",
		"source": "chainlink",
		"value": nil, // placeholder, front-end should handle null until wired
		"note": "To be implemented using on-chain read",
	})
}
