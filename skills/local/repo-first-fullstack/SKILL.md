---
name: repo-first-fullstack
description: Evidence-backed, repo-first full-stack modernization and audits for this monorepo (Next.js App Router + Tailwind/design tokens, Go Gin API, .NET 8 feature-service, and infra glue). Use when asked to map architecture from actual code, modernize UI to 2025/2026 quality using existing tokens, connect frontend to backend endpoints with correct auth/error handling/idempotency, create E2E verification runbooks, or quarantine stale documentation. Require proof for non-trivial claims (file excerpts, rg output, tests, logs) and always produce Discovery Summary, Plan, Changes, Validation Results, Staleness Report, and Quality Notes.
---

# Repo-First Fullstack (Harvard-Style)

## Operating contract (non-negotiable)

- Treat code + runtime behavior as the source of truth; treat docs as untrusted until confirmed.
- Make no assumptions. If unsure, discover with repo search, builds/tests, or (read-only) logs.
- Back every non-trivial claim with evidence: file path + excerpt, `rg`/`git` output, test/build output, or runtime logs (redacted).
- Never print secrets. Redact tokens/keys/credentials. Avoid reading `.env*` or secret stores.
- Avoid destructive actions (deletes, resets, migrations, service restarts, secret rotation) unless explicitly requested and preceded by a safety plan.
- Do not weaken auth/security or add "temporary bypasses".

## Default workflow (always follow)

1) **Discovery first**: build an evidence-based map of the repo and (optionally) runtime.
2) **Plan**: propose minimal-risk, phased steps.
3) **Change**: implement the smallest safe increment.
4) **Validate**: run the narrowest relevant build/tests; confirm behavior with logs when applicable.
5) **Report**: use the required output sections.

Use the helper scripts when they save time:
- `scripts/discovery_repo.py` to generate an evidence ledger markdown file.
- `scripts/check_docs_links.py` to find broken relative doc links for staleness analysis.

## Stop conditions (halt and report)

Stop and report “BLOCKED” if any of these prevent correctness:
- Frontend/backend mismatch (endpoint not registered, auth/header mismatch, or incompatible error format).
- Documentation conflicts with current code in a correctness-impacting way.
- Builds/tests cannot run due to missing environment prerequisites (list exact missing items).

## Required output sections (always)

1) **DISCOVERY SUMMARY** (evidence-backed map)
2) **PLAN** (phased, minimal-risk)
3) **CHANGES** (files touched, what & why)
4) **VALIDATION RESULTS** (commands + output excerpts)
5) **STALENESS REPORT** (docs that conflict with code)
6) **2025/2026 QUALITY NOTES** (measurable UI/perf/accessibility notes)

Copy/paste template: `references/output-template.md`

Include a short **EVIDENCE LEDGER** (as its own section or inside Discovery Summary) linking each claim to concrete proof.

## References (load as needed)

- `references/workflow.md` (Discovery-first workflow + safe commands)
- `references/integration.md` (Frontend ↔ backend contract + evidence patterns)
- `references/ui-standards.md` (2025/2026 UI quality bar)
- `references/staleness.md` (Stale-doc quarantine + report checklist)
