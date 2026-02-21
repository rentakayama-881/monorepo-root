# Repository Guidelines

## Project Structure & Module Organization
This monorepo has three primary apps plus deployment/docs:
- `backend/`: Go + Gin core API (`handlers/`, `services/`, `middleware/`, `ent/schema/`, tests in `*_test.go` files).
- `feature-service/`: ASP.NET Core 8 financial service (`src/FeatureService.Api/`, tests in `tests/FeatureService.Api.Tests/`).
- `frontend/`: Next.js 16 app (`app/`, `components/`, `lib/`, `public/`, unit tests in `lib/__tests__/`, E2E in `e2e/`).
- `deploy/`, `docs/`, and `.github/workflows/` contain deployment assets, docs, and CI.

## Build, Test, and Development Commands
Use commands from each module root:
- Backend: `go run main.go`, `go test ./... -v`, `go build -o app .`
- Feature service: `dotnet run --project src/FeatureService.Api`, `dotnet test`, `dotnet build -c Release src/FeatureService.Api`
- Frontend: `npm run dev`, `npm run build`, `npm run start`
- Frontend quality checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`

## Coding Style & Naming Conventions
- Follow `.editorconfig`: default 2 spaces, LF endings, UTF-8; Go files use tabs.
- Go: keep `gofmt`-clean and prefer `*_test.go` naming.
- C# (.NET 8): nullable + implicit usings enabled; keep class/file names in PascalCase and tests as `*Tests.cs`.
- Frontend: TypeScript/React with ESLint (`next/core-web-vitals`) and Prettier.
- Branch naming: `feature/*`, `fix/*`, `refactor/*`, `docs/*`, `test/*`.

## Testing Guidelines
- Backend: `go test ./... -v` (use `-cover` when validating impact).
- Feature service: `dotnet test` (xUnit + coverlet collector).
- Frontend: Jest for unit tests (`npm run test`), Playwright for E2E (`npm run test:e2e`).
- Prefer focused test names by behavior (e.g., `PinHardeningTests.cs`, `auth_service_ent_test.go`).

## Commit & Pull Request Guidelines
- Use Conventional Commits: `type(scope): description` (e.g., `fix(frontend): restore sidebar skeleton`).
- Keep PRs scoped; include summary, affected modules, test evidence, and config/env changes.
- Link related issues, update docs when behavior changes, and ensure all relevant checks pass before review.

## Security & Configuration Tips
- Never commit secrets; start from each module's `.env.example`.
- Validate auth/authorization and input handling on sensitive endpoints.
- For financial or auth flows, include regression tests in the same PR.

## AI Operating System (Session-Proof, Mandatory)

These rules are required for every AI session, including when context memory is empty.

1. Read `docs/AI_OPERATING_SYSTEM.md` before making significant changes.
2. Run full quality gate before commit/push:
- `./ops/preflight-full.sh`
3. Use commit+push wrapper (enforces preflight, supports direct `main`, and auto-syncs VPS when running on `main`):
- `./ops/commit-push.sh "type(scope): message"`
4. Do not claim production is updated without runtime evidence from:
- Go: `/health` and `/health/version`
- Feature Service: `/api/v1/health` and `/api/v1/health/version`
5. For post-merge backend updates on VPS, use:
- `./ops/vps-sync-deploy.sh --env prod --ref <sha>`
6. If deployment verification fails, rollback using:
- `./ops/vps-rollback.sh --env prod --backup-dir <path>`
7. Frontend quality must follow objective rubric:
- `docs/frontend/QUALITY_RUBRIC.md`
- `docs/frontend/REFERENCE_PATTERNS.md`
8. Operator mode:
- User gives intent only.
- AI executes commands, tests, commit/push, and deploy flow end-to-end.
- Ask user only for external approvals/credentials or irreversible high-risk actions.

## Custom Global Skill

- `monorepo-strict-ops`: `/home/alep/.codex/skills/monorepo-strict-ops/SKILL.md`
- If the skill list does not refresh in the current chat session, start a new session.
