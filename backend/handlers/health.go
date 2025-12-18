package handlers

import (
	"net/http"
	"os"
	"time"

	"backend-gin/config"
	"github.com/gin-gonic/gin"
)

// HealthHandler responds with backend readiness information without touching the database.
func HealthHandler(c *gin.Context) {
	version := os.Getenv("VERSION")
	if version == "" {
		version = "dev"
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":             true,
		"time":           time.Now().UTC().Format(time.RFC3339),
		"chain_id":       config.ChainID.Int64(),
		"escrow_factory": config.EscrowFactoryAddress.Hex(),
		"backend_signer": config.BackendSignerAddress.Hex(),
		"version":        version,
	})
}
