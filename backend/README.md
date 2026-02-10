# AIValid Backend

Go-based REST API server using Gin framework with Ent ORM.

**Last Updated:** January 12, 2026

---

## Tech Stack

- **Language:** Go 1.24.5
- **Framework:** Gin
- **ORM:** Ent (entgo.io)
- **Database:** PostgreSQL 16 (Neon)
- **Auth:** JWT + TOTP (RFC 6238)

---

## Quick Start

### Prerequisites
- Go 1.24.5+
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
│   ├── validation_case_handler.go # Validation Case CRUD + public records
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
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login with email/password | No |
| POST | `/api/auth/refresh` | Refresh access token | Refresh Token |
| POST | `/api/auth/logout` | Logout (invalidate session) | Yes |
| POST | `/api/auth/verify/request` | Request verification email | No |
| POST | `/api/auth/verify/confirm` | Confirm email verification | No |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with token | No |

### TOTP (2FA)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/totp/status` | TOTP/2FA status | Yes |
| POST | `/api/auth/totp/setup` | Generate TOTP secret | Yes |
| POST | `/api/auth/totp/verify` | Enable TOTP with code | Yes |
| POST | `/api/auth/totp/verify-code` | Verify TOTP code (for actions) | Yes |
| POST | `/api/auth/totp/disable` | Disable 2FA | Yes |
| GET | `/api/auth/totp/backup-codes/count` | Backup codes count | Yes |

### Validation Cases

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/validation-cases/latest` | Validation Case Index (latest) | No |
| GET | `/api/validation-cases/:id/public` | Validation Case Record (public) | No |
| POST | `/api/validation-cases` | Create Validation Case | Yes |
| GET | `/api/validation-cases/me` | My Validation Cases | Yes |
| PUT | `/api/validation-cases/:id` | Update Validation Case | Yes (Owner) |
| DELETE | `/api/validation-cases/:id` | Delete Validation Case | Yes (Owner) |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/user/:username` | Get user profile | No |
| GET | `/api/user/:username/validation-cases` | Get user's validation cases | No |
| GET | `/api/user/:username/badges` | Get user's badges | No |
| GET | `/api/account/me` | Get own account profile | Yes |
| PUT | `/api/account` | Update own profile | Yes |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/admin/auth/login` | Admin login | No |
| GET | `/admin/categories` | List categories | Admin |
| POST | `/admin/validation-cases/:id/move` | Move validation case between categories | Admin |

---

## Environment Variables

```env
# Server
BIND_ADDR=127.0.0.1
PORT=8080
GIN_MODE=release
TRUSTED_PROXIES=127.0.0.1,::1

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_ISSUER=api.aivalid.id
JWT_AUDIENCE=aivalid-clients
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# TOTP
TOTP_ISSUER=AIValid

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=AIValid <noreply@example.com>

# Frontend URL (for email links)
FRONTEND_URL=https://aivalid.id
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
Description=AIValid Backend
After=network.target

[Service]
Type=simple
User=aivalid
WorkingDirectory=/opt/aivalid/backend
ExecStart=/opt/aivalid/backend/app
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
