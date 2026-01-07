# 🔗 Bagaimana Sistem Terhubung

> Dokumen ini menjelaskan mekanisme komunikasi antara Frontend, Backend Gin, dan Feature Service.

---

## 🎯 Ringkasan Koneksi

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                    (User's Computer)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS Request
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                           │
│              https://alephdraad.fun                             │
│  ─────────────────────────────────────────────────────────────  │
│  lib/api.js        → Memanggil Backend Gin                      │
│  lib/featureApi.js → Memanggil Feature Service                  │
└─────────────────────────┬───────────────┬───────────────────────┘
                          │               │
                          │               │
    ┌─────────────────────┘               └─────────────────────┐
    │                                                           │
    │ NEXT_PUBLIC_API_BASE_URL                NEXT_PUBLIC_FEATURE_API_URL
    │                                                           │
    ▼                                                           ▼
┌────────────────────────────┐         ┌────────────────────────────┐
│   BACKEND GIN              │         │   FEATURE SERVICE          │
│   api.alephdraad.fun       │         │   feature.alephdraad.fun   │
│   ────────────────────     │         │   ────────────────────     │
│   Port: 8080               │         │   Port: 5000               │
└────────────────────────────┘         └────────────────────────────┘
```

---

## 📡 Dua API Client di Frontend

Frontend memiliki **dua API client** yang berbeda:

### 1. `lib/api.js` - Untuk Backend Gin

```javascript
// lib/api.js
export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
}

// Contoh penggunaan
await fetchJson("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
```

**Endpoint yang dipanggil:**
- `/api/auth/*` - Login, register, logout
- `/api/threads/*` - CRUD threads
- `/api/user/*` - User profile
- `/api/rag/*` - AI Search

### 2. `lib/featureApi.js` - Untuk Feature Service

```javascript
// lib/featureApi.js
export function getFeatureApiBase() {
  return process.env.NEXT_PUBLIC_FEATURE_API_URL || "http://localhost:5000";
}

// Contoh penggunaan
await fetchFeatureAuth(FEATURE_ENDPOINTS.AI.TOKEN_BALANCE);
```

**Endpoint yang dipanggil:**
- `/api/v1/threads/{id}/replies` - Reply system
- `/api/v1/threads/{id}/reactions` - Reaction system
- `/api/v1/chat/*` - AI Chat (Aleph)
- `/api/v1/wallets/*` - Wallet & tokens

---

## 🔐 Shared Authentication

Kedua backend **menggunakan JWT yang sama**:

```
┌────────────────────────────────────────────────────────────────┐
│                      JWT TOKEN                                 │
│  ───────────────────────────────────────────────────────────   │
│  Header: { "alg": "HS256", "typ": "JWT" }                      │
│  Payload: {                                                    │
│    "userId": 123,                                              │
│    "username": "john",                                         │
│    "email": "john@example.com",                                │
│    "exp": 1704672000                                           │
│  }                                                             │
│  Signature: HMACSHA256(header + payload, JWT_SECRET)           │
└────────────────────────────────────────────────────────────────┘
```

### Bagaimana Token Dibuat dan Divalidasi:

```
1. User login ke Frontend
         │
         ▼
2. Frontend kirim credentials ke Backend Gin
         │
         ▼
3. Backend Gin verifikasi, buat JWT dengan JWT_SECRET
         │
         ▼
4. JWT dikirim ke Frontend, disimpan di localStorage/cookie
         │
         ▼
5. Setiap request ke Backend Gin → JWT divalidasi
         │
         ▼
6. Setiap request ke Feature Service → JWT divalidasi
   (menggunakan JWT_SECRET yang SAMA)
```

### Environment Variables yang Harus Sama:

| Variable | Backend Gin | Feature Service |
|----------|-------------|-----------------|
| `JWT_SECRET` | ✅ Wajib sama | ✅ Wajib sama |
| `JWT_ISSUER` | ✅ Wajib sama | ✅ Wajib sama |
| `JWT_AUDIENCE` | ✅ Wajib sama | ✅ Wajib sama |

---

## 📨 Anatomy of a Request

### Contoh: User Membuat Reply

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                                  │
│    User klik "Kirim" pada form reply                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND (React Component)                                   │
│                                                                 │
│    const { createReply } = useReplies();                        │
│    await createReply(threadId, { content: "Hello!" });          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND (featureApi.js)                                     │
│                                                                 │
│    fetchFeatureAuth("/api/v1/threads/1/replies", {              │
│      method: "POST",                                            │
│      headers: { Authorization: "Bearer eyJ..." },               │
│      body: JSON.stringify({ content: "Hello!" })                │
│    });                                                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          │ HTTP POST ke feature.alephdraad.fun
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FEATURE SERVICE (ASP.NET Core)                               │
│                                                                 │
│    a. Middleware: Validate JWT                                  │
│    b. Controller: ReplyController.CreateReply()                 │
│    c. Service: ReplyService.CreateReplyAsync()                  │
│    d. Database: Insert ke MongoDB                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. RESPONSE                                                     │
│                                                                 │
│    {                                                            │
│      "success": true,                                           │
│      "data": {                                                  │
│        "id": "rpl_01HN5ZYAQT...",                               │
│        "content": "Hello!",                                     │
│        "createdAt": "2026-01-07T..."                            │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow: Login

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  Browser   │────▶│  Frontend  │────▶│ Backend    │────▶│ PostgreSQL │
│            │     │  (Next.js) │     │ (Gin)      │     │            │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
     │                   │                  │                  │
     │ 1. Submit form    │                  │                  │
     │─────────────────▶│                  │                  │
     │                   │ 2. POST /api/auth/login            │
     │                   │─────────────────▶│                  │
     │                   │                  │ 3. Query user    │
     │                   │                  │─────────────────▶│
     │                   │                  │ 4. User data     │
     │                   │                  │◀─────────────────│
     │                   │                  │                  │
     │                   │                  │ 5. Verify password
     │                   │                  │    Create JWT    │
     │                   │                  │                  │
     │                   │ 6. { token: "eyJ..." }              │
     │                   │◀─────────────────│                  │
     │ 7. Save token     │                  │                  │
     │   Redirect        │                  │                  │
     │◀─────────────────│                  │                  │
```

---

## 🔄 Request Flow: Chat dengan AI (Aleph)

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  Browser   │────▶│  Frontend  │────▶│ Feature    │────▶│ AI Provider│
│            │     │  (Next.js) │     │ Service    │     │ (LLM)      │
└────────────┘     └────────────┘     └────────────┘     └────────────┘
     │                   │                  │                  │
     │ 1. Send message   │                  │                  │
     │─────────────────▶│                  │                  │
     │                   │ 2. POST /api/v1/chat/sessions/{id}/messages
     │                   │   + JWT Token    │                  │
     │                   │─────────────────▶│                  │
     │                   │                  │                  │
     │                   │                  │ 3. Check token balance
     │                   │                  │    (MongoDB)     │
     │                   │                  │                  │
     │                   │                  │ 4. Call LLM API  │
     │                   │                  │─────────────────▶│
     │                   │                  │ 5. AI Response   │
     │                   │                  │◀─────────────────│
     │                   │                  │                  │
     │                   │                  │ 6. Deduct tokens │
     │                   │                  │    Save message  │
     │                   │                  │                  │
     │                   │ 7. { content: "...", tokensUsed: 150 }
     │                   │◀─────────────────│                  │
     │ 8. Show response  │                  │                  │
     │◀─────────────────│                  │                  │
```

---

## 🛡️ CORS Configuration

### Backend Gin (`main.go`)
```go
corsConfig.AllowOrigins = []string{
    "https://alephdraad.fun",
    "http://localhost:3000", // Development
}
corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization", "X-Sudo-Token"}
```

### Feature Service (`Program.cs`)
```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://alephdraad.fun")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
```

---

## 🌐 URL Structure

### Production
| Service | URL |
|---------|-----|
| Frontend | `https://alephdraad.fun` |
| Backend Gin | `https://api.alephdraad.fun` |
| Feature Service | `https://feature.alephdraad.fun` |

### Development
| Service | URL |
|---------|-----|
| Frontend | `http://localhost:3000` |
| Backend Gin | `http://localhost:8080` |
| Feature Service | `http://localhost:5000` |

---

## ⚠️ Error Handling

### Frontend Error Handling
```javascript
// lib/api.js
try {
  const data = await fetchJson(path, options);
  return data;
} catch (err) {
  if (err.status === 401) {
    // Token expired → redirect to login
    clearToken();
    window.location.href = "/login";
  }
  throw err;
}
```

### Token Refresh Flow
```
1. Request gagal dengan 401 (Unauthorized)
         │
         ▼
2. Frontend cek: apakah ada refresh token?
         │
    ┌────┴────┐
    │ Ya      │ Tidak
    ▼         ▼
3. Call      Redirect
   /api/auth/refresh    ke /login
         │
         ▼
4. Dapat token baru → Retry request
```

---

## 📊 Health Check

Kedua backend memiliki endpoint health check:

```bash
# Backend Gin
curl https://api.alephdraad.fun/api/health
# Response: { "status": "ok", "service": "backend-gin" }

# Feature Service
curl https://feature.alephdraad.fun/health
# Response: { "status": "healthy", "service": "feature-service" }
```

---

## 🔧 Environment Variables untuk Koneksi

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature.alephdraad.fun
```

### Backend Gin (`.env`)
```bash
PORT=8080
FRONTEND_BASE_URL=https://alephdraad.fun
CORS_ALLOWED_ORIGINS=https://alephdraad.fun
JWT_SECRET=your-shared-secret
```

### Feature Service (`appsettings.json`)
```json
{
  "Jwt": {
    "Secret": "your-shared-secret",
    "Issuer": "alephdraad",
    "Audience": "alephdraad-users"
  },
  "Cors": {
    "AllowedOrigins": ["https://alephdraad.fun"]
  }
}
```

---

## ▶️ Selanjutnya

- [04_AUTHENTICATION_FLOW.md](./04_AUTHENTICATION_FLOW.md) - Detail alur autentikasi
- [05_DATA_FLOW.md](./05_DATA_FLOW.md) - Bagaimana data mengalir
