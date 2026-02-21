#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

ensure_command git
ensure_command go
ensure_command dotnet
ensure_command curl

TARGET_REF=""
REPO_DIR="${OPS_REPO_DIR:-$OPS_ROOT}"
BACKUP_ROOT="${OPS_BACKUP_ROOT:-/opt/alephdraad/backups}"
BACKEND_BINARY_PATH="${BACKEND_BINARY_PATH:-/opt/alephdraad/backend/app}"
FEATURE_DEPLOY_DIR="${FEATURE_DEPLOY_DIR:-/opt/alephdraad/feature-service}"
BACKEND_SYSTEMD_UNITS="${BACKEND_SYSTEMD_UNITS:-alephdraad-backend.service backend.service aivalid-backend}"
FEATURE_SYSTEMD_UNITS="${FEATURE_SYSTEMD_UNITS:-feature-service.service featureservice.service feature-service}"
DEPLOY_ENV="prod"
DEPLOY_BACKEND=1
DEPLOY_FEATURE=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      TARGET_REF="$2"
      shift 2
      ;;
    --repo-dir)
      REPO_DIR="$2"
      shift 2
      ;;
    --env)
      DEPLOY_ENV="$2"
      shift 2
      ;;
    --no-backend)
      DEPLOY_BACKEND=0
      shift
      ;;
    --no-feature)
      DEPLOY_FEATURE=0
      shift
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

if [[ -z "$TARGET_REF" ]]; then
  die "Missing required argument: --ref <sha-or-ref>"
fi

if [[ "$DEPLOY_BACKEND" -eq 0 && "$DEPLOY_FEATURE" -eq 0 ]]; then
  die "Nothing to deploy. Remove --no-backend/--no-feature combination."
fi

[[ -d "$REPO_DIR/.git" ]] || die "Repository not found at: $REPO_DIR"

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

resolve_target_sha() {
  git -C "$REPO_DIR" fetch --prune origin
  if git -C "$REPO_DIR" rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1; then
    git -C "$REPO_DIR" rev-parse --verify "${TARGET_REF}^{commit}"
    return 0
  fi

  git -C "$REPO_DIR" fetch origin "$TARGET_REF"
  git -C "$REPO_DIR" rev-parse --verify FETCH_HEAD
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

target_sha="$(resolve_target_sha)"
target_short_sha="${target_sha:0:12}"
deploy_started_at="$(timestamp_utc)"
build_time_utc="$(timestamp_utc)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$BACKUP_ROOT/$stamp-$target_short_sha"
tmp_dir="/tmp/aivalid-deploy-$stamp-$$"

log "INFO" "Deploy env: $DEPLOY_ENV"
log "INFO" "Repository: $REPO_DIR"
log "INFO" "Target SHA: $target_sha"

run_as_root mkdir -p "$backup_dir"
mkdir -p "$tmp_dir"
trap 'rm -rf "$tmp_dir"' EXIT

if [[ -n "$(git -C "$REPO_DIR" status --porcelain)" ]]; then
  die "Repository has local changes at $REPO_DIR. Commit/stash before deploy."
fi

run_step "checkout target sha" bash -c "
  set -euo pipefail
  git -C \"$REPO_DIR\" checkout --quiet main
  git -C \"$REPO_DIR\" reset --hard \"$target_sha\"
"

if [[ "$DEPLOY_BACKEND" -eq 1 ]]; then
  backend_backup="$backup_dir/backend-app.bak"

  run_step "build backend binary" bash -c "
    set -euo pipefail
    cd \"$REPO_DIR/backend\"
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
      -ldflags '-s -w -X backend-gin/buildinfo.Version=$target_sha' \
      -o '$tmp_dir/backend-app' .
  "

  run_as_root mkdir -p "$(dirname "$BACKEND_BINARY_PATH")"
  if run_as_root test -f "$BACKEND_BINARY_PATH"; then
    run_step "backup backend binary" run_as_root cp "$BACKEND_BINARY_PATH" "$backend_backup"
  fi

  run_step "install backend binary" run_as_root install -m 0755 "$tmp_dir/backend-app" "$BACKEND_BINARY_PATH"
fi

if [[ "$DEPLOY_FEATURE" -eq 1 ]]; then
  feature_backup_dir="$backup_dir/feature-service"

  run_step "publish feature-service" bash -c "
    set -euo pipefail
    cd \"$REPO_DIR/feature-service/src/FeatureService.Api\"
    GIT_SHA='$target_sha' BUILD_TIME_UTC='$build_time_utc' dotnet publish -c Release \
      -o '$tmp_dir/feature-publish' --self-contained false \
      -p:InformationalVersion='$target_sha' \
      -p:SourceRevisionId='$target_sha'
  "

  run_as_root mkdir -p "$FEATURE_DEPLOY_DIR"
  run_step "backup feature-service artifacts" run_as_root cp -a "$FEATURE_DEPLOY_DIR" "$feature_backup_dir"
  run_step "sync feature-service artifacts" copy_tree "$tmp_dir/feature-publish" "$FEATURE_DEPLOY_DIR"
fi

if [[ "$DEPLOY_BACKEND" -eq 1 ]]; then
  run_step "restart backend unit" restart_first_available_unit "$BACKEND_SYSTEMD_UNITS" || die "Cannot restart backend systemd unit."
fi

if [[ "$DEPLOY_FEATURE" -eq 1 ]]; then
  run_step "restart feature-service unit" restart_first_available_unit "$FEATURE_SYSTEMD_UNITS" || die "Cannot restart feature-service systemd unit."
fi

GO_HEALTH_URL="http://127.0.0.1:8080/health" \
GO_VERSION_URL="http://127.0.0.1:8080/health/version" \
FEATURE_HEALTH_URL="http://127.0.0.1:5000/api/v1/health" \
FEATURE_VERSION_URL="http://127.0.0.1:5000/api/v1/health/version" \
run_step "verify live sha" "$REPO_DIR/ops/verify-live.sh" --env "$DEPLOY_ENV" --expect-sha "$target_sha"

cat <<EOF
Deploy completed.
environment: $DEPLOY_ENV
target_sha: $target_sha
started_at_utc: $deploy_started_at
finished_at_utc: $(timestamp_utc)
backup_dir: $backup_dir
EOF
