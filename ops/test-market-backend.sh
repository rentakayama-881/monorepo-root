#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command go

SCOPE="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

if [[ "$SCOPE" != "all" && "$SCOPE" != "services" && "$SCOPE" != "handlers" ]]; then
  die "Invalid --scope value: $SCOPE (allowed: all|services|handlers)"
fi

run_in_dir() {
  local dir="$1"
  shift
  (
    cd "$dir"
    "$@"
  )
}

ensure_report_dir
REPORT_FILE="$OPS_REPORT_DIR/test-market-backend-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$REPORT_FILE") 2>&1

MARKET_GOCACHE="${GOCACHE:-/tmp/aivalid-go-build-market}"
MARKET_GOTMPDIR="${GOTMPDIR:-/tmp/aivalid-go-tmp-market}"
MARKET_CGO_ENABLED="${CGO_ENABLED:-0}"

mkdir -p "$MARKET_GOCACHE" "$MARKET_GOTMPDIR"

log "INFO" "Running targeted market backend verification (scope=$SCOPE)"
log "INFO" "Report file: $REPORT_FILE"
log "INFO" "GOCACHE=$MARKET_GOCACHE"
log "INFO" "GOTMPDIR=$MARKET_GOTMPDIR"
log "INFO" "CGO_ENABLED=$MARKET_CGO_ENABLED"
log "INFO" "Note: handler tests use httptest local servers and require loopback access."

if [[ "$SCOPE" == "all" || "$SCOPE" == "services" ]]; then
  run_step "backend/services: market client tests" \
    run_in_dir "$OPS_ROOT/backend/services" \
    env GOCACHE="$MARKET_GOCACHE" GOTMPDIR="$MARKET_GOTMPDIR" CGO_ENABLED="$MARKET_CGO_ENABLED" \
      go test -count=1 \
      -run '^TestLZTMarketClient_' \
      -timeout 60s \
      .
fi

if [[ "$SCOPE" == "all" || "$SCOPE" == "handlers" ]]; then
  run_step "backend/handlers: market handler tests" \
    run_in_dir "$OPS_ROOT/backend/handlers" \
    env GOCACHE="$MARKET_GOCACHE" GOTMPDIR="$MARKET_GOTMPDIR" CGO_ENABLED="$MARKET_CGO_ENABLED" \
      go test -count=1 \
      -run 'Test(GetPublicChatGPTCheckout|FetchChatGPTListing|ResolveOrderItemForCheckout|CacheChatGPTListing_ReturnsClonedPayload|LoadChatGPTListing_UsesSingleFlightForConcurrentRefresh)' \
      -timeout 120s \
      .
fi

log "OK" "Targeted market backend verification passed (scope=$SCOPE)"
