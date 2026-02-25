# Monorepo Engineering Refactor & Repo Hygiene

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform this monorepo into a production-grade, clean-room engineering standard: no stale artifacts, no orphan dependencies, deterministic builds, strict CI gates, and clear module boundaries.

**Architecture:** Three-service monorepo (Go backend, ASP.NET Core feature-service, Next.js frontend) with shared CI/CD, per-service .gitignore, and ops scripts. All build caches must live outside the workspace. Root-level config must be minimal and intentional.

**Tech Stack:** Go 1.24 / Gin / Ent, ASP.NET Core 8 / MongoDB, Next.js 16 / React 19 / Tailwind 4, GitHub Actions CI/CD

---

## Phase 0: Repo Hygiene & Artifact Purge

**Goal:** Remove 2.1GB of local cache bloat, eliminate orphan root-level Node artifacts, and ensure `.gitignore` is airtight. No functional code changes. After this phase, a fresh clone + install is clean and predictable.

---

### Task 1: Audit what `.cache/` contains and verify it is NOT tracked by git

**Files:**
- Read: `.gitignore:93` (line `.cache/`)
- Read: `frontend/.gitignore`
- Read: `feature-service/.gitignore`

**Step 1: Verify .cache is untracked**

Run: `git ls-files .cache/ | wc -l`
Expected: `0` (no tracked files inside .cache)

Run: `du -sh .cache/*/`
Expected: Shows go-build (~602MB), go-mod (~482MB), nuget (~889MB), dotnet (~180MB)

**Step 2: Verify these are CI-generated caches from local runs**

Check `ci.yml` env vars:
```
GO_CACHE_DIR: ${{ github.workspace }}/.cache/go-build
NUGET_PACKAGES: ${{ github.workspace }}/.cache/nuget
```

Confirm: These env vars cause CI (and local mimics of CI) to dump caches into the repo workspace.

**Step 3: Commit (nothing to commit - this is verification only)**

Acceptance: Confirmed .cache is untracked, safe to delete.

---

### Task 2: Delete local `.cache/` directory

**Files:**
- Delete: `.cache/` (2.1GB)

**Step 1: Delete the cache directory**

Run: `rm -rf .cache/`

**Step 2: Verify disk space recovered**

Run: `du -sh . --exclude=frontend/node_modules --exclude=frontend/.next --exclude=backend/ent`
Expected: Significantly smaller than before

**Step 3: Verify repo still works**

Run: `cd frontend && npm run typecheck && cd ..`
Expected: PASS (caches were not needed for local dev)

Acceptance: `.cache/` deleted, no functional impact.

---

### Task 3: Remove orphan root `package.json` and `package-lock.json`

**Files:**
- Delete: `package.json` (root)
- Delete: `package-lock.json` (root)
- Verify: `frontend/package.json` already has `@vercel/speed-insights`

**Step 1: Confirm the root package.json is redundant**

Root `package.json` contains only `@vercel/speed-insights ^1.3.1`.
`frontend/package.json` also contains `@vercel/speed-insights ^1.3.1`.

The root file serves no purpose - there are no root scripts, no workspaces config, no monorepo tooling. It creates a confusing `node_modules/` at root level.

**Step 2: Check if anything imports from root node_modules**

Run: `ls node_modules/ 2>/dev/null | head -5`
Expected: Only `@vercel/speed-insights` (or empty if not installed at root)

Run: `grep -r "from.*@vercel/speed-insights" frontend/app/ frontend/components/ frontend/lib/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | head -5`
Expected: Imports resolve from `frontend/node_modules`, not root

**Step 3: Remove root package files**

```bash
rm package.json package-lock.json
rm -rf node_modules/  # root-level node_modules if exists
```

**Step 4: Verify frontend still builds**

Run: `cd frontend && npm ci && npm run build && cd ..`
Expected: PASS

**Step 5: Commit**

```bash
git add -u package.json package-lock.json
git commit -m "chore: remove orphan root package.json and lockfile

Root package.json only contained @vercel/speed-insights which is
already in frontend/package.json. Root-level node_modules served
no purpose and created confusion about where dependencies live."
```

Acceptance: No root package.json, no root node_modules, frontend builds cleanly.

---

### Task 4: Harden `.gitignore` for cache and build artifacts

**Files:**
- Modify: `.gitignore`

**Step 1: Audit current .gitignore for gaps**

Current `.gitignore` already has:
- `.cache/` (line 93) - covers CI caches
- `**/node_modules/` - covers npm deps
- `**/.next/` - covers Next.js build
- `**/bin/`, `**/obj/` - covers .NET build

Check for missing patterns:

Run: `git status --porcelain | head -20`
Expected: Only the known modified files from git status

**Step 2: Add missing patterns if any found**

Potential additions to verify:
- `*.db` (SQLite test databases)
- `coverage/` at root level (already in frontend/.gitignore but not root for backend)
- `backend/coverage.out` (Go coverage output)
- `.env.local` patterns

**Step 3: Test gitignore coverage**

Run: `git ls-files --others --exclude-standard | grep -E '\.(cache|log|out|tmp)$' | head -10`
Expected: Empty (all artifacts properly ignored)

**Step 4: Commit if changes made**

```bash
git add .gitignore
git commit -m "chore: harden .gitignore for CI caches and build artifacts"
```

Acceptance: `git status` shows no untracked build artifacts after a full build cycle.

---

### Task 5: Reconcile the deleted `CLAUDE.md`

**Files:**
- Resolve: `CLAUDE.md` (currently `D` in git status)
- Read: `AGENTS.md` (may be the replacement)

**Step 1: Check if AGENTS.md replaced CLAUDE.md**

Run: `head -10 AGENTS.md`
Expected: Contains repo guidelines that previously lived in CLAUDE.md

**Step 2: Stage the deletion**

If AGENTS.md is the replacement:
```bash
git add CLAUDE.md
git commit -m "chore: remove CLAUDE.md in favor of AGENTS.md"
```

If CLAUDE.md was deleted by accident and AGENTS.md is different, restore it:
```bash
git checkout HEAD -- CLAUDE.md
```

**Step 3: Verify AGENTS.md has complete guidelines**

Read AGENTS.md and confirm it covers: project structure, build commands, coding style, testing, commit guidelines, security tips, AI operating system rules.

Acceptance: No dangling `D CLAUDE.md` in git status.

---

## Phase 1: Dependency Audit & Cleanup

**Goal:** Every dependency in every service is intentional, up-to-date, and free of known high/critical vulnerabilities. No phantom deps, no version conflicts, no unused packages.

---

### Task 6: Frontend dependency audit

**Files:**
- Modify: `frontend/package.json`
- Regenerate: `frontend/package-lock.json`

**Step 1: Check for unused dependencies**

Run: `cd frontend && npx depcheck --ignores="@types/*,eslint*,prettier,tailwindcss,@tailwindcss/*,jest*,@testing-library/*,@playwright/*,typescript" 2>/dev/null | head -30`

Specific suspects to investigate:
- `@fingerprintjs/fingerprintjs` - is it actually imported anywhere?

Run: `grep -r "fingerprintjs\|@fingerprintjs" frontend/lib/ frontend/app/ frontend/components/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | head -5`

**Step 2: If unused deps found, remove them**

```bash
cd frontend
npm uninstall @fingerprintjs/fingerprintjs  # if confirmed unused
```

**Step 3: Check for version mismatches in overrides**

Current overrides in package.json:
```json
"overrides": {
  "schema-utils": { "ajv": "8.18.0" },
  "ajv-formats": { "ajv": "8.18.0" },
  "glob": "11.1.0",
  "jsdom": "28.0.0",
  "test-exclude": "7.0.1"
}
```

Run: `cd frontend && npm ls ajv 2>/dev/null | head -10`
Check if overrides are still needed or if upstream fixed the issue.

**Step 4: Run security audit**

Run: `cd frontend && npm audit --omit=dev 2>/dev/null`
Expected: 0 high/critical vulnerabilities (or only allowlisted Sentry ones)

**Step 5: Clean install test**

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run typecheck
npm run lint
npm run test -- --ci --forceExit
npm run build
```
Expected: All PASS

**Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): audit and clean dependencies

- Remove unused packages (if any found)
- Verify override necessity
- Clean lockfile regeneration"
```

Acceptance: `npm ci && npm run build` succeeds from scratch. No unused deps.

---

### Task 7: Backend dependency audit (Go)

**Files:**
- Verify: `backend/go.mod`
- Verify: `backend/go.sum`

**Step 1: Check for unused dependencies**

```bash
cd backend
go mod tidy
git diff go.mod go.sum
```
Expected: No changes (already tidy) or shows removable deps.

**Step 2: Check for known vulnerabilities**

```bash
cd backend
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```
Expected: No HIGH/CRITICAL vulnerabilities

**Step 3: Verify build and tests**

```bash
cd backend
go build -v ./...
go vet ./...
```
Expected: All PASS

**Step 4: Commit if changes**

```bash
cd backend
git add go.mod go.sum
git commit -m "chore(backend): tidy go modules and remove unused deps"
```

Acceptance: `go mod tidy` produces no diff. `govulncheck` clean.

---

### Task 8: Feature service dependency audit (.NET)

**Files:**
- Verify: `feature-service/src/FeatureService.Api/FeatureService.Api.csproj`

**Step 1: Check for outdated packages**

```bash
cd feature-service
dotnet list package --outdated
```

**Step 2: Check for vulnerabilities**

```bash
cd feature-service
dotnet list package --vulnerable --include-transitive
```
Expected: 0 high/critical vulnerabilities

**Step 3: Verify build and tests**

```bash
cd feature-service
dotnet restore
dotnet build --configuration Release
dotnet test --configuration Release
```
Expected: All PASS

**Step 4: Commit if changes**

```bash
git add feature-service/
git commit -m "chore(feature-service): audit and update NuGet dependencies"
```

Acceptance: `dotnet restore && dotnet build` succeeds. No vulnerable deps.

---

## Phase 2: Build & Install Stabilization

**Goal:** Any engineer can clone the repo, run documented commands, and get a working dev environment in under 10 minutes. No hidden state, no "works on my machine."

---

### Task 9: Fix CI cache strategy to not pollute workspace

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Move cache env vars to use GitHub Actions native caching**

Current problem: CI writes caches to `${{ github.workspace }}/.cache/` which also affects local dev if env vars leak.

Change from:
```yaml
env:
  GO_CACHE_DIR: ${{ github.workspace }}/.cache/go-build
  GO_MOD_CACHE_DIR: ${{ github.workspace }}/.cache/go-mod
  DOTNET_CLI_HOME: ${{ github.workspace }}/.cache/dotnet
  NUGET_PACKAGES: ${{ github.workspace }}/.cache/nuget
```

To use default locations (GitHub Actions `setup-go` and `setup-dotnet` handle caching natively):
```yaml
env:
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
  DOTNET_NOLOGO: "1"
```

Remove all `mkdir -p "$GOCACHE" "$GOMODCACHE"` and `mkdir -p "$DOTNET_CLI_HOME" "$NUGET_PACKAGES"` steps.

The `setup-go@v5` action with `cache-dependency-path` already handles Go caching.
The `setup-dotnet@v4` action already handles NuGet caching when configured.

**Step 2: Remove GOCACHE/GOMODCACHE env overrides from backend jobs**

Remove these env blocks from `backend-lint`, `backend-build`, `backend-test`, `backend-security`:
```yaml
env:
  GOCACHE: ${{ github.workspace }}/.cache/go-build
  GOMODCACHE: ${{ github.workspace }}/.cache/go-mod
```

**Step 3: Remove DOTNET_CLI_HOME/NUGET_PACKAGES overrides from feature-service jobs**

Remove from `feature-service-build`, `feature-service-test`, `feature-service-security`, `pqc-validation`:
```yaml
env:
  DOTNET_CLI_HOME: ${{ github.workspace }}/.cache/dotnet
  NUGET_PACKAGES: ${{ github.workspace }}/.cache/nuget
```

Add native NuGet caching:
```yaml
- name: Setup .NET
  uses: actions/setup-dotnet@v4
  with:
    dotnet-version: ${{ env.DOTNET_VERSION }}
    cache: true
    cache-dependency-path: feature-service/**/packages.lock.json
```

**Step 4: Test CI locally (dry-run)**

Run: `act -l` (if `act` is installed) or verify YAML syntax:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
```
Expected: Valid YAML, no syntax errors

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): use native GitHub Actions caching instead of workspace .cache/

Remove GOCACHE/GOMODCACHE/DOTNET_CLI_HOME/NUGET_PACKAGES env overrides
that wrote 2.1GB of build caches into the repo workspace. setup-go@v5
and setup-dotnet@v4 handle caching natively via their cache parameters."
```

Acceptance: CI YAML valid. No env vars pointing caches into workspace.

---

### Task 10: Add `.cache/` cleanup to ops/preflight script

**Files:**
- Modify: `ops/preflight-full.sh`

**Step 1: Read current preflight script**

Run: `cat ops/preflight-full.sh`

**Step 2: Add cache cleanup warning**

Add at the top of the script:
```bash
# Warn if stale CI caches exist in workspace
if [ -d ".cache" ]; then
  echo "WARNING: .cache/ directory exists ($(du -sh .cache/ | cut -f1)). Run 'rm -rf .cache/' to reclaim disk space."
fi
```

**Step 3: Commit**

```bash
git add ops/preflight-full.sh
git commit -m "chore(ops): warn about stale .cache/ in preflight script"
```

Acceptance: Running `ops/preflight-full.sh` warns if `.cache/` exists.

---

### Task 11: Verify clean-clone install works for all 3 services

**Files:**
- No modifications (verification only)

**Step 1: Frontend clean install**

```bash
cd frontend
rm -rf node_modules .next
npm ci
npm run build
```
Expected: PASS in < 3 minutes

**Step 2: Backend clean build**

```bash
cd backend
go build -v ./...
```
Expected: PASS (downloads deps automatically)

**Step 3: Feature service clean build**

```bash
cd feature-service
dotnet restore
dotnet build --configuration Release
```
Expected: PASS

**Step 4: Document any issues found**

If any step fails, create a fix task and add it to this plan.

Acceptance: All three services build from a clean state.

---

## Phase 3: CI Quality Gate Hardening

**Goal:** Every `continue-on-error: true` in CI is justified or removed. Security gates actually block merges. Prettier enforcement is real, not advisory.

---

### Task 12: Audit and fix `continue-on-error` usage in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: List all continue-on-error occurrences**

Run: `grep -n "continue-on-error" .github/workflows/ci.yml`

Current occurrences (from reading the file):
1. Line 95: TruffleHog `continue-on-error: true` - **Acceptable** (secondary scan, Gitleaks is primary)
2. Line 119: go-licenses `continue-on-error: true` - **Acceptable** (informational)
3. Line 154: Prettier format:check `continue-on-error: true` - **FIX: Should block**
4. Line 502: gosec `continue-on-error: true` - **Review** (may have false positives)

**Step 2: Make Prettier check a blocking gate**

Remove `continue-on-error: true` from the Prettier step (line 154).

Before:
```yaml
- name: Run Prettier check
  run: npm run format:check
  continue-on-error: true
```

After:
```yaml
- name: Run Prettier check
  run: npm run format:check
```

**Step 3: Verify Prettier passes locally before making it blocking**

```bash
cd frontend
npm run format:check
```

If it fails, fix formatting first:
```bash
npm run format
git add -A
git commit -m "style(frontend): apply Prettier formatting"
```

**Step 4: Commit CI change**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): make Prettier check a blocking quality gate

Prettier was running with continue-on-error, making it advisory only.
Now formatting violations will block PRs, enforcing consistent style."
```

Acceptance: `npm run format:check` passes. CI will block on formatting violations.

---

### Task 13: Fix stale version references in CI comments

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Find stale references**

The CI file has comments and labels referencing "Next.js 15" but the repo uses Next.js 16:
- Line 123: `# Stage 2: Frontend Pipeline (Next.js 15 / React 19)` → should be 16
- Line 1009: `| Frontend (Next.js 15) | ✅ Ready |` → should be 16

**Step 2: Fix all stale version references**

Replace all `Next.js 15` references with `Next.js 16` in ci.yml.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "docs(ci): fix stale Next.js version references (15 → 16)"
```

Acceptance: No stale version numbers in CI comments/labels.

---

### Task 14: Ensure security scans don't silently swallow failures

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Review govulncheck usage**

Current (line 496):
```yaml
govulncheck ./... || true
```

This swallows ALL vulnerabilities. Change to log but not block on informational, while actually checking the exit code:

```yaml
- name: Run govulncheck
  run: govulncheck ./...
  continue-on-error: ${{ github.event_name == 'pull_request' }}
```

This blocks on main/scheduled but warns on PRs.

**Step 2: Review npm audit usage**

Current approach uses a custom Node script to enforce policy - this is good, keep it.

**Step 3: Review dotnet audit usage**

Current approach uses a Python script to parse JSON - this is good, keep it.

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): govulncheck blocks on main, warns on PRs

Previously swallowed all vulnerability scan results with || true.
Now blocks merges to main while allowing PRs to proceed with warnings."
```

Acceptance: Security scans produce actionable results, not silently passing.

---

## Phase 4: Module Boundary & Architecture Cleanup

**Goal:** Each service has clear boundaries, no cross-contamination of configs, and the repo structure communicates intent. Documentation reflects reality.

---

### Task 15: Audit and clean docs/ directory

**Files:**
- Read: all files in `docs/`
- Potentially delete: stale/outdated docs

**Step 1: List all docs with modification dates**

```bash
ls -la docs/*.md docs/**/*.md
```

**Step 2: Identify stale documentation**

Check each doc for:
- References to outdated versions (Next.js 15, etc.)
- Completed phase plans that are no longer actionable
- Duplicate information across docs

Candidates for removal/consolidation:
- `PHASE_0_AUTH_AUDIT.md` - completed work, archive or remove
- `PHASE_1_AUTH_DESIGN.md` - completed work, archive or remove
- `PHASE_2_IMPLEMENTATION_CHECKLIST.md` - completed work, archive or remove
- `CHANGELOG_20260118.md` - single-date changelog, fold into git log
- `COMPREHENSIVE_AUDIT_20260122.md` - snapshot, potentially stale
- `AUTH_UPGRADE_README.md` / `AUTH_UPGRADE_SUMMARY.md` - completed migration

**Step 3: Move completed phase docs to archive**

```bash
mkdir -p docs/archive
mv docs/PHASE_*.md docs/archive/
mv docs/AUTH_UPGRADE_*.md docs/archive/
mv docs/CHANGELOG_*.md docs/archive/
mv docs/COMPREHENSIVE_AUDIT_*.md docs/archive/
```

**Step 4: Verify remaining docs are current**

Keep:
- `ARCHITECTURE.md` - update version references
- `DEVELOPER_GUIDE.md` - verify commands work
- `DEPLOYMENT_GUIDE.md` - verify accuracy
- `ENVIRONMENT_VARIABLES.md` - verify completeness
- `SECURITY.md` - keep current
- `AI_OPERATING_SYSTEM.md` - keep if actively used

**Step 5: Commit**

```bash
git add docs/
git commit -m "docs: archive completed phase docs, keep active references

Move completed auth upgrade, phase plans, and dated changelogs to
docs/archive/. Active docs remain at top level."
```

Acceptance: `docs/` contains only current, actionable documentation.

---

### Task 16: Verify deploy workflow matches systemd service names

**Files:**
- Read: `.github/workflows/deploy.yml`
- Read: `deploy/systemd/*.service`

**Step 1: Check for service name mismatch**

From the architecture doc (line 1029), there's a known discrepancy:
- deploy.yml references: `backend.service` and `featureservice.service`
- Actual systemd units: `alephdraad-backend.service` and `feature-service.service`

```bash
grep -n "systemctl\|\.service" .github/workflows/deploy.yml
```

**Step 2: Compare with actual unit files**

```bash
ls deploy/systemd/*.service
```

**Step 3: Fix deploy.yml to use correct service names**

Update any `systemctl restart` commands to use the actual unit names.

**Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "fix(deploy): align systemd service names with actual unit files

deploy.yml was referencing incorrect service names. Aligned with
the actual systemd units: alephdraad-backend.service and
feature-service.service."
```

Acceptance: deploy.yml service names match `deploy/systemd/*.service` files.

---

### Task 17: Add a root-level `Makefile` or `justfile` for common operations

**Files:**
- Create: `Makefile` (root)

**Step 1: Write the Makefile**

```makefile
.PHONY: help install build test lint clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd frontend && npm ci
	cd backend && go mod download
	cd feature-service && dotnet restore

build: ## Build all services
	cd frontend && npm run build
	cd backend && go build -v ./...
	cd feature-service && dotnet build --configuration Release

test: ## Run all tests
	cd frontend && npm test -- --ci --forceExit
	cd backend && go test ./... -v
	cd feature-service && dotnet test --configuration Release

lint: ## Lint all services
	cd frontend && npm run lint && npm run format:check && npm run typecheck
	cd backend && go vet ./...

clean: ## Remove build artifacts and caches
	rm -rf .cache/
	rm -rf frontend/.next/ frontend/node_modules/
	rm -rf feature-service/src/FeatureService.Api/bin/ feature-service/src/FeatureService.Api/obj/
	rm -f backend/app backend/server backend/backend

preflight: ## Run full quality gate (same as CI)
	./ops/preflight-full.sh
```

**Step 2: Verify Makefile works**

```bash
make help
make lint
```
Expected: Commands listed, lint passes

**Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: add root Makefile for common monorepo operations

Provides unified commands: make install, make build, make test,
make lint, make clean, make preflight. Removes need to remember
per-service commands."
```

Acceptance: `make help` shows all commands. `make lint` runs without error.

---

### Task 18: Final verification - full preflight pass

**Files:**
- No modifications (verification only)

**Step 1: Run full quality gate**

```bash
make lint
make test
make build
```

**Step 2: Verify git status is clean**

```bash
git status
```
Expected: Clean working tree (all changes committed)

**Step 3: Verify .gitignore coverage**

```bash
git ls-files --others --exclude-standard | head -20
```
Expected: No unexpected untracked files

**Step 4: Run git log to review all commits from this plan**

```bash
git log --oneline -20
```
Expected: Clean commit history following conventional commits format

Acceptance: All quality gates pass. Working tree clean. Commit history readable.

---

## Risks & Rollback

| Risk | Mitigation | Rollback |
|------|-----------|----------|
| Removing root `package.json` breaks Vercel deploy | Check Vercel project settings; frontend has its own package.json | `git checkout HEAD~1 -- package.json package-lock.json` |
| CI cache changes break GitHub Actions | Test on a branch first via PR | Revert the ci.yml commit |
| Prettier enforcement reveals many formatting issues | Run `npm run format` first to auto-fix | `git checkout HEAD~1 -- .github/workflows/ci.yml` |
| Wrong systemd service names in deploy.yml | Verify against actual VPS before deploying | Revert deploy.yml commit |
| Archived docs still referenced by other files | `grep -r "PHASE_0\|PHASE_1\|AUTH_UPGRADE" . --include="*.md"` | Move files back from archive |

---

## PR Milestones

| PR | Tasks | Scope | Risk |
|----|-------|-------|------|
| **PR 1: Repo Hygiene** | Tasks 1-5 | Delete .cache, remove root package.json, fix CLAUDE.md | Low |
| **PR 2: Dependency Audit** | Tasks 6-8 | Frontend/backend/feature-service dep cleanup | Low |
| **PR 3: CI Stabilization** | Tasks 9-10, 12-14 | Fix cache strategy, harden quality gates | Medium |
| **PR 4: Architecture & Docs** | Tasks 11, 15-18 | Clean docs, fix deploy, add Makefile | Low |

Each PR is independently mergeable. Order matters: PR 1 before PR 3 (cache cleanup before CI cache fix).
