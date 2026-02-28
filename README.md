# AIValid

An institutional-grade Validation Protocol platform (academic/legal/financial tone) with enterprise-grade security and escrow-backed workflows.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                              │
│                 React 19 · Tailwind CSS 4                           │
│                    Deployed on Vercel                               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────────┐   ┌───────────────────────────────────────┐
│   GO BACKEND (Gin)      │   │   FEATURE SERVICE (ASP.NET Core 8)   │
│   Ent ORM · JWT · TOTP  │   │   MongoDB · Wallet/Escrow/Dispute    │
│                         │   │                                       │
│   ▪ Authentication      │   │   ▪ Documents & Reports               │
│   ▪ Users & Profiles    │   │   ▪ Wallet & PIN System               │
│   ▪ Validation Cases    │   │   ▪ Escrow/P2P Transfers              │
│   ▪ Admin & Moderation  │   │   ▪ Bank Withdrawals                  │
│                         │   │   ▪ Dispute Resolution (Arbitration)  │
│   PostgreSQL (Neon)     │   │   MongoDB Atlas                       │
└─────────────────────────┘   └───────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js | 16.x |
| | React | 19.x |
| | Tailwind CSS | 4.x |
| **Backend** | Go + Gin | 1.24.5 |
| | Ent ORM | Latest |
| | PostgreSQL | 16 (Neon) |
| **Feature Service** | ASP.NET Core | 8.0 |
| | MongoDB | 7.0 (Atlas) |
| **Auth** | JWT + TOTP | RFC 6238 |
| **Deployment** | Vercel (Frontend) | - |
| | VPS (Backend) | Ubuntu 22.04 |

---

## Security Features

### Authentication & Authorization
- **Passkey/WebAuthn** support for passwordless login
- **TOTP 2FA** with backup codes
- **JWT tokens** with refresh mechanism
- **Session management** with device tracking

### Financial Security (New: January 12, 2026)
- **6-digit PIN** for all financial operations
  - PBKDF2 hashing with 310,000 iterations
  - 4-hour lockout after 4 failed attempts
  - **No PIN reset** — permanent security measure
- **2FA Required** for:
  - PIN setup
  - P2P transfers
  - Bank withdrawals
  - Deposit confirmations
- **Strong warnings** on PIN creation

### Input Validation
- SQL injection protection
- XSS prevention
- Path traversal blocking
- Command injection prevention
- Rate limiting on sensitive endpoints

---

## Project Structure

```
aivalid/
├── backend/                 # Go + Gin API
│   ├── cmd/                 # CLI tools (seeding)
│   ├── config/              # Configuration
│   ├── database/            # Database connections
│   ├── dto/                 # Data transfer objects
│   ├── ent/                 # Ent ORM schemas & generated code
│   ├── handlers/            # HTTP handlers
│   ├── middleware/          # Auth, logging, rate limiting
│   ├── services/            # Business logic
│   ├── tests/               # Unit & integration tests
│   ├── utils/               # Utilities (email, crypto)
│   └── validators/          # Input validators
│
├── feature-service/         # ASP.NET Core microservice
│   ├── src/
│   │   └── FeatureService.Api/
│   │       ├── Controllers/
│   │       ├── Services/
│   │       ├── Models/
│   │       └── Infrastructure/
│   └── tests/
│       └── FeatureService.Api.Tests/
│
├── frontend/                # Next.js application
│   ├── app/                 # App router pages
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utilities & hooks
│   └── public/              # Static assets
│
└── .github/
    └── workflows/           # CI/CD pipelines
```

---

## Getting Started

### Prerequisites
- Go 1.24+
- Node.js 24.12+ (24.x)
- .NET 8.0 SDK
- PostgreSQL 16+
- MongoDB 7.0+

### Backend Setup
```bash
cd backend
cp .env.example .env
# Configure your database and JWT secrets
go mod download
go run main.go
```

### Feature Service Setup
```bash
cd feature-service
cp .env.example .env
# Configure MongoDB and JWT secrets
dotnet restore
dotnet run --project src/FeatureService.Api
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

---

## Testing

### Backend (Go)
```bash
cd backend
go test ./... -v
```

### Feature Service (.NET)
```bash
cd feature-service
dotnet test
```
Note: some integration-style tests may require a CI/runtime environment that allows network/socket binding.

### Frontend
```bash
cd frontend
npm run lint
npm run typecheck
```

---

## API Endpoints

### Go Backend (`api.aivalid.id`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/verify/request` | Request email verification |
| POST | `/api/auth/verify/confirm` | Confirm email verification |
| POST | `/api/auth/totp/setup` | Setup 2FA |
| POST | `/api/auth/totp/verify` | Verify 2FA code |
| GET | `/api/validation-cases/latest` | Validation Case Index (latest) |
| POST | `/api/validation-cases` | Create Validation Case |
| GET | `/api/validation-cases/{id}/public` | Validation Case Record (public) |
| GET | `/api/user/:username` | User profile |

### Feature Service (`feature.aivalid.id`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/wallets/me` | Get user wallet |
| GET | `/api/v1/wallets/pin/status` | PIN status |
| POST | `/api/v1/wallets/transfers` | Create transfer (escrow/lock funds) |
| POST | `/api/v1/wallets/withdrawals` | Create withdrawal |
| POST | `/api/v1/guarantees` | Lock credibility stake (guarantee) |
| POST | `/api/v1/disputes` | Create dispute |
| POST | `/api/v1/reports` | Create report (moderation) |
| POST | `/api/v1/documents` | Upload document (artifact) |
| GET | `/api/v1/health` | Health check |

---

## Environment Variables

### Backend
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT
JWT_SECRET=your-secret-key
JWT_ISSUER=api.aivalid.id
JWT_AUDIENCE=aivalid-users
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password

# TOTP
TOTP_ISSUER=AIValid
```

### Feature Service
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=same-as-backend
JWT_ISSUER=api.aivalid.id
JWT_AUDIENCE=aivalid-users
```

---

## Deployment

### GitHub Actions Workflows
- **ci.yml** — Lint, typecheck, build, and test on push
- **deploy.yml** — Deploy backend + feature-service on main branch push

### Production URLs
- Frontend: `https://aivalid.id`
- Backend API: `https://api.aivalid.id`
- Feature Service: `https://feature.aivalid.id`

---

## For AI Assistants

Read `CLAUDE.md` at the project root — it bootstraps the full `.ai/` instruction system.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For detailed setup and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

### Commit Convention
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `docs:` — Documentation
- `test:` — Tests
- `chore:` — Maintenance

---

## Security

If you discover a security vulnerability, please use the contact listed in `SECURITY.md` instead of creating a public issue.

---

## License

This project is proprietary software. All rights reserved.

