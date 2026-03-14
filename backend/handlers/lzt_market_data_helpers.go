package handlers

import (
	"strconv"
	"strings"
)

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
