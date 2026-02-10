# FACT MAP — Repo & Production Runtime

Dokumen ini bersifat **evidence-only**. Setiap klaim teknis di bawah merujuk ke bukti berupa:

- output command terminal (diringkas), atau
- path file + nomor baris, atau
- konfigurasi runtime (systemd/nginx), atau
- output error saat verifikasi diblokir oleh permission/sandbox.

Jika bukti tidak tersedia, ditulis sebagai:

- `UNKNOWN`
- `Missing evidence: ...`
- `How to verify: ...`

Tanggal penyusunan (berdasarkan session ini): **10 Februari 2026**.

---

## Repository Structure Summary

Fakta struktur repo (root):

- Monorepo memiliki 3 komponen utama: `backend/` (Go/Gin), `feature-service/` (.NET), `frontend/` (Next.js).
- Dokumentasi ada di `docs/`, template deploy ada di `deploy/`.

Evidence:

- [EVID-001] command: `ls -lah`  Key output: direktori `backend/`, `feature-service/`, `frontend/`, `deploy/`, `docs/`.
- [EVID-002] command: `git rev-parse --show-toplevel`  Key output: `/home/alep/monorepo-root`.

---

## Git Context (Current Working State)

Observed:

- Branch aktif: `main` tracking `origin/main`.
- Working tree: **dirty** (banyak file berubah + file baru).
- Remote: GitHub SSH `git@github.com:rentakayama-881/monorepo-root.git`.

Evidence:

- [EVID-003] command: `git status --short --branch`  Key output: `## main...origin/main` + banyak `M/RM/D/??`.
- [EVID-004] command: `git branch -vv`  Key output: `* main ... [origin/main] ...`
- [EVID-005] command: `git remote -v`  Key output: `origin git@github.com:rentakayama-881/monorepo-root.git (fetch/push)`
- [EVID-006] command: `git log -n 1 --oneline --decorate`  Key output: `10f0752 (HEAD -> main, origin/main, origin/HEAD) ...`

---

## Backend 1 (Go / Gin) — Role, Entrypoint, Port, Dependencies

### Role (berdasarkan kode)

- Go backend menangani core identity/auth + Validation Case domain (CRUD + workflow orchestration).
- Financial endpoints (wallet/escrow/dispute/deposit/withdraw) ditangani oleh Feature Service (.NET). (Separation of responsibilities terlihat dari komentar dan routing.)

Evidence:

- [EVID-007] file: `backend/main.go:271`  Finding: `func main()` sebagai entrypoint.
- [EVID-008] file: `backend/main.go:354`  Finding: komentar “Financial features are handled by the ASP.NET service...”.

### HTTP Bind Address / Port

- Default `PORT=8080` dan default bind `BIND_ADDR=127.0.0.1` (loopback). Ini selaras dengan pola “Nginx sebagai reverse proxy di depan”.

Evidence:

- [EVID-009] file: `backend/main.go:606`  Finding: default port `8080`.
- [EVID-010] file: `backend/main.go:614`  Finding: default bind `127.0.0.1`.

### Key Routes (observed dari router)

- Health/readiness:
  - `GET /health`, `GET /ready`
  - `GET /api/health`, `GET /api/ready`
- Validation Case:
  - group `/api/validation-cases` untuk index/record/workflow.
- Internal callback untuk auto-release escrow dari Feature Service:
  - `POST /api/internal/validation-cases/escrow/released`

Evidence:

- [EVID-011] file: `backend/main.go:407`  Finding: `router.GET("/health"...); router.GET("/ready"...);`
- [EVID-012] file: `backend/main.go:410`  Finding: group prefix `/api`.
- [EVID-013] file: `backend/main.go:519`  Finding: group `/api/validation-cases`.
- [EVID-014] file: `backend/main.go:516`  Finding: `POST /api/internal/validation-cases/escrow/released`.

### Internal Service Auth (service-to-service)

- Internal endpoint dilindungi middleware `InternalServiceAuth()` dan header `X-Internal-Api-Key`.
- Secret key dibaca dari env `INTERNAL_API_KEY`.

Evidence:

- [EVID-015] file: `backend/middleware/internal_auth.go:12`  Finding: header name `X-Internal-Api-Key`.
- [EVID-016] file: `backend/middleware/internal_auth.go:16`  Finding: env var `INTERNAL_API_KEY`.

### Database / Storage Dependencies

- Postgres via Ent ORM.
- Ada migrasi naming idempotent untuk rename legacy table `threads` -> `validation_cases` dan join table `tag_threads` -> `tag_validation_cases` (termasuk rename column `thread_id` -> `validation_case_id`) sebelum Ent schema migration berjalan.

Evidence:

- [EVID-017] file: `backend/database/ent.go:54`  Finding: `applyDomainRenames` untuk rename legacy “thread” naming.
- [EVID-018] file: `backend/database/ent.go:74`  Finding: `ALTER TABLE threads RENAME TO validation_cases`.
- [EVID-019] file: `backend/database/ent.go:88`  Finding: `ALTER TABLE tag_threads RENAME TO tag_validation_cases`.
- [EVID-020] file: `backend/database/ent.go:108` Finding: rename column `thread_id` -> `validation_case_id`.
- [EVID-021] file: `backend/database/ent.go:203` Finding: `EntClient.Schema.Create(...)` menjalankan migration.

---

## Backend 2 (.NET Feature Service) — Role, Entrypoint, Port, Dependencies

### Role (berdasarkan kode)

Feature Service menangani:

- wallet + transaction history
- escrow transfers (hold + auto-release + callback ke Go backend)
- disputes (admin arbitration)
- deposits + withdrawals
- documents (termasuk file untuk workflow artifacts)
- reports + admin moderation
- PQC signature validation middleware untuk endpoint finansial

Evidence:

- [EVID-022] file: `feature-service/src/FeatureService.Api/Program.cs:28`  Finding: entrypoint `WebApplication.CreateBuilder(args)`.
- [EVID-023] file: `feature-service/src/FeatureService.Api/Program.cs:526` Finding: middleware `UsePqcSignatureValidation()` sebelum map controllers.

### Health Endpoints

- JSON health endpoint: `GET /api/v1/health` (HealthController).
- ASP.NET HealthChecks endpoint: `GET /health` (MapHealthChecks).

Evidence:

- [EVID-024] file: `feature-service/src/FeatureService.Api/Controllers/HealthController.cs:13`  Finding: `[Route("api/v1/health")]`.
- [EVID-025] file: `feature-service/src/FeatureService.Api/Program.cs:531`  Finding: `app.MapHealthChecks("/health");`.

### Auto-Release -> Go Backend Callback (Best Effort)

- Saat transfer auto-released, Feature Service memanggil Go internal endpoint:
  - `POST {GoBackendBaseUrl}/api/internal/validation-cases/escrow/released`
  - header `X-Internal-Api-Key: {GoBackend:InternalApiKey}`
  - body `{ "transfer_id": "trf_..." }`

Evidence:

- [EVID-026] file: `feature-service/src/FeatureService.Api/Services/TransferService.cs:697`  Finding: URL `/api/internal/validation-cases/escrow/released`.
- [EVID-027] file: `feature-service/src/FeatureService.Api/Services/TransferService.cs:699`  Finding: header `X-Internal-Api-Key` dikirim.

### Data Store Dependencies

- MongoDB: dipakai sebagai primary datastore Feature Service (wallet, transfers, disputes, documents, reports, dll).
- Redis: dipakai untuk caching/rate-limit/idempotency (terlihat dari dependency dan readiness check).

Evidence:

- [EVID-028] file: `feature-service/src/FeatureService.Api/Controllers/HealthController.cs:17`  Finding: HealthController bergantung pada `MongoDbContext`.
- [EVID-029] file: `feature-service/src/FeatureService.Api/Controllers/HealthController.cs:18`  Finding: HealthController bergantung pada `IConnectionMultiplexer` (Redis).
- [EVID-030] file: `feature-service/src/FeatureService.Api/Program.cs:414`  Finding: `builder.Services.AddHealthChecks().AddMongoDb(...)`.

---

## Frontend — Framework, Build/Start, Deployment Path

Observed dari repo:

- Framework: Next.js (App Router) + React.
- Next version di dependency: `next: ^16.1.6`.
- Deployment: Vercel (per docs frontend).

Evidence:

- [EVID-031] file: `frontend/package.json:30`  Finding: `next: "^16.1.6"`.
- [EVID-032] file: `frontend/README.md:15`  Finding: `Deployment: Vercel`.

Not verified:

- `UNKNOWN` apakah Vercel auto-deploy dari GitHub push atau manual.
  - Missing evidence: `vercel.json`, `.vercel/`, atau konfigurasi Vercel project (dashboard).
  - How to verify: cek Vercel project settings + deployment logs.

---

## Runtime Deployment Reality on VPS (Partial Evidence Only)

### Reverse Proxy (Nginx config observed)

Observed:

- `/etc/nginx/sites-available/aivalid.conf` memiliki vhost:
  - `api.aivalid.id` -> `proxy_pass http://127.0.0.1:8080;`
  - `feature.aivalid.id` -> `proxy_pass http://127.0.0.1:5000;`

Evidence:

- [EVID-033] file: `/etc/nginx/sites-available/aivalid.conf:3`   Finding: `server_name api.aivalid.id;`
- [EVID-034] file: `/etc/nginx/sites-available/aivalid.conf:10`  Finding: `proxy_pass http://127.0.0.1:8080;`
- [EVID-035] file: `/etc/nginx/sites-available/aivalid.conf:30`  Finding: `server_name feature.aivalid.id;`
- [EVID-036] file: `/etc/nginx/sites-available/aivalid.conf:37`  Finding: `proxy_pass http://127.0.0.1:5000;`

`UNKNOWN` apakah binary `nginx` tersedia/aktif di environment eksekusi session ini.

- Missing evidence: `nginx -T` (command tidak tersedia).
- How to verify: jalankan `nginx -T` pada host runtime yang benar.

Evidence:

- [EVID-037] command: `nginx -T`  Key output: `/bin/bash: line 1: nginx: command not found`

### systemd Unit Files (observed)

Observed unit files:

- `/etc/systemd/system/alephdraad-backend.service`
- `/etc/systemd/system/feature-service.service`

Evidence:

- [EVID-038] file: `/etc/systemd/system/alephdraad-backend.service:9`  Finding: `WorkingDirectory=/opt/alephdraad/backend`.
- [EVID-039] file: `/etc/systemd/system/alephdraad-backend.service:11` Finding: `ExecStart=/opt/alephdraad/backend/app`.
- [EVID-040] file: `/etc/systemd/system/feature-service.service:9`      Finding: `WorkingDirectory=/opt/alephdraad/feature-service`.
- [EVID-041] file: `/etc/systemd/system/feature-service.service:11`     Finding: `ExecStart=/usr/bin/dotnet /opt/alephdraad/feature-service/FeatureService.Api.dll`.

`UNKNOWN` status service via `systemctl` pada environment eksekusi ini.

- Missing evidence: akses ke systemd bus.
- How to verify: jalankan `systemctl status <service>` sebagai user yang punya akses (atau via SSH session langsung di VPS).

Evidence:

- [EVID-042] command: `systemctl status nginx`  Key output: `Failed to connect to bus: Operation not permitted`

### Ports (Observed via `ss`)

Observed LISTEN ports (tanpa attribution process karena netlink restricted):

- `127.0.0.1:8080` (kemungkinan Go backend)
- `127.0.0.1:5000` (kemungkinan Feature Service)
- `0.0.0.0:80` dan `0.0.0.0:443` (reverse proxy)
- `127.0.0.1:6379` (Redis)
- `127.0.0.1:27017` (MongoDB)

Evidence:

- [EVID-043] command: `ss -ltnp`  Key output: `LISTEN ... 127.0.0.1:8080`, `127.0.0.1:5000`, `:80`, `:443`, `127.0.0.1:6379`, `127.0.0.1:27017` (dan pesan `Cannot open netlink socket: Operation not permitted`).

### Runtime Health Checks (Blocked)

`UNKNOWN` hasil health endpoints pada environment eksekusi ini karena pembuatan socket diblokir.

- Missing evidence: `curl http://127.0.0.1:8080/health` dan `curl http://127.0.0.1:5000/api/v1/health`.
- How to verify: jalankan `curl` pada host runtime yang benar / shell yang mengizinkan socket.

Evidence:

- [EVID-044] command: `bash -lc 'echo > /dev/tcp/127.0.0.1/8080'`  Key output: `bash: socket: Operation not permitted`

### Docker (Not Verified)

`UNKNOWN` apakah layanan berjalan sebagai container. Akses docker socket diblokir pada environment eksekusi ini.

Evidence:

- [EVID-045] command: `docker ps ...`  Key output: `permission denied ... /var/run/docker.sock ... operation not permitted`

---

## Git Workflow Reality (Repo vs Runtime)

Observed di repo:

- Ada workflow deploy `.github/workflows/deploy.yml` yang melakukan deploy backend + feature-service via SSH.
- Workflow tersebut melakukan restart `backend.service` dan `featureservice.service`.

Observed di host config yang terbaca:

- Unit files yang terobservasi bernama `alephdraad-backend.service` dan `feature-service.service`.

Implikasi:

- `UNKNOWN` apakah workflow `deploy.yml` benar-benar men-deploy host yang sama dengan host tempat `/etc/systemd/system/*.service` ini dibaca.
- Ada mismatch service name + path (`/home/deploy/...` di workflow vs `/opt/alephdraad/...` pada unit file).

Evidence:

- [EVID-046] file: `.github/workflows/deploy.yml:172`  Finding: `sudo systemctl restart backend.service`.
- [EVID-047] file: `.github/workflows/deploy.yml:255`  Finding: deploy path `/home/asp/monorepo-root ...` (Feature Service deploy).
- [EVID-038] file: `/etc/systemd/system/alephdraad-backend.service:1` Finding: unit name `alephdraad-backend.service` (observed).

---

## Unknowns / Not Verified (Explicit)

- `UNKNOWN` service status & logs (systemctl/journalctl) pada environment eksekusi ini.
  - Missing evidence: akses ke systemd bus.
  - How to verify: `systemctl status ...`, `journalctl -u ...` pada VPS.
- `UNKNOWN` runtime health & version (Go + Feature Service).
  - Missing evidence: kemampuan membuka socket (`curl localhost`).
  - How to verify: `curl -sf http://127.0.0.1:8080/health` dan `curl -sf http://127.0.0.1:5000/api/v1/health`.
- `UNKNOWN` apakah ada infra tambahan (Caddy/Traefik/Cloudflare) di depan Nginx.
  - Missing evidence: full routing chain.
  - How to verify: audit DNS + ingress provider + reverse-proxy config.
- `UNKNOWN` apakah deploy benar dilakukan via GitHub Actions atau manual di VPS.
  - Missing evidence: audit GitHub Actions runs + host state + deployment logs.

---

## Evidence Index (Commands & Files)

Format:

- `[EVID-XXX] command: '...'  Key output: '...'`
- `[EVID-XXX] file: 'path:line'  Finding: '...'`

Semua evidence yang dirujuk di atas berasal dari command/file yang dibuka pada session ini.

