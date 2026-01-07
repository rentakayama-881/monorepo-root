# 🚂 Railway Deployment

> Cara deploy Backend Gin dan Feature Service ke Railway.

---

## 🎯 Kenapa Railway?

- **Simple deployment** - Connect GitHub dan deploy
- **Multi-language** - Go, .NET, Node.js, Python, dll
- **Free tier** - $5 credit gratis per bulan
- **Auto-scaling** - Scale sesuai traffic
- **Custom domains** - Gratis SSL

---

## 📦 Deploy Backend Gin (Go)

### Step 1: Create Project

1. Login ke [railway.app](https://railway.app)
2. Klik **"New Project"**
3. Pilih **"Deploy from GitHub repo"**
4. Connect repository

### Step 2: Configure Service

```
Root Directory: backend
Start Command: ./backend-gin
```

Railway akan auto-detect Go dan build otomatis.

### Step 3: Environment Variables

```bash
# Server
PORT=8080

# Database
DATABASE_URL=postgres://...@....neon.tech/alephdraad?sslmode=require

# JWT (HARUS SAMA dengan Feature Service)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_ISSUER=alephdraad-api
JWT_AUDIENCE=alephdraad-users

# Admin
ADMIN_JWT_SECRET=different_admin_secret_key

# WebAuthn
WEBAUTHN_RP_ID=alephdraad.fun
WEBAUTHN_RP_ORIGIN=https://alephdraad.fun
WEBAUTHN_RP_NAME=Alephdraad

# CORS
FRONTEND_BASE_URL=https://alephdraad.fun
CORS_ALLOWED_ORIGINS=https://alephdraad.fun,https://www.alephdraad.fun

# Email (Resend)
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@alephdraad.fun

# Feature flags
USE_ENT_ORM=true
```

### Step 4: Custom Domain

1. Settings → Domains
2. Add: `api.alephdraad.fun`
3. Configure DNS di Cloudflare:

```
Type: CNAME
Name: api
Target: [railway-provided-domain].up.railway.app
Proxy: OFF
```

---

## 📦 Deploy Feature Service (ASP.NET Core)

### Step 1: Create New Service

Di project yang sama, klik **"+ New Service"** → Deploy from GitHub.

### Step 2: Configure Service

```
Root Directory: feature-service/src/FeatureService.Api
Start Command: dotnet FeatureService.Api.dll
```

Atau menggunakan Dockerfile:

```dockerfile
# feature-service/Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5000

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/FeatureService.Api/FeatureService.Api.csproj", "FeatureService.Api/"]
RUN dotnet restore "FeatureService.Api/FeatureService.Api.csproj"
COPY src/ .
WORKDIR "/src/FeatureService.Api"
RUN dotnet build -c Release -o /app/build

FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FeatureService.Api.dll"]
```

### Step 3: Environment Variables

```bash
# Server
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:5000

# MongoDB
MONGODB_CONNECTION_STRING=mongodb+srv://...@cluster.mongodb.net/alephdraad
MONGODB_DATABASE_NAME=alephdraad

# JWT (HARUS SAMA dengan Backend Gin)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_ISSUER=alephdraad-api
JWT_AUDIENCE=alephdraad-users

# AI Services
HUGGINGFACE_API_KEY=hf_xxxxx
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/chat

# CORS
CORS_ORIGINS=https://alephdraad.fun,https://www.alephdraad.fun
```

### Step 4: Custom Domain

```
Type: CNAME
Name: feature
Target: [railway-provided-domain].up.railway.app
```

---

## 🔄 CI/CD Pipeline

Railway auto-deploy saat push ke `main`:

```
Push to main
    │
    ▼
Railway detects change
    │
    ▼
Build container
    │
    ▼
Run health check
    │
    ▼
Switch traffic (zero-downtime)
```

---

## 📊 Railway Limits

### Free Tier ($5/month credit)

| Resource | Limit |
|----------|-------|
| RAM | 512 MB |
| vCPU | 0.5 |
| Disk | 1 GB |
| Egress | 100 GB |

### Starter ($5/month + usage)

| Resource | Price |
|----------|-------|
| RAM | $0.000231/GB/min |
| vCPU | $0.000463/vCPU/min |
| Disk | $0.000231/GB/min |

---

## 🔍 Monitoring

### Logs

```bash
# View logs di Railway Dashboard
# Atau dengan CLI:
railway logs --service backend-gin
```

### Metrics

Railway Dashboard → Service → Metrics:
- CPU usage
- Memory usage
- Network I/O

### Health Checks

Pastikan endpoint health tersedia:

```go
// Backend Gin
api.GET("/health", func(c *gin.Context) {
    c.JSON(200, gin.H{"status": "ok"})
})
```

```csharp
// Feature Service
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "ok" }));
```

---

## 🔧 Troubleshooting

### Build Failed

```
1. Check build logs
2. Pastikan Dockerfile/Procfile benar
3. Pastikan dependencies tersedia
```

### Container Crash

```
1. Check logs untuk error
2. Pastikan PORT environment variable diset
3. Pastikan memory cukup
```

### Database Connection Failed

```
1. Whitelist Railway IP di database provider
   - Neon: Project Settings → IP Allow
   - MongoDB Atlas: Network Access → Add IP

2. Check connection string format
3. Pastikan SSL enabled jika required
```

---

## 🚀 Deployment Commands (CLI)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Open shell
railway shell
```

---

## ▶️ Selanjutnya

- [73_DATABASE_SETUP.md](./73_DATABASE_SETUP.md) - Database configuration
- [74_ENVIRONMENT_VARIABLES.md](./74_ENVIRONMENT_VARIABLES.md) - Complete env vars
