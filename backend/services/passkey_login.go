package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/passkey"
	"backend-gin/ent/user"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"
)

// BeginLogin starts the WebAuthn login process
func (s *EntPasskeyService) BeginLogin(ctx context.Context, email string) (*protocol.CredentialAssertion, string, error) {
	client := database.GetEntClient()

	// Get user with passkeys by email
	u, err := client.User.Query().
		Where(user.EmailEQ(email)).
		WithPasskeys().
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, "", errors.New("user not found")
		}
		return nil, "", fmt.Errorf("database error: %w", err)
	}

	if len(u.Edges.Passkeys) == 0 {
		return nil, "", errors.New("no passkeys registered")
	}

	// Create WebAuthn user adapter
	webAuthnUser := &EntWebAuthnUser{
		User:     u,
		Passkeys: u.Edges.Passkeys,
	}

	options, session, err := s.webauthn.BeginLogin(webAuthnUser)
	if err != nil {
		s.logger.Error("Failed to begin login", zap.Error(err))
		return nil, "", fmt.Errorf("failed to begin login: %w", err)
	}

	// Store session for verification
	sessionKey := loginSessionKey(email)
	s.storeSession(sessionKey, session)

	return options, sessionKey, nil
}

// BeginDiscoverableLogin starts a discoverable (usernameless) login
func (s *EntPasskeyService) BeginDiscoverableLogin() (*protocol.CredentialAssertion, string, error) {
	options, session, err := s.webauthn.BeginDiscoverableLogin()
	if err != nil {
		s.logger.Error("Failed to begin discoverable login", zap.Error(err))
		return nil, "", fmt.Errorf("failed to begin discoverable login: %w", err)
	}

	// Generate a random session ID
	sessionID := fmt.Sprintf("discover_%d", time.Now().UnixNano())
	s.storeSession(discoverableSessionKey(sessionID), session)

	return options, sessionID, nil
}

// FinishLogin completes the WebAuthn login process
func (s *EntPasskeyService) FinishLogin(ctx context.Context, email string, sessionID string, response *protocol.ParsedCredentialAssertionData) (*ent.User, error) {
	client := database.GetEntClient()
	origin, host := originAndHostFromAssertion(response)
	sessionFound := false

	// Get user with passkeys
	u, err := client.User.Query().
		Where(user.EmailEQ(email)).
		WithPasskeys().
		Only(ctx)
	if err != nil {
		s.logger.Error("Passkey login failed",
			zap.String("error", err.Error()),
			zap.String("email", email),
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
		s.logger.Error("Passkey login failed",
			zap.String("error", "login session expired or not found"),
			zap.String("email", email),
			zap.String("origin", origin),
			zap.String("host", host),
			zap.Bool("session_found", sessionFound),
		)
		return nil, errors.New("login session expired or not found")
	}

	credential, err := s.webauthn.ValidateLogin(webAuthnUser, *session, response)
	if err != nil {
		s.logger.Error("Failed to validate login",
			zap.String("error", err.Error()),
			zap.String("email", email),
			zap.String("origin", origin),
			zap.String("host", host),
			zap.Bool("session_found", sessionFound),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to validate login: %w", err)
	}

	// Update sign count for clone detection
	if err := s.updateSignCount(ctx, credential.ID, credential.Authenticator.SignCount); err != nil {
		s.logger.Warn("Failed to update sign count", zap.Error(err))
	}

	// Update last used
	now := time.Now()
	if err := client.Passkey.Update().
		Where(passkey.CredentialIDEQ(credential.ID)).
		SetLastUsedAt(now).
		Exec(ctx); err != nil {
		s.logger.Warn("Failed to update last used", zap.Error(err))
	}

	s.logger.Info("Passkey login successful",
		zap.String("email", email),
	)

	return u, nil
}

// FinishDiscoverableLogin completes a discoverable login
func (s *EntPasskeyService) FinishDiscoverableLogin(ctx context.Context, sessionID string, response *protocol.ParsedCredentialAssertionData) (*ent.User, error) {
	client := database.GetEntClient()

	// Get session
	session, ok := s.getSession(discoverableSessionKey(sessionID))
	if !ok {
		return nil, errors.New("login session expired or not found")
	}

	// Handler function to find user by credential
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		// Find passkey by credential ID
		pk, err := client.Passkey.Query().
			Where(passkey.CredentialIDEQ(rawID)).
			WithUser(func(q *ent.UserQuery) {
				q.WithPasskeys()
			}).
			Only(ctx)
		if err != nil {
			return nil, fmt.Errorf("credential not found: %w", err)
		}

		u := pk.Edges.User
		if u == nil {
			return nil, errors.New("user not found for credential")
		}

		// Create WebAuthn user adapter
		webAuthnUser := &EntWebAuthnUser{
			User:     u,
			Passkeys: u.Edges.Passkeys,
		}

		return webAuthnUser, nil
	}

	credential, err := s.webauthn.ValidateDiscoverableLogin(handler, *session, response)
	if err != nil {
		s.logger.Error("Failed to validate discoverable login", zap.Error(err))
		return nil, fmt.Errorf("failed to validate login: %w", err)
	}

	// Find the user from the credential
	pk, err := client.Passkey.Query().
		Where(passkey.CredentialIDEQ(credential.ID)).
		WithUser().
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("credential not found: %w", err)
	}

	u := pk.Edges.User
	if u == nil {
		return nil, errors.New("user not found for credential")
	}

	// Update sign count
	if err := s.updateSignCount(ctx, credential.ID, credential.Authenticator.SignCount); err != nil {
		s.logger.Warn("Failed to update sign count", zap.Error(err))
	}

	// Update last used
	now := time.Now()
	if err := client.Passkey.Update().
		Where(passkey.CredentialIDEQ(credential.ID)).
		SetLastUsedAt(now).
		Exec(ctx); err != nil {
		s.logger.Warn("Failed to update last used", zap.Error(err))
	}

	s.logger.Info("Discoverable passkey login successful",
		zap.Int("user_id", u.ID),
	)

	return u, nil
}

// updateSignCount updates the signature counter for a credential
func (s *EntPasskeyService) updateSignCount(ctx context.Context, credentialID []byte, newCount uint32) error {
	client := database.GetEntClient()
	return client.Passkey.Update().
		Where(passkey.CredentialIDEQ(credentialID)).
		SetSignCount(newCount).
		Exec(ctx)
}

func originAndHostFromAssertion(response *protocol.ParsedCredentialAssertionData) (string, string) {
	if response == nil {
		return "", ""
	}
	return originAndHost(response.Response.CollectedClientData.Origin)
}

func originAndHost(origin string) (string, string) {
	if origin == "" {
		return "", ""
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return origin, ""
	}
	return origin, parsed.Host
}
