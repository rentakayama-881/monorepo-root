package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"backend-gin/database"
	"backend-gin/ent"
	"backend-gin/ent/devicefingerprint"
	"backend-gin/ent/deviceusermapping"
	"backend-gin/logger"

	"go.uber.org/zap"
)

// EntDeviceTracker tracks device fingerprints and enforces account limits using Ent ORM
type EntDeviceTracker struct {
	mu            sync.RWMutex
	recentDevices map[string]*recentDeviceRecord // In-memory cache for quick lookups
	cleanupTicker *time.Ticker
}

// Global Ent device tracker instance
var entDeviceTracker *EntDeviceTracker

// InitEntDeviceTracker initializes the global Ent device tracker
func InitEntDeviceTracker() {
	entDeviceTracker = NewEntDeviceTracker()
	// Set the global tracker for use in other services
	SetDeviceTracker(entDeviceTracker)
	logger.Info("Ent device tracker initialized")
}

// GetEntDeviceTracker returns the global Ent device tracker instance
func GetEntDeviceTracker() *EntDeviceTracker {
	return entDeviceTracker
}

// NewEntDeviceTracker creates a new Ent device tracker
func NewEntDeviceTracker() *EntDeviceTracker {
	tracker := &EntDeviceTracker{
		recentDevices: make(map[string]*recentDeviceRecord),
	}

	// Start background cleanup
	tracker.cleanupTicker = time.NewTicker(DeviceCleanupInterval)
	go tracker.cleanupLoop()

	return tracker
}

// HashFingerprintEnt creates a SHA256 hash of device fingerprint components
func HashFingerprintEnt(components ...string) string {
	h := sha256.New()
	for _, c := range components {
		h.Write([]byte(c))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// cleanupLoop periodically cleans up old cache records
func (d *EntDeviceTracker) cleanupLoop() {
	for range d.cleanupTicker.C {
		d.cleanupCache()
	}
}

// cleanupCache removes expired cache entries
func (d *EntDeviceTracker) cleanupCache() {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	for key, record := range d.recentDevices {
		if now.Sub(record.LastSeen) > DeviceCacheExpiry {
			delete(d.recentDevices, key)
		}
	}
}

// CanRegisterAccount checks if a new account can be registered with this device
// Returns (allowed, currentCount, error)
func (d *EntDeviceTracker) CanRegisterAccount(ctx context.Context, fingerprintHash, ip, userAgent string) (bool, int, error) {
	// Check cache first
	d.mu.RLock()
	if cached, exists := d.recentDevices[fingerprintHash]; exists {
		d.mu.RUnlock()
		if cached.Blocked {
			return false, cached.AccountCount, nil
		}
		if cached.AccountCount >= MaxAccountsPerDevice {
			return false, cached.AccountCount, nil
		}
		return true, cached.AccountCount, nil
	}
	d.mu.RUnlock()

	// Check database using Ent
	client := database.GetEntClient()
	deviceFP, err := client.DeviceFingerprint.Query().
		Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
		Only(ctx)

	if ent.IsNotFound(err) {
		// New device - allowed
		return true, 0, nil
	}
	if err != nil {
		logger.Error("Failed to check device fingerprint", zap.Error(err))
		return true, 0, err // Allow on error, don't block legitimate users
	}

	// Update cache
	d.mu.Lock()
	d.recentDevices[fingerprintHash] = &recentDeviceRecord{
		FingerprintHash: fingerprintHash,
		AccountCount:    deviceFP.AccountCount,
		Blocked:         deviceFP.Blocked,
		LastSeen:        time.Now(),
	}
	d.mu.Unlock()

	if deviceFP.Blocked {
		return false, deviceFP.AccountCount, nil
	}

	if deviceFP.AccountCount >= MaxAccountsPerDevice {
		return false, deviceFP.AccountCount, nil
	}

	return true, deviceFP.AccountCount, nil
}

// RecordDeviceRegistration records a device being used for registration
func (d *EntDeviceTracker) RecordDeviceRegistration(ctx context.Context, userID int, fingerprintHash, ip, userAgent string) error {
	now := time.Now()
	client := database.GetEntClient()

	// Use transaction to ensure atomicity
	tx, err := client.Tx(ctx)
	if err != nil {
		return err
	}

	// Check if device exists
	deviceFP, err := tx.DeviceFingerprint.Query().
		Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
		Only(ctx)

	var accountCount int
	var blocked bool

	if ent.IsNotFound(err) {
		// Create new device record
		deviceFP, err = tx.DeviceFingerprint.Create().
			SetFingerprintHash(fingerprintHash).
			SetUserID(userID).
			SetIPAddress(ip).
			SetUserAgent(userAgent).
			SetAccountCount(1).
			SetLastSeenAt(now).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			return err
		}
		accountCount = 1
		blocked = false
	} else if err != nil {
		_ = tx.Rollback()
		return err
	} else {
		// Update existing device record
		deviceFP, err = tx.DeviceFingerprint.UpdateOne(deviceFP).
			SetAccountCount(deviceFP.AccountCount + 1).
			SetLastSeenAt(now).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			return err
		}
		accountCount = deviceFP.AccountCount
		blocked = deviceFP.Blocked
	}

	// Create user-device mapping
	_, err = tx.DeviceUserMapping.Create().
		SetFingerprintHash(fingerprintHash).
		SetUserID(userID).
		SetFirstSeenAt(now).
		SetLastSeenAt(now).
		Save(ctx)
	if err != nil {
		if !ent.IsConstraintError(err) {
			_ = tx.Rollback()
			return err
		}
		// Duplicate mapping already exists, safe to ignore
		logger.Debug("Device-user mapping already exists",
			zap.Int("user_id", userID),
			zap.String("fingerprint", fingerprintHash[:16]+"..."))
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// Update cache
	d.mu.Lock()
	d.recentDevices[fingerprintHash] = &recentDeviceRecord{
		FingerprintHash: fingerprintHash,
		AccountCount:    accountCount,
		Blocked:         blocked,
		LastSeen:        now,
	}
	d.mu.Unlock()

	logger.Info("Device registration recorded",
		zap.Int("user_id", userID),
		zap.String("fingerprint", fingerprintHash[:16]+"..."),
		zap.Int("account_count", accountCount))

	return nil
}

// RecordDeviceLogin records a device being used for login (upsert: create-or-update)
func (d *EntDeviceTracker) RecordDeviceLogin(ctx context.Context, userID int, fingerprintHash, ip, userAgent string) error {
	now := time.Now()
	client := database.GetEntClient()

	// Use transaction for atomicity
	tx, err := client.Tx(ctx)
	if err != nil {
		logger.Error("RecordDeviceLogin: failed to start transaction", zap.Error(err))
		return err
	}

	// Upsert device_fingerprints: create if not exist, update if exist
	deviceFP, err := tx.DeviceFingerprint.Query().
		Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
		Only(ctx)

	var blocked bool
	if ent.IsNotFound(err) {
		// New device — create row
		deviceFP, err = tx.DeviceFingerprint.Create().
			SetFingerprintHash(fingerprintHash).
			SetUserID(userID).
			SetIPAddress(ip).
			SetUserAgent(userAgent).
			SetAccountCount(1).
			SetLastSeenAt(now).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			logger.Error("RecordDeviceLogin: failed to create device fingerprint", zap.Error(err))
			return err
		}
		blocked = false
	} else if err != nil {
		_ = tx.Rollback()
		logger.Error("RecordDeviceLogin: failed to query device fingerprint", zap.Error(err))
		return err
	} else {
		// Existing device — update last_seen_at, ip, user_agent
		blocked = deviceFP.Blocked
		_, err = tx.DeviceFingerprint.UpdateOne(deviceFP).
			SetLastSeenAt(now).
			SetIPAddress(ip).
			SetUserAgent(userAgent).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			logger.Error("RecordDeviceLogin: failed to update device fingerprint", zap.Error(err))
			return err
		}
	}

	// Upsert device_user_mappings: create if not exist, update last_seen_at if exist
	existingMapping, err := tx.DeviceUserMapping.Query().
		Where(
			deviceusermapping.FingerprintHashEQ(fingerprintHash),
			deviceusermapping.UserIDEQ(userID),
		).
		Only(ctx)

	if ent.IsNotFound(err) {
		// New mapping — create
		_, err = tx.DeviceUserMapping.Create().
			SetFingerprintHash(fingerprintHash).
			SetUserID(userID).
			SetFirstSeenAt(now).
			SetLastSeenAt(now).
			Save(ctx)
		if err != nil {
			if ent.IsConstraintError(err) {
				// Race condition: another transaction created it — safe to ignore
				logger.Debug("RecordDeviceLogin: duplicate mapping constraint (ignored)",
					zap.Int("user_id", userID),
					zap.String("fingerprint", fingerprintHash[:16]+"..."))
			} else {
				_ = tx.Rollback()
				logger.Error("RecordDeviceLogin: failed to create user mapping", zap.Error(err))
				return err
			}
		}
	} else if err != nil {
		_ = tx.Rollback()
		logger.Error("RecordDeviceLogin: failed to query user mapping", zap.Error(err))
		return err
	} else {
		// Existing mapping — update last_seen_at
		_, err = tx.DeviceUserMapping.UpdateOne(existingMapping).
			SetLastSeenAt(now).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			logger.Error("RecordDeviceLogin: failed to update user mapping", zap.Error(err))
			return err
		}
	}

	// Sync account_count with actual distinct user mappings
	mappingCount, err := tx.DeviceUserMapping.Query().
		Where(deviceusermapping.FingerprintHashEQ(fingerprintHash)).
		Count(ctx)
	if err != nil {
		_ = tx.Rollback()
		logger.Error("RecordDeviceLogin: failed to count user mappings", zap.Error(err))
		return err
	}

	if deviceFP.AccountCount != mappingCount {
		_, err = tx.DeviceFingerprint.Update().
			Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
			SetAccountCount(mappingCount).
			Save(ctx)
		if err != nil {
			_ = tx.Rollback()
			logger.Error("RecordDeviceLogin: failed to sync account_count", zap.Error(err))
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		logger.Error("RecordDeviceLogin: failed to commit transaction", zap.Error(err))
		return err
	}

	// Update cache
	d.mu.Lock()
	d.recentDevices[fingerprintHash] = &recentDeviceRecord{
		FingerprintHash: fingerprintHash,
		IPAddress:       ip,
		UserAgent:       userAgent,
		AccountCount:    mappingCount,
		LastSeen:        now,
		Blocked:         blocked,
		BlockReason:     deviceFP.BlockReason,
	}
	d.mu.Unlock()

	logger.Info("Device login recorded",
		zap.Int("user_id", userID),
		zap.String("fingerprint", fingerprintHash[:16]+"..."),
		zap.String("ip", ip),
		zap.Int("account_count", mappingCount))

	return nil
}

// BlockDevice blocks a device fingerprint
func (d *EntDeviceTracker) BlockDevice(ctx context.Context, fingerprintHash, reason string) error {
	client := database.GetEntClient()

	err := client.DeviceFingerprint.Update().
		Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
		SetBlocked(true).
		SetBlockReason(reason).
		Exec(ctx)

	if err != nil {
		return err
	}

	// Update cache
	d.mu.Lock()
	if cached, exists := d.recentDevices[fingerprintHash]; exists {
		cached.Blocked = true
	}
	d.mu.Unlock()

	logger.Warn("Device blocked",
		zap.String("fingerprint", fingerprintHash[:16]+"..."),
		zap.String("reason", reason))

	return nil
}

// GetDeviceAccountCount returns the number of accounts using a device
func (d *EntDeviceTracker) GetDeviceAccountCount(ctx context.Context, fingerprintHash string) (int, error) {
	client := database.GetEntClient()

	deviceFP, err := client.DeviceFingerprint.Query().
		Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
		Only(ctx)

	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return deviceFP.AccountCount, nil
}

// IsDeviceBlocked checks if a device is blocked
func (d *EntDeviceTracker) IsDeviceBlocked(ctx context.Context, fingerprintHash string) (bool, string) {
	// Check cache first
	d.mu.RLock()
	if cached, exists := d.recentDevices[fingerprintHash]; exists {
		d.mu.RUnlock()
		if cached.Blocked {
			return true, "Device has been blocked"
		}
		return false, ""
	}
	d.mu.RUnlock()

	// Check database
	client := database.GetEntClient()
	deviceFP, err := client.DeviceFingerprint.Query().
		Where(devicefingerprint.FingerprintHashEQ(fingerprintHash)).
		Only(context.Background())

	if err != nil {
		return false, ""
	}

	return deviceFP.Blocked, deviceFP.BlockReason
}

// GetUserDevices returns all devices used by a user
func (d *EntDeviceTracker) GetUserDevices(ctx context.Context, userID int) ([]*ent.DeviceUserMapping, error) {
	client := database.GetEntClient()
	return client.DeviceUserMapping.Query().
		Where(deviceusermapping.UserIDEQ(userID)).
		Order(ent.Desc(deviceusermapping.FieldLastSeenAt)).
		All(ctx)
}

// Stop stops the cleanup goroutine
func (d *EntDeviceTracker) Stop() {
	if d.cleanupTicker != nil {
		d.cleanupTicker.Stop()
	}
}
