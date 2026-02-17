# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

AIValid is a monorepo for an institutional-grade Validation Protocol platform with three services:

- **`backend/`** — Go + Gin REST API (port 8080). Handles auth, users, validation cases, admin. Uses Ent ORM with PostgreSQL (Neon).
- **`feature-service/`** — ASP.NET Core 8 microservice (port 5000). Handles wallet, escrow, disputes, device bans. Uses MongoDB Atlas.
- **`frontend/`** — Next.js 16 + React 19 (Vercel). Uses SWR, Tailwind CSS 4, FingerprintJS.

## Build & Test Commands

### Backend (Go)
```bash
cd backend
go build ./...                          # Build all packages
go test ./...                           # Run all tests
go test ./... -v                        # Verbose
go test ./services -run TestFoo -v      # Single test
go test ./... -short                    # Skip integration tests
gofmt -w .                             # Format code
golangci-lint run                       # Lint (config: .golangci.yml)
go run main.go                          # Run server
```

### Feature Service (.NET)
```bash
cd feature-service
dotnet build
dotnet test
dotnet run --project src/FeatureService.Api
```

### Frontend
```bash
cd frontend
npm run build                           # Production build (webpack)
npm run dev                             # Dev server
npm run lint                            # ESLint
npm run typecheck                       # tsc --noEmit
npm test                                # Jest
npm run test:e2e                        # Playwright
```

## Architecture

### Go Backend Layered Structure

**Request flow:** Router (main.go) → Middleware → Handler → Service → Ent ORM → PostgreSQL

- **`main.go`** — Entry point. Initializes all services in specific order, sets up routes, CORS, rate limiting, trusted proxies. ~660 lines, serves as the wiring file.
- **`handlers/`** — HTTP handlers. Extract request data, call services, return JSON. Each file maps to a domain (auth, account, admin, validation cases, passkeys, TOTP, sudo).
- **`services/`** — Business logic. Files named `*_ent.go` use Ent ORM directly. Key services:
  - `auth_service_ent.go` — Registration, login (email/passkey/TOTP), password reset. Calls `RecordDeviceLogin`/`RecordDeviceRegistration` during auth flows.
  - `session_service_ent.go` — JWT sessions with refresh token rotation, device tracking.
  - `device_tracker_ent.go` — Device fingerprint tracking with in-memory cache (`recentDevices` map, 24h expiry, 1h cleanup). Enforces max 2 accounts per device.
  - `device_ban_checker.go` — Checks device bans via Feature Service HTTP API (500ms timeout, graceful fallback).
  - `validation_case_workflow_service_ent.go` — Complex workflow: consultation requests, final offers, escrow locking, disputes. ~2000 lines.
  - `service_wrappers.go` — Legacy interface adapters bridging old handler signatures to new Ent-based services.
- **`middleware/`** — Auth (JWT validation), rate limiting (Redis-backed, IP + user level), CORS, security headers, sudo mode, correlation IDs.
- **`ent/schema/`** — 26 Ent schemas. All use `TimeMixin` (created_at, updated_at, deleted_at for soft delete). Domain rename: Thread → ValidationCase.
- **`database/ent.go`** — PGX driver with Simple Protocol mode (avoids prepared statement issues). Connection pool: 5 idle, 20 max open. Auto-migration on startup.
- **`errors/app_error.go`** — Structured error type with 60+ pre-defined errors in Indonesian.
- **`validators/`** — Input validation (email, password, username rules).
- **`utils/`** — Email queue (async, 3 workers), input security (SQL/XSS/path traversal prevention), Supabase storage integration.

### Cross-Service Communication

Go backend ↔ Feature Service communicate via:
- Shared JWT secret (same `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`)
- `SERVICE_TOKEN` for internal API calls
- Feature Service checks device bans at `/api/v1/admin/moderation/device-bans/check`
- Go backend calls Feature Service for escrow operations

### Ent ORM Code Generation

Schemas in `backend/ent/schema/` → generated code in `backend/ent/`. The `ent/` directory is excluded from linting. When modifying schemas, regenerate with `go generate ./ent`.

## Key Conventions

### Commit Messages
Conventional Commits: `<type>(<scope>): <description>`
Types: feat, fix, refactor, docs, test, chore, style, perf

### Go Linting
Config at `backend/.golangci.yml`. Generated `ent/` files and `vendor/` are excluded. Tests have relaxed rules (no gosec, wrapcheck, errcheck). Security linters: gosec, bodyclose, noctx. Shadow checking is strict.

### Error Handling in Go
- `errors/app_error.go` provides structured errors — use these rather than raw errors for handler responses.
- Services propagate errors up; handlers convert to AppError responses.
- Auth/Redis services are excluded from wrapcheck linting.

### Database
- All entities use soft delete (`deleted_at`). Filter with `Where(field.DeletedAtIsNil())` in queries.
- Device fingerprint hash: SHA256 of concatenated fingerprint + userAgent components.
- `device_fingerprints` has unique constraint on `fingerprint_hash`.
- `device_user_mappings` has unique compound index on `(fingerprint_hash, user_id)`.

### Security Patterns
- Device tracking uses upsert pattern in transactions (create-or-update).
- Constraint duplicate errors on device mappings are safe to ignore (race condition); other errors must propagate.
- Ban checking has dual layers: Feature Service API (external) + local PostgreSQL blocked flag.
- `MaxAccountsPerDevice = 2` — enforced at registration, tracked via `account_count`.
- Financial operations require 2FA. Sudo mode required for destructive account actions.

### Frontend
- Next.js App Router (not Pages Router).
- Data fetching via SWR.
- Device fingerprinting via `@fingerprintjs/fingerprintjs`.
- Node.js 24.x required.
