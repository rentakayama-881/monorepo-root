# Development Setup

Panduan lengkap untuk setup development environment.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Go | 1.21+ | https://go.dev/dl/ |
| Node.js | 18+ | https://nodejs.org/ |
| PostgreSQL | 14+ | https://www.postgresql.org/download/ |
| Git | Latest | https://git-scm.com/ |

---

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/monorepo-root.git
cd monorepo-root
```

### 2. Setup Database

```sql
-- Create database
CREATE DATABASE alephdraad_dev;

-- Enable pgvector extension (required for RAG)
\c alephdraad_dev
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
go mod download

# Copy environment file
cp .env.example .env

# Edit .env with your values (see docs/ENVIRONMENT.md)
# Required: JWT_SECRET, DB_*, BACKEND_SIGNER_PRIVATE_KEY, ESCROW_FACTORY_ADDRESS

# Run server
go run main.go
```

Backend akan berjalan di `http://localhost:8080`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8080

# Run development server
npm run dev
```

Frontend akan berjalan di `http://localhost:3000`

---

## Database Migrations

GORM AutoMigrate berjalan otomatis saat server start. Models yang di-migrate:

- `users` - User accounts
- `categories` - Thread categories (auto-seeded)
- `threads` - Forum threads
- `orders` - Escrow orders
- `disputes` - Order disputes
- `email_verification_tokens` - Email verification
- `thread_chunks` - RAG embeddings

---

## Project Structure

```
monorepo-root/
├── backend/          # Go API server
├── frontend/         # Next.js web app
└── docs/             # Documentation
```

---

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run specific package tests
go test -v ./services
go test -v ./validators
```

### Frontend Tests

```bash
cd frontend

# Run tests (if configured)
npm test
```

---

## Common Tasks

### Adding a New API Endpoint

1. Define DTO di `backend/dto/`
2. Buat handler di `backend/handlers/`
3. Register route di `backend/main.go`
4. (Optional) Buat service di `backend/services/` untuk logic kompleks

### Adding a New Page (Frontend)

1. Buat folder di `frontend/app/your-page/`
2. Buat `page.jsx` di folder tersebut
3. Gunakan komponen dari `frontend/components/ui/`

### Working with Contracts

```bash
cd contracts

# Install Foundry (jika belum)
# curl -L https://foundry.paradigm.xyz | bash

# Compile contracts
forge build

# Run tests
forge test
```

---

## Troubleshooting

### Database Connection Error

```
Gagal terhubung ke PostgreSQL
```

**Solution:**
- Pastikan PostgreSQL running
- Cek kredensial di `.env`
- Cek `DATABASE_URL` format: `postgresql://user:pass@host:port/dbname`

### pgvector Extension Missing

```
ERROR: type "vector" does not exist
```

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### JWT_SECRET Not Set

```
ERROR: JWT_SECRET is not set in environment variables
```

**Solution:**
- Buat JWT secret minimal 32 karakter
- Set di `.env`: `JWT_SECRET=your-secret-key-here-minimum-32-chars`

### CORS Error

```
Access-Control-Allow-Origin
```

**Solution:**
- Set `FRONTEND_BASE_URL` di backend `.env`
- Atau set `CORS_ALLOWED_ORIGINS=http://localhost:3000`

### Email Not Sending

**Solution:**
- Cek `RESEND_API_KEY` dan `RESEND_FROM_EMAIL`
- Pastikan domain terverifikasi di Resend dashboard
- Lihat `backend/RESEND_SETUP.md` untuk detail

---

## IDE Setup

### VS Code Extensions

Recommended extensions:
- Go (golang.go)
- ESLint
- Tailwind CSS IntelliSense
- Prettier

### VS Code Settings

```json
{
  "go.useLanguageServer": true,
  "editor.formatOnSave": true,
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  }
}
```

---

## Deployment

### Backend (Render/Railway)

1. Connect repo
2. Set build command: `cd backend && go build -o main .`
3. Set start command: `./backend/main`
4. Add environment variables dari `docs/ENVIRONMENT.md`

### Frontend (Vercel)

1. Connect repo
2. Set root directory: `frontend`
3. Framework preset: Next.js
4. Add environment variables

### Contracts (Hardhat/Foundry)

```bash
# Deploy dengan Foundry
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

---

## Next Steps

- Baca [ARCHITECTURE.md](./ARCHITECTURE.md) untuk memahami struktur sistem
- Baca [API_REFERENCE.md](./API_REFERENCE.md) untuk dokumentasi endpoint
- Baca [SECURITY.md](./SECURITY.md) untuk security best practices
