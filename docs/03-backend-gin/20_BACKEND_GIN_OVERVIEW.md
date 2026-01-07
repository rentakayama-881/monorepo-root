# 🚀 Backend Gin Overview

> Dokumentasi struktur dan arsitektur Backend Gin (Go).

---

## 🎯 Apa itu Backend Gin?

Backend Gin adalah **backend utama** Alephdraad yang dibangun menggunakan:
- **Bahasa**: Go (Golang) 1.22+
- **Framework**: Gin - HTTP web framework tercepat untuk Go
- **Database ORM**: GORM (legacy) + Ent (migrasi bertahap)
- **Database**: PostgreSQL via Neon serverless

---

## 📂 Struktur Folder

```
backend/
├── main.go              # Entry point aplikasi
├── go.mod               # Go module dependencies
├── go.sum               # Dependency checksums
│
├── cmd/                 # CLI commands
│   └── seed_admin/      # Seed admin user
│
├── config/              # Konfigurasi aplikasi
│   └── config.go
│
├── database/            # Database connections
│   ├── db.go            # GORM connection
│   └── ent.go           # Ent connection
│
├── dto/                 # Data Transfer Objects
│   ├── auth.go
│   ├── passkey.go
│   └── ...
│
├── ent/                 # Ent ORM schema & generated code
│   ├── schema/          # Schema definitions
│   └── ...              # Generated files
│
├── errors/              # Custom error types
│   └── errors.go
│
├── handlers/            # HTTP request handlers
│   ├── auth_handler.go
│   ├── thread_handler.go
│   ├── user_handler.go
│   └── ...
│
├── logger/              # Logging dengan Zap
│   └── logger.go
│
├── middleware/          # HTTP middlewares
│   ├── auth.go          # JWT authentication
│   ├── cors.go          # CORS handling
│   ├── rate_limit.go    # Rate limiting
│   └── ...
│
├── models/              # GORM models (legacy)
│   ├── user.go
│   ├── thread.go
│   └── ...
│
├── services/            # Business logic layer
│   ├── auth_service.go
│   ├── thread_service.go
│   ├── user_service.go
│   └── ...
│
├── utils/               # Utility functions
│   └── ...
│
├── validators/          # Input validation
│   └── ...
│
└── worker/              # Background workers
    └── ...
```

---

## 🔄 Request Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        HTTP Request                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Gin Router                                  │
│  • CORS middleware                                               │
│  • Security headers                                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Middlewares                                  │
│  • Rate limiting                                                 │
│  • Auth (JWT parsing)                                            │
│  • Sudo verification (for critical actions)                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Handler                                     │
│  • Parse request body                                            │
│  • Validate input                                                │
│  • Call service                                                  │
│  • Return response                                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Service                                     │
│  • Business logic                                                │
│  • Orchestrate database calls                                    │
│  • Coordinate multiple operations                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Database Layer                                │
│  • GORM (legacy models)                                          │
│  • Ent (new migrations)                                          │
│  • PostgreSQL queries                                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tanggung Jawab Backend Gin

| Domain | Fitur |
|--------|-------|
| **Autentikasi** | Login, Register, JWT, Refresh Token |
| **2FA** | TOTP, Backup Codes |
| **Passkey** | WebAuthn registration & login |
| **Sudo Mode** | Re-authentication for critical actions |
| **Users** | Profile, Avatar, Username |
| **Threads** | CRUD, Categories, Public/Private |
| **Badges** | User achievements |
| **Admin** | User management, Badge assignment |
| **RAG Search** | AI-powered thread search & explain |

---

## 🔌 Integrasi Dengan Service Lain

```
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Gin                               │
└─────────────────────────────────────────────────────────────────┘
         │                                          │
         │ PostgreSQL                               │ JWT Validation
         ▼                                          ▼
┌─────────────────┐                     ┌─────────────────────────┐
│  Neon Database  │                     │    Feature Service      │
│  (PostgreSQL)   │                     │    (ASP.NET Core)       │
└─────────────────┘                     └─────────────────────────┘
```

**Penting**: Backend Gin dan Feature Service berbagi JWT secret yang sama untuk validasi token.

---

## 📊 Dependency Graph

```go
// main.go initialization order
godotenv.Load()           // Load .env
logger.InitLogger()       // Zap logger
database.InitDB()         // GORM connection
database.InitEntDB()      // Ent connection
config.InitConfig()       // App config

// Services (dependency injection)
authService     = services.NewAuthService(db)
sessionService  = services.NewSessionService(db)
totpService     = services.NewTOTPService(db, logger)
sudoService     = services.NewSudoService(db, logger, totpService)
passkeyService  = services.NewPasskeyService(db, logger, rpID, rpOrigin, rpName)
userService     = services.NewUserService(db)
threadService   = services.NewThreadService(db) // atau NewEntThreadService()

// Handlers
authHandler    = handlers.NewAuthHandler(authService, sessionService)
userHandler    = handlers.NewUserHandler(userService)
threadHandler  = handlers.NewThreadHandler(threadService)
totpHandler    = handlers.NewTOTPHandler(totpService, logger)
passkeyHandler = handlers.NewPasskeyHandler(passkeyService, authService, logger)
sudoHandler    = handlers.NewSudoHandler(sudoService, logger)
```

---

## 🔧 Environment Variables

| Variable | Deskripsi | Contoh |
|----------|-----------|--------|
| `PORT` | Port server | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://...` |
| `JWT_SECRET` | Secret untuk JWT | `super_secret_key` |
| `JWT_ISSUER` | JWT issuer claim | `alephdraad-api` |
| `JWT_AUDIENCE` | JWT audience claim | `alephdraad-users` |
| `ADMIN_JWT_SECRET` | Secret untuk admin JWT | `admin_super_secret` |
| `WEBAUTHN_RP_ID` | WebAuthn Relying Party ID | `alephdraad.fun` |
| `WEBAUTHN_RP_ORIGIN` | WebAuthn origin | `https://alephdraad.fun` |
| `WEBAUTHN_RP_NAME` | WebAuthn display name | `Alephdraad` |
| `FRONTEND_BASE_URL` | Frontend URL untuk CORS | `https://alephdraad.fun` |
| `CORS_ALLOWED_ORIGINS` | Allowed origins (comma-separated) | `https://...` |
| `USE_ENT_ORM` | Use Ent instead of GORM | `true` |

---

## 🏃 Menjalankan Backend

### Development

```bash
cd backend
go mod download           # Download dependencies
go run main.go           # Run server

# Atau dengan hot reload (air)
air
```

### Build Production

```bash
go build -o backend-gin .
./backend-gin
```

### Seed Admin User

```bash
go run cmd/seed_admin/main.go
```

---

## ▶️ Selanjutnya

- [21_BACKEND_GIN_ROUTES.md](./21_BACKEND_GIN_ROUTES.md) - Daftar lengkap routes
- [22_BACKEND_GIN_HANDLERS.md](./22_BACKEND_GIN_HANDLERS.md) - Handler documentation
- [23_BACKEND_GIN_SERVICES.md](./23_BACKEND_GIN_SERVICES.md) - Service layer
