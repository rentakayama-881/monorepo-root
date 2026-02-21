#!/usr/bin/env bash

set -euo pipefail

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is a shared library and must be sourced, not executed directly." >&2
  exit 1
fi

OPS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPS_REPORT_DIR="${OPS_REPORT_DIR:-$OPS_ROOT/.ops/reports}"

timestamp_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  local level="$1"
  shift
  printf '%s [%s] %s\n' "$(timestamp_utc)" "$level" "$*" >&2
}

die() {
  log "ERROR" "$*"
  exit 1
}

ensure_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
}

ensure_report_dir() {
  mkdir -p "$OPS_REPORT_DIR"
}

run_step() {
  local label="$1"
  shift
  log "STEP" "$label"
  "$@"
  log "OK" "$label"
}

extract_json_field() {
  local field="$1"
  local payload="$2"

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$payload" | jq -r --arg field "$field" '.[$field] // empty'
    return 0
  fi

  # Fallback parser for flat JSON fields like {"git_sha":"..."}.
  printf '%s' "$payload" | sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p"
}
