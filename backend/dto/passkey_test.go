package dto

import (
	"testing"
	"time"
)

func TestPasskeyResponseFields(t *testing.T) {
	now := time.Now()
	resp := PasskeyResponse{
		ID:         1,
		Name:       "My Key",
		CreatedAt:  now,
		Transports: []string{"usb", "nfc"},
	}
	if resp.ID != 1 {
		t.Errorf("ID = %d, want 1", resp.ID)
	}
	if resp.Name != "My Key" {
		t.Errorf("Name = %q", resp.Name)
	}
	if resp.LastUsedAt != nil {
		t.Error("LastUsedAt should be nil")
	}
	if len(resp.Transports) != 2 {
		t.Errorf("Transports len = %d, want 2", len(resp.Transports))
	}
}

func TestPasskeyListResponse(t *testing.T) {
	resp := PasskeyListResponse{
		Passkeys: []PasskeyResponse{
			{ID: 1, Name: "Key1"},
			{ID: 2, Name: "Key2"},
		},
		Count: 2,
	}
	if resp.Count != 2 {
		t.Errorf("Count = %d, want 2", resp.Count)
	}
	if len(resp.Passkeys) != 2 {
		t.Errorf("Passkeys len = %d, want 2", len(resp.Passkeys))
	}
}

func TestPasskeyStatusResponse(t *testing.T) {
	resp := PasskeyStatusResponse{
		HasPasskeys: true,
		Count:       3,
	}
	if !resp.HasPasskeys {
		t.Error("HasPasskeys should be true")
	}
	if resp.Count != 3 {
		t.Errorf("Count = %d, want 3", resp.Count)
	}
}
