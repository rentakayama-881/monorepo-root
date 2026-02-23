package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
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

func TestBuildTelegramDataCheckString_PreservesUsernameCase(t *testing.T) {
	payload := TelegramLoginPayload{
		ID:        7770001234,
		FirstName: "AI",
		LastName:  "Valid",
		Username:  "AiValid_Official",
		AuthDate:  1_700_000_000,
	}
	got := buildTelegramDataCheckString(payload)
	if !strings.Contains(got, "username=AiValid_Official") {
		t.Fatalf("data-check-string should preserve original username case, got:\n%s", got)
	}
	if strings.Contains(got, "username=aivalid_official") {
		t.Fatalf("data-check-string should NOT contain lowercased username, got:\n%s", got)
	}
}

// TestVerifyTelegramLoginPayload_ExternallySignedMixedCase proves that an HMAC
// computed over the original-case username (as Telegram would sign it) passes
// verification after the case-sensitivity fix.
func TestVerifyTelegramLoginPayload_ExternallySignedMixedCase(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	botToken := "123456:ABCDEF_bot_token"

	// Build the data-check-string exactly as Telegram would: original case.
	dataCheckString := "auth_date=1700000000\nfirst_name=AI\nid=7770001234\nlast_name=Valid\nphoto_url=https://t.me/i/userpic/320/example.jpg\nusername=AiValid_Official"

	secretKey := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secretKey[:])
	mac.Write([]byte(dataCheckString))
	externalHash := hex.EncodeToString(mac.Sum(nil))

	payload := TelegramLoginPayload{
		ID:        7770001234,
		FirstName: "AI",
		LastName:  "Valid",
		Username:  "AiValid_Official",
		PhotoURL:  "https://t.me/i/userpic/320/example.jpg",
		AuthDate:  now.Unix(),
		Hash:      externalHash,
	}

	if err := VerifyTelegramLoginPayload(payload, botToken, 600, now); err != nil {
		t.Fatalf("expected externally-signed mixed-case payload to pass, got: %v", err)
	}
}

// TestVerifyTelegramLoginPayload_LowercasedHashDoesNotMatchOriginalCase proves
// that an HMAC computed over a lowercased username does NOT match a payload
// whose username has uppercase letters. This confirms the old bug path fails.
func TestVerifyTelegramLoginPayload_LowercasedHashDoesNotMatchOriginalCase(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	botToken := "123456:ABCDEF_bot_token"

	// Compute HMAC using lowercased username (the old buggy behavior).
	wrongDataCheckString := "auth_date=1700000000\nfirst_name=AI\nid=7770001234\nlast_name=Valid\nphoto_url=https://t.me/i/userpic/320/example.jpg\nusername=aivalid_official"

	secretKey := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secretKey[:])
	mac.Write([]byte(wrongDataCheckString))
	wrongHash := hex.EncodeToString(mac.Sum(nil))

	payload := TelegramLoginPayload{
		ID:        7770001234,
		FirstName: "AI",
		LastName:  "Valid",
		Username:  "AiValid_Official",
		PhotoURL:  "https://t.me/i/userpic/320/example.jpg",
		AuthDate:  now.Unix(),
		Hash:      wrongHash,
	}

	err := VerifyTelegramLoginPayload(payload, botToken, 600, now)
	if err == nil {
		t.Fatalf("expected HMAC mismatch for lowercased hash vs original-case username")
	}
}
