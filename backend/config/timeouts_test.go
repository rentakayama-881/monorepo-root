package config

import (
	"testing"
	"time"
)

func TestDBTimeoutsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"DBPingTimeout":      DBPingTimeout,
		"DBRenameTimeout":    DBRenameTimeout,
		"DBMigrationTimeout": DBMigrationTimeout,
		"DBConnMaxIdleTime":  DBConnMaxIdleTime,
		"DBConnMaxLifetime":  DBConnMaxLifetime,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestServerTimeoutsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"ServerReadHeaderTimeout": ServerReadHeaderTimeout,
		"ServerReadTimeout":       ServerReadTimeout,
		"ServerWriteTimeout":      ServerWriteTimeout,
		"ServerIdleTimeout":       ServerIdleTimeout,
		"GracefulShutdownTimeout": GracefulShutdownTimeout,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestHTTPClientTimeoutsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"HTTPClientTimeout":     HTTPClientTimeout,
		"HTTPLongTimeout":       HTTPLongTimeout,
		"MarketOrderTimeout":    MarketOrderTimeout,
		"FXRateClientTimeout":   FXRateClientTimeout,
		"FeatureWalletTimeout":  FeatureWalletTimeout,
		"DeviceBanCheckTimeout": DeviceBanCheckTimeout,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestBackgroundTaskIntervalsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"SessionCleanupInterval": SessionCleanupInterval,
		"SessionCleanupTimeout":  SessionCleanupTimeout,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestEmailQueueSettingsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"EmailRetryDelay":         EmailRetryDelay,
		"EmailQueueWarnThreshold": EmailQueueWarnThreshold,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestSLAWorkerTimeoutsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"SLAWorkerLockTTL":        SLAWorkerLockTTL,
		"SLAWorkerFallbackTick":   SLAWorkerFallbackTick,
		"SLAWorkerLockTimeout":    SLAWorkerLockTimeout,
		"SLAWorkerOpTimeout":      SLAWorkerOpTimeout,
		"SLAWorkerReleaseTimeout": SLAWorkerReleaseTimeout,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestRedisTimeoutsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"RedisPingTimeout":    RedisPingTimeout,
		"RedisContextTimeout": RedisContextTimeout,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestAuthTokenTimeoutsArePositive(t *testing.T) {
	timeouts := map[string]time.Duration{
		"AdminTokenExpiry":       AdminTokenExpiry,
		"JWTLeeway":              JWTLeeway,
		"PasskeyCeremonyTimeout": PasskeyCeremonyTimeout,
		"PasskeyCleanupInterval": PasskeyCleanupInterval,
		"PasskeyStoreTimeout":    PasskeyStoreTimeout,
	}
	for name, d := range timeouts {
		if d <= 0 {
			t.Errorf("%s should be positive, got %v", name, d)
		}
	}
}

func TestCircuitBreakerResetTimeoutIsPositive(t *testing.T) {
	if CircuitBreakerResetTimeout <= 0 {
		t.Errorf("CircuitBreakerResetTimeout should be positive, got %v", CircuitBreakerResetTimeout)
	}
}

func TestGeoCacheWriteTimeoutIsPositive(t *testing.T) {
	if GeoCacheWriteTimeout <= 0 {
		t.Errorf("GeoCacheWriteTimeout should be positive, got %v", GeoCacheWriteTimeout)
	}
}

func TestTimeoutsRelationships(t *testing.T) {
	// Read timeout should be >= read header timeout
	if ServerReadTimeout < ServerReadHeaderTimeout {
		t.Errorf("ServerReadTimeout (%v) should be >= ServerReadHeaderTimeout (%v)", ServerReadTimeout, ServerReadHeaderTimeout)
	}
	// Write timeout should be >= read timeout
	if ServerWriteTimeout < ServerReadTimeout {
		t.Errorf("ServerWriteTimeout (%v) should be >= ServerReadTimeout (%v)", ServerWriteTimeout, ServerReadTimeout)
	}
	// Long HTTP timeout should be >= regular HTTP timeout
	if HTTPLongTimeout < HTTPClientTimeout {
		t.Errorf("HTTPLongTimeout (%v) should be >= HTTPClientTimeout (%v)", HTTPLongTimeout, HTTPClientTimeout)
	}
	// DB max lifetime should be >= max idle time
	if DBConnMaxLifetime < DBConnMaxIdleTime {
		t.Errorf("DBConnMaxLifetime (%v) should be >= DBConnMaxIdleTime (%v)", DBConnMaxLifetime, DBConnMaxIdleTime)
	}
}
