# Feature Service (.NET 8) — Wallet, Escrow, Disputes, Documents

Feature Service adalah backend ASP.NET Core yang menangani fitur finansial dan audit-adjacent untuk AIValid, termasuk:

- Wallet + PIN system
- Transfers (P2P + escrow)
- Withdrawals (penarikan)
- Disputes (admin arbitration)
- Guarantees (Credibility Stake)
- Documents (Artifact uploads)
- Reports + Admin moderation (hide/unhide, audit logs, device bans, warnings)

Service ini **bukan** forum dan **tidak** menyediakan replies/reactions/likes/stars.

## Architecture (High-Level)

```
Frontend (Next.js / Vercel)
  ├── Core API (Go/Gin)          → identity + validation cases (Postgres)
  └── Feature Service (.NET 8)   → wallet/escrow/dispute/docs/admin (MongoDB + Redis)
```

## Local Development

### Prerequisites
- .NET 8 SDK
- MongoDB 7+
- Redis (recommended)

### Run

```bash
cd feature-service
cp .env.example .env

cd src/FeatureService.Api
dotnet run
```

Default URL (per configuration): `http://127.0.0.1:5000`

## Health Endpoints

- `GET /api/v1/health` (controller health, includes `version`)
- `GET /health` (ASP.NET HealthChecks middleware)

## Key API Groups (Non-Exhaustive)

- Wallet: `/api/v1/wallets/*`
  - `GET /api/v1/wallets/me`
  - `GET /api/v1/wallets/pin/status`
- Transfers (Escrow/P2P): `/api/v1/wallets/transfers/*`
- Withdrawals: `/api/v1/wallets/withdrawals/*`
- Guarantees (Credibility Stake): `/api/v1/guarantees/*`
- Disputes: `/api/v1/disputes/*`
- Documents: `/api/v1/documents/*`
- Reports: `/api/v1/reports/*`
- Admin moderation: `/api/v1/admin/moderation/*`

## Auth Model

Feature Service menggunakan JWT yang diterbitkan oleh Go backend.

Header:

```
Authorization: Bearer <jwt>
```

## Go Backend Integration

Feature Service melakukan best-effort calls ke Go backend untuk:

- Resolve owner dari Validation Case (untuk moderation/reporting).
- Notifikasi finalisasi Validation Case saat escrow auto-release (internal callback).

Konfigurasi base URL + internal key:

- `GoBackend:BaseUrl` (env: `GOBACKEND__BASEURL`)
- `GoBackend:InternalApiKey` (env: `GOBACKEND__INTERNALAPIKEY`)

## Environment Variables (Core)

Nama env mengikuti ASP.NET configuration binding (gunakan `__` untuk nesting):

- `MONGODB__CONNECTIONSTRING`
- `MONGODB__DATABASENAME`
- `JWT__SECRET` (required)
- `JWT__ISSUER`
- `JWT__AUDIENCE`
- `REDIS__CONNECTIONSTRING` (recommended)
- `CORS__ALLOWEDORIGINS__0`
- `ASPNETCORE_URLS` (default: `http://127.0.0.1:5000`)
- `GOBACKEND__BASEURL`
- `GOBACKEND__INTERNALAPIKEY`

## Build

```bash
cd feature-service/src/FeatureService.Api
dotnet build -c Release
```

