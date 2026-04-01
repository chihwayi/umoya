# MediCore Session History — Resume Point

**Last updated:** 2026-04-01
**Branch:** `main` (working tree dirty)

---

## Current Status: CDSS Service Healthy

The `cdss-service` is running healthy. No immediate action required to start it.

```bash
docker compose up -d --no-deps cdss-service
```

**Root cause of the long-standing "unhealthy" problem — now fixed:**
- `uvicorn --reload` spawns a WatchFiles reloader subprocess. With heavy AI model loading (~30s), the worker subprocess never completed startup before the reloader's internal timeout, causing the container to remain permanently unhealthy.
- Fix: removed `--reload` from `services/cdss-service/Dockerfile` CMD and added an explicit `command:` override in `docker-compose.yml`.
- Result: service now boots cleanly with `CDSS_ENABLE_AI=true` and becomes healthy within ~90 seconds on a cold start.

**One pending rebuild item** (safe to defer — current running container works):
- `POST /knowledge/ingest` for non-plain-text (PDF, DOCX) requires the newer NLTK assets (`punkt_tab`, `averaged_perceptron_tagger_eng`) that are now baked into the Dockerfile.
- For `text/plain` uploads, ingest works right now (code was hardened to bypass `unstructured` for plain text).
- When Docker Hub is accessible, rebuild to get the full non-plain-text ingest path: `docker compose build cdss-service && docker compose up -d --no-deps cdss-service`

---

---

## Latest Verified State (2026-04-01, later session)

### What was fixed in code
- `services/cdss-service/main.py`
  - added tenant-aware PostgreSQL routing for governed knowledge access by resolving `X-Tenant-ID` / `tenant_id` to the tenant database name through the master `tenants` table
  - kept master-DB access explicit for global audit writes via `_master_pg_conn_sync()`
  - fixed `/feedback/outcome/learning/retrain` so it writes to the real `model_deployments` schema (`surface`, `model_version`, `previous_version`, `eval_run_id`, `release_gate_id`, `deployment_method`, `status`) instead of the wrong old column contract
  - sanitized non-finite `similarity_score` values before returning `/guidelines/search`, which stopped JSON serialization failures on grounded citations
- `services/tenant-service/src/scripts/repairMasterDatabase.ts`
  - new helper script for provisioning the master DB through the normal provisioning service
  - default master bundles now include both:
    - `sprint114_clinical_rag`
    - `sprint116_risk_stratification_self_learning`
- `package.json`
  - added `npm run provision:master-db`
- `services/cdss-service/Dockerfile`, `services/cdss-service/Dockerfile.prod`, `services/cdss-service/ingest_guidelines.py`
  - now include / download the newer NLTK resources:
    - `punkt_tab`
    - `averaged_perceptron_tagger_eng`

### DB work completed, following the standing rule
- Verified before fix:
  - master DB `medicore` did not have `vector`
  - master DB did not have `clinical_knowledge_documents` / `clinical_knowledge_chunks`
  - tenant DB `clinic_testghost_db` also lacked the Sprint 114 schema
- Applied master DB provisioning:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/medicore \
MASTER_PROVISION_BUNDLES=sprint114_clinical_rag,sprint116_risk_stratification_self_learning \
npm run provision:master-db
```

- Ran tenant repair after the DB-related changes:

```bash
REPAIR_STRICT=false DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/medicore \
DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=postgres \
npm run provision:all-tenants
```

- Verified after fix:
  - master DB has `vector`
  - master DB has `clinical_knowledge_documents`
  - master DB has `clinical_knowledge_chunks`
  - master DB has `model_deployments`
  - master DB has `sprint114_clinical_rag`
  - master DB has `sprint116_risk_stratification_self_learning`
  - tenant DB `clinic_testghost_db` has the same tables and both bundle markers

### Important tenant repair note
- Tenant repair did run, as required.
- The remaining unresolved tenant repair failures are older unrelated bundle problems, not this CDSS fix:
  - `sprint111_entity_completeness`: `operator does not exist: text = boolean`
  - `sprint112_p0_safety`: `column "description" of relation "consent_templates" does not exist`
- Sprint 114 and Sprint 116 were already applied successfully on the tenant DBs despite those older unresolved bundles.

### Live runtime proof after the DB + code fixes
- `GET /health` returned `200`
- `POST /registration/documents/analyze` returned `200`
- `POST /feedback/outcome/learning/retrain` returned `200`
- `GET /fl/model-version?surface=all` returned `200`
- Verified retraining audit persistence end-to-end:
  - calling `/feedback/outcome/learning/retrain` created a real row in master `model_deployments`
  - verified row:

```text
surface=guidelines
model_version=guidelines-v1775036953
previous_version=baseline-v1
deployment_method=auto
status=deployed
```

### Positive pgvector / tenant-aware RAG proof
- A temporary smoke document was inserted into tenant DB `clinic_testghost_db` only.
- `POST /knowledge/search` returned that tenant-scoped document successfully:

```json
{
  "results":[
    {
      "document_title":"Smoke Hypertension Guideline",
      "chunk_text":"Adult hypertension guideline: start an ACE inhibitor for persistent hypertension and review blood pressure in 4 weeks."
    }
  ]
}
```

- `POST /guidelines/search` also returned the same tenant-grounded citation after the similarity-score sanitization fix.
- The temporary smoke document and chunk were deleted afterward, so no test data was left behind.
- During these positive searches, the earlier pgvector DB error did **not** recur:

```text
[CDSS] pgvector RAG search failed (fallback to ChromaDB): vector type not found in the database
```

That error is now considered resolved.

### New issue found while proving `/knowledge/ingest`
- Direct `POST /knowledge/ingest` on the current running image failed with:

```text
Resource 'punkt_tab' not found
```

- CDSS logs also showed failed runtime download attempts for:
  - `punkt_tab`
  - `averaged_perceptron_tagger_eng`
- Repo fix is already applied in:
  - `services/cdss-service/Dockerfile`
  - `services/cdss-service/Dockerfile.prod`
  - `services/cdss-service/ingest_guidelines.py`
- This specific ingest fix still requires a fresh CDSS rebuild to be present in the running image.

### Final validation update from the same session
- A direct `docker compose build cdss-service` retry was attempted after the NLTK packaging changes.
- It was blocked by external Docker Hub connectivity, not by app code:

```text
failed to fetch oauth token: Post "https://auth.docker.io/token": dial tcp: lookup auth.docker.io: i/o timeout
```

- To avoid blocking on Docker Hub, `services/cdss-service/main.py` was hardened so `POST /knowledge/ingest` decodes `text/plain` uploads directly instead of forcing `unstructured` / NLTK.
- After restarting the current container, a live plain-text ingest proof succeeded:

```json
{"document_id":"22222222-2222-4222-8222-222222222126","chunk_count":1,"embedding_model":"all-MiniLM-L6-v2","status":"completed"}
```

- The ingested tenant-scoped document was then retrieved successfully through `POST /knowledge/search`:

```json
{
  "results":[
    {
      "document_title":"Smoke ACE Guideline",
      "similarity_score":0.8671720207189375
    }
  ]
}
```

- And it also surfaced correctly through `POST /guidelines/search`:

```json
{
  "count":1,
  "citations":[{"title":"Smoke ACE Guideline","grounded":true}]
}
```

- The temporary smoke rows were deleted afterward, so no test data was left behind.

### Updated best status
- verified live now:
  - `/knowledge/ingest` works for `text/plain`
  - `/knowledge/search` works
  - `/guidelines/search` returns grounded tenant citations
- still pending when Docker Hub access is available:
  - rebuilt-image verification that the bundled NLTK assets also cover non-plain-text ingest paths without runtime downloads

### Current best status
- resolved:
  - `asyncpg` startup crash
  - pgvector Python adapter bug
  - master/tenant pgvector schema gap
  - retraining route collision
  - raw EHR->CDSS bypasses identified earlier
  - registration scope parity
  - retraining audit persistence to `model_deployments`
  - tenant-aware RAG retrieval proof
  - `/guidelines/search` citation serialization bug
- still pending rebuild verification:
  - `POST /knowledge/ingest` with the new NLTK assets in the rebuilt image

### Best next command sequence if resuming

```bash
docker compose build cdss-service
docker compose up -d --no-deps cdss-service
docker compose logs --tail=150 cdss-service
curl http://127.0.0.1:8000/health
```

Then specifically re-test:

```bash
curl -H 'X-Service-Token: dev_cdss_service_token_change_in_production' \
     -H 'X-Tenant-ID: 236265c8-1150-42ca-ba53-6382f268b6b8' \
     -H 'Content-Type: application/json' \
     -d '{"document_id":"...","tenant_id":"236265c8-1150-42ca-ba53-6382f268b6b8","file_base64":"...","mime_type":"text/plain","metadata":{"title":"Smoke","documentType":"guideline"}}' \
     http://127.0.0.1:8000/knowledge/ingest
```

Success criteria:
- `/knowledge/ingest` no longer fails on missing `punkt_tab`
- `/guidelines/search` still returns grounded citations when tenant knowledge exists
- no return of the old pgvector fallback error

---

## Latest Live Smoke Outcome (2026-03-31)

## Latest Runtime Verification (2026-04-01)

### Rebuilt image finally reached healthy runtime
- After the long model / dependency startup completed, the rebuilt `cdss-service` container became healthy.
- Verified directly:

```json
{"status":"healthy","timestamp":"2026-04-01T07:17:22.784779"}
```

- Docker inspection also showed:
  - container state: `running`
  - health state: `healthy`

### Live governed endpoint checks on the healthy container
- `GET /fl/model-version?surface=all` returned:

```json
{"versions":{},"timestamp":"2026-04-01T07:43:04.477508"}
```

- `POST /feedback/outcome/learning/retrain` returned:

```json
{"status":"no_entries","model_id":"baseline-v1","surface":"diagnosis"}
```

- `POST /registration/documents/analyze` returned:

```json
{
  "document_type":"insurance_card",
  "structured_payload":{"providerName":"Test Medical Aid","memberNumber":"ABC123","planName":"Gold"},
  "summary":"Fallback registration-document analysis completed for insurance_card.",
  "flags":["document_type:insurance_card"],
  "confidence":1.0,
  "model":"llama3.1:latest",
  "abstained":false,
  "abstain_reason":null,
  "governance":{
    "governed_path":true,
    "use_case":"registration_document_intelligence",
    "vendor_id":"ollama",
    "fallback_rule_engine":true,
    "llm_enhanced":true
  }
}
```

- `POST /guidelines/search` returned:

```json
{
  "query":"Sepsis Protocol",
  "citations":[],
  "analysis":"I cannot provide a response for this request. Is there anything else I can help you with?",
  "count":0,
  "applied_filters":{},
  "applied_governed_filters":{},
  "governed_corpus_used":false
}
```

### Important nuance from first-use runtime
- The first live endpoint pass hit long warm-up latency:
  - `/feedback/outcome/learning/retrain`: ~24s
  - `/registration/documents/analyze`: ~40.8s
  - `/guidelines/search`: ~43.1s
- After warm-up, repeat requests were much faster:
  - `/feedback/outcome/learning/retrain`: ~36ms
  - `/fl/model-version`: ~207ms
  - `/guidelines/search`: ~187ms
  - `/registration/documents/analyze`: ~10.4s

### Remaining concrete issue
- Governed pgvector retrieval is still not working even though the Python adapter bug is fixed.
- Current runtime error in CDSS logs:

```text
[CDSS] pgvector RAG search failed (fallback to ChromaDB): vector type not found in the database
```

- This means the remaining problem is now database-side pgvector enablement / schema compatibility, not Python packaging.
- Because this is a DB-side issue, any actual fix must follow the standing rule:
  - update the tenant/database provisioning path
  - run tenant repair so current tenants receive the change

### Current best status
- `cdss-service` build: healthy
- container boot: healthy
- service auth: working
- registration analysis: working
- federated model version endpoint: working
- feedback retrain endpoint: working
- guideline search transport path: working
- guideline grounding quality: still blocked by pgvector DB setup, so search falls back and returns no governed citations

---

### Rebuilt image verification update
- A full `docker compose build cdss-service` finally completed successfully on the rebuilt image.
- The new image verified all critical runtime imports during build, including:
  - `asyncpg`
  - `pytesseract`
  - `pgvector.psycopg2.register_vector`
- `docker compose up -d --no-deps cdss-service` successfully recreated and started the container from the fresh image.

### What still blocks final closure
- On the rebuilt image, `cdss-service` still does **not** become healthy on the default compose startup path.
- Observed runtime state:
  - container is `Up ... (unhealthy)`
  - `docker compose logs` shows:

```text
INFO: Uvicorn running on http://0.0.0.0:8000
INFO: Started reloader process [1] using WatchFiles
Warning: You are sending unauthenticated requests to the HF Hub...
```

  - but there is still no `Application startup complete`
  - repeated `curl http://127.0.0.1:8000/health` returned `Recv failure: Connection reset by peer`
  - Docker health status recorded repeated `ConnectionRefusedError: [Errno 111] Connection refused`

### Important detail from rebuilt container inspection
- The rebuilt container is running with:

```text
CDSS_ENABLE_AI=true
```

- So this is the full heavy AI startup path, not the lightweight smoke mode that had already succeeded earlier.
- Process inspection inside the rebuilt container showed:
  - the reloader parent process is alive
  - multiprocessing child processes exist
  - but the app still does not cross into a healthy serving state within the observed window

### Current best conclusion
- The packaging blockers we fixed are real and resolved:
  - `asyncpg` missing dependency
  - `pgvector` adapter registration bug
  - nondeterministic Python dependency resolution
- The remaining issue is now an operational startup problem on the full AI-enabled container path, likely related to heavyweight model initialization / download during app startup, not the earlier missing-module failures.

### Immediate next resume step
- Resume from the rebuilt running container and focus specifically on why the AI-enabled startup never reaches `Application startup complete`.
- Highest-value checks next:
  - capture child-process stderr/stdout during startup
  - compare `CDSS_ENABLE_AI=true` vs `CDSS_ENABLE_AI=false` on the rebuilt image
  - determine whether HF/model warm-up is simply too slow or whether a child startup exception is being swallowed by the reloader path

### What we verified end-to-end
- A one-off CDSS server booted cleanly with `CDSS_ENABLE_AI=false` and reached:

```text
Application startup complete.
Uvicorn running on http://0.0.0.0:8000
```

- `GET /health` returned `200`.
- Authenticated `GET /fl/model-version?surface=all` returned `200` with an empty versions object instead of failing.
- Authenticated `POST /feedback/outcome/learning/retrain` returned `200` with:

```json
{"status":"no_entries","model_id":"baseline-v1","surface":"diagnosis"}
```

- Authenticated `POST /registration/documents/analyze` returned `200` and correctly extracted structured fallback data from sample insurance text.
- Authenticated `POST /guidelines/search` returned `200` instead of crashing, even in AI-disabled mode.

### New issue found during smoke
- Governed pgvector RAG was still failing with:

```text
module 'psycopg2.extras' has no attribute 'register_vector'
```

- That was not a database schema problem. It was a Python adapter bug:
  - the repo had not declared the `pgvector` Python package
  - `main.py` was calling `psycopg2.extras.register_vector(...)`, which is the wrong API

### Follow-up fix now applied in repo
- `services/cdss-service/main.py`: now imports `register_vector` from `pgvector.psycopg2` and uses a shared `_register_pgvector(conn)` helper.
- `services/cdss-service/requirements.txt`: now includes `pgvector>=0.2.5`.
- `services/cdss-service/constraints.txt`: now pins `pgvector==0.2.5`.
- `services/cdss-service/Dockerfile` and `services/cdss-service/Dockerfile.prod`: build verification now imports the pgvector adapter too.
- A fresh one-off container proof with `pgvector` installed at runtime successfully imported `main.py` and printed:

```text
PGVECTOR_IMPORT_OK
```

### AI-disabled startup optimization now applied
- `services/cdss-service/diagnostic_assistant.py` now respects `CDSS_ENABLE_AI=false` during initialization.
- This prevents heavy diagnostic AI model warm-up/download work during AI-disabled smoke runs and lets the service boot quickly in rule-based mode.
- A brief `NameError: os is not defined` regression was introduced during that change and fixed immediately by adding the missing `import os`.

### What to run next

```bash
docker compose build cdss-service
docker compose up -d --no-deps cdss-service
docker compose logs --tail=150 cdss-service
curl http://127.0.0.1:8000/health
```

### Success criteria
- CDSS starts cleanly from the rebuilt image
- `/health` returns successfully
- No `ModuleNotFoundError: asyncpg`
- No `register_vector` adapter error during governed knowledge search
- `guidelines/search` uses the pgvector path when tenant knowledge exists, and only falls back when retrieval is genuinely empty

---

## Latest Runtime / Packaging Hardening Outcome (2026-03-31)

### What we confirmed after the asyncpg fix
- A one-off CDSS container run with `asyncpg` installed at runtime successfully imported `main.py` and printed:

```text
0.31.0
CDSS_IMPORT_OK
```

- That proves the old startup failure was specifically the missing `asyncpg` dependency in the stale image.
- The app now gets past the previous `ModuleNotFoundError: asyncpg` crash path and proceeds into normal AI/model initialization.
- A quick `/health` probe against a one-off server still did not complete in the short window because model warm-up/downloads were in progress, not because of the original import failure.

### Packaging hardening applied in repo
- `services/cdss-service/constraints.txt`: added pinned Python dependency versions based on the currently working CDSS image/import path.
- `services/cdss-service/requirements.txt`: removed unused `xgboost` from the image path and removed the duplicate unpinned `pillow` entry.
- `services/cdss-service/Dockerfile`: now copies `constraints.txt`, installs with `pip install -r requirements.txt -c constraints.txt`, and verifies `pytesseract` in the build check.
- `services/cdss-service/Dockerfile.prod`: same deterministic install / verification change for production.
- `services/cdss-service/setup.sh`: local setup now also installs through `constraints.txt`.

### Build behavior improvement we observed
- Before constraints: pip spent a very long time backtracking across many `unstructured[pdf]`, `pi-heif`, and related versions.
- After constraints: the CDSS Docker build immediately selected pinned versions such as:
  - `torch-2.10.0`
  - `transformers-5.3.0`
  - `sentence-transformers-5.2.3`
  - `chromadb-1.5.5`
  - `unstructured-0.18.32`
  - `pypdf-6.8.0`
  - `spacy-3.7.5`
  - `PyJWT-2.11.0`
  - `asyncpg 0.31.0`

### What to run next

```bash
docker compose build cdss-service
docker compose up -d --no-deps cdss-service
docker compose logs --tail=100 cdss-service
curl http://127.0.0.1:8000/health
```

### Success criteria
- CDSS build resolves pinned versions directly instead of backtracking across multiple package histories
- CDSS logs show `Uvicorn running on http://0.0.0.0:8000`
- No `ModuleNotFoundError: asyncpg`
- `/health` returns successfully from the rebuilt container
- EHR guideline search no longer logs `ECONNREFUSED`

---

## Latest Debugging Outcome (2026-03-31)

### What we confirmed
- The "instant fallback" symptom is **not** the old 50s timeout problem.
- `ehr-service` is reaching the CDSS host but getting `ECONNREFUSED`, e.g. `connect ECONNREFUSED 172.18.0.9:8000`.
- `cdss-service` is starting Uvicorn, then the worker process crashes during import with:

```text
ModuleNotFoundError: No module named 'asyncpg'
```

- That crash leaves nothing listening on port `8000`, so EHR immediately falls back to local guidelines.

### Solution applied in repo
- `services/cdss-service/Dockerfile`: fixed `pip install` command to quote `"asyncpg>=0.29.0"` and added `import asyncpg` to the build verification step.
- `services/cdss-service/Dockerfile.prod`: same fix for production image.
- `docker-compose.yml`: fixed cdss-worker startup command to quote `'asyncpg>=0.29.0'`.
- `docs/History.md`: updated resume instructions so future sessions rebuild CDSS instead of only restarting it.

### What to run next

```bash
docker compose build cdss-service
docker compose up -d --no-deps cdss-service
docker compose logs --tail=100 cdss-service
```

### Success criteria
- CDSS logs show `Uvicorn running on http://0.0.0.0:8000`
- No `ModuleNotFoundError: asyncpg`
- EHR guideline search no longer logs `ECONNREFUSED`
- Only after CDSS is healthy should we debug ChromaDB/RAG content issues, if fallback still happens

---

## What Was Just Fixed (last commit: `452cb06b`)

### Root cause of "loading forever" on AI Clinical Guidelines
- `LLM_TIMEOUT_SECONDS=60` in docker-compose → CDSS waited 60s for Ollama
- `CDSS_GUIDELINES_SEARCH_TIMEOUT_MS=50000` → EHR service only waited 50s
- 60 > 50 → EHR always timed out before CDSS could respond
- 3 retries × 50s = 150s → then hardcoded fallback results

### Fix applied
- `services/cdss-service/main.py`: `/guidelines/search` endpoint now uses `LLM_GUIDELINES_TIMEOUT_SECONDS` (default 20s) instead of `LLM_TIMEOUT_SECONDS`
- `docker-compose.yml`: added `LLM_GUIDELINES_TIMEOUT_SECONDS=${LLM_GUIDELINES_TIMEOUT_SECONDS:-20}` to cdss-service env
- Flow is now: ChromaDB search (~2s) + LLM cap (20s) = ~22s total → well within 50s EHR window
- Other LLM endpoints (diagnosis etc.) unaffected — still use `LLM_TIMEOUT_SECONDS=60`

---

## If Guidelines Still Return Fallback After Restart

If after restarting cdss-service the search STILL returns "Local Clinical Guidelines (Fallback)", it means ChromaDB is returning empty results. Debug steps:

```bash
# Check CDSS logs during a search
docker compose logs -f cdss-service | grep -E "CDSS|guideline|chroma|error"

# Verify ChromaDB has data
docker compose exec cdss-service python3 -c "
import chromadb
client = chromadb.PersistentClient(path='/app/data/chroma_db')
cols = client.list_collections()
print('Collections:', [c.name for c in cols])
for c in cols:
    print(f'  {c.name}: {c.count()} docs')
"

# If ChromaDB is empty, rebuild BM25 index
docker compose exec cdss-service python3 -c "
from ai_models.rag_engine import RAGEngine
r = RAGEngine()
r._build_bm25_index()
print('BM25 rebuilt over', len(r.bm25_corpus) if r.bm25_corpus else 0, 'docs')
"
```

If ChromaDB is empty → re-ingest WHO guidelines PDFs via the "Upload & Ingest" button in the CDSS Admin page (port 3011 → CDSS tab → Document Ingestion), OR use the "Seed Guidelines" button to seed 32 hardcoded fallback chunks.

---

## Full Session Summary — What Was Built

### Production Readiness (all committed)
| Item | Status | Files |
|------|--------|-------|
| Secrets validation script | ✅ Done | `scripts/validate-secrets.sh` |
| Secrets checklist doc | ✅ Done | `docs/secrets-checklist.md` |
| Production Dockerfiles (ehr-frontend, patient-portal) | ✅ Done | `ehr-frontend/Dockerfile`, `patient-portal/Dockerfile` |
| Nginx conf templates (use `SERVICE_EHR_URL` etc. from .env) | ✅ Done | `ehr-frontend/nginx.conf.template`, `patient-portal/nginx.conf.template` |
| CDSS production Dockerfile (4 workers, no --reload) | ✅ Done | `services/cdss-service/Dockerfile.prod` |
| docker-compose.prod.yml | ✅ Done | `docker-compose.prod.yml` |
| GitHub Actions: Playwright E2E job (opt-in via `STAGING_E2E_ENABLED=true`) | ✅ Done | `.github/workflows/ci.yml` |
| GitHub Actions: CD deploy job (opt-in via `DEPLOY_ENABLED=true`) | ✅ Done | `.github/workflows/ci.yml` |
| Detox mobile E2E (.detoxrc.js, e2e/smoke.spec.ts, e2e/jest.config.js) | ✅ Done | `mobile/e2e/` |
| Mobile E2E CI step (opt-in via `MOBILE_E2E_ENABLED=true`) | ✅ Done | `.github/workflows/ci.yml` |

### CDSS / AI Fixes
| Item | Status | Files |
|------|--------|-------|
| Seed Guidelines button + live progress bar (Nurse Dashboard + CDSS Admin) | ✅ Done | `ehr-frontend/src/pages/TenantDirectory.tsx`, `web-app/src/components/CdssAdmin.tsx` |
| BM25 auto-rebuild after seeding | ✅ Done | `services/cdss-service/main.py` |
| cdss-worker asyncpg fix | ✅ Done | `services/cdss-service/Dockerfile`, `docker-compose.yml` |
| Guidelines search timeout: 15s→50s (EHR side) | ✅ Done | `services/ehr-service/src/services/cdss.service.ts` |
| Guidelines LLM timeout: 20s cap (CDSS side) | ✅ Done | `services/cdss-service/main.py` |

### UI Fixes
| Item | Status | Files |
|------|--------|-------|
| White-on-white input fields in super admin (global CSS) | ✅ Done | `web-app/src/App.css` |
| AI Clinical Guidelines modal — dark glassmorphism redesign (fixes white icon boxes) | ✅ Done | `ehr-frontend/src/pages/NurseDashboard.tsx` |
| LLM settings fields in CDSS Admin (bg-[#0D1829]) | ✅ Done | `web-app/src/components/CdssAdmin.tsx` |

### CI Fixes
| Issue | Fix | File |
|-------|-----|------|
| `secrets.` not allowed in `if:` expressions | Replaced with `vars.STAGING_E2E_ENABLED`, `vars.DEPLOY_ENABLED` | `.github/workflows/ci.yml` |
| proxy spec timeout mismatch (15000 vs 50000) | Updated spec to 50000 | `services/ehr-service/src/services/cdss.service.proxy.spec.ts` |
| Mobile tsc picks up e2e files (jest globals) | Added `"exclude": ["e2e"]` to mobile tsconfig; separate e2e tsconfig | `mobile/tsconfig.json`, `mobile/e2e/tsconfig.json` |
| Detox fails: no emulator on CI runner | Gated step with `vars.MOBILE_E2E_ENABLED` | `.github/workflows/ci.yml` |
| react-native version mismatch (expo-doctor) | Bumped to `0.83.4` | `mobile/package.json` |

---

## GitHub Actions Opt-in Variables

Set these in **GitHub → Settings → Secrets and variables → Variables** to unlock CI features:

| Variable | Value | What it enables |
|----------|-------|-----------------|
| `STAGING_E2E_ENABLED` | `true` | Playwright E2E tests against staging |
| `DEPLOY_ENABLED` | `true` | CD SSH deploy to VPS on push to main |
| `MOBILE_E2E_ENABLED` | `true` | Detox Android E2E smoke tests |

---

## Architecture Quick Reference

| Service | Port | Purpose |
|---------|------|---------|
| ehr-frontend | 3000 | Doctor/Nurse clinical EHR |
| tenant-service | 3001 | Super admin, tenant management |
| grafana | 3012 | Monitoring dashboards |
| ehr-service | 3013 | Core clinical API |
| web-app | 3011 | Super admin web UI |
| patient-portal | 3015 | Patient-facing portal |
| cdss-service | 8082* | AI/CDSS Python service (RAG, LLM) |
| cdss-worker | — | Background job processor |

*check `PORT_CDSS_SERVICE` in your `.env`

---

## Known Remaining Issues / Next Things To Do

1. **Verify guidelines search works** after restarting cdss-service (see top of this doc)
2. **"White boxes" in other modals** — the AI Guidelines modal was fixed with dark glassmorphism design; other modals across the EHR frontend (NurseDashboard vitals modal, assessment modal, etc.) may still have `bg-white` close buttons with `text-white` icons → low-contrast. Can do a systematic pass if needed.
3. **CDSS search with no Ollama** — if Ollama isn't running, LLM analysis is `null` but ChromaDB citations should still be returned. Confirm this works end-to-end.
4. **Production deploy** — `docker-compose.prod.yml` is ready. When deploying: run `bash scripts/validate-secrets.sh` first, then `docker compose -f docker-compose.prod.yml up -d`.
