# database/migrations — FROZEN (replay-only)

Per `remediation/SCHEMA_SOURCE_OF_TRUTH.md` (R1/FX-001): the provisioning
bundle list in `database-provisioning.service.ts` is the single source of
truth for schema. This directory is a legacy replay-only path for
pre-bundle tenant databases, executed by `scripts/migrate.sh`.

Do NOT add new migration files for new schema work — add a versioned bundle
entry instead (CI `audit:drift` enforces bundle completeness; nothing enforces
migration↔bundle parity, which is exactly how the R0 drift happened).

Exceptions (replay fixes for already-deployed legacy DBs only) must cite
SCHEMA_SOURCE_OF_TRUTH.md in the file header.
