# Alephdraad

A modern Indonesian community platform with enterprise-grade security and real-time features.

**Last Updated:** January 12, 2026

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 15)                           │
│                 React 19 · Tailwind CSS 4                           │
│                    Deployed on Vercel                               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────────┐   ┌───────────────────────────────────────┐
│   GO BACKEND (Gin)      │   │   FEATURE SERVICE (ASP.NET Core 8)   │
│   Ent ORM · JWT · TOTP  │   │   MongoDB · Finance · Social         │
│                         │   │                                       │
│   ▪ Authentication      │   │   ▪ Replies & Reactions               │
│   ▪ Users & Profiles    │   │   ▪ Wallet & PIN System               │
│   ▪ Threads & Tags      │   │   ▪ P2P Transfers                     │
│   ▪ Admin & Moderation  │   │   ▪ Bank Withdrawals                  │
│   ▪ RAG/AI Pipeline     │   │   ▪ Dispute Resolution                │
│                         │   │   ▪ AI Chat (HuggingFace)             │
│   PostgreSQL (Neon)     │   │   MongoDB Atlas                       │
└─────────────────────────┘   └───────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js | 15.x |
| | React | 19.x |
| | Tailwind CSS | 4.x |
| **Backend** | Go + Gin | 1.22 |
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
alephdraad/
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
├── frontend/                # Next.js 15 application
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
- Go 1.22+
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
**Test Coverage:** 49 tests, all passing

### Frontend
```bash
cd frontend
npm run lint
npm run typecheck
```

---

## API Endpoints

### Go Backend (`api.alephdraad.fun`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/verify-email` | Email verification |
| POST | `/auth/totp/setup` | Setup 2FA |
| POST | `/auth/totp/verify` | Verify 2FA code |
| GET | `/api/threads` | List threads |
| POST | `/api/threads` | Create thread |
| GET | `/api/user/:username` | User profile |

### Feature Service (`feature.alephdraad.fun`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/threads/{id}/replies` | List replies |
| POST | `/api/v1/threads/{id}/replies` | Create reply |
| POST | `/api/v1/threads/{id}/reactions` | Add reaction |
| GET | `/api/v1/wallets/me` | Get user wallet |
| POST | `/api/v1/wallets/me/pin` | Set PIN (2FA req) |
| POST | `/api/v1/transfers` | Create transfer (2FA req) |
| POST | `/api/v1/withdrawals` | Create withdrawal (2FA req) |
| GET | `/health` | Health check |

---

## Environment Variables

### Backend
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT
JWT_SECRET=your-secret-key
JWT_ISSUER=alephdraad
JWT_AUDIENCE=alephdraad-users
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@alephdraad.fun
SMTP_PASS=your-smtp-password

# TOTP
TOTP_ISSUER=Alephdraad
```

### Feature Service
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=same-as-backend
JWT_ISSUER=alephdraad
JWT_AUDIENCE=alephdraad-users
HUGGINGFACE_API_KEY=your-key
```

---

## Deployment

### GitHub Actions Workflows
- **ci.yml** — Lint, typecheck, build, and test on push
- **backend-deploy.yml** — Auto-deploy backend on main branch push

### Production URLs
- Frontend: `https://alephdraad.fun`
- Backend API: `https://api.alephdraad.fun`
- Feature Service: `https://feature.alephdraad.fun`

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `docs:` — Documentation
- `test:` — Tests
- `chore:` — Maintenance

---

## Security

If you discover a security vulnerability, please email **security@alephdraad.fun** instead of creating a public issue.

---

## License

This project is proprietary software. All rights reserved.

---

## Changelog

### January 12, 2026
- ✅ Added 2FA requirement for all financial operations
- ✅ Implemented secure PIN system with no reset option
- ✅ Fixed registration email verification flow
- ✅ Updated email templates (year 2025 → 2026)
- ✅ Added 15 new financial security tests
- ✅ Fixed frontend ThreadCard import error
- ✅ Cleaned up legacy documentation files

### January 5, 2026
- Initial Feature Service deployment
- Social service (replies, reactions) complete
- Finance service structure (wallets, transfers, withdrawals)
