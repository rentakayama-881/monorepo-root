package handlers

import (
"testing"

"backend-gin/services"
)

func TestCloneStringAnyMap(t *testing.T) {
original := map[string]interface{}{
"key1": "value1",
"key2": 42,
}
cloned := cloneStringAnyMap(original)
if len(cloned) != len(original) {
t.Errorf("len = %d, want %d", len(cloned), len(original))
}
cloned["key1"] = "modified"
if original["key1"] != "value1" {
t.Error("modifying clone should not affect original")
}
}

func TestCloneJSONValue(t *testing.T) {
result := cloneJSONValue(nil)
if result != nil {
t.Error("nil input should return nil")
}
result = cloneJSONValue("hello")
if result != "hello" {
t.Errorf("string input: got %v", result)
}
result = cloneJSONValue(map[string]interface{}{"a": "b"})
if m, ok := result.(map[string]interface{}); !ok || m["a"] != "b" {
t.Error("map clone failed")
}
}

func TestReadMap(t *testing.T) {
parent := map[string]interface{}{
"child": map[string]interface{}{"nested": true},
"str":   "not a map",
"nil":   nil,
}
if got := readMap(parent, "child"); got == nil {
t.Error("expected non-nil for 'child'")
}
if got := readMap(parent, "str"); got != nil {
t.Error("expected nil for string value")
}
if got := readMap(parent, "nil"); got != nil {
t.Error("expected nil for nil value")
}
if got := readMap(parent, "missing"); got != nil {
t.Error("expected nil for missing key")
}
}

func TestFirstNonEmptyString(t *testing.T) {
m := map[string]interface{}{
"empty": "",
"nil":   nil,
"good":  "found",
}
if got := firstNonEmptyString(m, "empty", "nil", "good"); got != "found" {
t.Errorf("got %q, want 'found'", got)
}
if got := firstNonEmptyString(m, "missing"); got != "" {
t.Errorf("got %q, want empty", got)
}
}

func TestExtractProviderErrors(t *testing.T) {
if got := extractProviderErrors(nil); got != nil {
t.Errorf("nil: expected nil, got %v", got)
}
resp := &services.LZTMarketResponse{
JSON: map[string]interface{}{
"errors": []interface{}{"error1", "error2"},
},
}
got := extractProviderErrors(resp)
if len(got) != 2 {
t.Errorf("expected 2, got %d", len(got))
}
resp2 := &services.LZTMarketResponse{
JSON: map[string]interface{}{"status": "ok"},
}
if extractProviderErrors(resp2) != nil {
t.Error("status ok should not produce errors")
}
}

func TestHasStatusValue(t *testing.T) {
if hasStatusValue(nil, "ok") {
t.Error("nil should be false")
}
resp := &services.LZTMarketResponse{
JSON: map[string]interface{}{"status": "OK"},
}
if !hasStatusValue(resp, "ok") {
t.Error("should match case-insensitively")
}
}

func TestNormalizeProviderPath(t *testing.T) {
tests := []struct{ path, fallback, id, want string }{
{"/api/{item_id}/buy", "", "123", "/api/123/buy"},
{"", "/fallback/{item_id}", "456", "/fallback/456"},
{"api/no-slash/{item_id}", "", "789", "/api/no-slash/789"},
}
for _, tt := range tests {
got := normalizeProviderPath(tt.path, tt.fallback, tt.id)
if got != tt.want {
t.Errorf("normalizeProviderPath(%q,%q,%q) = %q, want %q", tt.path, tt.fallback, tt.id, got, tt.want)
}
}
}

func TestToProviderConfirmPrice_Extended(t *testing.T) {
tests := []struct {
input float64
want  int64
}{
{100.0, 100},
{0.0, 1},
{-5.0, 1},
{1.6, 2},
}
for _, tt := range tests {
if got := toProviderConfirmPrice(tt.input); got != tt.want {
t.Errorf("toProviderConfirmPrice(%v) = %d, want %d", tt.input, got, tt.want)
}
}
}

func TestNewPublicMarketOrderID(t *testing.T) {
id := newPublicMarketOrderID()
if len(id) < 4 || id[:4] != "ord_" {
t.Errorf("invalid order ID: %q", id)
}
if id == newPublicMarketOrderID() {
t.Error("should be unique")
}
}

func TestReadBoolEnvLocal(t *testing.T) {
t.Setenv("TEST_BOOL_LOCAL", "true")
if !readBoolEnvLocal("TEST_BOOL_LOCAL", false) {
t.Error("expected true")
}
t.Setenv("TEST_BOOL_LOCAL", "false")
if readBoolEnvLocal("TEST_BOOL_LOCAL", true) {
t.Error("expected false")
}
t.Setenv("TEST_BOOL_LOCAL", "")
if !readBoolEnvLocal("TEST_BOOL_LOCAL", true) {
t.Error("empty should use fallback")
}
}

func TestIsMarketPurchaseOrderID(t *testing.T) {
if !isMarketPurchaseOrderID("ord_abc123") {
t.Error("regular order should be true")
}
if isMarketPurchaseOrderID("validation-case:42") {
t.Error("validation-case prefix should be false")
}
if isMarketPurchaseOrderID("") {
t.Error("empty should be false")
}
}

func TestCloneLZTMarketResponse_Extended(t *testing.T) {
if cloneLZTMarketResponse(nil) != nil {
t.Error("nil should return nil")
}
original := &services.LZTMarketResponse{
StatusCode: 200,
Headers:    map[string]string{"X-Test": "val"},
JSON:       map[string]interface{}{"key": "val"},
}
cloned := cloneLZTMarketResponse(original)
if cloned.StatusCode != 200 {
t.Errorf("StatusCode = %d", cloned.StatusCode)
}
cloned.Headers["X-New"] = "new"
if _, ok := original.Headers["X-New"]; ok {
t.Error("clone headers should be independent")
}
}
