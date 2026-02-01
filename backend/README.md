# Alephdraad Backend

Go-based REST API server using Gin framework with Ent ORM.

**Last Updated:** January 12, 2026

---

## Tech Stack

- **Language:** Go 1.22
- **Framework:** Gin
- **ORM:** Ent (entgo.io)
- **Database:** PostgreSQL 16 (Neon)
- **Auth:** JWT + TOTP (RFC 6238)

---

## Quick Start

### Prerequisites
- Go 1.22+
- PostgreSQL 16+

### Setup

```bash
# Clone and navigate
cd backend

# Copy environment file
cp .env.example .env

# Install dependencies
go mod download

# Run database migrations (Ent auto-migration)
go run main.go

# Run in development
go run main.go
```

---

## Project Structure

```
backend/
├── cmd/                    # CLI tools
│   ├── seed_admin/         # Seed admin user
│   └── seed_tags/          # Seed default tags
│
├── config/                 # Configuration
│   └── config.go           # Environment variables
│
├── database/               # Database connections
│   ├── db.go               # Connection setup
│   └── ent.go              # Ent client initialization
│
├── dto/                    # Data Transfer Objects
│   ├── auth.go             # Auth request/response
│   ├── create_thread.go    # Thread creation
│   └── ...
│
├── ent/                    # Ent ORM
│   ├── schema/             # Entity schemas
│   └── ...                 # Generated code
│
├── errors/                 # Custom errors
│   └── app_error.go        # AppError type
│
├── handlers/               # HTTP handlers
│   ├── auth.go             # Authentication
│   ├── threads.go          # Thread CRUD
│   ├── users.go            # User profiles
│   └── ...
│
├── logger/                 # Logging
│   └── logger.go           # Serilog-style logging
│
├── middleware/             # HTTP middleware
│   ├── auth.go             # JWT validation
│   ├── jwt.go              # Token generation
│   ├── rate_limit.go       # Rate limiting
│   └── ...
│
├── services/               # Business logic
│   ├── auth_service.go     # Authentication
│   ├── session_service_ent.go
│   ├── totp_service.go     # 2FA
│   └── ...
│
├── tests/                  # Tests
│   ├── validators_test.go  # Input validation tests
│   └── security_test.go    # Security tests
│
├── utils/                  # Utilities
│   ├── crypto.go           # Password hashing
│   ├── email.go            # Email sending
│   └── ...
│
├── validators/             # Input validators
│   ├── validators.go       # Validation functions
│   └── ...
│
├── go.mod                  # Go modules
├── go.sum                  # Dependency checksums
└── main.go                 # Entry point
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login with email/password | No |
| POST | `/auth/refresh` | Refresh access token | Refresh Token |
| POST | `/auth/logout` | Logout (invalidate session) | Yes |
| POST | `/auth/verify-email` | Verify email with token | No |
| POST | `/auth/request-verification` | Resend verification email | No |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password with token | No |

### TOTP (2FA)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/totp/setup` | Generate TOTP secret | Yes |
| POST | `/auth/totp/verify` | Verify TOTP code | Yes |
| POST | `/auth/totp/verify-login` | Complete login with TOTP | Partial |
| POST | `/auth/totp/disable` | Disable 2FA | Yes |
| POST | `/auth/backup-codes/generate` | Generate backup codes | Yes |

### Threads

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/threads` | List threads | No |
| GET | `/api/threads/:id` | Get thread by ID | No |
| POST | `/api/threads` | Create thread | Yes |
| PUT | `/api/threads/:id` | Update thread | Yes (Owner) |
| DELETE | `/api/threads/:id` | Delete thread | Yes (Owner) |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/user/:username` | Get user profile | No |
| GET | `/api/user/:username/threads` | Get user's threads | No |
| GET | `/api/user/:username/badges` | Get user's badges | No |
| PUT | `/api/me` | Update own profile | Yes |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List all users | Admin |
| PUT | `/admin/users/:id/ban` | Ban user | Admin |
| DELETE | `/admin/threads/:id` | Delete any thread | Admin |

---

## Environment Variables

```env
# Server
BIND_ADDR=127.0.0.1
PORT=8080
GIN_MODE=release

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ISSUER=alephdraad
JWT_AUDIENCE=alephdraad-users
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# TOTP
TOTP_ISSUER=Alephdraad

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@alephdraad.fun
SMTP_PASS=your-smtp-password
SMTP_FROM=Alephdraad <noreply@alephdraad.fun>

# Frontend URL (for email links)
FRONTEND_URL=https://alephdraad.fun
```

---

## Testing

```bash
# Run all tests
go test ./... -v

# Run with coverage
go test ./... -cover

# Run short tests (skip integration)
go test ./... -v -short

# Run specific package
go test ./validators/... -v
go test ./tests/... -v
```

---

## Security Features

### JWT Claims

```go
type Claims struct {
    UserID      int64  `json:"user_id"`
    Username    string `json:"username"`
    Email       string `json:"email"`
    Role        string `json:"role"`
    TotpEnabled bool   `json:"totp_enabled"`  // New: Jan 12, 2026
    jwt.RegisteredClaims
}
```

### Input Validation
- Email format validation
- Username format (3-30 chars, alphanumeric + underscore)
- Password strength requirements
- SQL injection prevention
- XSS prevention
- Path traversal blocking

### Rate Limiting
- Auth endpoints: 5 req/min
- API endpoints: 100 req/min
- Admin endpoints: 30 req/min

---

## Deployment

### Build

```bash
go build -o app .
```

### Docker

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o app .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/app /app
EXPOSE 8080
CMD ["/app"]
```

### Systemd Service

```ini
[Unit]
Description=Alephdraad Backend
After=network.target

[Service]
Type=simple
User=alephdraad
WorkingDirectory=/opt/alephdraad/backend
ExecStart=/opt/alephdraad/backend/app
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
```

---

## Changelog

### January 12, 2026
- Added `TotpEnabled` to JWT claims for cross-service 2FA verification
- Fixed `RequestVerification` to actually send verification emails
- Updated email templates (year 2025 → 2026)

---

*See main [README.md](../README.md) for full project documentation.*
