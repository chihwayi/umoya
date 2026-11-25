# Schema Source of Truth (R1 / FX-001 decision)

Status: decided. Implements R0 DRIFT_ANALYSIS §4 item 1.

## Decision

**The versioned bundle list in `DatabaseProvisioningService.getProvisioningBundles()`
(`services/tenant-service/src/services/database-provisioning.service.ts`) is the
single source of truth for tenant schema.** `database/migrations/*.sql` is a
legacy replay-only path for pre-bundle tenant databases (as already stated in
`scripts/audit-migration-sequence.mjs`) and is hereby frozen: no new migration
files except replay fixes for already-deployed legacy DBs, each of which must
cite this document.

Rationale: R0 proved the two paths diverged silently (bundle behind entities
by 7 tables' columns; raw-SQL-only tables invisible to the entity auditor).
One writer + one CI gate (`npm run audit:drift`: entity↔bundle, FK types,
raw-SQL refs, migration sequencing) prevents recurrence.

## Scoped carve-outs (documented, not drift)

- **Master `tenants` table**: DDL via TypeORM entity sync +
  `TenantService.ensureSubscriptionSchema`; only the policy columns are
  bundle-managed (R1 `r1_master_tenant_policy_columns`). Follow-up (not R1):
  consolidate master DDL into one managed path.
- **SNOMED RF2 tables** (`snomed_concepts/descriptions/relationships`,
  `snomed_to_icd10_map`): owned by `scripts/import-uk-snomed-*.mjs`; the bundle
  intentionally does not duplicate the terminology load path. R7 may fold in.
- **Pre-R1 `SELECT *`**: allowed only where the gate's baseline records it;
  new `SELECT *` in versioned paths fails review (the gate checks explicit
  columns, not star-expansion).

## Rules for later sprints

1. New tables/columns go in a new versioned bundle entry (never edits to an
   already-stamped version id; never hand-run DDL).
2. Raw SQL must reference only bundle-schema tables/columns (gate-enforced).
3. Entity changes require the matching bundle change in the same commit
   (entity-only or bundle-only schema commits fail CI).
4. The losing path (`database/migrations/` for new work) stays frozen per its
   README; `migrate.sh` remains the replay runner only.
