package handlers

import (
	"context"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend-gin/services"
	"github.com/gin-gonic/gin"
)

func TestParseProviderNumericString(t *testing.T) {
	cases := []struct {
		name      string
		input     string
		want      float64
		wantOK    bool
		tolerance float64
	}{
		{name: "rub with symbol", input: "200 ₽", want: 200, wantOK: true, tolerance: 0.0001},
		{name: "space and comma decimal", input: "1 234,56 ₽", want: 1234.56, wantOK: true, tolerance: 0.0001},
		{name: "us style", input: "1,234.56 RUB", want: 1234.56, wantOK: true, tolerance: 0.0001},
		{name: "eu style", input: "1.234,56 RUB", want: 1234.56, wantOK: true, tolerance: 0.0001},
		{name: "invalid value", input: "N/A", want: 0, wantOK: false, tolerance: 0.0001},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, gotOK := parseProviderNumericString(tc.input)
			if gotOK != tc.wantOK {
				t.Fatalf("unexpected parse status: got %v want %v", gotOK, tc.wantOK)
			}
			if !tc.wantOK {
				return
			}
			if math.Abs(got-tc.want) > tc.tolerance {
				t.Fatalf("unexpected parsed value: got %f want %f", got, tc.want)
			}
		})
	}
}

func TestExtractSupplierBalanceFromProfile_ParsesPrimaryBalance(t *testing.T) {
	user := map[string]interface{}{
		"balance": "200 ₽",
	}
	balance, ok := extractSupplierBalanceFromProfile(user)
	if !ok {
		t.Fatalf("expected balance extraction to succeed")
	}
	if math.Abs(balance-200) > 0.0001 {
		t.Fatalf("unexpected parsed balance: got %f want 200", balance)
	}
}

func TestExtractSupplierBalanceFromProfile_FallbackToBalances(t *testing.T) {
	user := map[string]interface{}{
		"balance": "N/A",
		"balances": []interface{}{
			map[string]interface{}{"balance": "120,00"},
			map[string]interface{}{"balance": "130"},
		},
	}
	balance, ok := extractSupplierBalanceFromProfile(user)
	if !ok {
		t.Fatalf("expected balances fallback extraction to succeed")
	}
	if math.Abs(balance-130) > 0.0001 {
		t.Fatalf("unexpected fallback balance: got %f want 130", balance)
	}
}

func TestExtractSupplierBalanceFromProfile_ReturnsFalseWhenUnavailable(t *testing.T) {
	user := map[string]interface{}{
		"balance": "N/A",
		"balances": []interface{}{
			map[string]interface{}{"balance": "??"},
		},
	}
	_, ok := extractSupplierBalanceFromProfile(user)
	if ok {
		t.Fatalf("expected extraction to fail for unavailable supplier balance")
	}
}

func TestEvaluateSupplierBalance_Enough(t *testing.T) {
	result := evaluateSupplierBalance(150, 200, true)
	if result.State != supplierBalanceStateEnough {
		t.Fatalf("unexpected supplier balance state: got %s want %s", result.State, supplierBalanceStateEnough)
	}
}

func TestEvaluateSupplierBalance_Insufficient(t *testing.T) {
	result := evaluateSupplierBalance(150, 130, true)
	if result.State != supplierBalanceStateInsufficient {
		t.Fatalf("unexpected supplier balance state: got %s want %s", result.State, supplierBalanceStateInsufficient)
	}
}

func TestEvaluateSupplierBalance_UnknownWhenNotAvailable(t *testing.T) {
	result := evaluateSupplierBalance(150, 0, false)
	if result.State != supplierBalanceStateUnknown {
		t.Fatalf("unexpected supplier balance state: got %s want %s", result.State, supplierBalanceStateUnknown)
	}
}

func TestIsSuccessfulPurchaseResponse_StatusOkWithoutLoginData(t *testing.T) {
	resp := &services.LZTMarketResponse{
		StatusCode: http.StatusOK,
		JSON: map[string]interface{}{
			"status": "ok",
			"item": map[string]interface{}{
				"item_id": 123,
			},
		},
	}

	if !isSuccessfulPurchaseResponse(resp) {
		t.Fatalf("expected purchase response to be treated as success")
	}
}

func TestIsSuccessfulPurchaseResponse_FalseWhenErrorsExist(t *testing.T) {
	resp := &services.LZTMarketResponse{
		StatusCode: http.StatusOK,
		JSON: map[string]interface{}{
			"status": "ok",
			"errors": []interface{}{"This item is sold."},
		},
	}

	if isSuccessfulPurchaseResponse(resp) {
		t.Fatalf("expected purchase response with provider errors to be treated as failure")
	}
}

func TestExtractProviderErrors_CollectsErrorsMessageAndStatus(t *testing.T) {
	resp := &services.LZTMarketResponse{
		StatusCode: http.StatusOK,
		JSON: map[string]interface{}{
			"status":  "retry_request",
			"message": "Temporary checker issue",
		},
	}

	errors := extractProviderErrors(resp)
	if len(errors) < 2 {
		t.Fatalf("expected combined provider errors, got %v", errors)
	}
}

func TestToProviderConfirmPrice(t *testing.T) {
	cases := []struct {
		name  string
		input float64
		want  int64
	}{
		{name: "rounds up decimal", input: 120.6, want: 121},
		{name: "rounds down decimal", input: 120.4, want: 120},
		{name: "minimum one for zero", input: 0, want: 1},
		{name: "minimum one for negative", input: -4.2, want: 1},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := toProviderConfirmPrice(tc.input)
			if got != tc.want {
				t.Fatalf("unexpected confirm price: got %d want %d", got, tc.want)
			}
		})
	}
}

func TestResolveOrderItemForCheckout_FallsBackToCheckAccountWhenListingMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var listingCalls int
	var checkCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/chatgpt":
			listingCalls++
			_, _ = io.WriteString(w, `{"items":[{"item_id":999,"price":90,"price_currency":"RUB"}]}`)
		case r.Method == http.MethodPost && r.URL.Path == "/123/check-account":
			checkCalls++
			_, _ = io.WriteString(w, `{"status":"ok","item":{"item_id":123,"price":55,"price_currency":"RUB","canBuyItem":true},"requireVideoRecording":false}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/market/chatgpt/orders", nil)

	item, source, err := handler.resolveOrderItemForCheckout(ctx, "123", "en-US")
	if err != nil {
		t.Fatalf("expected fallback check-account to resolve item, got error: %v", err)
	}
	if item == nil {
		t.Fatalf("expected resolved item from check-account")
	}
	if source != "check_account" {
		t.Fatalf("unexpected source: got %s want check_account", source)
	}
	if normalizeItemID(item) != "123" {
		t.Fatalf("unexpected resolved item id: got %s want 123", normalizeItemID(item))
	}
	if listingCalls == 0 {
		t.Fatalf("expected listing endpoint to be called first")
	}
	if checkCalls == 0 {
		t.Fatalf("expected check-account endpoint to be used as fallback")
	}
}

func TestFetchChatGPTListing_AggregatesProviderPages(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var pageCalls []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet || r.URL.Path != "/chatgpt" {
			http.NotFound(w, r)
			return
		}

		page := strings.TrimSpace(r.URL.Query().Get("page"))
		if page == "" {
			page = "1"
		}
		pageCalls = append(pageCalls, page)

		switch page {
		case "1":
			_, _ = io.WriteString(w, `{"items":[{"item_id":101},{"item_id":102}]}`)
		case "2":
			_, _ = io.WriteString(w, `{"items":[{"item_id":103},{"item_id":104}]}`)
		default:
			_, _ = io.WriteString(w, `{"items":[]}`)
		}
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("MARKET_CHATGPT_MAX_PAGES", "6")

	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/market/chatgpt", nil)

	resp, err := handler.fetchChatGPTListing(ctx, "en-US", true)
	if err != nil {
		t.Fatalf("expected aggregated listing without error, got: %v", err)
	}
	if resp == nil || resp.JSON == nil {
		t.Fatalf("expected listing response payload")
	}

	items := extractListMaps(resp.JSON)
	if len(items) != 4 {
		t.Fatalf("unexpected aggregated items count: got %d want 4", len(items))
	}
	if got := normalizeItemID(items[3]); got != "104" {
		t.Fatalf("unexpected final item id: got %s want 104", got)
	}

	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		t.Fatalf("expected root payload map")
	}
	total := 0
	switch n := root["total_items"].(type) {
	case int:
		total = n
	case int64:
		total = int(n)
	case float64:
		total = int(n)
	default:
		t.Fatalf("unexpected total_items type: %T", root["total_items"])
	}
	if total != 4 {
		t.Fatalf("unexpected total_items: got %d want 4", total)
	}

	if len(pageCalls) < 3 {
		t.Fatalf("expected multiple page fetch calls, got %v", pageCalls)
	}
	if pageCalls[0] != "1" || pageCalls[1] != "2" {
		t.Fatalf("unexpected page sequence: got %v", pageCalls)
	}
}

func TestFetchChatGPTListing_StopsWhenProviderRepeatsSamePage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var callCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet || r.URL.Path != "/chatgpt" {
			http.NotFound(w, r)
			return
		}
		callCount++
		_, _ = io.WriteString(w, `{"items":[{"item_id":201},{"item_id":202}]}`)
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("MARKET_CHATGPT_MAX_PAGES", "9")

	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/market/chatgpt", nil)

	resp, err := handler.fetchChatGPTListing(ctx, "en-US", true)
	if err != nil {
		t.Fatalf("expected aggregated listing without error, got: %v", err)
	}
	if resp == nil || resp.JSON == nil {
		t.Fatalf("expected listing response payload")
	}
	items := extractListMaps(resp.JSON)
	if len(items) != 2 {
		t.Fatalf("unexpected unique item count when provider repeats pages: got %d want 2", len(items))
	}
	if callCount > 2 {
		t.Fatalf("expected early stop on duplicate pages, got %d calls", callCount)
	}
}

func TestResolveOrderItemForCheckout_UsesListingWhenItemExists(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var checkCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/chatgpt":
			_, _ = io.WriteString(w, `{"items":[{"item_id":123,"price":55,"price_currency":"RUB","canBuyItem":true}]}`)
		case r.Method == http.MethodPost && r.URL.Path == "/123/check-account":
			checkCalls++
			_, _ = io.WriteString(w, `{"status":"ok","item":{"item_id":123,"price":55,"price_currency":"RUB","canBuyItem":true},"requireVideoRecording":false}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/market/chatgpt/orders", nil)

	item, source, err := handler.resolveOrderItemForCheckout(ctx, "123", "en-US")
	if err != nil {
		t.Fatalf("expected listing resolution to succeed, got error: %v", err)
	}
	if item == nil {
		t.Fatalf("expected resolved item from listing")
	}
	if source != "listing" {
		t.Fatalf("unexpected source: got %s want listing", source)
	}
	if checkCalls != 0 {
		t.Fatalf("expected check-account fallback not to be called when listing already has item")
	}
}

func TestResolveOrderItemForCheckout_UsesItemDetailWhenListingMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var checkCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/chatgpt":
			_, _ = io.WriteString(w, `{"items":[{"item_id":999,"price":90,"price_currency":"RUB"}]}`)
		case r.Method == http.MethodGet && r.URL.Path == "/123":
			_, _ = io.WriteString(w, `{"item":{"item_id":123,"price":55,"price_currency":"RUB","title":"Plus"},"canBuyItem":true,"cannotBuyItemError":""}`)
		case r.Method == http.MethodPost && r.URL.Path == "/123/check-account":
			checkCalls++
			_, _ = io.WriteString(w, `{"status":"ok","item":{"item_id":123,"price":55,"price_currency":"RUB","canBuyItem":true},"requireVideoRecording":false}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_ITEM_DETAIL_MAX_RETRIES", "1")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/market/chatgpt/orders", nil)

	item, source, err := handler.resolveOrderItemForCheckout(ctx, "123", "en-US")
	if err != nil {
		t.Fatalf("expected item detail fallback to resolve item, got error: %v", err)
	}
	if item == nil {
		t.Fatalf("expected resolved item from item detail")
	}
	if source != "item_detail" {
		t.Fatalf("unexpected source: got %s want item_detail", source)
	}
	if normalizeItemID(item) != "123" {
		t.Fatalf("unexpected resolved item id: got %s want 123", normalizeItemID(item))
	}
	if checkCalls != 0 {
		t.Fatalf("expected check-account not to be called when item detail already resolves")
	}
}

func TestNormalizeItemID_AvoidsScientificNotation(t *testing.T) {
	item := map[string]interface{}{
		"item_id": float64(219033717),
	}
	got := normalizeItemID(item)
	if got != "219033717" {
		t.Fatalf("unexpected normalized item id: got %s want 219033717", got)
	}
}

func TestBuyChatGPTItem_FastBuySuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var fastBuyCalls int
	var checkCalls int
	var confirmCalls int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/123/fast-buy":
			fastBuyCalls++
			_, _ = io.WriteString(w, `{"status":"ok","item":{"item_id":123,"loginData":{"login":"user","password":"pass","raw":"user:pass"}}}`)
		case r.URL.Path == "/123/check-account":
			checkCalls++
			_, _ = io.WriteString(w, `{"status":"ok"}`)
		case r.URL.Path == "/123/confirm-buy":
			confirmCalls++
			_, _ = io.WriteString(w, `{"status":"ok"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_BUY_MAX_RETRIES", "3")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	resp, reason, err := handler.buyChatGPTItem(context.Background(), "123", "en-US", 55)
	if err != nil {
		t.Fatalf("unexpected buy error: %v", err)
	}
	if strings.TrimSpace(reason) != "" {
		t.Fatalf("expected empty failure reason, got %q", reason)
	}
	if !isSuccessfulPurchaseResponse(resp) {
		t.Fatalf("expected successful buy response")
	}
	if fastBuyCalls == 0 {
		t.Fatalf("expected fast-buy to be called")
	}
	if checkCalls != 0 {
		t.Fatalf("expected check-account not to be called in strict fast-buy flow")
	}
	if confirmCalls != 0 {
		t.Fatalf("expected confirm-buy not to be called in strict fast-buy flow")
	}
}

func TestBuyChatGPTItem_FastBuyValidationFallbackToConfirmBuy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var fastBuyCalls int
	var confirmCalls int

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/123/fast-buy":
			fastBuyCalls++
			w.WriteHeader(http.StatusForbidden)
			_, _ = io.WriteString(w, `{"errors":["More than 20 errors occurred during account validation"]}`)
		case r.Method == http.MethodPost && r.URL.Path == "/123/confirm-buy":
			confirmCalls++
			_, _ = io.WriteString(w, `{"status":"ok","item":{"item_id":123,"loginData":{"login":"user","password":"pass","raw":"user:pass"}}}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_BUY_MAX_RETRIES", "3")
	t.Setenv("LZT_MARKET_BUY_ALLOW_CONFIRM_FALLBACK", "true")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	resp, reason, err := handler.buyChatGPTItem(context.Background(), "123", "en-US", 55)
	if err != nil {
		t.Fatalf("unexpected buy error: %v", err)
	}
	if strings.TrimSpace(reason) != "" {
		t.Fatalf("expected empty failure reason after confirm-buy fallback, got %q", reason)
	}
	if !isSuccessfulPurchaseResponse(resp) {
		t.Fatalf("expected successful buy response from confirm-buy fallback")
	}
	if fastBuyCalls == 0 {
		t.Fatalf("expected fast-buy to be called")
	}
	if confirmCalls == 0 {
		t.Fatalf("expected confirm-buy fallback to be called")
	}
}

func TestManualScenario_FastBuyUnavailableMapsToUserMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost && r.URL.Path == "/123/fast-buy" {
			w.WriteHeader(http.StatusForbidden)
			_, _ = io.WriteString(w, `{"errors":["This account is currently unavailable."]}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_BUY_MAX_RETRIES", "3")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	_, reason, err := handler.buyChatGPTItem(context.Background(), "123", "en-US", 55)
	if err != nil {
		t.Fatalf("unexpected buy error: %v", err)
	}
	if !strings.Contains(strings.ToLower(reason), "currently unavailable") {
		t.Fatalf("unexpected provider reason: %q", reason)
	}
	userReason := normalizeUserFacingFailureReason(reason)
	if userReason != "Akun belum siap untuk dijual saat ini." {
		t.Fatalf("unexpected user reason: got %q", userReason)
	}
}

func TestManualScenario_FastBuyValidationErrorMapsToUserMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost && r.URL.Path == "/123/fast-buy" {
			w.WriteHeader(http.StatusForbidden)
			_, _ = io.WriteString(w, `{"errors":["More than 20 errors occurred during account validation"]}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_BUY_MAX_RETRIES", "3")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	_, reason, err := handler.buyChatGPTItem(context.Background(), "123", "en-US", 55)
	if err != nil {
		t.Fatalf("unexpected buy error: %v", err)
	}
	if !strings.Contains(strings.ToLower(reason), "account validation") {
		t.Fatalf("unexpected provider reason: %q", reason)
	}
	userReason := normalizeUserFacingFailureReason(reason)
	if userReason != "Akun belum siap untuk dijual saat ini." {
		t.Fatalf("unexpected user reason: got %q", userReason)
	}
}

func TestManualScenario_FastBuyIntegrationErrorMapsToUserMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost && r.URL.Path == "/123/fast-buy" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{"errors":["Invalid or expired access token."]}`)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	t.Setenv("LZT_MARKET_BASE_URL", server.URL)
	t.Setenv("LZT_MARKET_TOKEN", "test-token")
	t.Setenv("LZT_MARKET_TIMEOUT_SECONDS", "5")
	t.Setenv("LZT_MARKET_MIN_INTERVAL_MS", "1")
	t.Setenv("LZT_MARKET_BUY_MAX_RETRIES", "3")
	handler := NewLZTMarketHandler(services.NewLZTMarketClientFromEnv())

	_, reason, err := handler.buyChatGPTItem(context.Background(), "123", "en-US", 55)
	if err != nil {
		t.Fatalf("unexpected buy error: %v", err)
	}
	if !strings.Contains(strings.ToLower(reason), "access token") {
		t.Fatalf("unexpected provider reason: %q", reason)
	}
	userReason := normalizeUserFacingFailureReason(reason)
	if userReason != "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi." {
		t.Fatalf("unexpected user reason: got %q", userReason)
	}
}
