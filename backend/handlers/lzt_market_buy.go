package handlers

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"backend-gin/services"

	"go.uber.org/zap"
)

func (h *LZTMarketHandler) buyChatGPTItem(ctx context.Context, itemID, i18n string, price float64) (*services.LZTMarketResponse, string, error) {
	method := strings.ToUpper(strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_METHOD")))
	if method == "" {
		method = http.MethodPost
	}

	contentType := strings.ToLower(strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_CONTENT_TYPE")))
	if contentType == "" {
		contentType = "json"
	}

	maxRetries := readPositiveIntEnvLocal("LZT_MARKET_BUY_MAX_RETRIES", 100)
	if maxRetries < 1 {
		maxRetries = 1
	}

	fastBuyPath := normalizeProviderPath(
		strings.TrimSpace(os.Getenv("LZT_MARKET_BUY_PATH_TEMPLATE")),
		"/{item_id}/fast-buy",
		itemID,
	)

	fastBuyResp, fastBuyErr, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        fastBuyPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
		JSONBody: map[string]interface{}{
			"price": price,
		},
	}, maxRetries)
	if fastBuyErr != nil {
		return nil, "Provider transport error", fastBuyErr
	}
	if fastBuyResp == nil {
		return nil, "Provider returned empty response", errors.New("provider buy request returned no response")
	}
	if isSuccessfulPurchaseResponse(fastBuyResp) {
		return fastBuyResp, "", nil
	}

	fastBuyFailureReason := normalizeProviderFailureReason(fastBuyResp, "Fast-buy failed")
	if !readBoolEnvLocal("LZT_MARKET_BUY_ALLOW_CONFIRM_FALLBACK", false) {
		return fastBuyResp, fastBuyFailureReason, nil
	}
	if !shouldTryConfirmBuyFallback(fastBuyResp, fastBuyFailureReason) {
		return fastBuyResp, fastBuyFailureReason, nil
	}

	confirmPathTemplate := strings.TrimSpace(os.Getenv("LZT_MARKET_CONFIRM_PATH_TEMPLATE"))
	if confirmPathTemplate == "" {
		confirmPathTemplate = strings.TrimSpace(os.Getenv("LZT_MARKET_CONFIRM_BUY_PATH_TEMPLATE"))
	}
	confirmBuyPath := normalizeProviderPath(confirmPathTemplate, "/{item_id}/confirm-buy", itemID)
	confirmBuyResp, confirmBuyErr, _ := h.doProviderRequestWithRetry(ctx, services.LZTMarketRequest{
		Method:      method,
		Path:        confirmBuyPath,
		Query:       map[string]string{"i18n": i18n},
		ContentType: contentType,
		JSONBody: map[string]interface{}{
			"price": toProviderConfirmPrice(price),
		},
	}, maxRetries)
	if confirmBuyErr != nil {
		return nil, "Provider transport error", confirmBuyErr
	}
	if confirmBuyResp == nil {
		return nil, "Provider returned empty response", errors.New("provider confirm-buy request returned no response")
	}
	if isSuccessfulPurchaseResponse(confirmBuyResp) {
		return confirmBuyResp, "", nil
	}

	confirmBuyFailureReason := normalizeProviderFailureReason(confirmBuyResp, "Confirm-buy failed")
	if strings.TrimSpace(confirmBuyFailureReason) == "" {
		return confirmBuyResp, fastBuyFailureReason, nil
	}
	if strings.EqualFold(strings.TrimSpace(confirmBuyFailureReason), strings.TrimSpace(fastBuyFailureReason)) {
		return confirmBuyResp, confirmBuyFailureReason, nil
	}
	return confirmBuyResp, strings.TrimSpace(fastBuyFailureReason + " | " + confirmBuyFailureReason), nil
}

func (h *LZTMarketHandler) doProviderRequestWithRetry(
	ctx context.Context,
	req services.LZTMarketRequest,
	maxRetries int,
) (*services.LZTMarketResponse, error, int) {
	if maxRetries < 1 {
		maxRetries = 1
	}

	var retries int
	var lastResp *services.LZTMarketResponse
	for attempt := 0; attempt < maxRetries; attempt++ {
		resp, err := h.client.Do(ctx, req)
		if err != nil {
			return lastResp, err, retries
		}
		lastResp = resp
		if !isRetryRequestResponse(resp) {
			return resp, nil, retries
		}
		retries++
	}
	return lastResp, nil, retries
}

func (h *LZTMarketHandler) processOrderAsync(orderID string, userID uint, itemID, i18n, authHeader string) {
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CHECK",
		Label:  "Memeriksa saldo user",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	if h.featureWallet != nil {
		balanceInfo, balanceErr := h.featureWallet.GetMyWalletBalance(ctx, authHeader)
		if balanceErr == nil && (balanceInfo == nil || balanceInfo.Balance <= 0) {
			h.markOrderFailed(orderID, "USER_BALANCE_NOT_ENOUGH", "Saldo wallet Anda tidak mencukupi.")
			h.appendOrderStep(orderID, publicOrderStep{
				Code:    "USER_BALANCE_CHECK",
				Label:   "Saldo user tidak mencukupi",
				Status:  "failed",
				Message: "Saldo wallet Anda tidak mencukupi.",
				At:      time.Now().UTC(),
			})
			return
		}
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CHECK",
		Label:  "Saldo user terdeteksi",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PURCHASE_WORKFLOW",
		Label:  "Menggunakan alur pembelian otomatis",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_RESERVE",
		Label:  "Mengunci saldo pembayaran",
		Status: "processing",
		At:     time.Now().UTC(),
	})

	if h.featureWallet == nil {
		h.markOrderFailed(orderID, "SYSTEM_CONFIG_ERROR", "Feature wallet client belum terkonfigurasi")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Gagal mengunci saldo pembayaran",
			Status:  "failed",
			Message: "Sistem pembayaran internal belum siap.",
			At:      time.Now().UTC(),
		})
		return
	}

	orderSnapshot, ok := h.getOrderForUser(orderID, userID)
	if !ok {
		return
	}
	if orderSnapshot.PriceIDR <= 0 || orderSnapshot.SourcePrice <= 0 {
		h.markOrderFailed(orderID, "PRICING_UNAVAILABLE", "Harga belum tersedia untuk item ini.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Gagal mengunci saldo pembayaran",
			Status:  "failed",
			Message: "Harga belum tersedia untuk item ini.",
			At:      time.Now().UTC(),
		})
		return
	}

	if _, err := h.featureWallet.ReserveMarketPurchase(ctx, authHeader, orderID, orderSnapshot.PriceIDR); err != nil {
		h.markOrderFailed(orderID, "USER_BALANCE_NOT_ENOUGH", "Saldo wallet Anda tidak mencukupi.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_RESERVE",
			Label:   "Gagal mengunci saldo pembayaran",
			Status:  "failed",
			Message: "Saldo wallet Anda tidak mencukupi.",
			At:      time.Now().UTC(),
		})
		return
	}

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_RESERVE",
		Label:  "Saldo pembayaran berhasil dikunci",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PLATFORM_READINESS_CHECK",
		Label:  "Memverifikasi kesiapan sistem penjualan",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	supplierBalance := h.checkSupplierBalance(ctx, orderSnapshot.SourcePrice)
	if supplierBalance.State == supplierBalanceStateInsufficient {
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, "Saldo sumber belum mencukupi")
		h.markOrderFailed(orderID, "PLATFORM_READINESS_NOT_ENOUGH", "Akun belum siap untuk dijual saat ini.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PLATFORM_READINESS_CHECK",
			Label:   "Kesiapan sistem belum mencukupi",
			Status:  "failed",
			Message: "Akun belum siap untuk dijual saat ini.",
			At:      time.Now().UTC(),
		})
		return
	}
	if supplierBalance.State == supplierBalanceStateUnknown && isProviderIntegrationFailureReason(supplierBalance.Reason) {
		userFailureReason := "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "PLATFORM_READINESS_CHECK_FAILED", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PLATFORM_READINESS_CHECK",
			Label:   "Gagal memverifikasi kesiapan sistem",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	if supplierBalance.State == supplierBalanceStateUnknown {
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PLATFORM_READINESS_DEFERRED",
			Label:   "Kesiapan sistem belum dapat dipastikan, proses dilanjutkan",
			Status:  "done",
			Message: "Verifikasi akhir dilakukan pada tahap eksekusi pembelian.",
			At:      time.Now().UTC(),
		})
		h.appendOrderStep(orderID, publicOrderStep{
			Code:   "PLATFORM_READINESS_CHECK",
			Label:  "Pemeriksaan awal kesiapan dilewati (status belum pasti)",
			Status: "done",
			At:     time.Now().UTC(),
		})
	} else {
		h.appendOrderStep(orderID, publicOrderStep{
			Code:   "PLATFORM_READINESS_CHECK",
			Label:  "Kesiapan sistem terverifikasi",
			Status: "done",
			At:     time.Now().UTC(),
		})
	}

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "ITEM_AVAILABILITY_CHECK",
		Label:  "Memverifikasi ketersediaan akun",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	itemReadiness, itemReadinessErr := h.getProviderItemReadiness(ctx, itemID)
	if itemReadinessErr != nil {
		userFailureReason := normalizeCheckerErrorMessage(itemReadinessErr)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "ITEM_AVAILABILITY_CHECK_FAILED", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "ITEM_AVAILABILITY_CHECK",
			Label:   "Verifikasi ketersediaan akun gagal",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	if itemReadiness != nil && len(itemReadiness.Item) > 0 {
		h.applyOrderItemSnapshot(orderID, itemReadiness.Item)
		if refreshedOrder, found := h.getOrderForUser(orderID, userID); found {
			orderSnapshot = refreshedOrder
		}
	}
	if itemReadiness != nil && !itemReadiness.CanBuy {
		userFailureReason := normalizeUserFacingFailureReason(itemReadiness.CannotBuyReason)
		if strings.TrimSpace(userFailureReason) == "" {
			userFailureReason = "Akun belum siap untuk dijual saat ini."
		}
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "ITEM_UNAVAILABLE", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "ITEM_AVAILABILITY_CHECK",
			Label:   "Akun tidak tersedia untuk dibeli",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "ITEM_AVAILABILITY_CHECK",
		Label:  "Akun tersedia untuk dibeli",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PURCHASE_EXECUTION",
		Label:  "Memproses pembelian akun",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	resp, failureReason, buyErr := h.buyChatGPTItem(ctx, itemID, i18n, orderSnapshot.SourcePrice)
	if buyErr != nil {
		logMarketOrderReject(
			"provider_purchase_transport_error",
			zap.String("order_id", orderID),
			zap.Uint("user_id", userID),
			zap.String("item_id", itemID),
			zap.Error(buyErr),
		)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, "Provider transport error")
		h.markOrderFailed(orderID, "CHECKER_ERROR", "Checker sedang error. Coba lagi sebentar.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PURCHASE_EXECUTION",
			Label:   "Proses pembelian gagal",
			Status:  "failed",
			Message: "Checker sedang error. Coba lagi sebentar.",
			At:      time.Now().UTC(),
		})
		return
	}
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || !isSuccessfulPurchaseResponse(resp) {
		if strings.TrimSpace(failureReason) == "" {
			failureReason = normalizeProviderFailureReason(resp, "Provider purchase failed")
		}
		providerFailureReason := failureReason
		userFailureReason := normalizeUserFacingFailureReason(failureReason)
		providerStatusCode := 0
		if resp != nil {
			providerStatusCode = resp.StatusCode
		}
		logMarketOrderReject(
			"provider_purchase_failed",
			zap.String("order_id", orderID),
			zap.Uint("user_id", userID),
			zap.String("item_id", itemID),
			zap.Int("provider_status_code", providerStatusCode),
			zap.String("provider_reason_raw", providerFailureReason),
			zap.String("user_reason", userFailureReason),
			zap.Strings("provider_errors", extractProviderErrors(resp)),
		)
		_, _ = h.featureWallet.ReleaseMarketPurchase(ctx, authHeader, orderID, userFailureReason)
		h.markOrderFailed(orderID, "PURCHASE_FAILED", userFailureReason)
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "PURCHASE_EXECUTION",
			Label:   "Proses pembelian gagal",
			Status:  "failed",
			Message: userFailureReason,
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "PURCHASE_EXECUTION",
		Label:  "Pembelian akun berhasil",
		Status: "done",
		At:     time.Now().UTC(),
	})

	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CAPTURE",
		Label:  "Menyelesaikan potongan saldo user",
		Status: "processing",
		At:     time.Now().UTC(),
	})
	if _, err := h.featureWallet.CaptureMarketPurchase(ctx, authHeader, orderID); err != nil {
		// Critical mismatch: provider succeeded but capture failed.
		h.markOrderFailed(orderID, "CAPTURE_FAILED", "Pembelian berhasil, tetapi finalisasi saldo gagal.")
		h.appendOrderStep(orderID, publicOrderStep{
			Code:    "USER_BALANCE_CAPTURE",
			Label:   "Finalisasi saldo gagal",
			Status:  "failed",
			Message: "Hubungi admin: pembelian sudah berhasil namun finalisasi saldo gagal.",
			At:      time.Now().UTC(),
		})
		return
	}
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "USER_BALANCE_CAPTURE",
		Label:  "Saldo user berhasil difinalisasi",
		Status: "done",
		At:     time.Now().UTC(),
	})

	delivery := extractDeliveryPayload(resp)
	h.markOrderFulfilled(orderID, delivery)
	h.appendOrderStep(orderID, publicOrderStep{
		Code:   "DELIVERY_READY",
		Label:  "Data akun siap dikirim ke user",
		Status: "done",
		At:     time.Now().UTC(),
	})
}
