package services

import (
	"backend-gin/logger"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestAllowInsecureRedisFallback(t *testing.T) {
	t.Setenv("REDIS_ALLOW_INSECURE_FALLBACK", "true")
	if !allowInsecureRedisFallback() {
		t.Fatal("expected fallback flag to be enabled")
	}

	t.Setenv("REDIS_ALLOW_INSECURE_FALLBACK", "false")
	if allowInsecureRedisFallback() {
		t.Fatal("expected fallback flag to be disabled")
	}
}

func TestIsTLSHandshakeError(t *testing.T) {
	if !isTLSHandshakeError(assertErr("tls: first record does not look like a TLS handshake")) {
		t.Fatal("expected tls handshake mismatch to be detected")
	}

	if isTLSHandshakeError(assertErr("dial tcp: connection refused")) {
		t.Fatal("expected non-tls error to be ignored")
	}
}

func TestBuildInsecureRedisClient(t *testing.T) {
	client, err := buildInsecureRedisClient("rediss://default:secret@redis.example.com:6380/2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer client.Close()

	opts := client.Options()
	if opts.Addr != "redis.example.com:6380" {
		t.Fatalf("unexpected addr: %s", opts.Addr)
	}
	if opts.DB != 2 {
		t.Fatalf("unexpected db: %d", opts.DB)
	}
	if opts.TLSConfig != nil {
		t.Fatal("expected TLS config to be disabled in insecure fallback client")
	}
}

func TestBuildInsecureRedisClientInvalidURL(t *testing.T) {
	if _, err := buildInsecureRedisClient("://bad-url"); err == nil {
		t.Fatal("expected invalid URL error")
	}
}

func TestInitRedis_WhenInsecureFallbackBuildFails_ReturnsBuildErrorAndClearsClient(t *testing.T) {
	logger.InitLogger()
	t.Setenv("REDIS_URL", "rediss://default:secret@redis.example.com:6380/2")
	t.Setenv("REDIS_ALLOW_INSECURE_FALLBACK", "true")

	originalPing := redisPingWithTimeout
	originalBuild := redisBuildInsecureClient
	t.Cleanup(func() {
		redisPingWithTimeout = originalPing
		redisBuildInsecureClient = originalBuild
		RedisClient = nil
	})

	handshakeErr := assertErr("tls: first record does not look like a TLS handshake")
	insecureErr := assertErr("forced insecure fallback build failure")

	redisPingWithTimeout = func(_ *redis.Client, _ time.Duration) error {
		return handshakeErr
	}
	redisBuildInsecureClient = func(_ string) (*redis.Client, error) {
		return nil, insecureErr
	}

	err := InitRedis()
	if err == nil {
		t.Fatal("expected InitRedis to fail when insecure fallback build fails")
	}

	if !errors.Is(err, insecureErr) && !strings.Contains(err.Error(), insecureErr.Error()) {
		t.Fatalf("expected InitRedis error to contain insecure build error, got: %v", err)
	}

	if RedisClient != nil {
		t.Fatal("expected RedisClient to be nil after fallback build failure")
	}
}

type staticError string

func (e staticError) Error() string { return string(e) }

func assertErr(msg string) error { return staticError(msg) }
