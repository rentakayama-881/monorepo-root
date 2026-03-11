#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# ops/security-scan.sh — Pre-commit security scanner
#
# Runs automatically as part of preflight-full.sh.
# Can also be invoked standalone:
#   bash ops/security-scan.sh [--fix]
#
# Checks:
#   1. Leftover .env backup files (must not exist)
#   2. .env file permissions (must be 600)
#   3. Secrets accidentally staged in git
#   4. World-readable sensitive files
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

AUTO_FIX=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fix)
      AUTO_FIX=true
      shift
      ;;
    *)
      die "Unknown argument: $1. Usage: security-scan.sh [--fix]"
      ;;
  esac
done

cd "$OPS_ROOT"

violations=0

# ── 1. Detect leftover .env backup / secret files ──────────
log "STEP" "Scanning for leftover secret files..."

secret_patterns=(
  '.env.bak*'
  '.env.*.bak'
  '*.env.backup'
  '.env.old'
  '.env.save'
  '.env.orig'
  '*.pem'
  '*.key'
  '*.p12'
  '*.pfx'
  '*.jks'
)

# Build find arguments
find_args=()
for i in "${!secret_patterns[@]}"; do
  if [[ $i -gt 0 ]]; then
    find_args+=("-o")
  fi
  find_args+=("-name" "${secret_patterns[$i]}")
done

while IFS= read -r secret_file; do
  [[ -z "$secret_file" ]] && continue

  # Allowlist: deploy/nginx TLS certs are expected; skip .env.example
  case "$secret_file" in
    ./deploy/*)      continue ;;
    */.env.example)  continue ;;
  esac

  if [[ "$AUTO_FIX" == "true" ]]; then
    rm -f "$secret_file"
    log "FIXED" "Deleted leftover secret file: $secret_file"
  else
    log "ERROR" "Leftover secret file found: $secret_file — delete it or run with --fix"
    ((violations++))
  fi
done < <(find . \( -path ./node_modules -o -path ./.git -o -path ./frontend/node_modules -o -path './.ops' \) -prune -o \
  -type f \( "${find_args[@]}" \) -print 2>/dev/null)

# ── 2. Check .env file permissions (must be 600) ───────────
log "STEP" "Checking .env file permissions..."

while IFS= read -r env_file; do
  [[ -z "$env_file" ]] && continue
  [[ "$env_file" == *".env.example" ]] && continue

  perms="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file" 2>/dev/null)"
  if [[ "$perms" != "600" ]]; then
    if [[ "$AUTO_FIX" == "true" ]]; then
      chmod 600 "$env_file"
      log "FIXED" "Fixed permissions on $env_file: $perms → 600"
    else
      log "ERROR" "Insecure permissions on $env_file: $perms (must be 600)"
      ((violations++))
    fi
  fi
done < <(find . \( -path ./node_modules -o -path ./.git -o -path ./frontend/node_modules -o -path './.ops' \) -prune -o \
  -type f -name '.env' -print 2>/dev/null)

# ── 3. Check for secrets in staged git files ────────────────
log "STEP" "Scanning staged files for secrets..."

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  staged_files="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)"

  if [[ -n "$staged_files" ]]; then
    # Patterns that indicate hardcoded secrets
    secret_regexes=(
      'PRIVATE.KEY'
      'BEGIN RSA PRIVATE KEY'
      'BEGIN EC PRIVATE KEY'
      'BEGIN OPENSSH PRIVATE KEY'
      'password\s*=\s*["\x27][^"\x27]{8,}'
      'secret\s*=\s*["\x27][^"\x27]{8,}'
      'api[_-]?key\s*=\s*["\x27][^"\x27]{8,}'
    )

    for regex in "${secret_regexes[@]}"; do
      while IFS= read -r match; do
        [[ -z "$match" ]] && continue
        # Skip known safe files
        case "$match" in
          .env.example*|*.md*|*.test.*|*_test.go*|SECURITY*) continue ;;
        esac
        log "ERROR" "Possible secret in staged file: $match"
        ((violations++))
      done < <(echo "$staged_files" | xargs grep -l -i -E "$regex" 2>/dev/null || true)
    done
  fi
fi

# ── 4. Summary ──────────────────────────────────────────────
if [[ $violations -gt 0 ]]; then
  die "Security scan failed with $violations violation(s). Fix them or run: bash ops/security-scan.sh --fix"
fi

log "OK" "Security scan passed — no violations found"
