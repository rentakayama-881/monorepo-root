#!/usr/bin/env bash

set -euo pipefail

# MongoDB restore from backup
# Usage: ops/db-restore.sh [--drop] <backup-dir>
# Example: ops/db-restore.sh /opt/alephdraad/backups/mongodb/20260320T020000Z

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
MONGODB_URI="${MONGODB__CONNECTIONSTRING:-mongodb://127.0.0.1:27017}"
MONGODB_DB="${MONGODB__DATABASENAME:-feature_service_db}"
DROP_FLAG=0
BACKUP_DIR=""

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --drop)
      DROP_FLAG=1
      shift
      ;;
    -*)
      die "Unknown option: $1"
      ;;
    *)
      if [[ -z "$BACKUP_DIR" ]]; then
        BACKUP_DIR="$1"
      else
        die "Unexpected argument: $1 (backup dir already set to $BACKUP_DIR)"
      fi
      shift
      ;;
  esac
done

if [[ -z "$BACKUP_DIR" ]]; then
  die "Usage: $(basename "$0") [--drop] <backup-dir>"
fi

# ---------------------------------------------------------------------------
# Load .env from feature-service if it exists
# ---------------------------------------------------------------------------
FEATURE_ENV="$OPS_ROOT/feature-service/.env"
if [[ -f "$FEATURE_ENV" ]]; then
  log "INFO" "Loading environment from $FEATURE_ENV"
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    case "$key" in
      MONGODB__CONNECTIONSTRING)
        MONGODB_URI="${MONGODB_URI:-$value}"
        ;;
      MONGODB__DATABASENAME)
        MONGODB_DB="${MONGODB_DB:-$value}"
        ;;
    esac
  done < "$FEATURE_ENV"
fi

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
RESTORE_PATH="$BACKUP_DIR/$MONGODB_DB"
if [[ ! -d "$RESTORE_PATH" ]]; then
  die "Restore path not found: $RESTORE_PATH"
fi

ensure_command mongorestore

# ---------------------------------------------------------------------------
# Confirmation
# ---------------------------------------------------------------------------
log "INFO" "=== MongoDB Restore ==="
log "INFO" "Database    : $MONGODB_DB"
log "INFO" "Restore from: $RESTORE_PATH"
log "INFO" "Drop first  : $DROP_FLAG"

echo ""
echo "⚠  This will restore database '$MONGODB_DB' from:"
echo "   $RESTORE_PATH"
if [[ "$DROP_FLAG" -eq 1 ]]; then
  echo "   WARNING: --drop is set — existing collections will be dropped first!"
fi
echo ""
read -rp "Continue? [y/N] " confirm
case "$confirm" in
  [yY]|[yY][eE][sS]) ;;
  *)
    log "INFO" "Restore cancelled by user"
    exit 0
    ;;
esac

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------
do_restore() {
  local args=(
    --uri="$MONGODB_URI"
    --db="$MONGODB_DB"
    --gzip
  )

  if [[ "$DROP_FLAG" -eq 1 ]]; then
    args+=(--drop)
  fi

  args+=("$RESTORE_PATH")

  mongorestore "${args[@]}"
}

run_step "Restore database" do_restore

log "INFO" "=== Restore finished successfully ==="
