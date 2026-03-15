package handlers

import (
"testing"
)

func TestExtractPositiveIntFromMap(t *testing.T) {
tests := []struct {
name  string
m     map[string]interface{}
keys  []string
want  int
found bool
}{
{"int value", map[string]interface{}{"count": 5}, []string{"count"}, 5, true},
{"float64 value", map[string]interface{}{"count": float64(10)}, []string{"count"}, 10, true},
{"string value", map[string]interface{}{"count": "42"}, []string{"count"}, 42, true},
{"zero int", map[string]interface{}{"count": 0}, []string{"count"}, 0, false},
{"negative int", map[string]interface{}{"count": -1}, []string{"count"}, 0, false},
{"missing key", map[string]interface{}{}, []string{"count"}, 0, false},
{"nil map", nil, []string{"count"}, 0, false},
{"empty keys", map[string]interface{}{"count": 5}, nil, 0, false},
{"fallback key", map[string]interface{}{"b": 7}, []string{"a", "b"}, 7, true},
}
for _, tt := range tests {
t.Run(tt.name, func(t *testing.T) {
got, found := extractPositiveIntFromMap(tt.m, tt.keys...)
if found != tt.found || got != tt.want {
t.Errorf("got (%d, %v), want (%d, %v)", got, found, tt.want, tt.found)
}
})
}
}

func TestExtractBoolFromMap(t *testing.T) {
tests := []struct {
name  string
m     map[string]interface{}
keys  []string
want  bool
found bool
}{
{"bool true", map[string]interface{}{"flag": true}, []string{"flag"}, true, true},
{"bool false", map[string]interface{}{"flag": false}, []string{"flag"}, false, true},
{"string yes", map[string]interface{}{"flag": "yes"}, []string{"flag"}, true, true},
{"string no", map[string]interface{}{"flag": "no"}, []string{"flag"}, false, true},
{"int 1", map[string]interface{}{"flag": 1}, []string{"flag"}, true, true},
{"missing", map[string]interface{}{}, []string{"flag"}, false, false},
{"nil map", nil, []string{"flag"}, false, false},
}
for _, tt := range tests {
t.Run(tt.name, func(t *testing.T) {
got, found := extractBoolFromMap(tt.m, tt.keys...)
if found != tt.found || got != tt.want {
t.Errorf("got (%v, %v), want (%v, %v)", got, found, tt.want, tt.found)
}
})
}
}

func TestExtractFloatFromMap(t *testing.T) {
tests := []struct {
name  string
m     map[string]interface{}
keys  []string
want  float64
found bool
}{
{"float64", map[string]interface{}{"price": float64(99.5)}, []string{"price"}, 99.5, true},
{"int", map[string]interface{}{"price": 42}, []string{"price"}, 42.0, true},
{"string", map[string]interface{}{"price": "123.45"}, []string{"price"}, 123.45, true},
{"missing", map[string]interface{}{}, []string{"price"}, 0, false},
}
for _, tt := range tests {
t.Run(tt.name, func(t *testing.T) {
got, found := extractFloatFromMap(tt.m, tt.keys...)
if found != tt.found || got != tt.want {
t.Errorf("got (%v, %v), want (%v, %v)", got, found, tt.want, tt.found)
}
})
}
}

func TestExtractListMaps(t *testing.T) {
data := []interface{}{
map[string]interface{}{"id": 1},
map[string]interface{}{"id": 2},
}
got := extractListMaps(data)
if len(got) != 2 {
t.Errorf("got %d items, want 2", len(got))
}

got2 := extractListMaps(map[string]interface{}{
"items": []interface{}{map[string]interface{}{"id": 1}},
})
if len(got2) != 1 {
t.Errorf("nested items: got %d, want 1", len(got2))
}

got3 := extractListMaps(map[string]interface{}{})
if len(got3) != 0 {
t.Errorf("empty: got %d, want 0", len(got3))
}
}

func TestParseProviderNumericString_Extended(t *testing.T) {
tests := []struct {
input string
want  float64
ok    bool
}{
{"123", 123, true},
{"1,234.56", 1234.56, true},
{"1.234,56", 1234.56, true},
{"", 0, false},
{"   ", 0, false},
{"-", 0, false},
{"abc", 0, false},
{"99.99", 99.99, true},
}
for _, tt := range tests {
got, ok := parseProviderNumericString(tt.input)
if ok != tt.ok {
t.Errorf("parseProviderNumericString(%q): ok = %v, want %v", tt.input, ok, tt.ok)
}
if ok && got != tt.want {
t.Errorf("parseProviderNumericString(%q) = %v, want %v", tt.input, got, tt.want)
}
}
}
