#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

check_service() {
  local svc="$1"
  local state
  state="$(systemctl is-active "$svc" || true)"
  if [ "$state" = "active" ]; then
    log "OK service: $svc is active"
    return 0
  fi
  log "FAIL service: $svc state=$state"
  return 1
}

check_url() {
  local label="$1"
  local url="$2"
  local host_header="$3"
  local attempts="${4:-30}"

  local i
  for i in $(seq 1 "$attempts"); do
    if curl -kfsS -H "$host_header" "$url" >/dev/null; then
      log "OK health: $label"
      return 0
    fi
    sleep 2
  done

  log "FAIL health: $label url=$url"
  return 1
}

main() {
  local failed=0

  log "Starting post-reboot checks"

  for svc in \
    alephdraad-firewall.service \
    docker.service \
    nginx.service \
    alephdraad-backend.service \
    feature-service.service; do
    check_service "$svc" || failed=1
  done

  check_url "api.aivalid.id /api/health" \
    "https://127.0.0.1/api/health" \
    "Host: api.aivalid.id" || failed=1

  check_url "feature.aivalid.id /api/v1/health" \
    "https://127.0.0.1/api/v1/health" \
    "Host: feature.aivalid.id" || failed=1

  if [ "$failed" -ne 0 ]; then
    log "RESULT: FAIL"
    exit 1
  fi

  log "RESULT: PASS"
}

main "$@"
