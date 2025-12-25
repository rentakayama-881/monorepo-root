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

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, folder structure, data flow |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API endpoint documentation |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Environment variables reference |
| [SETUP.md](./SETUP.md) | Development setup guide |
| [SECURITY.md](./SECURITY.md) | Security features & patterns |
| [CHANGELOG.md](./CHANGELOG.md) | Version history & migration notes |

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
