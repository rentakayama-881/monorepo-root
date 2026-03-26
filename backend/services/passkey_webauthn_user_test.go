package services

import (
	"testing"

	"backend-gin/ent"
)

func TestEntWebAuthnUser_WebAuthnID(t *testing.T) {
	user := &ent.User{}
	user.ID = 256 // 0x00000100

	wau := &EntWebAuthnUser{User: user}
	id := wau.WebAuthnID()

	if len(id) != 4 {
		t.Fatalf("WebAuthnID length = %d, want 4", len(id))
	}
	// ID 256 = 0x00000100 → bytes: [0, 0, 1, 0]
	if id[0] != 0 || id[1] != 0 || id[2] != 1 || id[3] != 0 {
		t.Errorf("WebAuthnID = %v, want [0 0 1 0]", id)
	}
}

func TestEntWebAuthnUser_WebAuthnID_SmallID(t *testing.T) {
	user := &ent.User{}
	user.ID = 1

	wau := &EntWebAuthnUser{User: user}
	id := wau.WebAuthnID()

	if len(id) != 4 {
		t.Fatalf("WebAuthnID length = %d, want 4", len(id))
	}
	if id[3] != 1 {
		t.Errorf("last byte = %d, want 1", id[3])
	}
}

func TestEntWebAuthnUser_WebAuthnName(t *testing.T) {
	user := &ent.User{}
	user.Email = "test@example.com"

	wau := &EntWebAuthnUser{User: user}
	name := wau.WebAuthnName()
	if name != "test@example.com" {
		t.Errorf("WebAuthnName = %q, want %q", name, "test@example.com")
	}
}

func TestEntWebAuthnUser_WebAuthnDisplayName_FullName(t *testing.T) {
	fullName := "John Doe"
	user := &ent.User{FullName: &fullName}
	user.Email = "john@example.com"

	wau := &EntWebAuthnUser{User: user}
	displayName := wau.WebAuthnDisplayName()
	if displayName != "John Doe" {
		t.Errorf("WebAuthnDisplayName = %q, want %q", displayName, "John Doe")
	}
}

func TestEntWebAuthnUser_WebAuthnDisplayName_Username(t *testing.T) {
	username := "johndoe"
	user := &ent.User{Username: &username}
	user.Email = "john@example.com"

	wau := &EntWebAuthnUser{User: user}
	displayName := wau.WebAuthnDisplayName()
	if displayName != "johndoe" {
		t.Errorf("WebAuthnDisplayName = %q, want %q", displayName, "johndoe")
	}
}

func TestEntWebAuthnUser_WebAuthnDisplayName_FallbackEmail(t *testing.T) {
	user := &ent.User{}
	user.Email = "fallback@example.com"

	wau := &EntWebAuthnUser{User: user}
	displayName := wau.WebAuthnDisplayName()
	if displayName != "fallback@example.com" {
		t.Errorf("WebAuthnDisplayName = %q, want %q", displayName, "fallback@example.com")
	}
}

func TestEntWebAuthnUser_WebAuthnDisplayName_EmptyFullNameFallsToUsername(t *testing.T) {
	empty := ""
	username := "user123"
	user := &ent.User{FullName: &empty, Username: &username}
	user.Email = "user@example.com"

	wau := &EntWebAuthnUser{User: user}
	displayName := wau.WebAuthnDisplayName()
	if displayName != "user123" {
		t.Errorf("WebAuthnDisplayName = %q, want %q", displayName, "user123")
	}
}

func TestEntWebAuthnUser_WebAuthnDisplayName_EmptyBothFallsToEmail(t *testing.T) {
	empty := ""
	user := &ent.User{FullName: &empty, Username: &empty}
	user.Email = "email@example.com"

	wau := &EntWebAuthnUser{User: user}
	displayName := wau.WebAuthnDisplayName()
	if displayName != "email@example.com" {
		t.Errorf("WebAuthnDisplayName = %q, want %q", displayName, "email@example.com")
	}
}

func TestEntWebAuthnUser_WebAuthnCredentials_Empty(t *testing.T) {
	user := &ent.User{}
	wau := &EntWebAuthnUser{User: user, Passkeys: nil}

	creds := wau.WebAuthnCredentials()
	if len(creds) != 0 {
		t.Errorf("credentials count = %d, want 0", len(creds))
	}
}

func TestEntWebAuthnUser_WebAuthnCredentials_WithPasskeys(t *testing.T) {
	user := &ent.User{}
	passkeys := []*ent.Passkey{
		{
			CredentialID:    []byte{1, 2, 3},
			PublicKey:       []byte{4, 5, 6},
			AttestationType: "none",
			Aaguid:          []byte{7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22},
			SignCount:       5,
			BackupEligible:  true,
			BackupState:     false,
			Transports:      []string{"usb", "nfc"},
		},
	}

	wau := &EntWebAuthnUser{User: user, Passkeys: passkeys}
	creds := wau.WebAuthnCredentials()

	if len(creds) != 1 {
		t.Fatalf("credentials count = %d, want 1", len(creds))
	}

	cred := creds[0]
	if string(cred.ID) != string([]byte{1, 2, 3}) {
		t.Error("credential ID mismatch")
	}
	if cred.AttestationType != "none" {
		t.Errorf("attestation type = %q, want 'none'", cred.AttestationType)
	}
	if cred.Authenticator.SignCount != 5 {
		t.Errorf("sign count = %d, want 5", cred.Authenticator.SignCount)
	}
	if !cred.Flags.BackupEligible {
		t.Error("BackupEligible should be true")
	}
	if cred.Flags.BackupState {
		t.Error("BackupState should be false")
	}
	if len(cred.Transport) != 2 {
		t.Errorf("transports count = %d, want 2", len(cred.Transport))
	}
}

func TestEntPasskeyToWebAuthnCredential(t *testing.T) {
	pk := &ent.Passkey{
		CredentialID:    []byte{10, 20},
		PublicKey:       []byte{30, 40},
		AttestationType: "direct",
		Aaguid:          []byte{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
		SignCount:       42,
		BackupEligible:  false,
		BackupState:     true,
		Transports:      []string{"internal"},
	}

	cred := entPasskeyToWebAuthnCredential(pk)

	if string(cred.ID) != string(pk.CredentialID) {
		t.Error("credential ID mismatch")
	}
	if string(cred.PublicKey) != string(pk.PublicKey) {
		t.Error("public key mismatch")
	}
	if cred.AttestationType != "direct" {
		t.Errorf("attestation = %q, want direct", cred.AttestationType)
	}
	if cred.Authenticator.SignCount != 42 {
		t.Errorf("sign count = %d, want 42", cred.Authenticator.SignCount)
	}
	if cred.Flags.BackupEligible {
		t.Error("BackupEligible should be false")
	}
	if !cred.Flags.BackupState {
		t.Error("BackupState should be true")
	}
	if len(cred.Transport) != 1 {
		t.Fatalf("transports = %d, want 1", len(cred.Transport))
	}
	if string(cred.Transport[0]) != "internal" {
		t.Errorf("transport = %q, want internal", cred.Transport[0])
	}
}

func TestEntPasskeyToWebAuthnCredential_EmptyTransports(t *testing.T) {
	pk := &ent.Passkey{
		CredentialID: []byte{1},
		PublicKey:    []byte{2},
		Transports:   []string{},
	}

	cred := entPasskeyToWebAuthnCredential(pk)
	if len(cred.Transport) != 0 {
		t.Errorf("transports = %d, want 0", len(cred.Transport))
	}
}
