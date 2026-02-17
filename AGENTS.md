# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Go (Gin + Ent) core API. Main layers are `handlers/`, `services/`, `middleware/`, `validators/`, and `ent/`. Tests live in `backend/**/*_test.go` and `backend/tests/`.
- `feature-service/`: ASP.NET Core 8 service. Application code is in `src/FeatureService.Api/`; tests are in `tests/FeatureService.Api.Tests/`.
- `frontend/`: Next.js 16 app. Routes are in `app/`, shared UI in `components/`, utilities in `lib/`, static files in `public/`, and Playwright tests in `e2e/`.
- `deploy/`: deployment assets (`nginx/`, `systemd/`, scripts). CI/CD is under `.github/workflows/`.

## Build, Test, and Development Commands
- Frontend:
  - `cd frontend && npm ci && npm run dev` (local dev server).
  - `cd frontend && npm run lint && npm run typecheck` (static checks).
  - `cd frontend && npm test -- --ci --forceExit` (unit tests).
  - `cd frontend && npm run test:e2e` (end-to-end tests).
  - `cd frontend && npm run build` (production build).
- Go backend:
  - `cd backend && go run main.go` (run API).
  - `cd backend && go vet ./... && go test -v -race ./...` (quality + tests).
  - `cd backend && golangci-lint run --timeout=5m` (CI-aligned lint pass).
- Feature service:
  - `cd feature-service && dotnet restore && dotnet build --configuration Release`.
  - `cd feature-service && dotnet test --collect:"XPlat Code Coverage"`.

## Coding Style & Naming Conventions
- `.editorconfig` is authoritative: 2 spaces by default, tabs for `*.go` and `Makefile`.
- Frontend uses Prettier (`tabWidth: 2`, semicolons, double quotes, `printWidth: 100`) and ESLint `next/core-web-vitals`.
- Keep controllers/handlers thin; move business logic into service layers (`Handler/Controller -> Service`).
- C# nullable reference types are enabled; prefer async/await for I/O paths.
- Test file naming: Go `*_test.go`, C# `*Tests.cs`, frontend unit `*.test.*`, E2E `*.spec.ts`.

## Testing Guidelines
- Frameworks: Go `testing`, .NET xUnit + FluentAssertions/Moq, frontend Jest + Testing Library + Playwright.
- Frontend Jest enforces a 50% global coverage threshold (`frontend/jest.config.js`).
- CI publishes backend and feature-service coverage and requires quality-gate success before merge.

## Commit & Pull Request Guidelines
- Branch names: `feature/...`, `fix/...`, `refactor/...`, `docs/...`, `test/...`.
- Commit history is mostly conventional/scoped (for example `fix(security): ...`, `feat(admin): ...`) plus service prefixes (`backend: ...`, `feature-service: ...`); prefer Conventional Commits with scope.
- Open PRs to `develop` with: clear summary, linked issue, test evidence, and docs updates for behavior/config changes.
- Do not commit secrets; copy from each module’s `.env.example` and keep real values local.
