#!/usr/bin/env bash
# ============================================================
# migrate-neon.sh — Export Neon PG data → local PG18
# 
# Run this when Neon compute quota resets.
# Prerequisites: docker must be running with aivalid-postgres.
# ============================================================
set -euo pipefail

NEON_URL="${1:?Usage: $0 <neon-connection-string>}"
LOCAL_CONTAINER="aivalid-postgres"
LOCAL_DB="aivalid"
LOCAL_USER="aivalid"

echo "=== Step 1: Test Neon connection ==="
docker exec "$LOCAL_CONTAINER" psql "$NEON_URL" -c "SELECT count(*) FROM users;" || {
    echo "❌ Cannot connect to Neon. Is the compute active?"
    exit 1
}

echo "=== Step 2: Export from Neon ==="
DUMP_FILE="/tmp/neon_export_$(date +%Y%m%d_%H%M%S).sql"
docker exec "$LOCAL_CONTAINER" pg_dump "$NEON_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    -f "/tmp/neon_export.sql"

# Copy dump out of container
docker cp "$LOCAL_CONTAINER:/tmp/neon_export.sql" "$DUMP_FILE"
echo "Dump saved to: $DUMP_FILE ($(wc -c < "$DUMP_FILE") bytes)"

echo "=== Step 3: Import into local PG18 ==="
# Import with ON_ERROR_STOP to catch issues
docker exec -i "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" \
    -v ON_ERROR_STOP=0 < "$DUMP_FILE"

echo "=== Step 4: Verify ==="
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" -c "
SELECT 'users' as tbl, count(*) FROM users
UNION ALL SELECT 'admins', count(*) FROM admins
UNION ALL SELECT 'validation_cases', count(*) FROM validation_cases
UNION ALL SELECT 'sessions', count(*) FROM sessions
UNION ALL SELECT 'badges', count(*) FROM badges
UNION ALL SELECT 'tags', count(*) FROM tags
ORDER BY tbl;"

echo ""
echo "✅ Neon data migration complete!"
echo "⚠️  Remember to update backend/.env DATABASE_URL back to local PG if needed."
