# Ops Scripts (Strict Workflow)

## Purpose

Folder ini menyatukan command operasional wajib agar AI/human operator selalu konsisten.

## Scripts

1. `preflight-full.sh`
- Menjalankan full gate lintas monorepo.
- Bisa dibatasi scope:
  - `--scope all` (default)
  - `--scope backend`
  - `--scope backend-feature`
  - `--scope frontend`

2. `commit-push.sh`
- Menjalankan preflight, lalu commit + push.
- Jika dijalankan dari `main`, otomatis deploy VPS ke SHA terbaru (kecuali `--skip-deploy`).
- Flags:
  - `--skip-deploy`
  - `--deploy-vps`
  - `--scope all|backend|backend-feature|frontend`
    - Scope `frontend` tidak memicu auto deploy VPS.

3. `vps-sync-deploy.sh`
- Sinkronkan backend Go + .NET ke SHA target, build fresh, restart service, verify live SHA.

4. `verify-live.sh`
- Cek health endpoints + validasi SHA runtime.

5. `vps-rollback.sh`
- Restore artifacts dari backup lalu restart + verify.
