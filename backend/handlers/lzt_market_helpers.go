package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

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
