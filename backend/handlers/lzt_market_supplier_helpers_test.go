package handlers

import (
	"testing"
)

func TestEvaluateSupplierBalance(t *testing.T) {
	tests := []struct {
		name       string
		needed     float64
		balance    float64
		hasBalance bool
		wantState  supplierBalanceState
	}{
		{"negative needed", -1, 100, true, supplierBalanceStateUnknown},
		{"zero needed", 0, 100, true, supplierBalanceStateUnknown},
		{"no balance info", 100, 0, false, supplierBalanceStateUnknown},
		{"insufficient", 100, 50, true, supplierBalanceStateInsufficient},
		{"exact enough", 100, 100, true, supplierBalanceStateEnough},
		{"more than enough", 100, 200, true, supplierBalanceStateEnough},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateSupplierBalance(tt.needed, tt.balance, tt.hasBalance)
			if got.State != tt.wantState {
				t.Errorf("State = %q, want %q", got.State, tt.wantState)
			}
		})
	}
}

func TestExtractSupplierBalanceFromProfile(t *testing.T) {
	t.Run("direct balance field", func(t *testing.T) {
		m := map[string]interface{}{"balance": float64(99.5)}
		balance, ok := extractSupplierBalanceFromProfile(m)
		if !ok || balance != 99.5 {
			t.Errorf("got (%v, %v), want (99.5, true)", balance, ok)
		}
	})

	t.Run("balances array", func(t *testing.T) {
		m := map[string]interface{}{
			"balances": []interface{}{
				map[string]interface{}{"balance": float64(10)},
				map[string]interface{}{"balance": float64(50)},
			},
		}
		balance, ok := extractSupplierBalanceFromProfile(m)
		if !ok || balance != 50 {
			t.Errorf("got (%v, %v), want (50, true)", balance, ok)
		}
	})

	t.Run("no balance info", func(t *testing.T) {
		m := map[string]interface{}{"name": "test"}
		_, ok := extractSupplierBalanceFromProfile(m)
		if ok {
			t.Error("expected ok=false for no balance info")
		}
	})
}
