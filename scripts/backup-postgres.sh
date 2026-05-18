#!/bin/bash
# Daily PostgreSQL backup — add to crontab:
# 0 2 * * * /opt/saas/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-saas_omnichannel}"
CONTAINER="${PG_CONTAINER:-$(docker ps --filter "ancestor=pgvector/pgvector:pg16" -q | head -1)}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup of $DB_NAME..."

# Dump inside container and compress on the fly
docker exec "$CONTAINER" \
  pg_dump -U "${POSTGRES_USER:-saas}" "$DB_NAME" \
  | gzip -9 > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup complete: $BACKUP_FILE ($SIZE)"

# Prune old backups
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "[$(date -Iseconds)] Pruned backups older than ${KEEP_DAYS} days"
