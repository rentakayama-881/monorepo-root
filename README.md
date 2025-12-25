# Alephdraad

A monorepo platform with escrow marketplace, forum threads, and AI search.

## Quick Start

```bash
# Backend
cd backend && go run main.go

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
