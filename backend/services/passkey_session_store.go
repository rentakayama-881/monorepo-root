package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type inMemoryWebAuthnSessionStore struct {
	mu       sync.Mutex
	sessions map[string]inMemoryWebAuthnSession
}

type inMemoryWebAuthnSession struct {
	session   webauthn.SessionData
	expiresAt time.Time
}

func newInMemoryWebAuthnSessionStore(cleanupInterval time.Duration) *inMemoryWebAuthnSessionStore {
	store := &inMemoryWebAuthnSessionStore{
		sessions: make(map[string]inMemoryWebAuthnSession),
	}
	if cleanupInterval > 0 {
		go store.cleanupLoop(cleanupInterval)
	}
	return store
}

func (s *inMemoryWebAuthnSessionStore) cleanupLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		s.cleanup(time.Now())
	}
}

func (s *inMemoryWebAuthnSessionStore) cleanup(now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for key, entry := range s.sessions {
		if now.After(entry.expiresAt) {
			delete(s.sessions, key)
		}
	}
}

func (s *inMemoryWebAuthnSessionStore) set(key string, session *webauthn.SessionData, ttl time.Duration) {
	if s == nil || key == "" || session == nil {
		return
	}
	s.mu.Lock()
	s.sessions[key] = inMemoryWebAuthnSession{
		session:   *session,
		expiresAt: time.Now().Add(ttl),
	}
	s.mu.Unlock()
}

func (s *inMemoryWebAuthnSessionStore) getAndDelete(key string) (*webauthn.SessionData, bool) {
	if s == nil || key == "" {
		return nil, false
	}

	s.mu.Lock()
	entry, ok := s.sessions[key]
	if ok {
		delete(s.sessions, key)
	}
	s.mu.Unlock()

	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		return nil, false
	}

	session := entry.session
	return &session, true
}

// storeSession stores a WebAuthn session
func (s *EntPasskeyService) storeSession(key string, session *webauthn.SessionData) {
	if key == "" || session == nil {
		return
	}

	// Redis is optional in this repo (dev / single-instance). When it's not
	// available we still need to persist WebAuthn ceremony state, otherwise
	// passkey registration/login will always fail at the "finish" step.
	if RedisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		if err := CacheSet(ctx, key, session, s.sessionTTL); err == nil {
			return
		} else {
			s.logger.Error("Failed to store WebAuthn session (falling back to in-memory)", zap.String("key", key), zap.Error(err))
		}
	}

	s.memSessions.set(key, session, s.sessionTTL)
}

// getSession retrieves and deletes a WebAuthn session
func (s *EntPasskeyService) getSession(key string) (*webauthn.SessionData, bool) {
	if key == "" {
		return nil, false
	}

	if RedisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		var session webauthn.SessionData
		if err := CacheGet(ctx, key, &session); err == nil {
			if err := CacheDelete(ctx, key); err != nil {
				s.logger.Warn("Failed to delete WebAuthn session", zap.String("key", key), zap.Error(err))
			}
			return &session, true
		} else if !errors.Is(err, redis.Nil) {
			s.logger.Error("Failed to retrieve WebAuthn session (falling back to in-memory)", zap.String("key", key), zap.Error(err))
		}
	}

	return s.memSessions.getAndDelete(key)
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
