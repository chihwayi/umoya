# MediCore Reference

**Last updated:** 2026-04-21
**Source-of-truth for:** system architecture, tech stack, AI governance patterns, reporting landscape, and competitive strategy.

---

## 1. Product & System Overview

MediCore is a multi-tenant EHR platform with three user-facing web applications and three backend services:

| App / Service | Role |
|---|---|
| `web-app/` | Super admin and tenant operations portal |
| `ehr-frontend/` | Clinician and staff workflow application |
| `patient-portal/` | Patient self-service application |
| `services/tenant-service/` | Tenant lifecycle, analytics, and backups |
| `services/ehr-service/` | Core clinical, operational, financial, and interoperability API |
| `services/cdss-service/` | Clinical decision support and AI service |

The system covers outpatient, inpatient, specialty, financial, interoperability, and AI-assisted workflows in one codebase.

### 1.1 Runtime Ports

| Component | Port | Notes |
|---|---|---|
| PostgreSQL master | 5432 | Master tenant registry and clinical backing store |
| Redis | 6379 | Queueing, caching |
| MinIO | 9000 / 9001 | Object storage for documents, backups, imaging |
| Tenant service | 3001 | NestJS API — Swagger at `/api/docs` |
| CDSS service | 8000 | FastAPI — Swagger at `/docs` |
| EHR service | 3013 | NestJS API — Swagger at `/api/docs` |
| Web admin portal | 3011 | React |
| EHR frontend | 3000 | React |
| Patient portal | 3015 | React |
| Prometheus | 9090 | Metrics |
| Grafana | 3012 | Dashboards |

### 1.2 Multi-Tenancy Model

- Master database stores tenant metadata, users, analytics, and controls.
- Tenant-specific databases are provisioned per clinic: `clinic_<slug>_db`.
- Clinical requests are tenant-scoped via `X-Tenant-ID` header.
- TypeORM uses `synchronize: false` — all schema changes go through provisioning bundles only.

### 1.3 Local Bring-Up

```bash
npm install
npm run lint
npm run test
docker compose up -d postgres-master redis minio tenant-service cdss-service cdss-worker ehr-service web-app ehr-frontend patient-portal
```

Useful URLs after boot:
- Tenant Swagger: `http://localhost:3001/api/docs`
- EHR Swagger: `http://localhost:3013/api/docs`
- CDSS Swagger: `http://localhost:8000/docs`
- Staff frontend: `http://localhost:3000`
- Admin portal: `http://localhost:3011`
- Patient portal: `http://localhost:3015`

---

## 2. Tech Stack

### 2.1 Services Map

| Service | Framework | Port | Docker Name |
|---|---|---|---|
| EHR Service | NestJS 10 + TypeScript | 3013 | ehr-service |
| CDSS Service | FastAPI + Python 3.11 | 8000 | cdss-service |
| EHR Frontend | React 18 + TypeScript + Tailwind | 3000 | ehr-frontend |
| Patient Portal | React 19 + TypeScript + Tailwind | 3015 | patient-portal |
| Tenant Service | NestJS 10 + TypeScript | 3001 | tenant-service |
| PostgreSQL | Postgres 15 Alpine | 5432 | medicore-postgres-master |
| MinIO | MinIO | 9000/9001 | medicore-minio |
| Redis | Redis 7 | 6379 | medicore-redis |

### 2.2 EHR Service (NestJS) Layout

```
services/ehr-service/src/
├── ehr.module.ts           ← Root module — controllers, providers, sub-module imports
├── controllers/            ← HTTP route handlers
├── services/               ← Business logic + CDSS proxy calls
├── entities/               ← TypeORM entity classes → PostgreSQL tables
├── dto/                    ← Request/response DTOs
├── transformers/           ← Column transformers (e.g. encryption)
├── tba/                    ← TBA sub-module (TbaModule, TbaService, TbaController)
├── interop/                ← DISA/SmartCare sub-module (DisaSmartcareModule)
├── lite/                   ← Low-bandwidth lite mode sub-module (LiteModule)
├── cultural/               ← Ubuntu cultural health sub-module (CulturalModule)
├── analytics/              ← UHC/SDG analytics (UhcAnalyticsService, scheduler, controller)
├── settings/               ← Language/i18n sub-module (LanguageModule)
├── ntd/                    ← NTD sub-module (NtdModule)
├── outbreak/               ← Outbreak protocol sub-module (OutbreakProtocolModule)
└── surveillance/           ← Surveillance sub-module (SurveillanceModule)
```

Key packages: `@nestjs/core ^10`, `typeorm ^0.3.17`, `@nestjs/jwt`, `class-validator`, `ioredis`, `minio`.

TypeORM config (entities array): `services/ehr-service/src/services/tenant.service.ts`

**Sub-module pattern:** Separate NestJS modules for cohesive functional areas. Each sub-module re-declares `TenantService` and `CdssService` in its own `providers:[]` — these are NOT inherited from `EhrModule`. Every sub-module must be added to `EhrModule`'s `imports:[]` array.

### 2.3 CDSS Service (FastAPI) Layout

```
services/cdss-service/
├── main.py                 ← All FastAPI routes + business logic
├── settings_provider.py    ← LLM provider config (Ollama / Anthropic / OpenAI)
├── requirements.txt
├── evaluation/
│   ├── fixtures/           ← Eval case JSON files
│   └── run_release_gate_suite.py
└── tests/
```

Key packages: `fastapi>=0.115`, `sentence-transformers>=2.3`, `scikit-learn==1.3.2`, `torch>=2.1`, `rank_bm25==0.2.2`, `unstructured[pdf]>=0.11`.

LLM model: `LLM_MODEL_NAME=llama3.1:latest` via Ollama at `LLM_API_URL`.

### 2.4 Frontend Layout

```
ehr-frontend/src/
├── components/             ← Reusable UI components (AI widgets live here)
├── pages/                  ← Page-level components
├── services/api.ts         ← ALL HTTP calls to EHR service
└── hooks/                  ← Custom React hooks

patient-portal/src/
├── pages/
├── services/api.ts
└── App.tsx                 ← Routes
```

Rules: Tailwind v3 only (no inline styles), `lucide-react` icons, no UI component library, all API calls go through `services/api.ts`.

---

## 3. Architecture Patterns

### 3.1 The Governed AI Call Path

**Never call CDSS directly from a controller.** All AI calls go through `CdssService.callGovernedJson()`.

```typescript
// In any EHR service (services/*.service.ts)
const result = await this.cdssService.callGovernedJson({
  surface: 'vitals_interpretation',
  patientId: patient.id,
  tenantId: this.tenantId,
  encounterId: encounterId,
  task: 'interpret_vitals',
  payload: { vitals, history },
  outputSchema: VitalsInterpretationSchema,
});
```

`callGovernedJson()` automatically:
1. Routes to CDSS `/governed/json`
2. Logs to `prompt_audit_log` via `recordGovernedPromptAudit()`
3. Enforces circuit breaker (5 failures → 30s open)
4. Enforces tenant isolation via `X-Tenant-ID`
5. Returns typed, validated response

**CDSS `governed/json` response shape:**
```json
{
  "surface": "vitals_risk",
  "result": {},
  "confidence": 0.87,
  "citations": [{"text": "...", "source": "WHO 2023", "url": "..."}],
  "abstained": false,
  "abstain_reason": null,
  "model_id": "llama3.1:latest",
  "latency_ms": 1240
}
```

If `abstained: true`, surface a "needs clinician review" state — never an error.

### 3.2 Adding a New Database Table

Three things must happen together — missing any one means new tenants won't get the table.

**Step 1 — Create the TypeORM entity** (`services/ehr-service/src/entities/*.entity.ts`):
```typescript
@Entity('my_feature_table')
export class MyFeature {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

Column naming: TypeScript camelCase, SQL snake_case — always specify `name:` in `@Column`.

**Step 2 — Register in TypeORM** (`services/ehr-service/src/services/tenant.service.ts` → `entities: []` array).

**Step 3 — Add provisioning bundle** (`services/tenant-service/src/services/database-provisioning.service.ts`):
```typescript
{
  id: 'sprint_NNN_my_feature',
  label: 'Sprint NNN - My Feature',
  version: 'YYYY.MM.DD.N',
  description: 'my_feature_table — what it stores',
  statements: () => this.getSprintNNNMyFeatureStatements(),
},
```

Bundle version format: `YYYY.MM.DD.N` where N increments for multiple bundles on the same day.

After adding: run `./scripts/provision-repair-all.sh` to apply to all existing tenants.

### 3.2.1 Non-Negotiable DB Change Rule

For every database change, this exact gate must be satisfied before committing code or moving to the next sprint task:

1. **Provision through the provisioning service**
   - The schema change must be added to the provisioning service/bundle first.
   - Never rely on manual DB edits or TypeORM sync.

2. **Run tenant repair**
   - Apply the change to current tenants immediately after provisioning.
   - If master DB changes are needed, run master provisioning too.

3. **Check the real database directly**
   - Verify the new table/column/index/constraint exists in the actual database.
   - Verify it is present not only in code, but in the current tenant databases too.
   - Do not assume provisioning succeeded without direct verification.

4. **Run quality gates before commit**
   - Lint must pass for the touched area.
   - Build/typecheck must pass for the touched area.
   - Tests must pass for the touched area.
   - No syntax errors or obvious bugs may remain in the changed code.

Only after all 4 are satisfied may the change be committed and the next sprint task begin.

### 3.3 Frontend API Call Pattern

All API calls go through `services/api.ts` — never `fetch`/`axios` directly in components.

```typescript
// ehr-frontend/src/services/api.ts
export const getMyFeatureData = async (patientId: string): Promise<MyFeatureResponse> => {
  const response = await fetch(`${API_BASE_URL}/my-feature/${patientId}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'X-Tenant-ID': getTenantId(),
    },
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
};
```

### 3.4 i18n / Locale Instruction Pattern (S155)

All LLM-powered CDSS endpoints support multilingual output. Every `*Request` model that reaches an LLM must have a `locale: str = "en"` field, and the prompt must end with `locale_instruction(req.locale)`.

```python
class MyRequest(BaseModel):
    # ... clinical fields ...
    locale: str = "en"         # always add this

@app.post("/cdss/my-feature")
async def my_feature(req: MyRequest):
    prompt = f"""
    ... clinical prompt ...
    """ + locale_instruction(req.locale)   # always append this
    return await call_governed_json(prompt, surface="my_feature", phi_present=True)
```

`locale_instruction()` is a no-op for `"en"` — it only adds text for the 7 other supported locales (`pt`, `fr`, `sw`, `zu`, `af`, `sn`, `nd`). Purely deterministic endpoints (rule-based, no LLM) do **not** need locale wiring.

Supported locale codes: `en` (English), `pt` (Portuguese), `fr` (French), `sw` (Swahili), `zu` (Zulu), `af` (Afrikaans), `sn` (Shona), `nd` (Ndebele).

---

### 3.5 Adding a CDSS Endpoint (Python)

```python
# services/cdss-service/main.py — add after existing routes

class MyFeatureRequest(BaseModel):
    patient_id: str
    tenant_id: str
    payload: dict

class MyFeatureResponse(BaseModel):
    result: dict
    confidence: float
    citations: list[dict]
    abstained: bool = False

@app.post("/my-feature/analyze", response_model=MyFeatureResponse)
async def analyze_my_feature(req: MyFeatureRequest):
    """Called by: EHR service MyFeatureService.analyzeFeature()"""
    pass
```

---

## 4. HIPAA Compliance Requirements

### 4.1 PHI Access Logging
```typescript
await this.hipaaAuditService.logPhiAccess({
  userId: requestingUserId,
  action: 'ai_recommendation_viewed',
  resourceType: 'patient_ai_session',
  resourceId: sessionId,
  patientId: patientId,
  ipAddress: req.ip,
  dataAccessed: ['ai_summary', 'risk_level'],
  riskLevel: 'medium',
});
```

### 4.2 Consent Check (before any CDSS PHI call)
```typescript
const hasConsent = await this.consentService.checkAiConsent(patientId, 'cdss_ai_processing');
if (!hasConsent) throw new ForbiddenException('Patient consent required for AI processing');
```

### 4.3 Encryption at Rest (sensitive columns)
```typescript
@Column({ type: 'text', transformer: encryptionTransformer })
soapNote: string;
// transformer: services/ehr-service/src/transformers/encryption.transformer.ts
```

Prompt audit is handled automatically by `callGovernedJson()` — no extra work needed.

---

## 5. Anti-Hallucination Contract

These rules prevent broken builds caused by AI agents guessing:

- **File paths:** Always verify with `Glob` or `ls` before editing. Never guess import paths.
- **Database:** Never use `synchronize: true`. Never run raw DDL without `IF NOT EXISTS`. Always add entity + registration + provisioning bundle together.
- **URLs/config:** Never hard-code service URLs. Always read them from env vars or centralized config.
- **Tenant schema changes:** Any database change must also update the tenant database provisioning service and be followed by tenant repair so current tenants receive the schema.
- **CDSS calls:** All EHR→CDSS calls go through `CdssService`. All PHI-touching calls use `callGovernedJson()`. Never pass raw patient PII to CDSS.
- **TypeScript:** DTOs use `class-validator`. All CDSS-calling methods are `async`. New services go in `providers:` array.
- **Frontend:** Tailwind v3 only. Verify icon names before using. Never call API in render functions. Display confidence as `(confidence * 100).toFixed(0)%`.

---

## 6. Environment Variables

| Variable | Value | Used By |
|---|---|---|
| `LLM_MODEL_NAME` | `llama3.1:latest` | CDSS — LLM model |
| `LLM_API_URL` | `http://ollama:11434` | CDSS — LLM endpoint |
| `CDSS_SERVICE_URL` | `http://cdss-service:8000` | EHR — CDSS proxy |
| `SERVICE_POSTGRES_HOST` | `postgres-master` | All services |
| `POSTGRES_USER` | `postgres` | All services |
| `POSTGRES_PASSWORD` | `postgres` | All services |
| `MINIO_ENDPOINT` | `medicore-minio:9000` | EHR — object storage |
| `REDIS_HOST` | `medicore-redis` | EHR, CDSS — caching |
| `ENCRYPTION_KEY` | *(must be set in prod)* | EHR — AES-256-GCM column encryption |
| `FEEDBACK_PG_DSN` | postgres DSN | CDSS — feedback persistence |

---

## 7. CDSS Endpoint Registry

Do not invent endpoint paths. Extend these or add new ones in `main.py`.

### Clinical Reasoning
| Endpoint | Method | Called By |
|---|---|---|
| `/governed/json` | POST | All governed AI calls |
| `/diagnosis/suggest` | POST | EncounterService |
| `/diagnosis/suggest/intelligent` | POST | PatientAiService |
| `/guidelines/check` | POST | CdssService |
| `/guidelines/search` | POST | CdssService (RAG-grounded) |
| `/drugs/interactions/advanced` | POST | PharmacyIntelligenceService |
| `/patient/summarize` | POST | PostVisitService |
| `/labs/interpret` | POST | LabService |
| `/care-gaps/detect` | POST | NurseService |
| `/mental-health/screen` | POST | MentalHealthService |
| `/mental-health/risk` | POST | MentalHealthService |
| `/inbox/triage` | POST | InboxTriageService |
| `/risk/calculate` | POST | FinancialService |
| `/risk/deterioration/ml` | POST | EarlyWarningService |
| `/analyze-image` | POST (multipart) | ImagingService |
| `/sdoh/screen` | POST | RegistrationService |
| `/registration/documents/analyze` | POST | DocumentService |
| `/patient/adherence/chat` | POST | PatientAiService |
| `/patient/symptom/check` | POST | PatientAiService |
| `/formulary/optimize` | POST | PharmacyIntelligenceService |
| `/medications/duplicates` | POST | PharmacyIntelligenceService |
| `/medications/high-risk` | POST | PharmacyIntelligenceService |
| `/knowledge/search` | POST | KnowledgeService (RAG) |
| `/knowledge/ingest` | POST | KnowledgeService |
| `/claims/denial-predict` | POST | ClaimsService |
| `/patient/risk-stratify` | POST | RiskStratificationService |
| `/outcomes/ingest-batch` | POST | OutcomeCollectionService |
| `/cdss/pharmacy/pdmp-check` | POST | PharmacyService |
| `/cdss/claims/denial-prediction` | POST | ClaimsService |
| `/cdss/claims/appeal-template` | POST | ClaimsService |
| `/cdss/imaging/attention-map` | POST | ImagingService |
| `/cdss/registration/sdoh-questions` | POST | RegistrationAiService |
| `/cdss/registration/sdoh-score` | POST | RegistrationAiService |
| `/cdss/registration/ocr-insurance-card` | POST (multipart) | RegistrationAiService |

### Africa / SADC Clinical Endpoints (S143–S161)
| Endpoint | Method | Sprint | Description |
|---|---|---|---|
| `/cdss/htn/step-therapy` | POST | S143 | WHO PEN hypertension step therapy guidance |
| `/cdss/htn/cvd-risk` | POST | S143 | Framingham/WHO 10-year CVD risk score |
| `/cdss/scd/hydroxyurea-dose` | POST | S144 | Sickle cell hydroxyurea dosing |
| `/cdss/scd/crisis-triage` | POST | S144 | Vaso-occlusive crisis triage and management |
| `/cdss/scd/complication-risk` | POST | S144 | Sickle cell complication risk stratification |
| `/cdss/epilepsy/aed-dose` | POST | S145 | AED dosing by seizure type and weight |
| `/cdss/epilepsy/drug-interactions` | POST | S145 | AED-drug interaction checker |
| `/cdss/epilepsy/status-epilepticus` | POST | S145 | Status epilepticus emergency protocol |
| `/cdss/zoonotic/assess` | POST | S146 | One Health zoonotic exposure risk assessment |
| `/cdss/maternal/emonc-classify` | POST | S147 | Facility EmONC classification (UN 9 signal functions) |
| `/cdss/maternal/death-audit-review` | POST | S147 | Maternal death Three Delays analysis + audit guide |
| `/cdss/ncd/diabetic-foot-risk` | POST | S148 | Wagner grade + amputation risk + referral triage |
| `/cdss/vhf/risk-triage` | POST | S150 | VHF (Ebola/Marburg/Lassa/Mpox/CCHF) risk triage |
| `/cdss/vhf/contact-trace` | POST | S150 | Contact tracing risk stratification |
| `/cdss/mpox/severity` | POST | S150 | Mpox severity scoring + antiviral indication |
| `/cdss/vhf/ihr-annex2` | POST | S152 | IHR Annex 2 PHEIC notification decision tree |
| `/cdss/ihr/annex2-assessment` | POST | S152 | IHR Annex 2 structured assessment |
| `/cdss/ebs/signal-triage` | POST | S152 | Event-Based Surveillance signal triage |
| `/cdss/ntd/leprosy-mdt` | POST | S153 | WHO leprosy MDT regimen selection |
| `/cdss/ntd/filariasis-safety` | POST | S153 | Loa loa MF safety gate for ivermectin/DEC |
| `/cdss/cbhi/claim-adjudication` | POST | S154 | CBHI claim fraud detection + adjudication |
| `/cdss/tba/risk-assessment` | POST | S156 | TBA-attended birth risk stratification |
| `/cdss/tba/home-birth-risk` | POST | S156 | Home birth safety risk scoring |
| `/cdss/interop/cross-border-continuity` | POST | S157 | SADC cross-border HIV ART continuity gap assessment |
| `/cdss/cultural/sdoh-risk` | POST | S159 | SDOH vulnerability risk score (HFIAS + WHO SDOH) |
| `/cdss/cultural/ubuntu-psychosocial` | POST | S159 | Ubuntu-adapted psychosocial risk + mhGAP triage |
| `/cdss/analytics/uhc-gap-analysis` | POST | S160 | UHC Service Coverage Index + SDG 3 gap analysis |
| `/cdss/ncid/duplicate-score` | POST | S161 | Patient deduplication match scoring |

### Governance & Monitoring
| Endpoint | Method | Description |
|---|---|---|
| `/feedback/outcome` | POST | Submit outcome feedback |
| `/feedback/outcome/review/{entry_id}` | PATCH | Approve/reject feedback |
| `/feedback/outcome/learning/claim` | POST | Claim entries for retraining |
| `/fl/train-local` | POST | Federated learning round |
| `/fl/model-version` | GET | Current model versions per surface |
| `/admin/status` | GET | CDSS health |
| `/admin/models` | GET | Registered models |
| `/admin/metrics` | GET | Prometheus metrics |

---

## 8. Key File Quick Reference

| What | Where |
|---|---|
| Add a TypeORM entity | `services/ehr-service/src/entities/` (or sub-module entities dir) |
| Register entity | `services/ehr-service/src/services/tenant.service.ts` → `entities:[]` |
| Add provisioning SQL | `services/tenant-service/src/services/database-provisioning.service.ts` |
| Add EHR API endpoint | `services/ehr-service/src/controllers/` + `src/services/` |
| Register service in DI | `services/ehr-service/src/ehr.module.ts` → `providers:[]` |
| Register controller in DI | `services/ehr-service/src/ehr.module.ts` → `controllers:[]` |
| Add sub-module | Create `*.module.ts`, add to `ehr.module.ts` → `imports:[]` |
| Add CDSS endpoint | `services/cdss-service/main.py` |
| Wire i18n to LLM prompt | Add `locale: str = "en"` to request model + `+ locale_instruction(req.locale)` at end of prompt string |
| Add frontend API call | `ehr-frontend/src/services/api.ts` |
| Add frontend component | `ehr-frontend/src/components/` |
| Add patient portal page | `patient-portal/src/pages/` + `App.tsx` |
| Add mobile screen | `mobile/` Expo app |
| HIPAA audit logging | `services/ehr-service/src/services/hipaa-audit.service.ts` |
| Consent checking | `services/ehr-service/src/services/consent.service.ts` |
| Encryption transformer | `services/ehr-service/src/transformers/encryption.transformer.ts` |
| Language preferences | `services/ehr-service/src/settings/language.module.ts` |

---

## 9. AI-First Maturity — Completion Record

All 61 AI-First recommendations addressed. Zero open gaps.

| Dimension | Status |
|---|---|
| HIPAA compliance | Consent guard, AES-256-GCM encryption, prompt audit log |
| AI signal visibility | 100% wired — confidence, abstention banners, FDA SaMD labels |
| Self-learning | PostgreSQL feedback → nightly eval → release gate → deploy |
| Drug safety | Hard-stop contraindications + PDMP check |
| Financial AI | Denial prediction, appeals, hardship routing |
| Patient risk stratification | 6-dimension composite risk tier + nightly batch |
| Knowledge grounding | pgvector + BM25 + RRF hybrid RAG — no hallucinated citations |
| AI observability | AI Ops Dashboard — accuracy, latency, fairness |
| Radiology AI | DICOM viewer + AI heatmap overlay (web), text reports (mobile) |
| Registration AI | Phonetic match + OCR + SDOH intake |
| Mobile AI (governed) | `POST /governed/json` hub: SBAR, fall risk, med rec, diagnosis, dosing, labs |
| Clinical trial matching | ClinicalTrials.gov v2 API (`/api/v2/studies`) integrated in post-visit |
| i18n / Multilingual AI | 8 languages — locale field on all LLM request models, `locale_instruction()` wired |
| NCID deduplication AI | Cross-facility patient deduplication with LLM-assisted match reasoning |
| UHC/SDG analytics | WHO UHC SCI composite + SDG 3 gap analysis (deterministic, quarterly scheduler) |

**Sprint history (complete):**
| Range | Summary |
|---|---|
| S1–S58 | Core EHR platform (multi-tenant, roles, billing, FHIR, HIV, TB, Maternity, Lab, Pharmacy, ED) |
| S59–S95 | 37-sprint AI-First build (proactive AI, care gaps, ambient scribe, specialty modules, federated learning) |
| S96–S102 | World-class gap closure (Radiology AI, real-time alerts, model drift, patient AI, trial matching, supply chain, CDSS) |
| S103 | Autonomous learning loop + model registry |
| S104–S108 | Telemedicine real video, WebSocket gateway, state machine, PostVisit bridge, God Class decomposition |
| S109–S111 | Mobile Expo app, ICD-11/SNOMED, encounter + pharmacy intelligence |
| S112–S118 | P0 safety, UI completeness, clinical RAG/pgvector, denial prediction, risk stratification, registration AI, DICOM viewer, AI transparency |
| S119–S123 | Order set AI, nursing care plan AI, med rec, discharge summary AI, A/B shadow mode + fairness metrics |
| S124–S125 | Mobile point-of-care (8 features) + mobile backend wiring (7 endpoint gaps closed) |
| S126 | Reporting completeness — lab turnaround, compliance finance reports |
| S127–S128 | Proactive AI Nervous System + AI cohesion |
| S129–S134 | EPI/Immunization, Outbreak surveillance, Mobile money, CHW module, SAM/CMAM nutrition, NHIF/CBHI billing |
| S135–S140 | SA national interop, DHIS2/DATIM, SMS/USSD (Africa's Talking), OpenMRS FHIR, CRVS, NTD/malaria depth |
| S141–S146 | mhGAP psychiatry, Cervical cancer + FP, HTN + WHO PEN, Traditional medicine + HDI safety, Sickle cell disease, Epilepsy + AED protocols, One Health + PACTR |
| S147–S149 | Maternal Mortality Audit + EmONC, NCD Complication Registry (diabetic foot/retinopathy/CKD), NHIF/CBHI capitation |
| S150–S153 | Mpox/Ebola/VHF case management, Plague/Yellow Fever/Meningitis, SORMAS + IHR Annex 2 pipeline, NTD clinical depth (Leprosy/Filariasis) |
| S154–S156 | CBHI deep module (household registry + fraud CDSS), Language Pack i18n (8 languages), TBA rural birth registration + CRVS auto-notification |
| S157–S161 | DISA Mozambique VL/EID + SmartCare Zambia ART, Low-bandwidth lite mode + PWA + USSD data entry, Ubuntu cultural health (SDOH/family council/psychosocial), UHC SCI + SDG 3 indicators, NCID national client ID + cross-facility deduplication |
| S162–S163 | Mobile: Herb-drug interaction alert in DoctorRoundsScreen ward round modal; PACTR trial eligibility badge in DoctorAIScreen Specialty Actions |
| S164–S167b | Mobile security hardening + offline mode: biometric login gate with `LockScreen` overlay (S164); FCM push notifications — `expo-notifications`, Android channel, `POST /push-tokens` backend, token registration (S165); session auto-lock — AppState background lock + 5-min inactivity timer via `useSessionLock` + `ActivityTracker` (S166); offline read cache — axios interceptor caches all GET responses to AsyncStorage (6h TTL), amber `OfflineBanner`, `useNetworkStore` (S167a); offline write queue — `OfflineQueue` + `useOfflineSync` queues vitals and task-complete writes when offline, auto-drains on network restore, pending badge in NurseShiftScreen (S167b). JWT ↔ tenant cross-validation security fix: `tenantId` embedded in JWT at login, `JwtAuthGuard.handleRequest` cross-checks against `X-Tenant-ID` header — tokens from one clinic cannot replay against another. |

---

## 10. Definition of Done

A feature is **done** only when all of the following are true:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] Entity + TypeORM registration + provisioning bundle added together
- [ ] `./scripts/provision-repair-all.sh` runs successfully
- [ ] New CDSS endpoint has Pydantic request + response model
- [ ] All CDSS calls go through `CdssService.callGovernedJson()` or named proxy methods
- [ ] `recordGovernedPromptAudit()` called for every LLM interaction
- [ ] Frontend renders the AI data (not just logs to console)
- [ ] Confidence scores displayed as percentage where available
- [ ] `abstained: true` handled gracefully in UI
- [ ] HIPAA audit log called for all PHI access
- [ ] New env vars documented in `.env.example`

---

## 11. Reporting Landscape

### 10.1 What Exists

| Area | Module | Notes |
|---|---|---|
| Financial reports | `financial-reports.controller` | Revenue, P&L, cash flow, AR aging with filters |
| Analytics builder | `analytics.controller` | Templates, schedules, outcomes, metrics — export JSON/PDF/Excel/CSV |
| Legacy reports | `reports.controller` | Patient summary, financial (bill-based), clinical, appointments, labs — lab turnaround **hardcoded** |
| Module reports | `GET /reports/modules/:module/general` | MAR, blood_bank, sepsis, revenue_cycle, HIV, etc. |
| HIPAA audit | `hipaa-audit.controller` | Logs, summary, breach detection, disclosure report |
| Claims analytics | `claims.controller` | Analytics, dashboard summary, readiness worklist |
| DHIS2 | `dhis2.controller` | Aggregate sync: HIV monthly, immunizations, pharmacy stock, etc. |
| Health record exports | `health-records-export.service` | PDF, FHIR bundle, JSON, CSV — used by patient portal |
| Payment reconciliation | `payment-reconciliation.controller` | Reconciliation report by date range |
| Tenant analytics | `tenant-analytics.controller` | Platform-level per-tenant metrics |

### 10.2 Prioritized Gaps

**Tier 1 — Should do (compliance + finance + operations):**

1. **HIPAA Accounting of Disclosures (per patient)** — API exists (`admin-audit.controller → getDisclosureReport`). Expose in HIPAA Compliance Dashboard with patient selector and PDF/CSV export.
2. **SOC2/HIPAA evidence report** — `scripts/soc2-hipaa-evidence-report.js` is a stub. Wire to real audit DB counts (`hipaa_audit_log` entries by action/outcome). Run with: `DATABASE_URL=... npm run report:soc2-hipaa`.
3. **Lab turnaround (real)** — `reports.service.getLabResultsReport` returns hardcoded "2.5 days". Compute from `lab_orders` order/result timestamps.
4. **Tax report (Zimbabwe)** — `tax-management.controller` exists. Add `GET /tax-management/report?startDate=&endDate=` returning taxable revenue, VAT, withholding by period.
5. **Default report templates** — Analytics builder has no seed data. Add 3–5 canned templates per tenant: "Monthly revenue summary", "AR aging", "HIPAA audit summary", "Appointments by status".

**Tier 2 — Nice to have:**
- Referral report (`GET /referrals/report` — counts by direction, status, specialty)
- Immunization coverage report (by antigen and age group, align with DHIS2)
- Mortality/sentinel event report (only if data exists in admissions)

**Tier 3 — Optional:**
- Extend `tenant-analytics.service.generateTenantReport()` KPIs
- Platform SLA report (only if required for tenant contracts; otherwise keep in Grafana)

**Do not prioritize:** additional financial report engines (two already exist — consolidate toward `financial-reports`), more specialty dashboards before the Tier 1 reports above, or new patient export types without a specific regulatory ask.

### 10.3 Provisioning Note

To apply the full clinic schema to all existing tenants:
```bash
npm run provision:all-tenants
# or via API: POST /admin/tenants/repair-all (with admin auth)
```

---

## 12. Product Strategy — Depth Over Breadth

MediCore already has impressive breadth. The risk now is adding more. Strongest niche EHRs win on **workflow depth, operational polish, and repeatable outcomes** in a narrower domain.

### 11.1 Flagship Workflows to Deepen

- **HIV program management** — registry views by regimen/VL/EAC/TPT, longitudinal risk cards, outreach worklists, regimen change with structured audit, EAC session tracking
- **Doctor-nurse closed-loop coordination** — explicit handoff states, SLA timers, escalation aging, unified nurse→doctor queue
- **Revenue cycle intelligence** — real-time eligibility, denial work queue, payer aging by provider/service line, resubmission workflow
- **Post-visit AI and patient follow-through**

### 11.2 Mobile — Status: Complete (S124–S125, extended S143–S167b)

The React Native mobile app (`mobile/`) is feature-complete and production-ready for all three roles.

**Doctor:**
- Ward rounds with bedside patient detail modal (AI Summary, Herb-Drug Interaction alert, Active Alerts, Vitals + Trending, Round Note)
- Herb-drug interaction card (S162): fires `CdssService.checkHerbDrugInteractions()` non-blocking; surfaces traditional medicine disclosure warnings with severity-based border coloring
- CDSS AI tools: differential diagnosis, drug interactions, dose calculator, risk scores, WHO guidelines, lab interpretation
- PACTR clinical trial eligibility badge (S163): in Specialty Actions panel, patient MRN input triggers `GET /pactr/trials/eligible`
- Specialty Actions: Sepsis Watch, Oncology Snapshot, Blood Bank Safety, PACU Recovery, Critical Imaging, PACTR Trials
- Voice dictation (SOAP structuring), imaging text reports, medication reconciliation, escalations, messaging

**Nurse:**
- Shift worklist with task completion, triage queue (ESI levels), vitals entry with CDSS insights, SBAR generation, fall risk assessment, messaging
- NCD Crisis capture (S143–S145): structured point-of-care forms for SCD vaso-occlusive crisis, epilepsy seizure events, and NCD complications (HTN/diabetic/CKD) with AI protocol card
- Offline vitals submission (S167b): vitals queued to AsyncStorage when offline; auto-syncs when network returns; "N pending sync" badge visible in shift header

**Patient:**
- Home dashboard, appointments (book/cancel), medications + adherence, post-visit AI chat, telemedicine (Daily.co)
- Multilingual AI companion (S155): 6-language locale selector (EN/SW/SN/ZU/FR/PT) — re-fetches on language switch
- Ubuntu SDOH Wellbeing tab (S157–S159): `GET /cultural/social-determinants/:id/latest`, SDOH risk card + Ubuntu psychosocial assessment
- NHIF/CBHI insurance coverage card (S149): gradient card showing scheme, member number, status, co-pay %, benefit balance
- Billing + payments, health records + care gaps

**Security & Reliability (S164–S167b):**
- **Biometric login gate (S164):** `LockScreen` overlay shown on app launch when JWT exists — auto-triggers Face ID / fingerprint via `expo-local-authentication`. Navigation state preserved under overlay. `isUnlocked` / `lock()` / `unlock()` in `useAuthStore`.
- **Push notifications (S165):** `expo-notifications` wired — permission request, Android `medicore-critical` channel, Expo push token → `POST /push-tokens` (upsert per user). `push_tokens` table in each tenant DB.
- **Session auto-lock (S166):** `useSessionLock` hook — `AppState` listener locks immediately on background; 5-min inactivity timer resets on any touch via `ActivityTracker` gesture wrapper.
- **Offline read cache (S167a):** All axios GET responses saved to AsyncStorage (6h TTL) via response interceptor. `ERR_NETWORK` falls back to cache — every screen shows last known data. `useNetworkStore` (`isOnline` Zustand store). Amber slide-in `OfflineBanner`. Read cache wiped on logout/clinic-change (PHI hygiene).
- **Offline write queue (S167b):** `OfflineQueue` (AsyncStorage) + `useOfflineSync` hook drains on foreground/network-restore. `VitalsService.record()` and `NurseWorklistService.completeTask()` enqueue on network error instead of showing an error dialog. Write queue intentionally survives logout so queued vitals sync after re-authentication.

All mobile service modules call real EHR-service endpoints. `POST /governed/json` routing hub wires all CDSS AI surfaces. `npx tsc --noEmit` → 0 errors. Zero mock data.

**Before app store submission:**
- Fill EAS project ID in `mobile/app.json`
- Add `google-services.json` (Android FCM) and `GoogleService-Info.plist` (iOS APNs) — Expo managed push works without these for dev builds; production EAS builds require them
- Configure signing certificates (EAS Build)

### 11.3 Release Sequencing

If capacity is constrained, release in this order:
1. Platform stability + regression baseline (mandatory foundation)
2. HIV registry + intervention engine (establish dominance)
3. Doctor-nurse closed-loop (establish operational coordination superiority)
4. Revenue cycle intelligence (strengthen commercial ROI)

Keep out until after this: broad new specialty expansion, cosmetic redesign, low-value AI demos without measurable clinical or financial impact.
