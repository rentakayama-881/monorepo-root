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
- **Pattern:** Controller → Service → MongoDB
- **Validation:** FluentValidation (auto-discovery) + DataAnnotations (belt and suspenders)
- **Idempotency:** In-memory ConcurrentDictionary with TTL (single instance)
- **Deployment:** VPS via systemd, nginx reverse proxy to :5000

### Browser Service (`browser-service/`)
- **Domain:** Cloud Anti-Detect Browser — session management, fingerprint rotation, proxy integration, noVNC streaming
- **Stack:** Python 3.11 + FastAPI + Playwright (Chrome real) + Xvfb + x11vnc + websockify
- **Pattern:** Routes → Service layer → Browser automation (Playwright)
- **Anti-Detection:** 14-vector fingerprint spoofing (navigator, canvas, WebGL, WebRTC, timezone, plugins, fonts, etc.)
- **Session Architecture:** Xvfb (virtual display) → Chrome → x11vnc (VNC server) → websockify (WebSocket bridge) → noVNC (frontend iframe)
- **Port Allocation:** API :6100, VNC :6200-6299, WebSocket :6300-6399
- **Database:** Stateless — session state in-memory, profiles/billing in Feature Service (MongoDB)
- **Deployment:** VPS via systemd (`browser-service.service`), nginx reverse proxy to :6100

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
- `https://browser.aivalid.id` — Browser Service (nginx → :6100)

## Service Communication

```
Frontend ─── REST ──→ Go Backend       (lib/api.js: fetchJson, fetchJsonAuth)
Frontend ─── REST ──→ Feature Service  (lib/featureApi.js: fetchFeature, fetchFeatureAuth)
Frontend ─── REST ──→ Browser Service  (lib/browserApi.js: sessions start/stop/status)
Frontend ─── WSS ───→ Browser Service  (noVNC iframe via wss://browser.aivalid.id/ws/{port})
Go Backend ── HTTP ──→ Feature Service (escrow operations)
Feature Service ── callback ──→ Go Backend (/api/internal/* with INTERNAL_API_KEY)
Browser Service ── HTTP ──→ Feature Service (billing ticks via SERVICE_TOKEN)
```

**Env vars for API base:**
- `NEXT_PUBLIC_API_BASE_URL` — Client-side Go backend URL (the ONLY public env var)
- `NEXT_PUBLIC_BROWSER_SERVICE_URL` — Browser Service URL (for session management)
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
| `lib/browserApi.js` | Browser Service client (profiles → Feature Service, sessions → Browser Service) |
| `lib/logger.js` | Structured logging with Sentry |
| `lib/UserContext.js` | Global user state |
| `lib/ThemeContext.js` | Dark/light mode |
| `proxy.js` | Edge proxy for auth route protection + pathname header |
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

Proxy (proxy.js — Next.js 16 uses proxy.js, not middleware.js):
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

## Smart Browser Architecture

The Smart Browser is a Cloud Anti-Detect Browser service that streams real Chrome sessions via noVNC.

### Session Lifecycle
1. User creates a **browser profile** (name, proxy, notes) → stored in Feature Service (MongoDB)
2. User **starts session** → Browser Service launches: Xvfb → Chrome (with stealth) → x11vnc → websockify
3. Frontend renders **noVNC iframe** pointing to `wss://browser.aivalid.id/ws/{port}`
4. **Billing tick** every 60 seconds → Browser Service → Feature Service → wallet deduction
5. User **stops session** or balance insufficient → cleanup all processes

### Anti-Detection (14 Vectors)
1. Navigator proxy (platform, vendor, hardwareConcurrency, deviceMemory)
2. `navigator.webdriver` removal + Chrome DevTools Protocol cleanup
3. Canvas noise (toDataURL, toBlob, getImageData)
4. WebGL parameter spoof (UNMASKED_VENDOR/RENDERER from 16 GPU renderers)
5. AudioContext fingerprint noise
6. ClientRects noise
7. Screen resolution proxy
8. WebRTC leak protection (STUN block + Chromium args)
9. Timezone spoof (Intl.DateTimeFormat + Date.getTimezoneOffset)
10. Plugins + MimeTypes (Chrome PDF Plugin, Native Client)
11. Permissions API (realistic query responses)
12. Connection + Battery API (deterministic per profile)
13. Font enumeration defense (per-platform font lists)
14. TLS/JA3 fingerprint (Chrome real binary, not Chromium)

### Billing Model
- **Per-minute billing** — Rp 10,000/jam (Rp ~167/menit)
- Direct wallet deduction (no separate Smart Browser balance)
- Auto-stop on insufficient balance
- Max 2 concurrent sessions per user

### Key Browser Service Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, lifespan (watchdog start/stop) |
| `routes.py` | HTTP endpoints (start/stop/status/screenshot) |
| `session_manager.py` | Full session lifecycle (Xvfb, Chrome, VNC, websockify) |
| `stealth.py` | 14-vector anti-fingerprint JS injection |
| `fingerprint.py` | Profile-based deterministic fingerprint generation |
| `ua_database.py` | 50+ User-Agent entries, 16 GPU renderers |
| `geo.py` | Proxy IP geo-lookup → timezone/locale/language |
| `auth.py` | JWT validation middleware |
| `config.py` | Pydantic settings from env vars |
| `models.py` | Pydantic request/response models |

## Error Handling

| Layer | Pattern |
|-------|---------|
| Go Backend | `errors.AppError` with code (e.g., `AUTH001`, `CASE001`) + Indonesian message + HTTP status |
| Feature Service (.NET) | FluentValidation + custom error middleware |
| Frontend | `ErrorBoundary` + `logger.error()` (Sentry in production) |
