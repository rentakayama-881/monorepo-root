# 🗄️ Database Overview

> Dokumentasi arsitektur database Alephdraad.

---

## 🎯 Dual Database Architecture

Alephdraad menggunakan **dua database** yang berbeda untuk keperluan berbeda:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ALEPHDRAAD SYSTEM                            │
└─────────────────────────────────────────────────────────────────────┘
         │                                          │
         │                                          │
         ▼                                          ▼
┌─────────────────────┐                  ┌─────────────────────────┐
│    PostgreSQL       │                  │       MongoDB           │
│    (via Neon)       │                  │    (via MongoDB Atlas)  │
│                     │                  │                         │
│  Backend Gin        │                  │  Feature Service        │
│  ─────────────      │                  │  ──────────────         │
│  • Users            │                  │  • Replies              │
│  • Threads          │                  │  • Reactions            │
│  • Categories       │                  │  • Wallets              │
│  • Sessions         │                  │  • Transactions         │
│  • Credentials      │                  │  • Chat Sessions        │
│  • Badges           │                  │  • Chat Messages        │
│  • Admin            │                  │  • Documents            │
│                     │                  │  • Reports              │
│  SQL, ACID          │                  │  • Warnings             │
│  Strong schema      │                  │  • Device Bans          │
│                     │                  │                         │
│                     │                  │  NoSQL, Flexible        │
│                     │                  │  High write throughput  │
└─────────────────────┘                  └─────────────────────────┘
```

---

## 📊 Mengapa Dual Database?

| Aspek | PostgreSQL | MongoDB |
|-------|------------|---------|
| **Data Model** | Relational | Document |
| **Schema** | Fixed, migrations | Flexible |
| **Transactions** | Full ACID | Limited |
| **Scaling** | Vertical | Horizontal |
| **Query** | SQL | BSON/JSON |
| **Best For** | Core entities with relations | High-volume activity data |

### Mengapa PostgreSQL untuk Core?

- **Users** memerlukan referential integrity
- **Threads** linked ke categories dan users
- **Sessions** perlu consistent state
- **Credentials** (passkeys) harus secure dan relational

### Mengapa MongoDB untuk Features?

- **Replies** bisa sangat banyak, write-heavy
- **Reactions** high throughput, simple structure
- **Chat Messages** rapidly growing, no complex joins
- **Flexible schema** untuk iterasi cepat

---

## 🐘 PostgreSQL (Neon)

### Connection

```go
// backend/database/db.go
import (
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

func InitDB() {
    dsn := os.Getenv("DATABASE_URL")
    DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
        Logger: logger.Default.LogMode(logger.Info),
    })
    if err != nil {
        log.Fatal("Failed to connect to database")
    }
}
```

### Environment Variable

```bash
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/alephdraad?sslmode=require
```

### Tables

```
┌──────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Tables                          │
└──────────────────────────────────────────────────────────────────┘

users
├── id (PK, serial)
├── email (unique)
├── username (unique)
├── full_name
├── password_hash
├── avatar_url
├── is_verified
├── is_locked
├── totp_enabled
├── totp_secret
├── created_at
└── updated_at

threads
├── id (PK, serial)
├── title
├── summary
├── content_json (jsonb)
├── category_id (FK)
├── author_id (FK → users)
├── is_deleted
├── created_at
└── updated_at

categories
├── id (PK, serial)
├── name
├── slug (unique)
├── description
├── color
├── icon
├── order_index
└── created_at

sessions
├── id (PK, uuid)
├── user_id (FK)
├── device_fingerprint
├── ip_address
├── user_agent
├── is_revoked
├── expires_at
├── created_at
└── last_active_at

credentials (passkeys)
├── id (PK)
├── user_id (FK)
├── credential_id (unique)
├── public_key
├── attestation_type
├── name
├── created_at
└── last_used_at

badges
├── id (PK, serial)
├── name
├── description
├── icon_url
├── color
├── rarity
└── created_at

user_badges
├── id (PK)
├── user_id (FK)
├── badge_id (FK)
├── is_primary
├── awarded_at
└── awarded_by

backup_codes
├── id (PK)
├── user_id (FK)
├── code_hash
├── is_used
├── created_at
└── used_at

email_verification_tokens
├── id (PK)
├── user_id (FK)
├── token
├── expires_at
└── created_at

password_reset_tokens
├── id (PK)
├── user_id (FK)
├── token
├── expires_at
└── created_at

admins
├── id (PK)
├── email (unique)
├── username
├── password_hash
├── is_active
├── created_at
└── last_login_at
```

---

## 🍃 MongoDB

### Connection

```csharp
// feature-service/src/FeatureService.Api/Infrastructure/MongoDB/MongoDbContext.cs
public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(MongoDbSettings settings)
    {
        var client = new MongoClient(settings.ConnectionString);
        _database = client.GetDatabase(settings.DatabaseName);
    }

    public IMongoCollection<Reply> Replies => 
        _database.GetCollection<Reply>("replies");
    
    public IMongoCollection<Reaction> Reactions => 
        _database.GetCollection<Reaction>("reactions");
    
    // ... other collections
}
```

### Environment Variables

```bash
MONGODB__CONNECTIONSTRING=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true
MONGODB__DATABASENAME=alephdraad_features
```

### Collections

```
┌──────────────────────────────────────────────────────────────────┐
│                      MongoDB Collections                          │
└──────────────────────────────────────────────────────────────────┘

replies
{
  "_id": "rpl_01HN5...",
  "threadId": "123",
  "content": "Great post!",
  "userId": 456,
  "username": "johndoe",
  "parentReplyId": null,
  "depth": 0,
  "isDeleted": false,
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:00:00Z")
}

reactions
{
  "_id": "rct_01HN5...",
  "threadId": "123",
  "userId": 456,
  "type": "like",
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

wallets
{
  "_id": "wal_01HN5...",
  "userId": 456,
  "balance": 150000,
  "tokenBalance": 10000,
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:00:00Z")
}

transactions
{
  "_id": "txn_01HN5...",
  "userId": 456,
  "walletId": "wal_01HN5...",
  "type": "token_purchase",
  "amount": 50000,
  "tokenAmount": 10500,
  "description": "Pembelian paket Starter",
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

chat_sessions
{
  "_id": "cht_01HN5...",
  "userId": 456,
  "title": "Diskusi JWT",
  "serviceType": "huggingface",
  "model": null,
  "messageCount": 12,
  "lastMessageAt": ISODate("2026-01-07T10:00:00Z"),
  "createdAt": ISODate("2026-01-07T09:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:00:00Z")
}

chat_messages
{
  "_id": "msg_01HN5...",
  "sessionId": "cht_01HN5...",
  "role": "user",
  "content": "Jelaskan tentang JWT",
  "tokensUsed": 0,
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

documents
{
  "_id": "doc_01HN5...",
  "userId": 456,
  "title": "Resume.pdf",
  "fileName": "abc123_resume.pdf",
  "mimeType": "application/pdf",
  "size": 125000,
  "isPublic": false,
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

reports
{
  "_id": "rpt_01HN5...",
  "reporterId": 456,
  "targetType": "thread",
  "targetId": "123",
  "reason": "spam",
  "details": "Promotional content",
  "status": "pending",
  "resolvedBy": null,
  "resolvedAt": null,
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

user_warnings
{
  "_id": "wrn_01HN5...",
  "userId": 789,
  "adminId": 1,
  "reason": "Spam berulang",
  "severity": "warning",
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

device_bans
{
  "_id": "ban_01HN5...",
  "fingerprint": "abc123def456",
  "reason": "Multiple spam accounts",
  "bannedBy": 1,
  "expiresAt": null,
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}
```

---

## 🔗 Cross-Database References

Karena data tersebar di dua database, referensi dilakukan via **ID only** (tidak foreign key):

```
PostgreSQL                    MongoDB
──────────────────────────   ──────────────────────────
users.id = 456          ←──→  replies.userId = 456
                              reactions.userId = 456
                              wallets.userId = 456
                              chat_sessions.userId = 456

threads.id = 123        ←──→  replies.threadId = "123"
                              reactions.threadId = "123"
```

**Important**: Tidak ada automatic cascade delete. Harus handle manual di application layer.

---

## 📐 Indexes

### PostgreSQL

```sql
-- Users
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- Threads
CREATE INDEX idx_threads_category ON threads(category_id);
CREATE INDEX idx_threads_author ON threads(author_id);
CREATE INDEX idx_threads_created ON threads(created_at DESC);

-- Sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### MongoDB

```javascript
// Replies
db.replies.createIndex({ threadId: 1, createdAt: -1 })
db.replies.createIndex({ userId: 1 })
db.replies.createIndex({ parentReplyId: 1 })

// Reactions
db.reactions.createIndex({ threadId: 1, type: 1 })
db.reactions.createIndex({ threadId: 1, userId: 1 }, { unique: true })

// Chat
db.chat_sessions.createIndex({ userId: 1, createdAt: -1 })
db.chat_messages.createIndex({ sessionId: 1, createdAt: 1 })

// Wallets
db.wallets.createIndex({ userId: 1 }, { unique: true })
db.transactions.createIndex({ userId: 1, createdAt: -1 })
```

---

## ▶️ Selanjutnya

- [41_POSTGRESQL_MODELS.md](./41_POSTGRESQL_MODELS.md) - PostgreSQL models detail
- [42_MONGODB_COLLECTIONS.md](./42_MONGODB_COLLECTIONS.md) - MongoDB collections detail
- [43_DATABASE_MIGRATIONS.md](./43_DATABASE_MIGRATIONS.md) - Migration strategies
