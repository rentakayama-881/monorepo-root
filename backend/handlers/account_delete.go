package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"backend-gin/config"
	"backend-gin/utils"

	"github.com/gin-gonic/gin"
)

// Password not required — RequireSudo middleware already verifies identity
type DeleteAccountRequest struct {
	Confirmation string `json:"confirmation" binding:"required"`
}

type FeatureServiceValidationResult struct {
	CanDelete          bool     `json:"canDelete"`
	BlockingReasons    []string `json:"blockingReasons"`
	Warnings           []string `json:"warnings"`
	WalletBalance      int64    `json:"walletBalance"`
	PendingTransfers   int      `json:"pendingTransfers"`
	DisputedTransfers  int      `json:"disputedTransfers"`
	PendingWithdrawals int      `json:"pendingWithdrawals"`
}

type FeatureServiceCleanupResult struct {
	Success        bool             `json:"success"`
	BlockingReason string           `json:"blockingReason"`
	DeletedCounts  map[string]int64 `json:"deletedCounts"`
}

// CanDeleteAccountHandler godoc
// @Summary      Check if account can be deleted
// @Description  Returns whether the authenticated user can delete their account, along with any blocking reasons (wallet balance, pending transfers, disputes).
// @Tags         Account
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  handlers.SwaggerCanDeleteResponse
// @Failure      401  {object}  handlers.SwaggerErrorResponse
// @Router       /account/can-delete [get]
// GET /api/account/can-delete
func CanDeleteAccountHandler(c *gin.Context) {
	user, ok := mustGetUser(c)
	if !ok {
		return
	}

	// Call Feature-Service to check validation
	result, err := callFeatureServiceValidation(c, uint(user.ID))
	if err != nil {
		// STRICT MODE: If Feature-Service is unavailable, block deletion for safety
		// This prevents users with wallet balance or pending transactions from deleting
		c.JSON(http.StatusOK, gin.H{
			"can_delete":          false,
			"blocking_reasons":    []string{"Layanan verifikasi wallet tidak tersedia. Coba lagi nanti."},
			"warnings":            []string{},
			"wallet_balance":      0,
			"pending_transfers":   0,
			"disputed_transfers":  0,
			"pending_withdrawals": 0,
			"service_unavailable": true,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"can_delete":          result.CanDelete,
		"blocking_reasons":    result.BlockingReasons,
		"warnings":            result.Warnings,
		"wallet_balance":      result.WalletBalance,
		"pending_transfers":   result.PendingTransfers,
		"disputed_transfers":  result.DisputedTransfers,
		"pending_withdrawals": result.PendingWithdrawals,
	})
}

func callFeatureServiceValidation(c *gin.Context, userID uint) (*FeatureServiceValidationResult, error) {
	url := fmt.Sprintf("%s/api/v1/user/%d/can-delete", config.FeatureServiceURL, userID)

	req, err := http.NewRequestWithContext(c.Request.Context(), "GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Forward the JWT token for authentication
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := utils.DefaultHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return nil, fmt.Errorf("feature-service error (status=%d, read body failed): %w", resp.StatusCode, readErr)
		}
		return nil, fmt.Errorf("feature-service error: %s", string(body))
	}

	var result FeatureServiceValidationResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
