# Deploy Workflow

## Step 0: Confirm Scope (MANDATORY)

Before deploying, clarify:

1. **What changed?** — Backend only? Frontend only? Both? Feature Service?
2. **Is this a hotfix or scheduled release?** — Hotfixes use `--scope backend-feature`
3. **Any database migrations?** — If yes, coordinate migration timing with deploy
4. **Any env var changes?** — If yes, update `.env` on VPS before deploying

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Pre-deploy
```bash
./ops/preflight-full.sh --scope all
```
All checks must pass before deploying.

Untuk hotfix backend/feature yang tidak menyentuh frontend:
```bash
./ops/preflight-full.sh --scope backend-feature
```

## Step 3: Deploy

### Frontend (automatic)
- Push to `main` triggers Vercel auto-deploy
- No manual action needed
- Verify at: https://aivalid.id

### Backend Services (VPS)
```bash
# Full deploy (runs preflight → commit → push → build → restart → verify):
./ops/commit-push.sh --scope all "type(scope): message"

# Manual deploy to specific SHA:
./ops/vps-sync-deploy.sh --env prod --ref <sha>

# Backend only (skip .NET rebuild):
./ops/vps-sync-deploy.sh --env prod --ref <sha> --no-feature

# Feature Service only (skip Go rebuild):
./ops/vps-sync-deploy.sh --env prod --ref <sha> --no-backend
```

Untuk backend hotfix:
```bash
./ops/commit-push.sh --scope backend-feature "fix(backend): message"
```

## Step 4: Verify
```bash
./ops/verify-live.sh --env prod --expect-sha <sha>
```

Evidence required (all must be confirmed):
- Go health: `GET http://127.0.0.1:8080/health` → OK
- Go version: `GET http://127.0.0.1:8080/health/version` → SHA matches
- Feature Service health: `GET http://127.0.0.1:5000/api/v1/health` → OK
- Feature Service version: `GET http://127.0.0.1:5000/api/v1/health/version` → SHA matches

**Note:** `verify-live.sh` checks BOTH services by default. If you only deployed one service (`--no-feature` or `--no-backend`), the SHA mismatch for the non-deployed service is expected.

## Step 5: Rollback (if needed)
```bash
./ops/vps-rollback.sh --env prod --backup-dir <path>
```

Backups are stored in `/opt/alephdraad/backups/<timestamp>-<sha>/`.

## Step 6: Post-deploy Monitoring

After deploy, check for issues:
```bash
# Go backend logs:
sudo journalctl -u alephdraad-backend.service -f --no-pager -n 50

# Feature Service logs:
sudo journalctl -u feature-service.service -f --no-pager -n 50
```

## Checklist
- [ ] Scope confirmed (which services to deploy)
- [ ] Preflight passed with appropriate scope
- [ ] All CI checks green
- [ ] Health endpoints return OK
- [ ] Version endpoints match expected SHA
- [ ] No error spikes in logs after deploy
- [ ] If frontend changed: verify Vercel deployment succeeded
