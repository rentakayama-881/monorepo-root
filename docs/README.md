# Alephdraad Documentation

Platform komunitas dan utilitas digital dengan fitur forum, marketplace escrow, dan AI search.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go 1.21+, Gin, GORM, PostgreSQL + pgvector |
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4 |
| **Smart Contracts** | Solidity 0.8.x (Escrow, Staking, FeeLogic) |
| **Email** | Resend API |
| **AI/RAG** | Cohere (embed, rerank, chat) |

## Documentation Index

### Core Documentation
| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, folder structure, data flow |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API endpoint documentation |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Environment variables reference |
| [SETUP.md](./SETUP.md) | Development setup guide |
| [SECURITY.md](./SECURITY.md) | Security features & patterns |
| [CHANGELOG.md](./CHANGELOG.md) | Version history & migration notes |

### Production Readiness (Phase 71-80)
| Document | Description |
|----------|-------------|
| [PHASE_71_80_IMPLEMENTATION_GUIDE.md](./PHASE_71_80_IMPLEMENTATION_GUIDE.md) | Complete guide for Phase 71-80 execution |
| [PHASE_71_80_TRACKING.md](./PHASE_71_80_TRACKING.md) | Master tracking document with status and metrics |
| [PHASE_71_80_QUICK_REFERENCE.md](./PHASE_71_80_QUICK_REFERENCE.md) | Quick commands and troubleshooting |
| [PHASE_71_80_PROJECT_SETUP.md](./PHASE_71_80_PROJECT_SETUP.md) | GitHub project/milestone setup guide |
| [MIGRATION.md](./MIGRATION.md) | Migration guide with upgrade/rollback paths |
| [VERSION_MATRIX.md](./VERSION_MATRIX.md) | Key dependency versions |
| [../PR_CHECKLIST.md](../PR_CHECKLIST.md) | Comprehensive PR quality checklist |

## Quick Start

```bash
# Backend
cd backend
cp .env.example .env  # Configure environment
go run main.go

# Frontend
cd frontend
npm install
npm run dev
```

## Project Structure

```
monorepo-root/
├── backend/           # Go API server
│   ├── handlers/      # HTTP handlers
│   ├── services/      # Business logic
│   ├── models/        # GORM models
│   ├── middleware/    # Auth, rate limit, security
│   ├── validators/    # Input validation
│   └── worker/        # Blockchain event sync
├── frontend/          # Next.js app
│   ├── app/           # Pages (App Router)
│   ├── components/    # React components
│   └── lib/           # Utilities
├── contracts/         # Solidity smart contracts
└── docs/              # Documentation
```

## Key Features

- **Forum/Threads** - Category-based discussion threads with CRUD
- **Escrow Marketplace** - Non-custodial escrow via smart contracts
- **AI Search (RAG)** - Semantic search with Cohere embeddings
- **Email Verification** - Secure auth flow with Resend
- **Badge System** - User recognition badges

## Repository Links

- Backend entrypoint: `backend/main.go`
- Frontend entrypoint: `frontend/app/page.js`
- Smart contracts: `contracts/*.sol`
