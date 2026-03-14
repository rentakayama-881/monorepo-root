package handlers

import (
	"errors"
	"net/http"
	"sync"
	"time"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
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
}

func NewLZTMarketHandler(client *services.LZTMarketClient) *LZTMarketHandler {
	cacheSeconds := readPositiveIntEnvLocal("MARKET_CHATGPT_CACHE_SECONDS", 60)
	return &LZTMarketHandler{
		client:         client,
		featureWallet:  services.NewFeatureWalletClientFromConfig(),
		fxRates:        services.NewFXRateServiceFromEnv(),
		cacheTTL:       time.Duration(cacheSeconds) * time.Second,
		listingFlights: make(map[string]*chatGPTListingFlight),
	}
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
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{
			"error": err.Error(),
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
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{
			"error": err.Error(),
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
