# Environment Variables

Daftar lengkap environment variables yang digunakan dalam project.

---

## Backend

### Required (Fatal jika tidak ada)

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key untuk JWT signing | `your-super-secret-key-min-32-chars` |
| `BACKEND_SIGNER_PRIVATE_KEY` | Private key untuk signing escrow transactions (hex) | `0xabc123...` |
| `ESCROW_FACTORY_ADDRESS` | Smart contract address EscrowFactory | `0x1234...abcd` |

### Database

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string (jika ada, overrides individual vars) | - |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `ballerina_dev` |
| `DB_SSLMODE` | PostgreSQL SSL mode | `disable` |
| `DB_TIMEZONE` | Database timezone | `UTC` |

### Blockchain

| Variable | Description | Default |
|----------|-------------|---------|
| `CHAIN_ID` | EVM chain ID | `137` (Polygon) |
| `RPC_URL` | Ethereum JSON-RPC endpoint | - |

> Note: Jika `RPC_URL` tidak diset, event worker tidak akan aktif.

### Email (Resend)

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | API key dari Resend.com | `re_abc123...` |
| `RESEND_FROM_EMAIL` | Email pengirim | `noreply@yourdomain.com` |

### AI/RAG (Cohere)

| Variable | Description | Default |
|----------|-------------|---------|
| `COHERE_API_KEY` | API key dari Cohere | - |
| `COHERE_MODEL` | Model untuk embeddings | `embed-multilingual-v3.0` |
| `COHERE_ENDPOINT` | Custom Cohere API endpoint | Cohere default |
| `COHERE_RERANK_MODEL` | Model untuk reranking | `rerank-multilingual-v3.0` |
| `COHERE_CHAT_MODEL` | Model untuk chat/answer | `command-r-plus` |

### Server & CORS

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `FRONTEND_BASE_URL` | Frontend URL untuk CORS dan email links | `https://monorepo-root-dun.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | Uses `FRONTEND_BASE_URL` |

### Admin

| Variable | Description | Example |
|----------|-------------|---------|
| `ADMIN_JWT_SECRET` | Secret key untuk admin JWT (harus berbeda dari JWT_SECRET) | `your-admin-secret-key-min-32-chars` |

### Object Storage (Supabase)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGci...` |
| `SUPABASE_BUCKET` | Bucket name untuk avatar storage | `avatars` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level (`debug` for verbose) | `info` |
| `VERSION` | App version (shown in /health) | - |
| `COINGECKO_BASE_URL` | Custom CoinGecko API base URL | CoinGecko default |
| `RATE_CACHE_TTL_SECONDS` | Rate cache TTL | `300` |

---

## Frontend (Next.js)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_ESCROW_FACTORY` | EscrowFactory contract address | `0x1234...abcd` |
| `NEXT_PUBLIC_CHAIN_ID` | EVM chain ID | `137` |

---

## Example .env (Backend)

```bash
# Server
PORT=8080
FRONTEND_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/alephdraad_dev

# Auth
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# Blockchain
CHAIN_ID=137
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/your-key
BACKEND_SIGNER_PRIVATE_KEY=0xYourPrivateKeyHex
ESCROW_FACTORY_ADDRESS=0xYourFactoryAddress

# Email
RESEND_API_KEY=re_your_resend_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# AI/RAG
COHERE_API_KEY=your_cohere_key
COHERE_MODEL=embed-multilingual-v3.0
COHERE_RERANK_MODEL=rerank-multilingual-v3.0
COHERE_CHAT_MODEL=command-r-plus

# Optional
LOG_LEVEL=debug
```

---

## Example .env.local (Frontend)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_ESCROW_FACTORY=0xYourFactoryAddress
NEXT_PUBLIC_CHAIN_ID=137
```

---

## Production Notes

1. **Never commit** `.env` files to version control
2. Use platform secrets management (Render, Vercel, etc.)
3. `BACKEND_SIGNER_PRIVATE_KEY` adalah sensitif - simpan dengan aman
4. Set `DB_SSLMODE=require` di production
5. Gunakan HTTPS untuk semua URLs di production
