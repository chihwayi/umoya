#!/usr/bin/env bash
# validate-secrets.sh — pre-deploy production secrets gate
# Usage: bash scripts/validate-secrets.sh [--check-connectivity]
# Exits non-zero if any critical secret is missing, default, or too weak.
set -euo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; NC='\033[0m'
ERRORS=0; WARNINGS=0

fail()    { echo -e "${RED}✗ FAIL${NC}: $1"; ERRORS=$((ERRORS+1)); }
warn()    { echo -e "${YELLOW}⚠ WARN${NC}: $1"; WARNINGS=$((WARNINGS+1)); }
ok()      { echo -e "${GREEN}✓${NC}: $1"; }

# Load .env if present and not already in environment
if [ -f .env ]; then
  set -a; source .env; set +a
fi

echo "=== MediCore Production Secrets Validation ==="

# ── Helpers ────────────────────────────────────────────────────────────────────
is_default() {
  local val="$1"
  local defaults=("change_in_production" "change_me" "your_secret_here"
                  "dev_cdss_service_token_change_in_production"
                  "dev_cdss_service_jwt_secret_change_in_production"
                  "h7X7Tr_3k0-Tl3xw8tS9AqK3f7fjoGv0VGfT3d2i-9o="
                  "admin" "password" "secret" "")
  for d in "${defaults[@]}"; do
    [ "$val" = "$d" ] && return 0
  done
  return 1
}

require_secret() {
  local name="$1"; local min_len="${2:-16}"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    fail "$name is not set"
  elif is_default "$val"; then
    fail "$name is still set to a default/dev value"
  elif [ "${#val}" -lt "$min_len" ]; then
    fail "$name is too short (${#val} chars, minimum $min_len)"
  else
    ok "$name"
  fi
}

require_var() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    fail "$name is not set"
  else
    ok "$name"
  fi
}

warn_if_missing() {
  local name="$1"; local reason="$2"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    warn "$name is not set — $reason"
  else
    ok "$name (optional)"
  fi
}

# ── Critical Secrets ───────────────────────────────────────────────────────────
echo ""
echo "--- Critical Secrets ---"
require_secret POSTGRES_PASSWORD 16
require_secret JWT_SECRET 32
require_secret MINIO_ROOT_PASSWORD 16
require_secret CDSS_SERVICE_TOKEN 32
require_secret CDSS_SERVICE_JWT_SECRET 32
require_secret CDSS_ENCRYPTION_KEY 44
require_secret ENCRYPTION_KEY 64

# GRAFANA_ADMIN_PASSWORD
GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-admin}"
if is_default "$GRAFANA_ADMIN_PASSWORD"; then
  fail "GRAFANA_ADMIN_PASSWORD is still 'admin' — change it"
else
  ok "GRAFANA_ADMIN_PASSWORD"
fi

# ── Required Config (non-secret but must be set) ───────────────────────────────
echo ""
echo "--- Required Config ---"
require_var POSTGRES_USER
require_var POSTGRES_DB
require_var CORS_ORIGINS
require_var SERVICE_POSTGRES_HOST
require_var SERVICE_REDIS_URL
require_var SERVICE_MINIO_URL
require_var MINIO_ROOT_USER

# ── Conditional / Optional Secrets ────────────────────────────────────────────
echo ""
echo "--- Optional / Feature-gated Secrets ---"
warn_if_missing WHISPER_API_KEY "required if USE_LOCAL_WHISPER=false"
warn_if_missing DAILY_API_KEY "required if telemedicine is enabled"
warn_if_missing DHIS2_PAT "required if DHIS2_SCHEDULED_SYNC_ENABLED=true"
warn_if_missing PAGERDUTY_ROUTING_KEY "required if PagerDuty alerting is active"
warn_if_missing SMTP_PASSWORD "required for CI failure email notifications"
warn_if_missing OPENAI_API_KEY "required if PostVisit LLM uses OpenAI"

# ── Connectivity check (optional) ─────────────────────────────────────────────
if [ "${1:-}" = "--check-connectivity" ]; then
  echo ""
  echo "--- Connectivity Checks ---"
  for svc_var in SERVICE_EHR_URL SERVICE_CDSS_URL SERVICE_TENANT_URL; do
    url="${!svc_var:-}"
    if [ -n "$url" ]; then
      if curl -sf --max-time 5 "$url/health" > /dev/null 2>&1; then
        ok "$svc_var reachable ($url/health)"
      else
        warn "$svc_var health check failed ($url/health)"
      fi
    fi
  done
fi

# ── Result ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}FAILED${NC}: $ERRORS error(s), $WARNINGS warning(s). Fix errors before deploying."
  exit 1
else
  echo -e "${GREEN}PASSED${NC}: 0 errors, $WARNINGS warning(s). Secrets look production-ready."
  exit 0
fi
