#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command git
ensure_command go
ensure_command dotnet
ensure_command npm

run_in_dir() {
  local dir="$1"
  shift
  (
    cd "$dir"
    "$@"
  )
}

ensure_report_dir
REPORT_FILE="$OPS_REPORT_DIR/preflight-full-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$REPORT_FILE") 2>&1

export CI=1

api_base_url="${API_BASE_URL:-https://api.aivalid.id}"
next_public_api_base_url="${NEXT_PUBLIC_API_BASE_URL:-$api_base_url}"
next_public_backend_url="${NEXT_PUBLIC_BACKEND_URL:-$api_base_url}"

log "INFO" "Running full monorepo preflight gates"
log "INFO" "Report file: $REPORT_FILE"

run_step "backend: go vet" run_in_dir "$OPS_ROOT/backend" go vet ./...
run_step "backend: go test -v ./..." run_in_dir "$OPS_ROOT/backend" go test -v ./...

run_step "feature-service: dotnet build -c Release" \
  run_in_dir "$OPS_ROOT/feature-service" dotnet build -c Release src/FeatureService.Api/FeatureService.Api.csproj --nologo
run_step "feature-service: dotnet test -c Release" \
  run_in_dir "$OPS_ROOT/feature-service" dotnet test -c Release --nologo

run_step "frontend: npm ci --no-audit" run_in_dir "$OPS_ROOT/frontend" npm ci --no-audit
run_step "frontend: npm run lint" run_in_dir "$OPS_ROOT/frontend" npm run lint
run_step "frontend: npm run typecheck" run_in_dir "$OPS_ROOT/frontend" npm run typecheck
run_step "frontend: npm test -- --ci --runInBand --forceExit" \
  run_in_dir "$OPS_ROOT/frontend" npm test -- --ci --runInBand --forceExit
run_step "frontend: npm run build (prebuild check relaxed for CI portability)" \
  env PREBUILD_HEALTHCHECK_STRICT=false \
      SKIP_PREBUILD_CHECK=1 \
      API_BASE_URL="$api_base_url" \
      NEXT_PUBLIC_API_BASE_URL="$next_public_api_base_url" \
      NEXT_PUBLIC_BACKEND_URL="$next_public_backend_url" \
      bash -c "cd \"$OPS_ROOT/frontend\" && npm run build"
run_step "frontend: npm run audit:prod" \
  run_in_dir "$OPS_ROOT/frontend" npm run audit:prod

log "OK" "All full preflight gates passed"
