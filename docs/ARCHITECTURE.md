# 🏗️ ARSITEKTUR SISTEM ALEPHDRAAD

> **Versi:** 1.0  
> **Terakhir Diperbarui:** 15 Januari 2026  
> **Klasifikasi:** Technical Documentation

---

## 📋 DAFTAR ISI

1. [Overview Arsitektur](#1-overview-arsitektur)
2. [Diagram Sistem](#2-diagram-sistem)
3. [Komponen Utama](#3-komponen-utama)
4. [Alur Data (Data Flow)](#4-alur-data)
5. [Database Design](#5-database-design)
6. [API Architecture](#6-api-architecture)
7. [Keamanan](#7-keamanan)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. OVERVIEW ARSITEKTUR

Alephdraad menggunakan **Microservices Architecture** dengan tiga layer utama:

```
┌───────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                         │
│                     (Next.js 15 + React 19)                       │
│                        Deployed: Vercel                            │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              │ HTTPS
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────────────┐       ┌───────────────────────────────┐
│      GO BACKEND           │       │      FEATURE SERVICE          │
│      (Core API)           │       │      (.NET Core)              │
│                           │       │                               │
│  ├─ Authentication        │       │  ├─ Social Features           │
│  ├─ User Management       │       │  │  ├─ Replies                │
│  ├─ Thread/Forum          │       │  │  ├─ Reactions              │
│  ├─ Admin Panel           │       │  │  └─ Reports                │
│                           │       │  ├─ Finance Module            │
│  └─ Session Management    │       │  │  ├─ Wallets                │
│                           │       │  │  ├─ Transfers (P2P)        │
│  Database: PostgreSQL     │       │  │  ├─ Withdrawals            │
│  Cache: Redis             │       │  │  └─ Disputes               │
│                           │       │                               │
│  VPS: 72.62.124.23        │       │  └─ Document Storage          │
└───────────────────────────┘       │                               │
                                    │  Database: MongoDB             │
                                    │  VPS: 203.175.11.84            │
                                    └───────────────────────────────┘
```

### Prinsip Arsitektur

| Prinsip | Implementasi |
|---------|--------------|
| **Separation of Concerns** | Core (Go) vs Extended Features (.NET) |
| **Single Responsibility** | Tiap service punya domain spesifik |
| **DRY (Don't Repeat Yourself)** | Shared JWT validation, common middleware |
| **Security by Default** | Auth middleware di semua protected routes |
| **Fail Fast** | Validation di entry point |

---

## 2. DIAGRAM SISTEM

### 2.1 High-Level Architecture

```
                                    ┌─────────────────┐
                                    │   CloudFlare    │
                                    │   (DNS + WAF)   │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
            ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
            │   Vercel     │        │  VPS #1      │        │  VPS #2      │
            │  Frontend    │        │  Go Backend  │        │  .NET Svc    │
            │              │        │              │        │              │
            │ alephdraad   │        │ api.aleph... │        │ feature....  │
            │   .fun       │        │   .fun       │        │   .fun       │
            └──────────────┘        └──────┬───────┘        └──────┬───────┘
                                           │                       │
                              ┌────────────┴────────────┐          │
                              │                         │          │
                              ▼                         ▼          ▼
                    ┌──────────────┐          ┌──────────────────────────┐
                    │   Neon       │          │    MongoDB Atlas         │
                    │ PostgreSQL   │          │    (Cloud)               │
                    │  (Cloud)     │          │                          │
                    └──────────────┘          └──────────────────────────┘
```

### 2.2 Request Flow Diagram

```
User Browser
     │
     │ (1) HTTPS Request
     ▼
┌─────────────────┐
│    Next.js      │
│   (Server)      │
│                 │
│ ├─ SSR Pages    │
│ ├─ API Routes   │◄──── (4) Return Response
│ └─ Static Gen   │
└────────┬────────┘
         │
         │ (2) API Call
         ▼
┌─────────────────┐    ┌─────────────────┐
│   Go Backend    │◄───│  Feature Svc    │
│                 │    │                 │
│ ├─ Validate JWT │    │ ├─ Validate JWT │
│ ├─ Rate Limit   │    │ ├─ Rate Limit   │
│ ├─ Process      │    │ ├─ Process      │
│ └─ Return       │    │ └─ Return       │
└────────┬────────┘    └────────┬────────┘
         │                      │
         │ (3) DB Query         │ (3) DB Query
         ▼                      ▼
    PostgreSQL              MongoDB
```

---

## 3. KOMPONEN UTAMA

### 3.1 Frontend (Next.js 15)

```
frontend/
├── app/                    # App Router (Page-based routing)
│   ├── (auth)/             # Auth-related pages (login, register)
│   ├── account/            # User account settings
│   ├── admin/              # Admin dashboard
│   ├── thread/[slug]/      # Dynamic thread pages
│   ├── user/[username]/    # User profile pages
│   ├── api/                # API routes (BFF pattern)
│   └── layout.js           # Root layout
│
├── components/             # Reusable UI components
│   ├── ui/                 # Base UI components (buttons, inputs)
│   ├── Header.js           # Site header
│   ├── Sidebar.js          # Navigation sidebar
│   ├── PasskeySettings.jsx # WebAuthn component
│   └── TOTPSettings.jsx    # 2FA settings
│
├── lib/                    # Utilities and hooks
│   ├── api.js              # Go backend API client
│   ├── featureApi.js       # Feature service API client
│   ├── auth.js             # Token management
│   ├── tokenRefresh.js     # JWT refresh logic
│   ├── UserContext.js      # User state management
│   └── hooks.js            # Custom React hooks
│
└── public/                 # Static assets
```

#### Key Frontend Features

| Feature | Implementation |
|---------|----------------|
| **State Management** | React Context + SWR |
| **Data Fetching** | SWR with automatic revalidation |
| **Auth State** | localStorage + Context broadcast |
| **Styling** | Tailwind CSS 4 + CVA |
| **Type Safety** | TypeScript (strict mode) |
| **Markdown** | react-markdown + rehype |

### 3.2 Go Backend (Gin)

```
backend/
├── main.go                 # Entry point, router setup
│
├── config/                 # Configuration management
│   └── config.go           # Environment config loader
│
├── database/               # Database connections
│   ├── db.go               # PostgreSQL connection
│   └── ent.go              # Ent ORM client
│
├── ent/                    # Ent ORM (Generated + Schemas)
│   ├── schema/             # Entity definitions
│   │   ├── user.go         # User entity
│   │   ├── thread.go       # Thread entity
│   │   ├── session.go      # Session entity
│   │   └── ...             # Other entities
│   ├── client.go           # Generated client
│   ├── user_*.go           # Generated CRUD
│   └── ...
│
├── handlers/               # HTTP request handlers
│   ├── auth_handler.go     # Login, register, refresh
│   ├── passkey_handler.go  # WebAuthn endpoints
│   ├── totp_handler.go     # 2FA endpoints
│   ├── thread_handler.go   # Thread CRUD
│   ├── user_handler.go     # User profile
│   └── admin_handler.go    # Admin operations
│
├── services/               # Business logic layer
│   ├── auth_service_ent.go # Auth business logic
│   ├── passkey_service_ent.go # WebAuthn logic
│   ├── totp_service_ent.go # TOTP logic
│   ├── session_service_ent.go # Session management
│   ├── device_tracker_ent.go  # Device fingerprinting
│   └── ...
│
├── middleware/             # HTTP middleware
│   ├── auth.go             # JWT validation
│   ├── rate_limit.go       # Rate limiting
│   ├── security.go         # Security headers
│   └── sudo.go             # Elevated privilege mode
│
├── dto/                    # Data Transfer Objects
├── validators/             # Input validation
├── errors/                 # Custom error types
└── utils/                  # Utility functions
```

#### Backend Architecture Pattern

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Router    │────▶│  Middleware │────▶│   Handler   │────▶│   Service   │
│   (Gin)     │     │   Chain     │     │   (HTTP)    │     │  (Business) │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                                                                    ▼
                                                            ┌─────────────┐
                                                            │  Repository │
                                                            │   (Ent)     │
                                                            └──────┬──────┘
                                                                    │
                                                                    ▼
                                                            ┌─────────────┐
                                                            │ PostgreSQL  │
                                                            └─────────────┘
```

### 3.3 Feature Service (.NET Core)

```
feature-service/
└── src/
    └── FeatureService.Api/
        ├── Program.cs              # Entry point, DI configuration
        │
        ├── Controllers/            # API endpoints
        │   ├── Social/
        │   │   ├── RepliesController.cs
        │   │   └── ReactionsController.cs
        │   ├── Finance/
        │   │   ├── WalletsController.cs
        │   │   ├── TransfersController.cs
        │   │   ├── WithdrawalsController.cs
        │   │   └── DisputesController.cs
        │   ├── DocumentController.cs
        │   └── ReportController.cs
        │
        ├── Services/               # Business logic
        │   ├── WalletService.cs
        │   ├── TransferService.cs
        │   ├── ReplyService.cs
        │   ├── ReactionService.cs
        │   └── ...
        │
        ├── Models/
        │   └── Entities/           # MongoDB documents
        │       ├── UserWallet.cs
        │       ├── Transaction.cs
        │       ├── Reply.cs
        │       └── ...
        │
        ├── DTOs/                   # Request/Response models
        ├── Validators/             # FluentValidation
        ├── Middleware/             # Custom middleware
        └── Infrastructure/
            ├── MongoDB/            # MongoDB context
            └── Auth/               # JWT configuration
```

---

## 4. ALUR DATA (DATA FLOW)

### 4.1 Authentication Flow

```
┌──────────┐                                  ┌──────────────┐
│  Client  │                                  │  Go Backend  │
└────┬─────┘                                  └──────┬───────┘
     │                                               │
     │  POST /auth/register                          │
     │  {email, password}                            │
     │──────────────────────────────────────────────▶│
     │                                               │
     │                                   ┌───────────┴───────────┐
     │                                   │ 1. Validate input     │
     │                                   │ 2. Check device limit │
     │                                   │ 3. Hash password      │
     │                                   │ 4. Create user        │
     │                                   │ 5. Send verify email  │
     │                                   └───────────┬───────────┘
     │                                               │
     │  200 {user_id, message}                       │
     │◀──────────────────────────────────────────────│
     │                                               │
     │  GET /auth/verify-email?token=xxx             │
     │──────────────────────────────────────────────▶│
     │                                               │
     │                                   ┌───────────┴───────────┐
     │                                   │ Verify token          │
     │                                   │ Mark email verified   │
     │                                   └───────────┬───────────┘
     │                                               │
     │  POST /auth/login                             │
     │  {email, password}                            │
     │──────────────────────────────────────────────▶│
     │                                               │
     │                                   ┌───────────┴───────────┐
     │                                   │ 1. Verify credentials │
     │                                   │ 2. Check 2FA status   │
     │                                   │ 3. Generate JWT       │
     │                                   │ 4. Create session     │
     │                                   └───────────┬───────────┘
     │                                               │
     │  200 {access_token, refresh_token, expires}   │
     │◀──────────────────────────────────────────────│
```

### 4.2 JWT Token Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      ACCESS TOKEN (15 min)                       │
│                                                                  │
│  Header: { alg: "HS256", typ: "JWT" }                           │
│  Payload: {                                                      │
│    user_id: 123,                                                 │
│    email: "user@example.com",                                    │
│    jti: "unique-session-id",                                     │
│    type: "access",                                               │
│    exp: 1705123456                                               │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     REFRESH TOKEN (7 days)                       │
│                                                                  │
│  Payload: {                                                      │
│    user_id: 123,                                                 │
│    type: "refresh",                                              │
│    exp: 1705728256                                               │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 P2P Transfer Flow (Escrow)

```
┌────────┐          ┌────────────────┐          ┌────────────────┐
│ Sender │          │ Feature Service│          │    Receiver    │
└───┬────┘          └───────┬────────┘          └───────┬────────┘
    │                       │                           │
    │ POST /transfers       │                           │
    │ {receiver, amount, pin, totp}                     │
    │──────────────────────▶│                           │
    │                       │                           │
    │               ┌───────┴───────┐                   │
    │               │ 1. Verify 2FA │                   │
    │               │ 2. Verify PIN │                   │
    │               │ 3. Check balance                  │
    │               │ 4. Create escrow                  │
    │               │ 5. Deduct sender                  │
    │               │ 6. Generate code                  │
    │               └───────┬───────┘                   │
    │                       │                           │
    │ 200 {transfer, code}  │                           │
    │◀──────────────────────│                           │
    │                       │                           │
    │                       │   GET /transfers/code/XXX │
    │                       │◀──────────────────────────│
    │                       │                           │
    │                       │   POST /transfers/{id}/release
    │                       │   {pin, totp}             │
    │                       │◀──────────────────────────│
    │                       │                           │
    │               ┌───────┴───────┐                   │
    │               │ 1. Verify 2FA │                   │
    │               │ 2. Add to receiver                │
    │               │ 3. Mark completed                 │
    │               └───────┬───────┘                   │
    │                       │                           │
    │                       │ 200 {transfer: completed} │
    │                       │──────────────────────────▶│
```

### 4.4 WebAuthn/Passkey Flow

```
Registration:
┌──────────┐                    ┌──────────────┐
│  Client  │                    │  Go Backend  │
└────┬─────┘                    └──────┬───────┘
     │                                 │
     │ POST /passkey/register/begin    │
     │ {Authorization: Bearer token}   │
     │────────────────────────────────▶│
     │                                 │
     │                         ┌───────┴───────┐
     │                         │ Create WebAuthn│
     │                         │ challenge      │
     │                         │ Store in Redis │
     │                         └───────┬───────┘
     │                                 │
     │ 200 {options, session_id}       │
     │◀────────────────────────────────│
     │                                 │
     │ ┌───────────────────────┐       │
     │ │ Browser creates       │       │
     │ │ credential using      │       │
     │ │ biometric/PIN         │       │
     │ └───────────────────────┘       │
     │                                 │
     │ POST /passkey/register/finish   │
     │ {credential, session_id}        │
     │────────────────────────────────▶│
     │                                 │
     │                         ┌───────┴───────┐
     │                         │ Verify challenge│
     │                         │ Store credential │
     │                         └───────┬───────┘
     │                                 │
     │ 200 {success}                   │
     │◀────────────────────────────────│
```

---

## 5. DATABASE DESIGN

### 5.1 PostgreSQL Schema (Core Data)

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(50) UNIQUE,          -- username
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    full_name VARCHAR(255),
    bio TEXT,
    totp_enabled BOOLEAN DEFAULT FALSE,
    totp_secret VARCHAR(32),
    primary_badge_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Threads table
CREATE TABLE threads (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content_type VARCHAR(32) DEFAULT 'table',
    content_json JSONB,
    meta JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    access_token_jti VARCHAR(64) UNIQUE,
    refresh_token_hash VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(20),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Passkeys table
CREATE TABLE passkeys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    credential_id BYTEA NOT NULL,
    public_key BYTEA NOT NULL,
    counter INTEGER DEFAULT 0,
    device_name VARCHAR(100),
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Session locks (account lockout)
CREATE TABLE session_locks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    reason TEXT,
    locked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 MongoDB Collections (Feature Data)

```javascript
// wallets collection
{
  "_id": "wlt_01HXYZ...",
  "userId": 123,
  "balance": 50000000,  // in smallest unit (cents)
  "pinHash": "pbkdf2:...",
  "pinSalt": "base64...",
  "pinSet": true,
  "failedPinAttempts": 0,
  "pinLockedUntil": null,
  "createdAt": ISODate("2026-01-15"),
  "updatedAt": ISODate("2026-01-15")
}

// transactions collection
{
  "_id": "txn_01HXYZ...",
  "userId": 123,
  "type": "Transfer",  // Deposit, Withdrawal, Transfer
  "amount": 100000,
  "balanceBefore": 50000000,
  "balanceAfter": 49900000,
  "description": "Transfer to user @john",
  "referenceId": "tfr_01HXYZ...",
  "referenceType": "Transfer",
  "createdAt": ISODate("2026-01-15")
}

// transfers collection (escrow)
{
  "_id": "tfr_01HXYZ...",
  "senderId": 123,
  "receiverId": 456,
  "amount": 100000,
  "claimCode": "ABC123",
  "claimCodeHash": "sha256:...",
  "status": "Pending",  // Pending, Claimed, Expired, Cancelled
  "notes": "Payment for service",
  "expiresAt": ISODate("2026-01-22"),
  "claimedAt": null,
  "createdAt": ISODate("2026-01-15")
}

// replies collection
{
  "_id": "rpl_01HXYZ...",
  "threadId": 789,
  "authorId": 123,
  "content": "Great post!",
  "parentId": null,
  "isHidden": false,
  "createdAt": ISODate("2026-01-15"),
  "updatedAt": ISODate("2026-01-15")
}

// reactions collection
{
  "_id": "rxn_01HXYZ...",
  "threadId": 789,
  "userId": 123,
  "type": "like",  // like, love, haha, wow, sad, angry
  "createdAt": ISODate("2026-01-15")
}
```

### 5.3 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │     Thread      │       │    Category     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │   ┌──▶│ id (PK)         │
│ email           │  │    │ user_id (FK)    │───┘   │ name            │
│ username        │  │    │ category_id (FK)│───────│ slug            │
│ password_hash   │  │    │ title           │       │ description     │
│ ...             │  │    │ content_json    │       └─────────────────┘
└─────────────────┘  │    └─────────────────┘
        │            │            │
        │            │            │
        ▼            │            │
┌─────────────────┐  │    ┌───────┴─────────┐
│    Session      │  │    │   thread_tags   │       ┌─────────────────┐
├─────────────────┤  │    ├─────────────────┤       │      Tag        │
│ id (PK)         │  │    │ thread_id (FK)  │───────│ id (PK)         │
│ user_id (FK)    │──┤    │ tag_id (FK)     │◀──────│ name            │
│ access_jti      │  │    └─────────────────┘       │ slug            │
│ expires_at      │  │                              └─────────────────┘
└─────────────────┘  │
                     │
┌─────────────────┐  │    ┌─────────────────┐
│    Passkey      │  │    │     Badge       │
├─────────────────┤  │    ├─────────────────┤
│ id (PK)         │  │    │ id (PK)         │
│ user_id (FK)    │──┤    │ name            │
│ credential_id   │  │    │ description     │
│ public_key      │  │    │ icon_url        │
└─────────────────┘  │    └────────┬────────┘
                     │             │
                     │             ▼
                     │    ┌─────────────────┐
                     │    │   UserBadge     │
                     │    ├─────────────────┤
                     └───▶│ user_id (FK)    │
                          │ badge_id (FK)   │
                          │ granted_at      │
                          └─────────────────┘
```

---

## 6. API ARCHITECTURE

### 6.1 API Design Principles

| Principle | Implementation |
|-----------|----------------|
| **RESTful** | Resource-based URLs, proper HTTP verbs |
| **Versioning** | `/api/v1/...` prefix |
| **Consistent Response** | Standard error/success format |
| **Pagination** | `?page=1&limit=20` |
| **Rate Limiting** | Per endpoint, per IP/user |

### 6.2 Response Format

```javascript
// Success Response
{
  "data": { ... },
  "message": "Operation successful"
}

// Error Response
{
  "error": "Error message",
  "code": "ERR_CODE",
  "details": { ... }
}

// Paginated Response
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 6.3 API Endpoints Summary

#### Go Backend (api.alephdraad.fun)

```
Auth Endpoints:
POST   /auth/register              # Register new user
POST   /auth/login                 # Login with email/password
POST   /auth/refresh               # Refresh access token
POST   /auth/logout                # Logout (revoke session)
POST   /auth/verify-email          # Verify email token
POST   /auth/forgot-password       # Request password reset
POST   /auth/reset-password        # Reset password

2FA Endpoints:
POST   /auth/totp/setup            # Begin 2FA setup
POST   /auth/totp/verify           # Verify and enable 2FA
POST   /auth/totp/validate         # Validate 2FA code
DELETE /auth/totp                  # Disable 2FA

WebAuthn Endpoints:
POST   /passkey/register/begin     # Begin passkey registration
POST   /passkey/register/finish    # Complete registration
POST   /passkey/login/begin        # Begin passkey login
POST   /passkey/login/finish       # Complete login
GET    /passkey/list               # List user's passkeys
DELETE /passkey/:id                # Delete a passkey

Thread Endpoints:
GET    /api/threads                # List threads
POST   /api/threads                # Create thread
GET    /api/threads/:id            # Get thread
PUT    /api/threads/:id            # Update thread
DELETE /api/threads/:id            # Delete thread

User Endpoints:
GET    /api/user/:username         # Get user profile
PUT    /api/account                # Update own profile
DELETE /api/account                # Delete account
```

#### Feature Service (feature.alephdraad.fun)

```
Social Endpoints:
GET    /api/v1/threads/:id/replies           # List replies
POST   /api/v1/threads/:id/replies           # Create reply
PUT    /api/v1/threads/:id/replies/:replyId  # Edit reply
DELETE /api/v1/threads/:id/replies/:replyId  # Delete reply

GET    /api/v1/threads/:id/reactions/summary # Get reactions summary
POST   /api/v1/threads/:id/reactions         # Add reaction
DELETE /api/v1/threads/:id/reactions         # Remove reaction

Wallet Endpoints:
GET    /api/v1/wallets/me                    # Get own wallet
POST   /api/v1/wallets/pin/set               # Set PIN (requires 2FA)
POST   /api/v1/wallets/pin/change            # Change PIN
POST   /api/v1/wallets/pin/verify            # Verify PIN
GET    /api/v1/wallets/transactions          # Transaction history

Transfer Endpoints:
GET    /api/v1/wallets/transfers             # List transfers
POST   /api/v1/wallets/transfers             # Create transfer (requires 2FA + PIN)
GET    /api/v1/wallets/transfers/:id         # Get transfer details
GET    /api/v1/wallets/transfers/code/:code  # Find by claim code
POST   /api/v1/wallets/transfers/:id/release # Claim transfer
POST   /api/v1/wallets/transfers/:id/cancel  # Cancel transfer

Withdrawal Endpoints:
GET    /api/v1/wallets/withdrawals           # List withdrawals
POST   /api/v1/wallets/withdrawals           # Create withdrawal (requires 2FA + PIN)
POST   /api/v1/wallets/withdrawals/:id/cancel # Cancel withdrawal

Dispute Endpoints:
GET    /api/v1/wallets/disputes              # List disputes
POST   /api/v1/wallets/disputes              # Create dispute
POST   /api/v1/wallets/disputes/:id/respond  # Respond to dispute
```

---

## 7. KEAMANAN

### 7.1 Authentication Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Primary Auth                                           │
│  ┌─────────────────┐   ┌─────────────────┐                      │
│  │ Email/Password  │   │    Passkey      │                      │
│  │ (bcrypt hash)   │   │   (WebAuthn)    │                      │
│  └─────────────────┘   └─────────────────┘                      │
│                                                                  │
│  Layer 2: Two-Factor Auth (Optional but Recommended)            │
│  ┌─────────────────┐   ┌─────────────────┐                      │
│  │   TOTP Code     │   │  Backup Codes   │                      │
│  │  (6 digits)     │   │  (8 one-time)   │                      │
│  └─────────────────┘   └─────────────────┘                      │
│                                                                  │
│  Layer 3: Session Management                                     │
│  ┌─────────────────┐   ┌─────────────────┐                      │
│  │   JWT Access    │   │ Refresh Token   │                      │
│  │   (15 min)      │   │   (7 days)      │                      │
│  └─────────────────┘   └─────────────────┘                      │
│                                                                  │
│  Layer 4: Financial Security                                     │
│  ┌─────────────────┐   ┌─────────────────┐                      │
│  │   PIN (6 digit) │   │   2FA Required  │                      │
│  │   PBKDF2 310k   │   │   for all txns  │                      │
│  └─────────────────┘   └─────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Security Features

| Feature | Implementation | Location |
|---------|----------------|----------|
| **Password Hashing** | bcrypt (cost 10) | auth_service |
| **PIN Hashing** | PBKDF2-SHA256 (310,000 iterations) | WalletService |
| **JWT Signing** | HS256 | middleware/jwt |
| **WebAuthn** | FIDO2 standard | passkey_service |
| **TOTP** | RFC 6238 (30s window) | totp_service |
| **Device Fingerprinting** | Hash of browser properties | device_tracker |
| **Rate Limiting** | Token bucket per IP | rate_limit middleware |
| **Account Lockout** | 5 failures → 30min lock | session_lock |
| **PIN Lockout** | 4 failures → 4 hour lock | WalletService |

### 7.3 Security Headers

```go
// Applied to all responses
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 7.4 Input Validation

```go
// Backend validation example
type RegisterInput struct {
    Email    string `validate:"required,email,max=255"`
    Password string `validate:"required,min=8,max=72"`
    Username string `validate:"omitempty,alphanum,min=3,max=20"`
}

// .NET FluentValidation example
public class TransferValidator : AbstractValidator<CreateTransferRequest>
{
    public TransferValidator()
    {
        RuleFor(x => x.ReceiverUserId).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThan(0).LessThanOrEqualTo(100000000);
        RuleFor(x => x.Pin).Length(6).Matches("^[0-9]+$");
        RuleFor(x => x.TotpCode).Length(6).Matches("^[0-9]+$");
    }
}
```

---

## 8. DEPLOYMENT ARCHITECTURE

### 8.1 Current Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐                                            │
│  │     Vercel      │◀─── GitHub Actions (auto-deploy on push)   │
│  │    Frontend     │                                            │
│  │                 │     Domain: alephdraad.fun                 │
│  │  Next.js 15     │     SSL: Let's Encrypt (auto)              │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │   VPS #1        │     IP: 72.62.124.23                       │
│  │   Go Backend    │     Domain: api.alephdraad.fun             │
│  │                 │     SSL: Caddy (auto HTTPS)                │
│  │   User: deploy  │     Service: systemd (backend)             │
│  │   OS: Ubuntu    │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           │ Connect                                              │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  Neon Database  │     PostgreSQL 16 (Serverless)             │
│  │                 │     Region: aws-ap-southeast-1             │
│  └─────────────────┘                                            │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │   VPS #2        │     IP: 203.175.11.84                      │
│  │  Feature Svc    │     Domain: feature.alephdraad.fun         │
│  │                 │     SSL: Caddy (auto HTTPS)                │
│  │   User: asp     │     Service: systemd (featureservice)      │
│  │   OS: Ubuntu    │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           │ Connect                                              │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  MongoDB Atlas  │     MongoDB 7.0 (M0 Free)                  │
│  │                 │     Cluster: ap-southeast-1                │
│  └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Systemd Services

```ini
# /etc/systemd/system/backend.service
[Unit]
Description=Go Backend Service
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/monorepo-root/backend
ExecStart=/home/deploy/monorepo-root/backend/backend
Restart=always
RestartSec=5
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/featureservice.service
[Unit]
Description=Feature Service (.NET)
After=network.target

[Service]
Type=simple
User=asp
WorkingDirectory=/home/asp/monorepo-root/feature-service/src/FeatureService.Api
ExecStart=/usr/bin/dotnet run --configuration Release
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 8.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Go tests
        run: cd backend && go test ./...
      - name: Run .NET tests
        run: cd feature-service && dotnet test

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Vercel auto-deploys from GitHub

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: SSH Deploy
        run: |
          ssh deploy@72.62.124.23 'cd ~/monorepo-root && git pull && cd backend && go build -o backend && sudo systemctl restart backend'

  deploy-feature:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: SSH Deploy
        run: |
          ssh asp@203.175.11.84 'cd ~/monorepo-root && git pull && cd feature-service/src/FeatureService.Api && dotnet publish -c Release && sudo systemctl restart featureservice'
```

---

## 📚 REFERENSI

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Ent ORM Documentation](https://entgo.io/docs/getting-started)
- [Gin Web Framework](https://gin-gonic.com/docs/)
- [ASP.NET Core Documentation](https://docs.microsoft.com/aspnet/core)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [TOTP RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238)

---

*Dokumen ini adalah bagian dari dokumentasi teknis Alephdraad. Terakhir diperbarui: 15 Januari 2026.*
