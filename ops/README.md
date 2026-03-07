# Ops Scripts

## Purpose

Folder ini menyatukan command operasional wajib agar AI/human operator selalu konsisten.
Semua script menggunakan `ops/lib/common.sh` untuk logging, step tracking, dan error handling.

## Scripts

### 1. `preflight-full.sh` — Quality Gate
Menjalankan full gate lintas monorepo sebelum commit.

```bash
./ops/preflight-full.sh                     # Semua service
./ops/preflight-full.sh --scope backend     # Go backend saja
./ops/preflight-full.sh --scope backend-feature  # Go + .NET
./ops/preflight-full.sh --scope frontend    # Frontend saja
```

Gate yang dijalankan:
- **Backend:** `go vet ./...` + `go test -v ./...`
- **Feature Service:** `dotnet build -c Release` + `dotnet test -c Release`
- **Frontend:** `npm ci` + `npm run lint` + `npm run typecheck` + `npm test` + `npm run build` + `npm run audit:prod`

### 2. `commit-push.sh` — Commit + Push + Deploy
Menjalankan preflight, lalu commit + push. Jika dijalankan dari `main`, otomatis deploy VPS.

```bash
./ops/commit-push.sh "type(scope): message"                    # Full
./ops/commit-push.sh --scope backend-feature "fix(backend): x" # Backend hotfix
./ops/commit-push.sh --skip-deploy "docs(ai): update rules"    # Skip VPS deploy
./ops/commit-push.sh --deploy-vps "feat(backend): new API"     # Force VPS deploy
```

**Auto-deploy rules:**
- Branch `main` + scope bukan `frontend` → otomatis VPS deploy
- Branch `main` + scope `frontend` → skip VPS (Vercel handles frontend)
- Branch selain `main` → tidak ada auto-deploy

### 3. `vps-sync-deploy.sh` — Manual VPS Deploy
Build fresh binary dari source, deploy ke VPS, restart service, verify live SHA.

```bash
./ops/vps-sync-deploy.sh --env prod --ref main         # Deploy semua dari main
./ops/vps-sync-deploy.sh --env prod --ref <sha>        # Deploy ke SHA spesifik
./ops/vps-sync-deploy.sh --env prod --ref main --no-feature  # Go backend saja
./ops/vps-sync-deploy.sh --env prod --ref main --no-backend  # .NET saja
```

**Catatan:** Script memerlukan `go` di PATH. Jika error "command not found: go", pastikan `/usr/local/go/bin` ada di PATH.

### 4. `verify-live.sh` — Health Check + SHA Verification
```bash
./ops/verify-live.sh --env prod --expect-sha <sha>
```

Cek endpoints:
- `GET http://127.0.0.1:8080/health` + `/health/version` (Go)
- `GET http://127.0.0.1:5000/api/v1/health` + `/api/v1/health/version` (.NET)

### 5. `vps-rollback.sh` — Rollback dari Backup
```bash
./ops/vps-rollback.sh --env prod --backup-dir /opt/alephdraad/backups/<timestamp>
```

### 6. `test-market-backend.sh` — Market-specific Tests
Verifikasi terfokus untuk market handler dan client.

```bash
./ops/test-market-backend.sh                  # Semua market tests
./ops/test-market-backend.sh --scope services # Client tests saja
./ops/test-market-backend.sh --scope handlers # Handler tests saja
```

Menggunakan `go test .` (full package compilation) — diperlukan karena handler sudah didekomposisi ke 5 file.

### 7. `quality-score.sh` — 9-Dimension Quality Measurement
```bash
bash ops/quality-score.sh
```

Output skor 0-100 dari 9 dimensi. Report disimpan di `.ops/reports/`.

### 8. `test-coverage.sh` — Coverage Report
```bash
bash ops/test-coverage.sh
```

## Directory Structure

```
ops/
├── lib/
│   └── common.sh          # Shared utilities (log, run_step, etc.)
├── preflight-full.sh       # Quality gate
├── commit-push.sh          # Commit + push + deploy
├── vps-sync-deploy.sh      # Manual deploy
├── verify-live.sh          # Health check
├── vps-rollback.sh         # Rollback
├── test-market-backend.sh  # Market-specific tests
├── quality-score.sh        # Quality scoring
├── test-coverage.sh        # Coverage report
└── README.md               # This file
```
