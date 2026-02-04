package enttest

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/migrate"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	_ "github.com/lib/pq"
)

var ErrDockerUnavailable = errors.New("docker is unavailable")

func dockerAvailable() bool {
	dockerHost := strings.TrimSpace(os.Getenv("DOCKER_HOST"))
	if dockerHost == "" || strings.HasPrefix(dockerHost, "unix://") {
		socketPath := "/var/run/docker.sock"
		if strings.HasPrefix(dockerHost, "unix://") {
			socketPath = strings.TrimPrefix(dockerHost, "unix://")
		}
		conn, err := net.DialTimeout("unix", socketPath, 500*time.Millisecond)
		if err != nil {
			return false
		}
		_ = conn.Close()
		return true
	}

	// Best-effort: if DOCKER_HOST is set to a non-unix address, assume Docker is available.
	// Testcontainers will still error if it isn't.
	return true
}

// PostgresContainer represents a running PostgreSQL test container
type PostgresContainer struct {
	Container testcontainers.Container
	Host      string
	Port      string
	DSN       string
}

// SetupPostgresContainer creates a PostgreSQL container for integration testing
func SetupPostgresContainer(ctx context.Context) (*PostgresContainer, error) {
	if !dockerAvailable() {
		return nil, ErrDockerUnavailable
	}

	req := testcontainers.ContainerRequest{
		Image:        "postgres:16-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_USER":     "testuser",
			"POSTGRES_PASSWORD": "testpass",
			"POSTGRES_DB":       "testdb",
		},
		WaitingFor: wait.ForLog("database system is ready to accept connections").
			WithOccurrence(2).
			WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to start postgres container: %w", err)
	}

	host, err := container.Host(ctx)
	if err != nil {
		container.Terminate(ctx)
		return nil, fmt.Errorf("failed to get container host: %w", err)
	}

	mappedPort, err := container.MappedPort(ctx, "5432")
	if err != nil {
		container.Terminate(ctx)
		return nil, fmt.Errorf("failed to get mapped port: %w", err)
	}

	dsn := fmt.Sprintf("host=%s port=%s user=testuser password=testpass dbname=testdb sslmode=disable",
		host, mappedPort.Port())

	return &PostgresContainer{
		Container: container,
		Host:      host,
		Port:      mappedPort.Port(),
		DSN:       dsn,
	}, nil
}

// Terminate stops and removes the container
func (pc *PostgresContainer) Terminate(ctx context.Context) error {
	if pc.Container != nil {
		return pc.Container.Terminate(ctx)
	}
	return nil
}

// TestClient wraps ent.Client with test utilities
type TestClient struct {
	*ent.Client
	Container *PostgresContainer
}

// NewTestClient creates a new Ent client connected to a PostgreSQL test container
func NewTestClient(t *testing.T) *TestClient {
	t.Helper()
	ctx := context.Background()

	container, err := SetupPostgresContainer(ctx)
	if err != nil {
		if errors.Is(err, ErrDockerUnavailable) {
			t.Skip("skipping integration tests: Docker is not available")
		}
		t.Fatalf("failed to setup postgres container: %v", err)
	}

	client, err := ent.Open("postgres", container.DSN)
	if err != nil {
		container.Terminate(ctx)
		t.Fatalf("failed to connect to postgres: %v", err)
	}

	// Run migrations
	if err := client.Schema.Create(ctx,
		migrate.WithDropIndex(true),
		migrate.WithDropColumn(true),
	); err != nil {
		client.Close()
		container.Terminate(ctx)
		t.Fatalf("failed to run migrations: %v", err)
	}

	tc := &TestClient{
		Client:    client,
		Container: container,
	}

	t.Cleanup(func() {
		tc.Close()
		container.Terminate(ctx)
	})

	return tc
}

// CleanupTables truncates all tables for test isolation
func (tc *TestClient) CleanupTables(ctx context.Context) error {
	// Delete in correct order due to foreign keys
	if _, err := tc.Session.Delete().Exec(ctx); err != nil {
		return err
	}
	if _, err := tc.Credential.Delete().Exec(ctx); err != nil {
		return err
	}
	if _, err := tc.EmailVerificationToken.Delete().Exec(ctx); err != nil {
		return err
	}
	if _, err := tc.PasswordResetToken.Delete().Exec(ctx); err != nil {
		return err
	}
	if _, err := tc.UserBadge.Delete().Exec(ctx); err != nil {
		return err
	}
	if _, err := tc.Thread.Delete().Exec(ctx); err != nil {
		return err
	}
	if _, err := tc.User.Delete().Exec(ctx); err != nil {
		return err
	}
	return nil
}

// CreateTestUser creates a user for testing purposes
func (tc *TestClient) CreateTestUser(ctx context.Context, email, passwordHash string) (*ent.User, error) {
	return tc.User.Create().
		SetEmail(email).
		SetPasswordHash(passwordHash).
		SetEmailVerified(false).
		SetAvatarURL("").
		Save(ctx)
}

// CreateVerifiedTestUser creates a verified user for testing
func (tc *TestClient) CreateVerifiedTestUser(ctx context.Context, email, passwordHash string) (*ent.User, error) {
	return tc.User.Create().
		SetEmail(email).
		SetPasswordHash(passwordHash).
		SetEmailVerified(true).
		SetAvatarURL("").
		Save(ctx)
}

// CreateTestUserWithUsername creates a user with username for testing
func (tc *TestClient) CreateTestUserWithUsername(ctx context.Context, email, username, passwordHash string) (*ent.User, error) {
	return tc.User.Create().
		SetEmail(email).
		SetUsername(username).
		SetPasswordHash(passwordHash).
		SetEmailVerified(true).
		SetAvatarURL("").
		Save(ctx)
}

// CreateTestSession creates a session for testing purposes
func (tc *TestClient) CreateTestSession(ctx context.Context, userID int, accessTokenJTI, refreshTokenHash string, expiresAt time.Time) (*ent.Session, error) {
	return tc.Session.Create().
		SetUserID(userID).
		SetAccessTokenJti(accessTokenJTI).
		SetRefreshTokenHash(refreshTokenHash).
		SetTokenFamily(refreshTokenHash). // Use refresh hash as token family for tests
		SetExpiresAt(expiresAt).
		SetIPAddress("127.0.0.1").
		SetUserAgent("Test Agent").
		Save(ctx)
}
