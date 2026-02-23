#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command curl

ENV_NAME="prod"
EXPECT_SHA=""
TIMEOUT_SECONDS="${OPS_HEALTH_TIMEOUT_SECONDS:-20}"
RETRY_ATTEMPTS="${OPS_HEALTH_RETRY_ATTEMPTS:-12}"
RETRY_INTERVAL_SECONDS="${OPS_HEALTH_RETRY_INTERVAL_SECONDS:-5}"

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
    --retries)
      RETRY_ATTEMPTS="$2"
      shift 2
      ;;
    --retry-interval)
      RETRY_INTERVAL_SECONDS="$2"
      shift 2
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

if ! [[ "$RETRY_ATTEMPTS" =~ ^[0-9]+$ ]] || [[ "$RETRY_ATTEMPTS" -lt 1 ]]; then
  die "Invalid retries value: $RETRY_ATTEMPTS"
fi

if ! [[ "$RETRY_INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [[ "$RETRY_INTERVAL_SECONDS" -lt 1 ]]; then
  die "Invalid retry interval value: $RETRY_INTERVAL_SECONDS"
fi

fetch_json_once() {
  local url="$1"
  curl -fsS --max-time "$TIMEOUT_SECONDS" "$url"
}

fetch_json_with_retry() {
  local url="$1"
  local label="$2"
  local attempt=1
  local tmp_err
  tmp_err="$(mktemp)"

  while (( attempt <= RETRY_ATTEMPTS )); do
    if fetch_json_once "$url" 2>"$tmp_err"; then
      rm -f "$tmp_err"
      return 0
    fi

    local err_msg
    err_msg="$(tr '\n' ' ' <"$tmp_err" | sed -E 's/[[:space:]]+/ /g; s/[[:space:]]+$//')"
    if [[ -z "$err_msg" ]]; then
      err_msg="request failed"
    fi

    if (( attempt < RETRY_ATTEMPTS )); then
      log "WARN" "$label not ready (attempt $attempt/$RETRY_ATTEMPTS): $err_msg. Retrying in ${RETRY_INTERVAL_SECONDS}s."
      sleep "$RETRY_INTERVAL_SECONDS"
    else
      log "ERROR" "$label failed after $RETRY_ATTEMPTS attempts: $err_msg"
      rm -f "$tmp_err"
      return 1
    fi

    attempt=$((attempt + 1))
  done

  rm -f "$tmp_err"
}

verify_sha_match() {
  local service_name="$1"
  local version_payload="$2"

  local live_sha
  live_sha="$(extract_json_field "git_sha" "$version_payload")"
  if [[ -z "$live_sha" ]]; then
    live_sha="$(extract_json_field "gitSha" "$version_payload")"
  fi
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

run_step "go health" fetch_json_with_retry "$GO_HEALTH_URL" "go health" >/dev/null
go_version_payload="$(fetch_json_with_retry "$GO_VERSION_URL" "go health/version")"
run_step "go health/version payload" printf '%s\n' "$go_version_payload"
verify_sha_match "go-backend" "$go_version_payload"

run_step "feature-service health" fetch_json_with_retry "$FEATURE_HEALTH_URL" "feature-service health" >/dev/null
feature_version_payload="$(fetch_json_with_retry "$FEATURE_VERSION_URL" "feature-service health/version")"
run_step "feature-service health/version payload" printf '%s\n' "$feature_version_payload"
verify_sha_match "feature-service" "$feature_version_payload"

log "OK" "Live verification passed for environment $ENV_NAME"
