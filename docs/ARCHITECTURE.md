# 🏗️ ARSITEKTUR SISTEM AIVALID

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

AIValid menggunakan **Microservices Architecture** dengan tiga layer utama:

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
│  ├─ Authentication        │       │  ├─ Wallet + PIN              │
│  ├─ User Management       │       │  ├─ Transfers (P2P/Escrow)    │
│  ├─ Validation Cases      │       │  ├─ Withdrawals               │
│  ├─ Admin Panel           │       │  ├─ Disputes (Arbitration)    │
│                           │       │  ├─ Guarantees (Stake)        │
│  └─ Session Management    │       │  ├─ Documents (Artifacts)     │
│                           │       │  └─ Reports + Moderation      │
│  Database: PostgreSQL     │       │                               │
│  Cache: Redis             │       │                               │
│  VPS: (Go backend)        │       │  VPS: (Feature service)       │
└───────────────────────────┘       │                               │
                                    │  Database: MongoDB             │
                                    │                               │
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
            │ aivalid   │        │ api.aleph... │        │ feature....  │
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

### 3.1 Frontend (Next.js 16)

```
frontend/
├── app/                    # App Router (Page-based routing)
│   ├── (auth)/             # Auth-related pages (login, register)
│   ├── account/            # User account settings
│   ├── admin/              # Admin dashboard
│   ├── validation-cases/   # Validation Case Index + Record
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
│   │   ├── validation_case.go # Validation Case entity
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
│   ├── validation_case_handler.go # Validation Case CRUD
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
        │   ├── Finance/
        │   │   ├── WalletsController.cs
        │   │   ├── TransfersController.cs
        │   │   ├── WithdrawalsController.cs
        │   │   ├── DepositsController.cs
        │   │   ├── DisputesController.cs
        │   │   └── GuaranteesController.cs
        │   ├── Security/
        │   │   └── PqcKeysController.cs
        │   ├── AdminModerationController.cs
        │   ├── AdminWalletsController.cs
        │   ├── AdminDepositsController.cs
        │   ├── AdminDisputesController.cs
        │   ├── DocumentController.cs
        │   ├── ReportController.cs
        │   ├── HealthController.cs
        │   └── UserCleanupController.cs
        │
        ├── Services/               # Business logic
        │   ├── WalletService.cs
        │   ├── TransferService.cs
        │   ├── DisputeService.cs
        │   ├── DocumentService.cs
        │   ├── ReportService.cs
        │   ├── AdminModerationService.cs
        │   └── ...
        │
        ├── Models/
        │   └── Entities/           # MongoDB documents
        │       ├── UserWallet.cs
        │       ├── Transaction.cs
        │       ├── Transfer.cs
        │       ├── Dispute.cs
        │       ├── Document.cs
        │       ├── Report.cs
        │       ├── HiddenContent.cs
        │       ├── AdminActionLog.cs
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
     │  POST /api/auth/register                      │
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
     │  POST /api/auth/verify/confirm                │
     │  {token}                                      │
     │──────────────────────────────────────────────▶│
     │                                               │
     │                                   ┌───────────┴───────────┐
     │                                   │ Verify token          │
     │                                   │ Mark email verified   │
     │                                   └───────────┬───────────┘
     │                                               │
     │  POST /api/auth/login                         │
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
    │ POST /api/v1/wallets/transfers                    │
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
    │                       │   GET /api/v1/wallets/transfers/code/XXX
    │                       │◀──────────────────────────│
    │                       │                           │
    │                       │   POST /api/v1/wallets/transfers/{id}/release
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
     │ POST /api/auth/passkeys/register/begin
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
     │ POST /api/auth/passkeys/register/finish
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

-- Validation Cases table
CREATE TABLE validation_cases (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    summary TEXT DEFAULT '',
    content_type VARCHAR(32) DEFAULT 'table',
    content_json JSONB,
    meta JSONB,
    bounty_amount BIGINT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'open',
    escrow_transfer_id TEXT,
    dispute_id TEXT,
    accepted_final_offer_id INTEGER,
    artifact_document_id TEXT,
    certified_artifact_document_id TEXT,
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
  "balance": 50000000,  // IDR (Rupiah, integer)
  "pinHash": "pbkdf2:...", // optional (set after PIN setup)
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
  "type": 3,  // TransactionType enum (e.g. TransferOut)
  "amount": 100000,
  "balanceBefore": 50000000,
  "balanceAfter": 49900000,
  "description": "Transfer to user @john",
  "referenceId": "trf_01HXYZ...",
  "referenceType": "transfer",
  "createdAt": ISODate("2026-01-15")
}

// transfers collection (escrow)
{
  "_id": "trf_01HXYZ...",
  "code": "12345678",
  "senderId": 123,
  "senderUsername": "alice",
  "receiverId": 456,
  "receiverUsername": "bob",
  "amount": 100000,
  "message": "Payment for service",
  "status": 0, // TransferStatus enum (Pending/Released/Cancelled/Rejected/Disputed/Expired)
  "holdUntil": ISODate("2026-01-22"),
  "releasedAt": null,
  "cancelledAt": null,
  "createdAt": ISODate("2026-01-15"),
  "updatedAt": ISODate("2026-01-15")
}

// disputes collection (admin arbitration)
{
  "_id": ObjectId("65d2c0f4a6e7b1c2d3e4f5a6"),
  "transferId": "trf_01HXYZ...",
  "initiatorId": 123,
  "respondentId": 456,
  "reason": "Work not delivered",
  "status": 0, // DisputeStatus enum (Open/UnderReview/WaitingForEvidence/Resolved/Cancelled)
  "resolution": null,
  "createdAt": ISODate("2026-01-15"),
  "updatedAt": ISODate("2026-01-15")
}

// documents collection (profile + workflow artifacts)
{
  "userId": 123,
  "fileName": "report.pdf",
  "title": "Artifact Submission",
  "fileType": "pdf",
  "visibility": "private",
  "sharedWithUserIds": [456],
  "createdAt": ISODate("2026-01-15"),
  "updatedAt": ISODate("2026-01-15")
}

// reports collection (moderation)
{
  "_id": "rpt_01HXYZ...",
  "targetType": "validation_case",
  "targetId": "789",
  "validationCaseId": 789,
  "reason": "spam",
  "status": "pending",
  "createdAt": ISODate("2026-01-15"),
  "updatedAt": ISODate("2026-01-15")
}
```

### 5.3 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │ ValidationCase  │       │    Category     │
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
│    Session      │  │    │tag_validation_cases│     ┌─────────────────┐
├─────────────────┤  │    ├─────────────────┤       │      Tag        │
│ id (PK)         │  │    │ validation_case_id (FK)│─▶│ id (PK)        │
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

#### Go Backend (api.aivalid.id)

```
Auth Endpoints:
POST   /api/auth/register                 # Register new user
POST   /api/auth/login                    # Login with email/password
POST   /api/auth/login/totp               # Login with 2FA (TOTP)
POST   /api/auth/login/backup-code        # Login with backup code
POST   /api/auth/refresh                  # Refresh access token
POST   /api/auth/logout                   # Logout (revoke session)
POST   /api/auth/verify/request           # Request verification email
POST   /api/auth/verify/confirm           # Confirm verification (token)
POST   /api/auth/forgot-password          # Request password reset
POST   /api/auth/reset-password           # Reset password

2FA Endpoints:
GET    /api/auth/totp/status              # 2FA status
POST   /api/auth/totp/setup               # Begin 2FA setup
POST   /api/auth/totp/verify              # Verify and enable 2FA (returns backup codes)
POST   /api/auth/totp/verify-code         # Verify code (e.g. for sensitive actions)
POST   /api/auth/totp/disable             # Disable 2FA
GET    /api/auth/totp/backup-codes/count  # Backup codes count

WebAuthn Endpoints:
POST   /api/auth/passkeys/check           # Check passkeys availability
POST   /api/auth/passkeys/login/begin     # Begin passkey login
POST   /api/auth/passkeys/login/finish    # Complete passkey login
POST   /api/auth/passkeys/register/begin  # Begin passkey registration (auth)
POST   /api/auth/passkeys/register/finish # Complete passkey registration (auth)
GET    /api/auth/passkeys                 # List user's passkeys (auth)
GET    /api/auth/passkeys/status          # Passkey status (auth)
PUT    /api/auth/passkeys/:id/name        # Rename passkey (auth)
DELETE /api/auth/passkeys/:id             # Delete passkey (auth)

Validation Case Endpoints:
GET    /api/validation-cases/categories                 # List case categories
GET    /api/validation-cases/category/:slug             # List cases by category
GET    /api/validation-cases/latest                     # Latest cases
GET    /api/validation-cases/:id/public                 # Public case record
GET    /api/validation-cases/:id                        # Case record (auth)
POST   /api/validation-cases                            # Create case (auth)
GET    /api/validation-cases/me                         # My cases (auth)
PUT    /api/validation-cases/:id                        # Update case (auth)
DELETE /api/validation-cases/:id                        # Delete case (auth)
GET    /api/validation-cases/:id/tags                   # Case tags
POST   /api/validation-cases/:id/tags                   # Add tags (auth)
DELETE /api/validation-cases/:id/tags/:tagSlug          # Remove tag (auth)

Validation Protocol Workflow (Case Record):
POST   /api/validation-cases/:id/consultation-requests                      # Request Consultation (auth)
GET    /api/validation-cases/:id/consultation-requests                      # List requests (auth)
POST   /api/validation-cases/:id/consultation-requests/:requestId/approve   # Approve contact sharing (auth)
POST   /api/validation-cases/:id/consultation-requests/:requestId/reject    # Reject (auth)
GET    /api/validation-cases/:id/contact                                    # Reveal Telegram contact (auth)
POST   /api/validation-cases/:id/final-offers                               # Submit Final Offer (auth)
GET    /api/validation-cases/:id/final-offers                               # List Final Offers (auth)
POST   /api/validation-cases/:id/final-offers/:offerId/accept               # Accept offer (auth)
POST   /api/validation-cases/:id/lock-funds                                 # Lock Funds into escrow (auth)
POST   /api/validation-cases/:id/artifact-submission                        # Artifact Submission (auth)
POST   /api/validation-cases/:id/escrow/released                            # Mark escrow released (auth)
POST   /api/validation-cases/:id/dispute/attach                             # Attach Dispute (auth)
GET    /api/validation-cases/:id/case-log                                   # Case Log (auth)

User Endpoints:
GET    /api/user/:username         # Get user profile
GET    /api/user/:username/validation-cases  # List user's cases
GET    /api/user/:username/badges            # Public badges/credentials
GET    /api/user/me                          # Current user (auth)
PUT    /api/account                # Update own profile
DELETE /api/account                # Delete account
```

#### Feature Service (feature.aivalid.id)

```
Health:
GET    /api/v1/health                        # Health (JSON)
GET    /api/v1/health/live                   # Liveness
GET    /api/v1/health/ready                  # Readiness (Mongo + Redis)
GET    /health                               # HealthChecks endpoint

Wallet Endpoints:
GET    /api/v1/wallets/me                    # Get own wallet
GET    /api/v1/wallets/pin/status            # PIN status (locked / set)
POST   /api/v1/wallets/pin/set               # Set PIN (one-time, requires 2FA)
POST   /api/v1/wallets/pin/verify            # Verify PIN
GET    /api/v1/wallets/transactions          # Transaction history

Deposit Endpoints:
POST   /api/v1/wallets/deposits              # Create deposit request (requires 2FA + PQC)
GET    /api/v1/wallets/deposits              # Deposit history

Transfer Endpoints:
GET    /api/v1/wallets/transfers             # List transfers
POST   /api/v1/wallets/transfers             # Create transfer (requires 2FA + PIN)
GET    /api/v1/wallets/transfers/:id         # Get transfer details
GET    /api/v1/wallets/transfers/code/:code  # Find by claim code
POST   /api/v1/wallets/transfers/:id/release # Claim transfer
POST   /api/v1/wallets/transfers/:id/cancel  # Cancel transfer
POST   /api/v1/wallets/transfers/:id/reject  # Reject transfer (refund)
GET    /api/v1/wallets/transfers/search-user # Find receiver by username/email (helper)

Withdrawal Endpoints:
GET    /api/v1/wallets/withdrawals           # List withdrawals
POST   /api/v1/wallets/withdrawals           # Create withdrawal (requires 2FA + PIN)
GET    /api/v1/wallets/withdrawals/:id       # Withdrawal detail
POST   /api/v1/wallets/withdrawals/:id/cancel # Cancel withdrawal
GET    /api/v1/wallets/withdrawals/banks     # Supported banks

Dispute Endpoints:
POST   /api/v1/disputes                      # Create dispute (requires PQC)
GET    /api/v1/disputes                      # List disputes
GET    /api/v1/disputes/:id                  # Dispute detail
POST   /api/v1/disputes/:id/messages         # Add message (requires PQC)
POST   /api/v1/disputes/:id/evidence         # Add evidence (requires PQC)
POST   /api/v1/disputes/:id/cancel           # Cancel dispute (requires PQC)
POST   /api/v1/disputes/:id/mutual-refund    # Request mutual refund (requires PQC)

Guarantee Endpoints:
GET    /api/v1/guarantees/me                 # Get guarantee (auth)
POST   /api/v1/guarantees                    # Lock guarantee (requires 2FA + PIN + PQC)
POST   /api/v1/guarantees/release            # Release guarantee (requires 2FA + PIN + PQC)
GET    /api/v1/guarantees/user/:userId       # Public guarantee (best-effort)

Documents:
POST   /api/v1/documents                     # Upload (auth)
GET    /api/v1/documents/my-documents        # List own docs (auth)
GET    /api/v1/documents/:id                 # Get doc (public/private rules)
GET    /api/v1/documents/:id/download        # Download doc
PATCH  /api/v1/documents/:id                 # Update metadata (auth)
PATCH  /api/v1/documents/:id/sharing         # Update private sharing list (auth)
DELETE /api/v1/documents/:id                 # Delete doc (auth)
GET    /api/v1/documents/quota               # Storage quota (auth)
GET    /api/v1/documents/user/:userId        # List public docs by user (anon)
GET    /api/v1/documents/categories          # Allowed categories (anon)

Reports:
POST   /api/v1/reports                        # Create report (auth)
GET    /api/v1/reports/:id                    # Get report status (auth)
GET    /api/v1/reports/reasons                # Report reasons (anon)

Admin Moderation:
GET    /api/v1/admin/moderation/dashboard
GET    /api/v1/admin/moderation/reports
GET    /api/v1/admin/moderation/reports/:id
POST   /api/v1/admin/moderation/reports/:id/action
GET    /api/v1/admin/moderation/device-bans
POST   /api/v1/admin/moderation/device-bans
POST   /api/v1/admin/moderation/device-bans/check
GET    /api/v1/admin/moderation/warnings
POST   /api/v1/admin/moderation/warnings
GET    /api/v1/admin/moderation/content/hidden
POST   /api/v1/admin/moderation/content/hide
POST   /api/v1/admin/moderation/content/unhide/:id
POST   /api/v1/admin/moderation/validation-cases/move

PQC Keys:
POST   /api/v1/users/:userId/pqc-keys        # Register PQC public key (auth + 2FA)
GET    /api/v1/users/:userId/pqc-keys        # Get active key
DELETE /api/v1/users/:userId/pqc-keys        # Revoke key (auth + 2FA)
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

### 8.1 Observed Runtime Notes (Evidence-Based)

Dokumen ini membedakan:

- **Repo facts** (bisa diverifikasi dari file di repo), dan
- **runtime facts** (harus diverifikasi dari host yang menjalankan service).

Untuk runtime map yang evidence-only, lihat: `docs/FACT_MAP_REPO_RUNTIME.md`.

Ringkasan runtime yang *terobservasi dari konfigurasi host* saat repo ini diperiksa:

- Reverse-proxy: Nginx vhost `api.aivalid.id` -> `127.0.0.1:8080` dan `feature.aivalid.id` -> `127.0.0.1:5000` (lihat `/etc/nginx/sites-available/aivalid.conf`).
- systemd unit files yang ditemukan:
  - `/etc/systemd/system/alephdraad-backend.service`
  - `/etc/systemd/system/feature-service.service`

Catatan batasan verifikasi pada environment ini:

- Status service via `systemctl` adalah `UNKNOWN` (akses ke systemd bus ditolak).
- Health checks via `curl` adalah `UNKNOWN` (pembuatan socket ditolak pada environment ini).

### 8.2 Systemd Services (Observed Unit Files)

Unit Go backend (observed):

```ini
# /etc/systemd/system/alephdraad-backend.service
[Service]
WorkingDirectory=/opt/alephdraad/backend
EnvironmentFile=/opt/alephdraad/backend/.env
ExecStart=/opt/alephdraad/backend/app
```

Unit Feature Service (observed):

```ini
# /etc/systemd/system/feature-service.service
[Service]
WorkingDirectory=/opt/alephdraad/feature-service
EnvironmentFile=/opt/alephdraad/feature-service/.env
ExecStart=/usr/bin/dotnet /opt/alephdraad/feature-service/FeatureService.Api.dll
```

### 8.3 CI/CD Pipeline

Repo memiliki pipeline CI dan deploy berbasis GitHub Actions:

- CI: `.github/workflows/ci.yml` (frontend lint/typecheck/build, backend lint/build/test, feature-service test/build, security scans).
- Deploy: `.github/workflows/deploy.yml` (deploy backend + feature-service via SSH menggunakan GitHub Secrets, lalu restart service + health check).

Catatan penting:

- Detail deploy (host/path/service name) harus diverifikasi terhadap runtime environment yang sebenarnya.
- Pada host yang diperiksa untuk FACT MAP, unit file yang terobservasi adalah `alephdraad-backend.service` dan `feature-service.service`, sedangkan `deploy.yml` melakukan restart `backend.service` dan `featureservice.service`. Anggap sebagai `UNKNOWN` mana yang benar sampai diverifikasi langsung.

---

## 📚 REFERENSI

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [Ent ORM Documentation](https://entgo.io/docs/getting-started)
- [Gin Web Framework](https://gin-gonic.com/docs/)
- [ASP.NET Core Documentation](https://docs.microsoft.com/aspnet/core)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [TOTP RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238)

---

*Dokumen ini adalah bagian dari dokumentasi teknis AIValid. Terakhir diperbarui: 10 Februari 2026.*
