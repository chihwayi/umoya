# MediCore Session History — Resume Point

**Last updated:** 2026-03-29
**Branch:** `main` (all changes committed and pushed)

---

## IMMEDIATE ACTION REQUIRED (do this first when resuming)

The last thing done was fixing the CDSS guidelines search timeout chain.
**You must restart the cdss-service to pick up the new env var:**

```bash
docker compose up -d --no-deps cdss-service
```

Then test by searching "Sepsis Protocol" in AI Clinical Guidelines on the Nurse Dashboard (port 3000). You should get real RAG results in ~22 seconds (not 150s of loading + fallback).

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
