# AIValid Fullstack Development

## Description
Comprehensive context for the AIValid monorepo -- a three-service platform for validating AI-generated work using human expert validators. Activates on any development, debugging, deployment, or architectural question about this codebase.

## Identity
- **Product:** AIValid (https://aivalid.id) -- Platform validasi hasil kerja AI oleh ahli manusia
- **Language:** Indonesian (id) throughout all user-facing content
- **Currency:** IDR (Indonesian Rupiah), displayed with "Rp" prefix and dot-separated thousands (e.g., Rp 100.000)
- **Branding:** Always "AIValid" or "AIvalid". NEVER use "alephdraad" in any user-facing content. Remove any legacy references if found.

---

## Architecture Overview

```
/home/alep/monorepo-root/
├── frontend/          # Next.js 16 + React 19 (Vercel)
├── backend/           # Go 1.24.5 + Gin (VPS :8080)
├── feature-service/   # ASP.NET Core 8 / .NET 8 (VPS :5000)
├── deploy/            # systemd units, nginx configs, deploy scripts
├── docs/              # 19+ architecture & audit docs
├── .github/workflows/ # CI (ci.yml) + CD (deploy.yml)
└── .claude/           # AI assistant skills
```

### Service Responsibilities

| Service | Domain | Database | Deployment |
|---------|--------|----------|------------|
| **Go Backend** | Auth, users, sessions, validation cases, workflow orchestration, tags, badges, admin | PostgreSQL (Neon, Ent ORM v0.14.5) | VPS via systemd |
| **Feature Service** | Finance (wallets, deposits, withdrawals, transfers, escrow/guarantees, disputes), documents, reports, PQC keys, moderation | MongoDB Atlas | VPS via systemd |
| **Frontend** | All UI, SSR, SEO | None (API client) | Vercel auto-deploy from GitHub main |

### Service Communication
- Frontend --> Go Backend: REST via `fetchJson`/`fetchJsonAuth` (lib/api.js)
- Frontend --> Feature Service: REST via `featureFetch`/`featureFetchAuth` (lib/featureApi.js)
- Go Backend --> Feature Service: HTTP calls for escrow operations
- Feature Service --> Go Backend: Callbacks via internal API with `SERVICE_TOKEN` header
  - `PUT /api/internal/users/{id}/guarantee`
  - `POST /api/internal/validation-cases/escrow/released`

### Domains
- https://aivalid.id (frontend, Vercel)
- https://api.aivalid.id (Go backend, nginx reverse proxy to :8080)
- https://feature.aivalid.id (Feature Service, nginx reverse proxy to :5000)

---

## Frontend (Next.js 16)

### Stack
- **Next.js 16.1.6** (App Router) + **React 19.1.0**
- **Node:** >=24.12 <25
- **Styling:** Tailwind CSS 4.x with oklch() color tokens, CVA for component variants, tailwind-merge + clsx
- **State:** Context-based (UserContext, ThemeContext) + SWR 2.3.8 for server data
- **Auth:** JWT in localStorage, auto-refresh via tokenRefresh.js, cross-tab sync
- **Monitoring:** @sentry/nextjs, @vercel/speed-insights
- **Testing:** Jest 30, @testing-library/react, Playwright (e2e)

### Key Environment Variables
```
NEXT_PUBLIC_BACKEND_URL=https://api.aivalid.id
NEXT_PUBLIC_FEATURE_SERVICE_URL=https://feature.aivalid.id
NEXT_PUBLIC_APP_NAME=AIvalid
NEXT_PUBLIC_SITE_URL=https://aivalid.id
```

### File Structure
```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.js           # Root layout (providers, header, footer, JSON-LD)
│   ├── page.js             # Home page
│   ├── globals.css         # Tailwind config, oklch design tokens, dark mode
│   ├── robots.js           # SEO robots
│   ├── sitemap.js          # SEO sitemap
│   ├── login/              # Auth pages
│   ├── register/
│   ├── account/            # User settings, wallet/*
│   ├── validation-cases/   # CRUD + detail pages
│   ├── validasi/[category] # Category browsing
│   ├── admin/              # Admin dashboard (12+ sub-routes)
│   ├── user/[username]     # Public profiles
│   ├── badge/              # Badge system
│   ├── threads/            # Community threads
│   └── documents/          # Document management
├── components/
│   ├── ui/                 # Reusable primitives (Button, Card, Input, Modal, Toast, Badge, Avatar, etc.)
│   ├── Header.js           # Global header
│   ├── Footer.js           # Global footer
│   ├── Sidebar.js          # Navigation sidebar
│   ├── Providers.js        # UserContext + SWRConfig wrapper
│   ├── CommandPalette.jsx  # Cmd+K search
│   ├── ErrorBoundary.jsx   # Error boundaries
│   └── [feature].jsx       # Feature components (SudoModal, TOTPSettings, etc.)
├── lib/
│   ├── api.js              # Go backend client (fetchJson, fetchJsonAuth)
│   ├── featureApi.js       # Feature Service client (featureFetch, featureFetchAuth)
│   ├── auth.js             # Token storage (getToken, clearToken)
│   ├── tokenRefresh.js     # JWT auto-refresh with race protection
│   ├── UserContext.js      # Global user state
│   ├── ThemeContext.js      # Dark/light mode
│   ├── seo.js              # Structured data generators (JSON-LD)
│   ├── constants.js        # API endpoints, status styles, validation rules
│   ├── format.js           # Currency/date formatters
│   ├── hooks.js            # Custom React hooks
│   ├── swr.js              # SWR configuration
│   └── utils.js            # cn() helper (clsx + tailwind-merge)
└── public/                 # Static assets
```

### Component Conventions
1. All components use `.jsx` extension
2. UI primitives live in `components/ui/` and accept a `className` prop for overrides
3. Button uses CVA variants: `default`, `primary`, `destructive`, `danger`, `outline`, `secondary`, `ghost`, `link`, `gradient`
4. Button sizes: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`
5. Use `cn()` from `lib/utils.js` to merge Tailwind classes (never raw string concatenation)
6. Import paths use `@/` alias (maps to project root)
7. All user-facing text MUST be in Indonesian
8. Dark mode: CSS custom properties toggle via `.dark` class on `<html>`

### Design Language
- Reference HuggingFace's design patterns: clean spacing, functional layouts, subtle borders, minimal decoration
- Color system: oklch() tokens defined in globals.css (Brand V4 palette: Silver, Fuchsia Plum, Space Indigo, Deep Mocha)
- Primary action color: Harvard Crimson (#a51c30)
- Typography: Source Sans (body), Source Serif (headings), Geist Mono (code)
- Cards: subtle borders, rounded-lg, no heavy shadows
- Spacing: consistent p-4/p-6 padding, gap-4/gap-6 for grids
- Responsive: mobile-first, use Tailwind breakpoints (sm/md/lg/xl)
- Accessibility: skip-link, focus-visible rings, aria attributes, semantic HTML

### NPM Scripts
```bash
npm run dev          # Local dev server
npm run build        # Production build (--webpack flag)
npm run lint         # ESLint
npm run lint:fix     # ESLint with autofix
npm run format       # Prettier format
npm run test         # Jest unit tests
npm run test:e2e     # Playwright e2e tests
```

---

## Go Backend

### Stack
- **Go 1.24.5** + **Gin v1.10.1**
- **ORM:** Ent v0.14.5 (code-gen based)
- **Database:** PostgreSQL (Neon managed)
- **Cache:** Redis (optional, graceful degradation)
- **Logging:** Zap (structured)
- **Email:** Resend API (primary), SMTP fallback
- **Auth:** JWT HS256, TOTP 2FA, WebAuthn/Passkeys, Sudo mode
- **Testing:** testify, testcontainers-go

### File Structure
```
backend/
├── main.go              # Entrypoint, router setup, CORS, middleware chains
├── handlers/            # HTTP handlers (one file per domain)
│   ├── auth_handler.go
│   ├── validation_case_handler.go
│   ├── validation_case_workflow_handler.go
│   ├── admin_handler.go
│   ├── user_handler.go
│   ├── passkey_handler.go
│   ├── totp_handler.go
│   └── ...
├── services/            # Business logic (handler -> service pattern)
│   ├── auth_service_ent.go
│   ├── validation_case_service_ent.go
│   ├── validation_case_workflow_service_ent.go
│   ├── session_service_ent.go
│   ├── passkey_service_ent.go
│   └── ...
├── ent/
│   └── schema/          # 25 Ent schemas (code-gen source of truth)
├── middleware/           # auth, admin_auth, rate_limit, internal_auth, sudo, security, request_size
├── errors/              # AppError struct + predefined errors (Indonesian messages)
├── dto/                 # Data transfer objects
├── validators/          # Input validation
├── config/              # Configuration loading
├── database/            # DB connection setup
├── logger/              # Zap logger init
├── utils/               # Shared utilities
└── tests/               # Integration tests
```

### Ent Schemas (25 total)
User, ValidationCase, ConsultationRequest, FinalOffer, ArtifactSubmission, Endorsement, ValidationCaseLog, Session, SessionLock, Passkey, SudoSession, Credential, BackupCode, TOTPPendingToken, EmailVerificationToken, PasswordResetToken, SecurityEvent, DeviceFingerprint, DeviceUserMapping, Tag, Category, Badge, UserBadge, Admin, ChainCursor

### Error Handling
- Use `errors.AppError` with code, message, statusCode, optional details
- Error messages are in Indonesian
- Error codes follow pattern: `AUTH001`, `CASE001`, etc.
- Return via `errors.RespondWithError(c, err)` or `c.JSON(status, gin.H{"error": msg})`

### Key API Patterns
- Auth endpoints: `/api/auth/*` (login, register, verify-email, forgot-password, reset-password)
- User endpoints: `/api/user/me`, `/api/user/[username]`
- Validation cases: `/api/validation-cases` (CRUD + workflow)
- Internal callbacks: `/api/internal/*` (SERVICE_TOKEN auth)
- Health: `GET /health`, `GET /ready`, `GET /api/health`
- Rate limits: General 60/min, Auth 10/min, Search 20/min

### Middleware Chain Order
1. CORS
2. Security headers
3. Request size limit
4. Rate limiting (per-route)
5. Auth (JWT extraction) -- optional or required per route
6. Admin auth (for /admin/* routes)
7. Sudo (for sensitive operations)

---

## Feature Service (.NET 8)

### Stack
- **ASP.NET Core 8** (.NET 8)
- **Database:** MongoDB Atlas (MongoDB.Driver)
- **Cache:** Redis with Sentinel HA
- **Validation:** FluentValidation
- **Logging:** Serilog
- **Security:** PQC (CRYSTALS-Dilithium3, Kyber768), AES-256-GCM at-rest encryption

### File Structure
```
feature-service/src/FeatureService.Api/
├── Program.cs              # Application bootstrap
├── Controllers/
│   ├── Finance/            # WalletsController, DepositsController, WithdrawalsController,
│   │                       # TransfersController, GuaranteesController, DisputesController
│   ├── AdminWalletsController.cs
│   ├── AdminDepositsController.cs
│   ├── AdminDisputesController.cs
│   ├── AdminModerationController.cs
│   ├── DocumentController.cs
│   ├── ReportController.cs
│   ├── HealthController.cs
│   ├── Security/           # PQC keys controller
│   └── UserCleanupController.cs
├── Services/               # Business logic (controller -> service pattern)
├── Models/Entities/        # MongoDB document models (15 entities)
├── DTOs/                   # Request/response objects
├── Validators/             # FluentValidation rules
├── Infrastructure/         # MongoDB context, Redis, encryption
├── Middleware/              # Auth, error handling
└── Domain/                 # Domain logic
```

### Financial Rules (CRITICAL -- never deviate)
- Wallet PIN: 4-digit, PBKDF2 (310K iterations), lockout after 4 fails for 4 hours
- Min transfer: Rp 10,000
- Transfer fee: 2%
- Max hold: 30 days (default 7)
- Min guarantee (credibility stake): Rp 100,000
- Min bounty: Rp 10,000
- Min deposit: Rp 10,000
- Min withdrawal: Rp 50,000
- Idempotency keys required for all financial write operations
- All financial amounts stored as integers (no floats)

### Background Services
- `TransferAutoReleaseHostedService`: Automatically releases held transfers after hold period expires

---

## Validation Case Workflow (Core Business Logic)

This is the central domain model. The workflow has strict state transitions:

### 1. Case Creation (Owner)
- Owner fills structured intake form (quick-intake-v1):
  - `validation_goal`, `output_type`, `evidence_input`, `pass_criteria`, `constraints`, `sensitivity` (S0-S3)
- System checklist validates: intake_complete, evidence_attached, pass_criteria_defined, constraints_defined, no_contact_in_case_record
- Case status: `open`

### 2. Consultation Request (Validator)
- Validator requests to work on case
- Requires minimum Rp 100,000 credibility stake (guarantee lock via Feature Service)
- Owner reviews and approves/rejects validator
- Status: `consultation_requested` -> `consultation_approved` or `consultation_rejected`

### 3. Clarification (Bidirectional)
- Question/assumption mode between validator and owner
- Owner has 12h SLA to respond
- Auto-reminders at 2h and 8h marks
- Background worker: `owner_response_sla_worker.go`

### 4. Final Offer (Validator)
- Validator submits: amount (IDR), hold_hours (1-30 days), terms
- Owner accepts or rejects
- On accept: funds locked in escrow via Feature Service guarantee

### 5. Artifact Submission (Validator)
- Validator submits completed work (document_id reference)
- Status: `artifact_submitted`

### 6. Release
- After hold period: auto-release (TransferAutoReleaseHostedService) or manual owner release
- Funds move from escrow to validator wallet
- Feature Service calls back Go backend: `POST /api/internal/validation-cases/escrow/released`

### Matching Score Algorithm
- Tag overlap between case and validator expertise
- Credibility stake amount (higher = more committed)
- Responsiveness SLA adherence

---

## Deployment

### Frontend (Vercel)
- Auto-deploys on every push to `main` branch
- No manual deployment needed
- Environment variables configured in Vercel dashboard

### Backend Services (VPS)
- **Host:** alep@194.238.57.132
- **Go Backend:** systemd service `alephdraad-backend.service`, binary at /opt/aivalid/backend/
- **Feature Service:** systemd service `feature-service.service`, DLL at /opt/aivalid/feature-service/
- **Nginx:** Reverse proxy configs in `deploy/nginx/aivalid.conf`
- **SSL:** Let's Encrypt via Certbot

### CI/CD (GitHub Actions)
- `ci.yml`: Runs tests on PR/push
- `deploy.yml`: Deploys to VPS on push to main (backend/** or feature-service/** changes)
  - Builds binary/DLL
  - SSHs to VPS, pulls code, rebuilds, restarts service
  - Health check with automatic rollback on failure

---

## Instructions

### Mandatory Workflow: Always Commit + Push
1. After completing ANY code changes, ALWAYS stage, commit, and push to main
2. Use conventional commit messages: `feat(scope):`, `fix(scope):`, `refactor(scope):`, `docs(scope):`, `chore(scope):`
3. Scope is one of: `frontend`, `backend`, `feature-service`, `deploy`, `docs`
4. Frontend auto-deploys via Vercel on push
5. Backend services deploy via GitHub Actions on push (when their paths change)

### Code Quality
- Run `npm run lint` before committing frontend changes
- Run `go vet ./...` before committing backend changes
- Ensure all error messages are in Indonesian for user-facing content
- Write tests for new features when feasible

### UI Development
- Follow HuggingFace design patterns: clean, modern, functional, information-dense but readable
- Use existing UI primitives from `components/ui/` -- do not reinvent
- Always support dark mode (use CSS custom properties, never hardcoded colors)
- Mobile-first responsive design
- Use CVA for any component with multiple visual variants
- Use SWR for all data fetching (with proper error/loading states)
- Show Skeleton components during loading, EmptyState for empty lists
- Toast notifications for user actions (success/error feedback)

### SEO Requirements
- Every page MUST have proper metadata (title, description, openGraph, twitter)
- Use `lib/seo.js` generators for JSON-LD structured data
- Target keywords (update as needed):
  - Primary: "validasi AI", "cek hasil AI", "platform validasi Indonesia", "review AI oleh ahli"
  - Secondary: "validasi kode AI", "cek tugas AI", "validasi riset AI", "review dokumen AI"
  - Long-tail: "cara mengecek hasil kerja AI", "jasa validasi output AI", "platform cek keaslian AI Indonesia"
- Generate `robots.js` and `sitemap.js` properly
- Use semantic HTML (h1-h6 hierarchy, article, section, nav, main)
- Every image needs alt text
- Internal linking between related pages
- Page load performance matters for Core Web Vitals

### Backend Development
- Follow handler -> service pattern strictly
- Use Ent ORM for all database operations (never raw SQL)
- Use AppError for structured errors with Indonesian messages
- Log with Zap (structured fields, not printf)
- All financial operations go through Feature Service (never in Go backend)
- Internal service calls use SERVICE_TOKEN header
- Rate limit all public endpoints appropriately

### Feature Service Development
- Follow controller -> service pattern
- Use FluentValidation for all request validation
- All financial amounts are integers (never floats/decimals)
- Require idempotency keys for write operations
- All wallet PINs hashed with PBKDF2 (310K iterations)
- Never expose internal MongoDB ObjectIds to clients (use ULID-based string IDs)

### Critical Rules
- NEVER store financial amounts as floats. Always integers representing smallest unit.
- NEVER skip the credibility stake requirement (min Rp 100,000) for validators.
- NEVER expose user emails, passwords, PINs, or tokens in API responses.
- NEVER use "alephdraad" in user-facing content. The brand is "AIValid".
- ALWAYS think critically about whether the current implementation follows modern best practices. Suggest improvements proactively.
- ALWAYS verify changes work in both light and dark mode.
- ALWAYS consider mobile viewport when building UI.

---

## Degrees of Freedom

### Agent decides:
- File organization within established patterns
- Variable/function naming following existing conventions
- Which existing UI components to compose
- Tailwind utility classes for styling
- SWR cache keys and revalidation strategy
- Error message wording (in Indonesian, matching existing tone)
- Commit message content (following conventional commits)
- Test structure and assertions
- Import ordering

### Agent asks:
- New Ent schema creation or schema field changes (database migrations)
- New API endpoint design (route path, method, auth requirements)
- Financial rule changes (amounts, fees, limits, hold periods)
- Adding new npm/Go/NuGet dependencies
- Changes to authentication or authorization logic
- Changes to the validation case workflow state machine
- Deployment configuration changes (systemd, nginx, Vercel)
- SEO keyword strategy changes
- Any destructive database operation
- Removing existing features or API endpoints

---

## Resources
- `docs/ARCHITECTURE.md` -- High-level architecture overview
- `docs/DEPLOYMENT_GUIDE.md` -- Full deployment instructions
- `docs/DEVELOPER_GUIDE.md` -- Developer onboarding
- `docs/ENVIRONMENT_VARIABLES.md` -- All env vars documented
- `docs/FACT_MAP_REPO_RUNTIME.md` -- Evidence-based runtime facts
- `docs/TAGS_TAXONOMY.md` -- Tag/category system
- `docs/SECURITY.md` -- Security policies
- `deploy/systemd/` -- Service unit files
- `deploy/nginx/aivalid.conf` -- Nginx reverse proxy config
- `.github/workflows/ci.yml` -- CI pipeline
- `.github/workflows/deploy.yml` -- CD pipeline
