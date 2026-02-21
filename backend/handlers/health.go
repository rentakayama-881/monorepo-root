package handlers

import (
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"backend-gin/buildinfo"
	"backend-gin/database"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

func readBuildSetting(key string) string {
	info, ok := debug.ReadBuildInfo()
	if !ok || info == nil {
		return ""
	}

	for _, setting := range info.Settings {
		if setting.Key == key {
			return strings.TrimSpace(setting.Value)
		}
	}

	return ""
}

func effectiveVersion() string {
	if v := strings.TrimSpace(buildinfo.Version); v != "" && v != "dev" {
		return v
	}

	if v := strings.TrimSpace(os.Getenv("VERSION")); v != "" {
		return v
	}

	if v := readBuildSetting("vcs.revision"); v != "" {
		return v
	}

	return "1.0.0"
}

func effectiveGitSHA() string {
	if v := strings.TrimSpace(buildinfo.Version); v != "" && v != "dev" {
		return v
	}

	if v := strings.TrimSpace(os.Getenv("GIT_SHA")); v != "" {
		return v
	}

	if v := strings.TrimSpace(os.Getenv("SOURCE_VERSION")); v != "" {
		return v
	}

	if v := readBuildSetting("vcs.revision"); v != "" {
		return v
	}

	return "unknown"
}

func effectiveBuildTimeUTC() string {
	if v := strings.TrimSpace(os.Getenv("BUILD_TIME_UTC")); v != "" {
		return v
	}

	if v := readBuildSetting("vcs.time"); v != "" {
		return v
	}

	return "unknown"
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

// HealthVersionHandler responds with deploy metadata used to verify runtime SHA drift.
func HealthVersionHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":         "ok",
		"service":        "backend-gin",
		"version":        effectiveVersion(),
		"git_sha":        effectiveGitSHA(),
		"build_time_utc": effectiveBuildTimeUTC(),
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	})
}
