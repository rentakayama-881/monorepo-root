package handlers

import (
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthHandler responds with backend readiness information without touching the database.
func HealthHandler(c *gin.Context) {
	version := os.Getenv("VERSION")
	if version == "" {
		version = "dev"
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"time":    time.Now().UTC().Format(time.RFC3339),
		"version": version,
	})
}
