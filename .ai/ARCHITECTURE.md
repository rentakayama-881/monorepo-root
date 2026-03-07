# AIValid Architecture

> This document describes service boundaries, domain model, and system design.
> For current versions, schema counts, and file stats: `bash .ai/context.sh`

## Services

### Go Backend (`backend/`)
- **Domain:** Auth, users, sessions, validation cases, workflow orchestration, tags, badges, admin, market proxy
- **Database:** PostgreSQL via Ent ORM (schemas in `ent/schema/`)
- **Pattern:** Handler → Service → Ent (never raw SQL)
- **Driver:** `github.com/lib/pq` (not pgx — Ent's `Open()` requires "postgres" dialect)
- **Deployment:** VPS via systemd, nginx reverse proxy to :8080

### Feature Service (`feature-service/`)
- **Domain:** Finance (wallets, deposits, withdrawals, transfers, escrow/guarantees, disputes), documents, reports, PQC keys, moderation
- **Database:** MongoDB Atlas
- **Cache:** Redis
- **Pattern:** Controller → Service → MongoDB
- **Deployment:** VPS via systemd, nginx reverse proxy to :5000

### Frontend (`frontend/`)
- **Framework:** Next.js App Router + React + SWR + Tailwind v4
- **Pattern:** Page → Client Component → API calls via `lib/api.js` or `lib/featureApi.js`
- **Auth:** JWT in localStorage, presence cookies for edge middleware
- **Fonts:** IBM Plex Sans (body/headings), IBM Plex Mono (code)
- **Deployment:** Vercel auto-deploy from GitHub main

## Domains
- `https://aivalid.id` — Frontend (Vercel)
- `https://api.aivalid.id` — Go Backend (nginx → :8080)
- `https://feature.aivalid.id` — Feature Service (nginx → :5000)

## Service Communication

```
Frontend ─── REST ──→ Go Backend       (lib/api.js: fetchJson, fetchJsonAuth)
Frontend ─── REST ──→ Feature Service  (lib/featureApi.js: featureFetch, featureFetchAuth)
Go Backend ── HTTP ──→ Feature Service (escrow operations)
Feature Service ── callback ──→ Go Backend (/api/internal/* with SERVICE_TOKEN)
```

**Env vars for API base:**
- `NEXT_PUBLIC_API_BASE_URL` — Client-side Go backend URL (the ONLY public env var)
- `BACKEND_INTERNAL_URL` — Server actions (server-to-server, not exposed to browser)

## Key Frontend Files

| File | Purpose |
|------|---------|
| `lib/api.js` | Go backend client (`NEXT_PUBLIC_API_BASE_URL`) |
| `lib/featureApi.js` | Feature Service client |
| `lib/auth.js` | Token storage + `has_session` presence cookie |
| `lib/adminAuth.js` | Admin session + `has_admin` presence cookie |
| `lib/tokenRefresh.js` | JWT auto-refresh with race protection |
| `lib/format.js` | Currency/date formatters (centralized) |
| `lib/apiHelpers.js` | Response unwrapping (centralized) |
| `lib/logger.js` | Structured logging with Sentry |
| `lib/UserContext.js` | Global user state |
| `lib/ThemeContext.js` | Dark/light mode |
| `middleware.js` | Edge middleware for auth route protection |
| `app/globals.css` | oklch design tokens, font declarations |

## Frontend Auth Architecture

Auth tokens live in **localStorage** (not cookies), so Next.js edge middleware cannot read them directly. Solution: **presence cookies**.

```
Login flow:
  setToken(jwt) → localStorage.setItem("token", jwt)
                 → document.cookie = "has_session=1; path=/; max-age=86400; SameSite=Lax"

Logout flow:
  clearToken()  → localStorage.removeItem("token")
                → document.cookie = "has_session=; path=/; max-age=0"

Middleware (middleware.js):
  /account/*, /market/chatgpt/orders/* → check has_session cookie → redirect to /login
  /admin/* (except /admin/login)       → check has_admin cookie  → redirect to /admin/login
```

Presence cookies are **not auth tokens** — they only indicate "a session likely exists." Client-side guards still verify the actual JWT.

## Market Feature Architecture

The market feature (LZT Market / ChatGPT account marketplace) is the largest feature. Its backend handler was decomposed into 5 files within the `handlers/` package:

| File | Content | Lines |
|------|---------|-------|
| `lzt_market_handler.go` | HTTP handler methods, constructor, buy/retry/process | ~915 |
| `lzt_market_types.go` | Structs, constants, DTOs | ~89 |
| `lzt_market_helpers.go` | Pure functions: normalizers, formatters, extractors, classifiers | ~1,239 |
| `lzt_market_listing.go` | Listing cache, pricing, singleflight refresh | ~524 |
| `lzt_market_orders.go` | Order persistence (save, steps, fail, fulfill) | ~222 |

Frontend market is similarly split:
- `MarketChatGPTClient.jsx` — Main client component
- `useMarketChatGPTListing.js` — SWR hook for listing data
- `marketChatGPTUtils.js` — Formatters, validators, helpers

**External dependency:** The market proxy talks to the LZT Market API. See handler for retry logic, fallback strategies, and supplier balance checks.

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

| Layer | Pattern |
|-------|---------|
| Go Backend | `errors.AppError` with code (e.g., `AUTH001`, `CASE001`) + Indonesian message + HTTP status |
| Feature Service (.NET) | FluentValidation + custom error middleware |
| Frontend | `ErrorBoundary` + `logger.error()` (Sentry in production) |
