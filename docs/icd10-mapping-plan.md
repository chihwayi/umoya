## ICD-10 Mapping Plan (Sprint 4)

### Objectives
- Ingest the staged package `snowstorm/imports/SNOMED_CT_to_ICD-10-CM_Resources_20250901.zip`.
- Provide a dependable lookup API so clinicians can see ICD-10 codes mapped from SNOMED selections.
- Enable UI hints (chips) in diagnosis-heavy workflows (triage, oncology, HIV, etc.) and expose mapping metadata (map group, priority, advice).
- Track mapping version/effective date to keep bundles aligned with future SNOMED releases.

### Sources & Options
1. **Snowstorm refset import** (preferred)
   - Use `import-snomed-rf2.sh` with the ICD-10 refset (component type `MAP`).
   - Pros: keeps mapping inside Snowstorm, leverage `/browser/{branch}/concepts/{id}/mappings`.
   - Cons: more load on Snowstorm, need to ensure branch contains map refsets.
2. **Custom ETL into Postgres**
   - Unzip to `tmp/icd10-map/`, parse `der2_sRefset_SimpleMap...` plus map advice files.
   - Load into `snomed_icd10_mappings` table (`concept_id`, `target_code`, `map_group`, `map_priority`, `map_advice`, `effective_time`, `active`, etc.).
   - Pros: local cache, easier to version/backup; fallback when Snowstorm API limited.

Decision: implement the Postgres ETL first (fastest path, works offline), but wire the ETL so we can optionally cross-check with Snowstorm in future.

### Data Model (new table)
`snomed_icd10_mappings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK |
| `concept_id` | VARCHAR | SNOMED concept (e.g., `197480006`) |
| `target_code` | VARCHAR | ICD-10-CM code (`F41.9`) |
| `map_group` | SMALLINT | for multiple targets |
| `map_priority` | SMALLINT | priority within group |
| `map_rule` | TEXT | expression per refset |
| `map_advice` | TEXT |
| `map_status` | VARCHAR | e.g., `P`, `N` |
| `effective_time` | DATE |
| `active` | BOOLEAN |
| `module_id` | VARCHAR |
| `map_category_id` | VARCHAR (if provided) |
| `created_at/updated_at` | TIMESTAMP |

Indexes:
- `(concept_id)`
- `(target_code)`
- `(active, concept_id, target_code)`

### Ingestion Flow
1. Script `scripts/import-icd10-map.ts`:
   - Accepts `--zip <path>` and `--connection <tenant-db>`.
   - Extracts to temp dir (use `adm-zip` or `unzipper`).
   - Parses map files (RF2 SimpleMap or ExtendedMap depending on release).
   - Upserts rows into `snomed_icd10_mappings` (per tenant or shared? Start with shared table in each tenant DB).
   - Maintains `icd10_mapping_metadata` table for version/effective time.
2. Hook into provisioning bundles:
   - Add new bundle `icd10_mapping` (default optional) that creates tables + indexes.
   - Provide CLI hook `scripts/run-tenant-upgrades.ts --bundle icd10_mapping`.

### API Surface
Add endpoints to `services/ehr-service` (TerminologyController):
- `GET /terminology/snomed/:conceptId/icd10`
  - Query `snomed_icd10_mappings` for active rows.
  - Return { conceptId, targetCode, mapGroup, mapPriority, mapAdvice, effectiveTime }.
- Optionally allow `?filter=primary` to pick highest priority mapping.

### UI Updates
1. `SnomedConceptPicker` consumer components (triage, oncology, cardiology, HIV):
   - After SNOMED selection, call new ICD API.
   - Display chips such as `ICD-10: F41.9 (Anxiety disorder, unspecified)` with tooltip from `map_advice`.
2. Diagnosis summary sections (Oncology, Cardiology dashboards):
   - Show top ICD-10 codes derived from SNOMED mappings (optional).

### Versioning & Observability
- Store latest `effective_time` and map release label in `icd10_mapping_metadata`.
- Emit logs when ingestion runs (similar to provisioning bundle events).
- Expose `GET /terminology/icd10/version` to inform UI which mapping build is active.

### Rollout Steps
1. Add schema & bundle to tenant provisioning service.
2. Build `import-icd10-map.ts` and document usage.
3. Populate QA tenant(s) with reference map.
4. Implement API endpoint & unit tests.
5. Update front-end pickers + dashboards.
6. QA scenario: map SNOMED Anxiety Disorder → ICD-10 F41.9, verify UI chip & API response.



