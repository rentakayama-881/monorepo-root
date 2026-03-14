package services

import (
	"context"
	"errors"
	"fmt"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/user"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"
)

// BeginRegistration starts the WebAuthn registration process
func (s *EntPasskeyService) BeginRegistration(ctx context.Context, userID int) (*protocol.CredentialCreation, string, error) {
	client := database.GetEntClient()

	// Get user with passkeys
	u, err := client.User.Query().
		Where(user.IDEQ(userID)).
		WithPasskeys().
		Only(ctx)
	if err != nil {
		return nil, "", fmt.Errorf("user not found: %w", err)
	}

	// Create WebAuthn user adapter
	webAuthnUser := &EntWebAuthnUser{
		User:     u,
		Passkeys: u.Edges.Passkeys,
	}

	// Exclude existing credentials to prevent re-registration
	excludeList := make([]protocol.CredentialDescriptor, len(webAuthnUser.Passkeys))
	for i, pk := range webAuthnUser.Passkeys {
		excludeList[i] = protocol.CredentialDescriptor{
			Type:         protocol.PublicKeyCredentialType,
			CredentialID: pk.CredentialID,
		}
	}

	options, session, err := s.webauthn.BeginRegistration(
		webAuthnUser,
		webauthn.WithExclusions(excludeList),
	)
	if err != nil {
		s.logger.Error("Failed to begin registration", zap.Error(err))
		return nil, "", fmt.Errorf("failed to begin registration: %w", err)
	}

	// Store session for verification
	sessionKey := registrationSessionKey(userID)
	s.storeSession(sessionKey, session)

	return options, sessionKey, nil
}

// FinishRegistration completes the WebAuthn registration process
func (s *EntPasskeyService) FinishRegistration(ctx context.Context, userID int, sessionID string, name string, response *protocol.ParsedCredentialCreationData) (*ent.Passkey, error) {
	client := database.GetEntClient()
	origin, host := originAndHostFromCreation(response)
	sessionFound := false

	// Get user with passkeys
	u, err := client.User.Query().
		Where(user.IDEQ(userID)).
		WithPasskeys().
		Only(ctx)
	if err != nil {
		s.logger.Error("Passkey registration failed",
			zap.String("error", err.Error()),
			zap.Int("user_id", userID),
			zap.String("origin", origin),
			zap.String("host", host),
			zap.Bool("session_found", sessionFound),
		)
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Create WebAuthn user adapter
	webAuthnUser := &EntWebAuthnUser{
		User:     u,
		Passkeys: u.Edges.Passkeys,
	}

	// Get session
	sessionKey := sessionID
	session, sessionFound := s.getSession(sessionKey)
	if !sessionFound {
		s.logger.Error("Passkey registration failed",
			zap.String("error", "registration session expired or not found"),
			zap.Int("user_id", userID),
			zap.String("origin", origin),
			zap.String("host", host),
			zap.Bool("session_found", sessionFound),
		)
		return nil, errors.New("registration session expired or not found")
	}

	credential, err := s.webauthn.CreateCredential(webAuthnUser, *session, response)
	if err != nil {
		s.logger.Error("Failed to create credential",
			zap.String("error", err.Error()),
			zap.Int("user_id", userID),
			zap.String("origin", origin),
			zap.String("host", host),
			zap.Bool("session_found", sessionFound),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to verify credential: %w", err)
	}

	// Convert transports to string slice
	transports := make([]string, len(credential.Transport))
	for i, t := range credential.Transport {
		transports[i] = string(t)
	}

	// Set default name if empty
	if name == "" {
		name = "Passkey"
	}

	// Create passkey record using Ent
	pk, err := client.Passkey.Create().
		SetUserID(userID).
		SetCredentialID(credential.ID).
		SetPublicKey(credential.PublicKey).
		SetAttestationType(credential.AttestationType).
		SetAaguid(credential.Authenticator.AAGUID).
		SetSignCount(credential.Authenticator.SignCount).
		SetBackupEligible(credential.Flags.BackupEligible).
		SetBackupState(credential.Flags.BackupState).
		SetName(name).
		SetTransports(transports).
		Save(ctx)
	if err != nil {
		s.logger.Error("Failed to save passkey",
			zap.String("error", err.Error()),
			zap.Int("user_id", userID),
			zap.String("origin", origin),
			zap.String("host", host),
			zap.Bool("session_found", sessionFound),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to save passkey: %w", err)
	}

	s.logger.Info("Passkey registered",
		zap.Int("user_id", userID),
		zap.String("name", name),
	)

	return pk, nil
}

func originAndHostFromCreation(response *protocol.ParsedCredentialCreationData) (string, string) {
	if response == nil {
		return "", ""
	}
	return originAndHost(response.Response.CollectedClientData.Origin)
}
