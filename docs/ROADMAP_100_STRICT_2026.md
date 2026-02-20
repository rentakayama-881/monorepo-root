# Roadmap 100/100 (Strict Engineering, 2-3 Months)

Last updated: February 20, 2026

## North Star

Reach strict engineering `100/100` across the monorepo with no rubric aspect under `90`.

## Phase Timeline

1. Phase 0 (Week 1): Baseline & Governance
- Freeze baseline logs and manual rubric score per module.
- Lock quality contract and gate thresholds.
- Enforce branch protections and required checks for auth/financial areas.
- Deliverables:
  - Baseline scorecard + debt priority list.
  - Quality contract document.
  - Phase acceptance criteria.

2. Phase 1 (Week 1-2): CI Portability & Determinism
- Stabilize runner portability (cache/permission/network-sensitive jobs).
- Split quick PR lane and full main/nightly lane.
- Harden dependency/security gate policy.
- Deliverable:
  - 10 consecutive green CI runs on main.

3. Phase 2 (Week 2-4): Safety Harness & Test Gaps
- Add test harness for auth + financial critical flows.
- Add contract tests across services.
- Add e2e golden paths (login/register/passkey/totp/wallet/dispute).
- Deliverable:
  - Critical flows protected by regression harness.

4. Phase 3 (Week 4-8): Structural Refactor
- Break up jumbo files and reduce complexity.
- Extract bounded domain services and shared boundary abstractions.
- Deliverable:
  - Significant LOC/complexity/duplication reduction in top hotspots.

5. Phase 4 (Week 8-10): Security, Reliability, Observability
- Resolve high/critical dependency issues with controlled upgrades.
- Standardize idempotency/retry/timeout policies in financial paths.
- Improve traceability and error diagnosis (structured logs + correlation IDs).
- Deliverable:
  - No open critical security issue, faster incident diagnosis.

6. Phase 5 (Week 10-12): Performance & Final Uplift
- Frontend bundle/hydration optimization.
- Backend/.NET endpoint profiling and query/caching optimizations.
- Final dead-code cleanup and docs sync.
- Deliverable:
  - All rubric aspects `>= 90`, full gate stack green.

## Mandatory Test Scenarios

1. Auth
- Password/passkey/TOTP login
- Refresh token + session expiry
- Account lock behavior

2. Wallet/Financial
- Transfer lifecycle (create/release/cancel/reject)
- Deposit/withdrawal
- Dispute creation/respond flow

3. Validation Case
- Create/update/workflow transitions
- Permission boundaries

4. Security
- Input validation bypass attempts
- AuthZ checks, rate limit, PII/secret leakage checks

5. Resilience
- Timeout and partial outage behavior
- Retry + idempotency correctness

6. Frontend Regression
- Critical route rendering
- Error boundary behavior
- Cross-tab auth synchronization

## PR Blocker Rule

If any required gate fails in impacted modules, merge is blocked.

