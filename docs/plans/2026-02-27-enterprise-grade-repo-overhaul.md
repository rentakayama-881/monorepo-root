# Enterprise-Grade Repo Overhaul — Full A-Z Upgrade

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the AIValid monorepo into a professor-review-ready, contributor-friendly, enterprise-grade repository where a single `CLAUDE.md` + prompt is enough for any AI to produce consistently top-grade work across all three services — with self-healing flows, modern styling, strict enforcement, and zero stale artifacts.

**Architecture:** Consolidate all AI instruction into `.ai/` (already started), make `CLAUDE.md` the universal bootstrap, delete all stale/duplicate docs, add local enforcement (Husky + commitlint + lint-staged + .editorconfig), upgrade CI gates, and create comprehensive frontend styling guide so AI never produces inconsistent UI.

**Tech Stack:** Go 1.24 / Gin / Ent, ASP.NET Core 8 / MongoDB, Next.js 16 / React 19 / Tailwind 4, GitHub Actions CI/CD, Husky / commitlint / lint-staged

---

## Phase 1: Delete Stale Files & Cruft (Clean the House)

---

### Task 1: Delete `.claude/skills/fullstack/` directory

User explicitly requested this deletion. The SKILL.md pointed to `.ai/` anyway — we'll replace its function with `CLAUDE.md`.

**Files:**
- Delete: `.claude/skills/fullstack/SKILL.md`
- Delete: `.claude/skills/fullstack/` (directory)
- Delete: `.claude/skills/` (directory, if empty after)

**Step 1: Delete the skill file and directory**

```bash
rm -rf .claude/skills/fullstack/
rmdir .claude/skills/ 2>/dev/null || true
```

**Step 2: Verify deletion**

```bash
ls .claude/
```
Expected: No `skills/` directory. Only `.claude/` settings remain (if any).

**Step 3: Commit**

```bash
git add -A .claude/skills/
git commit -m "chore: remove .claude/skills/fullstack (replaced by CLAUDE.md + .ai/)"
```

---

### Task 2: Delete stale root-level documentation

These files are resolved issues or stale snapshots that `context.sh` already replaces.

**Files:**
- Delete: `EMAIL_VERIFICATION_FIX.md` (resolved bug from Jan 2025, over a year old)

**Step 1: Delete the file**

```bash
rm EMAIL_VERIFICATION_FIX.md
```

**Step 2: Commit**

```bash
git add EMAIL_VERIFICATION_FIX.md
git commit -m "chore: remove resolved EMAIL_VERIFICATION_FIX.md (Jan 2025)"
```

---

### Task 3: Delete stale/overlapping docs

These docs are superseded by `.ai/QUALITY.md`, `.ai/RULES.md`, `context.sh`, and the existing quality system.

**Files:**
- Delete: `docs/FACT_MAP_REPO_RUNTIME.md` (dated Feb 10, 2026 — context.sh replaces this entirely)
- Delete: `docs/IMPROVEMENTS.md` (dated Jan 15, 2026 — generic roadmap with emojis, superseded by ROADMAP)
- Delete: `docs/QUALITY_SCORECARD_2026.md` (overlaps with `.ai/QUALITY.md` and `ops/quality-score.sh`)
- Delete: `docs/QUALITY_CONTRACT_2026.md` (overlaps with `.ai/QUALITY.md`)
- Delete: `docs/BRANCH_PROTECTION_2026.md` (governance info belongs in CONTRIBUTING.md)
- Move to archive: `docs/ARCHITECTURE.md` (superseded by `.ai/ARCHITECTURE.md`)
- Move to archive: `docs/SECURITY.md` (superseded by `.ai/SECURITY.md`)

**Step 1: Delete superseded files**

```bash
rm docs/FACT_MAP_REPO_RUNTIME.md
rm docs/IMPROVEMENTS.md
rm docs/QUALITY_SCORECARD_2026.md
rm docs/QUALITY_CONTRACT_2026.md
rm docs/BRANCH_PROTECTION_2026.md
```

**Step 2: Move duplicated docs to archive**

```bash
mv docs/ARCHITECTURE.md docs/archive/ARCHITECTURE_pre_ai_system.md
mv docs/SECURITY.md docs/archive/SECURITY_pre_ai_system.md
```

**Step 3: Verify remaining docs structure**

```bash
ls docs/
```
Expected:
```
AI_OPERATING_SYSTEM.md    (ops workflow — keep, actively used)
DEPLOYMENT_GUIDE.md       (deployment — keep)
DEVELOPER_GUIDE.md        (onboarding — keep, will update)
EMAIL_CONFIGURATION.md    (email setup — keep)
ENVIRONMENT_VARIABLES.md  (env docs — keep)
ROADMAP_100_STRICT_2026.md (roadmap — keep as living doc)
TAGS_TAXONOMY.md          (domain taxonomy — keep)
archive/                  (historical — keep)
frontend/                 (frontend patterns — keep)
plans/                    (implementation plans — keep)
```

**Step 4: Commit**

```bash
git add docs/
git commit -m "chore: remove stale docs superseded by .ai/ system, archive duplicates"
```

---

### Task 4: Clean up `.github/` cruft

**Files:**
- Delete: `.github/prompts/entripise.prompt.md` (typo in name "entripise", enterprise instructions now live in `.ai/`)
- Delete: `.github/prompts/` (directory, if empty after)
- Keep: `.github/instructions/com.instructions.md` (working agreement, still relevant for Copilot)
- Keep: `.github/copilot-instructions.md` (Copilot bootstrap — points to `.ai/`)
- Keep: `.github/pull_request_template.md` (PR template — actively used)
- Keep: `.github/workflows/` (all 3 workflows are active)

**Step 1: Delete the typo enterprise prompt**

```bash
rm .github/prompts/entripise.prompt.md
rmdir .github/prompts/ 2>/dev/null || true
```

**Step 2: Verify .github structure**

```bash
find .github -type f | sort
```
Expected:
```
.github/copilot-instructions.md
.github/instructions/com.instructions.md
.github/pull_request_template.md
.github/workflows/ci-streak-monitor.yml
.github/workflows/ci.yml
.github/workflows/deploy.yml
```

**Step 3: Commit**

```bash
git add .github/
git commit -m "chore: remove stale .github/prompts/entripise.prompt.md (typo, superseded by .ai/)"
```

---

### Task 5: Delete stale `.quality/` log files

These are one-time audit logs that don't need to be tracked. The quality system generates fresh reports on demand.

**Files:**
- Delete: `.quality/baseline-*.log`
- Delete: `.quality/code-quality-*.log`
- Delete: `.quality/quick-quality-audit-*.log`
- Keep: `.quality/ci-stability/manifest.jsonl` (if actively used by CI streak monitor)

**Step 1: Check if .quality is git-tracked**

```bash
git ls-files .quality/ | head -20
```

If tracked, clean them up. If untracked, just delete locally.

**Step 2: Delete stale log files**

```bash
rm -f .quality/baseline-*.log
rm -f .quality/code-quality-*.log
rm -f .quality/quick-quality-audit-*.log
```

**Step 3: Add to .gitignore if not already**

Check `.gitignore` for `.quality/` — if missing, add it:
```
# Quality audit logs (generated on demand)
.quality/*.log
```

**Step 4: Commit**

```bash
git add .quality/ .gitignore
git commit -m "chore: clean stale quality audit logs, gitignore generated reports"
```

---

## Phase 2: Create CLAUDE.md — The "One File" Entry Point

---

### Task 6: Create root `CLAUDE.md`

This is THE file that any AI (Claude Code, Cursor, Windsurf, Copilot) reads first. It replaces `.claude/skills/fullstack/SKILL.md` with a universal, provider-agnostic bootstrap. This is the "one file + prompt" the user wants.

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write CLAUDE.md**

```markdown
# CLAUDE.md — AI Development Instructions

## First Action (Mandatory)

Before making ANY code change, run:

```bash
bash .ai/context.sh
```

This outputs the **current** state of the codebase: versions, schemas, file counts,
routes, and quality score. Never trust hardcoded numbers — always discover state dynamically.

## Instruction Files

Read these in order for full context:

1. `.ai/RULES.md` — Coding conventions, commit format, design tokens, invariants
2. `.ai/ARCHITECTURE.md` — Service boundaries, domain model, middleware stack
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

## Quality Gate (Before Every Commit)

```bash
./ops/preflight-full.sh
```

## Commit + Push

```bash
./ops/commit-push.sh "type(scope): message"
```

This automatically runs preflight, commits, and pushes. On `main`, it also triggers VPS deploy.

## Degrees of Freedom

### Agent Decides
- File organization within established patterns
- Variable/function naming following conventions
- Which existing UI components to compose
- Tailwind utility classes following `.ai/prompts/style-guide.md`
- SWR cache keys and revalidation strategy
- Error message wording (Indonesian, matching existing tone)
- Commit message content (conventional commits format)
- Test structure and assertions

### Agent Asks First
- New Ent schema or field changes
- New API endpoint design
- Financial rule changes (amounts, fees, limits)
- Adding new dependencies
- Auth/authorization logic changes
- Workflow state machine changes
- Deployment config changes
- Removing features or endpoints
- Destructive database operations

## Critical Invariant

If documentation conflicts with `context.sh` output, **the script is correct**.
Documentation describes process. Scripts discover state.
```

**Step 2: Verify the file reads cleanly**

```bash
head -20 CLAUDE.md
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add CLAUDE.md as universal AI bootstrap entry point"
```

---

### Task 7: Update `AGENTS.md` to point to `CLAUDE.md`

Simplify AGENTS.md to be a redirect to CLAUDE.md (some AI providers read AGENTS.md).

**Files:**
- Modify: `AGENTS.md`

**Step 1: Rewrite AGENTS.md**

Replace entire content with:

```markdown
# AI Assistant Instructions

All instructions are in `CLAUDE.md` at the repository root. Read that file first.

For detailed context, see the `.ai/` directory.
```

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "chore: simplify AGENTS.md to redirect to CLAUDE.md"
```

---

### Task 8: Update `.cursorrules` and `.windsurfrules` to point to `.ai/`

These provider-specific files should be thin bootstraps pointing to the `.ai/` system.

**Files:**
- Modify: `.cursorrules`
- Modify: `.windsurfrules`

**Step 1: Read current content**

```bash
cat .cursorrules
cat .windsurfrules
```

**Step 2: Rewrite both files**

Both should contain the same thin bootstrap (adapted for each provider):

```
# See CLAUDE.md at repo root for full instructions.
# First action: run `bash .ai/context.sh`
# Then read: .ai/RULES.md → .ai/ARCHITECTURE.md → .ai/QUALITY.md → .ai/SECURITY.md
# Workflow prompts: .ai/prompts/{feature,fix,refactor,migrate,review,deploy,style-guide,audit}.md
```

**Step 3: Commit**

```bash
git add .cursorrules .windsurfrules
git commit -m "chore: simplify .cursorrules and .windsurfrules to point to .ai/"
```

---

## Phase 3: Upgrade `.ai/` System — The Brain

---

### Task 9: Create `.ai/prompts/style-guide.md` — Frontend Styling Reference

This prompt ensures AI never produces inconsistent frontend styling. It codifies the modern Next.js + Tailwind patterns used in this project.

**Files:**
- Create: `.ai/prompts/style-guide.md`

**Step 1: Write the style guide prompt**

```markdown
# Frontend Style Guide

## Trigger
Use this guide for ANY frontend change: new page, component, layout fix, or styling.

## Step 1: Discover
```bash
bash .ai/context.sh
```

## Step 2: Design Tokens (oklch)

All colors use oklch() CSS custom properties defined in `frontend/app/globals.css`:

```css
/* Use semantic tokens, never raw colors */
--background       /* Page background */
--foreground       /* Primary text */
--card             /* Card/panel background */
--card-foreground  /* Text on cards */
--primary          /* Brand action (Harvard Crimson) */
--primary-foreground
--secondary        /* Secondary actions */
--muted            /* Subdued backgrounds */
--muted-foreground /* Subdued text */
--accent           /* Hover/focus backgrounds */
--destructive      /* Error/danger */
--border           /* Borders */
--ring             /* Focus rings */
--radius           /* Border radius token */
```

Dark mode: All tokens swap automatically via `[data-theme="dark"]`.

## Step 3: Typography

- **Body:** Source Sans 3 (`font-sans`)
- **Headings:** Source Serif 4 (`font-serif`)
- **Code:** Geist Mono (`font-mono`)

Scale:
- Page title: `text-2xl font-bold font-serif` (mobile) / `text-3xl` (desktop)
- Section heading: `text-xl font-semibold font-serif`
- Card title: `text-lg font-semibold`
- Body: `text-sm` or `text-base`
- Caption/meta: `text-xs text-muted-foreground`
- All headings Indonesian for user-facing content.

## Step 4: Layout Patterns

### Page Container
```jsx
<main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
  {/* content */}
</main>
```

### Header (Sticky)
```jsx
<header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
  <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
    {/* logo left, nav right */}
  </div>
</header>
```

### Card
```jsx
<div className="rounded-[var(--radius)] border bg-card p-4 shadow-sm">
  {/* content */}
</div>
```

### Responsive Grid
```jsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {/* cards */}
</div>
```

## Step 5: Component Rules

1. **Always use existing UI primitives** from `components/ui/` — check what exists before creating new ones.
2. **`cn()` for conditional classes** — import from `@/lib/utils`.
3. **No inline styles** — use Tailwind utilities only.
4. **No raw color values** — use CSS custom property tokens.
5. **Responsive-first** — mobile layout first, `sm:` / `md:` / `lg:` breakpoints for larger.
6. **Transitions** — use `transition-colors` for hover states, `transition-transform` for motion.
7. **Focus states** — always include `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.
8. **Dark mode** — use semantic tokens. Never use `dark:` prefix directly — the token system handles it.
9. **Icons** — inline SVG with `currentColor`, or existing icon components.
10. **Loading states** — skeleton with `animate-pulse bg-muted rounded-[var(--radius)]`.
11. **Empty states** — centered text with `text-muted-foreground` and optional illustration.

## Step 6: Spacing & Sizing

- **Section gap:** `space-y-6` or `gap-6`
- **Card padding:** `p-4` or `p-6` (larger cards)
- **Button padding:** `px-4 py-2` (default), `px-3 py-1.5` (small)
- **Input padding:** `px-3 py-2`
- **Border radius:** always `rounded-[var(--radius)]` (uses CSS token)
- **Max content width:** `max-w-5xl`

## Step 7: Accessibility (Mandatory)

1. All `<img>` must have `alt` attribute.
2. All interactive elements must have accessible labels.
3. Color contrast must meet WCAG AA.
4. All forms must have associated `<label>` elements.
5. Modal/dialog must have `role="dialog"` and `aria-modal="true"`.
6. Keyboard navigation must work (Escape closes modals, Tab navigates forms).

## Step 8: Anti-Patterns (Never Do)

- Never add `className="text-[#a51c30]"` — use `text-primary`.
- Never use `style={{}}` for layout — use Tailwind.
- Never create a new component if `components/ui/` has one.
- Never write `console.log` — use `lib/logger.js`.
- Never use `Math.random()` for IDs — use `crypto.randomUUID()`.
- Never hardcode Indonesian text in components — but all user-facing text IS Indonesian.
- Never use `dangerouslySetInnerHTML` unless rendering trusted markdown.
- Never exceed 500 lines per file — split into subcomponents.
```

**Step 2: Commit**

```bash
git add .ai/prompts/style-guide.md
git commit -m "feat(.ai): add frontend style-guide prompt for consistent AI-driven styling"
```

---

### Task 10: Create `.ai/prompts/audit.md` — Repo Audit/Cleanup Workflow

This prompt enables "one command" audit and cleanup across the entire repo.

**Files:**
- Create: `.ai/prompts/audit.md`

**Step 1: Write the audit prompt**

```markdown
# Repo Audit & Cleanup

## Trigger
Use when asked to audit, clean up, or verify repo health.

## Step 1: Discover

```bash
bash .ai/context.sh
```

## Step 2: Run Full Preflight

```bash
./ops/preflight-full.sh
```

Record all failures. These are the highest priority fixes.

## Step 3: Dependency Audit

### Frontend
```bash
cd frontend && npm audit --audit-level=moderate && cd ..
```

### Backend (Go)
```bash
cd backend && go vet ./... && cd ..
```
```bash
cd backend && govulncheck ./... 2>/dev/null || echo "govulncheck not installed" && cd ..
```

### Feature Service (.NET)
```bash
cd feature-service && dotnet list src/FeatureService.Api/FeatureService.Api.csproj package --vulnerable --include-transitive 2>/dev/null && cd ..
```

## Step 4: Dead Code Detection

- Search for unused exports in frontend:
  ```bash
  grep -rn 'export ' frontend/lib/ frontend/components/ --include="*.js" --include="*.jsx" | head -50
  ```
  Cross-reference with imports to find orphans.

- Check for TODO/FIXME markers:
  ```bash
  grep -rn 'TODO\|FIXME\|HACK\|XXX' backend/ feature-service/src/ frontend/lib/ frontend/components/ frontend/app/ --include="*.go" --include="*.cs" --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v .next
  ```

## Step 5: File Size Check

Find files over 500 lines (modularity violation):
```bash
find frontend/app frontend/components frontend/lib -name "*.jsx" -o -name "*.js" | xargs wc -l | sort -rn | head -20
```

## Step 6: Quality Score

```bash
./ops/quality-score.sh
```

## Step 7: Build Verification

### Frontend
```bash
cd frontend && npm run build && cd ..
```

### Backend
```bash
cd backend && go build -o /dev/null ./... && cd ..
```

### Feature Service
```bash
cd feature-service && dotnet build src/FeatureService.Api/FeatureService.Api.csproj --configuration Release && cd ..
```

## Step 8: Test Verification

### Frontend
```bash
cd frontend && npm test -- --ci --forceExit && cd ..
```

### Backend
```bash
cd backend && go test ./... -count=1 && cd ..
```

### Feature Service
```bash
cd feature-service && dotnet test --no-restore --configuration Release && cd ..
```

## Step 9: Report

Create a summary with:
1. Preflight status (PASS/FAIL per service)
2. Dependency audit results (vulnerabilities found)
3. Dead code/TODO count
4. Files over 500 lines
5. Quality score (out of 100)
6. Build status per service
7. Test status per service
8. Action items (prioritized)

## Rules
- Fix critical issues immediately (security vulns, build failures, test failures)
- Log non-critical issues as recommendations
- Never skip a step — full audit means ALL steps
- After fixes, re-run `./ops/preflight-full.sh` to confirm
```

**Step 2: Commit**

```bash
git add .ai/prompts/audit.md
git commit -m "feat(.ai): add audit prompt for comprehensive repo health checks"
```

---

### Task 11: Enhance `context.sh` with dependency health check

Add dependency audit summary to the context discovery script so AI always sees repo health.

**Files:**
- Modify: `.ai/context.sh`

**Step 1: Read current context.sh**

```bash
cat .ai/context.sh
```

**Step 2: Add dependency health section at the end**

Append before the final output:

```bash
# ── Dependency Health ──
echo ""
echo "=== Dependency Health ==="
if [ -d "frontend" ]; then
  AUDIT_RESULT=$(cd frontend && npm audit --audit-level=high 2>&1 | tail -1)
  echo "Frontend npm audit: $AUDIT_RESULT"
fi
if [ -d "backend" ]; then
  GOVET_RESULT=$(cd backend && go vet ./... 2>&1 | wc -l)
  echo "Backend go vet issues: $GOVET_RESULT"
fi
echo ""

# ── Large Files (>500 lines) ──
echo "=== Large Files (>500 LOC) ==="
find frontend/app frontend/components frontend/lib -name "*.jsx" -o -name "*.js" 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | awk '$1 > 500 && !/total$/ {print}' | head -10
echo ""

# ── TODO/FIXME Count ──
TODO_COUNT=$(grep -rn 'TODO\|FIXME' backend/ feature-service/src/ frontend/lib/ frontend/components/ frontend/app/ --include="*.go" --include="*.cs" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v node_modules | grep -v .next | wc -l)
echo "TODO/FIXME markers: $TODO_COUNT"
```

**Step 3: Test the enhanced script**

```bash
bash .ai/context.sh
```
Expected: Previous output + new sections for dependency health, large files, and TODO count.

**Step 4: Commit**

```bash
git add .ai/context.sh
git commit -m "feat(.ai): enhance context.sh with dependency health, large files, TODO count"
```

---

## Phase 4: Local Dev Enforcement (Guardrails)

---

### Task 12: Add `.editorconfig` for cross-editor consistency

This ensures all editors (VS Code, Cursor, vim, IntelliJ) produce consistent formatting.

**Files:**
- Create: `.editorconfig`

**Step 1: Write .editorconfig**

```ini
# EditorConfig — https://editorconfig.org
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.go]
indent_style = tab
indent_size = 4

[*.cs]
indent_size = 4

[Makefile]
indent_style = tab

[*.md]
trim_trailing_whitespace = false

[*.sh]
indent_size = 2
```

**Step 2: Commit**

```bash
git add .editorconfig
git commit -m "feat: add .editorconfig for cross-editor formatting consistency"
```

---

### Task 13: Add Husky + commitlint + lint-staged to frontend

This enforces commit message format and runs linting on staged files before every commit.

**Files:**
- Modify: `frontend/package.json` (add devDependencies + scripts)
- Create: `frontend/.husky/pre-commit`
- Create: `frontend/.husky/commit-msg`
- Create: `frontend/.lintstagedrc.json`
- Create: `frontend/commitlint.config.js`

**Step 1: Install dependencies**

```bash
cd frontend && npm install --save-dev husky @commitlint/cli @commitlint/config-conventional lint-staged
```

**Step 2: Initialize Husky**

```bash
cd frontend && npx husky init
```

**Step 3: Create commitlint config**

Write `frontend/commitlint.config.js`:
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['frontend', 'backend', 'feature-service', 'ops', 'docs', 'ci', 'ai']],
    'subject-case': [2, 'always', 'lower-case'],
  },
};
```

**Step 4: Create lint-staged config**

Write `frontend/.lintstagedrc.json`:
```json
{
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md}": ["prettier --write"]
}
```

**Step 5: Configure Husky hooks**

Write `frontend/.husky/pre-commit`:
```bash
cd frontend && npx lint-staged
```

Write `frontend/.husky/commit-msg`:
```bash
cd frontend && npx commitlint --edit $1
```

**Step 6: Test the hooks**

```bash
cd frontend && echo "test" > /tmp/test-commit.txt && git add /tmp/test-commit.txt 2>/dev/null; echo "Hook system ready"
```

**Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/.husky/ frontend/.lintstagedrc.json frontend/commitlint.config.js
git commit -m "feat(frontend): add Husky + commitlint + lint-staged for local enforcement"
```

---

## Phase 5: Fix & Modernize Documentation

---

### Task 14: Rewrite `README.md` — Enterprise-grade project overview

Fix the stale "Next.js 15" reference, remove emojis, make it professor-ready.

**Files:**
- Modify: `README.md`

**Step 1: Read the full current README**

```bash
cat README.md
```

**Step 2: Rewrite README.md**

The README should:
- Fix architecture diagram (Next.js 15 → Next.js 16)
- Remove stale "Last Updated" date format (context.sh discovers actual versions)
- Add "Getting Started" for contributors
- Reference `.ai/` system for AI-assisted development
- Reference `CONTRIBUTING.md` for human contributors
- Add badge placeholders for CI status
- Keep it concise and professional

Key changes:
1. Architecture diagram: change "FRONTEND (Next.js 15)" to "FRONTEND (Next.js)"
2. Tech Stack table: remove hardcoded versions, use "Latest" or range notation
3. Add "For Contributors" section pointing to CONTRIBUTING.md
4. Add "For AI Assistants" section pointing to CLAUDE.md
5. Add "Development" section with setup instructions
6. Remove emojis

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: modernize README.md with accurate architecture and contributor guide"
```

---

### Task 15: Update `CONTRIBUTING.md` — Reference `.ai/` system

**Files:**
- Modify: `CONTRIBUTING.md`

**Step 1: Read current CONTRIBUTING.md**

```bash
cat CONTRIBUTING.md
```

**Step 2: Enhance CONTRIBUTING.md**

Add sections for:
1. **Prerequisites**: Node 24+, Go 1.24+, .NET 8, PostgreSQL, MongoDB, Redis
2. **Setup**: Clone → install deps per service → copy .env.example
3. **Quality Gates**: Reference `./ops/preflight-full.sh` and `./ops/commit-push.sh`
4. **AI-Assisted Development**: Reference `CLAUDE.md` and `.ai/` system
5. **Branch Protection**: Required checks before merge

**Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: enhance CONTRIBUTING.md with setup guide and quality gate references"
```

---

### Task 16: Update `docs/DEVELOPER_GUIDE.md` — Remove stale references

**Files:**
- Modify: `docs/DEVELOPER_GUIDE.md`

**Step 1: Read current developer guide**

```bash
cat docs/DEVELOPER_GUIDE.md
```

**Step 2: Ensure it references `.ai/` system**

Update any stale path references, version numbers, or instructions. Ensure it points to:
- `CLAUDE.md` for AI dev
- `.ai/context.sh` for state discovery
- `ops/` scripts for quality gates

**Step 3: Commit**

```bash
git add docs/DEVELOPER_GUIDE.md
git commit -m "docs: update DEVELOPER_GUIDE.md to reference .ai/ system and current tooling"
```

---

## Phase 6: Upgrade CI/CD Pipeline

---

### Task 17: Add dependency audit job to `ci.yml`

The current CI has security scanning but missing explicit dependency version audit with actionable output.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Read current ci.yml**

```bash
cat .github/workflows/ci.yml
```

**Step 2: Add a `dependency-audit` job to the quick lane**

Add after the existing frontend-build job:

```yaml
  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Frontend audit
        working-directory: frontend
        run: npm audit --audit-level=high

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Backend vulnerability check
        working-directory: backend
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: ${{ env.DOTNET_VERSION }}

      - name: Feature Service audit
        working-directory: feature-service
        run: dotnet list src/FeatureService.Api/FeatureService.Api.csproj package --vulnerable --include-transitive
```

**Step 3: Add dependency-audit to quality-gate-quick needs**

```yaml
  quality-gate-quick:
    needs: [frontend-build, backend-test, feature-service-test, dependency-audit]
```

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add explicit dependency audit job to quick lane"
```

---

### Task 18: Add modularity check to CI

Fail the build if any frontend file exceeds 500 lines.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add modularity check step to frontend-lint job**

After the existing lint step, add:

```yaml
      - name: Check file modularity (max 500 LOC)
        working-directory: frontend
        run: |
          VIOLATIONS=$(find app components lib -name "*.jsx" -o -name "*.js" -o -name "*.tsx" -o -name "*.ts" | \
            xargs wc -l | sort -rn | awk '$1 > 500 && !/total$/ {print}')
          if [ -n "$VIOLATIONS" ]; then
            echo "::error::Files exceeding 500-line limit:"
            echo "$VIOLATIONS"
            exit 1
          fi
          echo "All files within 500-line modularity limit"
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add 500-line modularity check to frontend lint job"
```

---

## Phase 7: Upgrade Testing Infrastructure

---

### Task 19: Create test helper utilities for frontend

Standardize test patterns so AI doesn't write inconsistent tests.

**Files:**
- Create: `frontend/lib/__tests__/test-utils.js`

**Step 1: Write shared test utilities**

```javascript
import { render } from '@testing-library/react';
import { UserProvider } from '@/lib/UserContext';
import { ThemeProvider } from '@/lib/ThemeContext';

/**
 * Custom render that wraps components with required providers.
 * Use this instead of raw render() from @testing-library/react.
 */
export function renderWithProviders(ui, options = {}) {
  const { user = null, theme = 'light', ...renderOptions } = options;

  function Wrapper({ children }) {
    return (
      <ThemeProvider initialTheme={theme}>
        <UserProvider initialUser={user}>
          {children}
        </UserProvider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Create a mock API response for testing.
 */
export function mockApiResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

/**
 * Create a mock error API response.
 */
export function mockApiError(message, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  });
}

export { render };
```

**Step 2: Commit**

```bash
git add frontend/lib/__tests__/test-utils.js
git commit -m "feat(frontend): add shared test utilities for consistent provider wrapping"
```

---

### Task 20: Add backend test coverage report script

Create a simple script to measure and report backend test coverage.

**Files:**
- Create: `ops/test-coverage.sh`

**Step 1: Write test coverage script**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Backend (Go) Test Coverage ==="
cd "$ROOT_DIR/backend"
go test -coverprofile=coverage.out -covermode=atomic ./... 2>&1 | tail -5
BACKEND_COV=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')
echo "Backend coverage: $BACKEND_COV"
rm -f coverage.out
echo ""

echo "=== Feature Service (.NET) Test Coverage ==="
cd "$ROOT_DIR/feature-service"
dotnet test --collect:"XPlat Code Coverage" --results-directory ./coverage 2>&1 | tail -5
echo "(See ./coverage/ for detailed report)"
echo ""

echo "=== Frontend (Jest) Test Coverage ==="
cd "$ROOT_DIR/frontend"
npx jest --coverage --ci --forceExit 2>&1 | tail -10
echo ""

echo "=== Coverage Summary ==="
echo "Backend (Go):        $BACKEND_COV (target: >=60%)"
echo "Feature Service:     (see above, target: >=50%)"
echo "Frontend:            (see above, target: >=50%)"
```

**Step 2: Make executable**

```bash
chmod +x ops/test-coverage.sh
```

**Step 3: Commit**

```bash
git add ops/test-coverage.sh
git commit -m "feat(ops): add test-coverage.sh for cross-service coverage reporting"
```

---

## Phase 8: Final Verification & Documentation Sync

---

### Task 21: Run full preflight to verify everything works

**Files:**
- None (verification only)

**Step 1: Run preflight**

```bash
./ops/preflight-full.sh
```

Expected: All checks pass.

**Step 2: If any failures, fix them**

Address any lint errors, type errors, or test failures introduced by our changes.

**Step 3: Run quality score**

```bash
./ops/quality-score.sh
```

Document the score.

---

### Task 22: Run context.sh to verify enhanced output

**Files:**
- None (verification only)

**Step 1: Run enhanced context.sh**

```bash
bash .ai/context.sh
```

Expected: Previous output + new sections (dependency health, large files, TODO count).

**Step 2: Verify all sections output correctly**

If any section errors, fix the corresponding part of context.sh.

---

### Task 23: Final commit — snapshot the clean state

**Files:**
- None (just commit any remaining changes)

**Step 1: Check for uncommitted changes**

```bash
git status
```

**Step 2: If clean, verify the commit log tells a coherent story**

```bash
git log --oneline -15
```

**Step 3: If any loose changes remain, commit them**

```bash
git add -A
git commit -m "chore: final cleanup after enterprise-grade repo overhaul"
```

---

## Summary of Changes

| Category | Action | Files Affected |
|----------|--------|----------------|
| **Delete** | Remove `.claude/skills/fullstack/` | 1 file |
| **Delete** | Remove stale root docs | 1 file (EMAIL_VERIFICATION_FIX.md) |
| **Delete** | Remove 5 overlapping docs, archive 2 | 7 files |
| **Delete** | Remove `.github/prompts/entripise.prompt.md` | 1 file |
| **Delete** | Clean `.quality/` logs | ~9 files |
| **Create** | `CLAUDE.md` (universal AI bootstrap) | 1 file |
| **Create** | `.ai/prompts/style-guide.md` | 1 file |
| **Create** | `.ai/prompts/audit.md` | 1 file |
| **Create** | `.editorconfig` | 1 file |
| **Create** | Husky + commitlint + lint-staged | 5 files |
| **Create** | `frontend/lib/__tests__/test-utils.js` | 1 file |
| **Create** | `ops/test-coverage.sh` | 1 file |
| **Modify** | `AGENTS.md` (simplified) | 1 file |
| **Modify** | `.cursorrules` + `.windsurfrules` | 2 files |
| **Modify** | `README.md` (modernized) | 1 file |
| **Modify** | `CONTRIBUTING.md` (enhanced) | 1 file |
| **Modify** | `docs/DEVELOPER_GUIDE.md` (updated refs) | 1 file |
| **Modify** | `.ai/context.sh` (enhanced) | 1 file |
| **Modify** | `.github/workflows/ci.yml` (2 new checks) | 1 file |

**Total: ~23 tasks across 8 phases**

---

## Post-Implementation: What Changes for the User

After this plan is implemented:

1. **"One file + prompt"**: Tell any AI "read CLAUDE.md and build X" — it will discover state, follow rules, check quality, and produce consistent work.

2. **Self-healing**: If versions change, `context.sh` discovers the new state. No docs to update manually.

3. **Local enforcement**: Husky catches bad commits locally before they reach CI. commitlint enforces conventional commits. lint-staged auto-fixes formatting.

4. **Consistent styling**: `.ai/prompts/style-guide.md` ensures AI always uses the correct tokens, typography, spacing, and component patterns.

5. **Full audit capability**: `.ai/prompts/audit.md` gives AI a comprehensive checklist to audit and fix the entire repo.

6. **Clean repo**: No stale docs, no duplicate files, no typo filenames. Professor-ready.

7. **CI guards**: Dependency audit and modularity checks catch issues before merge.
