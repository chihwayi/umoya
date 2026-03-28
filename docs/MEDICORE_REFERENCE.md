# MediCore Reference

**Last updated:** 2026-03-28
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
├── app.module.ts           ← TypeORM entity registration (add new entities HERE)
├── controllers/            ← HTTP route handlers
├── services/               ← Business logic + CDSS proxy calls
├── entities/               ← TypeORM entity classes → PostgreSQL tables
├── dto/                    ← Request/response DTOs
└── transformers/           ← Column transformers (e.g. encryption)
```

Key packages: `@nestjs/core ^10`, `typeorm ^0.3.17`, `@nestjs/jwt`, `class-validator`, `ioredis`, `minio`.

TypeORM config (entities array): `services/ehr-service/src/services/tenant.service.ts`

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

### 3.4 Adding a CDSS Endpoint (Python)

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
| Add a TypeORM entity | `services/ehr-service/src/entities/` |
| Register entity | `services/ehr-service/src/services/tenant.service.ts` → `entities:[]` |
| Add provisioning SQL | `services/tenant-service/src/services/database-provisioning.service.ts` |
| Add EHR API endpoint | `services/ehr-service/src/controllers/` + `src/services/` |
| Add CDSS endpoint | `services/cdss-service/main.py` |
| Add frontend API call | `ehr-frontend/src/services/api.ts` |
| Add frontend component | `ehr-frontend/src/components/` |
| Add patient portal page | `patient-portal/src/pages/` + `App.tsx` |
| HIPAA audit logging | `services/ehr-service/src/services/hipaa-audit.service.ts` |
| Consent checking | `services/ehr-service/src/services/consent.service.ts` |
| Encryption transformer | `services/ehr-service/src/transformers/encryption.transformer.ts` |
| Module registration | `services/ehr-service/src/app.module.ts` |

---

## 9. AI-First Maturity — Completion Record

All 61 AI-First recommendations addressed across Sprints 111–125. Zero open gaps.

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

**Sprint history (condensed):** S59–S95 core EHR build → S96–S102 AI gap closure → S104–S108 telemedicine + PostVisit → S111–S118 AI-First hardening + frontend transparency → S119–S123 Order Intelligence, Nursing Suite, Med Rec AI, Discharge, Self-Learning → S124 Mobile point-of-care (8 features) → S125 Mobile backend wiring (7 endpoint gaps closed).

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

### 11.2 Mobile — Status: Complete (Sprint 124–125)

The React Native mobile app (`mobile/`) is feature-complete and production-ready for all three roles.

**Doctor:** Ward rounds, patient bedside summary, vitals + trending, AI CDSS tools, differential diagnosis, drug interactions, lab interpretation, imaging text reports, medication reconciliation, escalations, messaging.

**Nurse:** Shift worklist with task completion, triage queue (ESI levels), vitals entry with CDSS insights, SBAR generation, fall risk assessment, messaging.

**Patient:** Home dashboard, appointments (book/cancel), medications + adherence, post-visit AI chat, billing + payments, health records + care gaps, telemedicine (Daily.co).

All 20 mobile service modules call real EHR-service endpoints. `POST /governed/json` routing hub wires all CDSS AI surfaces. Zero TypeScript errors. Zero mock data.

**Before app store submission:** Fill EAS project ID in `mobile/app.json`, add `google-services.json` for FCM, configure signing certificates.

Full mobile reference: `docs/MEDICORE_MOBILE_REFERENCE.md`

### 11.3 Release Sequencing

If capacity is constrained, release in this order:
1. Platform stability + regression baseline (mandatory foundation)
2. HIV registry + intervention engine (establish dominance)
3. Doctor-nurse closed-loop (establish operational coordination superiority)
4. Revenue cycle intelligence (strengthen commercial ROI)

Keep out until after this: broad new specialty expansion, cosmetic redesign, low-value AI demos without measurable clinical or financial impact.
