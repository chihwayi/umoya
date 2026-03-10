#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-$ROOT_DIR/backups}"
mkdir -p "$OUTPUT_DIR"

DB_CONTAINER="${DOCKER_PG_CONTAINER:-medicore-postgres-master}"
DB_HOST="${DB_HOST:-${SERVICE_POSTGRES_HOST:-postgres-master}}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-${POSTGRES_USER:-postgres}}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-postgres}}"
TARGET_DB="${TARGET_DB:-${POSTGRES_DB:-medicore}}"
OUTPUT_FILE="$OUTPUT_DIR/${TARGET_DB}-${TIMESTAMP}.sql.gz"

if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "Creating backup from Docker container '$DB_CONTAINER'..."
  docker exec -e "PGPASSWORD=$DB_PASSWORD" "$DB_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$TARGET_DB" | gzip > "$OUTPUT_FILE"
else
  echo "Creating backup from PostgreSQL host '$DB_HOST'..."
  PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TARGET_DB" | gzip > "$OUTPUT_FILE"
fi

echo "Backup written to $OUTPUT_FILE"
