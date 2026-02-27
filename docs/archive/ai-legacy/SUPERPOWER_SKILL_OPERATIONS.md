# SUPERPOWER SKILL — Production-Safe A–Z Operating Manual

Bahasa: Indonesia (technical terms boleh English).

Dokumen ini adalah manual operasional **production-safe** untuk monorepo AIValid dengan paradigma **Validation Protocol** (Validation Case + escrow + stake + arbitration), disusun secara repo-first dan evidence-only.

Anchor fakta runtime dan evidence index ada di: `docs/FACT_MAP_REPO_RUNTIME.md`.

---

## Mission & Scope

Misi:

- Menjaga platform tetap **audit-grade** (jelas, bisa diaudit, tidak ambigu) saat melakukan perubahan domain besar.
- Menjamin setiap perubahan bisa dipertanggungjawabkan lewat bukti (file/line, command output, runtime config).
- Memastikan integritas sistem finansial: semua money flow melalui wallet/escrow, dispute diselesaikan admin arbitration.

Scope:

- Repo: `backend/` (Go/Gin/Ent/Postgres) + `feature-service/` (.NET/Mongo/Redis) + `frontend/` (Next.js/Vercel).
- Runtime (target): Nginx reverse proxy + systemd (atau mekanisme runtime yang terverifikasi) untuk 2 backend.

Out of scope (kecuali diminta eksplisit):

- Migrasi DB destruktif tanpa backup/rollback.
- Perubahan infra yang tidak bisa diverifikasi (DNS/CDN/WAF) tanpa akses.
- Instruksi ofensif (exploit/abuse).

---

## Repo Map (A–Z)

- `backend/`: Go API (Gin) untuk auth/session, user profiles, Validation Case domain, dan orchestration workflow.
- `backend/database/`: init Postgres/Ent + domain rename (legacy -> canonical) + Ent schema migration.
- `backend/ent/schema/`: source-of-truth schema (jangan edit `backend/ent/*` yang generated).
- `backend/handlers/`: HTTP handlers (auth, account, validation cases, admin, workflow).
- `backend/middleware/`: auth middleware, internal service auth, security headers, CORS, rate limiting.
- `feature-service/src/FeatureService.Api/`: ASP.NET Core API untuk wallet/transfers/deposits/withdrawals/disputes/docs/reports/moderation.
- `feature-service/src/FeatureService.Api/Middleware/`: termasuk PQC signature validation (untuk operasi finansial).
- `frontend/`: Next.js App Router UI (Validation Case Index/Record + wallet/dispute center + admin).
- `deploy/`: template deploy (bukan bukti runtime; runtime harus diverifikasi).
- `docs/`: dokumentasi (termasuk FACT MAP + manual ini).

---

## Runtime & Deployment Map (A–Z)

Fakta runtime yang terobservasi dari konfigurasi host (lihat evidence lengkap di FACT MAP):

- Nginx vhost mem-proxy:
  - `api.aivalid.id` -> `127.0.0.1:8080`
  - `feature.aivalid.id` -> `127.0.0.1:5000`
- systemd unit files yang ditemukan:
  - `alephdraad-backend.service`
  - `feature-service.service`

Batasan verifikasi pada environment eksekusi session ini:

- `systemctl` tidak bisa dipakai (systemd bus permission denied).
- Health checks via socket (`curl localhost`) tidak bisa dipakai (socket creation denied).
- `docker ps` tidak bisa dipakai (docker socket permission denied).
- Binary `nginx` tidak tersedia di environment eksekusi (command not found), meski config file terbaca.

Implikasi:

- Status “service live” dan verifikasi health/version harus dilakukan pada shell/runtime yang mengizinkan socket + systemctl.

---

## Operating Protocols (Superpower Rules)

1. Truth Protocol (STRICT)
- Jangan menyebut “sudah live” tanpa evidence (health response, logs, status).
- Jika bukti tidak ada: tulis `UNKNOWN` + missing evidence + cara verifikasi.

2. Production Safety (Default: Read-Only)
- Discovery dulu; perubahan minimal; selalu ada rollback path.
- Perubahan domain/protokol harus atomic (commit jelas), bukan campur aduk tanpa batas.
- Hindari perubahan “infra critical” (systemd/nginx/db migration) tanpa backup.

3. Change Control
- Wajib: checks (build/test/lint yang tersedia) sebelum commit.
- Commit message harus deskriptif dan bisa diaudit.
- Setelah deploy: verifikasi health + logs + endpoint utama.

4. Domain Integrity Rules (Validation Protocol)
- Tidak ada replies/comments/reactions/likes/stars.
- Semua interaksi harus bermakna legal/financial/audit.
- Dispute via admin arbitration, bukan voting.

5. Security Ethics
- Defensive only.
- Jangan mempublikasikan secret, token, PII, atau credential di log/dokumen.

---

## Security & Threat Modeling (Defensive Only)

Format setiap kategori:

- Relevance
- Detection (query/file/log yang aman)
- Safe mitigation pattern
- Validation (test/check yang aman)
- Severity/Priority

### 1) Auth / Session Weaknesses

- Relevance: kompromi auth = akses wallet + escrow + dispute.
- Detection:
  - Go auth routing: `backend/main.go` (group `/api/auth/...`).
  - Middleware enforcement: `backend/middleware/*` (AuthMiddleware, AdminAuthMiddleware, RequireSudo).
  - Feature Service JWT config: `feature-service/src/FeatureService.Api/Program.cs`.
- Safe mitigation pattern:
  - Ownership checks untuk semua resource (`validation_cases`, `documents`, `transfers`, `disputes`).
  - Admin endpoints: enforce roles + audit log.
  - Token rotation + short-lived access tokens.
- Validation:
  - Negative tests: akses resource user lain harus `403/404`.
  - Audit login attempts + lockout telemetry.
- Severity/Priority: High / P0

### 2) CSRF

- Relevance: bila auth disimpan di cookie atau ada stateful endpoints, CSRF dapat men-trigger financial actions.
- Detection:
  - Cek apakah auth memakai cookie vs bearer header di frontend BFF.
  - Cek CORS + credentials di Go (`buildCORSConfig`) dan Feature Service (`app.UseCors()` + policy).
- Safe mitigation pattern:
  - Gunakan bearer token di Authorization header untuk state-changing endpoints.
  - Jika cookie: gunakan SameSite=strict/lax + CSRF token.
- Validation:
  - Cross-site POST harus ditolak tanpa token.
- Severity/Priority: Medium-High / P0-P1 (tergantung model auth)

### 3) XSS

- Relevance: XSS dapat mencuri token dan mengeskalasi transaksi wallet.
- Detection:
  - Frontend: cari `dangerouslySetInnerHTML`, markdown rendering pipeline, dan input yang diserialisasi ke HTML.
- Safe mitigation pattern:
  - CSP ketat + sanitasi markdown + escape output.
  - No inline scripts; restrict `script-src`.
- Validation:
  - Test payload XSS pada field yang dirender.
- Severity/Priority: High / P0

### 4) SSRF

- Relevance: jika ada endpoint fetch URL dari user (download/proxy), SSRF bisa mengakses internal services.
- Detection:
  - Cari endpoint yang menerima URL, terutama di Feature Service documents atau integrations.
- Safe mitigation pattern:
  - Allowlist domain; block internal IP ranges; disable metadata endpoints.
- Validation:
  - Uji URL internal (127.0.0.1, 169.254.169.254) harus ditolak.
- Severity/Priority: High / P0

### 5) IDOR (Insecure Direct Object Reference)

- Relevance: akses dokumen privat atau dispute/transfer tanpa ownership checks = kebocoran data + kerugian finansial.
- Detection:
  - Feature Service: controller documents/disputes/transfers harus cek `userId` vs resource owner.
  - Go backend: validation case detail + workflow endpoints harus enforce owner/validator role.
- Safe mitigation pattern:
  - Enforce ownership/role checks server-side, bukan UI.
  - Return 404 untuk resource yang tidak boleh diketahui.
- Validation:
  - Test akses dokumen/dispute/transfer milik user lain harus fail.
- Severity/Priority: High / P0

### 6) Brute Force / Rate Limit Gaps

- Relevance: login, PIN verify, dan sensitive endpoints rawan brute force.
- Detection:
  - Go: rate limiter config di `backend/main.go` + middleware rate limit.
  - Feature Service: rate limiting middleware `UseRateLimiting` di `Program.cs`.
  - PIN lockout logic: `WalletService` (Feature Service).
- Safe mitigation pattern:
  - IP + user-based throttling, progressive backoff.
  - Account lockout + device-level signals.
- Validation:
  - Burst test ringan pada endpoint login dan PIN verify.
- Severity/Priority: Medium / P1

### 7) Token Storage / Leakage Risk

- Relevance: token lintas-service (Go -> Feature Service) harus tidak bocor.
- Detection:
  - Grep log statements untuk `Authorization` / `Bearer `.
  - Review request logging middleware di Feature Service.
- Safe mitigation pattern:
  - Redact header sensitif; structured logging dengan filter.
  - Rotate secrets dan internal API keys.
- Validation:
  - Audit logs: pastikan token tidak muncul.
- Severity/Priority: High / P0

### 8) Reverse Proxy Misconfiguration

- Relevance: Nginx adalah exposed surface; salah config bisa expose upstream langsung.
- Detection:
  - Review `/etc/nginx/sites-available/aivalid.conf` dan config include chain.
  - Pastikan upstream bind loopback (`BIND_ADDR=127.0.0.1` untuk Go).
- Safe mitigation pattern:
  - Enforce HTTPS redirect + HSTS.
  - Correct `X-Forwarded-*` headers.
  - Ensure 8080/5000 tidak exposed ke publik.
- Validation:
  - External port scan (dari luar VPS) untuk memastikan hanya 80/443 terbuka.
- Severity/Priority: High / P0

### 9) Insecure Headers / Cookies / CORS

- Relevance: CORS permissive + credentials dapat menyebabkan data leakage/CSRF.
- Detection:
  - Go: SecurityHeadersMiddleware + CORS config.
  - Feature Service: SecurityHeadersMiddleware + CORS policy.
- Safe mitigation pattern:
  - Strict allowlist origins; disable `*` bila credentials.
  - Cookie flags: HttpOnly, Secure, SameSite.
- Validation:
  - Browser preflight dan response header audit.
- Severity/Priority: Medium / P1

### 10) Dependency / Supply-Chain Risk

- Relevance: Node + Go + NuGet dependency chain.
- Detection:
  - CI: `.github/workflows/ci.yml` menjalankan `npm audit` dan security scans.
  - Review lockfiles: `frontend/package-lock.json`, `backend/go.sum`, `feature-service` NuGet lock (jika ada).
- Safe mitigation pattern:
  - Pin dependencies; enable Dependabot; verify provenance.
- Validation:
  - SCA scan hasil CI; update cadence.
- Severity/Priority: Medium / P1

### 11) Over-Privileged Service Boundaries

- Relevance: internal callback (Feature Service -> Go) harus dibatasi dan audited.
- Detection:
  - Go internal auth middleware: `backend/middleware/internal_auth.go`.
  - Feature Service callback caller: `TransferService`.
- Safe mitigation pattern:
  - Separate internal host/route; rotate internal API keys; restrict by network policy/firewall.
  - Add request correlation IDs and audit trail.
- Validation:
  - Attempt call internal endpoint without header harus 401/503.
- Severity/Priority: High / P0

### 12) Sensitive Logging

- Relevance: dispute evidence, documents, contact reveal, internal keys berisiko bocor di log.
- Detection:
  - Review log middleware di Feature Service + zap logs di Go.
  - Pastikan tidak logging request body untuk endpoint finansial.
- Safe mitigation pattern:
  - Redaction, log level discipline, PII policy.
- Validation:
  - Grep log sinks untuk pattern sensitif.
- Severity/Priority: High / P0

---

## Harvard Professor Tone (Style-Only Disclaimer)

Platform ini harus dibangun seperti sistem akademik dan legal: setiap “aksi” adalah rekaman formal yang dapat ditelusuri, setiap state transition dapat dijelaskan, dan tidak ada interaksi yang tidak memiliki makna audit. UI bukan tempat untuk diskusi informal; ia adalah **case file**.

---

## Vision / Target Benchmark (Aspirational, Not Verified Fact)

- Case record membaca seperti “dossier” (judul, status, nilai escrow, keputusan, dan log peristiwa).
- Semua perubahan state memiliki Case Log entry + correlation id.
- Dispute center seperti “case management” (bukan social feed).
- Satu sumber kebenaran untuk istilah domain (Validation Case, Case Log, Final Offer, dll) di seluruh stack.

---

## Quality Bar

- Tidak ada endpoint/fitur “forum/social” (replies/reactions/likes/stars).
- Semua API yang mengubah uang: idempotent, audited, dan role/ownership safe.
- Konsistensi terminology: UI/API/docs memakai istilah canonical.
- Deployment aman: rollback jelas, health check jelas, logs tersedia.
- Unknowns dicatat eksplisit (tidak ada asumsi).

---

## Known Unknowns

- Status runtime service, logs, dan health endpoint pada host production: `UNKNOWN` pada environment eksekusi session ini.
- Kebenaran deploy pipeline terhadap host runtime yang terobservasi: `UNKNOWN` (mismatch service name/path).
- Mekanisme Vercel auto-deploy: `UNKNOWN` (butuh akses project settings).

## Confidence Level (per Major Section)

- Repo Map: High
- Runtime Map: Medium (partial evidence; beberapa verifikasi diblokir)
- Threat Modeling: Medium (pola defensif kuat, tapi butuh audit per endpoint untuk memastikan coverage)

## Next Verification Steps

1. Jalankan verifikasi runtime dari shell dengan akses `systemctl` + socket:
   - `systemctl status alephdraad-backend feature-service nginx`
   - `journalctl -u alephdraad-backend -n 200 --no-pager`
   - `journalctl -u feature-service -n 200 --no-pager`
   - `curl -sf http://127.0.0.1:8080/health`
   - `curl -sf http://127.0.0.1:5000/api/v1/health`
2. Rekonsiliasi deploy.yml vs unit files yang benar (service name + WorkingDirectory).
3. Audit endpoint-by-endpoint untuk IDOR dan authorization boundaries (wallet/transfers/disputes/documents/workflow).
