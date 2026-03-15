package dto

import (
	"testing"
	"time"
)

func TestSudoVerifyRequestFields(t *testing.T) {
	req := SudoVerifyRequest{
		Password:   "secret",
		TOTPCode:   "123456",
		BackupCode: "",
	}
	if req.Password != "secret" {
		t.Errorf("Password = %q", req.Password)
	}
	if req.TOTPCode != "123456" {
		t.Errorf("TOTPCode = %q", req.TOTPCode)
	}
}

func TestSudoVerifyResponseFields(t *testing.T) {
	now := time.Now()
	resp := SudoVerifyResponse{
		SudoToken: "token-abc",
		ExpiresAt: now,
		ExpiresIn: 900,
		Message:   "Sudo mode activated",
	}
	if resp.SudoToken != "token-abc" {
		t.Errorf("SudoToken = %q", resp.SudoToken)
	}
	if resp.ExpiresIn != 900 {
		t.Errorf("ExpiresIn = %d, want 900", resp.ExpiresIn)
	}
}

func TestSudoStatusResponse(t *testing.T) {
	resp := SudoStatusResponse{
		IsActive:     true,
		RequiresTOTP: false,
	}
	if !resp.IsActive {
		t.Error("IsActive should be true")
	}
	if resp.RequiresTOTP {
		t.Error("RequiresTOTP should be false")
	}
	if resp.ExpiresAt != nil {
		t.Error("ExpiresAt should be nil")
	}
}
