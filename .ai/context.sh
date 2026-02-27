#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# AI Context Discovery — outputs current codebase state.
# Run this BEFORE any code change. Output replaces all hardcoded facts.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '=== GIT STATE ===\n'
printf 'Branch: %s\n' "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
printf 'SHA: %s\n' "$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
printf 'Dirty files: %s\n' "$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
printf 'Last 5 commits:\n'
git -C "$ROOT" log --oneline -5 2>/dev/null || true
printf '\n'

# ── Versions (read from actual config files, never hardcoded) ───────
printf '=== VERSIONS ===\n'
if [ -f "$ROOT/backend/go.mod" ]; then
  printf 'Go: %s\n' "$(grep '^go ' "$ROOT/backend/go.mod" | awk '{print $2}')"
  printf 'Gin: %s\n' "$(grep 'github.com/gin-gonic/gin ' "$ROOT/backend/go.mod" | awk '{print $2}' | head -1)"
  printf 'Ent: %s\n' "$(grep 'entgo.io/ent ' "$ROOT/backend/go.mod" | awk '{print $2}' | head -1)"
fi
if [ -f "$ROOT/frontend/package.json" ]; then
  extract() { grep "\"$1\"" "$ROOT/frontend/package.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/'; }
  printf 'Next.js: %s\n' "$(extract next)"
  printf 'React: %s\n' "$(extract react)"
  printf 'Node engine: %s\n' "$(python3 -c "import json; print(json.load(open('$ROOT/frontend/package.json')).get('engines',{}).get('node','unknown'))" 2>/dev/null || echo 'unknown')"
  printf 'Tailwind: %s\n' "$(extract tailwindcss)"
  printf 'SWR: %s\n' "$(extract swr)"
fi
csproj="$ROOT/feature-service/src/FeatureService.Api/FeatureService.Api.csproj"
if [ -f "$csproj" ]; then
  printf '.NET TFM: %s\n' "$(grep '<TargetFramework>' "$csproj" | sed 's/.*<TargetFramework>\(.*\)<\/TargetFramework>.*/\1/')"
fi
printf '\n'

# ── Ent Schemas ─────────────────────────────────────────────────────
printf '=== ENT SCHEMAS ===\n'
schema_dir="$ROOT/backend/ent/schema"
if [ -d "$schema_dir" ]; then
  schema_count=$(ls "$schema_dir"/*.go 2>/dev/null | wc -l | tr -d ' ')
  printf 'Count: %s\n' "$schema_count"
  printf 'Names: '
  ls "$schema_dir"/*.go 2>/dev/null | xargs -I{} basename {} .go | paste -sd, -
else
  printf 'Directory not found\n'
fi
printf '\n'

# ── File Counts ─────────────────────────────────────────────────────
printf '=== FILE COUNTS ===\n'
count_files() {
  find "$@" 2>/dev/null | wc -l | tr -d ' '
}
fe_src=$(count_files "$ROOT/frontend/app" "$ROOT/frontend/components" "$ROOT/frontend/lib" \
  -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.*' ! -name '*.spec.*' ! -path '*/node_modules/*' ! -path '*/.next/*')
fe_test=$(count_files "$ROOT/frontend" -type f \( -name '*.test.*' -o -name '*.spec.*' \) \
  ! -path '*/node_modules/*')
be_src=$(count_files "$ROOT/backend" -type f -name '*.go' ! -name '*_test.go' \
  ! -path '*/ent/*' ! -path '*/vendor/*')
be_test=$(count_files "$ROOT/backend" -type f -name '*_test.go' ! -path '*/vendor/*')
printf 'Frontend source: %s | tests: %s\n' "$fe_src" "$fe_test"
printf 'Backend source:  %s | tests: %s\n' "$be_src" "$be_test"
printf '\n'

# ── Frontend Pages ──────────────────────────────────────────────────
printf '=== FRONTEND PAGES ===\n'
find "$ROOT/frontend/app" \( -name 'page.js' -o -name 'page.jsx' -o -name 'page.tsx' \) 2>/dev/null \
  | sed "s|$ROOT/frontend/app||" | sort
printf '\n'

# ── Backend API Routes ──────────────────────────────────────────────
printf '=== BACKEND ROUTES (from main.go) ===\n'
grep -n 'router\.\(GET\|POST\|PUT\|DELETE\|PATCH\|Group\)' "$ROOT/backend/main.go" 2>/dev/null \
  | head -40 || echo "(could not parse)"
printf '\n'

# ── Quality Score ───────────────────────────────────────────────────
printf '=== QUALITY SCORE ===\n'
latest=$(ls -t "$ROOT/.ops/reports/quality-score-"*.log 2>/dev/null | head -1)
if [ -n "$latest" ]; then
  grep 'FINAL QUALITY SCORE' "$latest" 2>/dev/null || echo "(score not found)"
  printf 'Report: %s\n' "$latest"
else
  printf 'No report found. Run: bash ops/quality-score.sh\n'
fi
printf '\n'

# ── Large Files (>500 lines) ───────────────────────────────────────
printf '=== LARGE FILES (>500 lines) ===\n'
find "$ROOT/frontend/app" "$ROOT/frontend/components" "$ROOT/frontend/lib" \
  -type f \( -name '*.js' -o -name '*.jsx' \) ! -path '*/node_modules/*' ! -path '*/.next/*' \
  2>/dev/null | while read -r f; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 500 ]; then
    printf '%s : %s lines\n' "${f#"$ROOT/"}" "$lines"
  fi
done
printf '\n'

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

printf '=== CONTEXT COMPLETE ===\n'
printf 'Timestamp: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
