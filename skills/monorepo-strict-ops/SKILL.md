# monorepo-strict-ops

Purpose: enforce strict engineer workflow in this repository across fresh AI sessions.

## Must-Read

1. `AGENTS.md`
2. `docs/AI_OPERATING_SYSTEM.md`
3. `docs/QUALITY_CONTRACT_2026.md`

## Required Workflow

1. Implement scoped change.
2. Run `./ops/preflight-full.sh`.
3. Run `./ops/commit-push.sh "type(scope): message"`.
4. Open PR and merge.
5. Deploy backend with `./ops/vps-sync-deploy.sh --env prod --ref <sha>`.
6. Verify live SHA with `./ops/verify-live.sh --env prod --expect-sha <sha>`.

## Prohibited

1. Claiming deployment success without health/version evidence.
2. Skipping regression tests for auth/financial changes.
3. Pushing direct to `main` without explicit override.
