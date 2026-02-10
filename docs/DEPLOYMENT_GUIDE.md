# Deployment Guide (Evidence-First)

Panduan deployment AIValid setelah perubahan kode.

## Fakta (Locked)

- Frontend dideploy di Vercel.
  - Jangan build/test frontend di VPS.
  - Jangan setup build frontend di VPS.
- VPS menjalankan dua backend:
  1. Go (Gin) backend
  2. .NET Feature Service

## Ringkasan Runtime yang Teramati (Evidence-Based)

Sumber bukti:
- `docs/FACT_MAP_REPO_RUNTIME.md`
- `/etc/nginx/sites-available/aivalid.conf`
- `/etc/systemd/system/alephdraad-backend.service`
- `/etc/systemd/system/feature-service.service`

| Komponen | Public Hostname | Upstream Lokal | systemd Unit | Artifact Path |
|---------|------------------|----------------|--------------|---------------|
| Go Backend (Gin) | `api.aivalid.id` | `127.0.0.1:8080` | `alephdraad-backend.service` | `/opt/alephdraad/backend/app` |
| Feature Service (.NET) | `feature.aivalid.id` | `127.0.0.1:5000` | `feature-service.service` | `/opt/alephdraad/feature-service/FeatureService.Api.dll` |
| Frontend (Next.js) | `UNKNOWN` | N/A | N/A | Vercel |

Health endpoints (dari kode):
- Go Backend: `GET /health` (juga tersedia `GET /api/v1/health`)
- Feature Service: `GET /api/v1/health`

## 1. Frontend (Next.js) - Vercel

Frontend deploy melalui Vercel (sesuai fakta produk). Verifikasi branch auto-deploy dan domain di Vercel dashboard.

## 2. Backends (Go + .NET) - Deployment Options

### Opsi A: GitHub Actions (CI/CD)

Workflow repo: `.github/workflows/deploy.yml`

Trigger:
- `push` ke `main` dengan perubahan di `backend/**` atau `feature-service/**`
- atau `workflow_dispatch`

Catatan penting:
- Workflow membutuhkan secrets untuk SSH dan host.
- Script deploy di workflow harus sesuai dengan layout server aktual (lihat `docs/FACT_MAP_REPO_RUNTIME.md` untuk mismatch yang sudah teridentifikasi).
- Feature Service health check yang benar adalah `http://localhost:5000/api/v1/health` (bukan `/health`).

### Opsi B: Manual Deploy (Layout `/opt/alephdraad`)

Opsi ini berlaku jika runtime menggunakan artifact paths dan unit files seperti yang teramati di bagian "Ringkasan Runtime".

Prerequisite:
- Akses SSH ke VPS
- `sudo` untuk menulis ke `/opt/alephdraad` dan restart `systemd`

Langkah umum:

1) Build artifacts (di mesin build, bukan di VPS jika tidak diperlukan)

Go Backend (binary Linux):
```bash
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o app .
```

Feature Service (.NET publish):
```bash
cd feature-service/src/FeatureService.Api
dotnet publish -c Release -o ./publish --self-contained false
```

2) Upload artifacts ke VPS (contoh path tujuan sementara; host/user tergantung environment kamu)
```bash
scp ./backend/app <user>@<host>:/tmp/backend-app.new
scp -r ./feature-service/src/FeatureService.Api/publish <user>@<host>:/tmp/feature-service-publish
```

3) Backup + replace artifacts (di VPS)
```bash
TS="$(date -u +%Y%m%dT%H%M%SZ)"
sudo mkdir -p "/opt/alephdraad/backups/$TS"

sudo cp /opt/alephdraad/backend/app \
  "/opt/alephdraad/backups/$TS/app.bak"

sudo install -m 0755 /tmp/backend-app.new /opt/alephdraad/backend/app

# Untuk .NET publish folder, gunakan rsync jika tersedia. Jika tidak, fallback ke cp (catatan: tidak menghapus file lama).
sudo rsync -a --delete /tmp/feature-service-publish/ /opt/alephdraad/feature-service/
# Fallback jika rsync tidak ada:
# sudo cp -a /tmp/feature-service-publish/. /opt/alephdraad/feature-service/
```

4) Restart services (di VPS)
```bash
sudo systemctl restart alephdraad-backend.service
sudo systemctl restart feature-service.service
```

5) Verifikasi (di VPS)
```bash
sudo systemctl status alephdraad-backend.service --no-pager
sudo systemctl status feature-service.service --no-pager

curl -sf http://127.0.0.1:8080/health
curl -sf http://127.0.0.1:5000/api/v1/health
```

6) Logs (di VPS)
```bash
sudo journalctl -u alephdraad-backend.service -n 200 --no-pager
sudo journalctl -u feature-service.service -n 200 --no-pager
```

## 3. Checklist Setelah Deploy

- Go Backend: `curl -sf https://api.aivalid.id/health`
- Feature Service: `curl -sf https://feature.aivalid.id/api/v1/health`
- Frontend: verifikasi via Vercel domain yang aktif (`UNKNOWN` di repo ini)

---

Last updated: 2026-02-10
