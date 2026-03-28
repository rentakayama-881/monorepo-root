# AIValid Quality System

> The **script** is the source of truth, not this document.
> Run `bash ops/quality-score.sh` for current scores.

## Gate Commands

```bash
# Local preflight (runs all checks):
./ops/preflight-full.sh

# Commit + push (enforces preflight, auto-syncs VPS on main):
./ops/commit-push.sh "type(scope): message"

# Quality measurement (9 dimensions, weighted to 100):
bash ops/quality-score.sh
```

## 9 Quality Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Security | 15% | No `Math.random()` for crypto, no `InsecureSkipVerify`, no console leaks in lib/ |
| DRY | 15% | No duplicate utility definitions across files |
| Code Smells | 10% | Justified eslint-disable, no raw `console.*` in app/components, no TODO/FIXME |
| Tests | 20% | Frontend test-to-source ratio, backend test coverage |
| Accessibility | 10% | All images have alt, proper WCAG AA contrast, no placeholder a11y |
| Modularity | 10% | No frontend file > 500 lines, backend handlers decomposed |
| CI/CD | 10% | ci.yml + preflight-full.sh exist and are executable |
| Dependencies | 5% | Version alignment (next <-> eslint-config-next), minimal npm overrides |
| Deprecation | 5% | No deprecated markers in non-generated backend code |

## Coverage Targets

| Layer | Target | Enforced By |
|-------|--------|-------------|
| Frontend | Test-to-source ratio target (quality script measured) | `npm test -- --ci` |
| Backend (Go) | All handler + service tests pass, `go vet` clean | `go test -v ./...` |
| Feature Service (.NET) | Build + test pass | `dotnet test -c Release` |
| Browser Service (Python) | All pytest tests pass, no lint errors | `cd browser-service && python -m pytest -v` |
| Critical paths | Auth and financial flows MUST have regression tests | Manual review |

## Merge Rules

### Quick Lane (PR / develop)
- `go vet ./...` + `go test -v ./...`
- `dotnet build -c Release` + `dotnet test -c Release`
- `npm run lint` + `npm run typecheck` + `npm run test -- --ci`
- `cd browser-service && python -m pytest -v`
- No new critical security findings

### Full Lane (main / nightly)
- Quick lane + `go test -v -race ./...`
- `SKIP_PREBUILD_CHECK=1 npm run build`
- `npm audit --omit=dev --audit-level=high`
- Full CI security jobs

## Quality Improvement Protocol

When the quality score drops or stagnates:

1. **Run `bash ops/quality-score.sh`** — identify the lowest dimension
2. **Read the dimension criteria** in the script itself — `ops/quality-score.sh` has the exact checks
3. **Fix the lowest-scoring dimension first** — highest impact per effort
4. **Re-run after each fix** — verify score improved
5. **Never commit code that drops the score** without discussing with the owner

Common improvement opportunities:
- **Tests (20%):** Add tests for untested handlers/services/components
- **Security (15%):** Eliminate `console.*` leaks, ensure `crypto.randomUUID()` usage
- **DRY (15%):** Centralize duplicate utility functions
- **Code Smells (10%):** Remove TODO/FIXME markers or convert them to tracked issues
- **Modularity (10%):** Split files over 500 lines

## 100/100 Exit Criteria

All must be true:
1. Every quality dimension >= 90
2. Required quick/full lane checks green
3. No open critical issues
4. Auth and financial critical paths have regression harness

## Frontend Quality Rubric

See `docs/frontend/QUALITY_RUBRIC.md` for the 100-point frontend-specific rubric.
See `docs/frontend/REFERENCE_PATTERNS.md` for approved UI patterns.
