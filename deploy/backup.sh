#!/usr/bin/env bash
# Nightly PostgreSQL backup for IPTDS, keeping the last 14 days.
# Install for the app user:   crontab -e   then add:
#   30 2 * * * /var/www/iptds/deploy/backup.sh >> /var/www/iptds/backups/backup.log 2>&1
# Restore:  gunzip -c backups/iptds-YYYYmmdd-HHMM.sql.gz | psql -h localhost -U iptds iptds
# Copy the backups folder off the server too (another machine or cloud storage).
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

set -a
# shellcheck disable=SC1091
source <(grep -E '^POSTGRES_' "$APP_DIR/backend/.env")
set +a

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/${POSTGRES_DB}-$(date +%Y%m%d-%H%M).sql.gz"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
  -U "$POSTGRES_USER" --no-owner "$POSTGRES_DB" | gzip > "$FILE"
find "$BACKUP_DIR" -name "${POSTGRES_DB}-*.sql.gz" -mtime "+$KEEP_DAYS" -delete
echo "$(date '+%F %T') backup written: $FILE ($(du -h "$FILE" | cut -f1))"
