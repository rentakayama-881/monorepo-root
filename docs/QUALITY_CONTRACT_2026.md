# Quality Contract 2026 (Strict Engineering)

Last updated: February 20, 2026

## Objective

This contract defines mandatory quality gates and release rules to drive the monorepo toward strict `100/100`.

## Merge Rules (Pull Request / Quick Lane)

All impacted modules must pass the required checks below:

1. Backend (`backend/`)
- `go vet ./...`
- `go test -v ./...`

2. Feature service (`feature-service/`)
- `dotnet build --configuration Release`
- `dotnet test --configuration Release`

3. Frontend (`frontend/`)
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --ci --runInBand`

4. Security baseline
- No new `critical` findings in dependency or container scans.
- No new unmitigated `high` findings in impacted module scope.

## Main / Nightly Rules (Full Lane)

In addition to quick-lane checks:

1. Backend hardening
- `go test -v -race ./...`

2. Frontend production readiness
- `SKIP_PREBUILD_CHECK=1 npm run build`
- `npm audit --omit=dev --audit-level=high`

3. Security and reliability
- Full CI security jobs (Trivy, .NET vulnerable dependency audit, Go vulnerability scanning).
- E2E + performance smoke on nightly pipeline.

## CI Stability Evidence Rule

Evidence is mandatory for Phase 1 completion:

1. CI run artifact
- `ci-stability-report-<run_id>` from job `📈 CI Stability Report`.

2. Record format
- `lane`, `result`, `failure_class`, `failed_jobs`, `run_id`, `sha`, `timestamp_utc`.

3. Streak threshold
- Quick lane streak: `>= 10` consecutive `success`.
- Full lane streak: `>= 10` consecutive `success`.

4. Streak evaluator
- `deploy/scripts/check-ci-streak.sh --input <stability-json-dir> --target 10`.

5. Failure class vocabulary
- `none`
- `code_failure`
- `infra_network`
- `dependency_registry`
- `timeout`

## Coverage Floors

Current minimum floors (can only go up):

- Backend: `60%`
- Feature service: `50%`
- Frontend: critical auth/financial route tests mandatory before major refactor merges.

## Waiver Policy

A gate waiver is allowed only when all conditions are met:

1. Risk is documented in PR and linked issue.
2. Scope is temporary and time-bounded.
3. Mitigation owner and deadline are explicit.
4. No waiver for `critical` security findings.

## 100/100 Exit Criteria

Quality target is reached only when all are true:

1. Every rubric aspect is `>= 90`.
2. No rubric aspect is `< 90`.
3. Required quick lane and full lane checks are green in production-like CI.
4. No open critical issue; no unmitigated high issue in critical flows.
5. Auth and financial critical paths have stable regression harness (unit + integration + e2e/contract).

## Branch Protection Alignment

Repository settings must enforce the contract:

1. Required checks:
- `✅ Quality Gate (Quick Lane)` for `develop`.
- `✅ Quality Gate (Full Lane)` for `main`.

2. Required review:
- Minimum one reviewer, with stricter owner review on auth/financial/security scope.

3. Operational runbook:
- `docs/BRANCH_PROTECTION_2026.md`
