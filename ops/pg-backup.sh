#!/usr/bin/env bash
# ============================================================
# pg-backup.sh — Daily PostgreSQL backup with rotation
# Cron: 0 3 * * * /home/x/monorepo-root/ops/pg-backup.sh
# ============================================================
set -euo pipefail

BACKUP_DIR="/home/x/monorepo-root/backups/postgresql"
CONTAINER="aivalid-postgres"
DB="aivalid"
USER="aivalid"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB}_${TIMESTAMP}.sql.gz"

# Dump and compress
docker exec "$CONTAINER" pg_dump -U "$USER" -d "$DB" --no-owner --no-privileges | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "$(date -Iseconds) Backup created: $BACKUP_FILE ($SIZE)"

# Rotate old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "*.sql.gz" | wc -l)
echo "$(date -Iseconds) Backups retained: $REMAINING (max age: ${RETENTION_DAYS}d)"
