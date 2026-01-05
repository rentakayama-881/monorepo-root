# Alephdraad

A monorepo platform with escrow marketplace, forum threads, and AI search.

## Architecture

```
Frontend (Next.js/Vercel)
    ├── Core API (Gin) → api.alephdraad.fun → Neon Postgres
    └── Feature API (ASP.NET Core) → feature.alephdraad.fun → MongoDB
```

## Services

### Backend (Core API)
- **Tech**: Go/Gin, PostgreSQL, JWT
- **Features**: User auth, threads, escrow, AI search
- **Path**: `/backend`

### Feature Service (Phase 1 Complete ✅)
- **Tech**: ASP.NET Core 8, MongoDB, JWT
- **Features**: Social features (replies, reactions), Finance stubs
- **Path**: `/feature-service`
- **Status**: Phase 1 (Social) implemented, Phase 2 (Finance) in progress

### Frontend
- **Tech**: Next.js 15, React 19, Tailwind CSS
- **Path**: `/frontend`

## Quick Start

```bash
# Backend (Core API)
cd backend && go run main.go

# Feature Service
cd feature-service && docker-compose up -d

# Frontend
cd frontend && npm install && npm run dev
```

## Documentation

| Document | Description |
|----------|-------------|
| [README](docs/README.md) | Project overview |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System architecture |
| [API_REFERENCE](docs/API_REFERENCE.md) | API endpoints |
| [ENVIRONMENT](docs/ENVIRONMENT.md) | Environment variables |
| [SETUP](docs/SETUP.md) | Development setup |
| [SECURITY](docs/SECURITY.md) | Security features |
| [CHANGELOG](docs/CHANGELOG.md) | Version history |

## Tech Stack

- **Backend**: Go/Gin, PostgreSQL, JWT
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Contracts**: Solidity (Escrow, Staking)
- **AI**: Cohere embeddings + pgvector

## License

MIT
