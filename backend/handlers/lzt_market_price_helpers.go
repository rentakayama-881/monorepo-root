package handlers

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
)

func normalizeItemPrice(item map[string]interface{}) string {
	for _, key := range []string{"price", "amount", "cost"} {
		if v, ok := item[key]; ok {
			switch n := v.(type) {
			case float64:
				return strconv.FormatFloat(n, 'f', -1, 64)
			case float32:
				return strconv.FormatFloat(float64(n), 'f', -1, 64)
			default:
				s := strings.TrimSpace(fmt.Sprintf("%v", v))
				if s != "" {
					return s
				}
			}
		}
	}
	return "-"
}

func extractNumericPrice(item map[string]interface{}) float64 {
	for _, key := range []string{"price", "priceWithSellerFee", "rub_price", "amount", "cost"} {
		v, ok := item[key]
		if !ok || v == nil {
			continue
		}
		switch n := v.(type) {
		case float64:
			if n > 0 {
				return n
			}
		case float32:
			if n > 0 {
				return float64(n)
			}
		case int:
			if n > 0 {
				return float64(n)
			}
		case int32:
			if n > 0 {
				return float64(n)
			}
		case int64:
			if n > 0 {
				return float64(n)
			}
		case string:
			value := strings.TrimSpace(n)
			if value == "" {
				continue
			}
			parsed, err := strconv.ParseFloat(value, 64)
			if err == nil && parsed > 0 {
				return parsed
			}
		}
	}
	return 0
}

func applyPriceFactor(baseIDR float64) int64 {
	factor := 0.80
	if raw := strings.TrimSpace(os.Getenv("MARKET_PRICE_FACTOR")); raw != "" {
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil && parsed > 0 {
			factor = parsed
		}
	}

	finalValue := baseIDR / factor
	if finalValue < 0 {
		finalValue = 0
	}
	rounded := int64(math.Round(finalValue))
	if rounded <= 0 {
		rounded = int64(math.Ceil(finalValue))
	}
	if rounded <= 0 {
		rounded = 1
	}
	return rounded
}

func formatIDR(amount int64) string {
	return fmt.Sprintf("Rp %s", formatThousands(amount))
}

func formatSourcePrice(price float64, symbol, currency string) string {
	if symbol == "" {
		symbol = currency
	}
	value := strconv.FormatFloat(price, 'f', 2, 64)
	return fmt.Sprintf("%s %s", symbol, value)
}

func formatThousands(value int64) string {
	negative := value < 0
	if negative {
		value = -value
	}
	raw := strconv.FormatInt(value, 10)
	if len(raw) <= 3 {
		if negative {
			return "-" + raw
		}
		return raw
	}

	var out []byte
	mod := len(raw) % 3
	if mod > 0 {
		out = append(out, raw[:mod]...)
		if len(raw) > mod {
			out = append(out, '.')
		}
	}
	for i := mod; i < len(raw); i += 3 {
		out = append(out, raw[i:i+3]...)
		if i+3 < len(raw) {
			out = append(out, '.')
		}
	}
	if negative {
		return "-" + string(out)
	}
	return string(out)
}

func currencySymbol(currency string) string {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "RUB":
		return "₽"
	case "USD":
		return "$"
	case "EUR":
		return "€"
	case "GBP":
		return "£"
	case "CNY":
		return "¥"
	case "JPY":
		return "¥"
	case "TRY":
		return "₺"
	case "UAH":
		return "₴"
	case "KZT":
		return "₸"
	case "IDR":
		return "Rp"
	default:
		return strings.ToUpper(strings.TrimSpace(currency))
	}
}
