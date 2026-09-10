#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Parse .env as plain KEY=VALUE data rather than `source`-ing it — `source`
# executes the file as shell script and crashes on any value containing
# shell metacharacters (#, $, backticks, redirection), which real secrets
# and URLs routinely contain.
if [ -f "$ROOT_DIR/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    case "$line" in
      ''|'#'*) continue ;;
    esac
    case "$line" in
      export\ *) line="${line#export }" ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    case "$value" in
      \"*\") value="${value#\"}"; value="${value%\"}" ;;
      \'*\') value="${value#\'}"; value="${value%\'}" ;;
    esac
    [ -n "$key" ] && export "$key=$value"
  done < "$ROOT_DIR/.env"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-$ROOT_DIR/backups}/$TIMESTAMP"
mkdir -p "$OUTPUT_DIR"

DB_CONTAINER="${DOCKER_PG_CONTAINER:-umoya-postgres-master}"
DB_HOST="${DB_HOST:-${SERVICE_POSTGRES_HOST:-postgres-master}}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-${POSTGRES_USER:-postgres}}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-postgres}}"
MASTER_DB="${TARGET_DB:-${POSTGRES_DB:-umoya}}"
USE_DOCKER=0
if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  USE_DOCKER=1
fi

dump_database() {
  local db_name="$1"
  local out_file="$OUTPUT_DIR/${db_name}.sql.gz"
  if [ "$USE_DOCKER" = "1" ]; then
    docker exec -e "PGPASSWORD=$DB_PASSWORD" "$DB_CONTAINER" \
      pg_dump -U "$DB_USER" -d "$db_name" | gzip > "$out_file"
  else
    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" | gzip > "$out_file"
  fi
  echo "  -> $out_file ($(du -h "$out_file" | cut -f1))"
}

list_tenant_databases() {
  if [ "$USE_DOCKER" = "1" ]; then
    docker exec -e "PGPASSWORD=$DB_PASSWORD" "$DB_CONTAINER" \
      psql -U "$DB_USER" -d postgres -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'clinic\_%' ORDER BY datname;"
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
      "SELECT datname FROM pg_database WHERE datname LIKE 'clinic\_%' ORDER BY datname;"
  fi
}

echo "Backing up master/control-plane database ('$MASTER_DB')..."
dump_database "$MASTER_DB"

echo "Discovering tenant databases..."
TENANT_DBS="$(list_tenant_databases)"
if [ -z "$TENANT_DBS" ]; then
  echo "WARNING: no tenant ('clinic_*') databases found — clinical data may not be backed up." >&2
else
  echo "Backing up tenant databases:"
  while IFS= read -r tenant_db; do
    [ -z "$tenant_db" ] && continue
    echo "  $tenant_db"
    dump_database "$tenant_db"
  done <<< "$TENANT_DBS"
fi

echo "Backup set written to $OUTPUT_DIR"
