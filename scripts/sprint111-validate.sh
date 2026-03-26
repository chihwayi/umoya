#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/medicore"
export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"

echo "[sprint111] Running tenant provisioning audit"
npm run audit:tenant-provisioning

if [[ "${SPRINT111_WITH_REPAIR:-0}" == "1" ]]; then
  echo "[sprint111] Running tenant repair before live drift audit"
  npm run provision:all-tenants
fi

echo "[sprint111] Running live tenant column drift audit"
node scripts/audit-tenant-live-column-drift.mjs

echo "[sprint111] Validation complete"
