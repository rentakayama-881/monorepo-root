## Summary

- Scope:
- Why:
- Risk level:

## Changes

- [ ] Backend (Go)
- [ ] Feature Service (.NET)
- [ ] Frontend (Next.js)
- [ ] Docs/ops only

## Quality Gates Evidence

- [ ] `./ops/preflight-full.sh` passed (or equivalent CI full lane)
- [ ] Added/updated regression tests for changed critical paths
- [ ] No new critical security finding in impacted scope

## Deployment Impact

- [ ] No deploy impact
- [ ] Requires backend deploy to VPS
- [ ] Requires config/env update

Target SHA for deploy:

Rollback plan:

## Live Evidence (Required for production deploy tasks)

- [ ] Go health ok (`/health`)
- [ ] Go version endpoint matches SHA (`/health/version`)
- [ ] Feature health ok (`/api/v1/health`)
- [ ] Feature version endpoint matches SHA (`/api/v1/health/version`)

## Checklist

- [ ] Conventional commit format used
- [ ] User-facing messages stay in Bahasa Indonesia
- [ ] No secrets/PII/token leaked in logs or code
