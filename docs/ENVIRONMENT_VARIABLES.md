# Environment Variables Documentation

This document lists all required and optional environment variables for the AIValid platform.

---

## 🔧 Go Backend (`backend/`)

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 chars) | `your-super-secret-jwt-key-min-32-chars` |
| `JWT_ISSUER` | JWT issuer (`iss`) claim (must match Feature Service `JWT__ISSUER`) | `api.aivalid.id` |
| `JWT_AUDIENCE` | JWT audience (`aud`) claim (must match Feature Service `JWT__AUDIENCE`) | `aivalid-clients` |
| `ADMIN_JWT_SECRET` | Secret key for admin JWT tokens (shared with Feature Service) | `admin-jwt-secret-key-32-chars-min` |
| `DATABASE_URL` | Full PostgreSQL connection URL | `postgres://user:pass@host:5432/dbname?sslmode=require` |
| `FRONTEND_BASE_URL` | Frontend URL for CORS and redirects | `https://aivalid.id` |

### Database (Alternative to DATABASE_URL)

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database username | - |
| `DB_PASS` | Database password | - |
| `DB_NAME` | Database name | - |
| `DB_SSLMODE` | SSL mode | `disable` |
| `DB_TIMEZONE` | Timezone | `Asia/Jakarta` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BIND_ADDR` | Bind address for the HTTP server (keep `127.0.0.1` behind Nginx) | `127.0.0.1` |
| `PORT` | Server port | `8080` |
| `GIN_MODE` | Gin framework mode | `release` |
| `LOG_LEVEL` | Logging level | `info` |
| `VERSION` | App version | `1.0.0` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins | Same as FRONTEND_BASE_URL |
| `TRUSTED_PROXIES` | Comma-separated proxy IPs/CIDRs to trust for `X-Forwarded-For` (set to `127.0.0.1,::1` behind local Nginx; set to `none` to disable) | `127.0.0.1,::1` |

### Redis (Optional - graceful degradation)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Full Redis connection URL | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |

### WebAuthn / Passkeys

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBAUTHN_RP_ID` | Relying Party ID (domain) | `localhost` |
| `WEBAUTHN_RP_NAME` | Relying Party display name | `AIValid` |
| `WEBAUTHN_RP_ORIGIN` | Single allowed origin | Same as FRONTEND_BASE_URL |
| `WEBAUTHN_RP_ORIGINS` | Comma-separated origins | - |

### Email (Resend)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `RESEND_API_KEY` | Resend API key | `re_xxxxx` | Yes (for production) |
| `RESEND_FROM_EMAIL` | Sender email address (must be verified in Resend) | `noreply@aivalid.id` | Yes (for production) |
| `RESEND_FROM_NAME` | Sender display name (shown in email client) | `AIValid` | No (defaults to "AIValid") |

#### Email Configuration Best Practices

1. **Domain Verification**: Ensure your sending domain is verified in Resend dashboard
2. **Sender Name**: Always set `RESEND_FROM_NAME` to maintain consistent branding and improve deliverability
3. **Email Format**: System automatically formats emails as "Display Name <email@domain.com>"
4. **Development Mode**: If `RESEND_API_KEY` is not set, emails are logged to console instead of being sent
5. **Queue System**: Emails are sent asynchronously using a worker queue (3 workers by default)
6. **Monitoring**: Check logs for queue delays > 5 seconds as they indicate potential issues

#### Common Issues and Solutions

**Issue**: Emails delayed or missing profile picture
- **Solution**: Set `RESEND_FROM_NAME` environment variable
- **Reason**: Without sender name, email clients may not properly display sender information

**Issue**: Emails going to spam
- **Solution**: 
  1. Verify your domain in Resend dashboard
  2. Set up SPF, DKIM, and DMARC records
  3. Use a professional sender name with `RESEND_FROM_NAME`
  4. Avoid using default Resend test email in production

**Issue**: Email queue delays
- **Solution**: Check logs for warnings about queue duration > 5s
- **Reason**: May indicate high load or Resend API issues

### Supabase Storage

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `SUPABASE_BUCKET` | Storage bucket name | `avatars` |

### Feature Service Integration

| Variable | Description | Default |
|----------|-------------|---------|
| `FEATURE_SERVICE_URL` | URL of ASP.NET Feature Service | `http://localhost:5000` |

---

## 🔷 Feature Service (`feature-service/`)

### Configuration in `appsettings.json`

```json
{
  "MongoDB": {
    "ConnectionString": "mongodb://127.0.0.1:27017",
    "DatabaseName": "feature_service_db"
  },
  "Jwt": {
    "Secret": "same-as-go-backend-jwt-secret",
    "Issuer": "api.aivalid.id",
    "Audience": "aivalid-clients",
    "AdminSecret": "same-as-go-backend-admin-jwt-secret"
  },
  "Cors": {
    "AllowedOrigins": [
      "https://aivalid.id",
      "http://localhost:3000"
    ]
  }
}
```

### Environment Variables (Docker/Kestrel)

| Variable | Description | Default |
|----------|-------------|---------|
| `ASPNETCORE_ENVIRONMENT` | Environment name | `Production` |
| `ASPNETCORE_URLS` | Binding URLs | `http://+:5000` |
| `MONGODB__CONNECTIONSTRING` | MongoDB connection string | - |
| `MONGODB__DATABASENAME` | MongoDB database name | `feature_service_db` |
| `JWT__SECRET` | JWT secret (must match Go backend) | - |
| `ADMIN_JWT_SECRET` | Admin JWT secret (must match Go backend) | - |
| `REDIS__CONNECTIONSTRING` | Redis connection string/URL (recommended: `rediss://...`) | - |
| `REDIS__REQUIRETLS` | Require TLS for non-local Redis endpoints | `true` |

---

## ⚛️ Frontend (`frontend/`)

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Go backend API URL | `https://api.aivalid.id` |
| `NEXT_PUBLIC_FEATURE_SERVICE_URL` | Feature Service URL | `https://feature.aivalid.id` |
| `NEXT_PUBLIC_SITE_URL` | Frontend site URL | `https://aivalid.id` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `NEXT_PUBLIC_API_URL` | Alias for API_BASE_URL | - |
| `NEXT_PUBLIC_FEATURE_API_URL` | Alias for FEATURE_SERVICE_URL | - |
| `PREBUILD_HEALTHCHECK_STRICT` | Fail build when API health check fails (`false` default on Vercel, `true` elsewhere) | auto |
| `PREBUILD_HEALTHCHECK_TIMEOUT_MS` | Timeout for prebuild API health check request | `10000` |
| `SKIP_PREBUILD_CHECK` | Skip prebuild API health check (emergency use only) | `false` |
| `API_HEALTH_PATH` | Health path used by prebuild check | `/api/health` |

---

## 🔐 Security Notes

1. **Never commit `.env` files** - Use `.env.example` as template
2. **JWT secrets must match** between Go backend and Feature Service
3. **JWT_ISSUER and JWT_AUDIENCE must match** between Go backend and Feature Service
4. **ADMIN_JWT_SECRET** is used by Go backend to sign admin tokens and by Feature Service to verify them
5. **Minimum key lengths**: JWT secrets should be at least 32 characters
6. **In production**: Use environment variables directly, not `.env` files

---

## 📋 Quick Start Checklist

### Development

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, ADMIN_JWT_SECRET, DATABASE_URL, FRONTEND_BASE_URL

# Feature Service
# Edit appsettings.Development.json with local MongoDB and matching JWT secrets

# Frontend
cp frontend/.env.example frontend/.env.local
# Fill in: NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_FEATURE_SERVICE_URL
```

### Production Deployment

1. ✅ Set all required environment variables in deployment platform
2. ✅ Ensure JWT_SECRET matches across Go backend and Feature Service
3. ✅ Ensure ADMIN_JWT_SECRET matches across Go backend and Feature Service  
4. ✅ Configure CORS_ALLOWED_ORIGINS for production domains
5. ✅ Set GIN_MODE=release for Go backend
6. ✅ Set ASPNETCORE_ENVIRONMENT=Production for Feature Service
7. ✅ Configure SSL/TLS for all services
