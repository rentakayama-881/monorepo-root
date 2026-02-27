# AIValid Architecture

> This document describes service boundaries and domain model.
> For current versions, schema counts, and file stats: `bash .ai/context.sh`

## Services

### Go Backend (`backend/`)
- **Domain:** Auth, users, sessions, validation cases, workflow orchestration, tags, badges, admin
- **Database:** PostgreSQL via Ent ORM (schemas in `ent/schema/`)
- **Pattern:** Handler -> Service -> Ent
- **Deployment:** VPS via systemd, nginx reverse proxy to :8080

### Feature Service (`feature-service/`)
- **Domain:** Finance (wallets, deposits, withdrawals, transfers, escrow/guarantees, disputes), documents, reports, PQC keys, moderation
- **Database:** MongoDB Atlas
- **Pattern:** Controller -> Service -> MongoDB
- **Deployment:** VPS via systemd, nginx reverse proxy to :5000

### Frontend (`frontend/`)
- **Framework:** Next.js App Router + React
- **Pattern:** Page -> Client Component -> API calls via lib/api.js or lib/featureApi.js
- **Deployment:** Vercel auto-deploy from GitHub main

## Domains
- https://aivalid.id — Frontend (Vercel)
- https://api.aivalid.id — Go Backend (nginx -> :8080)
- https://feature.aivalid.id — Feature Service (nginx -> :5000)

## Service Communication

```
Frontend ---REST---> Go Backend (lib/api.js: fetchJson, fetchJsonAuth)
Frontend ---REST---> Feature Service (lib/featureApi.js: featureFetch, featureFetchAuth)
Go Backend --HTTP--> Feature Service (escrow operations)
Feature Service --callback--> Go Backend (/api/internal/* with SERVICE_TOKEN)
```

## Key Frontend Files
- `lib/api.js` — Go backend client
- `lib/featureApi.js` — Feature Service client
- `lib/auth.js` — Token storage
- `lib/tokenRefresh.js` — JWT auto-refresh with race protection
- `lib/format.js` — Currency/date formatters (centralized)
- `lib/apiHelpers.js` — Response unwrapping (centralized)
- `lib/logger.js` — Structured logging with Sentry
- `lib/UserContext.js` — Global user state
- `lib/ThemeContext.js` — Dark/light mode

## Validation Case Workflow (Core Domain)

State machine — strict transitions:

1. **Creation** (Owner) — Structured intake form, status: `open`
2. **Consultation Request** (Validator) — Requires Rp 100,000 credibility stake
3. **Consultation Approval** (Owner) — Accept/reject validator
4. **Clarification** (Bidirectional) — Q&A, 12h SLA, auto-reminders at 2h/8h
5. **Final Offer** (Validator) — Amount, hold hours, terms
6. **Offer Acceptance** (Owner) — Funds locked in escrow
7. **Artifact Submission** (Validator) — Completed work
8. **Release** — Auto-release after hold period, or manual owner release

## Financial Rules (Immutable)

| Rule | Value |
|------|-------|
| Wallet PIN | 4-digit, PBKDF2 310K iterations, 4-fail lockout 4h |
| Min transfer | Rp 10,000 |
| Transfer fee | 2% |
| Max hold | 30 days (default 7) |
| Min credibility stake | Rp 100,000 |
| Min bounty | Rp 10,000 |
| Min deposit | Rp 10,000 |
| Min withdrawal | Rp 50,000 |
| Amount storage | Integers only (never floats) |
| Write operations | Idempotency key required |

## Middleware Chain Order (Go Backend)
1. CORS
2. Security headers
3. Request size limit
4. Rate limiting (per-route: general 60/min, auth 10/min, search 20/min)
5. Auth (JWT extraction)
6. Admin auth (for /admin/*)
7. Sudo (for sensitive operations)

## Error Handling
- Go: `errors.AppError` with code + Indonesian message + status code
- .NET: FluentValidation + custom error middleware
- Frontend: ErrorBoundary + logger.error (Sentry in production)
