# System Architecture

## Overview

Alephdraad adalah platform monorepo dengan tiga komponen utama:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│   PostgreSQL    │
│   (Next.js)     │     │    (Go/Gin)     │     │   + pgvector    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Smart Contracts │
                        │   (Ethereum)     │
                        └─────────────────┘
```

---

## Backend Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Gin (HTTP router) |
| ORM | GORM |
| Database | PostgreSQL + pgvector extension |
| Auth | JWT (HS256, 24h expiry) |
| Logging | Zap (structured logging) |
| Email | Resend API |

### Folder Structure

```
backend/
├── main.go              # Entry point, route registration
├── config/
│   └── config.go        # Environment configuration
├── database/
│   └── db.go            # GORM database connection
├── dto/                 # Data Transfer Objects
│   ├── auth.go
│   ├── create_thread.go
│   ├── create_username.go
│   └── update_thread.go
├── errors/
│   └── app_error.go     # Structured error definitions
├── handlers/            # HTTP handlers
│   ├── auth_handler.go  # ✅ Service layer pattern
│   ├── order_handler.go # ✅ Service layer pattern
│   ├── thread_handler.go# ✅ Service layer pattern
│   ├── account.go       # Direct DB (legacy)
│   ├── user.go          # Direct DB (legacy)
│   ├── badges.go        # Direct DB (legacy)
│   ├── health.go        # Health check
│   ├── marketplace.go   # Chainlink rates
│   └── rag.go           # RAG/AI endpoints
├── logger/
│   └── logger.go        # Zap logger setup
├── middleware/
│   ├── auth.go          # JWT authentication (required)
│   ├── auth_optional.go # JWT authentication (optional)
│   ├── jwt.go           # JWT utilities
│   ├── rate_limit.go    # IP-based rate limiting
│   └── security.go      # Security headers
├── models/              # GORM models
│   ├── user.go          # User, profile fields
│   ├── thread.go        # Category, Thread
│   ├── marketplace.go   # Order, Dispute, Promotion
│   ├── credential.go    # OAuth credentials
│   ├── cursor.go        # Blockchain cursor
│   └── verification.go  # Email verification tokens
├── services/            # Business logic layer
│   ├── auth_service.go
│   ├── order_service.go
│   └── thread_service.go
├── utils/               # Utilities
│   ├── chunker.go       # Text chunking for RAG
│   ├── cohere.go        # Cohere API client
│   ├── cohere_rerank.go # Reranking
│   ├── cohere_chat.go   # Chat completion
│   ├── email.go         # Resend email client
│   ├── pgvector.go      # Vector operations
│   ├── sanitize.go      # XSS sanitization
│   └── rate.go          # Rate utilities
├── validators/          # Input validation
│   ├── auth_validator.go
│   ├── order_validator.go
│   └── thread_validator.go
└── worker/
    └── event_worker.go  # Blockchain event sync
```

### Service Layer Pattern

Handler yang sudah dimigrasikan ke service layer:

```go
// Pattern: Handler → Service → Database
type ThreadHandler struct {
    service   *services.ThreadService
    validator *validators.ThreadValidator
}

func (h *ThreadHandler) Create(c *gin.Context) {
    // 1. Parse & validate input
    input, err := h.validator.ValidateCreate(c)
    if err != nil {
        return
    }
    // 2. Call service
    thread, err := h.service.CreateThread(userID, input)
    // 3. Return response
}
```

| Handler | Pattern | Status |
|---------|---------|--------|
| auth_handler.go | Service Layer | ✅ Migrated |
| order_handler.go | Service Layer | ✅ Migrated |
| thread_handler.go | Service Layer | ✅ Migrated |
| account.go | Direct DB | ⚠️ Legacy |
| user.go | Direct DB | ⚠️ Legacy |
| badges.go | Direct DB | ⚠️ Legacy |

### Error Handling

Structured errors dengan kode:

```go
var (
    ErrEmailExists     = NewAppError("AUTH001", "Email sudah terdaftar", 409)
    ErrInvalidPassword = NewAppError("AUTH002", "Password salah", 401)
    ErrUserNotFound    = NewAppError("USER001", "User tidak ditemukan", 404)
    // ... 20+ error codes
)
```

Categories:
- `AUTH001-008`: Authentication errors
- `USER001-003`: User errors
- `THREAD001-004`: Thread errors
- `ORDER001-003`: Order errors
- `VAL001-004`: Validation errors
- `SRV001-003`: Server errors
- `RATE001`: Rate limit errors

---

## Frontend Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| State | React hooks (useState, useEffect) |
| Styling | CSS Custom Properties + Tailwind |

### Folder Structure

```
frontend/
├── app/                    # Pages (App Router)
│   ├── layout.js           # Root layout dengan Header
│   ├── page.js             # Homepage
│   ├── globals.css         # CSS variables & Tailwind
│   ├── login/              # Auth pages
│   ├── register/
│   ├── verify-email/
│   ├── set-username/
│   ├── account/            # User account
│   ├── threads/            # My threads
│   ├── thread/[id]/        # Thread detail
│   ├── category/[slug]/    # Category threads
│   ├── orders/             # Escrow orders
│   ├── ai-search/          # RAG search
│   └── ...
├── components/
│   ├── Header.js           # Navigation header
│   ├── Sidebar.js          # Mobile sidebar
│   ├── ProfileSidebar.js   # User dropdown
│   ├── ApiStatusBanner.jsx # API health indicator
│   ├── home/               # Homepage components
│   │   ├── Hero.jsx
│   │   ├── CategoryGrid.jsx
│   │   └── LatestThreads.jsx
│   └── ui/                 # Reusable UI components
│       ├── Button.jsx
│       ├── Input.jsx
│       ├── Card.jsx
│       ├── Alert.jsx
│       ├── Spinner.jsx
│       └── Skeleton.jsx
└── lib/                    # Utilities
    ├── api.js              # API client (fetchJson)
    ├── auth.js             # Token management
    ├── avatar.js           # Avatar URL resolver
    ├── categories.js       # Category fetcher
    └── email.js            # Email masking
```

### Design System

CSS Custom Properties untuk theming:

```css
:root {
  --bg: 246, 248, 250;       /* #f6f8fa */
  --surface: 255, 255, 255;  /* #ffffff */
  --surface-2: 246, 248, 250;
  --fg: 31, 35, 40;          /* #1f2328 */
  --muted: 101, 109, 118;    /* #656d76 */
  --border: 208, 215, 222;   /* #d0d7de */
  --brand: 31, 111, 235;     /* #1f6feb */
}
```

Usage: `bg-[rgb(var(--surface))]`, `text-[rgb(var(--fg))]`

---

## Smart Contracts

### Contract Files

```
contracts/
├── Escrow.sol              # Per-transaction escrow
├── EscrowFactory.sol       # Factory dengan signature verification
├── FeeLogic.sol            # Volume-based fee tiers
├── Staking.sol             # Seller minimum stake
├── ArbitrationAdapter.sol  # EIP-712 arbitration
└── interfaces/
    ├── IERC20.sol
    └── AggregatorV3Interface.sol
```

### Escrow Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Pending │────▶│  Funded  │────▶│ Delivered│
└──────────┘     └──────────┘     └──────────┘
                       │                │
                       ▼                ▼
                 ┌──────────┐     ┌──────────┐
                 │ Disputed │────▶│ Resolved │
                 └──────────┘     └──────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ Refunded │
                 └──────────┘
```

### Event Worker

Backend worker (`worker/event_worker.go`) sinkronisasi event on-chain:
- `EscrowDeployed` - New escrow created
- `EscrowFunded` - Buyer deposited funds
- `EscrowDelivered` - Seller marked delivery
- `DisputeOpened` - Dispute initiated
- `DisputeResolved` - Arbitrator ruling
- `EscrowRefunded` - Funds returned to buyer
- `EscrowReleased` - Funds released to seller

---

## Data Flow

### Authentication Flow

```
1. User registers → POST /api/auth/register
2. Backend sends verification email (Resend)
3. User clicks link → POST /api/auth/verify/confirm
4. User logs in → POST /api/auth/login → JWT token
5. Frontend stores token in localStorage
6. All requests include Authorization: Bearer <token>
```

### Thread Creation Flow

```
1. User submits form → POST /api/threads
2. ThreadHandler validates input
3. ThreadService creates thread
4. RAG: Content chunked → Cohere embed → pgvector store
5. Response returned to client
```

### Escrow Flow

```
1. Buyer creates order → POST /api/orders/signature
2. Backend signs EIP-191 payload
3. Buyer deploys escrow via Factory contract
4. POST /api/orders/attach-escrow → Links on-chain address
5. Event worker syncs status updates
6. Seller marks delivered / Buyer disputes
7. Arbitrator resolves if disputed
```

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts with profile |
| `categories` | Thread categories |
| `threads` | Forum threads |
| `orders` | Escrow orders |
| `disputes` | Order disputes |
| `email_verification_tokens` | Email verification |
| `thread_chunks` | RAG vector embeddings |

### Key Relationships

```
users 1──N threads
categories 1──N threads
users 1──N orders (as buyer)
users 1──N orders (as seller)
orders 1──1 disputes
threads 1──N thread_chunks
```
