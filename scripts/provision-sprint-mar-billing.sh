#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-medicore-postgres-master}"
MASTER_DB="${MASTER_DB:-medicore}"
DB_USER="${DB_USER:-postgres}"

BCMA_MIGRATION="${ROOT_DIR}/database/migrations/012-bcma-medication-safety.sql"
ALIGN_MIGRATION="${ROOT_DIR}/database/migrations/046-sprint-mar-billing-alignment.sql"

if [[ ! -f "${BCMA_MIGRATION}" ]]; then
  echo "Missing migration file: ${BCMA_MIGRATION}" >&2
  exit 1
fi

if [[ ! -f "${ALIGN_MIGRATION}" ]]; then
  echo "Missing migration file: ${ALIGN_MIGRATION}" >&2
  exit 1
fi

resolve_db_for_subdomain() {
  local subdomain="$1"
  docker exec -i "${POSTGRES_CONTAINER}" \
    psql -U "${DB_USER}" -d "${MASTER_DB}" -Atc \
    "SELECT \"databaseName\" FROM tenants WHERE subdomain = '${subdomain}' LIMIT 1;"
}

resolve_all_active_dbs() {
  docker exec -i "${POSTGRES_CONTAINER}" \
    psql -U "${DB_USER}" -d "${MASTER_DB}" -Atc \
    "SELECT \"databaseName\" FROM tenants WHERE status = 'active' ORDER BY \"createdAt\";"
}

apply_to_db() {
  local db_name="$1"
  if [[ -z "${db_name}" ]]; then
    return
  fi

  echo "==> Provisioning ${db_name}"
  cat "${BCMA_MIGRATION}" | docker exec -i "${POSTGRES_CONTAINER}" \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${db_name}" >/dev/null
  cat "${ALIGN_MIGRATION}" | docker exec -i "${POSTGRES_CONTAINER}" \
    psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${db_name}" >/dev/null
  echo "    applied: 012-bcma-medication-safety.sql + 046-sprint-mar-billing-alignment.sql"
}

usage() {
  cat <<EOF
Usage:
  $(basename "$0") <tenant-subdomain>
  $(basename "$0") --all-active

Environment overrides:
  POSTGRES_CONTAINER (default: medicore-postgres-master)
  MASTER_DB          (default: medicore)
  DB_USER            (default: postgres)
EOF
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

if [[ "$1" == "--all-active" ]]; then
  while IFS= read -r db_name; do
    apply_to_db "${db_name}"
  done < <(resolve_all_active_dbs)
  echo "Done."
  exit 0
fi

TARGET_SUBDOMAIN="$1"
TARGET_DB="$(resolve_db_for_subdomain "${TARGET_SUBDOMAIN}")"
if [[ -z "${TARGET_DB}" ]]; then
  echo "No tenant found for subdomain: ${TARGET_SUBDOMAIN}" >&2
  exit 1
fi

apply_to_db "${TARGET_DB}"
echo "Done."

