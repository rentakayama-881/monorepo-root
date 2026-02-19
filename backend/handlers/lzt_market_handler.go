package handlers

import (
	"errors"
	"net/http"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

type LZTMarketHandler struct {
	client *services.LZTMarketClient
}

func NewLZTMarketHandler(client *services.LZTMarketClient) *LZTMarketHandler {
	return &LZTMarketHandler{client: client}
}

type lztProxyRequest struct {
	Method      string            `json:"method" binding:"required"`
	Path        string            `json:"path" binding:"required"`
	Query       map[string]string `json:"query"`
	ContentType string            `json:"content_type"`
	JSONBody    interface{}       `json:"json_body"`
	FormBody    map[string]string `json:"form_body"`
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
		"enabled":                  h.client.IsEnabled(),
		"base_url":                 h.client.BaseURL(),
		"timeout_seconds":          int(h.client.Timeout().Seconds()),
		"min_interval_millis":      int(h.client.MinInterval().Milliseconds()),
		"token_configured":         h.client.IsEnabled(),
		"integration_instructions": "Gunakan endpoint POST /admin/integrations/lzt/request dari frontend/admin panel agar token tetap aman di backend.",
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
