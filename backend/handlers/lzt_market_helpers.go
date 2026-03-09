package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend-gin/ent"
	applog "backend-gin/logger"
	"backend-gin/services"

	"go.uber.org/zap"
)

func buildLZTItemURL(itemID string) string {
	template := strings.TrimSpace(os.Getenv("LZT_MARKET_ITEM_URL_TEMPLATE"))
	if template == "" {
		template = "https://lzt.market/%s"
	}
	if strings.Contains(template, "{item_id}") {
		return strings.ReplaceAll(template, "{item_id}", itemID)
	}
	return fmt.Sprintf(template, itemID)
}

func cloneStringAnyMap(in map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(in))
	for k, v := range in {
		out[k] = cloneJSONValue(v)
	}
	return out
}

func cloneLZTMarketResponse(resp *services.LZTMarketResponse) *services.LZTMarketResponse {
	if resp == nil {
		return nil
	}

	cloned := &services.LZTMarketResponse{
		StatusCode: resp.StatusCode,
		Raw:        resp.Raw,
	}
	if len(resp.Headers) > 0 {
		cloned.Headers = make(map[string]string, len(resp.Headers))
		for key, value := range resp.Headers {
			cloned.Headers[key] = value
		}
	}
	cloned.JSON = cloneJSONValue(resp.JSON)
	return cloned
}

func cloneJSONValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		out := make(map[string]interface{}, len(typed))
		for key, nested := range typed {
			out[key] = cloneJSONValue(nested)
		}
		return out
	case []interface{}:
		out := make([]interface{}, len(typed))
		for index, nested := range typed {
			out[index] = cloneJSONValue(nested)
		}
		return out
	default:
		return typed
	}
}

func extractPositiveIntFromMap(m map[string]interface{}, keys ...string) (int, bool) {
	if len(m) == 0 || len(keys) == 0 {
		return 0, false
	}
	for _, key := range keys {
		raw, ok := m[key]
		if !ok || raw == nil {
			continue
		}
		switch v := raw.(type) {
		case int:
			if v > 0 {
				return v, true
			}
		case int8:
			if v > 0 {
				return int(v), true
			}
		case int16:
			if v > 0 {
				return int(v), true
			}
		case int32:
			if v > 0 {
				return int(v), true
			}
		case int64:
			if v > 0 {
				return int(v), true
			}
		case uint:
			if v > 0 {
				return int(v), true
			}
		case uint8:
			if v > 0 {
				return int(v), true
			}
		case uint16:
			if v > 0 {
				return int(v), true
			}
		case uint32:
			if v > 0 {
				return int(v), true
			}
		case uint64:
			if v > 0 {
				return int(v), true
			}
		case float32:
			if v > 0 {
				return int(v), true
			}
		case float64:
			if v > 0 {
				return int(v), true
			}
		case string:
			value, err := strconv.Atoi(strings.TrimSpace(v))
			if err == nil && value > 0 {
				return value, true
			}
		}
	}
	return 0, false
}

func extractBoolFromMap(m map[string]interface{}, keys ...string) (bool, bool) {
	if len(m) == 0 || len(keys) == 0 {
		return false, false
	}
	for _, key := range keys {
		raw, ok := m[key]
		if !ok || raw == nil {
			continue
		}
		switch v := raw.(type) {
		case bool:
			return v, true
		case int:
			return v != 0, true
		case int8:
			return v != 0, true
		case int16:
			return v != 0, true
		case int32:
			return v != 0, true
		case int64:
			return v != 0, true
		case uint:
			return v != 0, true
		case uint8:
			return v != 0, true
		case uint16:
			return v != 0, true
		case uint32:
			return v != 0, true
		case uint64:
			return v != 0, true
		case float32:
			return v != 0, true
		case float64:
			return v != 0, true
		case string:
			switch strings.ToLower(strings.TrimSpace(v)) {
			case "1", "true", "yes", "y", "on":
				return true, true
			case "0", "false", "no", "n", "off":
				return false, true
			}
		}
	}
	return false, false
}

func normalizeItemID(item map[string]interface{}) string {
	for _, key := range []string{"chatgpt_item_id", "item_id", "account_id", "id"} {
		if v, ok := item[key]; ok {
			s := normalizeProviderIDValue(v)
			if s != "" {
				return s
			}
		}
	}
	return ""
}

func normalizeProviderIDValue(raw interface{}) string {
	if raw == nil {
		return ""
	}

	switch v := raw.(type) {
	case string:
		clean := strings.TrimSpace(v)
		if clean == "" {
			return ""
		}
		if parsed, err := strconv.ParseFloat(clean, 64); err == nil && parsed > 0 && math.Trunc(parsed) == parsed {
			return strconv.FormatInt(int64(parsed), 10)
		}
		return clean
	case float64:
		if v <= 0 {
			return ""
		}
		if math.Trunc(v) == v {
			return strconv.FormatInt(int64(v), 10)
		}
		return strings.TrimSpace(strconv.FormatFloat(v, 'f', -1, 64))
	case float32:
		n := float64(v)
		if n <= 0 {
			return ""
		}
		if math.Trunc(n) == n {
			return strconv.FormatInt(int64(n), 10)
		}
		return strings.TrimSpace(strconv.FormatFloat(n, 'f', -1, 64))
	case int:
		if v <= 0 {
			return ""
		}
		return strconv.Itoa(v)
	case int8:
		if v <= 0 {
			return ""
		}
		return strconv.FormatInt(int64(v), 10)
	case int16:
		if v <= 0 {
			return ""
		}
		return strconv.FormatInt(int64(v), 10)
	case int32:
		if v <= 0 {
			return ""
		}
		return strconv.FormatInt(int64(v), 10)
	case int64:
		if v <= 0 {
			return ""
		}
		return strconv.FormatInt(v, 10)
	case uint:
		if v == 0 {
			return ""
		}
		return strconv.FormatUint(uint64(v), 10)
	case uint8:
		if v == 0 {
			return ""
		}
		return strconv.FormatUint(uint64(v), 10)
	case uint16:
		if v == 0 {
			return ""
		}
		return strconv.FormatUint(uint64(v), 10)
	case uint32:
		if v == 0 {
			return ""
		}
		return strconv.FormatUint(uint64(v), 10)
	case uint64:
		if v == 0 {
			return ""
		}
		return strconv.FormatUint(v, 10)
	default:
		clean := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if clean == "" {
			return ""
		}
		if parsed, err := strconv.ParseFloat(clean, 64); err == nil && parsed > 0 && math.Trunc(parsed) == parsed {
			return strconv.FormatInt(int64(parsed), 10)
		}
		return clean
	}
}

func normalizeItemTitle(item map[string]interface{}) string {
	for _, key := range []string{"title_en", "title", "name_en", "name", "account_title", "description_en", "description"} {
		if v, ok := item[key]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" && !containsCyrillic(s) {
				return s
			}
		}
	}
	sub := firstNonEmptyString(item, "chatgpt_subscription")
	if sub != "" {
		return sub + " Account"
	}
	return "ChatGPT Account"
}

func containsCyrillic(s string) bool {
	for _, r := range s {
		if r >= 0x0400 && r <= 0x04FF {
			return true
		}
	}
	return false
}

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

func normalizeItemState(item map[string]interface{}) string {
	for _, key := range []string{"item_state", "status", "state", "availability"} {
		if v, ok := item[key]; ok {
			s := strings.TrimSpace(fmt.Sprintf("%v", v))
			if s != "" {
				return s
			}
		}
	}
	return "-"
}

func normalizeSeller(item map[string]interface{}) string {
	for _, key := range []string{"seller_name", "seller", "owner"} {
		v, ok := item[key]
		if !ok || v == nil {
			continue
		}
		switch s := v.(type) {
		case string:
			if strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		case map[string]interface{}:
			for _, nested := range []string{"username", "title", "name", "id"} {
				if nv, ok := s[nested]; ok {
					ns := strings.TrimSpace(fmt.Sprintf("%v", nv))
					if ns != "" {
						return ns
					}
				}
			}
		default:
			candidate := strings.TrimSpace(fmt.Sprintf("%v", v))
			if candidate != "" {
				return candidate
			}
		}
	}
	return "-"
}

func extractCanBuyItem(item map[string]interface{}) bool {
	v, ok := item["canBuyItem"]
	if !ok || v == nil {
		return true
	}
	switch b := v.(type) {
	case bool:
		return b
	case string:
		return strings.EqualFold(strings.TrimSpace(b), "true") || strings.TrimSpace(b) == "1"
	case float64:
		return b > 0
	case int:
		return b > 0
	default:
		return true
	}
}

func extractCannotBuyItemError(payload map[string]interface{}) string {
	if len(payload) == 0 {
		return ""
	}
	for _, key := range []string{"cannotBuyItemError", "cannot_buy_item_error", "message"} {
		v, ok := payload[key]
		if !ok || v == nil {
			continue
		}
		msg := strings.TrimSpace(fmt.Sprintf("%v", v))
		if msg != "" {
			return msg
		}
	}
	return ""
}

func extractListMaps(payload interface{}) []map[string]interface{} {
	candidates := []interface{}{payload}
	if root, ok := payload.(map[string]interface{}); ok {
		candidates = append(candidates,
			root["items"],
			root["accounts"],
			root["data"],
			root["result"],
			root["chatgpt"],
			root["rows"],
			root["list"],
		)
	}

	for _, candidate := range candidates {
		if rows, ok := candidate.([]interface{}); ok {
			out := make([]map[string]interface{}, 0, len(rows))
			for _, row := range rows {
				if m, ok := row.(map[string]interface{}); ok {
					out = append(out, m)
				}
			}
			if len(out) > 0 {
				return out
			}
		}
		if m, ok := candidate.(map[string]interface{}); ok {
			if rows, ok := m["items"].([]interface{}); ok {
				out := make([]map[string]interface{}, 0, len(rows))
				for _, row := range rows {
					if item, ok := row.(map[string]interface{}); ok {
						out = append(out, item)
					}
				}
				if len(out) > 0 {
					return out
				}
			}
		}
	}
	return []map[string]interface{}{}
}

func evaluateSupplierBalance(needed, balance float64, hasBalance bool) supplierBalanceCheckResult {
	if needed <= 0 {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: "invalid needed amount"}
	}
	if !hasBalance {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown}
	}
	if balance < needed {
		return supplierBalanceCheckResult{State: supplierBalanceStateInsufficient, Balance: balance}
	}
	return supplierBalanceCheckResult{State: supplierBalanceStateEnough, Balance: balance}
}

func extractSupplierBalanceFromProfile(userMap map[string]interface{}) (float64, bool) {
	balance, ok := extractFloatFromMap(userMap, "balance", "Balance", "money")
	if ok {
		return balance, true
	}

	rows, ok := userMap["balances"].([]interface{})
	if !ok || len(rows) == 0 {
		return 0, false
	}

	best := 0.0
	found := false
	for _, row := range rows {
		balanceMap, ok := row.(map[string]interface{})
		if !ok {
			continue
		}
		value, valueOK := extractFloatFromMap(balanceMap, "balance")
		if !valueOK {
			continue
		}
		if !found || value > best {
			best = value
			found = true
		}
	}
	return best, found
}

func extractFloatFromMap(m map[string]interface{}, keys ...string) (float64, bool) {
	for _, key := range keys {
		v, ok := m[key]
		if !ok || v == nil {
			continue
		}
		switch n := v.(type) {
		case float64:
			return n, true
		case float32:
			return float64(n), true
		case int:
			return float64(n), true
		case int32:
			return float64(n), true
		case int64:
			return float64(n), true
		case string:
			parsed, parsedOK := parseProviderNumericString(n)
			if parsedOK {
				return parsed, true
			}
		}
	}
	return 0, false
}

func parseProviderNumericString(value string) (float64, bool) {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return 0, false
	}

	var b strings.Builder
	b.Grow(len(clean))
	for _, r := range clean {
		if (r >= '0' && r <= '9') || r == '.' || r == ',' || r == '-' {
			b.WriteRune(r)
		}
	}
	filtered := b.String()
	if filtered == "" || filtered == "-" {
		return 0, false
	}

	lastComma := strings.LastIndex(filtered, ",")
	lastDot := strings.LastIndex(filtered, ".")

	switch {
	case lastComma >= 0 && lastDot >= 0:
		if lastComma > lastDot {
			filtered = strings.ReplaceAll(filtered, ".", "")
			filtered = strings.ReplaceAll(filtered, ",", ".")
		} else {
			filtered = strings.ReplaceAll(filtered, ",", "")
		}
	case lastComma >= 0:
		if strings.Count(filtered, ",") == 1 {
			parts := strings.Split(filtered, ",")
			if len(parts) == 2 && len(parts[1]) > 0 && len(parts[1]) <= 2 {
				filtered = parts[0] + "." + parts[1]
			} else {
				filtered = strings.ReplaceAll(filtered, ",", "")
			}
		} else {
			filtered = strings.ReplaceAll(filtered, ",", "")
		}
	case lastDot >= 0:
		if strings.Count(filtered, ".") > 1 {
			idx := strings.LastIndex(filtered, ".")
			intPart := strings.ReplaceAll(filtered[:idx], ".", "")
			fracPart := filtered[idx+1:]
			if len(fracPart) > 0 && len(fracPart) <= 2 {
				filtered = intPart + "." + fracPart
			} else {
				filtered = strings.ReplaceAll(filtered, ".", "")
			}
		} else {
			parts := strings.Split(filtered, ".")
			if len(parts) == 2 && len(parts[1]) > 2 {
				filtered = strings.ReplaceAll(filtered, ".", "")
			}
		}
	}

	parsed, err := strconv.ParseFloat(filtered, 64)
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func mapEntityToPublicMarketOrder(row *ent.MarketPurchaseOrder) publicMarketOrder {
	if row == nil {
		return publicMarketOrder{}
	}
	order := publicMarketOrder{
		ID:               strings.TrimSpace(row.OrderID),
		UserID:           uint(row.UserID),
		ItemID:           strings.TrimSpace(row.ItemID),
		Title:            strings.TrimSpace(row.Title),
		Price:            strings.TrimSpace(row.Price),
		Status:           strings.TrimSpace(row.Status),
		Seller:           strings.TrimSpace(row.Seller),
		FailureReason:    strings.TrimSpace(row.FailureReason),
		FailureCode:      strings.TrimSpace(row.FailureCode),
		SourcePrice:      row.SourcePrice,
		SourceCurrency:   strings.TrimSpace(row.SourceCurrency),
		SourceSymbol:     strings.TrimSpace(row.SourceSymbol),
		PriceIDR:         row.PriceIdr,
		FXRateToIDR:      row.FxRateToIdr,
		PriceDisplay:     strings.TrimSpace(row.PriceDisplay),
		SourceDisplay:    strings.TrimSpace(row.SourceDisplay),
		PricingNote:      strings.TrimSpace(row.PricingNote),
		LastStepCode:     strings.TrimSpace(row.LastStepCode),
		SupplierCurrency: strings.TrimSpace(row.SupplierCurrency),
		CreatedAt:        row.CreatedAt.UTC(),
		UpdatedAt:        row.UpdatedAt.UTC(),
	}
	if len(row.DeliveryJSON) > 0 {
		order.Delivery = row.DeliveryJSON
	}
	return order
}

func extractDeliveryPayload(resp *services.LZTMarketResponse) map[string]interface{} {
	payload := map[string]interface{}{
		"delivered_at": time.Now().UTC(),
	}
	if resp.JSON != nil {
		if extracted := extractCredentialsFromBuyResponse(resp.JSON); len(extracted) > 0 {
			payload["credentials"] = extracted
		}
		if summary := extractPurchasedItemSummary(resp.JSON); len(summary) > 0 {
			payload["account"] = summary
		}
	}
	return payload
}

func extractCredentialsFromBuyResponse(jsonPayload interface{}) map[string]interface{} {
	root, ok := jsonPayload.(map[string]interface{})
	if !ok {
		return nil
	}

	item := readMap(root, "item")
	if len(item) == 0 {
		return nil
	}

	out := map[string]interface{}{}
	login := readMap(item, "loginData")
	if len(login) > 0 {
		out["account_login"] = firstNonEmptyString(login, "login")
		out["account_password"] = firstNonEmptyString(login, "password")
	}

	email := readMap(item, "emailLoginData")
	if len(email) > 0 {
		out["email_login"] = firstNonEmptyString(email, "login")
		out["email_password"] = firstNonEmptyString(email, "password")
	}

	for key, value := range out {
		if strings.TrimSpace(fmt.Sprintf("%v", value)) == "" {
			delete(out, key)
		}
	}
	return out
}

func extractPurchasedItemSummary(jsonPayload interface{}) map[string]interface{} {
	root, ok := jsonPayload.(map[string]interface{})
	if !ok {
		return nil
	}
	item := readMap(root, "item")
	if len(item) == 0 {
		return nil
	}

	itemID := normalizeProviderIDValue(item["item_id"])
	summary := map[string]interface{}{
		"title":             normalizeItemTitle(item),
		"status":            firstNonEmptyString(item, "item_state"),
		"price":             firstNonEmptyString(item, "price", "priceWithSellerFee"),
		"email_domain":      firstNonEmptyString(item, "item_domain"),
		"openai_tier":       firstNonEmptyString(item, "openai_tier"),
		"country":           firstNonEmptyString(item, "chatgpt_country"),
		"subscription":      firstNonEmptyString(item, "chatgpt_subscription"),
		"seller":            normalizeSeller(item),
		"account_login_url": firstNonEmptyString(item, "accountLink"),
		"email_login_url":   firstNonEmptyString(item, "emailLoginUrl"),
	}
	if strings.TrimSpace(itemID) != "" {
		summary["item_id"] = itemID
	}
	for key, value := range summary {
		if strings.TrimSpace(fmt.Sprintf("%v", value)) == "" {
			delete(summary, key)
		}
	}
	return summary
}

func readMap(parent map[string]interface{}, key string) map[string]interface{} {
	raw, ok := parent[key]
	if !ok || raw == nil {
		return nil
	}
	child, ok := raw.(map[string]interface{})
	if !ok {
		return nil
	}
	return child
}

func firstNonEmptyString(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		raw, ok := m[key]
		if !ok || raw == nil {
			continue
		}
		value := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if value != "" {
			return value
		}
	}
	return ""
}

func isRetryRequestResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return false
	}
	if hasStatusValue(resp, "retry_request") {
		return true
	}
	errorsList := extractProviderErrors(resp)
	for _, msg := range errorsList {
		if strings.EqualFold(strings.TrimSpace(msg), "retry_request") {
			return true
		}
	}
	return false
}

func isSuccessfulPurchaseResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || resp.JSON == nil {
		return false
	}
	if isRetryRequestResponse(resp) {
		return false
	}
	if len(extractProviderErrors(resp)) > 0 {
		return false
	}
	if hasStatusValue(resp, "ok") || hasStatusValue(resp, "success") {
		return true
	}
	return hasPurchasingPayload(resp)
}

func hasPurchasingPayload(resp *services.LZTMarketResponse) bool {
	if resp == nil || resp.StatusCode >= http.StatusBadRequest || resp.JSON == nil {
		return false
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return false
	}
	item := readMap(root, "item")
	if len(item) == 0 {
		return false
	}
	loginData := readMap(item, "loginData")
	if len(loginData) > 0 {
		return true
	}
	// Some responses may still be considered success with item summary.
	return firstNonEmptyString(item, "item_id", "title") != ""
}

func shouldFallbackAfterFastBuy(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return true
	}
	if isHardFailResponse(resp) {
		return false
	}
	if isRetryRequestResponse(resp) {
		return true
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return true
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return true
	}
	return !isSuccessfulPurchaseResponse(resp)
}

func shouldTryConfirmBuyFallback(resp *services.LZTMarketResponse, failureReason string) bool {
	if resp == nil {
		return false
	}

	lowerReason := strings.ToLower(strings.TrimSpace(failureReason))
	providerErrors := strings.ToLower(strings.Join(extractProviderErrors(resp), " | "))
	combined := strings.TrimSpace(lowerReason + " | " + providerErrors)

	disallowSignals := []string{
		"invalid or expired access token",
		"invalid access token",
		"access token",
		"permission",
		"forbidden",
		"unauthorized",
		"ad not found",
		"item not found",
		"this item is sold",
		"removed by the site administration",
		"currently unavailable",
	}
	for _, signal := range disallowSignals {
		if strings.Contains(combined, signal) {
			return false
		}
	}

	if strings.Contains(lowerReason, "retry_request") ||
		strings.Contains(lowerReason, "checker") ||
		strings.Contains(lowerReason, "validation") ||
		strings.Contains(lowerReason, "more than 20 errors occurred during account validation") {
		return true
	}

	return strings.Contains(providerErrors, "retry_request") ||
		strings.Contains(providerErrors, "checker") ||
		strings.Contains(providerErrors, "validation")
}

func isHardFailResponse(resp *services.LZTMarketResponse) bool {
	if resp == nil {
		return false
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound {
		return true
	}
	errorsList := strings.ToLower(strings.Join(extractProviderErrors(resp), " | "))
	if strings.Contains(errorsList, "invalid or expired access token") {
		return true
	}
	if strings.Contains(errorsList, "no permission") || strings.Contains(errorsList, "do not have permission") {
		return true
	}
	if strings.Contains(errorsList, "ad not found") || strings.Contains(errorsList, "item not found") {
		return true
	}
	if strings.Contains(errorsList, "this item is sold") {
		return true
	}
	return false
}

func normalizeProviderFailureReason(resp *services.LZTMarketResponse, fallback string) string {
	if resp == nil {
		return fallback
	}
	errorsList := extractProviderErrors(resp)
	if len(errorsList) > 0 {
		return strings.TrimSpace(strings.Join(errorsList, "; "))
	}
	if strings.TrimSpace(resp.Raw) != "" {
		return strings.TrimSpace(resp.Raw)
	}
	if resp.StatusCode > 0 {
		return fmt.Sprintf("%s (status %d)", fallback, resp.StatusCode)
	}
	return fallback
}

func normalizeUserFacingFailureReason(reason string) string {
	msg := strings.TrimSpace(reason)
	if msg == "" {
		return "Akun belum siap untuk dijual saat ini."
	}
	if isProviderIntegrationFailureReason(msg) {
		return "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."
	}
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "current listing") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "currently unavailable") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "ad not found") || strings.Contains(lower, "item not found") || strings.Contains(lower, "not found") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "removed by the site administration") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "this item is sold") || strings.Contains(lower, "sold") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "secret answer") ||
		strings.Contains(lower, "secret question") ||
		strings.Contains(lower, "security answer") ||
		strings.Contains(lower, "security question") ||
		strings.Contains(lower, "payment password") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "more than 20 errors occurred during account validation") ||
		strings.Contains(lower, "account validation") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "retry_request") {
		return "Checker sedang error. Coba lagi sebentar."
	}
	return "Terjadi kendala sementara. Silakan coba lagi."
}

func normalizeCheckerErrorMessage(err error) string {
	if err == nil {
		return "Akun belum siap untuk dijual saat ini."
	}
	msg := strings.TrimSpace(err.Error())
	if isProviderIntegrationFailureReason(msg) {
		return "Layanan pembelian sedang mengalami gangguan sementara. Silakan coba lagi."
	}
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "currently unavailable") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "sold") ||
		strings.Contains(lower, "not found") ||
		strings.Contains(lower, "ad not found") ||
		strings.Contains(lower, "item not found") ||
		strings.Contains(lower, "removed by the site administration") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "secret answer") ||
		strings.Contains(lower, "secret question") ||
		strings.Contains(lower, "security answer") ||
		strings.Contains(lower, "security question") ||
		strings.Contains(lower, "payment password") {
		return "Akun belum siap untuk dijual saat ini."
	}
	if strings.Contains(lower, "more than 20 errors occurred during account validation") ||
		strings.Contains(lower, "account validation") {
		return "Akun belum siap untuk dijual saat ini."
	}
	return "Checker sedang error. Coba lagi sebentar."
}

func isProviderIntegrationFailureReason(reason string) bool {
	lower := strings.ToLower(strings.TrimSpace(reason))
	if lower == "" {
		return false
	}
	integrationSignals := []string{
		"invalid or expired access token",
		"invalid access token",
		"access token",
		"do not have permission",
		"no permission",
		"forbidden",
		"unauthorized",
		"permission denied",
		"market scope",
		"insufficient scope",
	}
	for _, signal := range integrationSignals {
		if strings.Contains(lower, signal) {
			return true
		}
	}
	return false
}

func extractProviderErrors(resp *services.LZTMarketResponse) []string {
	if resp == nil || resp.JSON == nil {
		return nil
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return nil
	}

	seen := make(map[string]struct{})
	out := make([]string, 0, 4)
	appendUnique := func(raw interface{}) {
		msg := strings.TrimSpace(fmt.Sprintf("%v", raw))
		if msg == "" {
			return
		}
		key := strings.ToLower(msg)
		if _, exists := seen[key]; exists {
			return
		}
		seen[key] = struct{}{}
		out = append(out, msg)
	}

	if rawErrors, ok := root["errors"]; ok && rawErrors != nil {
		switch rows := rawErrors.(type) {
		case []interface{}:
			for _, row := range rows {
				appendUnique(row)
			}
		default:
			appendUnique(rows)
		}
	}

	if rawMessage, ok := root["message"]; ok && rawMessage != nil {
		appendUnique(rawMessage)
	}

	if rawStatus, ok := root["status"]; ok && rawStatus != nil {
		status := strings.TrimSpace(fmt.Sprintf("%v", rawStatus))
		if status != "" && !strings.EqualFold(status, "ok") && !strings.EqualFold(status, "success") {
			appendUnique(status)
		}
	}

	if len(out) == 0 {
		return nil
	}
	return out
}

func hasStatusValue(resp *services.LZTMarketResponse, wanted string) bool {
	if resp == nil || resp.JSON == nil {
		return false
	}
	root, ok := resp.JSON.(map[string]interface{})
	if !ok {
		return false
	}
	value := strings.TrimSpace(fmt.Sprintf("%v", root["status"]))
	if value == "" {
		return false
	}
	return strings.EqualFold(value, wanted)
}

func normalizeProviderPath(pathTemplate, fallbackTemplate, itemID string) string {
	template := strings.TrimSpace(pathTemplate)
	if template == "" {
		template = fallbackTemplate
	}
	path := strings.ReplaceAll(template, "{item_id}", itemID)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return path
}

func logMarketOrderReject(stage string, fields ...zap.Field) {
	all := make([]zap.Field, 0, len(fields)+1)
	all = append(all, zap.String("stage", stage))
	all = append(all, fields...)
	applog.Warn("Market order rejected", all...)
}

func toProviderConfirmPrice(price float64) int64 {
	value := int64(math.Round(price))
	if value <= 0 {
		return 1
	}
	return value
}

func newPublicMarketOrderID() string {
	buf := make([]byte, 10)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("ord_%d", time.Now().UnixNano())
	}
	return "ord_" + hex.EncodeToString(buf)
}

func readPositiveIntEnvLocal(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func readBoolEnvLocal(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if raw == "" {
		return fallback
	}
	switch raw {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}

// isMarketPurchaseOrderID returns true if the orderID looks like it belongs to
// a real market purchase (not a validation-case bounty or other internal reservation).
func isMarketPurchaseOrderID(orderID string) bool {
id := strings.TrimSpace(orderID)
if id == "" {
return false
}
if strings.HasPrefix(id, "validation-case:") {
return false
}
return true
}
