#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command curl

ENV_NAME="prod"
EXPECT_SHA=""
TIMEOUT_SECONDS="${OPS_HEALTH_TIMEOUT_SECONDS:-20}"

GO_HEALTH_URL="${GO_HEALTH_URL:-https://api.aivalid.id/health}"
GO_VERSION_URL="${GO_VERSION_URL:-https://api.aivalid.id/health/version}"
FEATURE_HEALTH_URL="${FEATURE_HEALTH_URL:-https://feature.aivalid.id/api/v1/health}"
FEATURE_VERSION_URL="${FEATURE_VERSION_URL:-https://feature.aivalid.id/api/v1/health/version}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_NAME="$2"
      shift 2
      ;;
    --expect-sha)
      EXPECT_SHA="$2"
      shift 2
      ;;
    --go-health-url)
      GO_HEALTH_URL="$2"
      shift 2
      ;;
    --go-version-url)
      GO_VERSION_URL="$2"
      shift 2
      ;;
    --feature-health-url)
      FEATURE_HEALTH_URL="$2"
      shift 2
      ;;
    --feature-version-url)
      FEATURE_VERSION_URL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

fetch_json() {
  local url="$1"
  curl -fsS --max-time "$TIMEOUT_SECONDS" "$url"
}

verify_sha_match() {
  local service_name="$1"
  local version_payload="$2"

  local live_sha
  live_sha="$(extract_json_field "git_sha" "$version_payload")"
  if [[ -z "$live_sha" ]]; then
    live_sha="$(extract_json_field "version" "$version_payload")"
  fi

  if [[ -z "$live_sha" ]]; then
    die "Cannot read SHA/version for $service_name from /health/version payload."
  fi

  log "INFO" "$service_name live sha/version: $live_sha"

  if [[ -n "$EXPECT_SHA" && "$live_sha" != "$EXPECT_SHA" ]]; then
    die "$service_name SHA mismatch. expected=$EXPECT_SHA live=$live_sha"
  fi
}

log "INFO" "Verifying live environment: $ENV_NAME"

run_step "go health" fetch_json "$GO_HEALTH_URL" >/dev/null
go_version_payload="$(fetch_json "$GO_VERSION_URL")"
run_step "go health/version payload" printf '%s\n' "$go_version_payload"
verify_sha_match "go-backend" "$go_version_payload"

run_step "feature-service health" fetch_json "$FEATURE_HEALTH_URL" >/dev/null
feature_version_payload="$(fetch_json "$FEATURE_VERSION_URL")"
run_step "feature-service health/version payload" printf '%s\n' "$feature_version_payload"
verify_sha_match "feature-service" "$feature_version_payload"

log "OK" "Live verification passed for environment $ENV_NAME"
