# Disaster Recovery Plan — AIValid

Dokumen ini berisi prosedur pemulihan layanan AIValid saat terjadi kegagalan.
Semua informasi didasarkan pada konfigurasi aktif yang ada di repository.

> **Referensi terkait:**
> - [Backup Strategy](./backup-strategy.md) — detail teknis backup MongoDB & PostgreSQL
> - [Deployment Guide](./DEPLOYMENT_GUIDE.md) — prosedur deploy normal
> - [Secret Management](./secret-management.md) — enkripsi/dekripsi secrets dengan sops + age
> - [Environment Variables](./ENVIRONMENT_VARIABLES.md) — daftar lengkap env vars

---

## 1. Service Architecture

Arsitektur produksi AIValid terdiri dari 3 komponen utama yang berjalan di 2 platform berbeda.

```
┌─────────────────────────────────────────────────────────────────────┐
│  VPS (nodehost.ru)                                                  │
│                                                                     │
│  ┌──────────────┐    nginx (certbot SSL)    ┌──────────────────┐   │
│  │ Go Backend   │◄── api.aivalid.id ──────► │ :8080            │   │
│  │ (Gin)        │    alephdraad-backend      │ /opt/.../backend │   │
│  └──────┬───────┘                            └─────────────────┘   │
│         │ PostgreSQL (Neon cloud)                                    │
│         │                                                           │
│  ┌──────────────┐    nginx (certbot SSL)    ┌──────────────────┐   │
│  │ Feature Svc  │◄── feature.aivalid.id ──► │ :5000            │   │
│  │ (.NET 8)     │    feature-service         │ /opt/.../feature │   │
│  └──────┬───────┘                            └─────────────────┘   │
│         │ MongoDB (local, 127.0.0.1:27017)                          │
│                                                                     │
│  Monitoring: Prometheus (:9090) → Alertmanager (:9093) → Telegram  │
│  Node Exporter: :9100                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Vercel                                                             │
│  ┌──────────────┐                                                   │
│  │ Frontend     │◄── aivalid.id                                     │
│  │ (Next.js)    │    auto-deploy dari branch main                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Detail Komponen

| Komponen | Domain | systemd Unit | Port Lokal | Artifact Path | Database |
|----------|--------|-------------|------------|---------------|----------|
| Go Backend (Gin) | `api.aivalid.id` | `alephdraad-backend.service` | `127.0.0.1:8080` | `/opt/alephdraad/backend/app` | PostgreSQL (Neon) |
| Feature Service (.NET 8) | `feature.aivalid.id` | `feature-service.service` | `127.0.0.1:5000` | `/opt/alephdraad/feature-service/FeatureService.Api.dll` | MongoDB (lokal) |
| Frontend (Next.js) | `aivalid.id` | N/A (Vercel) | N/A | Vercel | N/A |

### Health Endpoints

| Service | Health URL | Version URL |
|---------|-----------|-------------|
| Go Backend | `http://127.0.0.1:8080/health` | `http://127.0.0.1:8080/health/version` |
| Feature Service | `http://127.0.0.1:5000/api/v1/health` | `http://127.0.0.1:5000/api/v1/health/version` |

---

## 2. RTO/RPO Targets

| Service | RTO (Recovery Time) | RPO (Recovery Point) | Catatan |
|---------|--------------------|--------------------|---------|
| Frontend | ~5 menit | 0 (git-based) | Vercel auto-redeploy dari `main` |
| Go Backend | ~15 menit | 24 jam (Neon PITR free plan) | Restart systemd atau redeploy binary |
| Feature Service | ~15 menit | 24 jam (daily mongodump) | Restart systemd atau redeploy DLL |
| MongoDB | ~30 menit | 24 jam | Restore dari `/opt/alephdraad/backups/mongodb/` |
| PostgreSQL | Tergantung Neon | Neon managed PITR | Free plan: 24 jam retention |
| Full VPS Migration | ~2 jam | 24 jam | Setup baru + restore semua data |

---

## 3. Backup Schedule

### MongoDB (Feature Service)

| Item | Detail |
|------|--------|
| Script | `ops/db-backup.sh` |
| Cron | `deploy/cron/aivalid-db-backup.cron` |
| Jadwal | Setiap hari pukul 02:00 UTC |
| Lokasi backup | `/opt/alephdraad/backups/mongodb/<timestamp>/` |
| Retention | 30 hari (otomatis dihapus oleh script) |
| Format | `mongodump` + gzip per collection |
| Log | `/var/log/aivalid-db-backup.log` |

### PostgreSQL (Go Backend)

| Item | Detail |
|------|--------|
| Provider | Neon (managed) |
| Metode | Built-in Point-in-Time Recovery (PITR) |
| Retention | Tergantung plan Neon (free: 24 jam) |
| Restore | Via Neon Console → Branches → Restore |

### Source Code

| Item | Detail |
|------|--------|
| Repository | GitHub |
| Backup | Continuous (setiap push) |
| Secrets | `.env.enc` (encrypted via sops + age, committed ke git) |

### Deploy Artifacts

| Item | Detail |
|------|--------|
| Script | `ops/vps-sync-deploy.sh` |
| Backup otomatis | Setiap deploy membuat backup di `/opt/alephdraad/backups/<timestamp>-<sha>/` |
| Isi backup | Binary Go backend (`backend-app.bak`) + folder Feature Service |

---

## 4. Recovery Procedures

### 4.1 Go Backend Down

Gejala: `api.aivalid.id` tidak merespons, atau Alertmanager mengirim notifikasi `ServiceDown` untuk job `go-backend`.

```bash
# 1. Cek status service
sudo systemctl status alephdraad-backend.service --no-pager

# 2. Cek log terakhir
sudo journalctl -u alephdraad-backend.service -n 100 --no-pager

# 3. Restart service
sudo systemctl restart alephdraad-backend.service

# 4. Verifikasi health
curl -sf http://127.0.0.1:8080/health

# 5. Verifikasi dari luar (setelah nginx aktif)
curl -sf https://api.aivalid.id/health
```

**Jika restart tidak berhasil:**

```bash
# Cek apakah binary masih valid
file /opt/alephdraad/backend/app

# Cek apakah .env tersedia
cat /opt/alephdraad/backend/.env | head -5

# Cek apakah port sudah dipakai proses lain
ss -tlnp | grep 8080

# Jika perlu redeploy:
cd /home/alep/monorepo-root
ops/vps-sync-deploy.sh --env prod --ref main --no-feature
```

**Jika masalah database (Neon):**
- Buka [Neon Console](https://console.neon.tech)
- Cek status project dan branch
- Periksa connection string di `.env`

### 4.2 Feature Service Down

Gejala: `feature.aivalid.id` tidak merespons, atau Alertmanager mengirim notifikasi `ServiceDown` untuk job `feature-service`.

```bash
# 1. Cek status service
sudo systemctl status feature-service.service --no-pager

# 2. Cek log terakhir
sudo journalctl -u feature-service.service -n 100 --no-pager

# 3. Restart service
sudo systemctl restart feature-service.service

# 4. Verifikasi health
curl -sf http://127.0.0.1:5000/api/v1/health

# 5. Verifikasi dari luar
curl -sf https://feature.aivalid.id/api/v1/health
```

**Jika restart tidak berhasil:**

```bash
# Cek apakah DLL masih valid
ls -la /opt/alephdraad/feature-service/FeatureService.Api.dll

# Cek apakah .env tersedia
cat /opt/alephdraad/feature-service/.env | head -5

# Cek apakah port sudah dipakai proses lain
ss -tlnp | grep 5000

# Cek apakah .NET runtime tersedia
dotnet --list-runtimes

# Jika perlu redeploy:
cd /home/alep/monorepo-root
ops/vps-sync-deploy.sh --env prod --ref main --no-backend
```

**Jika masalah MongoDB:**

```bash
# Cek status MongoDB
sudo systemctl status mongod --no-pager

# Restart MongoDB
sudo systemctl restart mongod

# Verifikasi MongoDB accessible
mongosh --eval "db.runCommand({ ping: 1 })"

# Setelah MongoDB pulih, restart Feature Service
sudo systemctl restart feature-service.service
```

### 4.3 Nginx / SSL Down

Gejala: Kedua domain (`api.aivalid.id`, `feature.aivalid.id`) tidak bisa diakses via HTTPS, tapi service lokal merespons di port 8080/5000.

```bash
# 1. Cek status nginx
sudo systemctl status nginx --no-pager

# 2. Test konfigurasi nginx
sudo nginx -t

# 3. Restart nginx
sudo systemctl restart nginx

# 4. Jika SSL expired, renew certificate
sudo certbot renew

# 5. Jika config rusak, restore dari repo
sudo cp /home/alep/monorepo-root/deploy/nginx/aivalid.conf /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
```

### 4.4 MongoDB Recovery (Data Restore)

Prosedur lengkap ada di [Backup Strategy](./backup-strategy.md#restore-procedure).

Ringkasan:

```bash
# 1. Lihat backup yang tersedia
ls -lt /opt/alephdraad/backups/mongodb/

# 2. Stop Feature Service (mencegah write saat restore)
sudo systemctl stop feature-service.service

# 3a. Restore tanpa drop (merge data)
ops/db-restore.sh /opt/alephdraad/backups/mongodb/<TIMESTAMP>

# 3b. Restore dengan drop (ganti semua data)
ops/db-restore.sh --drop /opt/alephdraad/backups/mongodb/<TIMESTAMP>

# 4. Start Feature Service kembali
sudo systemctl start feature-service.service

# 5. Verifikasi health
curl -sf http://127.0.0.1:5000/api/v1/health
```

### 4.5 PostgreSQL Recovery (Neon)

PostgreSQL dikelola oleh Neon. Tidak ada backup script lokal.

```
1. Buka Neon Console (https://console.neon.tech)
2. Pilih project AIValid
3. Navigasi ke Branches → pilih branch aktif
4. Klik Restore, pilih point in time yang diinginkan
5. Neon akan membuat branch baru dengan data dari waktu tersebut
6. Verifikasi data di branch baru
7. Jika sudah benar, promote branch baru sebagai primary
8. Update connection string di backend/.env jika endpoint berubah
9. Restart Go Backend: sudo systemctl restart alephdraad-backend.service
```

**Untuk safety sebelum operasi berisiko:**
Buat branch manual di Neon Console → Branches → Create Branch (snapshot dari state saat ini).

### 4.6 Deploy Rollback

Jika deploy terakhir menyebabkan masalah, gunakan rollback script:

```bash
# 1. Lihat backup deploy yang tersedia
ls -lt /opt/alephdraad/backups/

# 2. Rollback ke backup tertentu
ops/vps-rollback.sh --backup-dir /opt/alephdraad/backups/<TIMESTAMP-SHA>

# Script akan otomatis:
# - Restore binary Go backend (jika ada di backup)
# - Restore artifacts Feature Service (jika ada di backup)
# - Restart kedua service
# - Verifikasi health setelah rollback
```

### 4.7 Frontend Down (Vercel)

Frontend di-deploy otomatis oleh Vercel dari branch `main`. Biasanya tidak memerlukan intervensi manual.

**Jika Vercel deploy gagal:**

```
1. Cek Vercel Dashboard untuk error log build
2. Perbaiki kode di branch main
3. Push ulang — Vercel akan auto-redeploy

Jika perlu rollback:
1. Vercel Dashboard → Deployments
2. Pilih deployment sebelumnya yang sukses
3. Klik "Promote to Production"
```

**Jika frontend error karena backend tidak bisa diakses:**
- Bukan masalah frontend — cek Go Backend dan Feature Service terlebih dahulu

### 4.8 Full VPS Migration

Skenario terburuk: VPS perlu diganti sepenuhnya (hardware failure, provider issue).

#### Prerequisites di VPS Baru

```bash
# 1. Install runtime dependencies
# Go (versi sesuai go.mod)
# .NET 8 SDK/Runtime
# Node.js (jika diperlukan untuk tooling)
# MongoDB
# nginx
# certbot (untuk SSL)

# 2. Install backup/monitoring tools
# sops + age (untuk decrypt secrets)
# Prometheus + Alertmanager (opsional tapi direkomendasikan)
# node-exporter
```

#### Langkah Migrasi

```bash
# 1. Clone repository
git clone <repo-url> /home/alep/monorepo-root
cd /home/alep/monorepo-root

# 2. Setup age key untuk decrypt secrets
mkdir -p ~/.config/sops/age
# Copy atau generate age key — lihat docs/secret-management.md
# Jika key baru: tambahkan public key ke .sops.yaml dan re-encrypt

# 3. Decrypt semua secrets
bash ops/secrets-decrypt.sh all

# 4. Setup direktori deployment
sudo mkdir -p /opt/alephdraad/{backend,feature-service,backups}
sudo chown -R alephdraad:alephdraad /opt/alephdraad

# 5. Build dan deploy
ops/vps-sync-deploy.sh --env prod --ref main

# 6. Install systemd unit files
sudo cp deploy/systemd/alephdraad-backend.service /etc/systemd/system/
sudo cp deploy/systemd/feature-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable alephdraad-backend.service feature-service.service

# 7. Copy .env files ke lokasi deployment
sudo cp backend/.env /opt/alephdraad/backend/.env
sudo cp feature-service/.env /opt/alephdraad/feature-service/.env

# 8. Setup nginx
sudo cp deploy/nginx/aivalid.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/aivalid.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# 9. Setup SSL dengan certbot
sudo certbot --nginx -d api.aivalid.id -d feature.aivalid.id

# 10. Restore MongoDB dari backup terakhir
# (Transfer backup file dari VPS lama atau offsite backup)
ops/db-restore.sh --drop /path/to/latest/backup

# 11. Start services
sudo systemctl start alephdraad-backend.service
sudo systemctl start feature-service.service

# 12. Setup cron untuk backup MongoDB
crontab deploy/cron/aivalid-db-backup.cron

# 13. Update DNS records
# Ubah A record api.aivalid.id → IP VPS baru
# Ubah A record feature.aivalid.id → IP VPS baru

# 14. Setup monitoring (opsional)
# Install Prometheus, Alertmanager, node-exporter
# Copy config dari deploy/prometheus/ dan deploy/alertmanager/
# Edit alertmanager.yml dengan bot_token dan chat_id yang benar

# 15. Verifikasi semua service
curl -sf https://api.aivalid.id/health
curl -sf https://feature.aivalid.id/api/v1/health
```

### 4.9 Secret Compromise

Jika private key (age) atau secret lainnya bocor:

Prosedur lengkap ada di [Secret Management — Emergency](./secret-management.md#emergency-key-compromise).

Ringkasan:

```bash
# 1. SEGERA rotate semua application secrets
#    (JWT_SECRET, DATABASE_URL passwords, API keys, SERVICE_TOKEN, INTERNAL_API_KEY)

# 2. Update .env files dengan nilai baru

# 3. Generate age key baru
age-keygen -o ~/.config/sops/age/keys.txt

# 4. Update .sops.yaml dengan public key baru (hapus yang compromised)

# 5. Re-encrypt semua secrets
bash ops/secrets-encrypt.sh all

# 6. Deploy secrets baru ke semua server
bash ops/secrets-decrypt.sh all
sudo systemctl restart alephdraad-backend.service feature-service.service

# 7. Audit git history — .env.enc lama bisa didekripsi dengan key yang bocor
```

---

## 5. Monitoring & Alerting

Sistem monitoring sudah terkonfigurasi di VPS. Alert dikirim otomatis via Telegram.

### Stack

| Komponen | Port | Konfigurasi |
|----------|------|-------------|
| Prometheus | `:9090` | `deploy/prometheus/prometheus.yml` |
| Alertmanager | `:9093` | `deploy/alertmanager/alertmanager.yml` |
| Node Exporter | `:9100` | System metrics (CPU, memory, disk) |

### Alert Rules Aktif

| Alert | Kondisi | Severity | Deskripsi |
|-------|---------|----------|-----------|
| `ServiceDown` | `up == 0` selama >1 menit | Critical | Service tidak merespons scrape |
| `HighErrorRate` | 5xx rate >5% selama >5 menit | Warning | Error rate HTTP tinggi |
| `HighLatency` | P95 latency >2 detik selama >5 menit | Warning | Response time terlalu lambat |
| `HighMemoryUsage` | RSS >512MB selama >10 menit | Warning | Penggunaan memori berlebihan |

### Cek Manual Status Monitoring

```bash
# Prometheus
curl -sf http://localhost:9090/-/healthy

# Alertmanager
curl -sf http://localhost:9093/-/healthy

# Lihat alert aktif
curl -s http://localhost:9093/api/v2/alerts | python3 -m json.tool
```

---

## 6. Contact & Escalation

| Level | Trigger | Channel | Waktu Respons |
|-------|---------|---------|---------------|
| L1 | Alert otomatis (ServiceDown, HighErrorRate) | Telegram Bot (Alertmanager) | Otomatis |
| L2 | L1 tidak terselesaikan dalam 15 menit | Developer (manual check) | ~15 menit |
| L3 | Hardware / network issue di VPS | VPS Provider (nodehost.ru) | Tergantung provider |

### Checklist Saat Menerima Alert

1. **Identifikasi service** yang terdampak dari alert message
2. **SSH ke VPS** dan cek status service (`systemctl status`)
3. **Cek logs** (`journalctl -u <unit> -n 100 --no-pager`)
4. **Restart** jika masalah sederhana (crash, memory leak)
5. **Eskalasi** jika restart tidak menyelesaikan masalah

---

## 7. Testing Schedule

| Frekuensi | Test | Prosedur |
|-----------|------|----------|
| Bulanan | MongoDB restore | Restore backup terakhir ke database test, verifikasi data integrity |
| Per kuartal | Full DR drill | Simulasi restore semua service di VPS test (atau environment staging) |
| Setelah major change | Backup integrity check | Jalankan `ops/db-backup.sh`, verifikasi output, test restore |
| Mingguan | Cek backup log | `tail -50 /var/log/aivalid-db-backup.log` — pastikan backup harian berjalan |

### Verifikasi Backup Harian

```bash
# Cek apakah backup tadi malam berhasil
tail -20 /var/log/aivalid-db-backup.log

# Cek backup terbaru
ls -lt /opt/alephdraad/backups/mongodb/ | head -3

# Cek ukuran backup (harus > 1KB sesuai BACKUP_MIN_SIZE_BYTES)
du -sh /opt/alephdraad/backups/mongodb/$(ls -t /opt/alephdraad/backups/mongodb/ | head -1)
```

---

## 8. Quick Reference Commands

Referensi cepat command yang paling sering dibutuhkan saat incident.

```bash
# === Status semua service ===
sudo systemctl status alephdraad-backend.service --no-pager
sudo systemctl status feature-service.service --no-pager
sudo systemctl status mongod --no-pager
sudo systemctl status nginx --no-pager

# === Restart service ===
sudo systemctl restart alephdraad-backend.service
sudo systemctl restart feature-service.service

# === Health check ===
curl -sf http://127.0.0.1:8080/health
curl -sf http://127.0.0.1:5000/api/v1/health

# === Logs (50 baris terakhir) ===
sudo journalctl -u alephdraad-backend.service -n 50 --no-pager
sudo journalctl -u feature-service.service -n 50 --no-pager

# === Live follow logs ===
sudo journalctl -u alephdraad-backend.service -f
sudo journalctl -u feature-service.service -f

# === Deploy ===
ops/vps-sync-deploy.sh --env prod --ref <git-sha>

# === Rollback ===
ops/vps-rollback.sh --backup-dir /opt/alephdraad/backups/<dir>

# === Backup MongoDB (manual) ===
ops/db-backup.sh

# === Restore MongoDB ===
ops/db-restore.sh --drop /opt/alephdraad/backups/mongodb/<timestamp>
```

---

*Last updated: 2026-03-09*
