package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	apperrors "backend-gin/errors"
)

// TelegramLoginPayload is the payload returned by Telegram Login Widget.
type TelegramLoginPayload struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	PhotoURL  string `json:"photo_url"`
	AuthDate  int64  `json:"auth_date"`
	Hash      string `json:"hash"`
}

// NormalizeTelegramUsername canonicalizes Telegram username for storage/display.
func NormalizeTelegramUsername(raw string) string {
	username := strings.TrimSpace(strings.TrimPrefix(raw, "@"))
	return strings.ToLower(username)
}

// BuildTelegramDisplayHandle returns human-friendly identifier.
func BuildTelegramDisplayHandle(username string, userID *int64) string {
	normalizedUsername := NormalizeTelegramUsername(username)
	if normalizedUsername != "" {
		return "@" + normalizedUsername
	}
	if userID != nil && *userID > 0 {
		return "ID: " + strconv.FormatInt(*userID, 10)
	}
	return ""
}

// BuildTelegramDeepLink returns contact link. Fallback is tg:// link by numeric id.
func BuildTelegramDeepLink(username string, userID *int64) string {
	normalizedUsername := NormalizeTelegramUsername(username)
	if normalizedUsername != "" {
		return "https://t.me/" + normalizedUsername
	}
	if userID != nil && *userID > 0 {
		return "tg://user?id=" + strconv.FormatInt(*userID, 10)
	}
	return ""
}

func buildTelegramDataCheckString(payload TelegramLoginPayload) string {
	values := map[string]string{
		"auth_date":  strconv.FormatInt(payload.AuthDate, 10),
		"first_name": strings.TrimSpace(payload.FirstName),
		"id":         strconv.FormatInt(payload.ID, 10),
		"last_name":  strings.TrimSpace(payload.LastName),
		"photo_url":  strings.TrimSpace(payload.PhotoURL),
		"username":   strings.TrimSpace(payload.Username),
	}

	keys := make([]string, 0, len(values))
	for key, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, values[key]))
	}
	return strings.Join(parts, "\n")
}

// VerifyTelegramLoginPayload validates Telegram Login Widget hash and auth_date freshness.
func VerifyTelegramLoginPayload(payload TelegramLoginPayload, botToken string, maxAgeSeconds int64, now time.Time) error {
	token := strings.TrimSpace(botToken)
	if token == "" {
		return apperrors.ErrInternalServer.WithDetails("TELEGRAM_BOT_TOKEN belum dikonfigurasi")
	}
	if payload.ID <= 0 || payload.AuthDate <= 0 || strings.TrimSpace(payload.Hash) == "" {
		return apperrors.ErrTelegramAuthInvalid.WithDetails("payload Telegram tidak lengkap")
	}

	if maxAgeSeconds <= 0 {
		maxAgeSeconds = 600
	}
	nowUnix := now.UTC().Unix()
	// Allow small forward skew.
	if payload.AuthDate > nowUnix+30 {
		return apperrors.ErrTelegramAuthInvalid.WithDetails("auth_date Telegram tidak valid")
	}
	if nowUnix-payload.AuthDate > maxAgeSeconds {
		return apperrors.ErrTelegramAuthInvalid.WithDetails("auth Telegram sudah kedaluwarsa, silakan login ulang")
	}

	dataCheckString := buildTelegramDataCheckString(payload)
	secretKey := sha256.Sum256([]byte(token))
	mac := hmac.New(sha256.New, secretKey[:])
	_, _ = mac.Write([]byte(dataCheckString))
	expectedHash := hex.EncodeToString(mac.Sum(nil))
	providedHash := strings.ToLower(strings.TrimSpace(payload.Hash))
	if !hmac.Equal([]byte(expectedHash), []byte(providedHash)) {
		return apperrors.ErrTelegramAuthInvalid.WithDetails("signature Telegram tidak valid")
	}

	return nil
}
