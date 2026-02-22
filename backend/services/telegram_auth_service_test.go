package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"
)

func signTelegramPayload(payload TelegramLoginPayload, botToken string) string {
	secretKey := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secretKey[:])
	_, _ = mac.Write([]byte(buildTelegramDataCheckString(payload)))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyTelegramLoginPayload(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	botToken := "123456:ABCDEF_bot_token"
	payload := TelegramLoginPayload{
		ID:        7770001234,
		FirstName: "AI",
		LastName:  "Valid",
		Username:  "AiValid_Official",
		PhotoURL:  "https://t.me/i/userpic/320/example.jpg",
		AuthDate:  now.Unix(),
	}
	payload.Hash = signTelegramPayload(payload, botToken)

	if err := VerifyTelegramLoginPayload(payload, botToken, 600, now); err != nil {
		t.Fatalf("expected valid payload, got error: %v", err)
	}
}

func TestVerifyTelegramLoginPayload_InvalidHash(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	botToken := "123456:ABCDEF_bot_token"
	payload := TelegramLoginPayload{
		ID:        7770001234,
		FirstName: "AI",
		AuthDate:  now.Unix(),
		Hash:      "bad_hash",
	}

	err := VerifyTelegramLoginPayload(payload, botToken, 600, now)
	if err == nil {
		t.Fatalf("expected invalid hash error")
	}
}

func TestVerifyTelegramLoginPayload_Expired(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	botToken := "123456:ABCDEF_bot_token"
	payload := TelegramLoginPayload{
		ID:        7770001234,
		FirstName: "AI",
		AuthDate:  now.Add(-20 * time.Minute).Unix(),
	}
	payload.Hash = signTelegramPayload(payload, botToken)

	err := VerifyTelegramLoginPayload(payload, botToken, 600, now)
	if err == nil {
		t.Fatalf("expected expired auth payload error")
	}
}

func TestBuildTelegramLinksAndDisplay(t *testing.T) {
	userID := int64(123456789)
	if got := BuildTelegramDisplayHandle("MyUser", &userID); got != "@myuser" {
		t.Fatalf("unexpected display handle: %q", got)
	}
	if got := BuildTelegramDeepLink("MyUser", &userID); got != "https://t.me/myuser" {
		t.Fatalf("unexpected deep link: %q", got)
	}
	if got := BuildTelegramDisplayHandle("", &userID); got != "ID: 123456789" {
		t.Fatalf("unexpected id display: %q", got)
	}
	if got := BuildTelegramDeepLink("", &userID); got != "tg://user?id=123456789" {
		t.Fatalf("unexpected fallback deep link: %q", got)
	}
}
