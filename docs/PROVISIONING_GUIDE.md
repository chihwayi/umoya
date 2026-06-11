# Tenant Provisioning Guide

> **Read this before writing or merging any sprint bundle.**
> Violations here are the direct cause of provisioning failures in production.

---

## What provisioning is

Every new tenant — whether created via the admin panel (port 3011) or from a demo request (port 3000) — goes through a single code path:

```
POST /tenants  →  TenantService.createTenant()
                    → DatabaseProvisioningService.createDatabase()
                        → CREATE DATABASE "clinic_{subdomain}_db"
                        → applyClinicSchema()   ← all bundles applied here
                        → seedDefaultUsers()    ← 9 demo users seeded
```

`applyClinicSchema` applies every bundle in `getProvisioningBundles()` in order, using a multi-pass retry loop. A bundle that fails due to a missing dependency will be retried on the next pass after its dependency is created by another bundle. A bundle that fails due to a genuine SQL bug will **never** succeed and will block the entire tenant from becoming `active`.

---

## The bundle contract

Every `ProvisioningBundle` must satisfy these rules. Break one and the smoke test will fail at CI time.

### 1. All DDL must be idempotent

| Wrong | Correct |
|---|---|
| `CREATE TABLE foo (...)` | `CREATE TABLE IF NOT EXISTS foo (...)` |
| `CREATE INDEX idx ON foo(col)` | `CREATE INDEX IF NOT EXISTS idx ON foo(col)` |
| `ALTER TABLE foo ADD COLUMN bar TEXT` | `ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar TEXT` |
| `CREATE TRIGGER trg BEFORE UPDATE ON foo ...` | `CREATE OR REPLACE TRIGGER trg BEFORE UPDATE ON foo ...` |

The multi-pass retry re-runs every statement in the bundle from the start on each attempt. Non-idempotent DDL will fail on the second pass with "already exists".

### 2. Use `gen_random_uuid()`, not `uuid_generate_v4()`

`uuid_generate_v4()` requires the `uuid-ossp` extension which is installed by the `core` bundle. Bundles that run before `core` — or bundles that might run before it in a retry pass — must use `gen_random_uuid()` instead (built-in since PostgreSQL 13, no extension needed).

```sql
-- Wrong
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()

-- Correct
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### 3. No expression constraints in `CREATE TABLE`

PostgreSQL does not allow expressions in inline `UNIQUE` or `CHECK` constraints inside `CREATE TABLE`. Use a separate `CREATE UNIQUE INDEX` instead.

```sql
-- Wrong (syntax error)
CREATE TABLE location_stock (
  ...
  UNIQUE(location_id, catalog_id, COALESCE(batch_number, ''))
);

-- Correct
CREATE TABLE IF NOT EXISTS location_stock (...);
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_stock_uniq
  ON location_stock(location_id, catalog_id, COALESCE(batch_number, ''));
```

### 4. `ON CONFLICT` requires a matching unique constraint

`ON CONFLICT (column_name) DO NOTHING` only works when `column_name` has a `UNIQUE` or `PRIMARY KEY` constraint. If the constraint comes from a different bundle, use `ON CONFLICT DO NOTHING` (no column list) instead.

```sql
-- Wrong if unique constraint is in another bundle
INSERT INTO foo (code, name) VALUES ('X', 'Y') ON CONFLICT (code) DO NOTHING;

-- Safe regardless of bundle order
INSERT INTO foo (code, name) VALUES ('X', 'Y') ON CONFLICT DO NOTHING;
```

### 5. Cross-bundle `ALTER TABLE` must guard against missing tables

If your bundle alters a table that is created by a later bundle (or may not exist in older deployments), wrap the statement in a `DO` block with an exception handler:

```sql
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
EXCEPTION WHEN undefined_table THEN NULL;
END $$
```

### 6. All `NULL` literals in `VALUES` clauses must be typed when the column is not text

PostgreSQL infers the type of bare `NULL` from context. In a multi-row `VALUES` clause where all rows have `NULL` for a column, PostgreSQL may infer `text` and then fail to insert into an `INTEGER` column. Cast explicitly:

```sql
-- Wrong (NULL inferred as text, fails on INTEGER column)
SELECT v.* FROM (VALUES
  ('Vaccine A', NULL, NULL)
) AS v(name, recommended_age_months, interval_days)

-- Correct
SELECT v.* FROM (VALUES
  ('Vaccine A', NULL::INTEGER, NULL::INTEGER)
) AS v(name, recommended_age_months, interval_days)
```

### 7. No apostrophes in string literals inside template literals

Seed data strings that contain apostrophes break the SQL when interpolated into template literal strings. Either escape them (`''` in SQL, which means doubling the single quote) or rewrite the string to avoid the apostrophe.

```typescript
// Wrong — produces broken SQL: SELECT 'Ringer's Lactate...'
cons("Ringer's Lactate 500ml bag", 'bags', 100)

// Correct
cons('Ringers Lactate 500ml bag', 'bags', 100)
```

### 8. Triggers must use `CREATE OR REPLACE TRIGGER`

Plain `CREATE TRIGGER` fails on any tenant that was provisioned before (retry or re-provision path). `CREATE OR REPLACE TRIGGER` is supported from PostgreSQL 14 and is what the system runs.

```sql
-- Wrong
CREATE TRIGGER update_foo_updated_at BEFORE UPDATE ON foo ...

-- Correct
CREATE OR REPLACE TRIGGER update_foo_updated_at BEFORE UPDATE ON foo ...
```

### 9. Column names in seed queries must match the actual table schema

When a sprint alters a table to rename or add columns, all subsequent bundles that SELECT from that table must use the new names. Cross-check against the most recent `CREATE TABLE IF NOT EXISTS` for that table.

Common example: `vaccine_inventory` uses `lot_number` and `expiration_date`, not `batch_number` and `expiry_date`.

---

## Adding a new bundle

1. Open `DatabaseProvisioningService.getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`.
2. Add your bundle object at the **end** of the array (or after the last sprint it depends on).
3. Give it a unique `id` and a `version` using the date format `YYYY.MM.DD.N` (e.g., `'2026.06.01.0'`).
4. Apply the rules above to every SQL statement.
5. Run the smoke test locally before pushing:

```bash
cd services/tenant-service
SMOKE_DB_HOST=localhost SMOKE_DB_PASSWORD=your_password npm run test:smoke
```

The smoke test will provision a complete tenant database and verify:
- `status = active` (no provisioning errors)
- ≥ 500 tables created
- ≥ 200 bundles applied
- All 9 demo users seeded
- Every table has a primary key

If the smoke test passes, the bundle is safe to merge.

---

## The smoke test

**File:** `services/tenant-service/src/services/database-provisioning.smoke.spec.ts`
**Config:** `services/tenant-service/jest.smoke.config.js`
**Script:** `npm run test:smoke` in `services/tenant-service`

The normal `npm test` (unit tests) deliberately **excludes** smoke specs — they require a real PostgreSQL instance and take 30–90 seconds. The CI runs them in a separate job `tenant-provisioning-smoke` with a PostgreSQL service container, gated after `build-and-test`.

> **The CI Postgres image MUST be `pgvector/pgvector:pg15`, not plain `postgres:15`.**
> The `sprint114_clinical_rag` bundle runs `CREATE EXTENSION IF NOT EXISTS vector`, which only succeeds if the pgvector binaries are present in the image. This matches the production `postgres-master` image in `docker-compose.yml`. Any bundle that adds a new PostgreSQL extension must verify it exists in that image, or the smoke test (and real provisioning) will fail.

To run locally with the Docker stack up:

```bash
cd services/tenant-service
SMOKE_DB_PASSWORD=dev_password SMOKE_DB_NAME=umoya npm run test:smoke
```

---

## Generated files

Two files in `src/generated/` are auto-generated and contain structural backfill SQL:

| File | Purpose |
|---|---|
| `tenant-entity-shadow-cleanup.statements.ts` | Backfills snake_case columns from legacy camelCase shadows |
| `tenant-entity-structure-alignment.statements.ts` | Adds missing indexes, FKs, and constraints declared in TypeORM entities |

**Do not hand-edit these files unless you understand the generator output.** If the generator is re-run, the following manual fixes must be re-applied:
1. ~~Every `DO $$ BEGIN ... END IF; END $$` block must end with `EXCEPTION WHEN others THEN NULL;`~~ — **no longer manual.** As of `generate-tenant-structure-alignment.mjs` (2026-06-11) the generator emits this guard on every `DO` block automatically, so re-running it no longer strips them. Verify with: `grep -c 'EXCEPTION WHEN others THEN NULL'` equals the `DO $$ BEGIN` count.
2. The `UPDATE medical_records SET ... record_type = COALESCE(record_type, type) ...` line in `tenant-entity-shadow-cleanup.statements.ts` must be removed — `medical_records` has no `type` column.

If you regenerate these files, run the smoke test immediately after to confirm both fixes are still present.

---

## Failure handling

If a tenant ends up `status = suspended` after a provisioning attempt:
1. Check the error message returned by the API — it lists every failing bundle and the SQL error.
2. Fix the bundle(s) in `database-provisioning.service.ts`.
3. Delete the suspended tenant record: `DELETE FROM tenants WHERE subdomain = '...'`.
4. The orphaned database (if any) is automatically dropped by the cleanup logic added in May 2026. Verify with: `\l` in psql to confirm no `clinic_{subdomain}_db` exists.
5. Re-provision by creating the tenant again.

Partial databases from pre-May-2026 provisioning failures must be dropped manually:
```sql
DROP DATABASE IF EXISTS "clinic_{subdomain}_db" WITH (FORCE);
```

---

## History

The provisioning bugs fixed in May 2026 (and their categories) are documented in git history. Search for the commit message "fix: tenant provisioning smoke test + 38 SQL bundle fixes" to see the full diff.
