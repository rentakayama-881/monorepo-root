# 🗄️ Database Setup

> Panduan setup PostgreSQL (Neon) dan MongoDB (Atlas).

---

## 📊 Database Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         DATABASES                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────┐       ┌──────────────────────┐      │
│  │   Neon PostgreSQL    │       │    MongoDB Atlas     │      │
│  │                      │       │                      │      │
│  │  • Users             │       │  • Replies           │      │
│  │  • Threads           │       │  • Reactions         │      │
│  │  • Categories        │       │  • ChatSessions      │      │
│  │  • Badges            │       │  • ChatMessages      │      │
│  │  • Sessions          │       │  • Wallets           │      │
│  │  • TOTP/Passkeys     │       │  • Transactions      │      │
│  │                      │       │  • Reports           │      │
│  └──────────┬───────────┘       └──────────┬───────────┘      │
│             │                              │                   │
│             ▼                              ▼                   │
│      Backend Gin                   Feature Service             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🐘 Neon PostgreSQL Setup

### Kenapa Neon?

- **Serverless** - Scale to zero, bayar hanya saat digunakan
- **Free tier generous** - 0.5 GB storage, 3 GB transfer
- **Branching** - Database branches seperti Git
- **Auto-suspend** - Hemat biaya saat idle

### Step 1: Create Account

1. Kunjungi [neon.tech](https://neon.tech)
2. Sign up dengan GitHub
3. Create new project

### Step 2: Create Database

```
Project Name: alephdraad
Region: Singapore (closest to Indonesia)
PostgreSQL Version: 16
```

### Step 3: Get Connection String

```
postgres://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/alephdraad?sslmode=require
```

**Format**:
```
postgres://[user]:[password]@[host]/[database]?sslmode=require
```

### Step 4: Configure Backend

```bash
# backend/.env
DATABASE_URL=postgres://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/alephdraad?sslmode=require
```

### Step 5: Run Migrations

```bash
cd backend

# Dengan GORM (auto-migrate)
go run main.go

# Dengan Ent (migration files)
go run -mod=mod entgo.io/ent/cmd/ent generate ./ent/schema
go run cmd/migrate/main.go
```

---

## 🍃 MongoDB Atlas Setup

### Kenapa MongoDB Atlas?

- **Free tier** - 512 MB storage
- **Managed** - Backup, monitoring built-in
- **Global clusters** - Multi-region replication
- **Flexible schema** - Cocok untuk chat/social features

### Step 1: Create Account

1. Kunjungi [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Sign up
3. Create organization & project

### Step 2: Create Cluster

```
Cluster Tier: M0 (Free)
Provider: AWS
Region: Singapore (ap-southeast-1)
Cluster Name: alephdraad-cluster
```

### Step 3: Configure Access

**Database User**:
```
Username: alephdraad_app
Password: [generate secure password]
Role: readWrite on alephdraad database
```

**Network Access**:
```
# Development
IP: 0.0.0.0/0 (allow all - HANYA untuk dev!)

# Production
IP: [VPS IP address]
```

### Step 4: Get Connection String

```
mongodb+srv://alephdraad_app:password@alephdraad-cluster.xxxxx.mongodb.net/alephdraad?retryWrites=true&w=majority
```

### Step 5: Configure Feature Service

```bash
# feature-service/.env
MONGODB_CONNECTION_STRING=mongodb+srv://alephdraad_app:password@cluster.mongodb.net/alephdraad
MONGODB_DATABASE_NAME=alephdraad
```

---

## 🔧 Connection Pooling

### Neon PostgreSQL

Neon menggunakan **PgBouncer** built-in:

```
# Pooled connection (recommended for serverless)
postgres://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/alephdraad?sslmode=require&pgbouncer=true

# Direct connection (for migrations)
postgres://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/alephdraad?sslmode=require
```

### MongoDB

MongoDB Atlas handles pooling automatically. Configure in code:

```csharp
// Feature Service
var settings = MongoClientSettings.FromConnectionString(connectionString);
settings.MaxConnectionPoolSize = 100;
settings.MinConnectionPoolSize = 10;
```

---

## 📊 Database Schema Overview

### PostgreSQL Tables

```sql
-- Core tables
users
threads
categories
badges
user_badges

-- Authentication
sessions
session_locks
totp_secrets
backup_codes
credentials (passkeys)

-- Tracking
device_fingerprints
device_user_mappings
email_verification_tokens
password_reset_tokens
```

### MongoDB Collections

```javascript
// Social features
replies
reactions
reports

// AI Chat
chat_sessions
chat_messages

// Financial
wallets
transactions
token_packages
```

---

## 🔄 Backup Strategy

### Neon (PostgreSQL)

- **Point-in-time recovery** - Included in free tier
- **Branch backup** - Create branch before risky operations

```bash
# Create backup branch via CLI
neonctl branches create --name backup-$(date +%Y%m%d)
```

### MongoDB Atlas

- **Continuous backup** - M10+ tiers
- **Daily snapshots** - Free tier
- **On-demand snapshot** - Via Atlas UI

---

## 🔍 Monitoring

### Neon Dashboard

- Connection count
- Storage usage
- Query performance
- Active branches

### MongoDB Atlas

- Operations/second
- Connection count
- Storage usage
- Slow queries

---

## 🔧 Troubleshooting

### Connection Timeout

```
1. Check network access (IP whitelist)
2. Check SSL configuration
3. Verify connection string format
4. Check database status (maintenance?)
```

### Connection Limit

```
PostgreSQL:
- Free tier: 100 connections
- Use connection pooling

MongoDB:
- Free tier: 500 connections
- Check for connection leaks
```

### Slow Queries

```
1. Add indexes
2. Check query explain plan
3. Optimize data model
4. Consider caching
```

---

## ▶️ Selanjutnya

- [74_ENVIRONMENT_VARIABLES.md](./74_ENVIRONMENT_VARIABLES.md) - Complete env vars
