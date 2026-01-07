# 📡 Frontend API Clients

> Dokumen ini menjelaskan cara frontend berkomunikasi dengan backend APIs.

---

## 🎯 Overview

Frontend memiliki **dua API client** untuk berkomunikasi dengan dua backend:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  lib/api.js          →  Backend Gin (api.alephdraad.fun)        │
│                          • Auth, Users, Threads                 │
│                                                                 │
│  lib/featureApi.js   →  Feature Service (feature.alephdraad.fun)│
│                          • Replies, Reactions, AI Chat          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File: `lib/api.js`

API client untuk **Backend Gin**.

### Base URL

```javascript
export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
}
```

### fetchJson (Public Endpoints)

Untuk endpoint yang tidak memerlukan autentikasi.

```javascript
import { fetchJson } from "@/lib/api";

// GET request
const categories = await fetchJson("/api/threads/categories");

// POST request
const result = await fetchJson("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password })
});
```

**Features**:
- Automatic timeout (10 detik default)
- Error handling dengan pesan dari backend
- JSON parsing otomatis

### fetchJsonAuth (Protected Endpoints)

Untuk endpoint yang memerlukan autentikasi.

```javascript
import { fetchJsonAuth } from "@/lib/api";

// Automatically adds Authorization header
const myThreads = await fetchJsonAuth("/api/threads/me");

// POST with auth
const newThread = await fetchJsonAuth("/api/threads", {
  method: "POST",
  body: JSON.stringify({
    title: "My Thread",
    categoryId: 1,
    contentJson: {...}
  })
});
```

**Features**:
- Auto token refresh jika expired
- Auto redirect ke login jika 401
- Includes Bearer token di header

### Implementation Details

```javascript
export async function fetchJsonAuth(path, options = {}) {
  const { headers = {}, ...rest } = options;
  
  // Get valid token (auto-refresh if needed)
  const token = await getValidToken();
  if (!token) {
    throw new Error("Sesi telah berakhir. Silakan login kembali.");
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request gagal`);
  }

  return res.json();
}
```

---

## 📁 File: `lib/featureApi.js`

API client untuk **Feature Service** (ASP.NET Core).

### Base URL

```javascript
export function getFeatureApiBase() {
  return process.env.NEXT_PUBLIC_FEATURE_API_URL || "http://localhost:5000";
}
```

### Endpoint Constants

```javascript
export const FEATURE_ENDPOINTS = {
  // Health
  HEALTH: "/api/v1/health",

  // Replies
  REPLIES: {
    LIST: (threadId) => `/api/v1/threads/${threadId}/replies`,
    CREATE: (threadId) => `/api/v1/threads/${threadId}/replies`,
    UPDATE: (threadId, replyId) => `/api/v1/threads/${threadId}/replies/${replyId}`,
    DELETE: (threadId, replyId) => `/api/v1/threads/${threadId}/replies/${replyId}`,
  },

  // Reactions
  REACTIONS: {
    SUMMARY: (threadId) => `/api/v1/threads/${threadId}/reactions/summary`,
    ADD: (threadId) => `/api/v1/threads/${threadId}/reactions`,
    REMOVE: (threadId) => `/api/v1/threads/${threadId}/reactions`,
  },

  // AI Chat
  AI: {
    TOKEN_BALANCE: "/api/v1/chat/tokens/balance",
    TOKEN_PACKAGES: "/api/v1/chat/tokens/packages",
    TOKEN_PURCHASE: "/api/v1/chat/tokens/purchase",
    SESSIONS: "/api/v1/chat/sessions",
    SESSION_DETAIL: (id) => `/api/v1/chat/sessions/${id}`,
    SEND_MESSAGE: (id) => `/api/v1/chat/sessions/${id}/messages`,
  },

  // Wallets
  WALLETS: {
    ME: "/api/v1/wallets/me",
    BALANCE: "/api/v1/wallets/balance",
    TRANSACTIONS: "/api/v1/wallets/transactions",
  },

  // Reports
  REPORTS: {
    CREATE: "/api/v1/reports",
    REASONS: "/api/v1/reports/reasons",
  },

  // Documents
  DOCUMENTS: {
    LIST: "/api/v1/documents",
    UPLOAD: "/api/v1/documents",
    DELETE: (id) => `/api/v1/documents/${id}`,
  },
};
```

### fetchFeature (Public Endpoints)

```javascript
import { fetchFeature, FEATURE_ENDPOINTS } from "@/lib/featureApi";

// Get reaction summary (no auth needed)
const reactions = await fetchFeature(
  FEATURE_ENDPOINTS.REACTIONS.SUMMARY("123")
);
```

### fetchFeatureAuth (Protected Endpoints)

```javascript
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";

// Get token balance
const balance = await fetchFeatureAuth(FEATURE_ENDPOINTS.AI.TOKEN_BALANCE);

// Create reply
const reply = await fetchFeatureAuth(
  FEATURE_ENDPOINTS.REPLIES.CREATE("123"),
  {
    method: "POST",
    body: JSON.stringify({
      content: "Nice post!",
      parentReplyId: null
    })
  }
);

// Send AI message
const response = await fetchFeatureAuth(
  FEATURE_ENDPOINTS.AI.SEND_MESSAGE("session_123"),
  {
    method: "POST",
    body: JSON.stringify({
      content: "Jelaskan tentang JWT"
    })
  }
);
```

---

## 🔐 File: `lib/auth.js`

Utility functions untuk token management.

```javascript
// Get stored token
export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

// Save token
export function saveToken(token) {
  localStorage.setItem("token", token);
}

// Get refresh token
export function getRefreshToken() {
  return localStorage.getItem("refreshToken");
}

// Save refresh token
export function saveRefreshToken(token) {
  localStorage.setItem("refreshToken", token);
}

// Clear all tokens (logout)
export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
}

// Check if logged in
export function isLoggedIn() {
  return !!getToken();
}
```

---

## 🔄 File: `lib/tokenRefresh.js`

Auto token refresh logic.

```javascript
import { getToken, getRefreshToken, saveToken, clearToken } from "./auth";
import { fetchJson } from "./api";

// Check if token is expiring soon (within X seconds)
function isTokenExpiringSoon(token, bufferSeconds = 300) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() > exp - bufferSeconds * 1000;
  } catch {
    return true; // Assume expired if can't parse
  }
}

// Refresh the token
async function refreshToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const result = await fetchJson("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  return result;
}

// Get valid token (refresh if needed)
export async function getValidToken() {
  const token = getToken();
  if (!token) return null;

  if (isTokenExpiringSoon(token, 5 * 60)) {
    try {
      const { token: newToken, refreshToken: newRefresh } = await refreshToken();
      saveToken(newToken);
      if (newRefresh) saveRefreshToken(newRefresh);
      return newToken;
    } catch {
      clearToken();
      return null;
    }
  }

  return token;
}
```

---

## ⚠️ Error Handling

### Standard Error Response

Backend mengembalikan error dalam format:

```json
{
  "error": "Pesan error yang user-friendly",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Frontend Error Handling

```javascript
try {
  const result = await fetchJsonAuth("/api/threads", {
    method: "POST",
    body: JSON.stringify(data)
  });
  toast.success("Berhasil", "Thread created");
} catch (err) {
  // err.message contains the error from backend
  // err.status contains HTTP status code
  // err.code contains error code (if provided)
  
  if (err.status === 401) {
    // Redirect to login
    router.push("/login");
  } else if (err.status === 422) {
    // Validation error
    setValidationErrors(err.details);
  } else {
    toast.error("Gagal", err.message);
  }
}
```

---

## 🔧 Environment Variables

```bash
# .env.local (development)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_FEATURE_API_URL=http://localhost:5000

# Production (Vercel)
NEXT_PUBLIC_API_BASE_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature.alephdraad.fun
```

**Catatan**: Prefix `NEXT_PUBLIC_` diperlukan agar variable accessible di browser.

---

## 📊 Request/Response Examples

### Login

```javascript
// Request
const result = await fetchJson("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123"
  })
});

// Response
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

### Create Thread

```javascript
// Request
const thread = await fetchJsonAuth("/api/threads", {
  method: "POST",
  body: JSON.stringify({
    title: "Cara Deploy Next.js",
    categoryId: 5,
    summary: "Panduan lengkap...",
    contentJson: {
      type: "table",
      rows: [...]
    }
  })
});

// Response
{
  "success": true,
  "data": {
    "id": 456,
    "title": "Cara Deploy Next.js",
    "categorySlug": "web-development",
    "createdAt": "2026-01-07T10:00:00Z"
  }
}
```

### Send AI Message

```javascript
// Request
const response = await fetchFeatureAuth(
  FEATURE_ENDPOINTS.AI.SEND_MESSAGE("cht_01HN5..."),
  {
    method: "POST",
    body: JSON.stringify({
      content: "Jelaskan tentang JWT dalam 3 paragraf"
    })
  }
);

// Response
{
  "success": true,
  "data": {
    "messageId": "msg_01HN5...",
    "content": "JWT (JSON Web Token) adalah standar...",
    "tokensUsed": 225,
    "remainingBalance": 9775
  }
}
```

---

## ▶️ Selanjutnya

- [../03-backend-gin/20_BACKEND_GIN_OVERVIEW.md](../03-backend-gin/20_BACKEND_GIN_OVERVIEW.md) - Backend Gin
- [../04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md](../04-feature-service/30_FEATURE_SERVICE_OVERVIEW.md) - Feature Service
