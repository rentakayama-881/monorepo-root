# API Reference

Base URL: `https://your-backend-url.com/api`

All endpoints return JSON. Protected endpoints require `Authorization: Bearer <token>` header.

---

## Authentication

### POST /auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "message": "Registrasi berhasil. Silakan cek email untuk verifikasi."
}
```

**Errors:**
| Code | Message |
|------|---------|
| AUTH001 | Email sudah terdaftar |
| VAL001 | Email tidak valid |
| VAL002 | Password terlalu pendek (min 8 karakter) |

---

### POST /auth/login

Login and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "display_name": "John Doe"
  }
}
```

**Errors:**
| Code | Message |
|------|---------|
| AUTH002 | Password salah |
| AUTH003 | Email belum diverifikasi |
| USER001 | User tidak ditemukan |

---

### POST /auth/verify/request

Request email verification (resend).

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Email verifikasi telah dikirim"
}
```

---

### POST /auth/verify/confirm

Confirm email verification with token.

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response (200):**
```json
{
  "message": "Email berhasil diverifikasi"
}
```

**Errors:**
| Code | Message |
|------|---------|
| AUTH006 | Token tidak valid |
| AUTH007 | Token sudah kadaluarsa |
| AUTH008 | Email sudah diverifikasi |

---

### POST /auth/username 🔒

Set username (first time only). Requires authentication.

**Request:**
```json
{
  "username": "johndoe"
}
```

**Response (200):**
```json
{
  "message": "Username berhasil diset"
}
```

**Errors:**
| Code | Message |
|------|---------|
| USER002 | Username sudah digunakan |
| USER003 | User sudah memiliki username |
| VAL003 | Username tidak valid |

---

## Account

### GET /account/me 🔒

Get current user's full account info.

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "display_name": "John Doe",
  "bio": "Software developer",
  "avatar_url": "/static/avatars/1.jpg",
  "wallet_address": "0x...",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

### PUT /account 🔒

Update account info.

**Request:**
```json
{
  "display_name": "John D.",
  "bio": "Updated bio",
  "wallet_address": "0x..."
}
```

**Response (200):**
```json
{
  "message": "Account updated successfully"
}
```

---

### POST /account/change-username 🔒

Change username (paid, requires wallet signature).

**Request:**
```json
{
  "username": "newusername",
  "signature": "0x..."
}
```

---

### PUT /account/avatar 🔒

Upload avatar image.

**Content-Type:** `multipart/form-data`

**Form field:** `avatar` (image file, max 5MB)

**Response (200):**
```json
{
  "avatar_url": "/static/avatars/1.jpg"
}
```

---

## User

### GET /user/me 🔒

Get current user info (lighter than /account/me).

**Response (200):**
```json
{
  "id": 1,
  "username": "johndoe",
  "display_name": "John Doe"
}
```

---

### GET /user/:username

Get public user profile.

**Response (200):**
```json
{
  "id": 1,
  "username": "johndoe",
  "display_name": "John Doe",
  "bio": "Software developer",
  "avatar_url": "/static/avatars/1.jpg",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

### GET /user/:username/threads

Get user's public threads.

**Query params:**
- `page` (default: 1)
- `limit` (default: 10)

**Response (200):**
```json
{
  "threads": [...],
  "total": 25,
  "page": 1,
  "limit": 10
}
```

---

### GET /user/:username/badges

Get user's badges.

**Response (200):**
```json
{
  "badges": [
    {
      "id": 1,
      "name": "Early Adopter",
      "description": "One of the first users",
      "image_url": "/static/badges/early.png"
    }
  ]
}
```

---

## Threads

### GET /threads/categories

Get all categories.

**Response (200):**
```json
{
  "categories": [
    {
      "id": 1,
      "name": "Development",
      "slug": "development",
      "description": "Programming discussions"
    }
  ]
}
```

---

### GET /threads/category/:slug

Get threads by category.

**Query params:**
- `page` (default: 1)
- `limit` (default: 10)

**Response (200):**
```json
{
  "threads": [...],
  "total": 50,
  "page": 1,
  "limit": 10,
  "category": {...}
}
```

---

### GET /threads/latest

Get latest threads across all categories.

**Query params:**
- `limit` (default: 10)

**Response (200):**
```json
{
  "threads": [
    {
      "id": 1,
      "title": "Thread title",
      "content": "Preview...",
      "author": {...},
      "category": {...},
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /threads/:id/public

Get public thread detail (no auth required).

**Response (200):**
```json
{
  "id": 1,
  "title": "Thread title",
  "content": "Full content...",
  "author": {...},
  "category": {...},
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

---

### GET /threads/:id 🔒

Get thread detail (authenticated, may include additional data).

---

### POST /threads 🔒

Create new thread.

**Request:**
```json
{
  "title": "My Thread Title",
  "content": "Thread content...",
  "category_id": 1
}
```

**Response (201):**
```json
{
  "id": 1,
  "title": "My Thread Title",
  "message": "Thread created successfully"
}
```

**Errors:**
| Code | Message |
|------|---------|
| THREAD001 | Kategori tidak ditemukan |
| VAL001 | Title wajib diisi |
| VAL002 | Content wajib diisi |

---

### GET /threads/me 🔒

Get current user's threads.

**Response (200):**
```json
{
  "threads": [...]
}
```

---

### PUT /threads/:id 🔒

Update own thread.

**Request:**
```json
{
  "title": "Updated title",
  "content": "Updated content"
}
```

**Errors:**
| Code | Message |
|------|---------|
| THREAD002 | Thread tidak ditemukan |
| THREAD003 | Anda bukan pemilik thread ini |

---

## Orders (Escrow)

### POST /orders

Create new order and get signature for escrow deployment.

**Request:**
```json
{
  "thread_id": 1,
  "seller_id": 2,
  "amount": "100000000000000000",
  "token_address": "0x...",
  "buyer_wallet": "0x..."
}
```

**Response (201):**
```json
{
  "order_id": 1,
  "signature": "0x...",
  "deadline": 1705312800
}
```

---

### POST /orders/:orderId/attach

Attach deployed escrow address to order.

**Request:**
```json
{
  "escrow_address": "0x...",
  "tx_hash": "0x..."
}
```

**Response (200):**
```json
{
  "message": "Escrow attached successfully"
}
```

---

### GET /orders 🔒

List user's orders (as buyer or seller).

**Query params:**
- `role` (buyer|seller, optional)
- `status` (pending|funded|delivered|disputed|resolved|refunded, optional)
- `page` (default: 1)
- `limit` (default: 10)

**Response (200):**
```json
{
  "orders": [...],
  "total": 15,
  "page": 1,
  "limit": 10
}
```

---

### GET /orders/:orderId

Get order details.

**Response (200):**
```json
{
  "id": 1,
  "status": "funded",
  "amount": "100000000000000000",
  "escrow_address": "0x...",
  "buyer": {...},
  "seller": {...},
  "thread": {...},
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

## Disputes

### GET /disputes/escrow/:escrowAddress 🔒

Get dispute details by escrow address.

**Response (200):**
```json
{
  "id": 1,
  "escrow_address": "0x...",
  "reason": "Item not delivered",
  "status": "pending",
  "votes": [],
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

### POST /disputes/escrow/:escrowAddress/arbitrate 🔒

Submit arbitration vote (arbitrators only).

**Request:**
```json
{
  "ruling": "refund",
  "reason": "Seller failed to deliver"
}
```

---

## Badges

### GET /badges/:id

Get badge details.

**Response (200):**
```json
{
  "id": 1,
  "name": "Early Adopter",
  "description": "One of the first users",
  "image_url": "/static/badges/early.png",
  "criteria": "Join before 2024"
}
```

---

## RAG (AI Search)

### GET /rag/ask

Search threads using AI.

**Query params:**
- `q` - Search query

**Response (200):**
```json
{
  "results": [
    {
      "thread_id": 1,
      "title": "Thread title",
      "snippet": "Relevant excerpt...",
      "score": 0.85
    }
  ]
}
```

---

### GET /rag/answer

Get AI-generated answer.

**Query params:**
- `q` - Question

**Response (200):**
```json
{
  "answer": "Based on the threads...",
  "sources": [...]
}
```

---

### POST /rag/index-thread/:id

Index thread for RAG (chunks + embeddings).

**Response (200):**
```json
{
  "message": "Thread indexed successfully",
  "chunks_created": 5
}
```

---

## Utilities

### GET /health

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

### GET /chainlink/rate

Get current ETH/USD rate from Chainlink.

**Response (200):**
```json
{
  "rate": "3500.50",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

---

## Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "AUTH001",
    "message": "Email sudah terdaftar"
  }
}
```

HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Rate Limiting

- Login/Register: 5 requests per minute per IP
- Other endpoints: 60 requests per minute per IP

Rate limit response:
```json
{
  "error": {
    "code": "RATE001",
    "message": "Too many requests. Please try again later."
  }
}
```

Headers included:
- `X-RateLimit-Limit`: Max requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp
