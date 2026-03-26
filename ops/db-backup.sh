#!/usr/bin/env bash

set -euo pipefail

# MongoDB backup script with compression and rotation
# Usage: ops/db-backup.sh [--dry-run] [--retention-days N]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# ---------------------------------------------------------------------------
# Defaults (overridable via environment)
# ---------------------------------------------------------------------------
MONGODB_URI=""
MONGODB_DB=""
BACKUP_BASE="${BACKUP_BASE:-/opt/alephdraad/backups/mongodb}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_MIN_SIZE_BYTES="${BACKUP_MIN_SIZE_BYTES:-1024}"   # 1 KB

DRY_RUN=0

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --retention-days)
      BACKUP_RETENTION_DAYS="$2"
      shift 2
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Load .env from feature-service if it exists (pick up MONGODB vars)
# ---------------------------------------------------------------------------
FEATURE_ENV="$OPS_ROOT/feature-service/.env"
if [[ -f "$FEATURE_ENV" ]]; then
  log "INFO" "Loading environment from $FEATURE_ENV"
  # Export only MONGODB__ vars; skip comments and blank lines
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    case "$key" in
      MONGODB__CONNECTIONSTRING)
        MONGODB_URI="$value"
        ;;
      MONGODB__DATABASENAME)
        MONGODB_DB="$value"
        ;;
    esac
  done < "$FEATURE_ENV"
fi

# Fallback defaults if .env didn't provide values
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017}"
MONGODB_DB="${MONGODB_DB:-FeatureServiceDb}"

# ---------------------------------------------------------------------------
# Derived paths
# ---------------------------------------------------------------------------
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
BACKUP_DIR="$BACKUP_BASE/$TIMESTAMP"

log "INFO" "=== MongoDB Backup ==="
log "INFO" "Database   : $MONGODB_DB"
log "INFO" "Backup dir : $BACKUP_DIR"
log "INFO" "Retention  : $BACKUP_RETENTION_DAYS days"
log "INFO" "Dry run    : $DRY_RUN"

# ---------------------------------------------------------------------------
# Step 1 — Create backup
# ---------------------------------------------------------------------------
do_backup() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN" "Would run: mongodump --uri=<uri> --db=$MONGODB_DB --gzip --out=$BACKUP_DIR"
    return 0
  fi

  ensure_command mongodump
  mkdir -p "$BACKUP_DIR"

  mongodump \
    --uri="$MONGODB_URI" \
    --db="$MONGODB_DB" \
    --gzip \
    --out="$BACKUP_DIR"
}

run_step "Create backup" do_backup

# ---------------------------------------------------------------------------
# Step 2 — Verify backup
# ---------------------------------------------------------------------------
verify_backup() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN" "Would verify backup size in $BACKUP_DIR/$MONGODB_DB"
    return 0
  fi

  local db_dir="$BACKUP_DIR/$MONGODB_DB"
  if [[ ! -d "$db_dir" ]]; then
    die "Backup directory not found: $db_dir"
  fi

  local total_size
  total_size="$(du -sb "$db_dir" | awk '{print $1}')"

  if [[ "$total_size" -lt "$BACKUP_MIN_SIZE_BYTES" ]]; then
    die "Backup too small (${total_size} bytes < ${BACKUP_MIN_SIZE_BYTES} bytes). Backup may be corrupt."
  fi

  log "INFO" "Backup verified: ${total_size} bytes in $db_dir"
}

run_step "Verify backup" verify_backup

# ---------------------------------------------------------------------------
# Step 3 — Rotate old backups
# ---------------------------------------------------------------------------
rotate_old_backups() {
  if [[ ! -d "$BACKUP_BASE" ]]; then
    log "INFO" "No backup base directory yet — nothing to rotate"
    return 0
  fi

  local count=0
  while IFS= read -r -d '' old_dir; do
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "DRY-RUN" "Would delete old backup: $old_dir"
    else
      log "INFO" "Deleting old backup: $old_dir"
      rm -rf "$old_dir"
    fi
    (( count++ )) || true
  done < <(find "$BACKUP_BASE" -mindepth 1 -maxdepth 1 -type d -mtime +"$BACKUP_RETENTION_DAYS" -print0)

  log "INFO" "Rotation complete — $count backup(s) eligible for deletion"
}

run_step "Rotate old backups" rotate_old_backups

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
log "INFO" "=== Backup finished successfully ==="
