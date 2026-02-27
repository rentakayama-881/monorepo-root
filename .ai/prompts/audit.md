# Repo Audit and Cleanup

## Trigger
Use when asked to audit, clean up, or verify repo health.

## Step 1: Discover

Run `bash .ai/context.sh` to see current repo state.

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
