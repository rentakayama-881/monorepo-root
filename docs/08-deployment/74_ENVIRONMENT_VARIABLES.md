# 🔐 Environment Variables

> Daftar lengkap semua environment variables yang dibutuhkan.

---

## 📦 Frontend (Next.js)

Lokasi: `frontend/.env.local`

```bash
#============================================
# API Endpoints
#============================================
NEXT_PUBLIC_API_BASE_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature.alephdraad.fun

#============================================
# Analytics (optional)
#============================================
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

#============================================
# Feature Flags (optional)
#============================================
NEXT_PUBLIC_ENABLE_AI_CHAT=true
NEXT_PUBLIC_ENABLE_PASSKEY=true
```

**Catatan**: 
- Prefix `NEXT_PUBLIC_` = accessible di browser
- Tanpa prefix = server-side only

---

## 🚀 Backend Gin (Go)

Lokasi: `backend/.env`

```bash
#============================================
# Server Configuration
#============================================
PORT=8080
GIN_MODE=release  # "debug" untuk development

#============================================
# Database (PostgreSQL via Neon)
#============================================
DATABASE_URL=postgres://user:password@host.neon.tech/alephdraad?sslmode=require

#============================================
# JWT Configuration
# ⚠️ HARUS SAMA dengan Feature Service!
#============================================
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_ISSUER=alephdraad-api
JWT_AUDIENCE=alephdraad-users
JWT_ACCESS_EXPIRY=15m    # 15 minutes
JWT_REFRESH_EXPIRY=168h  # 7 days

#============================================
# Admin JWT (separate secret)
#============================================
ADMIN_JWT_SECRET=different_admin_secret_key_also_32_chars

#============================================
# WebAuthn / Passkey
#============================================
WEBAUTHN_RP_ID=alephdraad.fun
WEBAUTHN_RP_ORIGIN=https://alephdraad.fun
WEBAUTHN_RP_NAME=Alephdraad

#============================================
# CORS
#============================================
FRONTEND_BASE_URL=https://alephdraad.fun
CORS_ALLOWED_ORIGINS=https://alephdraad.fun,https://www.alephdraad.fun

#============================================
# Email (Resend)
#============================================
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@alephdraad.fun

#============================================
# Feature Flags
#============================================
USE_ENT_ORM=true  # Use Ent instead of GORM

#============================================
# Security
#============================================
BCRYPT_COST=12
RATE_LIMIT_ENABLED=true
```

---

## ⚙️ Feature Service (ASP.NET Core)

Lokasi: `feature-service/.env` atau `appsettings.json`

```bash
#============================================
# Server Configuration
#============================================
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:5000

#============================================
# Database (MongoDB Atlas)
#============================================
MONGODB_CONNECTION_STRING=mongodb+srv://user:password@cluster.mongodb.net/alephdraad
MONGODB_DATABASE_NAME=alephdraad

#============================================
# JWT Configuration
# ⚠️ HARUS SAMA dengan Backend Gin!
#============================================
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_ISSUER=alephdraad-api
JWT_AUDIENCE=alephdraad-users

#============================================
# AI Services
#============================================
# HuggingFace (free tier)
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxx

# n8n Webhook (for external LLMs)
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/chat

#============================================
# CORS
#============================================
CORS_ORIGINS=https://alephdraad.fun,https://www.alephdraad.fun

#============================================
# Logging
#============================================
SERILOG_MINIMUM_LEVEL=Information
```

---

## 🔄 JWT Synchronization

**CRITICAL**: Backend Gin dan Feature Service HARUS menggunakan JWT config yang SAMA:

```
┌──────────────────┐          ┌──────────────────┐
│   Backend Gin    │          │  Feature Service │
├──────────────────┤          ├──────────────────┤
│ JWT_SECRET       │ ═══════> │ JWT_SECRET       │
│ JWT_ISSUER       │ ═══════> │ JWT_ISSUER       │
│ JWT_AUDIENCE     │ ═══════> │ JWT_AUDIENCE     │
└──────────────────┘          └──────────────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
              Same values!
```

Jika berbeda, token dari satu service tidak akan valid di service lain.

---

## 📋 Environment-specific Values

### Development

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_FEATURE_API_URL=http://localhost:5000

# Backend Gin
DATABASE_URL=postgres://postgres:postgres@localhost:5432/alephdraad
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_ORIGIN=http://localhost:3000

# Feature Service
MONGODB_CONNECTION_STRING=mongodb://localhost:27017/alephdraad
```

### Staging

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api-staging.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature-staging.alephdraad.fun
```

### Production

```bash
# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api.alephdraad.fun
NEXT_PUBLIC_FEATURE_API_URL=https://feature.alephdraad.fun
```

---

## 🔐 Secret Management

### DO NOT commit secrets to Git!

```bash
# .gitignore
.env
.env.local
.env.production
*.pem
*.key
```

### Use platform secret management:

| Platform | Feature |
|----------|---------|
| Vercel | Environment Variables |
| Railway | Variables tab |
| GitHub | Actions Secrets |

### Generate secure secrets:

```bash
# Generate random 32-char secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## ✅ Validation Checklist

```
[ ] JWT_SECRET minimal 32 characters
[ ] JWT_SECRET sama di Backend Gin dan Feature Service
[ ] DATABASE_URL format benar dengan sslmode
[ ] MONGODB_CONNECTION_STRING format benar
[ ] CORS origins include semua frontend URLs
[ ] WebAuthn RP_ID match dengan domain
[ ] Email API key valid
[ ] HuggingFace API key valid
```

---

## 🔧 Troubleshooting

### "Invalid JWT"

```
→ Pastikan JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE sama di kedua service
```

### "Database connection failed"

```
→ Check DATABASE_URL format
→ Check SSL mode (sslmode=require untuk Neon)
→ Check IP whitelist
```

### "CORS error"

```
→ Pastikan frontend URL ada di CORS_ALLOWED_ORIGINS
→ Include dengan dan tanpa www
```

---

## ▶️ Selanjutnya

- [../09-improvements/80_CURRENT_ISSUES.md](../09-improvements/80_CURRENT_ISSUES.md) - Known issues
- [../10-roadmap/90_FUTURE_FEATURES.md](../10-roadmap/90_FUTURE_FEATURES.md) - Planned features
