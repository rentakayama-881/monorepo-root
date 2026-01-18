# Deployment Guide

Panduan deployment untuk AlephDraad setelah melakukan perubahan kode.

## Quick Reference

| Service | VPS | SSH Command | URL |
|---------|-----|-------------|-----|
| Go Backend (Gin) | 72.62.124.23 | `ssh deploy@72.62.124.23` | https://api.alephdraad.fun |
| Feature Service (ASP.NET) | 203.175.11.84 | `ssh asp@203.175.11.84` | https://feature.alephdraad.fun |
| Frontend (Next.js) | Vercel | Auto-deploy | https://www.alephdraad.my.id |

---

## 1. Frontend (Next.js) - Vercel

**Auto-deploy**: Tidak perlu aksi manual. Push ke `main` branch → Vercel otomatis deploy.

```bash
# Dari lokal (Windows)
git add -A
git commit -m "your message"
git push renta main
```

Tunggu ~1-2 menit untuk Vercel selesai build dan deploy.

---

## 2. Go Backend (Gin) - VPS 72.62.124.23

### Langkah Deploy

```bash
# 1. SSH ke VPS
ssh deploy@72.62.124.23

# 2. Pull kode terbaru
cd ~/monorepo-root
git pull

# 3. Build binary baru
cd backend
/usr/local/go/bin/go build -o app .

# 4. Restart service (perlu password sudo)
sudo systemctl restart backend

# 5. Verifikasi status
sudo systemctl status backend
```

### Command Singkat (One-liner)

```bash
ssh deploy@72.62.124.23 "cd ~/monorepo-root && git pull && cd backend && /usr/local/go/bin/go build -o app . && sudo systemctl restart backend"
```

### Lokasi Penting

| Item | Path |
|------|------|
| Source code | `/home/deploy/monorepo-root/backend/` |
| Binary | `/home/deploy/monorepo-root/backend/app` |
| Service file | `/etc/systemd/system/backend.service` |
| Logs | `sudo journalctl -u backend -f` |

### Troubleshooting

```bash
# Lihat logs
sudo journalctl -u backend -n 50 --no-pager

# Cek service status
sudo systemctl status backend

# Restart manual jika gagal
sudo systemctl stop backend
sudo systemctl start backend
```

---

## 3. Feature Service (ASP.NET) - VPS 203.175.11.84

### Langkah Deploy

ASP.NET memerlukan build di **Windows lokal**, lalu upload ke VPS:

```powershell
# 1. Build di Windows (dari folder project)
cd C:\Users\Aorus\alephdraad\feature-service\src\FeatureService.Api
Remove-Item -Recurse -Force ./publish -ErrorAction SilentlyContinue
dotnet publish -c Release -o ./publish

# 2. Upload ke VPS
scp -r ./publish/* asp@203.175.11.84:/home/asp/feature-service-app/

# 3. Restore appsettings.json (karena di-overwrite saat upload)
# Lihat section "Restore appsettings.json" di bawah

# 4. SSH ke VPS untuk restart
ssh asp@203.175.11.84

# 5. Restart service (perlu password sudo)
sudo systemctl restart featureservice

# 6. Verifikasi status
sudo systemctl status featureservice
```

### Restore appsettings.json

Setelah upload, `appsettings.json` perlu dikembalikan karena lokal tidak punya config `Backend:ApiUrl`:

```bash
# Di VPS (ssh asp@203.175.11.84)
cat > /home/asp/feature-service-app/appsettings.json << 'EOF'
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "MongoDB": {
    "ConnectionString": "mongodb://127.0.0.1:27017",
    "DatabaseName": "feature_service_db"
  },
  "Backend": {
    "ApiUrl": "https://api.alephdraad.fun"
  },
  "Jwt": {
    "Secret": "",
    "Issuer": "api.alephdraad.fun",
    "Audience": "alephdraad-clients"
  },
  "Cors": {
    "AllowedOrigins": [
      "https://alephdraad.fun",
      "http://localhost:3000"
    ]
  }
}
EOF
```

### Lokasi Penting

| Item | Path |
|------|------|
| App folder | `/home/asp/feature-service-app/` |
| Config | `/home/asp/feature-service-app/appsettings.json` |
| Service file | `/etc/systemd/system/featureservice.service` |
| Logs | `sudo journalctl -u featureservice -f` |
| Swagger | https://feature.alephdraad.fun/swagger |

### Troubleshooting

```bash
# Lihat logs
sudo journalctl -u featureservice -n 50 --no-pager

# Cek service status
sudo systemctl status featureservice

# Test endpoint
curl -s http://localhost:5000/api/v1/health
```

---

## 4. Checklist Setelah Deploy

- [ ] Go Backend: `curl https://api.alephdraad.fun/health` → `200 OK`
- [ ] Feature Service: `curl https://feature.alephdraad.fun/api/v1/health` → `200 OK`
- [ ] Frontend: Buka https://www.alephdraad.my.id → Load normal
- [ ] Test fitur yang diubah

---

## 5. Password VPS

| VPS | User | Password |
|-----|------|----------|
| 72.62.124.23 | deploy | *(tanya admin)* |
| 203.175.11.84 | asp | *(tanya admin)* |

---

## 6. Diagram Arsitektur

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Frontend      │────▶│   Go Backend         │────▶│   PostgreSQL        │
│   (Vercel)      │     │   (VPS 72.62.124.23) │     │   (Neon Cloud)      │
│   Next.js 15    │     │   Gin Framework      │     │                     │
└────────┬────────┘     └──────────────────────┘     └─────────────────────┘
         │
         │              ┌──────────────────────┐     ┌─────────────────────┐
         └─────────────▶│   Feature Service    │────▶│   MongoDB           │
                        │   (VPS 203.175.11.84)│     │   (Same VPS)        │
                        │   ASP.NET Core 8     │     │                     │
                        └──────────────────────┘     └─────────────────────┘
```

---

## 7. Kapan Deploy Mana?

| Folder yang diubah | Deploy ke |
|--------------------|-----------|
| `frontend/` | Vercel (auto) |
| `backend/` | Go VPS (72.62.124.23) |
| `feature-service/` | ASP VPS (203.175.11.84) |
| `docs/` | Tidak perlu deploy |

---

*Last updated: 18 Januari 2026*
