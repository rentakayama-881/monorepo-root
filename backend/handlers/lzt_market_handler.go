package handlers

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"backend-gin/logger"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type LZTMarketHandler struct {
	client        *services.LZTMarketClient
	featureWallet *services.FeatureWalletClient
	fxRates       *services.FXRateService

	cacheMu           sync.RWMutex
	cachedChatGPT     *services.LZTMarketResponse
	cachedChatGPTAt   time.Time
	cachedChatGPTI18n string
	cacheTTL          time.Duration

	listingFlightMu sync.Mutex
	listingFlights  map[string]*chatGPTListingFlight

	bgRefreshStop chan struct{}
}

func NewLZTMarketHandler(client *services.LZTMarketClient) *LZTMarketHandler {
	cacheSeconds := readPositiveIntEnvLocal("MARKET_CHATGPT_CACHE_SECONDS", 300)
	return &LZTMarketHandler{
		client:         client,
		featureWallet:  services.NewFeatureWalletClientFromConfig(),
		fxRates:        services.NewFXRateServiceFromEnv(),
		cacheTTL:       time.Duration(cacheSeconds) * time.Second,
		listingFlights: make(map[string]*chatGPTListingFlight),
		bgRefreshStop:  make(chan struct{}),
	}
}

// StartBackgroundRefresh launches a goroutine that continuously keeps the
// listing cache fresh. Call this from main after constructing the handler.
func (h *LZTMarketHandler) StartBackgroundRefresh() {
	if h == nil || h.client == nil || !h.client.IsEnabled() {
		return
	}
	const (
		baseInterval = 2 * time.Minute
		maxInterval  = 15 * time.Minute
	)
	go func() {
		interval := baseInterval
		for {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			resp, err := h.fetchAggregatedChatGPTListing(ctx, "en-US")
			cancel()
			if err == nil && resp != nil {
				h.setCachedChatGPT("en-US", resp)
				interval = baseInterval // reset on success
				if root, ok := resp.JSON.(map[string]interface{}); ok {
					if loaded, lok := root["loaded_items"]; lok {
						logger.Info("market bg refresh: cache updated",
							zap.Any("items_loaded", loaded))
					}
				}
			} else if err != nil {
				// Exponential backoff with cap on consecutive failures
				interval = min(interval*2, maxInterval)
				logger.Warn("market bg refresh failed, backing off",
					zap.Duration("next_interval", interval),
					zap.Error(err))
			}
			select {
			case <-h.bgRefreshStop:
				return
			case <-time.After(interval):
			}
		}
	}()
}

func (h *LZTMarketHandler) GetConfig(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"enabled": false,
			"error":   "LZT client not initialized",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"enabled":                    h.client.IsEnabled(),
		"base_url":                   h.client.BaseURL(),
		"timeout_seconds":            int(h.client.Timeout().Seconds()),
		"min_interval_millis":        int(h.client.MinInterval().Milliseconds()),
		"search_min_interval_millis": int(h.client.SearchMinInterval().Milliseconds()),
		"token_configured":           h.client.IsEnabled(),
		"integration_instructions":   "Gunakan endpoint POST /admin/integrations/lzt/request dari frontend/admin panel agar token tetap aman di backend.",
	})
}

func (h *LZTMarketHandler) ProxyRequest(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "LZT client not initialized"})
		return
	}

	var req lztProxyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request payload",
		})
		return
	}

	resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method:      req.Method,
		Path:        req.Path,
		Query:       req.Query,
		ContentType: req.ContentType,
		JSONBody:    req.JSONBody,
		FormBody:    req.FormBody,
	})
	if err != nil {
		status := http.StatusBadGateway
		msg := "Layanan market sedang tidak tersedia. Silakan coba lagi."
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
			msg = "Permintaan tidak valid."
		}
		logger.Warn("market proxy request failed",
			zap.String("path", req.Path),
			zap.Error(err))
		c.JSON(status, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upstream_status":  resp.StatusCode,
		"upstream_headers": resp.Headers,
		"json":             resp.JSON,
		"raw":              resp.Raw,
	})
}

// GetChatGPTAccounts fetches /chatgpt from LZT Market API via backend.
func (h *LZTMarketHandler) GetChatGPTAccounts(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "LZT client not initialized"})
		return
	}

	resp, err := h.client.Do(c.Request.Context(), services.LZTMarketRequest{
		Method:         http.MethodGet,
		Path:           "/chatgpt",
		RateLimitClass: services.LZTRateLimitClassSearch,
		Query: map[string]string{
			"i18n": "en-US",
		},
	})
	if err != nil {
		status := http.StatusBadGateway
		msg := "Layanan market sedang tidak tersedia. Silakan coba lagi."
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
			msg = "Permintaan tidak valid."
		}
		logger.Warn("market chatgpt fetch failed", zap.Error(err))
		c.JSON(status, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upstream_status":  resp.StatusCode,
		"upstream_headers": resp.Headers,
		"json":             resp.JSON,
		"raw":              resp.Raw,
	})
}
