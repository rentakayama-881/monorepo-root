# AIValid Process Rules

> These rules describe HOW to work — they contain zero version numbers or file counts.
> For current state, run `bash .ai/context.sh`.

## Identity

- **Product:** AIValid (aivalid.id) — Platform validasi hasil kerja AI oleh ahli manusia
- **Language:** Indonesian (id) for all user-facing content
- **Currency:** IDR, displayed as "Rp" with dot-separated thousands (e.g., Rp 100.000)
- **Branding:** Always "AIValid". Never "alephdraad" in user-facing content.

## Coding Conventions

### General
- Follow `.editorconfig`: 2 spaces default, tabs for Go, LF, UTF-8
- Conventional Commits: `type(scope): description`
- Scopes: `frontend`, `backend`, `feature-service`, `deploy`, `docs`, `ops`
- Branch naming: `feature/*`, `fix/*`, `refactor/*`, `docs/*`, `test/*`

### Go Backend
- Handler -> Service pattern (no business logic in handlers)
- Ent ORM only (no raw SQL, edit `ent/schema/` only — never `ent/` generated code)
- `errors.AppError` with Indonesian messages, codes like `AUTH001`, `CASE001`
- Zap structured logging (no `fmt.Printf`)
- `gofmt`-clean code

### Feature Service (.NET)
- Controller -> Service pattern
- FluentValidation for requests
- Financial amounts as **integers only** (never floats)
- Idempotency keys for all financial writes
- Wallet PIN: PBKDF2, 310K iterations
- Serilog structured logging

### Frontend
- `.jsx` extension for all components
- UI primitives in `components/ui/` — always accept `className` prop
- `cn()` from `lib/utils.js` for Tailwind class merging (never string concat)
- `@/` alias for imports
- Mobile-first responsive design
- Dark mode via CSS custom properties (`.dark` on `<html>`)
- Structured logging via `lib/logger.js` (no raw `console.*` in app/lib code)
- `crypto.randomUUID()` for any ID/token generation (never `Math.random()`)

### Design Language
- Reference: HuggingFace patterns (clean, functional, minimal)
- Colors: oklch() tokens in `globals.css` (Brand V4 palette)
- Primary action: Harvard Crimson (#a51c30)
- Typography: Source Sans (body), Source Serif (headings), Geist Mono (code)
- Cards: subtle borders, rounded-lg, no heavy shadows
- Spacing: p-4/p-6, gap-4/gap-6
- Accessibility: skip-link, focus-visible rings, aria attributes, WCAG AA contrast

## Quality Gates

```bash
# Before commit:
./ops/preflight-full.sh

# Commit + push (enforces preflight):
./ops/commit-push.sh "type(scope): message"

# Quality measurement:
bash ops/quality-score.sh
```

## Critical Invariants (Never Violate)

- Financial amounts: **always integers**, never floats
- Credibility stake: minimum Rp 100,000
- User data: never expose emails, passwords, PINs, tokens in API responses
- All financial operations through Feature Service, never Go backend directly
- Internal service calls use `SERVICE_TOKEN` header
- Every `<img>` must have an `alt` attribute
- All SEO pages need proper metadata (title, description, openGraph)
- User-facing text must be in Indonesian

## Degrees of Freedom

### Agent Decides
- File organization within established patterns
- Variable/function naming following conventions
- Which existing UI components to compose
- Tailwind utility classes
- SWR cache keys and revalidation
- Error message wording (Indonesian, matching tone)
- Commit message content
- Test structure and assertions

### Agent Asks First
- New Ent schema or field changes (database migrations)
- New API endpoint design (route, method, auth)
- Financial rule changes (amounts, fees, limits)
- Adding new dependencies
- Changes to auth/authorization logic
- Workflow state machine changes
- Deployment config changes
- Removing existing features or endpoints
- Any destructive database operation
