# Targeted Depth Audit & Improvement — Design Document

**Date:** 2026-03-06
**Approach:** Targeted Depth (high-impact areas first, thorough fixes)
**Quality Score Baseline:** 77/100

## Problem Statement

This monorepo has been worked on by multiple AI agents across many sessions, resulting in:
- A 2,943-line handler file (`lzt_market_handler.go`) that is the #1 churn hotspot (30 changes in 200 commits)
- 20+ consecutive `fix(market)` commits indicating a fix-on-fix regression cycle
- HEAD commit is a revert of its immediate predecessor
- No Next.js middleware for server-side auth protection
- 3 `go vet` issues in the backend
- Documentation/code mismatches (fonts, API base URL proliferation)
- Multiple 500+ line frontend files violating modularity standards

## Audit Summary

### What's Strong (Preserve)
- **Feature Service (.NET)**: Production-grade financial platform. Double-entry ledger, comprehensive idempotency, PQC-ready, no TODOs, 18 test files. Leave it alone.
- **Backend auth/security stack**: Solid middleware chain, device tracking, impossible travel detection, sudo mode, session locks.
- **CI/CD pipeline**: Enterprise-grade with security scanning, auto-rollback, quality scoring.
- **Frontend lib/ layer**: Well-organized utilities with good test coverage.
- **Ops scripts**: Mature preflight, deploy, rollback, quality scoring system.

### What Needs Fixing (Prioritized)

#### Phase 1: Stabilize Market Feature (Critical)
- **Backend**: Break `lzt_market_handler.go` (2,943 lines) into proper service layer
- **Backend**: Finalize uncommitted `lzt_market_client.go` improvements
- **Frontend**: Finalize the market component refactoring (utils extraction, listing hook)
- **Tests**: Ensure market handler and client tests pass

#### Phase 2: Security Hardening (High)
- **Frontend**: Add `middleware.js` for server-side auth protection on `/account/*`, `/admin/*`, `/market/*/orders/*`
- **Backend**: Fix 3 `go vet` issues
- **Env hygiene**: Consolidate 4 API base URL env vars into 1

#### Phase 3: Code Quality Quick Wins (Medium)
- **Docs**: Fix font mismatch in RULES.md (actual fonts are IBM Plex, not Source Sans)
- **Backend**: Remove duplicate PostgreSQL driver (`lib/pq` — only `pgx/v5` is needed)
- **Frontend**: Remove legacy catch-all route `/validation-case/[[...slug]]/` if unused
- **Quality**: Target 80+ quality score

#### Phase 4: Validate
- Run preflight-full.sh
- Run quality-score.sh
- Verify all tests pass
- Check for regressions

## Constraints
- No changes to financial rules or amounts
- No changes to Ent schemas
- No changes to Feature Service (.NET) — it's already solid
- No new dependencies without clear justification
- All user-facing text stays in Indonesian
- Conventional commits format
