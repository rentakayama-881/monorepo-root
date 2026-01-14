package services

import (
	"context"
	"crypto/rand"
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
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// EntPasskeyService handles WebAuthn/Passkey operations using Ent ORM
type EntPasskeyService struct {
	logger     *zap.Logger
	webauthn   *webauthn.WebAuthn
	sessionTTL time.Duration
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
		rpName = "Alephdraad"
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
	}, nil
}

// storeSession stores a WebAuthn session
func (s *EntPasskeyService) storeSession(key string, session *webauthn.SessionData) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := CacheSet(ctx, key, session, s.sessionTTL); err != nil {
		s.logger.Error("Failed to store WebAuthn session", zap.String("key", key), zap.Error(err))
	}
}

// getSession retrieves and deletes a WebAuthn session
func (s *EntPasskeyService) getSession(key string) (*webauthn.SessionData, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var session webauthn.SessionData
	if err := CacheGet(ctx, key, &session); err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, false
		}
		s.logger.Error("Failed to retrieve WebAuthn session", zap.String("key", key), zap.Error(err))
		return nil, false
	}

	if err := CacheDelete(ctx, key); err != nil {
		s.logger.Warn("Failed to delete WebAuthn session", zap.String("key", key), zap.Error(err))
	}

	return &session, true
}

func registrationSessionKey(userID int) string {
	return fmt.Sprintf("webauthn:reg:%d", userID)
}

func loginSessionKey(email string) string {
	return fmt.Sprintf("webauthn:login:%s", email)
}

func discoverableSessionKey(sessionID string) string {
	return fmt.Sprintf("webauthn:discover:%s", sessionID)
}

func generateSessionID(prefix string) (string, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return "", fmt.Errorf("failed to generate session id: %w", err)
	}
	return fmt.Sprintf("%s_%x", prefix, token), nil
}

// EntWebAuthnUser wraps ent.User to implement webauthn.User interface
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

	return options, sessionID, nil
}

// FinishRegistration completes the WebAuthn registration process
func (s *EntPasskeyService) FinishRegistration(ctx context.Context, userID int, sessionID string, name string, response *protocol.ParsedCredentialCreationData) (*ent.Passkey, error) {
	client := database.GetEntClient()

	// Get user with passkeys
	u, err := client.User.Query().
		Where(user.IDEQ(userID)).
		WithPasskeys().
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Create WebAuthn user adapter
	webAuthnUser := &EntWebAuthnUser{
		User:     u,
		Passkeys: u.Edges.Passkeys,
	}

	// Get session
	sessionKey := registrationSessionKey(userID)
	session, ok := s.getSession(sessionKey)
	if !ok {
		return nil, errors.New("registration session expired or not found")
	}

	credential, err := s.webauthn.CreateCredential(webAuthnUser, *session, response)
	if err != nil {
		s.logger.Error("Failed to create credential", zap.Error(err))
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
		s.logger.Error("Failed to save passkey", zap.Error(err))
		return nil, fmt.Errorf("failed to save passkey: %w", err)
	}

	s.logger.Info("Passkey registered",
		zap.Int("user_id", userID),
		zap.String("name", name),
	)

	return pk, nil
}

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

	return options, sessionID, nil
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

	// Get user with passkeys
	u, err := client.User.Query().
		Where(user.EmailEQ(email)).
		WithPasskeys().
		Only(ctx)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Create WebAuthn user adapter
	webAuthnUser := &EntWebAuthnUser{
		User:     u,
		Passkeys: u.Edges.Passkeys,
	}

	// Get session
	sessionKey := loginSessionKey(email)
	session, ok := s.getSession(sessionKey)
	if !ok {
		return nil, errors.New("login session expired or not found")
	}

	credential, err := s.webauthn.ValidateLogin(webAuthnUser, *session, response)
	if err != nil {
		s.logger.Error("Failed to validate login", zap.Error(err))
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
