package utils

import (
	"bytes"
	"encoding/json"
	"strings"
)

func FlattenJSONText(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		// kalau bukan JSON valid, kembalikan apa adanya
		return string(raw)
	}
	var buf bytes.Buffer
	collectStrings(v, &buf)
	// rapikan spasi berlebih
	out := strings.Join(strings.Fields(buf.String()), " ")
	return out
}

func collectStrings(v any, buf *bytes.Buffer) {
	switch t := v.(type) {
	case string:
		buf.WriteString(t)
		buf.WriteByte(' ')
	case []any:
		for _, it := range t {
			collectStrings(it, buf)
		}
	case map[string]any:
		// ambil value saja (key jarang dibutuhkan utk embedding)
		for _, it := range t {
			collectStrings(it, buf)
		}
	// tipe lain (number/bool/null) di-skip
	}
}
