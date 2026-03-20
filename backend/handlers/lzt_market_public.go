package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// GetPublicChatGPTAccounts godoc
// @Summary      List ChatGPT accounts
// @Description  Returns cached marketplace listing of available ChatGPT accounts with pricing in IDR.
// @Tags         Market
// @Produce      json
// @Param        i18n     query     string  false  "Locale code"    default(en-US)
// @Param        refresh  query     string  false  "Force cache refresh"  Enums(true,false)
// @Success      200  {object}  handlers.SwaggerMarketListingResponse
// @Failure      400  {object}  handlers.SwaggerErrorResponse
// @Failure      502  {object}  handlers.SwaggerErrorResponse
// @Failure      503  {object}  handlers.SwaggerErrorResponse
// @Router       /market/chatgpt [get]
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

// GetPublicChatGPTCheckout godoc
// @Summary      Get checkout info (deprecated)
// @Description  Returns checkout URL for a selected item. Deprecated — use POST /market/chatgpt/orders instead.
// @Tags         Market
// @Produce      json
// @Deprecated
// @Param        itemId  path      string  true  "Marketplace item ID"
// @Success      200     {object}  handlers.SwaggerMarketCheckoutResponse
// @Failure      400     {object}  handlers.SwaggerErrorResponse
// @Router       /market/chatgpt/{itemId}/checkout [get]
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
