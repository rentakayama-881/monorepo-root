#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_report_dir
REPORT_FILE="$OPS_REPORT_DIR/quality-score-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$REPORT_FILE") 2>&1

log "INFO" "AIValid Quality Score — measuring 9 dimensions"
log "INFO" "Report file: $REPORT_FILE"

###############################################################################
# Globals to accumulate results
###############################################################################
declare -a DIM_NAMES=()
declare -a DIM_SCORES=()
declare -a DIM_WEIGHTS=()

record_dimension() {
  local name="$1" score="$2" weight="$3"
  # Clamp score between 0 and 100
  if (( score < 0 )); then score=0; fi
  if (( score > 100 )); then score=100; fi
  DIM_NAMES+=("$name")
  DIM_SCORES+=("$score")
  DIM_WEIGHTS+=("$weight")
}

###############################################################################
# 1. Security (15%)
###############################################################################
score_security() {
  log "INFO" "Scoring: Security"
  local score=100 deductions=0

  # Check Math.random() in security-sensitive contexts
  local math_random_hits
  math_random_hits=$(grep -rn --exclude-dir=node_modules 'Math\.random()' "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' 2>/dev/null || true)
  local math_random_count
  math_random_count=$(printf '%s' "$math_random_hits" | grep -c '.' || true)
  if (( math_random_count > 0 )); then
    deductions=$(( math_random_count * 5 ))
    printf '  [Security] -%d : %d uses of Math.random() (use crypto.getRandomValues)\n' "$deductions" "$math_random_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Check InsecureSkipVerify in Go files
  local insecure_skip_hits
  insecure_skip_hits=$(grep -rn 'InsecureSkipVerify' "$OPS_ROOT/backend/" --include='*.go' 2>/dev/null || true)
  local insecure_skip_count
  insecure_skip_count=$(printf '%s' "$insecure_skip_hits" | grep -c '.' || true)
  if (( insecure_skip_count > 0 )); then
    deductions=$(( insecure_skip_count * 15 ))
    printf '  [Security] -%d : %d uses of InsecureSkipVerify\n' "$deductions" "$insecure_skip_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Check console.* leaks in lib/ (potential info leakage)
  local console_lib_hits
  console_lib_hits=$(grep -rn --exclude-dir=node_modules 'console\.\(log\|warn\|error\|debug\|info\)' "$OPS_ROOT/frontend/lib/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' 2>/dev/null || true)
  local console_lib_count
  console_lib_count=$(printf '%s' "$console_lib_hits" | grep -c '.' || true)
  if (( console_lib_count > 0 )); then
    deductions=$(( console_lib_count * 2 ))
    printf '  [Security] -%d : %d console.* calls in frontend/lib/ (info leakage risk)\n' "$deductions" "$console_lib_count"
  fi
  score=$(( score - deductions ))

  record_dimension "Security" "$score" 15
}

###############################################################################
# 2. DRY — Don't Repeat Yourself (15%)
###############################################################################
score_dry() {
  log "INFO" "Scoring: DRY"
  local score=100 deductions=0

  # Count duplicate formatIDR definitions
  local format_idr_count
  format_idr_count=$(grep -rn --exclude-dir=node_modules 'function formatIDR\|const formatIDR\|export.*formatIDR' \
    "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | wc -l || true)
  if (( format_idr_count > 1 )); then
    local extra=$(( format_idr_count - 1 ))
    deductions=$(( extra * 10 ))
    printf '  [DRY] -%d : %d duplicate formatIDR definitions (expected 1)\n' "$deductions" "$format_idr_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Count duplicate formatDateTime definitions
  local format_dt_count
  format_dt_count=$(grep -rn --exclude-dir=node_modules 'function formatDateTime\|const formatDateTime\|export.*formatDateTime' \
    "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | wc -l || true)
  if (( format_dt_count > 1 )); then
    local extra=$(( format_dt_count - 1 ))
    deductions=$(( extra * 10 ))
    printf '  [DRY] -%d : %d duplicate formatDateTime definitions (expected 1)\n' "$deductions" "$format_dt_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Count duplicate unwrapApiData / extractList definitions
  local unwrap_count
  unwrap_count=$(grep -rn --exclude-dir=node_modules 'function unwrapApiData\|const unwrapApiData\|function extractList\|const extractList' \
    "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | wc -l || true)
  if (( unwrap_count > 1 )); then
    local extra=$(( unwrap_count - 1 ))
    deductions=$(( extra * 10 ))
    printf '  [DRY] -%d : %d duplicate unwrapApiData/extractList definitions (expected 1)\n' "$deductions" "$unwrap_count"
  fi
  score=$(( score - deductions ))

  record_dimension "DRY" "$score" 15
}

###############################################################################
# 3. Code Smells (10%)
###############################################################################
score_code_smells() {
  log "INFO" "Scoring: Code Smells"
  local score=100 deductions=0

  # Count eslint-disable comments
  local eslint_disable_count
  eslint_disable_count=$(grep -rn --exclude-dir=node_modules 'eslint-disable' \
    "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | wc -l || true)
  if (( eslint_disable_count > 0 )); then
    deductions=$(( eslint_disable_count * 2 ))
    printf '  [Code Smells] -%d : %d eslint-disable comments\n' "$deductions" "$eslint_disable_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Count raw console.* in app/components
  local console_count=0
  local console_app
  console_app=$(grep -rn --exclude-dir=node_modules 'console\.\(log\|warn\|error\|debug\|info\)' \
    "$OPS_ROOT/frontend/app/" "$OPS_ROOT/frontend/components/" \
    --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | wc -l || true)
  console_count=$console_app
  if (( console_count > 0 )); then
    deductions=$(( console_count ))
    printf '  [Code Smells] -%d : %d raw console.* calls in app/ and components/\n' "$deductions" "$console_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Count TODO / FIXME / HACK markers across frontend + backend
  local marker_count
  marker_count=$(grep -rn --exclude-dir=node_modules --exclude-dir=vendor 'TODO\|FIXME\|HACK' \
    "$OPS_ROOT/frontend/" "$OPS_ROOT/backend/" \
    --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' --include='*.go' \
    2>/dev/null | wc -l || true)
  if (( marker_count > 0 )); then
    deductions=$(( marker_count ))
    printf '  [Code Smells] -%d : %d TODO/FIXME/HACK markers\n' "$deductions" "$marker_count"
  fi
  score=$(( score - deductions ))

  record_dimension "Code Smells" "$score" 10
}

###############################################################################
# 4. Tests (20%)
###############################################################################
score_tests() {
  log "INFO" "Scoring: Tests"
  local score=100

  # --- Frontend test ratio (target: 80%) ---
  local fe_src_count=0 fe_test_count=0
  fe_src_count=$(find "$OPS_ROOT/frontend/app" "$OPS_ROOT/frontend/components" "$OPS_ROOT/frontend/lib" \
    -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) \
    ! -name '*.test.*' ! -name '*.spec.*' ! -path '*/node_modules/*' 2>/dev/null | wc -l || true)
  fe_test_count=$(find "$OPS_ROOT/frontend" \
    -type f \( -name '*.test.*' -o -name '*.spec.*' \) \
    ! -path '*/node_modules/*' 2>/dev/null | wc -l || true)

  local fe_ratio=0
  if (( fe_src_count > 0 )); then
    fe_ratio=$(( (fe_test_count * 100) / fe_src_count ))
  fi
  local fe_target=80
  local fe_deduction=0
  if (( fe_ratio < fe_target )); then
    fe_deduction=$(( (fe_target - fe_ratio) / 2 ))
  fi
  printf '  [Tests] Frontend: %d test files / %d source files = %d%% (target %d%%)\n' \
    "$fe_test_count" "$fe_src_count" "$fe_ratio" "$fe_target"
  if (( fe_deduction > 0 )); then
    printf '  [Tests] -%d : frontend test ratio below target\n' "$fe_deduction"
  fi

  # --- Backend test ratio (target: 30%) ---
  local be_src_count=0 be_test_count=0
  be_src_count=$(find "$OPS_ROOT/backend" \
    -type f -name '*.go' ! -name '*_test.go' ! -path '*/vendor/*' 2>/dev/null | wc -l || true)
  be_test_count=$(find "$OPS_ROOT/backend" \
    -type f -name '*_test.go' ! -path '*/vendor/*' 2>/dev/null | wc -l || true)

  local be_ratio=0
  if (( be_src_count > 0 )); then
    be_ratio=$(( (be_test_count * 100) / be_src_count ))
  fi
  local be_target=30
  local be_deduction=0
  if (( be_ratio < be_target )); then
    be_deduction=$(( (be_target - be_ratio) / 2 ))
  fi
  printf '  [Tests] Backend: %d test files / %d source files = %d%% (target %d%%)\n' \
    "$be_test_count" "$be_src_count" "$be_ratio" "$be_target"
  if (( be_deduction > 0 )); then
    printf '  [Tests] -%d : backend test ratio below target\n' "$be_deduction"
  fi

  score=$(( score - fe_deduction - be_deduction ))
  record_dimension "Tests" "$score" 20
}

###############################################################################
# 5. Accessibility (10%)
###############################################################################
score_accessibility() {
  log "INFO" "Scoring: Accessibility"
  local score=100 deductions=0

  # Check for placeholder / stub accessibility functions (e.g. aria-label="", role="")
  local placeholder_count
  placeholder_count=$(grep -rn --exclude-dir=node_modules 'aria-label=""\|aria-label=" "\|role=""' \
    "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | wc -l || true)
  if (( placeholder_count > 0 )); then
    deductions=$(( placeholder_count * 5 ))
    printf '  [Accessibility] -%d : %d placeholder/empty accessibility attributes\n' "$deductions" "$placeholder_count"
  fi
  score=$(( score - deductions ))
  deductions=0

  # Check images without alt text
  local img_no_alt_count
  img_no_alt_count=$(grep -rn --exclude-dir=node_modules '<img\b' \
    "$OPS_ROOT/frontend/" --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
    2>/dev/null | grep -v 'alt=' | wc -l || true)
  if (( img_no_alt_count > 0 )); then
    deductions=$(( img_no_alt_count * 5 ))
    printf '  [Accessibility] -%d : %d <img> tags without alt attribute\n' "$deductions" "$img_no_alt_count"
  fi
  score=$(( score - deductions ))

  record_dimension "Accessibility" "$score" 10
}

###############################################################################
# 6. Modularity (10%)
###############################################################################
score_modularity() {
  log "INFO" "Scoring: Modularity"
  local score=100 deductions=0
  local large_file_count=0
  local threshold=500

  while IFS= read -r file; do
    local lines
    lines=$(wc -l < "$file")
    if (( lines > threshold )); then
      large_file_count=$(( large_file_count + 1 ))
      printf '  [Modularity] %s : %d lines (> %d)\n' "${file#"$OPS_ROOT/"}" "$lines" "$threshold"
    fi
  done < <(find "$OPS_ROOT/frontend/app" "$OPS_ROOT/frontend/components" "$OPS_ROOT/frontend/lib" \
    -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) \
    ! -path '*/node_modules/*' 2>/dev/null || true)

  if (( large_file_count > 0 )); then
    deductions=$(( large_file_count * 5 ))
    printf '  [Modularity] -%d : %d frontend files exceed %d lines\n' "$deductions" "$large_file_count" "$threshold"
  fi
  score=$(( score - deductions ))

  record_dimension "Modularity" "$score" 10
}

###############################################################################
# 7. CI/CD (10%)
###############################################################################
score_cicd() {
  log "INFO" "Scoring: CI/CD"
  local score=100

  # Check ci.yml exists
  if [[ ! -f "$OPS_ROOT/.github/workflows/ci.yml" ]]; then
    score=$(( score - 30 ))
    printf '  [CI/CD] -30 : .github/workflows/ci.yml not found\n'
  else
    printf '  [CI/CD] OK : .github/workflows/ci.yml exists\n'
  fi

  # Check preflight-full.sh exists
  if [[ ! -f "$OPS_ROOT/ops/preflight-full.sh" ]]; then
    score=$(( score - 30 ))
    printf '  [CI/CD] -30 : ops/preflight-full.sh not found\n'
  else
    printf '  [CI/CD] OK : ops/preflight-full.sh exists\n'
  fi

  # Check preflight-full.sh is executable
  if [[ -f "$OPS_ROOT/ops/preflight-full.sh" && ! -x "$OPS_ROOT/ops/preflight-full.sh" ]]; then
    score=$(( score - 10 ))
    printf '  [CI/CD] -10 : ops/preflight-full.sh is not executable\n'
  fi

  record_dimension "CI/CD" "$score" 10
}

###############################################################################
# 8. Dependencies (5%)
###############################################################################
score_dependencies() {
  log "INFO" "Scoring: Dependencies"
  local score=100 deductions=0

  if [[ -f "$OPS_ROOT/frontend/package.json" ]]; then
    # Check next vs eslint-config-next version mismatch
    local next_ver eslint_next_ver
    next_ver=$(grep -o '"next"[[:space:]]*:[[:space:]]*"[^"]*"' "$OPS_ROOT/frontend/package.json" \
      | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)
    eslint_next_ver=$(grep -o '"eslint-config-next"[[:space:]]*:[[:space:]]*"[^"]*"' "$OPS_ROOT/frontend/package.json" \
      | head -1 | sed 's/.*"\([^"]*\)"$/\1/' || true)

    if [[ -n "$next_ver" && -n "$eslint_next_ver" && "$next_ver" != "$eslint_next_ver" ]]; then
      deductions=$(( deductions + 20 ))
      printf '  [Dependencies] -20 : next@%s vs eslint-config-next@%s version mismatch\n' "$next_ver" "$eslint_next_ver"
    else
      printf '  [Dependencies] OK : next and eslint-config-next versions aligned\n'
    fi

    # Count npm overrides
    local override_count
    override_count=$(grep -c '"overrides"' "$OPS_ROOT/frontend/package.json" 2>/dev/null || true)
    if (( override_count > 0 )); then
      # Count actual override entries inside the overrides block
      local override_entries
      override_entries=$(python3 -c "
import json, sys
try:
    with open('$OPS_ROOT/frontend/package.json') as f:
        pkg = json.load(f)
    overrides = pkg.get('overrides', {})
    print(len(overrides))
except Exception:
    print(0)
" 2>/dev/null || echo "0")
      if (( override_entries > 0 )); then
        local dep_ded=$(( override_entries * 5 ))
        deductions=$(( deductions + dep_ded ))
        printf '  [Dependencies] -%d : %d npm override(s) in package.json\n' "$dep_ded" "$override_entries"
      fi
    fi
  else
    printf '  [Dependencies] SKIP : frontend/package.json not found\n'
  fi

  score=$(( score - deductions ))
  record_dimension "Dependencies" "$score" 5
}

###############################################################################
# 9. Deprecation (5%)
###############################################################################
score_deprecation() {
  log "INFO" "Scoring: Deprecation"
  local score=100 deductions=0

  # Count "deprecated" / "DEPRECATED" markers in backend .go files
  local deprecated_count
  deprecated_count=$(grep -rn -i 'deprecated' \
    "$OPS_ROOT/backend/" --include='*.go' \
    2>/dev/null | grep -v vendor | wc -l || true)
  if (( deprecated_count > 0 )); then
    deductions=$(( deprecated_count * 3 ))
    printf '  [Deprecation] -%d : %d deprecated markers in backend .go files\n' "$deductions" "$deprecated_count"
  else
    printf '  [Deprecation] OK : no deprecated markers found in backend\n'
  fi

  score=$(( score - deductions ))
  record_dimension "Deprecation" "$score" 5
}

###############################################################################
# Run all dimensions
###############################################################################
printf '\n'
printf '=%.0s' {1..70}
printf '\n'
printf '  AIValid Repo Quality Score\n'
printf '=%.0s' {1..70}
printf '\n\n'

score_security
score_dry
score_code_smells
score_tests
score_accessibility
score_modularity
score_cicd
score_dependencies
score_deprecation

###############################################################################
# Summary table and weighted total
###############################################################################
printf '\n'
printf '=%.0s' {1..70}
printf '\n'
printf '%-20s %6s %8s %10s\n' "Dimension" "Score" "Weight" "Weighted"
printf -- '-%.0s' {1..70}
printf '\n'

weighted_total=0
for i in "${!DIM_NAMES[@]}"; do
  local_name="${DIM_NAMES[$i]}"
  local_score="${DIM_SCORES[$i]}"
  local_weight="${DIM_WEIGHTS[$i]}"
  local_weighted=$(( local_score * local_weight / 100 ))
  weighted_total=$(( weighted_total + local_weighted ))
  printf '%-20s %5d%% %7d%% %9d\n' "$local_name" "$local_score" "$local_weight" "$local_weighted"
done

printf -- '-%.0s' {1..70}
printf '\n'

# Clamp final score
if (( weighted_total < 0 )); then weighted_total=0; fi
if (( weighted_total > 100 )); then weighted_total=100; fi

# Star rating
stars=""
if (( weighted_total >= 90 )); then
  stars="*****"
elif (( weighted_total >= 75 )); then
  stars="****"
elif (( weighted_total >= 60 )); then
  stars="***"
elif (( weighted_total >= 40 )); then
  stars="**"
else
  stars="*"
fi

printf '\n  FINAL QUALITY SCORE: %d / 100  [%s]\n\n' "$weighted_total" "$stars"

log "INFO" "Quality score: $weighted_total/100 [$stars]"
log "INFO" "Full report saved to: $REPORT_FILE"
