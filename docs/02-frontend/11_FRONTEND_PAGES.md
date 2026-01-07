# 📄 Frontend Pages

> Dokumen ini menjelaskan semua halaman yang tersedia di aplikasi frontend.

---

## 🗺️ Peta Halaman

```
/                           ← Homepage
├── /login                  ← Login page
├── /register               ← Register page
├── /forgot-password        ← Forgot password
├── /reset-password         ← Reset password
├── /verify-email           ← Email verification
├── /set-username           ← Set username (post-register)
│
├── /threads                ← Thread listing
├── /thread/[id]            ← Thread detail
├── /category/[slug]        ← Threads by category
│
├── /user/[username]        ← Public user profile
│
├── /account                ← User account (protected)
│   └── /wallet             ← Wallet & tokens
│
├── /ai-search              ← AI Search (RAG)
│
├── /admin                  ← Admin dashboard (protected)
│   ├── /login              ← Admin login
│   ├── /users              ← User management
│   └── /badges             ← Badge management
│
├── /about-content          ← About page
├── /community-guidelines   ← Community guidelines
├── /privacy                ← Privacy policy
├── /fees                   ← Fee information
├── /rules-content          ← Rules
├── /contact-support        ← Contact support
└── /changelog              ← Changelog
```

---

## 🏠 Homepage (`/`)

**File**: `app/page.js`

### Deskripsi
Halaman utama yang menampilkan:
- Hero section dengan tagline
- Grid kategori thread
- Thread terbaru

### Komponen yang Digunakan
```jsx
import Hero from "@/components/home/Hero";
import CategoryGrid from "@/components/home/CategoryGrid";
import LatestThreads from "@/components/home/LatestThreads";
```

### Screenshot Layout
```
┌─────────────────────────────────────────────────────┐
│                     HEADER                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│                  HERO SECTION                       │
│            "Selamat Datang di Alephdraad"           │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│     CATEGORY GRID                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Tech    │ │ Finance │ │ Design  │ │ Career  │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│     LATEST THREADS                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ Thread 1: Cara Deploy Next.js...            │   │
│  │ Thread 2: Panduan TypeScript...             │   │
│  │ Thread 3: Belajar Docker...                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                     FOOTER                          │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Pages

### Login (`/login`)

**File**: `app/login/page.jsx`

**Fitur**:
- Form email + password
- "Lupa password?" link
- Passkey login option
- Remember me checkbox
- Redirect setelah login

### Register (`/register`)

**File**: `app/register/page.jsx`

**Fitur**:
- Form email + password
- Password strength indicator
- Terms & conditions checkbox
- Auto-login setelah register

### Forgot Password (`/forgot-password`)

**File**: `app/forgot-password/page.jsx`

**Flow**:
1. User masukkan email
2. Backend kirim email reset
3. User klik link di email
4. Redirect ke `/reset-password?token=xxx`

### Set Username (`/set-username`)

**File**: `app/set-username/page.jsx`

**Kapan muncul**: Setelah register, jika user belum set username.

---

## 📝 Thread Pages

### Thread Listing (`/threads`)

**File**: `app/threads/page.jsx`

**Fitur**:
- Daftar semua thread
- Filter by category
- Search
- Pagination/infinite scroll

### Thread Detail (`/thread/[id]`)

**File**: `app/thread/[id]/page.jsx`

**Fitur**:
- Thread content (tabel/markdown)
- Reaction bar (like, love, fire, sad, laugh)
- Reply section
- Nested replies (depth 3)
- Share button
- Report button

### Layout Thread Detail
```
┌─────────────────────────────────────────────────────┐
│ Category: Web Development                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ THREAD TITLE                                        │
│ Posted by @username • 2 jam lalu                    │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ THREAD CONTENT                                      │
│ ┌─────────────────────────────────────────────┐     │
│ │ Table/Markdown content here...              │     │
│ │                                             │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ REACTIONS                                           │
│ 👍 12  ❤️ 5  🔥 3  😢 0  😂 2                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ REPLIES (24)                                        │
│ ┌─────────────────────────────────────────────┐     │
│ │ @user1: Terima kasih!                       │     │
│ │   └─ @user2: Sama-sama                      │     │
│ │       └─ @user1: 👍                         │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ [ Reply form... ]                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 👤 User Pages

### Public Profile (`/user/[username]`)

**File**: `app/user/[username]/page.jsx`

**Menampilkan**:
- Avatar & display name
- Bio
- Badges
- Public threads by user
- Join date

### Account Settings (`/account`)

**File**: `app/account/page.jsx`

**Protected**: Ya (harus login)

**Fitur**:
- Edit profile (avatar, bio, name)
- Security settings (2FA, passkeys)
- Session management
- Delete account

### Wallet (`/account/wallet`)

**File**: `app/account/wallet/page.jsx`

**Fitur**:
- Token balance
- Purchase tokens
- Transaction history
- Wallet PIN settings

---

## 🤖 AI Search (`/ai-search`)

**File**: `app/ai-search/page.jsx`

### Flow
```
1. User ketik query: "Cara deploy Next.js"
         │
         ▼
2. Backend melakukan vector search (RAG)
         │
         ▼
3. Tampilkan hasil: Threads yang relevan
         │
         ▼
4. User klik thread → AI explain
         │
         ▼
5. Tampilkan penjelasan AI tentang thread
```

### Layout
```
┌─────────────────────────────────────────────────────┐
│                    AI Search                        │
│ ┌─────────────────────────────────────────────┐     │
│ │ 🔍 Cari topik yang ingin dipelajari...      │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ HASIL PENCARIAN                                     │
│ ┌─────────────────────────────────────────────┐     │
│ │ 📄 Deploy Next.js ke Vercel                 │     │
│ │    Relevance: 95%  •  [Explain dengan AI]   │     │
│ ├─────────────────────────────────────────────┤     │
│ │ 📄 Panduan Hosting Next.js                  │     │
│ │    Relevance: 87%  •  [Explain dengan AI]   │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ AI EXPLANATION (jika dipilih)                       │
│ ┌─────────────────────────────────────────────┐     │
│ │ Thread ini menjelaskan langkah-langkah...   │     │
│ │ 1. Pertama, pastikan Anda memiliki...       │     │
│ │ 2. Kemudian, hubungkan repository...        │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🛡️ Admin Pages

### Admin Login (`/admin/login`)

**File**: `app/admin/login/page.jsx`

**Note**: Admin login terpisah dari user login.

### Admin Dashboard (`/admin`)

**File**: `app/admin/page.jsx`

**Protected**: Ya (harus admin)

**Fitur**:
- Overview statistics
- Quick actions

### User Management (`/admin/users`)

**File**: `app/admin/users/page.jsx`

**Fitur**:
- List users
- Search/filter
- Assign badges
- View user details

### Badge Management (`/admin/badges`)

**File**: `app/admin/badges/page.jsx`

**Fitur**:
- Create badge
- Edit badge
- Delete badge
- Assign to users

---

## 📋 Static Pages

### Legal & Info Pages

| Page | URL | Konten |
|------|-----|--------|
| About | `/about-content` | Tentang Alephdraad |
| Guidelines | `/community-guidelines` | Aturan komunitas |
| Privacy | `/privacy` | Kebijakan privasi |
| Fees | `/fees` | Informasi biaya |
| Rules | `/rules-content` | Peraturan |
| Support | `/contact-support` | Kontak support |
| Changelog | `/changelog` | Riwayat perubahan |

---

## ⚠️ Error Pages

### Error Boundary (`error.jsx`)

**File**: `app/error.jsx`

```jsx
"use client";

export default function Error({ error, reset }) {
  return (
    <div className="text-center py-20">
      <h2>Terjadi Kesalahan</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Coba Lagi</button>
    </div>
  );
}
```

### Not Found (`not-found.jsx`)

**File**: `app/not-found.jsx`

Ditampilkan ketika URL tidak ditemukan (404).

### Global Error (`global-error.jsx`)

**File**: `app/global-error.jsx`

Error boundary untuk layout root.

---

## 🔄 Loading States

Setiap page yang membutuhkan data async memiliki `loading.jsx`:

```jsx
// app/account/loading.jsx
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto p-4">
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
```

---

## ▶️ Selanjutnya

- [12_FRONTEND_COMPONENTS.md](./12_FRONTEND_COMPONENTS.md) - Komponen UI
- [13_FRONTEND_HOOKS.md](./13_FRONTEND_HOOKS.md) - Custom hooks
