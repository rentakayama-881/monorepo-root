# Repo Audit and Cleanup

## Trigger
Use when asked to audit, clean up, or verify repo health.

## Philosophy
Audit with the rigor of a principal engineer. Don't just find problems — understand their root cause, assess their impact, and prioritize fixes by blast radius. The goal is to leave the repo in a measurably better state.

## Step 0: Clarify Scope (MANDATORY)

1. **What triggered this audit?** — Routine check? Specific concern? Post-incident?
2. **What's the scope?** — Full repo? Single service? Specific area?
3. **What's the priority?** — Security? Performance? Code quality? All?
4. **How deep?** — Quick scan or deep analysis?

## Step 1: Discover

```bash
bash .ai/context.sh
```

Record the baseline state. All improvements will be measured against this.

## Step 2: Run Full Preflight

```bash
./ops/preflight-full.sh
```

Record all failures. These are P0 fixes.

## Step 3: Dependency Audit

### Frontend
```bash
cd frontend && npm audit --audit-level=moderate && cd ..
```

### Backend (Go)
```bash
cd backend && go vet ./... && cd ..
```

### Feature Service (.NET)
```bash
cd feature-service && dotnet list src/FeatureService.Api/FeatureService.Api.csproj package --vulnerable --include-transitive 2>/dev/null && cd ..
```

## Step 4: Dead Code Detection

Search for unused exports:
```bash
grep -rn 'export ' frontend/lib/ frontend/components/ --include="*.js" --include="*.jsx" | head -50
```
Cross-reference with imports to find orphans.

Check for TODO/FIXME markers:
```bash
grep -rn 'TODO\|FIXME\|HACK\|XXX' backend/ feature-service/src/ frontend/lib/ frontend/components/ frontend/app/ --include="*.go" --include="*.cs" --include="*.js" --include="*.jsx" | grep -v node_modules | grep -v .next
```

## Step 5: File Size Check

Find files over 500 lines (modularity violation):
```bash
# Frontend:
find frontend/app frontend/components frontend/lib -name "*.jsx" -o -name "*.js" | xargs wc -l | sort -rn | head -20

# Backend (handler files should be decomposed if >500 lines):
find backend/handlers backend/services -name "*.go" ! -name "*_test.go" | xargs wc -l | sort -rn | head -20
```

## Step 6: Documentation Accuracy Check

Verify that `.ai/` docs match actual code behavior:
- Font declarations in `style-guide.md` match `globals.css`
- Architecture descriptions match actual service structure
- Env var names match actual usage in code
- Security checklist reflects current auth model
- Commit scopes match commitlint config

**If docs and code conflict, fix the docs — code is the source of truth.**

## Step 7: Quality Score

```bash
bash ops/quality-score.sh
```

## Step 8: Build Verification

### Frontend
```bash
cd frontend && SKIP_PREBUILD_CHECK=1 npm run build && cd ..
```

### Backend
```bash
cd backend && go build -o /dev/null . && cd ..
```

### Feature Service
```bash
cd feature-service && dotnet build src/FeatureService.Api/FeatureService.Api.csproj --configuration Release && cd ..
```

## Step 9: Test Verification

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

## Step 10: Report

Create a structured summary:

| Category | Status | Details |
|----------|--------|---------|
| Preflight | PASS/FAIL | Per-service status |
| Dependencies | X vulns | Severity breakdown |
| Dead Code | X items | TODO/FIXME count |
| File Size | X violations | Files >500 lines |
| Doc Accuracy | X issues | Mismatches found |
| Quality Score | XX/100 | Per-dimension breakdown |
| Build | PASS/FAIL | Per-service status |
| Tests | PASS/FAIL | Per-service with counts |

### Action Items (prioritized by impact)
1. **P0 (Fix immediately):** Security vulns, build failures, test failures
2. **P1 (Fix this session):** Convention violations, quality score drops
3. **P2 (Track for later):** Non-critical improvements, nice-to-haves

## Rules
- Fix critical issues immediately (security vulns, build failures, test failures)
- Log non-critical issues as recommendations with clear priority
- Never skip a step — full audit means ALL steps
- After fixes, re-run `./ops/preflight-full.sh` to confirm
- Compare final quality score against baseline — must not regress
