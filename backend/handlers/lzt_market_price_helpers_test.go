package handlers

import (
	"testing"
)

func TestFormatThousands(t *testing.T) {
	tests := []struct {
		input int64
		want  string
	}{
		{0, "0"},
		{1, "1"},
		{12, "12"},
		{123, "123"},
		{1234, "1.234"},
		{12345, "12.345"},
		{123456, "123.456"},
		{1234567, "1.234.567"},
		{1000000, "1.000.000"},
		{-1234, "-1.234"},
		{-123456, "-123.456"},
		{100, "100"},
		{1000, "1.000"},
		{10000, "10.000"},
		{100000, "100.000"},
	}
	for _, tt := range tests {
		got := formatThousands(tt.input)
		if got != tt.want {
			t.Errorf("formatThousands(%d) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestFormatIDR(t *testing.T) {
	tests := []struct {
		input int64
		want  string
	}{
		{0, "Rp 0"},
		{1000, "Rp 1.000"},
		{50000, "Rp 50.000"},
		{1500000, "Rp 1.500.000"},
	}
	for _, tt := range tests {
		got := formatIDR(tt.input)
		if got != tt.want {
			t.Errorf("formatIDR(%d) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestCurrencySymbol(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"RUB", "₽"},
		{"rub", "₽"},
		{"USD", "$"},
		{"EUR", "€"},
		{"GBP", "£"},
		{"CNY", "¥"},
		{"JPY", "¥"},
		{"TRY", "₺"},
		{"UAH", "₴"},
		{"KZT", "₸"},
		{"IDR", "Rp"},
		{"XYZ", "XYZ"},
		{"", ""},
		{"  rub  ", "₽"},
	}
	for _, tt := range tests {
		got := currencySymbol(tt.input)
		if got != tt.want {
			t.Errorf("currencySymbol(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestFormatSourcePrice(t *testing.T) {
	tests := []struct {
		price    float64
		symbol   string
		currency string
		want     string
	}{
		{100.0, "₽", "RUB", "₽ 100.00"},
		{1.50, "$", "USD", "$ 1.50"},
		{0.0, "", "EUR", "EUR 0.00"},
	}
	for _, tt := range tests {
		got := formatSourcePrice(tt.price, tt.symbol, tt.currency)
		if got != tt.want {
			t.Errorf("formatSourcePrice(%v, %q, %q) = %q, want %q", tt.price, tt.symbol, tt.currency, got, tt.want)
		}
	}
}
