#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command curl

BACKUP_DIR=""
DEPLOY_ENV="prod"
BACKEND_BINARY_PATH="${BACKEND_BINARY_PATH:-/opt/alephdraad/backend/app}"
FEATURE_DEPLOY_DIR="${FEATURE_DEPLOY_DIR:-/opt/alephdraad/feature-service}"
BACKEND_SYSTEMD_UNITS="${BACKEND_SYSTEMD_UNITS:-alephdraad-backend.service backend.service aivalid-backend}"
FEATURE_SYSTEMD_UNITS="${FEATURE_SYSTEMD_UNITS:-feature-service.service featureservice.service feature-service}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    --env)
      DEPLOY_ENV="$2"
      shift 2
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$BACKUP_DIR" ]] || die "Missing required argument: --backup-dir <path>"
[[ -d "$BACKUP_DIR" ]] || die "Backup directory not found: $BACKUP_DIR"

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  "$@"
}

restart_first_available_unit() {
  local unit_list="$1"
  local unit
  for unit in $unit_list; do
    if run_as_root systemctl restart "$unit" >/dev/null 2>&1; then
      if run_as_root systemctl is-active --quiet "$unit"; then
        log "OK" "Service restarted: $unit"
        return 0
      fi
    fi
  done
  return 1
}

copy_tree() {
  local source_dir="$1"
  local target_dir="$2"

  if command -v rsync >/dev/null 2>&1; then
    run_as_root rsync -a --delete "${source_dir}/" "${target_dir}/"
  else
    run_as_root mkdir -p "$target_dir"
    run_as_root find "$target_dir" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    run_as_root cp -a "${source_dir}/." "$target_dir/"
  fi
}

backend_backup="$BACKUP_DIR/backend-app.bak"
feature_backup="$BACKUP_DIR/feature-service"

if [[ -f "$backend_backup" ]]; then
  run_step "restore backend binary" run_as_root install -m 0755 "$backend_backup" "$BACKEND_BINARY_PATH"
fi

if [[ -d "$feature_backup" ]]; then
  run_as_root mkdir -p "$FEATURE_DEPLOY_DIR"
  run_step "restore feature-service artifacts" copy_tree "$feature_backup" "$FEATURE_DEPLOY_DIR"
fi

run_step "restart backend" restart_first_available_unit "$BACKEND_SYSTEMD_UNITS" || die "Cannot restart backend systemd unit."
run_step "restart feature-service" restart_first_available_unit "$FEATURE_SYSTEMD_UNITS" || die "Cannot restart feature-service systemd unit."

GO_HEALTH_URL="http://127.0.0.1:8080/health" \
GO_VERSION_URL="http://127.0.0.1:8080/health/version" \
FEATURE_HEALTH_URL="http://127.0.0.1:5000/api/v1/health" \
FEATURE_VERSION_URL="http://127.0.0.1:5000/api/v1/health/version" \
run_step "post-rollback verification" "$OPS_ROOT/ops/verify-live.sh" --env "$DEPLOY_ENV"

log "OK" "Rollback completed from backup: $BACKUP_DIR"
