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
