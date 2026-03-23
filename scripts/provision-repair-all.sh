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
# Environment overrides (all optional — defaults shown):
#   DB_HOST            localhost
#   DB_PORT            5432
#   DB_USERNAME        postgres
#   DB_PASSWORD        postgres
#   POSTGRES_DB        medicore   (master / tenant registry DB)
#   MASTER_POSTGRES_DB medicore   (same DB, used by sprint110 script)
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS="${ROOT}/scripts"

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_USERNAME="${DB_USERNAME:-postgres}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-medicore}"
export MASTER_POSTGRES_DB="${MASTER_POSTGRES_DB:-medicore}"

# Re-export aliases used by the repair/schema-versions script
export SERVICE_POSTGRES_HOST="${DB_HOST}"
export POSTGRES_USER="${DB_USERNAME}"
export POSTGRES_PASSWORD="${DB_PASSWORD}"

TSNODE="npx ts-node"

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
${TSNODE} "${SCRIPTS}/provision-repair-schema-versions.ts"

# ── Step 2: Apply all per-tenant bundles S1–S109 via DatabaseProvisioningService
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "  Step 2 — Apply all per-tenant bundles (S1–S109) via repairTenants"
echo "──────────────────────────────────────────────────────────────────────"
${TSNODE} --project "${ROOT}/services/tenant-service/tsconfig.json" \
  "${ROOT}/services/tenant-service/src/scripts/repairTenants.ts"

# ── Step 3: Master DB — SNOMED CONCURRENTLY view + ICD-11 schema ─────────────
echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo "  Step 3 — Master DB: SNOMED CONCURRENTLY view + ICD-11 schema"
echo "──────────────────────────────────────────────────────────────────────"
${TSNODE} "${SCRIPTS}/provision-sprint110-terminology-master.ts"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  Repair complete. All bundles applied (or already up-to-date).      ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
