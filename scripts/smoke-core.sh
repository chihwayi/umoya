#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/load-env.sh"

check_url() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  local status
  status=$(curl -k -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" != "$expected" ]; then
    echo "FAIL  $name  $url  expected=$expected actual=$status"
    return 1
  fi
  echo "PASS  $name  $url"
}

TENANT_URL="${TENANT_URL:-${SERVICE_TENANT_URL:-}}"
EHR_URL="${EHR_URL:-${EHR_SERVICE_URL:-}}"
CDSS_URL="${CDSS_URL:-${SERVICE_CDSS_URL:-${CDSS_SERVICE_URL:-}}}"
WEB_ADMIN_URL="${WEB_ADMIN_URL:-${WEB_APP_URL:-}}"
STAFF_WEB_URL="${STAFF_WEB_URL:-${FRONTEND_URL:-}}"
PATIENT_PORTAL_URL="${PATIENT_PORTAL_URL:-${PORTAL_BASE_URL:-}}"

for required_url in TENANT_URL EHR_URL CDSS_URL WEB_ADMIN_URL STAFF_WEB_URL PATIENT_PORTAL_URL; do
  if [ -z "${!required_url:-}" ]; then
    echo "Error: ${required_url} is not configured. Set it in .env before running smoke-core."
    exit 1
  fi
done

echo "Running core smoke checks..."

check_url "web-admin" "$WEB_ADMIN_URL"
check_url "staff-ehr" "$STAFF_WEB_URL"
check_url "patient-portal" "$PATIENT_PORTAL_URL"
check_url "tenant-swagger" "$TENANT_URL/api/docs"
check_url "ehr-swagger" "$EHR_URL/api/docs"
check_url "cdss-docs" "$CDSS_URL/docs"

echo "Core smoke checks passed."
