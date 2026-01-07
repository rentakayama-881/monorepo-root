# 🛣️ Backend Gin Routes

> Dokumentasi lengkap semua HTTP endpoints di Backend Gin.

---

## 📋 Route Summary

| Prefix | Module | Auth |
|--------|--------|------|
| `/api/health` | Health check | ❌ No |
| `/api/auth/*` | Authentication | Varies |
| `/api/account/*` | Account management | ✅ Yes |
| `/api/user/*` | User profiles | Varies |
| `/api/threads/*` | Thread CRUD | Varies |
| `/api/badges/*` | Badge info | ❌ No |
| `/api/rag/*` | AI Search | ❌ No |
| `/admin/*` | Admin panel | ✅ Admin |

---

## 🏥 Health Check

```
GET /api/health
```

**Response**:
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

## 🔐 Authentication Routes (`/api/auth`)

### Register

```
POST /api/auth/register
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "johndoe",
  "fullName": "John Doe",
  "deviceFingerprint": "optional_device_id"
}
```

**Response** (201):
```json
{
  "message": "Registrasi berhasil. Silakan verifikasi email Anda.",
  "verification": {
    "required": true
  }
}
```

**Rate Limit**: 6 requests/minute

---

### Login

```
POST /api/auth/login
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "deviceFingerprint": "optional_device_id"
}
```

**Response** (200) - No 2FA:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

**Response** (200) - 2FA Required:
```json
{
  "requires2FA": true,
  "tempToken": "temp_token_for_2fa",
  "methods": ["totp", "passkey"]
}
```

**Rate Limit**: 10 requests/minute

---

### Login with TOTP

```
POST /api/auth/login/totp
```

**Request Body**:
```json
{
  "tempToken": "temp_token_from_login",
  "code": "123456"
}
```

**Response**: Same as normal login success

---

### Login with Backup Code

```
POST /api/auth/login/backup-code
```

**Request Body**:
```json
{
  "tempToken": "temp_token_from_login",
  "backupCode": "ABCD-1234-EFGH"
}
```

---

### Refresh Token

```
POST /api/auth/refresh
```

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response**:
```json
{
  "token": "new_access_token",
  "refreshToken": "new_refresh_token"
}
```

**Rate Limit**: 30 requests/minute

---

### Logout

```
POST /api/auth/logout
```

Invalidates current session.

---

### Logout All Sessions

```
POST /api/auth/logout-all
```

**🔒 Auth Required**

Invalidates ALL sessions for user.

---

### Get Active Sessions

```
GET /api/auth/sessions
```

**🔒 Auth Required**

**Response**:
```json
{
  "sessions": [
    {
      "id": "sess_01...",
      "device": "Chrome on Windows",
      "ip": "203.0.113.1",
      "lastActive": "2026-01-07T10:00:00Z",
      "current": true
    }
  ]
}
```

---

### Revoke Session

```
DELETE /api/auth/sessions/:id
```

**🔒 Auth Required**

---

### Email Verification

```
POST /api/auth/verify/request
POST /api/auth/verify/confirm
```

**Rate Limit**: 10 requests/minute

---

### Password Reset

```
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

---

### Create Username

```
POST /api/auth/username
```

**🔒 Auth Required**

For users who registered but haven't set username.

---

## 🛡️ TOTP Routes (`/api/auth/totp`)

All require **Auth**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Get 2FA status |
| `POST` | `/setup` | Begin 2FA setup (returns QR) |
| `POST` | `/verify` | Verify and enable 2FA |
| `POST` | `/verify-code` | Verify a TOTP code |
| `POST` | `/disable` | Disable 2FA |
| `POST` | `/backup-codes` | Generate new backup codes |
| `GET` | `/backup-codes/count` | Count remaining backup codes |

### Setup Response

```json
{
  "secret": "BASE32_SECRET",
  "qrCode": "data:image/png;base64,...",
  "recoveryKey": "XXXX-XXXX-XXXX-XXXX"
}
```

---

## 🔑 Passkey Routes (`/api/auth/passkeys`)

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/check` | Check if user has passkeys |
| `POST` | `/login/begin` | Begin passkey login |
| `POST` | `/login/finish` | Complete passkey login |

### Protected (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/status` | Get passkey status |
| `GET` | `/` | List all passkeys |
| `POST` | `/register/begin` | Begin registration |
| `POST` | `/register/finish` | Complete registration |
| `DELETE` | `/:id` | Delete passkey |
| `PUT` | `/:id/name` | Rename passkey |

---

## 🔒 Sudo Routes (`/api/auth/sudo`)

All require **Auth**. Sudo mode is for re-authentication before critical actions.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/verify` | Enter sudo mode |
| `GET` | `/status` | Check sudo status |
| `POST` | `/extend` | Extend sudo session |
| `DELETE` | `/` | Revoke sudo mode |

---

## 👤 Account Routes (`/api/account`)

All require **Auth**.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/me` | Get my account info |
| `PUT` | `/` | Update account |
| `POST` | `/change-username` | Change username (paid) |
| `PUT` | `/avatar` | Upload avatar |
| `DELETE` | `/avatar` | Delete avatar |
| `DELETE` | `/` | Delete account (requires sudo) |
| `GET` | `/badges` | Get my badges |
| `PUT` | `/primary-badge` | Set primary badge |

### Delete Account

```
DELETE /api/account
```

**🔒 Auth + Sudo Required**

**Rate Limit**: 3 requests/hour

Requires `X-Sudo-Token` header.

---

## 👥 User Routes (`/api/user`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/me` | ✅ | Get my user info |
| `GET` | `/:username` | ❌ | Get public profile |
| `GET` | `/:username/threads` | ❌ | Get user's threads |
| `GET` | `/:username/badges` | ❌ | Get user's badges |

---

## 📝 Thread Routes (`/api/threads`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/categories` | ❌ | List categories |
| `GET` | `/category/:slug` | ❌ | Threads by category |
| `GET` | `/latest` | ❌ | Latest threads |
| `GET` | `/:id/public` | ❌ | Public thread detail |
| `GET` | `/:id` | ✅ | Thread detail |
| `POST` | `/` | ✅ | Create thread |
| `GET` | `/me` | ✅ | My threads |
| `PUT` | `/:id` | ✅ | Update thread |

### Create Thread

```
POST /api/threads
```

**🔒 Auth Required**

**Request Body**:
```json
{
  "title": "Cara Deploy Next.js ke Vercel",
  "categoryId": 5,
  "summary": "Panduan lengkap untuk deploy...",
  "contentJson": {
    "type": "table",
    "columns": ["Step", "Action"],
    "rows": [...]
  }
}
```

---

## 🏅 Badge Routes (`/api/badges`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/:id` | ❌ | Get badge detail |

---

## 🔍 RAG/AI Search Routes (`/api/rag`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/ask` | ❌ | - | AI-powered question |
| `GET` | `/answer` | ❌ | - | Get AI answer |
| `GET` | `/search-threads` | ❌ | - | Search threads |
| `GET` | `/explain/:id` | ❌ | 2/min | AI explain thread |

### Search Threads

```
GET /api/rag/search-threads?q=nextjs+deployment
```

---

## 🛡️ Admin Routes (`/admin`)

### Admin Login

```
POST /admin/auth/login
```

Uses separate admin JWT secret.

### Protected Admin Routes

All require admin auth:

**Badge Management**:
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/badges` | Create badge |
| `GET` | `/badges` | List badges |
| `GET` | `/badges/:id` | Get badge |
| `PUT` | `/badges/:id` | Update badge |
| `DELETE` | `/badges/:id` | Delete badge |

**User Management**:
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users` | List users |
| `GET` | `/users/:userId` | Get user |
| `POST` | `/users/:userId/badges` | Assign badge |
| `DELETE` | `/users/:userId/badges/:badgeId` | Revoke badge |

**RAG Indexing**:
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/rag/index-chunk` | Index chunk |
| `POST` | `/rag/index-long` | Index long text |
| `POST` | `/rag/index-thread/:id` | Index specific thread |

---

## 📊 Rate Limits Summary

| Endpoint | Limit |
|----------|-------|
| Register | 6/min |
| Login | 10/min |
| Verify | 10/min |
| Refresh | 30/min |
| Delete Account | 3/hour |
| AI Explain | 2/min |

---

## ▶️ Selanjutnya

- [22_BACKEND_GIN_HANDLERS.md](./22_BACKEND_GIN_HANDLERS.md) - Handler implementations
- [23_BACKEND_GIN_SERVICES.md](./23_BACKEND_GIN_SERVICES.md) - Service layer
