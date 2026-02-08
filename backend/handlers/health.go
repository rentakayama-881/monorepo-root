package handlers

import (
	"net/http"
	"os"
	"strings"
	"time"

	"backend-gin/buildinfo"
	"backend-gin/database"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

func effectiveVersion() string {
	if v := strings.TrimSpace(buildinfo.Version); v != "" && v != "dev" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv("VERSION")); v != "" {
		return v
	}
	return "1.0.0"
}

// HealthHandler responds with backend readiness information without touching the database.
func HealthHandler(c *gin.Context) {
	version := effectiveVersion()

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"time":    time.Now().UTC().Format(time.RFC3339),
		"version": version,
	})
}

// ReadinessHandler provides detailed health status including dependencies
func ReadinessHandler(c *gin.Context) {
	version := effectiveVersion()

	checks := make(map[string]string)
	allHealthy := true

	// Check database
	if database.GetEntClient() != nil {
		checks["database"] = "healthy"
	} else {
		checks["database"] = "unhealthy"
		allHealthy = false
	}

	// Check Redis (optional)
	if services.IsRedisAvailable() {
		checks["redis"] = "healthy"
	} else {
		checks["redis"] = "not_configured"
		// Redis is optional, so don't mark as unhealthy
	}

	status := http.StatusOK
	if !allHealthy {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"ok":      allHealthy,
		"time":    time.Now().UTC().Format(time.RFC3339),
		"version": version,
		"checks":  checks,
		"mode":    os.Getenv("GIN_MODE"),
	})
}
