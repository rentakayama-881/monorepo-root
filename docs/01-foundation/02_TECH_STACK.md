# 🛠️ Technology Stack (Tech Stack)

> Dokumen ini menjelaskan semua teknologi yang digunakan dalam proyek Alephdraad.

---

## 📊 Ringkasan Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  Next.js 15 • React 19 • Tailwind CSS 4 • Vercel                │
├─────────────────────────────────────────────────────────────────┤
│                       BACKEND                                   │
│  Go 1.22 + Gin │ C# + ASP.NET Core 8                            │
├─────────────────────────────────────────────────────────────────┤
│                      DATABASE                                   │
│  PostgreSQL (Neon) │ MongoDB                                    │
├─────────────────────────────────────────────────────────────────┤
│                     EXTERNAL SERVICES                           │
│  HuggingFace • n8n Webhook • Supabase Storage                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💻 Frontend Stack

### Next.js 15
| Aspek | Detail |
|-------|--------|
| **Versi** | 15.5.9 |
| **Kegunaan** | Framework React untuk aplikasi web |
| **Fitur Utama** | App Router, Server Components, Turbopack |
| **Referensi** | [nextjs.org/docs](https://nextjs.org/docs) |

**Mengapa Next.js?**
- ✅ SEO-friendly (Server-Side Rendering)
- ✅ Performa tinggi dengan Turbopack
- ✅ Developer experience yang baik
- ✅ Deploy mudah ke Vercel
- ✅ File-based routing

### React 19
| Aspek | Detail |
|-------|--------|
| **Versi** | 19.1.0 |
| **Kegunaan** | Library untuk membangun UI |
| **Fitur Utama** | Server Components, Actions, Suspense |
| **Referensi** | [react.dev](https://react.dev) |

### Tailwind CSS 4
| Aspek | Detail |
|-------|--------|
| **Versi** | 4.x |
| **Kegunaan** | Utility-first CSS framework |
| **Fitur Utama** | Container queries, Typography plugin |
| **Referensi** | [tailwindcss.com](https://tailwindcss.com) |

**Mengapa Tailwind?**
- ✅ Cepat dalam styling
- ✅ Konsisten (design system)
- ✅ Bundle size kecil (hanya class yang dipakai)

### Markdown Libraries
| Library | Kegunaan |
|---------|----------|
| `react-markdown` | Render markdown ke HTML |
| `remark-gfm` | GitHub Flavored Markdown |
| `rehype-highlight` | Syntax highlighting |

### Hosting: Vercel
| Aspek | Detail |
|-------|--------|
| **Kegunaan** | Platform deployment untuk Next.js |
| **Fitur** | Auto-deploy, Preview URLs, Edge Functions |
| **Pricing** | Free tier tersedia |
| **Referensi** | [vercel.com](https://vercel.com) |

---

## ⚙️ Backend Stack #1: Go + Gin

### Go (Golang)
| Aspek | Detail |
|-------|--------|
| **Versi** | 1.22+ |
| **Kegunaan** | Bahasa pemrograman untuk backend |
| **Kelebihan** | Cepat, compiled, concurrency |
| **Referensi** | [go.dev](https://go.dev) |

**Mengapa Go?**
- ✅ Performa tinggi (compiled language)
- ✅ Concurrency mudah (goroutines)
- ✅ Binary tunggal (mudah deploy)
- ✅ Standar library lengkap

### Gin Framework
| Aspek | Detail |
|-------|--------|
| **Kegunaan** | HTTP web framework untuk Go |
| **Fitur** | Routing, middleware, validation |
| **Referensi** | [gin-gonic.com](https://gin-gonic.com) |

### GORM (ORM)
| Aspek | Detail |
|-------|--------|
| **Kegunaan** | Object-Relational Mapping |
| **Database** | PostgreSQL |
| **Status** | Legacy (sedang migrasi ke Ent) |
| **Referensi** | [gorm.io](https://gorm.io) |

### Ent (ORM Modern)
| Aspek | Detail |
|-------|--------|
| **Kegunaan** | Code-generated ORM |
| **Kelebihan** | Type-safe, graph-based |
| **Status** | Migrasi bertahap |
| **Referensi** | [entgo.io](https://entgo.io) |

### Libraries Lainnya
| Library | Kegunaan |
|---------|----------|
| `gin-contrib/cors` | CORS handling |
| `joho/godotenv` | Environment variables |
| `go-webauthn/webauthn` | Passkey/WebAuthn |
| `uber-go/zap` | Structured logging |
| `golang-jwt/jwt` | JWT handling |

---

## 🔷 Backend Stack #2: ASP.NET Core

### C# dan .NET 8
| Aspek | Detail |
|-------|--------|
| **Versi** | .NET 8.0 |
| **Kegunaan** | Runtime dan bahasa untuk backend |
| **Kelebihan** | Enterprise-ready, tooling bagus |
| **Referensi** | [docs.microsoft.com/dotnet](https://docs.microsoft.com/dotnet) |

**Mengapa ASP.NET Core?**
- ✅ Enterprise-grade dan battle-tested
- ✅ Ekosistem C# yang mature
- ✅ Dependency injection built-in
- ✅ Cocok untuk microservices

### Libraries Utama
| Library | Kegunaan |
|---------|----------|
| `MongoDB.Driver` | MongoDB client |
| `FluentValidation` | Input validation |
| `Serilog` | Structured logging |
| `NUlid` | ULID generation |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | JWT authentication |

---

## 🗄️ Database Stack

### PostgreSQL (via Neon)
| Aspek | Detail |
|-------|--------|
| **Versi** | 15+ |
| **Hosting** | Neon (serverless) |
| **Kegunaan** | Data relasional (user, thread, category) |
| **Referensi** | [neon.tech](https://neon.tech) |

**Data yang disimpan:**
- Users dan credentials
- Threads dan categories
- Sessions dan passkeys
- Security events

### MongoDB
| Aspek | Detail |
|-------|--------|
| **Versi** | 7.0+ |
| **Kegunaan** | Data dokumen (reply, reaction, chat) |
| **Referensi** | [mongodb.com](https://mongodb.com) |

**Data yang disimpan:**
- Replies dan reactions
- Chat sessions dan messages
- Token balances dan transactions
- Reports dan moderation

### Mengapa Dua Database?

| PostgreSQL | MongoDB |
|------------|---------|
| Relasi kompleks (user-thread-category) | Dokumen fleksibel (chat messages) |
| ACID transactions penting | Skema sering berubah |
| Query kompleks dengan JOIN | Nested documents |

---

## 🤖 AI/ML Stack

### HuggingFace (Free Tier)
| Aspek | Detail |
|-------|--------|
| **Model** | Llama-3.3-70B-Instruct |
| **Kegunaan** | AI chat gratis |
| **Referensi** | [huggingface.co](https://huggingface.co) |

### External LLM (Berbayar)
| Provider | Model |
|----------|-------|
| OpenAI | GPT-4o, GPT-4o-mini |
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku |
| Google | Gemini Pro, Gemini Flash |
| Meta | Llama 3 70B |
| Deepseek | Deepseek V3 |
| Mistral | Mistral Large |

**Integrasi via n8n webhook** - Platform workflow automation.

### Vector Search (RAG)
| Aspek | Detail |
|-------|--------|
| **Kegunaan** | Semantic search threads |
| **Embedding** | HuggingFace embeddings |
| **Storage** | PostgreSQL pgvector |

---

## 🔐 Security Stack

### JWT Authentication
| Aspek | Detail |
|-------|--------|
| **Library (Go)** | golang-jwt/jwt |
| **Library (.NET)** | Microsoft JWT Bearer |
| **Shared Secret** | Kedua backend pakai secret yang sama |

### TOTP (2FA)
| Aspek | Detail |
|-------|--------|
| **Standard** | RFC 6238 |
| **Kompatibel** | Google Authenticator, Authy |

### WebAuthn/Passkey
| Aspek | Detail |
|-------|--------|
| **Library** | go-webauthn/webauthn |
| **Kegunaan** | Passwordless login |

---

## 🔧 Development Tools

### Package Managers
| Tool | Untuk |
|------|-------|
| npm | Frontend (Node.js) |
| go mod | Backend Go |
| NuGet | Backend .NET |

### Linting & Formatting
| Tool | Untuk |
|------|-------|
| ESLint | JavaScript/TypeScript |
| Prettier | Code formatting |
| golangci-lint | Go linting |

### Build Tools
| Tool | Kegunaan |
|------|----------|
| Turbopack | Next.js bundler (fast) |
| Docker | Containerization |
| docker-compose | Local development |

---

## 🌐 External Services

| Service | Kegunaan |
|---------|----------|
| **Vercel** | Frontend hosting |
| **Neon** | PostgreSQL hosting |
| **MongoDB Atlas** | MongoDB hosting (opsional) |
| **Supabase Storage** | File storage (planned) |
| **n8n** | Workflow automation untuk LLM |
| **HuggingFace** | AI model hosting |

---

## 📦 Dependency Versions

### Frontend (`package.json`)
```json
{
  "next": "15.5.9",
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "tailwindcss": "^4",
  "react-markdown": "^10.1.0"
}
```

### Backend Go (`go.mod`)
```go
require (
    github.com/gin-gonic/gin v1.9.1
    gorm.io/gorm v1.25.x
    entgo.io/ent v0.13.x
    github.com/go-webauthn/webauthn v0.10.x
)
```

### Feature Service (`.csproj`)
```xml
<PackageReference Include="MongoDB.Driver" Version="2.x" />
<PackageReference Include="FluentValidation" Version="11.x" />
<PackageReference Include="Serilog" Version="3.x" />
```

---

## 🏢 Perbandingan dengan Tech Stack Perusahaan Besar

| Aspek | Alephdraad | GitHub | Discord | Stripe |
|-------|------------|--------|---------|--------|
| **Frontend** | Next.js | React | React | React |
| **Backend** | Go, C# | Ruby, Go | Elixir, Rust | Ruby, Go |
| **Database** | Postgres, Mongo | MySQL, Redis | Cassandra, Postgres | Postgres, Redis |
| **Hosting** | Vercel | Azure | GCP | AWS |

---

## ▶️ Selanjutnya

- [03_HOW_SYSTEMS_CONNECT.md](./03_HOW_SYSTEMS_CONNECT.md) - Cara sistem terhubung
- [04_AUTHENTICATION_FLOW.md](./04_AUTHENTICATION_FLOW.md) - Alur autentikasi
