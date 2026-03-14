package services

import (
	"backend-gin/ent"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

type EntWebAuthnUser struct {
	User     *ent.User
	Passkeys []*ent.Passkey
}

// WebAuthnID returns the user's ID as bytes for WebAuthn
func (u *EntWebAuthnUser) WebAuthnID() []byte {
	return []byte{
		byte(u.User.ID >> 24),
		byte(u.User.ID >> 16),
		byte(u.User.ID >> 8),
		byte(u.User.ID),
	}
}

// WebAuthnName returns the user's email for WebAuthn
func (u *EntWebAuthnUser) WebAuthnName() string {
	return u.User.Email
}

// WebAuthnDisplayName returns the user's display name for WebAuthn
func (u *EntWebAuthnUser) WebAuthnDisplayName() string {
	if u.User.FullName != nil && *u.User.FullName != "" {
		return *u.User.FullName
	}
	if u.User.Username != nil && *u.User.Username != "" {
		return *u.User.Username
	}
	return u.User.Email
}

// WebAuthnCredentials returns all passkeys as WebAuthn credentials
func (u *EntWebAuthnUser) WebAuthnCredentials() []webauthn.Credential {
	credentials := make([]webauthn.Credential, len(u.Passkeys))
	for i, pk := range u.Passkeys {
		credentials[i] = entPasskeyToWebAuthnCredential(pk)
	}
	return credentials
}

// entPasskeyToWebAuthnCredential converts an Ent Passkey to webauthn.Credential
func entPasskeyToWebAuthnCredential(pk *ent.Passkey) webauthn.Credential {
	transports := pk.Transports
	authTransports := make([]protocol.AuthenticatorTransport, len(transports))
	for i, t := range transports {
		authTransports[i] = protocol.AuthenticatorTransport(t)
	}

	return webauthn.Credential{
		ID:              pk.CredentialID,
		PublicKey:       pk.PublicKey,
		AttestationType: pk.AttestationType,
		Authenticator: webauthn.Authenticator{
			AAGUID:    pk.Aaguid,
			SignCount: pk.SignCount,
		},
		Transport: authTransports,
		Flags: webauthn.CredentialFlags{
			BackupEligible: pk.BackupEligible,
			BackupState:    pk.BackupState,
		},
	}
}
