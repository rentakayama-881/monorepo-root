package handlers

import (
	"math"
	"net/http"
	"testing"

	"backend-gin/services"
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
