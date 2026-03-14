package handlers

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

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
