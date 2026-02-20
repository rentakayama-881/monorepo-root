# Quality Scorecard 2026

This scorecard tracks the monorepo quality uplift toward strict engineering 100/100.

## Scoring rubric

- Correctness: 25
- Readability: 15
- Testability: 15
- Security & Reliability: 20
- Performance: 10
- Maintainability & Evolvability: 15

## Baseline (2026-02-20)

- Final score: 73/100
- Band: Fair (needs focused improvements)

### Aspect breakdown

- Correctness: 76/100
- Readability: 68/100
- Testability: 72/100
- Security & Reliability: 70/100
- Performance: 74/100
- Maintainability & Evolvability: 66/100

### Notes from baseline gates

- Frontend gates are stable (`lint`, `typecheck`, `test`).
- Backend and feature-service gates can be affected by runner constraints if cache or socket permissions are not configured.
- Security debt remains in frontend dependencies (high vulnerabilities still present).

## Latest implementation snapshot (2026-02-20)

- Next.js prerender on `/validation-cases` is hardened with graceful fallback (build no longer exits at static generation).
- Account settings page was decomposed into focused reusable sections to reduce component size and maintenance cost.
- `TransferService` was split with partial classes to isolate transfer lifecycle operations from query/setup logic.
- CI security gates now enforce high+critical policy for frontend npm audit, feature-service dependency audit, and Trivy scan.

## Current hotspot files (high maintenance cost)

- `backend/services/validation_case_workflow_service_ent.go`
- `backend/handlers/lzt_market_handler.go`
- `feature-service/src/FeatureService.Api/Services/TransferService.cs`
- `feature-service/src/FeatureService.Api/Services/DisputeService.cs`
- `frontend/app/validation-cases/[id]/ValidationCaseDetailClient.jsx`
- `frontend/app/account/page.jsx`

## Definition of done for 100/100

- All rubric aspects >= 90.
- No rubric aspect < 90.
- All required CI quality gates pass without masking failures.
- No critical security finding open without active mitigation.
- Critical auth/financial flows covered by unit + integration + end-to-end regression tests.

## Milestone tracking

| Milestone | Target Date | Goal | Status |
|---|---|---|---|
| M1 CI Determinism | 2026-03-05 | Remove masked failures, stabilize caches, deterministic runners | Completed |
| M2 Safety Harness | 2026-03-26 | Expand regression tests for auth + financial critical paths | Planned |
| M3 Structural Refactor | 2026-04-30 | Break down top 10 jumbo files and reduce complexity | In progress |
| M4 Security Hardening | 2026-05-14 | Reduce dependency vulnerabilities and tighten error boundaries | In progress |
| M5 Final Quality Push | 2026-05-31 | Reach rubric >=90 in all aspects | Planned |

## Update cadence

- Update scorecard weekly on `main`.
- Recompute score after each milestone completion.
