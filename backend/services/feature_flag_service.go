package services

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/featureflag"
	apperrors "backend-gin/errors"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// FeatureFlagService provides feature flag operations with in-memory caching.
type FeatureFlagService struct {
	client   *ent.Client
	cacheTTL time.Duration

	mu        sync.RWMutex
	cache     map[string]*ent.FeatureFlag
	cacheTime time.Time
}

// NewFeatureFlagService creates a new FeatureFlagService.
func NewFeatureFlagService() *FeatureFlagService {
	ttl := 60 * time.Second
	if envTTL := os.Getenv("FEATURE_FLAG_CACHE_TTL"); envTTL != "" {
		if seconds, err := strconv.Atoi(envTTL); err == nil && seconds > 0 {
			ttl = time.Duration(seconds) * time.Second
		}
	}
	return &FeatureFlagService{
		client:   database.GetEntClient(),
		cacheTTL: ttl,
		cache:    make(map[string]*ent.FeatureFlag),
	}
}

// IsEnabled checks if a feature flag is enabled for the given user.
// It considers both the enabled field and rollout_percentage.
func (s *FeatureFlagService) IsEnabled(ctx context.Context, key string, userID uint) bool {
	flag, err := s.getFromCache(ctx, key)
	if err != nil || flag == nil {
		return false
	}
	if !flag.Enabled {
		return false
	}
	if flag.RolloutPercentage >= 100 {
		return true
	}
	if flag.RolloutPercentage <= 0 {
		return false
	}
	// Deterministic rollout based on hash of key + userID
	bucket := rolloutBucket(key, userID)
	return bucket < uint64(flag.RolloutPercentage)
}

// List returns all active (non-deleted) feature flags.
func (s *FeatureFlagService) List(ctx context.Context) ([]*ent.FeatureFlag, error) {
	flags, err := s.client.FeatureFlag.Query().
		Where(featureflag.DeletedAtIsNil()).
		Order(ent.Asc(featureflag.FieldKey)).
		All(ctx)
	if err != nil {
		logger.Error("Failed to list feature flags", zap.Error(err))
		return nil, apperrors.ErrDatabase
	}
	return flags, nil
}

// Get returns a single feature flag by key.
func (s *FeatureFlagService) Get(ctx context.Context, key string) (*ent.FeatureFlag, error) {
	flag, err := s.client.FeatureFlag.Query().
		Where(
			featureflag.KeyEQ(key),
			featureflag.DeletedAtIsNil(),
		).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, apperrors.NewAppError("FF001", "Feature flag tidak ditemukan", 404)
		}
		logger.Error("Failed to get feature flag", zap.Error(err), zap.String("key", key))
		return nil, apperrors.ErrDatabase
	}
	return flag, nil
}

// Create creates a new feature flag.
func (s *FeatureFlagService) Create(ctx context.Context, key, description string, enabled bool, rolloutPct int) (*ent.FeatureFlag, error) {
	flag, err := s.client.FeatureFlag.Create().
		SetKey(key).
		SetDescription(description).
		SetEnabled(enabled).
		SetRolloutPercentage(rolloutPct).
		Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) {
			return nil, apperrors.NewAppError("FF002", "Feature flag key sudah digunakan", 409)
		}
		logger.Error("Failed to create feature flag", zap.Error(err), zap.String("key", key))
		return nil, apperrors.ErrDatabase
	}
	s.invalidateCache()
	return flag, nil
}

// Update updates an existing feature flag by key. Only non-nil fields are updated.
func (s *FeatureFlagService) Update(ctx context.Context, key string, enabled *bool, description *string, rolloutPct *int) (*ent.FeatureFlag, error) {
	flag, err := s.Get(ctx, key)
	if err != nil {
		return nil, err
	}

	update := s.client.FeatureFlag.UpdateOneID(flag.ID)
	if enabled != nil {
		update.SetEnabled(*enabled)
	}
	if description != nil {
		update.SetDescription(*description)
	}
	if rolloutPct != nil {
		update.SetRolloutPercentage(*rolloutPct)
	}

	updated, err := update.Save(ctx)
	if err != nil {
		logger.Error("Failed to update feature flag", zap.Error(err), zap.String("key", key))
		return nil, apperrors.ErrDatabase
	}
	s.invalidateCache()
	return updated, nil
}

// Delete soft-deletes a feature flag by key.
func (s *FeatureFlagService) Delete(ctx context.Context, key string) error {
	flag, err := s.Get(ctx, key)
	if err != nil {
		return err
	}

	now := time.Now()
	_, err = s.client.FeatureFlag.UpdateOneID(flag.ID).
		SetDeletedAt(now).
		Save(ctx)
	if err != nil {
		logger.Error("Failed to delete feature flag", zap.Error(err), zap.String("key", key))
		return apperrors.ErrDatabase
	}
	s.invalidateCache()
	return nil
}

// getFromCache retrieves a flag from cache, refreshing if stale.
func (s *FeatureFlagService) getFromCache(ctx context.Context, key string) (*ent.FeatureFlag, error) {
	s.mu.RLock()
	if time.Since(s.cacheTime) < s.cacheTTL && len(s.cache) > 0 {
		flag, ok := s.cache[key]
		s.mu.RUnlock()
		if ok {
			return flag, nil
		}
		return nil, nil
	}
	s.mu.RUnlock()

	// Refresh cache
	if err := s.refreshCache(ctx); err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	flag, ok := s.cache[key]
	if ok {
		return flag, nil
	}
	return nil, nil
}

// refreshCache loads all active flags into memory.
func (s *FeatureFlagService) refreshCache(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check after acquiring write lock
	if time.Since(s.cacheTime) < s.cacheTTL && len(s.cache) > 0 {
		return nil
	}

	flags, err := s.client.FeatureFlag.Query().
		Where(featureflag.DeletedAtIsNil()).
		All(ctx)
	if err != nil {
		logger.Error("Failed to refresh feature flag cache", zap.Error(err))
		return apperrors.ErrDatabase
	}

	newCache := make(map[string]*ent.FeatureFlag, len(flags))
	for _, f := range flags {
		newCache[f.Key] = f
	}
	s.cache = newCache
	s.cacheTime = time.Now()
	return nil
}

// invalidateCache forces the next read to refresh from DB.
func (s *FeatureFlagService) invalidateCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cacheTime = time.Time{} // zero time → always stale
}

// rolloutBucket returns a deterministic bucket (0-99) for a given key + userID.
func rolloutBucket(key string, userID uint) uint64 {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%s:%d", key, userID)))
	sum := h.Sum(nil)
	return binary.BigEndian.Uint64(sum[:8]) % 100
}
