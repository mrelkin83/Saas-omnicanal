#!/bin/bash
# Daily PostgreSQL backup — add to crontab:
# 0 2 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
#   POSTGRES_USER=saas POSTGRES_DB=saas_omnichannel \
#   /opt/scripts/backup-postgres.sh >> /var/log/pg-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-saas_omnichannel}"
PG_USER="${POSTGRES_USER:-saas}"
KEEP_DAYS="${KEEP_DAYS:-7}"
DOCKER="${DOCKER_BIN:-$(command -v docker 2>/dev/null || echo /usr/bin/docker)}"

# Find the postgres container by compose service label (works regardless of project name)
CONTAINER="${PG_CONTAINER:-$("$DOCKER" ps \
  --filter "label=com.docker.compose.service=postgres" \
  --filter "status=running" -q | head -1)}"

if [[ -z "$CONTAINER" ]]; then
  echo "[$(date -Iseconds)] ERROR: No se encontro el contenedor postgres. Asegurate de que este corriendo." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Iniciando backup de $DB_NAME (container: $CONTAINER)..."

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Dump dentro del container, comprimir en el host
"$DOCKER" exec "$CONTAINER" \
  pg_dump -U "$PG_USER" "$DB_NAME" \
  | gzip -9 > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup completado: $BACKUP_FILE ($SIZE)"

# Eliminar backups antiguos
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "[$(date -Iseconds)] Backups de mas de ${KEEP_DAYS} dias eliminados"
