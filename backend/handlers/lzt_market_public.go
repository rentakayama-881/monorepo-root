package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// GetPublicChatGPTAccounts exposes public listing with cache + graceful stale fallback.
func (h *LZTMarketHandler) GetPublicChatGPTAccounts(c *gin.Context) {
	if h == nil || h.client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Layanan marketplace tidak tersedia"})
		return
	}

	i18n := strings.TrimSpace(c.Query("i18n"))
	if i18n == "" {
		i18n = "en-US"
	}
	forceRefresh := strings.EqualFold(strings.TrimSpace(c.Query("refresh")), "true")
	resp, cached, stale, err := h.loadChatGPTListing(c.Request.Context(), i18n, forceRefresh)
	if err != nil {
		status := http.StatusBadGateway
		if errors.Is(err, services.ErrLZTRequestInvalid) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": "Gagal memuat data marketplace"})
		return
	}

	payload := h.withDisplayPricing(resp.JSON)
	response := gin.H{
		"cached": cached,
		"json":   payload,
	}
	if stale {
		response["stale"] = true
		response["warning"] = "Marketplace sedang memuat cache sementara."
	}
	c.JSON(http.StatusOK, response)
}

var itemIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)

const publicChatGPTCheckoutSunsetHeader = "Mon, 04 May 2026 00:00:00 GMT"

// GetPublicChatGPTCheckout returns checkout URL for a selected item.
func (h *LZTMarketHandler) GetPublicChatGPTCheckout(c *gin.Context) {
	itemID := strings.TrimSpace(c.Param("itemId"))
	if !itemIDPattern.MatchString(itemID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid item ID"})
		return
	}

	c.Header("Deprecation", "true")
	c.Header("Sunset", publicChatGPTCheckoutSunsetHeader)

	c.JSON(http.StatusOK, gin.H{
		"item_id":      itemID,
		"checkout_url": buildLZTItemURL(itemID),
		"note":         "Gunakan endpoint POST /api/market/chatgpt/orders untuk checkout internal.",
	})
}
