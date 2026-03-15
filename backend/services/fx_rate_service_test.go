package services

import (
"testing"
)

func TestNewFXRateServiceFromEnv(t *testing.T) {
t.Setenv("MARKET_FX_CACHE_SECONDS", "")
svc := NewFXRateServiceFromEnv()
if svc == nil {
t.Fatal("expected non-nil service")
}
if svc.client == nil {
t.Error("expected non-nil HTTP client")
}
}

func TestFXRateService_ConvertToIDR_InvalidAmount(t *testing.T) {
svc := NewFXRateServiceFromEnv()
_, _, err := svc.ConvertToIDR(0, "RUB")
if err == nil {
t.Error("expected error for zero amount")
}
_, _, err = svc.ConvertToIDR(-1, "RUB")
if err == nil {
t.Error("expected error for negative amount")
}
}

func TestFXRateService_ConvertToIDR_SameCurrency(t *testing.T) {
svc := NewFXRateServiceFromEnv()
amount, rate, err := svc.ConvertToIDR(100000, "IDR")
if err != nil {
t.Fatalf("unexpected error: %v", err)
}
if amount != 100000 {
t.Errorf("amount = %v, want 100000", amount)
}
if rate != 1 {
t.Errorf("rate = %v, want 1", rate)
}
}
