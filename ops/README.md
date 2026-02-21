# Ops Scripts (Strict Workflow)

## Purpose

Folder ini menyatukan command operasional wajib agar AI/human operator selalu konsisten.

## Scripts

1. `preflight-full.sh`
- Menjalankan full gate lintas monorepo.

2. `commit-push.sh`
- Menjalankan preflight, lalu commit + push branch kerja.

3. `vps-sync-deploy.sh`
- Sinkronkan backend Go + .NET ke SHA target, build fresh, restart service, verify live SHA.

4. `verify-live.sh`
- Cek health endpoints + validasi SHA runtime.

5. `vps-rollback.sh`
- Restore artifacts dari backup lalu restart + verify.
