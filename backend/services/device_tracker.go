package services

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"backend-gin/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// DeviceFingerprint represents a device fingerprint stored in database
type DeviceFingerprint struct {
	gorm.Model
	FingerprintHash string `gorm:"size:64;uniqueIndex;not null"` // SHA256 hash of fingerprint
	UserID          uint   `gorm:"index"`                        // Associated user (first registered)
	IPAddress       string `gorm:"size:45"`                      // IP address when first seen
	UserAgent       string `gorm:"size:512"`                     // User agent when first seen
	AccountCount    int    `gorm:"default:1"`                    // Number of accounts using this device
	LastSeenAt      time.Time
	Blocked         bool   `gorm:"default:false"` // If device is blocked
	BlockReason     string `gorm:"size:255"`
}

// DeviceUserMapping maps devices to users
type DeviceUserMapping struct {
	gorm.Model
	FingerprintHash string `gorm:"size:64;index;not null"`
	UserID          uint   `gorm:"index;not null"`
	FirstSeenAt     time.Time
	LastSeenAt      time.Time
}

// DeviceTracker tracks device fingerprints and enforces account limits
type DeviceTracker struct {
	db            *gorm.DB
	mu            sync.RWMutex
	recentDevices map[string]*recentDeviceRecord // In-memory cache for quick lookups
	cleanupTicker *time.Ticker
}

type recentDeviceRecord struct {
	FingerprintHash string
	AccountCount    int
	Blocked         bool
	LastSeen        time.Time
}

// Configuration constants
const (
	MaxAccountsPerDevice   = 2               // Maximum 2 accounts per device
	DeviceCacheExpiry      = 30 * time.Minute // Cache expiry for device records
	DeviceCleanupInterval  = 10 * time.Minute // Cleanup interval
	SuspiciousIPThreshold  = 5               // Number of different IPs to trigger warning
	IPRotationWindow       = 1 * time.Hour   // Time window for IP rotation detection
)

// Global device tracker instance
var deviceTracker *DeviceTracker

// InitDeviceTracker initializes the global device tracker
func InitDeviceTracker(db *gorm.DB) {
	deviceTracker = NewDeviceTracker(db)
	logger.Info("Device tracker initialized")
}

// GetDeviceTracker returns the global device tracker instance
func GetDeviceTracker() *DeviceTracker {
	return deviceTracker
}

// NewDeviceTracker creates a new device tracker
func NewDeviceTracker(db *gorm.DB) *DeviceTracker {
	tracker := &DeviceTracker{
		db:            db,
		recentDevices: make(map[string]*recentDeviceRecord),
	}

	// Start background cleanup
	tracker.cleanupTicker = time.NewTicker(DeviceCleanupInterval)
	go tracker.cleanupLoop()

	return tracker
}

// HashFingerprint creates a SHA256 hash of device fingerprint components
func HashFingerprint(components ...string) string {
	h := sha256.New()
	for _, c := range components {
		h.Write([]byte(c))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// cleanupLoop periodically cleans up old cache records
func (d *DeviceTracker) cleanupLoop() {
	for range d.cleanupTicker.C {
		d.cleanupCache()
	}
}

// cleanupCache removes expired cache entries
func (d *DeviceTracker) cleanupCache() {
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
func (d *DeviceTracker) CanRegisterAccount(fingerprintHash, ip, userAgent string) (bool, int, error) {
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

	// Check database
	var deviceFP DeviceFingerprint
	err := d.db.Where("fingerprint_hash = ?", fingerprintHash).First(&deviceFP).Error
	if err == gorm.ErrRecordNotFound {
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
func (d *DeviceTracker) RecordDeviceRegistration(userID uint, fingerprintHash, ip, userAgent string) error {
	now := time.Now()

	// Use transaction to ensure atomicity
	return d.db.Transaction(func(tx *gorm.DB) error {
		var deviceFP DeviceFingerprint
		err := tx.Where("fingerprint_hash = ?", fingerprintHash).First(&deviceFP).Error

		if err == gorm.ErrRecordNotFound {
			// Create new device record
			deviceFP = DeviceFingerprint{
				FingerprintHash: fingerprintHash,
				UserID:          userID,
				IPAddress:       ip,
				UserAgent:       userAgent,
				AccountCount:    1,
				LastSeenAt:      now,
			}
			if err := tx.Create(&deviceFP).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else {
			// Update existing device record
			deviceFP.AccountCount++
			deviceFP.LastSeenAt = now
			if err := tx.Save(&deviceFP).Error; err != nil {
				return err
			}
		}

		// Create user-device mapping
		mapping := DeviceUserMapping{
			FingerprintHash: fingerprintHash,
			UserID:          userID,
			FirstSeenAt:     now,
			LastSeenAt:      now,
		}
		if err := tx.Create(&mapping).Error; err != nil {
			// Ignore duplicate error
			if err.Error() != "UNIQUE constraint failed" {
				logger.Warn("Failed to create device-user mapping", zap.Error(err))
			}
		}

		// Update cache
		d.mu.Lock()
		d.recentDevices[fingerprintHash] = &recentDeviceRecord{
			FingerprintHash: fingerprintHash,
			AccountCount:    deviceFP.AccountCount,
			Blocked:         deviceFP.Blocked,
			LastSeen:        now,
		}
		d.mu.Unlock()

		logger.Info("Device registration recorded",
			zap.Uint("user_id", userID),
			zap.String("fingerprint", fingerprintHash[:16]+"..."),
			zap.Int("account_count", deviceFP.AccountCount))

		return nil
	})
}

// RecordDeviceLogin records a device being used for login
func (d *DeviceTracker) RecordDeviceLogin(userID uint, fingerprintHash, ip, userAgent string) error {
	now := time.Now()

	// Update device last seen
	d.db.Model(&DeviceFingerprint{}).
		Where("fingerprint_hash = ?", fingerprintHash).
		Updates(map[string]interface{}{
			"last_seen_at": now,
			"ip_address":   ip,
		})

	// Update user-device mapping
	d.db.Model(&DeviceUserMapping{}).
		Where("fingerprint_hash = ? AND user_id = ?", fingerprintHash, userID).
		Update("last_seen_at", now)

	return nil
}

// BlockDevice blocks a device fingerprint
func (d *DeviceTracker) BlockDevice(fingerprintHash, reason string) error {
	err := d.db.Model(&DeviceFingerprint{}).
		Where("fingerprint_hash = ?", fingerprintHash).
		Updates(map[string]interface{}{
			"blocked":      true,
			"block_reason": reason,
		}).Error

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
func (d *DeviceTracker) GetDeviceAccountCount(fingerprintHash string) (int, error) {
	var deviceFP DeviceFingerprint
	err := d.db.Where("fingerprint_hash = ?", fingerprintHash).First(&deviceFP).Error
	if err == gorm.ErrRecordNotFound {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return deviceFP.AccountCount, nil
}

// IsDeviceBlocked checks if a device is blocked
func (d *DeviceTracker) IsDeviceBlocked(fingerprintHash string) (bool, string) {
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
	var deviceFP DeviceFingerprint
	err := d.db.Where("fingerprint_hash = ?", fingerprintHash).First(&deviceFP).Error
	if err != nil {
		return false, ""
	}

	return deviceFP.Blocked, deviceFP.BlockReason
}

// GetUserDevices returns all devices used by a user
func (d *DeviceTracker) GetUserDevices(userID uint) ([]DeviceUserMapping, error) {
	var mappings []DeviceUserMapping
	err := d.db.Where("user_id = ?", userID).
		Order("last_seen_at DESC").
		Find(&mappings).Error
	return mappings, err
}

// Stop stops the cleanup goroutine
func (d *DeviceTracker) Stop() {
	if d.cleanupTicker != nil {
		d.cleanupTicker.Stop()
	}
}
