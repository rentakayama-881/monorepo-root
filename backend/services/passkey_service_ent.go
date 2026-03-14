package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/passkey"
	"backend-gin/ent/user"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"
)

// EntPasskeyService handles WebAuthn/Passkey operations using Ent ORM
type EntPasskeyService struct {
	logger      *zap.Logger
	webauthn    *webauthn.WebAuthn
	sessionTTL  time.Duration
	memSessions *inMemoryWebAuthnSessionStore
}

// NewEntPasskeyService creates a new EntPasskeyService
func NewEntPasskeyService(logger *zap.Logger, rpID string, rpOrigins []string, rpName string) (*EntPasskeyService, error) {
	if rpID == "" {
		rpID = "localhost"
	}
	if len(rpOrigins) == 0 {
		rpOrigins = []string{"http://localhost:3000"}
	}
	if rpName == "" {
		rpName = "AIValid"
	}

	wconfig := &webauthn.Config{
		RPDisplayName: rpName,
		RPID:          rpID,
		RPOrigins:     rpOrigins,
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			AuthenticatorAttachment: protocol.AuthenticatorAttachment(""),
			ResidentKey:             protocol.ResidentKeyRequirementPreferred,
			UserVerification:        protocol.VerificationPreferred,
		},
		AttestationPreference: protocol.PreferNoAttestation,
		Timeouts: webauthn.TimeoutsConfig{
			Login: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    time.Minute * 5,
				TimeoutUVD: time.Minute * 5,
			},
			Registration: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    time.Minute * 5,
				TimeoutUVD: time.Minute * 5,
			},
		},
	}

	w, err := webauthn.New(wconfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create webauthn: %w", err)
	}

	return &EntPasskeyService{
		logger:     logger,
		webauthn:   w,
		sessionTTL: time.Minute * 5,
		memSessions: newInMemoryWebAuthnSessionStore(
			time.Minute, // cleanup interval
		),
	}, nil
}

// ListPasskeys returns all passkeys for a user
func (s *EntPasskeyService) ListPasskeys(ctx context.Context, userID int) ([]*ent.Passkey, error) {
	client := database.GetEntClient()
	passkeys, err := client.Passkey.Query().
		Where(passkey.UserIDEQ(userID)).
		Order(ent.Desc(passkey.FieldCreatedAt)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list passkeys: %w", err)
	}
	return passkeys, nil
}

// GetPasskeyCount returns the number of passkeys for a user
func (s *EntPasskeyService) GetPasskeyCount(ctx context.Context, userID int) (int, error) {
	client := database.GetEntClient()
	count, err := client.Passkey.Query().
		Where(passkey.UserIDEQ(userID)).
		Count(ctx)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// DeletePasskey removes a passkey
func (s *EntPasskeyService) DeletePasskey(ctx context.Context, userID int, passkeyID int) error {
	client := database.GetEntClient()

	// Delete with both ID and user_id check for authorization
	rowsAffected, err := client.Passkey.Delete().
		Where(
			passkey.IDEQ(passkeyID),
			passkey.UserIDEQ(userID),
		).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete passkey: %w", err)
	}
	if rowsAffected == 0 {
		return errors.New("passkey not found")
	}

	s.logger.Info("Passkey deleted",
		zap.Int("user_id", userID),
		zap.Int("passkey_id", passkeyID),
	)

	return nil
}

// RenamePasskey updates the name of a passkey
func (s *EntPasskeyService) RenamePasskey(ctx context.Context, userID int, passkeyID int, newName string) error {
	client := database.GetEntClient()

	rowsAffected, err := client.Passkey.Update().
		Where(
			passkey.IDEQ(passkeyID),
			passkey.UserIDEQ(userID),
		).
		SetName(newName).
		Save(ctx)
	if err != nil {
		return fmt.Errorf("failed to rename passkey: %w", err)
	}
	if rowsAffected == 0 {
		return errors.New("passkey not found")
	}

	return nil
}

// HasPasskeys checks if user has any passkeys registered
func (s *EntPasskeyService) HasPasskeys(ctx context.Context, userID int) (bool, error) {
	count, err := s.GetPasskeyCount(ctx, userID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasPasskeysByEmail checks if user has passkeys by email
func (s *EntPasskeyService) HasPasskeysByEmail(ctx context.Context, email string) (bool, error) {
	client := database.GetEntClient()

	u, err := client.User.Query().
		Where(user.EmailEQ(email)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return false, nil
		}
		return false, err
	}
	return s.HasPasskeys(ctx, u.ID)
}

// PasskeyToJSON converts an Ent Passkey to a JSON-friendly format for API responses
type PasskeyResponse struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	CreatedAt      time.Time  `json:"created_at"`
	LastUsedAt     *time.Time `json:"last_used_at,omitempty"`
	BackupEligible bool       `json:"backup_eligible"`
	BackupState    bool       `json:"backup_state"`
}

// ToPasskeyResponse converts an Ent Passkey to PasskeyResponse
func ToPasskeyResponse(pk *ent.Passkey) PasskeyResponse {
	return PasskeyResponse{
		ID:             pk.ID,
		Name:           pk.Name,
		CreatedAt:      pk.CreatedAt,
		LastUsedAt:     pk.LastUsedAt,
		BackupEligible: pk.BackupEligible,
		BackupState:    pk.BackupState,
	}
}

// ToPasskeyResponseList converts a list of Ent Passkeys to PasskeyResponse list
func ToPasskeyResponseList(passkeys []*ent.Passkey) []PasskeyResponse {
	result := make([]PasskeyResponse, len(passkeys))
	for i, pk := range passkeys {
		result[i] = ToPasskeyResponse(pk)
	}
	return result
}

// EntUserToGORMUser converts ent.User to models.User for backward compatibility
// This is a temporary bridge during migration
func (s *EntPasskeyService) EntUserToGORMUserID(entUser *ent.User) uint {
	return uint(entUser.ID)
}

// Legacy compatibility - wrapper to convert ent.Passkey to JSON bytes
func EntPasskeyToTransportsJSON(pk *ent.Passkey) []byte {
	if pk.Transports == nil {
		return nil
	}
	data, _ := json.Marshal(pk.Transports)
	return data
}

