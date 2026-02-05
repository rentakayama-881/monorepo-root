# Repo-First Fullstack Report Template

## DISCOVERY SUMMARY

- Repo layout (top-level dirs) + evidence
- Frontend stack proof (Next.js/App Router/Tailwind/tokens) + evidence
- Backend stack proof (Go Gin entrypoint, .NET 8 entrypoint/controllers) + evidence
- Config discovery (env var names only; no secrets) + evidence
- Contradictions discovered (if any) + evidence

## EVIDENCE LEDGER

Keep this short and link each item to concrete proof:
- Key `rg`/`git grep` results (path + excerpt)
- Key entrypoints/config files (path list)
- Relevant test/build outputs
- Relevant runtime logs (redacted)

## PLAN

- Phase 1 (discovery-confirmed tasks only)
- Phase 2 (optional improvements)
- Risks + mitigations
- Stop conditions / rollback notes

## CHANGES

- Files touched (path list)
- What changed + why (tie back to evidence/requirements)
- Security notes (confirm no auth weakening; no secrets logged)

## VALIDATION RESULTS

- Commands run
- Output excerpts (redacted)
- What the results prove

## STALENESS REPORT

For each stale doc:
- Doc path
- Stale indicator (what conflicts)
- Evidence (what code/runtime shows instead)
- Recommended action (update/remove/mark deprecated)

## 2025/2026 QUALITY NOTES

- UI: responsive behavior, token discipline, accessibility checks
- Perf: render/bundle considerations, hotspots addressed (if measured)
- Stability: error handling, idempotency, logs, regression risks
