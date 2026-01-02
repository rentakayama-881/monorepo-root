package models

import (
	"encoding/json"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email          string  `gorm:"unique;not null"`
	Username       *string `gorm:"unique;column:name"`
	PasswordHash   string  `gorm:"not null"`
	EmailVerified  bool    `gorm:"default:false"`
	AvatarURL      string
	FullName       *string `gorm:"default:null"`
	Bio            string  `gorm:"type:text"`
	Pronouns       string
	Company        string
	Telegram       string
	SocialAccounts datatypes.JSON `gorm:"type:jsonb"`
	PrimaryBadgeID *uint          `gorm:"default:null"`

	// TOTP / 2FA fields
	TOTPSecret     string     `gorm:"column:totp_secret"`                // Encrypted TOTP secret
	TOTPEnabled    bool       `gorm:"column:totp_enabled;default:false"` // Is 2FA enabled
	TOTPVerifiedAt *time.Time `gorm:"column:totp_verified_at"`           // When 2FA was first verified

	// Passkeys relationship
	Passkeys []Passkey `gorm:"foreignKey:UserID"`
}

// BackupCode represents a single-use recovery code for 2FA
type BackupCode struct {
	gorm.Model
	UserID   uint   `gorm:"not null;index"`
	CodeHash string `gorm:"not null"` // Hashed backup code
	UsedAt   *time.Time
}

// Passkey represents a WebAuthn credential (passkey)
type Passkey struct {
	gorm.Model
	UserID          uint   `gorm:"not null;index"`
	CredentialID    []byte `gorm:"type:bytea;not null;uniqueIndex"` // Unique credential identifier
	PublicKey       []byte `gorm:"type:bytea;not null"`             // Public key in COSE format
	AttestationType string `gorm:"not null"`                        // Attestation type (none, direct, etc)
	AAGUID          []byte `gorm:"type:bytea"`                      // Authenticator Attestation GUID
	SignCount       uint32 `gorm:"not null;default:0"`              // Signature counter for clone detection
	Name            string `gorm:"not null;default:'Passkey'"`      // User-friendly name
	LastUsedAt      *time.Time
	// Transport hints (usb, nfc, ble, internal)
	Transports datatypes.JSON `gorm:"type:jsonb"`
}

// IsTOTPEnabled returns true if user has TOTP enabled
func (u *User) IsTOTPEnabled() bool {
	return u.TOTPEnabled && u.TOTPSecret != ""
}

// WebAuthnID returns the user's ID as bytes for WebAuthn
func (u *User) WebAuthnID() []byte {
	// Use a stable identifier - user ID as bytes
	return []byte{
		byte(u.ID >> 24),
		byte(u.ID >> 16),
		byte(u.ID >> 8),
		byte(u.ID),
	}
}

// WebAuthnName returns the user's email for WebAuthn
func (u *User) WebAuthnName() string {
	return u.Email
}

// WebAuthnDisplayName returns the user's display name for WebAuthn
func (u *User) WebAuthnDisplayName() string {
	if u.FullName != nil && *u.FullName != "" {
		return *u.FullName
	}
	if u.Username != nil && *u.Username != "" {
		return *u.Username
	}
	return u.Email
}

// WebAuthnCredentials returns all passkeys as WebAuthn credentials
func (u *User) WebAuthnCredentials() []webauthn.Credential {
	credentials := make([]webauthn.Credential, len(u.Passkeys))
	for i, pk := range u.Passkeys {
		credentials[i] = pk.ToWebAuthnCredential()
	}
	return credentials
}

// ToWebAuthnCredential converts a Passkey to webauthn.Credential
func (p *Passkey) ToWebAuthnCredential() webauthn.Credential {
	var transports []string
	if p.Transports != nil {
		_ = json.Unmarshal(p.Transports, &transports)
	}

	authTransports := make([]protocol.AuthenticatorTransport, len(transports))
	for i, t := range transports {
		authTransports[i] = protocol.AuthenticatorTransport(t)
	}

	return webauthn.Credential{
		ID:              p.CredentialID,
		PublicKey:       p.PublicKey,
		AttestationType: p.AttestationType,
		Authenticator: webauthn.Authenticator{
			AAGUID:    p.AAGUID,
			SignCount: p.SignCount,
		},
		Transport: authTransports,
	}
}

// SudoSession represents a temporary elevated privilege session for critical actions
type SudoSession struct {
	gorm.Model
	UserID    uint      `gorm:"not null;index"`
	TokenHash string    `gorm:"not null;uniqueIndex"` // SHA256 hash of the sudo token
	ExpiresAt time.Time `gorm:"not null"`
	IPAddress string
	UserAgent string
}
