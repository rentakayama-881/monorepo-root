package dto

import (
	"testing"
)

func TestRegisterRequestFields(t *testing.T) {
	req := RegisterRequest{
		Email:    "test@example.com",
		Password: "secret123",
	}
	if req.Email != "test@example.com" {
		t.Errorf("Email = %q, want 'test@example.com'", req.Email)
	}
	if req.Password != "secret123" {
		t.Errorf("Password = %q, want 'secret123'", req.Password)
	}
	if req.Username != nil {
		t.Error("Username should be nil")
	}
	if req.FullName != nil {
		t.Error("FullName should be nil")
	}
}

func TestLoginRequestFields(t *testing.T) {
	req := LoginRequest{
		Email:    "user@test.com",
		Password: "pass",
	}
	if req.Email != "user@test.com" {
		t.Errorf("Email = %q", req.Email)
	}
	if req.DeviceFingerprint != "" {
		t.Error("DeviceFingerprint should default to empty")
	}
}

func TestTOTPSetupResponseFields(t *testing.T) {
	resp := TOTPSetupResponse{
		Secret:    "BASE32SECRET",
		QRCodeURL: "otpauth://totp/...",
		Issuer:    "AIValid",
		Account:   "user@test.com",
	}
	if resp.Secret != "BASE32SECRET" {
		t.Errorf("Secret = %q", resp.Secret)
	}
	if resp.Issuer != "AIValid" {
		t.Errorf("Issuer = %q", resp.Issuer)
	}
}

func TestVerifyTokenInput(t *testing.T) {
	req := VerifyConfirmRequest{
		Token: "abc123",
	}
	if req.Token != "abc123" {
		t.Errorf("Token = %q", req.Token)
	}
}

func TestCreateUsernameRequest(t *testing.T) {
	req := CreateUsernameRequest{
		Username: "testuser",
	}
	if req.Username != "testuser" {
		t.Errorf("Username = %q", req.Username)
	}
}
