#!/usr/bin/env bash
# =============================================================================
# provision-repair-all.sh
#
# Idempotent repair runner — applies all sprint provisioning bundles (S1–S109)
# to every active/pending/suspended tenant, then applies the master DB migration
# for SNOMED view + ICD-11.
#
# All per-tenant bundles S1–S109 are managed by DatabaseProvisioningService
# inside repairTenants.ts. This script is intentionally short.
#
# Usage:
#   ./scripts/provision-repair-all.sh
#
# Environment — matches docker-compose.yml postgres-master + tenant-service DATABASE_URL:
#   Loads repo-root .env when present (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, SERVER_HOST).
#   Host-side connections use SERVER_HOST (default localhost), not SERVICE_POSTGRES_HOST (Docker DNS).
#   If Postgres is published on a non-default host port, set DB_PORT or PORT_POSTGRES in .env
#   to the *host* port (same as docker compose "ports:" left side).
#   You can still override before running: DB_HOST, DB_PORT, DATABASE_URL, etc.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS="${ROOT}/scripts"

# Load the same Postgres credentials / DB name as docker-compose.yml (POSTGRES_* from .env).
# docker-compose injects SERVICE_POSTGRES_HOST=postgres-master for containers; host-side scripts
# must use SERVER_HOST or localhost + PORT_POSTGRES (published port).
if [ -f "${ROOT}/.env" ]; then
  set -a
  # shellcheck disable=1091
  source "${ROOT}/.env"
  set +a
fi

export DB_PORT="${DB_PORT:-5432}"
# Prefer explicit DB_HOST; otherwise same host you use in .env DATABASE_URL / SERVER_HOST (not postgres-master).
export DB_HOST="${DB_HOST:-${SERVER_HOST:-localhost}}"
export DB_USERNAME="${DB_USERNAME:-${POSTGRES_USER:-postgres}}"
export DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-postgres}}"
export POSTGRES_DB="${POSTGRES_DB:-medicore}"
export MASTER_POSTGRES_DB="${MASTER_POSTGRES_DB:-${POSTGRES_DB}}"

# Master DB URL required by repairTenants.ts (tenant registry lives in POSTGRES_DB on the master instance)
export DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${POSTGRES_DB}}"

# Re-export aliases used by the repair/schema-versions script
export SERVICE_POSTGRES_HOST="${DB_HOST}"
export POSTGRES_USER="${DB_USERNAME}"
export POSTGRES_PASSWORD="${DB_PASSWORD}"

# Use tenant-service tsconfig so ts-node transpiles ESM-style `import` in scripts correctly
TSNODE=(npx ts-node --project "${ROOT}/services/tenant-service/tsconfig.json")

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║          MediCore — Full Tenant + Master DB Repair                  ║"
echo "║          Connecting to: ${DB_HOST}:${DB_PORT}/${POSTGRES_DB}                   ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"

# ── Step 1: Migrate tenant_schema_versions columns (pre-flight) ───────────────
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "  Step 1 — Migrate tenant_schema_versions columns (pre-flight)"
echo "──────────────────────────────────────────────────────────────────────"
"${TSNODE[@]}" "${SCRIPTS}/provision-repair-schema-versions.ts"

# ── Step 2: Apply all per-tenant bundles S1–S109 via DatabaseProvisioningService
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "  Step 2 — Apply all per-tenant bundles (S1–S109) via repairTenants"
echo "──────────────────────────────────────────────────────────────────────"
"${TSNODE[@]}" "${ROOT}/services/tenant-service/src/scripts/repairTenants.ts"

# ── Step 3: Master DB — SNOMED CONCURRENTLY view + ICD-11 schema ─────────────
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "  Step 3 — Master DB: SNOMED CONCURRENTLY view + ICD-11 schema"
echo "──────────────────────────────────────────────────────────────────────"
"${TSNODE[@]}" "${SCRIPTS}/provision-sprint110-terminology-master.ts"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  Repair complete. All bundles applied (or already up-to-date).      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
