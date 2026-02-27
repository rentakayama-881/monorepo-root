# Deploy Workflow

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Pre-deploy
```bash
./ops/preflight-full.sh --scope all
```
All checks must pass before deploying.

Untuk hotfix backend/feature yang tidak menyentuh frontend, gunakan scope:
```bash
./ops/preflight-full.sh --scope backend-feature
```

## Step 3: Deploy

### Frontend (automatic)
- Push to `main` triggers Vercel auto-deploy
- No manual action needed

### Backend Services (VPS)
```bash
./ops/commit-push.sh --scope all "type(scope): message"
# If CI deploys automatically, wait for CI completion.
# Otherwise:
./ops/vps-sync-deploy.sh --env prod --ref <sha>
```

Untuk backend hotfix:
```bash
./ops/commit-push.sh --scope backend-feature "fix(backend): message"
```

## Step 4: Verify
```bash
./ops/verify-live.sh --env prod --expect-sha <sha>
```

Evidence required:
- Go health: `GET /health` returns OK
- Go version: `GET /health/version` matches SHA
- Feature Service health: `GET /api/v1/health` returns OK
- Feature Service version: `GET /api/v1/health/version` matches SHA

## Step 5: Rollback (if needed)
```bash
./ops/vps-rollback.sh --env prod --backup-dir <path>
```

## Checklist
- [ ] Preflight passed
- [ ] All CI checks green
- [ ] Health endpoints return OK
- [ ] Version endpoints match expected SHA
- [ ] No error spikes in logs after deploy
