package middleware

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status_code"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	httpRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
	)
)

// PrometheusMiddleware returns a Gin middleware that records HTTP request
// metrics (total count, duration histogram, and in-flight gauge).
//
// Path labels are normalised using the Gin route template (c.FullPath()) to
// prevent cardinality explosion from dynamic segments.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip the metrics endpoint itself to avoid self-referential noise.
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		httpRequestsInFlight.Inc()
		start := time.Now()

		c.Next()

		httpRequestsInFlight.Dec()
		duration := time.Since(start).Seconds()

		// Use route template for normalised path (e.g. "/api/v1/user/:username").
		path := c.FullPath()
		if path == "" {
			path = "unknown"
		}
		// Convert Gin :param to Prometheus-friendly {param} convention.
		path = normalizePathParams(path)

		status := strconv.Itoa(c.Writer.Status())
		method := c.Request.Method

		httpRequestsTotal.WithLabelValues(method, path, status).Inc()
		httpRequestDuration.WithLabelValues(method, path).Observe(duration)
	}
}

// normalizePathParams converts Gin-style :param segments to {param} notation
// to keep Prometheus label values consistent and readable.
func normalizePathParams(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, ":") {
			parts[i] = "{" + part[1:] + "}"
		}
	}
	return strings.Join(parts, "/")
}
