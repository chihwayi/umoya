# RUNBOOK — reproduce the Sprint A environment

Target reader: later audit sprints and the independent reviewer.
Principle: **synthetic seed data only**; never real patient data. Any DDL for
audit scratch goes through the provisioning-bundle system
(`services/tenant-service/src/services/database-provisioning.service.ts`, see
`docs/PROVISIONING_GUIDE.md`) — never hand-run `CREATE TABLE` against tenant
or master Postgres. Prefer a throwaway local Postgres/Docker instance for
audit-only scratch.

## 0. Prereqs (verified present 2026-11-24)

- Node v24.22.0, npm 11.19.1, Python 3.15.2, Docker 29.9.3, docker compose.
- Repo at commit `1d797bef` on branch `audit/a-recon-ledger` (parent: `main`).
- `.env` exists at repo root (184 vars) + `.env.example` as template.
  Key ports: tenant-service `3001`, ehr-service `3013`, ehr-frontend `3000`.
- Cached docker images include `dhis2/dhis2-core:2.40.0` (Sprint C),
  `pgvector/pgvector:pg15`, redis:7, livekit, minio, prometheus, grafana.

## 1. Install

```bash
git fetch origin && git checkout audit/a-recon-ledger
./scripts/setup.sh        # checks node/docker, npm install root + services
# node_modules are already installed in this checkout for:
#   root, services/*, mobile, ehr-frontend, patient-portal, web-app
```

## 2. Configure

```bash
cp .env.example .env   # if starting clean; then fill secrets
# Minimum to boot: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB=umoya,
# ports (PORT_POSTGRES, PORT_REDIS, PORT_TENANT_SERVICE=3001,
# PORT_EHR_SERVICE=3013, PORT_EHR_FRONTEND=3000), LIVEKIT_API_KEY/SECRET,
# MINIO_ROOT_USER/PASSWORD. Do NOT paste production keys.
```

## 3. Boot the stack

```bash
docker compose up -d            # 16 services: postgres-master, redis,
                                # livekit, egress, minio, tenant-service,
                                # cdss-service, cdss-worker,
                                # medical-aid-demo-service, ehr-service,
                                # web-app, ehr-frontend, patient-portal,
                                # prometheus, grafana
docker compose ps               # all healthy before proceeding
docker compose logs -f ehr-service tenant-service   # watch boot
```

Seed data (synthetic only):

```bash
node scripts/seed-sample-imaging.js        # sample DICOM into MinIO
node scripts/bootstrap-dhis2-metadata.mjs  # DHIS2 metadata bootstrap
npx ts-node scripts/backfill-imaging-objects.ts
node scripts/import-icd10-full.js          # ICD-10 reference data
# SNOMED: scripts/import-snomed-postgres.js (needs RF2 files + licence)
```

Tenant provisioning (the sanctioned DDL path — use for any audit table):

```bash
npm run provision:all-tenants
npm run provision:master-db
./scripts/provision-repair-all.sh
```

## 4. What Sprint A actually ran (no full boot needed)

```bash
npm --prefix services/tenant-service test     # 10 suites / 33 tests PASS
npm --prefix services/ehr-service test        # 187 suites: 151 pass, 36 FAIL (32 tests)
npx --prefix services/tenant-service tsc --noEmit -p services/tenant-service/tsconfig.json  # exit 0
npx --prefix services/ehr-service tsc --noEmit -p services/ehr-service/tsconfig.json        # exit 0
npm audit --audit-level=high                  # 162 vulns (7/71/76/8)
```

## 5. Suggested next steps for Sprints B–E

- Sprint B: fetch official WHO DAKs (smart.who.int + WorldHealthOrganization
  GitHub) into a local `who-smart-guidelines/` dir (gitignored scratch —
  confirm before adding); run cdss pytest (`services/cdss-service/tests/`).
- Sprint C: `validator_cli.jar` for FHIR R4 validation; DHIS2 from cached
  `dhis2/dhis2-core:2.40.0` image; compare `DHIS2_USE_MOCK=true` vs unset.
- Sprint D: install gitleaks + semgrep; confirm sandbox keys for
  EcoCash/Paynow/Africa's-Talking/LLM before hitting any live API.
- Sprint E: k6/Locust for load; `lifelines` (pip) for KM validation.

## 6. Tear-down

```bash
docker compose down            # stop stack, keep volumes
docker compose down -v         # also drop local volumes (synthetic data only!)
```
