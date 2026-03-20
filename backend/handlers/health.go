package handlers

import (
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"backend-gin/buildinfo"
	"backend-gin/database"

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

// HealthHandler godoc
// @Summary      Health check
// @Description  Returns backend readiness information without touching the database.
// @Tags         Health
// @Produce      json
// @Success      200  {object}  handlers.SwaggerHealthResponse
// @Router       /health [get]
// HealthHandler responds with backend readiness information without touching the database.
func HealthHandler(c *gin.Context) {
	version := effectiveVersion()

	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"time":    time.Now().UTC().Format(time.RFC3339),
		"version": version,
	})
}

// ReadinessHandler godoc
// @Summary      Readiness check
// @Description  Provides detailed health status including database connectivity.
// @Tags         Health
// @Produce      json
// @Success      200  {object}  handlers.SwaggerReadinessResponse
// @Failure      503  {object}  handlers.SwaggerReadinessResponse
// @Router       /ready [get]
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

// HealthVersionHandler godoc
// @Summary      Get version info
// @Description  Returns deploy metadata including git SHA and build time, used to verify runtime version drift.
// @Tags         Health
// @Produce      json
// @Success      200  {object}  handlers.SwaggerHealthVersionResponse
// @Router       /health/version [get]
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

// MetricsEndpoint godoc
// @Summary      Prometheus metrics
// @Description  Exposes Prometheus-format metrics for monitoring. Served by promhttp.Handler().
// @Tags         Health
// @Produce      text/plain
// @Success      200  {string}  string  "Prometheus metrics output"
// @Router       /metrics [get]
func _metricsSwaggerDoc() {} // doc-only — actual handler is gin.WrapH(promhttp.Handler()) in main.go
