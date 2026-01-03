package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"backend-gin/models"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// PasskeyService handles WebAuthn/Passkey operations
type PasskeyService struct {
	db       *gorm.DB
	logger   *zap.Logger
	webauthn *webauthn.WebAuthn
	// In-memory session store for WebAuthn ceremonies
	// In production, use Redis or database
	sessionStore   map[string]*webauthn.SessionData
	sessionStoreMu sync.RWMutex
	sessionTTL     time.Duration
}

// NewPasskeyService creates a new PasskeyService
func NewPasskeyService(db *gorm.DB, logger *zap.Logger, rpID, rpOrigin, rpName string) (*PasskeyService, error) {
	if rpID == "" {
		rpID = "localhost"
	}
	if rpOrigin == "" {
		rpOrigin = "http://localhost:3000"
	}
	if rpName == "" {
		rpName = "Alephdraad"
	}

	wconfig := &webauthn.Config{
		RPDisplayName: rpName,
		RPID:          rpID,
		RPOrigins:     []string{rpOrigin},
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

	return &PasskeyService{
		db:           db,
		logger:       logger,
		webauthn:     w,
		sessionStore: make(map[string]*webauthn.SessionData),
		sessionTTL:   time.Minute * 5,
	}, nil
}

// storeSession stores a WebAuthn session
func (s *PasskeyService) storeSession(key string, session *webauthn.SessionData) {
	s.sessionStoreMu.Lock()
	defer s.sessionStoreMu.Unlock()
	s.sessionStore[key] = session

	// Clean up expired sessions periodically
	go func() {
		time.Sleep(s.sessionTTL)
		s.sessionStoreMu.Lock()
		delete(s.sessionStore, key)
		s.sessionStoreMu.Unlock()
	}()
}

// getSession retrieves and deletes a WebAuthn session
func (s *PasskeyService) getSession(key string) (*webauthn.SessionData, bool) {
	s.sessionStoreMu.Lock()
	defer s.sessionStoreMu.Unlock()
	session, ok := s.sessionStore[key]
	if ok {
		delete(s.sessionStore, key)
	}
	return session, ok
}

// BeginRegistration starts the WebAuthn registration process
func (s *PasskeyService) BeginRegistration(userID uint) (*protocol.CredentialCreation, error) {
	var user models.User
	if err := s.db.Preload("Passkeys").First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Exclude existing credentials to prevent re-registration
	excludeList := make([]protocol.CredentialDescriptor, len(user.Passkeys))
	for i, pk := range user.Passkeys {
		excludeList[i] = protocol.CredentialDescriptor{
			Type:         protocol.PublicKeyCredentialType,
			CredentialID: pk.CredentialID,
		}
	}

	options, session, err := s.webauthn.BeginRegistration(
		&user,
		webauthn.WithExclusions(excludeList),
	)
	if err != nil {
		s.logger.Error("Failed to begin registration", zap.Error(err))
		return nil, fmt.Errorf("failed to begin registration: %w", err)
	}

	// Store session for verification
	sessionKey := fmt.Sprintf("reg_%d", userID)
	s.storeSession(sessionKey, session)

	return options, nil
}

// FinishRegistration completes the WebAuthn registration process
func (s *PasskeyService) FinishRegistration(userID uint, name string, response *protocol.ParsedCredentialCreationData) (*models.Passkey, error) {
	var user models.User
	if err := s.db.Preload("Passkeys").First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Get session
	sessionKey := fmt.Sprintf("reg_%d", userID)
	session, ok := s.getSession(sessionKey)
	if !ok {
		return nil, errors.New("registration session expired or not found")
	}

	credential, err := s.webauthn.CreateCredential(&user, *session, response)
	if err != nil {
		s.logger.Error("Failed to create credential", zap.Error(err))
		return nil, fmt.Errorf("failed to verify credential: %w", err)
	}

	// Convert transports to JSON
	transports := make([]string, len(credential.Transport))
	for i, t := range credential.Transport {
		transports[i] = string(t)
	}
	transportsJSON, _ := json.Marshal(transports)

	// Set default name if empty
	if name == "" {
		name = "Passkey"
	}

	// Create passkey record with backup flags from credential
	passkey := &models.Passkey{
		UserID:          userID,
		CredentialID:    credential.ID,
		PublicKey:       credential.PublicKey,
		AttestationType: credential.AttestationType,
		AAGUID:          credential.Authenticator.AAGUID,
		SignCount:       credential.Authenticator.SignCount,
		BackupEligible:  credential.Flags.BackupEligible,
		BackupState:     credential.Flags.BackupState,
		Name:            name,
		Transports:      datatypes.JSON(transportsJSON),
	}

	if err := s.db.Create(passkey).Error; err != nil {
		s.logger.Error("Failed to save passkey", zap.Error(err))
		return nil, fmt.Errorf("failed to save passkey: %w", err)
	}

	s.logger.Info("Passkey registered",
		zap.Uint("user_id", userID),
		zap.String("name", name),
	)

	return passkey, nil
}

// BeginLogin starts the WebAuthn login process
func (s *PasskeyService) BeginLogin(email string) (*protocol.CredentialAssertion, error) {
	var user models.User
	if err := s.db.Preload("Passkeys").Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	if len(user.Passkeys) == 0 {
		return nil, errors.New("no passkeys registered")
	}

	options, session, err := s.webauthn.BeginLogin(&user)
	if err != nil {
		s.logger.Error("Failed to begin login", zap.Error(err))
		return nil, fmt.Errorf("failed to begin login: %w", err)
	}

	// Store session for verification
	sessionKey := fmt.Sprintf("login_%s", email)
	s.storeSession(sessionKey, session)

	return options, nil
}

// BeginDiscoverableLogin starts a discoverable (usernameless) login
func (s *PasskeyService) BeginDiscoverableLogin() (*protocol.CredentialAssertion, string, error) {
	options, session, err := s.webauthn.BeginDiscoverableLogin()
	if err != nil {
		s.logger.Error("Failed to begin discoverable login", zap.Error(err))
		return nil, "", fmt.Errorf("failed to begin discoverable login: %w", err)
	}

	// Generate a random session ID
	sessionID := fmt.Sprintf("discover_%d", time.Now().UnixNano())
	s.storeSession(sessionID, session)

	return options, sessionID, nil
}

// FinishLogin completes the WebAuthn login process
func (s *PasskeyService) FinishLogin(email string, response *protocol.ParsedCredentialAssertionData) (*models.User, error) {
	var user models.User
	if err := s.db.Preload("Passkeys").Where("email = ?", email).First(&user).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Get session
	sessionKey := fmt.Sprintf("login_%s", email)
	session, ok := s.getSession(sessionKey)
	if !ok {
		return nil, errors.New("login session expired or not found")
	}

	credential, err := s.webauthn.ValidateLogin(&user, *session, response)
	if err != nil {
		s.logger.Error("Failed to validate login", zap.Error(err))
		return nil, fmt.Errorf("failed to validate login: %w", err)
	}

	// Update sign count for clone detection
	if err := s.updateSignCount(credential.ID, credential.Authenticator.SignCount); err != nil {
		s.logger.Warn("Failed to update sign count", zap.Error(err))
	}

	// Update last used
	s.db.Model(&models.Passkey{}).
		Where("credential_id = ?", credential.ID).
		Update("last_used_at", time.Now())

	s.logger.Info("Passkey login successful",
		zap.String("email", email),
	)

	return &user, nil
}

// FinishDiscoverableLogin completes a discoverable login
func (s *PasskeyService) FinishDiscoverableLogin(sessionID string, response *protocol.ParsedCredentialAssertionData) (*models.User, error) {
	// Get session
	session, ok := s.getSession(sessionID)
	if !ok {
		return nil, errors.New("login session expired or not found")
	}

	// Handler function to find user by credential
	handler := func(rawID, userHandle []byte) (webauthn.User, error) {
		// Find passkey by credential ID
		var passkey models.Passkey
		if err := s.db.Where("credential_id = ?", rawID).First(&passkey).Error; err != nil {
			return nil, fmt.Errorf("credential not found: %w", err)
		}

		// Load user with passkeys
		var user models.User
		if err := s.db.Preload("Passkeys").First(&user, passkey.UserID).Error; err != nil {
			return nil, fmt.Errorf("user not found: %w", err)
		}

		return &user, nil
	}

	credential, err := s.webauthn.ValidateDiscoverableLogin(handler, *session, response)
	if err != nil {
		s.logger.Error("Failed to validate discoverable login", zap.Error(err))
		return nil, fmt.Errorf("failed to validate login: %w", err)
	}

	// Find the user from the credential
	var passkey models.Passkey
	if err := s.db.Where("credential_id = ?", credential.ID).First(&passkey).Error; err != nil {
		return nil, fmt.Errorf("credential not found: %w", err)
	}

	var user models.User
	if err := s.db.First(&user, passkey.UserID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Update sign count
	if err := s.updateSignCount(credential.ID, credential.Authenticator.SignCount); err != nil {
		s.logger.Warn("Failed to update sign count", zap.Error(err))
	}

	// Update last used
	s.db.Model(&models.Passkey{}).
		Where("credential_id = ?", credential.ID).
		Update("last_used_at", time.Now())

	s.logger.Info("Discoverable passkey login successful",
		zap.Uint("user_id", user.ID),
	)

	return &user, nil
}

// updateSignCount updates the signature counter for a credential
func (s *PasskeyService) updateSignCount(credentialID []byte, newCount uint32) error {
	return s.db.Model(&models.Passkey{}).
		Where("credential_id = ?", credentialID).
		Update("sign_count", newCount).Error
}

// ListPasskeys returns all passkeys for a user
func (s *PasskeyService) ListPasskeys(userID uint) ([]models.Passkey, error) {
	var passkeys []models.Passkey
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&passkeys).Error; err != nil {
		return nil, fmt.Errorf("failed to list passkeys: %w", err)
	}
	return passkeys, nil
}

// GetPasskeyCount returns the number of passkeys for a user
func (s *PasskeyService) GetPasskeyCount(userID uint) (int64, error) {
	var count int64
	if err := s.db.Model(&models.Passkey{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// DeletePasskey removes a passkey
func (s *PasskeyService) DeletePasskey(userID uint, passkeyID uint) error {
	result := s.db.Where("id = ? AND user_id = ?", passkeyID, userID).Delete(&models.Passkey{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete passkey: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("passkey not found")
	}

	s.logger.Info("Passkey deleted",
		zap.Uint("user_id", userID),
		zap.Uint("passkey_id", passkeyID),
	)

	return nil
}

// RenamePasskey updates the name of a passkey
func (s *PasskeyService) RenamePasskey(userID uint, passkeyID uint, newName string) error {
	result := s.db.Model(&models.Passkey{}).
		Where("id = ? AND user_id = ?", passkeyID, userID).
		Update("name", newName)

	if result.Error != nil {
		return fmt.Errorf("failed to rename passkey: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("passkey not found")
	}

	return nil
}

// HasPasskeys checks if user has any passkeys registered
func (s *PasskeyService) HasPasskeys(userID uint) (bool, error) {
	count, err := s.GetPasskeyCount(userID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// HasPasskeysByEmail checks if user has passkeys by email
func (s *PasskeyService) HasPasskeysByEmail(email string) (bool, error) {
	var user models.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return s.HasPasskeys(user.ID)
}
