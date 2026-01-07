# 🏗️ Gambaran Besar Sistem Alephdraad

> Dokumen ini menjelaskan bagaimana seluruh sistem Alephdraad bekerja, ditulis agar mudah dipahami oleh siapa saja.

---

## 🎯 Apa itu Alephdraad?

**Alephdraad** adalah platform komunitas online (mirip Reddit atau Forum) yang dibangun dengan teknologi modern. Platform ini memungkinkan pengguna untuk:

1. **Membuat dan membaca thread** - Diskusi terbagi per kategori
2. **Berkomentar (reply)** - Membalas thread dengan komentar bersarang
3. **Memberi reaksi** - Like, love, fire, sad, laugh
4. **Chat dengan AI** - Aleph Assistant, asisten pintar berbayar
5. **Mengelola akun** - Profile, badge, wallet

---

## 🧱 Arsitektur Sistem (System Architecture)

Bayangkan sistem seperti sebuah restoran:
- **Frontend** = Ruang makan (tempat pelanggan melihat menu & memesan)
- **Backend** = Dapur (tempat pesanan diproses)
- **Database** = Gudang bahan makanan (tempat data disimpan)

```
┌─────────────────────────────────────────────────────────────────┐
│                         PENGGUNA                                │
│                    (Browser / Mobile)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                           │
│              🌐 https://alephdraad.fun                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Halaman web yang dilihat pengguna                            │
│  • Formulir login, register, thread                             │
│  • Tampilan chat AI                                             │
│  • Di-hosting di Vercel                                         │
└─────────────────────────┬───────────────┬───────────────────────┘
                          │               │
            ┌─────────────┘               └─────────────┐
            │                                           │
            ▼                                           ▼
┌───────────────────────────────┐    ┌────────────────────────────────┐
│   BACKEND UTAMA (Go/Gin)      │    │   FEATURE SERVICE (ASP.NET)    │
│  🔧 api.alephdraad.fun        │    │  🔷 feature.alephdraad.fun     │
│  ────────────────────────     │    │  ──────────────────────────    │
│  Menangani:                   │    │  Menangani:                    │
│  • Login & Register           │    │  • Reply (komentar)            │
│  • User Management            │    │  • Reactions (like, love)      │
│  • Thread & Category          │    │  • AI Chat (Aleph Assistant)   │
│  • 2FA (TOTP, Passkey)        │    │  • Wallet & Token              │
│  • RAG Search (AI Search)     │    │  • Reports & Moderasi          │
│  • Admin Panel                │    │  • Documents                   │
└───────────────┬───────────────┘    └───────────────┬────────────────┘
                │                                    │
                ▼                                    ▼
┌───────────────────────────────┐    ┌────────────────────────────────┐
│        PostgreSQL             │    │          MongoDB               │
│    (Neon - Cloud)             │    │        (Cloud)                 │
│  ────────────────────────     │    │  ──────────────────────────    │
│  Menyimpan:                   │    │  Menyimpan:                    │
│  • Data User                  │    │  • Replies                     │
│  • Data Thread                │    │  • Reactions                   │
│  • Data Category              │    │  • Chat Sessions               │
│  • Sessions                   │    │  • Token Balance               │
│  • Passkeys                   │    │  • Wallets                     │
└───────────────────────────────┘    └────────────────────────────────┘
```

---

## 🔄 Mengapa Ada 2 Backend?

### Analogi: Tim Sepak Bola
Bayangkan backend seperti pemain bola:
- **Backend Gin (Go)** = Kiper & Bek - Bertanggung jawab atas pertahanan (keamanan, autentikasi)
- **Feature Service (ASP.NET)** = Penyerang - Bertanggung jawab atas fitur-fitur menarik

### Alasan Teknis:

| Aspek | Backend Gin (Go) | Feature Service (ASP.NET) |
|-------|------------------|---------------------------|
| **Fokus** | Core identity & security | Social & finance features |
| **Bahasa** | Go (cepat, ringan) | C# (enterprise-ready) |
| **Database** | PostgreSQL (relational) | MongoDB (document-based) |
| **Kelebihan** | Performa tinggi untuk auth | Fleksibel untuk fitur kompleks |

### Keuntungan Arsitektur Ini:
1. **Separation of Concerns** - Setiap backend fokus pada tugasnya
2. **Skalabilitas** - Bisa di-scale secara terpisah
3. **Fault Isolation** - Jika satu down, yang lain tetap jalan
4. **Tim Development** - Tim berbeda bisa kerja paralel

---

## 🛤️ Alur Pengguna (User Flow)

### 1. Pengguna Membuka Website
```
Browser → alephdraad.fun → Vercel (CDN) → Halaman dimuat
```

### 2. Pengguna Login
```
Browser → Frontend → Backend Gin → PostgreSQL → Token dikembalikan
```

### 3. Pengguna Membuat Thread
```
Browser → Frontend → Backend Gin → PostgreSQL → Thread tersimpan
```

### 4. Pengguna Membalas Thread
```
Browser → Frontend → Feature Service → MongoDB → Reply tersimpan
```

### 5. Pengguna Chat dengan AI (Aleph)
```
Browser → Frontend → Feature Service → AI Provider → Response dikembalikan
                          │
                          └→ Token dikurangi dari saldo
```

---

## 📊 Teknologi yang Digunakan

### Frontend
| Teknologi | Kegunaan | Referensi |
|-----------|----------|-----------|
| **Next.js 15** | Framework React untuk web | [nextjs.org](https://nextjs.org) |
| **React 19** | Library untuk UI | [react.dev](https://react.dev) |
| **Tailwind CSS 4** | Styling/design | [tailwindcss.com](https://tailwindcss.com) |
| **Vercel** | Hosting frontend | [vercel.com](https://vercel.com) |

### Backend Gin
| Teknologi | Kegunaan | Referensi |
|-----------|----------|-----------|
| **Go (Golang)** | Bahasa pemrograman | [go.dev](https://go.dev) |
| **Gin** | Web framework | [gin-gonic.com](https://gin-gonic.com) |
| **GORM** | ORM untuk database | [gorm.io](https://gorm.io) |
| **Ent** | ORM modern (sedang migrasi) | [entgo.io](https://entgo.io) |

### Feature Service
| Teknologi | Kegunaan | Referensi |
|-----------|----------|-----------|
| **C#** | Bahasa pemrograman | [docs.microsoft.com](https://docs.microsoft.com/dotnet/csharp) |
| **ASP.NET Core 8** | Web framework | [asp.net](https://asp.net) |
| **MongoDB** | NoSQL database | [mongodb.com](https://mongodb.com) |
| **FluentValidation** | Validasi input | [fluentvalidation.net](https://fluentvalidation.net) |

### Database
| Teknologi | Kegunaan | Referensi |
|-----------|----------|-----------|
| **PostgreSQL** | Database relasional | [postgresql.org](https://postgresql.org) |
| **Neon** | PostgreSQL serverless | [neon.tech](https://neon.tech) |
| **MongoDB** | Database dokumen | [mongodb.com](https://mongodb.com) |

---

## 🔐 Keamanan

Sistem menerapkan keamanan tingkat enterprise:

1. **JWT (JSON Web Token)** - Token untuk autentikasi
2. **TOTP** - Kode 6 digit dari aplikasi authenticator
3. **Passkey/WebAuthn** - Login tanpa password (fingerprint/face)
4. **Rate Limiting** - Mencegah spam dan brute force
5. **CORS** - Membatasi siapa yang bisa akses API
6. **Sudo Mode** - Re-autentikasi untuk aksi sensitif

---

## 💰 Model Bisnis: Token AI

Aleph Assistant adalah fitur **berbayar per token**:

1. User mendaftar → Dapat saldo wallet kosong
2. User membeli token package → Saldo bertambah
3. User chat dengan AI → Token dikurangi per request
4. Pricing berbeda per model AI (GPT-4 lebih mahal dari Llama)

---

## 🏢 Perbandingan dengan Produk Besar

| Fitur | Alephdraad | Reddit | Discord | GitHub |
|-------|------------|--------|---------|--------|
| Thread/Post | ✅ | ✅ | ✅ | ✅ (Issues) |
| Nested Reply | ✅ (depth 3) | ✅ | ✅ | ✅ |
| Reactions | ✅ (5 types) | ✅ | ✅ | ✅ |
| AI Assistant | ✅ (Aleph) | ❌ | ❌ | ✅ (Copilot) |
| 2FA/Passkey | ✅ | ✅ | ✅ | ✅ |
| Wallet/Token | ✅ | ❌ | ✅ (Nitro) | ❌ |

---

## 📁 Struktur Folder Repository

```
monorepo-root/
├── frontend/           # Aplikasi web (Next.js)
│   ├── app/            # Halaman-halaman
│   ├── components/     # Komponen UI
│   └── lib/            # Utility & hooks
│
├── backend/            # Backend utama (Go/Gin)
│   ├── handlers/       # Request handlers
│   ├── services/       # Business logic
│   ├── middleware/     # Auth, rate limit
│   ├── models/         # Data models
│   └── ent/            # Ent ORM schemas
│
├── feature-service/    # Microservice (ASP.NET)
│   └── src/
│       └── FeatureService.Api/
│           ├── Controllers/
│           ├── Services/
│           └── Models/
│
└── docs/               # Dokumentasi (Anda di sini!)
```

---

## ▶️ Selanjutnya

- [01_GLOSSARY.md](./01_GLOSSARY.md) - Pelajari istilah-istilah teknis
- [02_TECH_STACK.md](./02_TECH_STACK.md) - Detail teknologi yang dipakai
- [03_HOW_SYSTEMS_CONNECT.md](./03_HOW_SYSTEMS_CONNECT.md) - Cara sistem terhubung

