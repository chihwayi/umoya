#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Docker Compose is required."
  exit 1
fi

DB_CONTAINER="${DOCKER_PG_CONTAINER:-medicore-postgres-master}"
DB_HOST="${DB_HOST:-${SERVICE_POSTGRES_HOST:-postgres-master}}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USERNAME:-${POSTGRES_USER:-postgres}}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-postgres}}"
MASTER_DB="${POSTGRES_DB:-medicore}"
TARGET_DB="${TARGET_DB:-}"

wait_for_postgres() {
  echo "Waiting for PostgreSQL to be ready..."
  for _ in $(seq 1 30); do
    if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
      if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$MASTER_DB" >/dev/null 2>&1; then
        return 0
      fi
    else
      if command -v pg_isready >/dev/null 2>&1; then
        if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$MASTER_DB" >/dev/null 2>&1; then
          return 0
        fi
      fi
    fi
    sleep 2
  done

  echo "PostgreSQL did not become ready in time."
  exit 1
}

run_psql_file() {
  local db_name="$1"
  local sql_file="$2"

  if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    docker exec -i -e "PGPASSWORD=$DB_PASSWORD" "$DB_CONTAINER" \
      psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$db_name" < "$sql_file"
  else
    PGPASSWORD="$DB_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -f "$sql_file"
  fi
}

run_psql_query() {
  local db_name="$1"
  local sql="$2"

  if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    docker exec -i -e "PGPASSWORD=$DB_PASSWORD" "$DB_CONTAINER" \
      psql -tA -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$db_name" -c "$sql"
  else
    PGPASSWORD="$DB_PASSWORD" psql -tA -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db_name" -c "$sql"
  fi
}

apply_master_schema() {
  local db_name="$1"
  local bootstrap_files=(
    "database/schemas/tenant.sql"
  )
  local patch_files=(
    "database/schemas/add-demo-access-requests.sql"
    "database/schemas/add-tenant-dhis2-config.sql"
    "database/schemas/add-tenant-dhis2-scheduler-controls.sql"
    "database/schemas/add-tenant-subscription-lifecycle.sql"
  )

  local tenants_exists
  tenants_exists="$(run_psql_query "$db_name" "SELECT to_regclass('public.tenants') IS NOT NULL;")"

  if [ "$tenants_exists" = "t" ]; then
    echo "Master tenants table already exists. Skipping full bootstrap schema file."
  else
    for sql_file in "${bootstrap_files[@]}"; do
      if [ -f "$sql_file" ]; then
        echo "Applying master schema bootstrap $(basename "$sql_file")"
        run_psql_file "$db_name" "$sql_file"
      fi
    done
  fi

  for sql_file in "${patch_files[@]}"; do
    if [ -f "$sql_file" ]; then
      echo "Applying master schema patch $(basename "$sql_file")"
      run_psql_file "$db_name" "$sql_file"
    fi
  done
}

"${COMPOSE_CMD[@]}" up -d postgres-master >/dev/null
wait_for_postgres

echo "Master database '$MASTER_DB' is reachable."
echo "Tenant clinic schemas are provisioned by tenant-service during tenant creation and repair flows."

if [ -z "$TARGET_DB" ]; then
  echo "No TARGET_DB supplied. Applying master-database schema/bootstrap patches to '$MASTER_DB'."
  apply_master_schema "$MASTER_DB"
  echo "Master database provisioning completed."
  echo "Usage for an existing clinic DB migration replay: TARGET_DB=tenant_example ./scripts/migrate.sh"
  exit 0
fi

echo "Applying SQL migration files to '$TARGET_DB'..."
shopt -s nullglob
migration_files=(database/migrations/*.sql)
if [ ${#migration_files[@]} -eq 0 ]; then
  echo "No SQL migration files found under database/migrations."
  exit 1
fi

for sql_file in "${migration_files[@]}"; do
  echo "Applying $(basename "$sql_file")"
  run_psql_file "$TARGET_DB" "$sql_file"
done

echo "Migration replay completed for '$TARGET_DB'."
