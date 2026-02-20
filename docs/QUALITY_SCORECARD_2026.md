# Quality Scorecard 2026

Last updated: February 20, 2026

## Target

Strict engineering `100/100` with all rubric aspects `>= 90`, no critical risk open, and all required CI lanes green.

## Rubric Weights

- Correctness: 25
- Readability: 15
- Testability: 15
- Security & Reliability: 20
- Performance: 10
- Maintainability & Evolvability: 15

## Baseline Score (Manual, 2026-02-20)

- Final score: `73/100`
- Band: Fair (stabilized foundation, major uplift still required)

### Aspect breakdown

- Correctness: 76/100
- Readability: 68/100
- Testability: 72/100
- Security & Reliability: 70/100
- Performance: 74/100
- Maintainability & Evolvability: 66/100

## Baseline Gate Evidence

Primary scripts:

- `deploy/scripts/quality-baseline.sh`
- `deploy/scripts/generate-score-summary.sh`
- `deploy/scripts/check-ci-streak.sh`

Latest quick-lane production-like baseline log:

- `.quality/baseline-2026-02-20T3-network.log`

Auto summary snapshot:

- Overall gate: `PASS`
- Gate totals: `pass=3, fail=0, timeout=0`
- Initial heuristic band: `90-100 (Excellent trajectory)`

CI stability artifact:

- Workflow job: `📈 CI Stability Report`
- Artifact name: `ci-stability-report-<run_id>`
- Failure classes: `none`, `code_failure`, `infra_network`, `dependency_registry`, `timeout`

Notes:

- Sandbox-only baseline runs can fail because external package registries are blocked (`proxy.golang.org`, `api.nuget.org`).
- Network-enabled baseline is the valid reference for CI parity.

## Current Hotspots (High Leverage Refactor Targets)

- `backend/services/validation_case_workflow_service_ent.go`
- `backend/handlers/lzt_market_handler.go`
- `feature-service/src/FeatureService.Api/Services/TransferService.cs`
- `feature-service/src/FeatureService.Api/Services/DisputeService.cs`
- `frontend/app/validation-cases/[id]/ValidationCaseDetailClient.jsx`
- `frontend/app/account/page.jsx`

## Security Debt Snapshot

- .NET dependency vulnerabilities: cleared in current audit run.
- Frontend production audit still uses temporary allowlist for Sentry chain (`@sentry/nextjs`, `@sentry/node`, `minimatch` transitive path).
- Exit criteria requires removing temporary allowlist or replacing with upstream-fixed versions.

## Phase Status

1. Phase 0 - Baseline & Governance: In progress
- Done: baseline scripts + score summary generation + quality contract doc + branch protection runbook.
- Pending: enforce branch protection settings at repository level.

2. Phase 1 - CI Determinism: In progress
- Done: vulnerability gates explicit, quick/full lane split, CI stability collector artifact.
- Pending: achieve 10 consecutive green runs for quick and full lanes.

3. Phase 2 - Safety Harness: Planned
4. Phase 3 - Structural Refactor: Planned
5. Phase 4 - Security/Observability Hardening: Planned
6. Phase 5 - Final Performance + Quality Push: Planned

## Definition of Done for 100/100

1. All rubric aspects `>= 90`.
2. No rubric aspect `< 90`.
3. Required CI quick lane and full lane pass consistently in production-like runners.
4. No open critical security issues and no unmitigated high issues in critical flows.
5. Critical auth/financial workflows covered by stable unit + integration + e2e/contract tests.

## Related Docs

- `docs/QUALITY_CONTRACT_2026.md`
- `docs/ROADMAP_100_STRICT_2026.md`
- `docs/BRANCH_PROTECTION_2026.md`
