package config

import "time"

// Database operation timeouts
const (
	DBPingTimeout      = 5 * time.Second
	DBRenameTimeout    = 20 * time.Second
	DBMigrationTimeout = 30 * time.Second
	DBConnMaxIdleTime  = 5 * time.Minute
	DBConnMaxLifetime  = 30 * time.Minute
)

// HTTP server timeouts
const (
	ServerReadHeaderTimeout = 5 * time.Second
	ServerReadTimeout       = 15 * time.Second
	ServerWriteTimeout      = 30 * time.Second
	ServerIdleTimeout       = 120 * time.Second
	GracefulShutdownTimeout = 30 * time.Second
)

// HTTP client timeouts
const (
	HTTPClientTimeout     = 10 * time.Second
	HTTPLongTimeout       = 30 * time.Second
	MarketOrderTimeout    = 300 * time.Second
	FXRateClientTimeout   = 8 * time.Second
	FeatureWalletTimeout  = 12 * time.Second
	DeviceBanCheckTimeout = 500 * time.Millisecond
)

// Background task intervals
const (
	SessionCleanupInterval = 1 * time.Hour
	SessionCleanupTimeout  = 30 * time.Second
)

// Email queue settings
const (
	EmailRetryDelay         = 5 * time.Second
	EmailQueueWarnThreshold = 5 * time.Second
)

// SLA worker timeouts
const (
	SLAWorkerLockTTL        = 60 * time.Second
	SLAWorkerFallbackTick   = time.Minute
	SLAWorkerLockTimeout    = 5 * time.Second
	SLAWorkerOpTimeout      = 30 * time.Second
	SLAWorkerReleaseTimeout = 5 * time.Second
)

// Redis operation timeouts
const (
	RedisPingTimeout    = 5 * time.Second
	RedisContextTimeout = 2 * time.Second
)

// Circuit breaker
const (
	CircuitBreakerResetTimeout = 30 * time.Second
)

// Auth & token timeouts
const (
	AdminTokenExpiry       = 8 * time.Hour
	JWTLeeway              = time.Minute
	PasskeyCeremonyTimeout = 5 * time.Minute
	PasskeyCleanupInterval = time.Minute
	PasskeyStoreTimeout    = 2 * time.Second
)

// Geo lookup cache write timeout
const (
	GeoCacheWriteTimeout = 5 * time.Second
)
