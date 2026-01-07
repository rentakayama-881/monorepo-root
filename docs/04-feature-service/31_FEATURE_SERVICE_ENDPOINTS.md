# 🛣️ Feature Service Endpoints

> Dokumentasi lengkap API endpoints Feature Service.

---

## 📋 Route Summary

| Prefix | Module | Auth |
|--------|--------|------|
| `/health` | Health check | ❌ No |
| `/api/v1/threads/{id}/replies` | Replies | Varies |
| `/api/v1/threads/{id}/reactions` | Reactions | Varies |
| `/api/v1/wallets/*` | Wallet operations | ✅ Yes |
| `/api/v1/chat/*` | AI Chat | ✅ Yes |
| `/api/v1/reports/*` | Content reports | ✅ Yes |
| `/api/v1/documents/*` | User documents | ✅ Yes |
| `/api/v1/admin/*` | Admin moderation | ✅ Admin |

---

## 💬 Replies Endpoints

### List Replies

```
GET /api/v1/threads/{threadId}/replies
```

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | string | null | Pagination cursor |
| `limit` | int | 20 | Max 100 |
| `sortBy` | string | "createdAt" | Sort field |
| `sortOrder` | string | "desc" | "asc" or "desc" |

**Response**:
```json
{
  "success": true,
  "data": {
    "replies": [
      {
        "id": "rpl_01HN5...",
        "content": "Great post!",
        "userId": 123,
        "username": "johndoe",
        "parentReplyId": null,
        "depth": 0,
        "isDeleted": false,
        "createdAt": "2026-01-07T10:00:00Z",
        "updatedAt": "2026-01-07T10:00:00Z"
      }
    ],
    "cursor": "next_cursor_value",
    "hasMore": true
  }
}
```

---

### Create Reply

```
POST /api/v1/threads/{threadId}/replies
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "content": "Thanks for sharing!",
  "parentReplyId": null
}
```

**Validation**:
- `content`: 1-2000 characters
- `parentReplyId`: optional, must exist if provided
- Max depth: 3 levels

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "rpl_01HN5...",
    "content": "Thanks for sharing!",
    "userId": 123,
    "username": "johndoe",
    "parentReplyId": null,
    "depth": 0,
    "createdAt": "2026-01-07T10:00:00Z"
  }
}
```

---

### Update Reply

```
PUT /api/v1/threads/{threadId}/replies/{replyId}
```

**🔒 Auth Required** (must be author)

**Request Body**:
```json
{
  "content": "Updated content"
}
```

---

### Delete Reply

```
DELETE /api/v1/threads/{threadId}/replies/{replyId}
```

**🔒 Auth Required** (must be author or admin)

Soft delete - sets `isDeleted: true`, keeps data.

---

## 👍 Reactions Endpoints

### Get Reaction Summary

```
GET /api/v1/threads/{threadId}/reactions/summary
```

**Response**:
```json
{
  "success": true,
  "data": {
    "like": 42,
    "love": 15,
    "fire": 8,
    "laugh": 5,
    "sad": 2,
    "total": 72
  }
}
```

---

### Get My Reaction

```
GET /api/v1/threads/{threadId}/reactions/me
```

**🔒 Auth Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "reactionType": "like"
  }
}
```

---

### Add Reaction

```
POST /api/v1/threads/{threadId}/reactions
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "reactionType": "like"
}
```

**Valid Types**: `like`, `love`, `fire`, `laugh`, `sad`

---

### Remove Reaction

```
DELETE /api/v1/threads/{threadId}/reactions
```

**🔒 Auth Required**

Removes user's reaction from thread.

---

## 💰 Wallet Endpoints

### Get My Wallet

```
GET /api/v1/wallets/me
```

**🔒 Auth Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "wal_01HN5...",
    "userId": 123,
    "balance": 150000,
    "tokenBalance": 10000,
    "createdAt": "2026-01-07T10:00:00Z"
  }
}
```

---

### Get Balance

```
GET /api/v1/wallets/balance
```

**🔒 Auth Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "balance": 150000,
    "currency": "IDR"
  }
}
```

---

### Get Transactions

```
GET /api/v1/wallets/transactions
```

**🔒 Auth Required**

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | string | null | Pagination |
| `limit` | int | 20 | Max 100 |
| `type` | string | null | Filter by type |

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn_01HN5...",
        "type": "token_purchase",
        "amount": 50000,
        "description": "Pembelian 10000 tokens",
        "createdAt": "2026-01-07T10:00:00Z"
      }
    ],
    "cursor": "...",
    "hasMore": true
  }
}
```

---

## 🤖 AI Chat Endpoints

### Get Token Balance

```
GET /api/v1/chat/tokens/balance
```

**🔒 Auth Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "tokens": 10000,
    "freeTokensRemaining": 500
  }
}
```

---

### Get Token Packages

```
GET /api/v1/chat/tokens/packages
```

**Response**:
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "pkg_starter",
        "name": "Starter",
        "tokenAmount": 10000,
        "priceIdr": 50000,
        "bonusTokens": 500,
        "description": "Paket untuk pemula"
      },
      {
        "id": "pkg_pro",
        "name": "Pro",
        "tokenAmount": 50000,
        "priceIdr": 200000,
        "bonusTokens": 5000,
        "description": "Paket untuk pengguna aktif"
      }
    ]
  }
}
```

---

### Purchase Tokens

```
POST /api/v1/chat/tokens/purchase
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "packageId": "pkg_starter"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_01HN5...",
    "tokensAdded": 10500,
    "newBalance": 20500
  }
}
```

---

### List Chat Sessions

```
GET /api/v1/chat/sessions
```

**🔒 Auth Required**

**Response**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "cht_01HN5...",
        "title": "Diskusi JWT",
        "serviceType": "huggingface",
        "model": null,
        "messageCount": 12,
        "lastMessageAt": "2026-01-07T10:00:00Z",
        "createdAt": "2026-01-07T09:00:00Z"
      }
    ],
    "cursor": "...",
    "hasMore": false
  }
}
```

---

### Create Chat Session

```
POST /api/v1/chat/sessions
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "title": "New Chat",
  "serviceType": "huggingface",
  "model": null
}
```

**Service Types**:
- `huggingface` - Free tier (Llama 3.3 70B)
- `external_llm` - Paid (GPT-4o, Claude, etc.)

---

### Get Session Detail

```
GET /api/v1/chat/sessions/{sessionId}
```

**🔒 Auth Required**

Returns session with all messages.

---

### Send Message

```
POST /api/v1/chat/sessions/{sessionId}/messages
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "content": "Jelaskan tentang JWT authentication"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "messageId": "msg_01HN5...",
    "content": "JWT (JSON Web Token) adalah standar terbuka...",
    "tokensUsed": 225,
    "remainingBalance": 9775
  }
}
```

---

## 🚨 Report Endpoints

### Get Report Reasons

```
GET /api/v1/reports/reasons
```

**Response**:
```json
{
  "success": true,
  "data": {
    "reasons": [
      { "code": "spam", "label": "Spam" },
      { "code": "harassment", "label": "Pelecehan" },
      { "code": "hate_speech", "label": "Ujaran Kebencian" },
      { "code": "misinformation", "label": "Informasi Palsu" },
      { "code": "other", "label": "Lainnya" }
    ]
  }
}
```

---

### Submit Report

```
POST /api/v1/reports
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "targetType": "thread",
  "targetId": "123",
  "reason": "spam",
  "details": "This is clearly promotional content"
}
```

---

## 📄 Document Endpoints

### List Documents

```
GET /api/v1/documents
```

**🔒 Auth Required**

---

### Upload Document

```
POST /api/v1/documents
```

**🔒 Auth Required**

Multipart form upload.

---

### Delete Document

```
DELETE /api/v1/documents/{documentId}
```

**🔒 Auth Required** (must be owner)

---

## 👑 Admin Endpoints

### Get Reports

```
GET /api/v1/admin/reports
```

**🔒 Admin Required**

---

### Resolve Report

```
PUT /api/v1/admin/reports/{reportId}
```

**🔒 Admin Required**

---

### Warn User

```
POST /api/v1/admin/users/{userId}/warnings
```

**🔒 Admin Required**

---

### Ban Device

```
POST /api/v1/admin/devices/ban
```

**🔒 Admin Required**

---

## ▶️ Selanjutnya

- [32_FEATURE_SERVICE_SERVICES.md](./32_FEATURE_SERVICE_SERVICES.md) - Service layer
- [33_FEATURE_SERVICE_AI_INTEGRATION.md](./33_FEATURE_SERVICE_AI_INTEGRATION.md) - AI integration
