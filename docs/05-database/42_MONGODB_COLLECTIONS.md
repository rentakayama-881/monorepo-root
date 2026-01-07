# 🍃 MongoDB Collections

> Dokumentasi detail collections MongoDB di Feature Service.

---

## 🎯 Overview

Feature Service menggunakan MongoDB untuk menyimpan data yang:
- High write throughput (replies, reactions)
- Flexible schema (chat messages)
- No complex joins needed

---

## 💬 Replies Collection

```javascript
// Collection: replies
{
  "_id": "rpl_01HN5ABCD1234",  // Custom ID dengan prefix
  "threadId": "123",           // Reference ke PostgreSQL threads.id
  "content": "Great post! Thanks for sharing.",
  "userId": 456,               // Reference ke PostgreSQL users.id
  "username": "johndoe",       // Denormalized untuk display
  
  // Nested reply support
  "parentReplyId": null,       // null = top-level reply
  "depth": 0,                  // 0, 1, 2, 3 (max depth)
  
  // Status
  "isDeleted": false,          // Soft delete
  "deletedAt": null,
  "deletedBy": null,           // userId atau "admin"
  
  // Timestamps
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:00:00Z")
}

// Indexes
db.replies.createIndex({ "threadId": 1, "createdAt": -1 })
db.replies.createIndex({ "userId": 1, "createdAt": -1 })
db.replies.createIndex({ "parentReplyId": 1 })
db.replies.createIndex({ "threadId": 1, "isDeleted": 1 })
```

### C# Model

```csharp
public class Reply
{
    [BsonId]
    public string Id { get; set; } = default!;
    
    public string ThreadId { get; set; } = default!;
    public string Content { get; set; } = default!;
    public int UserId { get; set; }
    public string Username { get; set; } = default!;
    
    public string? ParentReplyId { get; set; }
    public int Depth { get; set; }
    
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

---

## 👍 Reactions Collection

```javascript
// Collection: reactions
{
  "_id": "rct_01HN5EFGH5678",
  "threadId": "123",
  "userId": 456,
  "type": "like",             // like, love, fire, laugh, sad
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

// Indexes
// Unique per user per thread
db.reactions.createIndex({ "threadId": 1, "userId": 1 }, { unique: true })
db.reactions.createIndex({ "threadId": 1, "type": 1 })
```

### C# Model

```csharp
public class Reaction
{
    [BsonId]
    public string Id { get; set; } = default!;
    
    public string ThreadId { get; set; } = default!;
    public int UserId { get; set; }
    public string Type { get; set; } = default!;
    
    public DateTime CreatedAt { get; set; }
}
```

---

## 💰 Wallets Collection

```javascript
// Collection: wallets
{
  "_id": "wal_01HN5IJKL9012",
  "userId": 456,               // Unique per user
  
  // Balances
  "balance": 150000,           // IDR balance
  "tokenBalance": 10500,       // AI tokens
  
  // Stats
  "totalDeposited": 200000,
  "totalWithdrawn": 50000,
  "totalTokensPurchased": 21000,
  "totalTokensUsed": 10500,
  
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:30:00Z")
}

// Indexes
db.wallets.createIndex({ "userId": 1 }, { unique: true })
```

### C# Model

```csharp
public class Wallet
{
    [BsonId]
    public string Id { get; set; } = default!;
    
    public int UserId { get; set; }
    
    public decimal Balance { get; set; }
    public int TokenBalance { get; set; }
    
    public decimal TotalDeposited { get; set; }
    public decimal TotalWithdrawn { get; set; }
    public int TotalTokensPurchased { get; set; }
    public int TotalTokensUsed { get; set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

---

## 💸 Transactions Collection

```javascript
// Collection: transactions
{
  "_id": "txn_01HN5MNOP3456",
  "userId": 456,
  "walletId": "wal_01HN5IJKL9012",
  
  // Transaction details
  "type": "token_purchase",    // See types below
  "amount": 50000,             // IDR amount (signed)
  "tokenAmount": 10500,        // Token amount if applicable
  
  "description": "Pembelian paket Starter",
  "referenceId": "pkg_starter", // Related entity ID
  "referenceType": "token_package",
  
  // Status for async transactions
  "status": "completed",       // pending, completed, failed, refunded
  
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "completedAt": ISODate("2026-01-07T10:00:05Z")
}

// Transaction types:
// - deposit: Adding IDR balance
// - withdrawal: Removing IDR balance
// - token_purchase: Buying AI tokens
// - token_usage: Using AI tokens (negative tokenAmount)
// - transfer_in: Received from another user
// - transfer_out: Sent to another user
// - refund: Refund for failed transaction

// Indexes
db.transactions.createIndex({ "userId": 1, "createdAt": -1 })
db.transactions.createIndex({ "walletId": 1, "createdAt": -1 })
db.transactions.createIndex({ "type": 1, "createdAt": -1 })
db.transactions.createIndex({ "status": 1 }) // For pending transactions
```

---

## 🤖 Chat Sessions Collection

```javascript
// Collection: chat_sessions
{
  "_id": "cht_01HN5QRST7890",
  "userId": 456,
  
  "title": "Diskusi tentang JWT",
  "serviceType": "huggingface",  // huggingface, external_llm
  "model": null,                 // null for huggingface, model ID for external
  
  // Stats
  "messageCount": 12,
  "totalTokensUsed": 2450,
  
  "lastMessageAt": ISODate("2026-01-07T10:30:00Z"),
  "createdAt": ISODate("2026-01-07T09:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:30:00Z"),
  
  // Optional: archived/deleted
  "isArchived": false,
  "archivedAt": null
}

// Indexes
db.chat_sessions.createIndex({ "userId": 1, "createdAt": -1 })
db.chat_sessions.createIndex({ "userId": 1, "lastMessageAt": -1 })
db.chat_sessions.createIndex({ "userId": 1, "isArchived": 1 })
```

---

## 💬 Chat Messages Collection

```javascript
// Collection: chat_messages
{
  "_id": "msg_01HN5UVWX1234",
  "sessionId": "cht_01HN5QRST7890",
  
  "role": "user",              // user, assistant, system
  "content": "Jelaskan tentang JWT dalam 3 paragraf",
  
  // For assistant messages
  "tokensUsed": 0,             // 0 for user messages
  "model": null,               // Model used for this response
  "processingTime": null,      // Milliseconds
  
  "createdAt": ISODate("2026-01-07T10:00:00Z")
}

// Indexes
db.chat_messages.createIndex({ "sessionId": 1, "createdAt": 1 })
```

---

## 📄 Documents Collection

```javascript
// Collection: documents
{
  "_id": "doc_01HN5YZAB5678",
  "userId": 456,
  
  // File info
  "title": "Resume 2026",
  "fileName": "resume_johndoe_2026.pdf",
  "originalName": "My Resume.pdf",
  "mimeType": "application/pdf",
  "size": 125000,              // bytes
  
  // Storage
  "storagePath": "documents/456/abc123.pdf",
  "storageProvider": "local",  // local, s3, gcs
  
  // Visibility
  "isPublic": false,
  "sharedWith": [],            // Array of userIds
  
  // Metadata
  "category": "resume",
  "tags": ["work", "2026"],
  
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:00:00Z")
}

// Indexes
db.documents.createIndex({ "userId": 1, "createdAt": -1 })
db.documents.createIndex({ "userId": 1, "category": 1 })
db.documents.createIndex({ "isPublic": 1 })
```

---

## 🚨 Reports Collection

```javascript
// Collection: reports
{
  "_id": "rpt_01HN5CDEF9012",
  
  // Reporter
  "reporterId": 456,
  "reporterUsername": "johndoe",
  
  // Target
  "targetType": "thread",      // thread, reply, user
  "targetId": "123",
  "targetSnapshot": {          // Snapshot of content at report time
    "title": "Original thread title",
    "content": "..."
  },
  
  // Report details
  "reason": "spam",
  "details": "This is promotional content for external service",
  
  // Status
  "status": "pending",         // pending, reviewed, resolved, dismissed
  
  // Resolution
  "resolvedBy": null,          // Admin ID
  "resolvedAt": null,
  "resolution": null,          // Action taken
  "resolutionNote": null,
  
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "updatedAt": ISODate("2026-01-07T10:00:00Z")
}

// Indexes
db.reports.createIndex({ "status": 1, "createdAt": -1 })
db.reports.createIndex({ "targetType": 1, "targetId": 1 })
db.reports.createIndex({ "reporterId": 1 })
```

---

## ⚠️ User Warnings Collection

```javascript
// Collection: user_warnings
{
  "_id": "wrn_01HN5GHIJ3456",
  "userId": 789,
  "adminId": 1,
  
  "reason": "Spam berulang di beberapa thread",
  "severity": "warning",       // notice, warning, final_warning
  "relatedReportId": "rpt_01HN5CDEF9012",
  
  // Acknowledgment
  "isAcknowledged": false,
  "acknowledgedAt": null,
  
  "createdAt": ISODate("2026-01-07T10:00:00Z"),
  "expiresAt": ISODate("2026-04-07T10:00:00Z")  // Warnings expire after 90 days
}

// Indexes
db.user_warnings.createIndex({ "userId": 1, "createdAt": -1 })
db.user_warnings.createIndex({ "userId": 1, "severity": 1 })
db.user_warnings.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 }) // TTL index
```

---

## 🚫 Device Bans Collection

```javascript
// Collection: device_bans
{
  "_id": "ban_01HN5KLMN7890",
  
  "fingerprint": "abc123def456ghi789",
  "reason": "Multiple spam accounts created from this device",
  
  "bannedBy": 1,               // Admin ID
  "bannedAt": ISODate("2026-01-07T10:00:00Z"),
  
  "expiresAt": null,           // null = permanent
  
  // For audit
  "relatedUserIds": [101, 102, 103],
  "relatedReportIds": ["rpt_01...", "rpt_02..."]
}

// Indexes
db.device_bans.createIndex({ "fingerprint": 1 }, { unique: true })
db.device_bans.createIndex({ "expiresAt": 1 })
```

---

## 🔧 MongoDB Context

```csharp
// Infrastructure/MongoDB/MongoDbContext.cs
public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(MongoDbSettings settings)
    {
        var client = new MongoClient(settings.ConnectionString);
        _database = client.GetDatabase(settings.DatabaseName);
    }

    // Collections
    public IMongoCollection<Reply> Replies => 
        _database.GetCollection<Reply>("replies");
    
    public IMongoCollection<Reaction> Reactions => 
        _database.GetCollection<Reaction>("reactions");
    
    public IMongoCollection<Wallet> Wallets => 
        _database.GetCollection<Wallet>("wallets");
    
    public IMongoCollection<Transaction> Transactions => 
        _database.GetCollection<Transaction>("transactions");
    
    public IMongoCollection<ChatSession> ChatSessions => 
        _database.GetCollection<ChatSession>("chat_sessions");
    
    public IMongoCollection<ChatMessage> ChatMessages => 
        _database.GetCollection<ChatMessage>("chat_messages");
    
    public IMongoCollection<Document> Documents => 
        _database.GetCollection<Document>("documents");
    
    public IMongoCollection<Report> Reports => 
        _database.GetCollection<Report>("reports");
    
    public IMongoCollection<UserWarning> UserWarnings => 
        _database.GetCollection<UserWarning>("user_warnings");
    
    public IMongoCollection<DeviceBan> DeviceBans => 
        _database.GetCollection<DeviceBan>("device_bans");
}
```

---

## ▶️ Selanjutnya

- [43_DATABASE_MIGRATIONS.md](./43_DATABASE_MIGRATIONS.md) - Migration strategies
- [../06-security/50_SECURITY_OVERVIEW.md](../06-security/50_SECURITY_OVERVIEW.md) - Security
