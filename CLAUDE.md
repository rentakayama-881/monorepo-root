# CLAUDE.md — AI Development Instructions

> This file governs ALL AI-assisted development in the AIValid monorepo.
> It is auto-loaded by Claude Code, Cursor, Windsurf, Copilot, and referenced by ChatGPT.

---

## AI Behavior Protocol (MANDATORY)

### 1. Always Ask, Never Assume

Before implementing ANY non-trivial change:

1. **Clarify intent** — Ask what the user actually wants, not what you think they want
2. **Confirm scope** — "Apakah perubahan ini mencakup X, Y, dan Z, atau hanya X?"
3. **Propose approach** — Present 2-3 options with trade-offs. Recommend the BEST one, not the easiest
4. **Verify understanding** — Summarize what you'll do before doing it

**Examples of when to ask:**
- "You want me to add validation — should this be client-side, server-side, or both?"
- "This touches the auth flow — should I also update the middleware?"
- "I see two approaches: A (cleaner but more work) vs B (quicker but adds tech debt). Which do you prefer?"

**Anti-patterns (NEVER DO):**
- Making assumptions about database schema changes
- Guessing API endpoint design without confirming
- Assuming what error messages should say
- Silently changing auth/financial logic
- Skipping edge cases because "it's probably fine"

### 2. Pursue Excellence, Not Convenience

- Always suggest the **best engineering practice**, even if harder to implement
- When you see technical debt, code smells, or improvements — flag them proactively
- Prefer durable solutions over quick patches
- If a "simple fix" would create tech debt, propose the proper solution instead
- Reference how top-tier teams (Anthropic, Stripe, Vercel, Supabase) would solve the problem

### 3. Understand Before Acting

- **Read existing code** before modifying it — understand the full context
- **Check how similar things are done** elsewhere in the codebase
- **Follow existing patterns** unless there's a strong reason not to
- **Run `context.sh`** before any code change to know the current state
- **Never trust documentation over code** — if they conflict, the code/scripts are correct

### 4. Questioning Protocol

When receiving a task, mentally verify these before starting:

| Question | If Unclear |
|----------|-----------|
| What exactly should change? | Ask user to clarify the requirement |
| What files are affected? | Explore codebase first, share findings |
| Are there related systems that need updating? | Flag dependent systems |
| What could break? | List potential risks before proceeding |
| How will this be tested? | Propose test strategy |
| Does this follow existing patterns? | Reference similar code in the repo |

**Rule: It is ALWAYS better to ask one too many questions than to make one wrong assumption.**

---

## First Action (Mandatory)

Before making ANY code change, run:

```bash
bash .ai/context.sh
```

This outputs the **current** state: versions, schemas, file counts, routes, and quality score.
Never trust hardcoded numbers — always discover state dynamically.

---

## Project Identity

- **Product:** AIValid (aivalid.id) — Platform validasi hasil kerja AI oleh ahli manusia
- **Language:** Indonesian (id) for ALL user-facing content
- **Currency:** IDR, displayed as "Rp" with dot-separated thousands (e.g., Rp 100.000)
- **Branding:** Always "AIValid". Never "alephdraad" in user-facing content.

---

## Architecture Overview

### Services

| Service | Stack | Domain | Deploy |
|---------|-------|--------|--------|
| Go Backend (`backend/`) | Gin + Ent ORM + PostgreSQL | Auth, users, cases, workflow, market proxy | VPS systemd → :8080 |
| Feature Service (`feature-service/`) | .NET 9 + MongoDB + Redis | Finance (wallets, escrow, disputes), PQC keys | VPS systemd → :5000 |
| Frontend (`frontend/`) | Next.js App Router + React + SWR + Tailwind v4 | All user-facing UI | Vercel auto-deploy |

### Domains
- `https://aivalid.id` — Frontend (Vercel)
- `https://api.aivalid.id` — Go Backend (nginx → :8080)
- `https://feature.aivalid.id` — Feature Service (nginx → :5000)

### Communication Flow

```
Frontend ─── REST ──→ Go Backend       (lib/api.js: fetchJson, fetchJsonAuth)
Frontend ─── REST ──→ Feature Service  (lib/featureApi.js: featureFetch, featureFetchAuth)
Go Backend ── HTTP ──→ Feature Service (escrow operations)
Feature Service ── callback ──→ Go Backend (/api/internal/* with SERVICE_TOKEN)
```

### Key Patterns

| Layer | Pattern | Notes |
|-------|---------|-------|
| Go Backend | Handler → Service → Ent ORM | Never raw SQL. Edit `ent/schema/` only. |
| Feature Service | Controller → Service → MongoDB | Integers only for money. Idempotency keys. |
| Frontend | Page → Client Component → SWR + API | `.jsx` extension. `cn()` for class merging. |
| Auth | JWT in localStorage + presence cookies | `has_session=1`, `has_admin=1` cookies for middleware |
| Market handler | 5 files in `handlers/` package | types, helpers, listing, orders, handler |

### Key Frontend Files

| File | Purpose |
|------|---------|
| `lib/api.js` | Go backend HTTP client (single env var: `NEXT_PUBLIC_API_BASE_URL`) |
| `lib/featureApi.js` | Feature Service HTTP client |
| `lib/auth.js` | Token storage + presence cookie management |
| `lib/adminAuth.js` | Admin session + presence cookie management |
| `lib/tokenRefresh.js` | JWT auto-refresh with race protection |
| `lib/format.js` | Currency/date formatters (centralized) |
| `lib/logger.js` | Structured logging with Sentry |
| `proxy.js` | Edge proxy for auth route protection + pathname header |
| `app/globals.css` | Design tokens (oklch), font declarations |

---

## Instruction Files (Detailed Reference)

Read these for full context on specific topics:

1. `.ai/RULES.md` — Coding conventions, commit format, design tokens, invariants
2. `.ai/ARCHITECTURE.md` — Service boundaries, domain model, financial rules, middleware
3. `.ai/QUALITY.md` — 9-dimension quality scoring, coverage floors, merge rules
4. `.ai/SECURITY.md` — 12-category defensive security checklist

## Workflow Prompts

For specific tasks, read the matching workflow in `.ai/prompts/`:

| Task | Prompt |
|------|--------|
| New feature | `.ai/prompts/feature.md` |
| Bug fix | `.ai/prompts/fix.md` |
| Refactor | `.ai/prompts/refactor.md` |
| Migration | `.ai/prompts/migrate.md` |
| Code review | `.ai/prompts/review.md` |
| Deploy | `.ai/prompts/deploy.md` |
| Frontend styling | `.ai/prompts/style-guide.md` |
| Repo audit/cleanup | `.ai/prompts/audit.md` |

---

## Decision Authority Matrix

### Agent Decides (No Approval Needed)
- File organization within established patterns
- Variable/function naming following conventions
- Which existing UI components to compose
- Tailwind utility classes following `.ai/prompts/style-guide.md`
- SWR cache keys and revalidation strategy
- Error message wording (Indonesian, matching existing tone)
- Commit message content (conventional commits format)
- Test structure and assertions
- Splitting large files (>500 lines) into same-package modules

### Agent MUST Ask First
- New Ent schema or field changes (database migrations)
- New API endpoint design (route, method, auth level)
- Financial rule changes (amounts, fees, limits, escrow logic)
- Adding new dependencies (npm, go, NuGet)
- Auth/authorization logic changes
- Workflow state machine changes (validation case states)
- Deployment config changes
- Removing features or endpoints
- Destructive database operations
- Changes to `.ai/` instruction files or ops scripts
- Any change that affects the public API contract

---

## Quality Gates

```bash
# Before every commit:
./ops/preflight-full.sh

# Commit + push (enforces preflight, auto-deploys on main):
./ops/commit-push.sh "type(scope): message"

# Quality measurement (9 dimensions, 100-point scale):
bash ops/quality-score.sh
```

Scopes for conventional commits: `frontend`, `backend`, `feature-svc`, `ops`, `ai`, `docs`, `ci`, `deps`

---

## Critical Invariants (NEVER Violate)

| Invariant | Details |
|-----------|---------|
| Financial amounts | **Always integers**, never floats. All finance goes through Feature Service. |
| User-facing text | Indonesian language only |
| Auth tokens | Never expose in API responses, logs, or error messages |
| Crypto | `crypto.randomUUID()` — never `Math.random()` |
| Logging | `lib/logger.js` — never raw `console.*` in app/lib code |
| Images | Every `<img>` must have `alt` attribute |
| SQL | Ent ORM only — never raw SQL |
| Internal calls | Require `SERVICE_TOKEN` header |
| Wallet PIN | PBKDF2, 310K iterations, 4-fail lockout 4h |
| Idempotency | Required for all financial write operations |

---

## Truth Hierarchy

If documentation conflicts with `context.sh` output, **the script is correct**.
If `.ai/` docs conflict with actual code behavior, **the code is correct**.
Documentation describes process. Scripts and code discover state.
