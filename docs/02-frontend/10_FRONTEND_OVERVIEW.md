# 💻 Frontend Overview

> Dokumen ini menjelaskan struktur dan arsitektur aplikasi frontend Alephdraad yang dibangun dengan Next.js 15.

---

## 🎯 Ringkasan

| Aspek | Detail |
|-------|--------|
| **Framework** | Next.js 15.5.9 |
| **React** | 19.1.0 |
| **Styling** | Tailwind CSS 4 |
| **Bundler** | Turbopack |
| **Hosting** | Vercel |
| **URL** | https://alephdraad.fun |

---

## 📁 Struktur Folder

```
frontend/
├── app/                    # 📱 App Router (halaman-halaman)
│   ├── layout.js           # Layout utama (header, footer)
│   ├── page.js             # Homepage (/)
│   ├── globals.css         # Global styles
│   ├── loading.jsx         # Loading state
│   ├── error.jsx           # Error boundary
│   ├── not-found.jsx       # 404 page
│   │
│   ├── login/              # /login
│   ├── register/           # /register
│   ├── account/            # /account (profile)
│   │   └── wallet/         # /account/wallet
│   ├── admin/              # /admin (admin panel)
│   ├── thread/             # /thread/[id]
│   ├── threads/            # /threads (listing)
│   ├── ai-search/          # /ai-search (RAG search)
│   └── ...
│
├── components/             # 🧩 Reusable components
│   ├── ui/                 # UI primitives (Button, Input, Modal)
│   ├── home/               # Homepage-specific components
│   ├── Header.js           # Navigation header
│   ├── Footer.js           # Footer
│   ├── Sidebar.js          # Sidebar navigation
│   └── ...
│
├── lib/                    # 🔧 Utilities & hooks
│   ├── api.js              # API client untuk Backend Gin
│   ├── featureApi.js       # API client untuk Feature Service
│   ├── auth.js             # Auth utilities (token management)
│   ├── tokenRefresh.js     # Auto token refresh
│   ├── useAIChat.js        # AI Chat hooks
│   ├── useReplies.js       # Reply system hooks
│   └── ...
│
├── public/                 # 📦 Static assets
│   └── logo/               # Logo files
│
├── next.config.mjs         # Next.js configuration
├── package.json            # Dependencies
├── tailwind.config.js      # Tailwind configuration
└── tsconfig.json           # TypeScript config
```

---

## 🛣️ App Router & Routing

Next.js 15 menggunakan **App Router** dengan file-based routing:

### Konvensi File

| File | Fungsi |
|------|--------|
| `page.jsx` | Halaman yang bisa diakses |
| `layout.jsx` | Layout pembungkus (nested layouts) |
| `loading.jsx` | Loading UI (Suspense) |
| `error.jsx` | Error boundary |
| `not-found.jsx` | 404 page |

### Contoh Routing

| Folder | URL | Deskripsi |
|--------|-----|-----------|
| `app/page.js` | `/` | Homepage |
| `app/login/page.jsx` | `/login` | Login page |
| `app/thread/[id]/page.jsx` | `/thread/123` | Thread detail |
| `app/user/[username]/page.jsx` | `/user/john` | User profile |
| `app/category/[slug]/page.jsx` | `/category/tech` | Category page |

### Dynamic Routes

```jsx
// app/thread/[id]/page.jsx
export default function ThreadPage({ params }) {
  const { id } = params; // id dari URL
  return <ThreadDetail threadId={id} />;
}
```

---

## 🎨 Styling dengan Tailwind CSS

### Konfigurasi Theme

Alephdraad menggunakan CSS variables untuk theming:

```css
/* app/globals.css */
:root {
  --bg: 255 255 255;        /* Background */
  --fg: 0 0 0;              /* Foreground (text) */
  --surface: 249 250 251;   /* Card/surface */
  --border: 229 231 235;    /* Border color */
  --primary: 59 130 246;    /* Primary blue */
}

.dark {
  --bg: 17 24 39;
  --fg: 255 255 255;
  /* ... dark mode values */
}
```

### Penggunaan

```jsx
<div className="bg-[rgb(var(--bg))] text-[rgb(var(--fg))]">
  <button className="bg-[rgb(var(--primary))] text-white">
    Click me
  </button>
</div>
```

---

## 🧩 Component Architecture

### UI Components (`components/ui/`)

Komponen-komponen UI dasar yang reusable:

| Component | File | Deskripsi |
|-----------|------|-----------|
| Button | `Button.jsx` | Tombol dengan variants |
| Input | `Input.jsx` | Text input field |
| Modal | `Modal.jsx` | Dialog/modal popup |
| Card | `Card.jsx` | Card container |
| Avatar | `Avatar.jsx` | User avatar |
| Badge | `Badge.jsx` | Status badge |
| Spinner | `Spinner.jsx` | Loading spinner |
| Toast | `Toast.jsx` | Notification toast |
| Skeleton | `Skeleton.jsx` | Loading skeleton |

### Contoh Penggunaan

```jsx
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

function MyComponent() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    toast.success("Berhasil", "Data tersimpan");
  };

  return (
    <>
      <Button onClick={handleClick} variant="primary">
        Simpan
      </Button>
      
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <h2>Konfirmasi</h2>
        <p>Apakah Anda yakin?</p>
      </Modal>
    </>
  );
}
```

---

## 🔧 Custom Hooks

### Hooks di `lib/`

| Hook | File | Deskripsi |
|------|------|-----------|
| `useReplies` | `useReplies.js` | CRUD replies |
| `useReactions` | `useReactions.js` | Add/remove reactions |
| `useAIChat` | `useAIChat.js` | AI chat functionality |
| `useDocuments` | `useDocuments.js` | Document management |
| `useReport` | `useReport.js` | Report content |

### Contoh: useReplies

```jsx
import { useReplies, useDeleteReply } from "@/lib/useReplies";

function ReplySection({ threadId }) {
  const { replies, loading, error, refetch } = useReplies(threadId);
  const { deleteReply } = useDeleteReply();

  if (loading) return <Skeleton />;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div>
      {replies.map(reply => (
        <ReplyItem 
          key={reply.id} 
          reply={reply}
          onDelete={() => deleteReply(threadId, reply.id)}
        />
      ))}
    </div>
  );
}
```

### Contoh: useTokenBalance

```jsx
import { useTokenBalance } from "@/lib/useAIChat";

function WalletWidget() {
  const { balance, loading, refetch } = useTokenBalance();

  return (
    <div className="p-4 rounded-lg bg-surface">
      <h3>Saldo Token</h3>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-bold">{balance.tokens} tokens</p>
      )}
    </div>
  );
}
```

---

## 📡 API Integration

### Dua API Client

```
Frontend
    │
    ├── lib/api.js ──────────────▶ Backend Gin (api.alephdraad.fun)
    │   • fetchJson()                └── Auth, Threads, Users
    │   • fetchJsonAuth()
    │
    └── lib/featureApi.js ───────▶ Feature Service (feature.alephdraad.fun)
        • fetchFeature()             └── Replies, Reactions, AI Chat
        • fetchFeatureAuth()
```

### Contoh Penggunaan

```javascript
// lib/api.js - untuk Backend Gin
import { fetchJsonAuth } from "@/lib/api";

const threads = await fetchJsonAuth("/api/threads/latest");

// lib/featureApi.js - untuk Feature Service
import { fetchFeatureAuth, FEATURE_ENDPOINTS } from "@/lib/featureApi";

const balance = await fetchFeatureAuth(FEATURE_ENDPOINTS.AI.TOKEN_BALANCE);
```

---

## 🔐 Authentication di Frontend

### Token Management

```javascript
// lib/auth.js
export function getToken() {
  return localStorage.getItem("token");
}

export function saveToken(token) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
}
```

### Auto Token Refresh

```javascript
// lib/tokenRefresh.js
export async function getValidToken() {
  const token = getToken();
  if (!token) return null;
  
  // Cek apakah token akan expire dalam 5 menit
  if (isTokenExpiringSoon(token, 5 * 60)) {
    try {
      const { token: newToken } = await refreshToken();
      saveToken(newToken);
      return newToken;
    } catch {
      clearToken();
      return null;
    }
  }
  
  return token;
}
```

### Protected Routes

```jsx
// Contoh protected page
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  
  useEffect(() => {
    if (!getToken()) {
      router.push("/login?redirect=/account");
    }
  }, [router]);

  return <AccountContent />;
}
```

---

## ⚙️ Configuration Files

### next.config.mjs

```javascript
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,  // Security: hide X-Powered-By
  
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature.alephdraad.fun
```

**Catatan**: Prefix `NEXT_PUBLIC_` membuat variable accessible di browser.

---

## 🏃 Development Commands

```bash
# Install dependencies
npm install

# Development server (dengan Turbopack)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint

# Format code
npm run format
```

---

## 📊 Page Structure

### Typical Page Pattern

```jsx
"use client";  // Jika butuh client-side features

import { useState, useEffect } from "react";
import { fetchJsonAuth } from "@/lib/api";
import Skeleton from "@/components/ui/Skeleton";
import Alert from "@/components/ui/Alert";

export default function MyPage() {
  // 1. State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Data fetching
  useEffect(() => {
    async function loadData() {
      try {
        const result = await fetchJsonAuth("/api/data");
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 3. Loading state
  if (loading) return <Skeleton />;

  // 4. Error state
  if (error) return <Alert type="error">{error}</Alert>;

  // 5. Render data
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">{data.title}</h1>
      {/* ... */}
    </main>
  );
}
```

---

## ▶️ Selanjutnya

- [11_FRONTEND_PAGES.md](./11_FRONTEND_PAGES.md) - Detail setiap halaman
- [12_FRONTEND_COMPONENTS.md](./12_FRONTEND_COMPONENTS.md) - Komponen UI
- [13_FRONTEND_HOOKS.md](./13_FRONTEND_HOOKS.md) - Custom hooks
