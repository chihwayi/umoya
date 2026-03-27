# MediCore AI-First Development Master Guide
### For AI Agents and Human Developers — Read This Before Every Sprint

**Version:** 1.0.0
**Created:** 2026-03-27
**Motto:** AI-First, Human-Last — AI does the work, the human authorizes.
**Companion sprints:** SPRINT_112 through SPRINT_117

---

## 0. How to Use This Document Set

This master guide is the **ground truth** for all AI-first sprints. Every sprint document references back here for architecture, patterns, conventions, and anti-hallucination rules.

**Before writing a single line of code**, any agent or developer MUST:
1. Read sections 1–5 of this document (tech stack, architecture, patterns)
2. Read the specific sprint document fully
3. Verify all file paths by using `ls` or `Glob` before editing
4. Never invent endpoint paths, table names, or service methods — look them up

---

## 1. Complete Tech Stack

### 1.1 Services Map

| Service | Language/Framework | Port | Docker Name |
|---------|-------------------|------|-------------|
| EHR Service (API) | NestJS 10 + TypeScript | 3013 | ehr-service |
| CDSS Service (AI) | FastAPI + Python 3.11 | 8000 | cdss-service |
| EHR Frontend (Clinician) | React 18 + TypeScript + Tailwind | 3000 | ehr-frontend |
| Patient Portal | React 19 + TypeScript + Tailwind | 3001 | patient-portal |
| Tenant Service | NestJS 10 + TypeScript | 3014 | tenant-service |
| PostgreSQL | Postgres 15 Alpine | 5432 | medicore-postgres-master |
| MinIO (Object Storage) | MinIO | 9000/9001 | medicore-minio |
| Redis | Redis 7 | 6379 | medicore-redis |

### 1.2 EHR Service (NestJS)

```
services/ehr-service/
├── src/
│   ├── app.module.ts           ← TypeORM entity registration (add new entities HERE)
│   ├── controllers/            ← HTTP route handlers
│   ├── services/               ← Business logic + CDSS proxy calls
│   ├── entities/               ← TypeORM entity classes → PostgreSQL tables
│   ├── dto/                    ← Request/response data transfer objects
│   └── generated/              ← Auto-generated alignment bundles (do not hand-edit)
```

**Key packages:**
- `@nestjs/core ^10.0.0` — Framework
- `typeorm ^0.3.17` — ORM (all DB access via TypeORM DataSource)
- `@nestjs/jwt` — JWT auth
- `class-validator`, `class-transformer` — DTO validation
- `ioredis` — Redis for caching/pub-sub
- `minio` — Object storage client

**TypeORM config location:** `services/ehr-service/src/services/tenant.service.ts`
All entities that TypeORM manages MUST be added to the `entities: []` array in that file.

### 1.3 CDSS Service (FastAPI/Python)

```
services/cdss-service/
├── main.py                     ← All FastAPI routes + business logic
├── settings_provider.py        ← LLM provider config (Ollama / Anthropic / OpenAI)
├── requirements.txt            ← Python dependencies
├── evaluation/
│   ├── fixtures/               ← Eval case JSON files
│   └── run_release_gate_suite.py
└── tests/
```

**Key packages:**
- `fastapi>=0.115.0` — HTTP framework
- `sentence-transformers>=2.3.0` — Embeddings for RAG
- `chromadb>=0.6.0` — Current vector store (being replaced by pgvector in Sprint 114)
- `scikit-learn==1.3.2` — ML models
- `torch>=2.1.1` + `transformers>=4.37.0` — LLM inference
- `rank_bm25==0.2.2` — BM25 keyword retrieval fallback
- `unstructured[pdf]>=0.11.0` — PDF parsing

**LLM Model:** `LLM_MODEL_NAME=llama3.1:latest` (env var, via Ollama at `LLM_API_URL`)
**CDSS Feedback DB (BROKEN):** Currently writes to `$TMPDIR/medicore_cdss_feedback.sqlite3` — Sprint 112 fixes this.

### 1.4 Frontend (EHR + Patient Portal)

```
ehr-frontend/
├── src/
│   ├── components/             ← Reusable UI components (AI widgets live here)
│   ├── pages/                  ← Page-level components
│   ├── services/api.ts         ← All HTTP calls to EHR service
│   └── hooks/                  ← Custom React hooks
patient-portal/
├── src/
│   ├── pages/                  ← Full portal pages
│   ├── services/api.ts         ← HTTP calls to EHR service
│   └── App.tsx                 ← Routes
```

**Key packages:**
- `react 18/19`, `react-router-dom ^6` — SPA framework
- `tailwindcss ^3` + `@tailwindcss/forms` — Styling (use Tailwind classes only, no CSS files)
- `lucide-react ^0.548` — Icons (import named icons: `import { Brain, Sparkles } from 'lucide-react'`)
- `recharts` — Charts (used in VitalsPanel)
- No UI component library — custom components only with Tailwind

**API base URL pattern:** All frontend API calls go to `http://localhost:3013` (EHR service).
**Auth pattern:** Bearer token in Authorization header, X-Tenant-ID header required for all calls.

### 1.5 Database

- **Engine:** PostgreSQL 15
- **Multi-tenant:** Each tenant has its own database named `clinic_<slug>_db`
- **Master DB:** `medicore` — tenant registry, no patient data
- **ORM:** TypeORM with `synchronize: false` — schema managed exclusively via provisioning bundles
- **Connection:** Docker container `medicore-postgres-master` on port 5432

---

## 2. Architecture Patterns — Must Follow Exactly

### 2.1 How Every AI Call Works (The Governed Path)

**NEVER call the CDSS service directly from a controller.** Always go through `CdssService` in the EHR service.

```typescript
// CORRECT — in any EHR service (services/*.service.ts)
constructor(private readonly cdssService: CdssService) {}

const result = await this.cdssService.callGovernedJson({
  surface: 'vitals_interpretation',   // identifies the AI surface for audit
  patientId: patient.id,
  tenantId: this.tenantId,
  encounterId: encounterId,           // optional
  task: 'interpret_vitals',
  payload: { vitals, history },
  outputSchema: VitalsInterpretationSchema,  // Zod or class-validator schema
});
```

The `CdssService.callGovernedJson()` method:
1. Calls CDSS `/governed/json` endpoint
2. Logs to `prompt_audit_log` via `recordGovernedPromptAudit()`
3. Handles circuit breaker (5 failures → 30s open)
4. Enforces tenant isolation via X-Tenant-ID header
5. Returns typed, validated response

**Direct CDSS endpoints** (non-governed, for specific integrations) must still go through `CdssService` proxy methods — never raw `fetch` or `axios` from a service.

### 2.2 How to Add a New Database Table

There are **three things** that must happen together. If any one is missing, a new tenant will not get the table.

**Step 1: Create the TypeORM entity**
```typescript
// services/ehr-service/src/entities/my-feature.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('my_feature_table')
export class MyFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  // ... columns matching the SQL below exactly

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Column naming rule:** TypeScript uses camelCase (`patientId`), SQL uses snake\_case (`patient_id`). Always specify `name:` in the Column decorator.

**Step 2: Register the entity in TypeORM**
```typescript
// services/ehr-service/src/services/tenant.service.ts
// Find the entities: [] array and ADD your entity class
import { MyFeature } from '../entities/my-feature.entity';
// ... in the entities array:
entities: [
  // ... existing entities ...
  MyFeature,
],
```

**Step 3: Add to provisioning bundle**
```typescript
// services/tenant-service/src/services/database-provisioning.service.ts

// In getSchemaVersionBundles() array, ADD a new bundle entry:
{
  id: 'sprint_NNN_my_feature',
  label: 'Sprint NNN - My Feature',
  version: 'YYYY.MM.DD.N',         // increment .N if same date
  description: 'my_feature_table — what it stores',
  statements: () => this.getSprintNNNMyFeatureStatements(),
},

// ADD the private method at the bottom of the class:
private getSprintNNNMyFeatureStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS my_feature_table (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      -- ... all columns from entity ...
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_my_feature_patient ON my_feature_table (patient_id)`,
  ];
}
```

**Bundle version format:** `YYYY.MM.DD.N` where N starts at 1 and increments for multiple bundles on the same day.

**After adding a bundle:** Run `./scripts/provision-repair-all.sh` to apply to all existing tenants.

### 2.3 How the CDSS `/governed/json` Endpoint Works

**URL:** `POST http://cdss-service:8000/governed/json`

**Request body:**
```json
{
  "surface": "string — identifies the AI surface (e.g., vitals_risk, pharmacy_counseling)",
  "task": "string — specific task within the surface",
  "patient_context": {
    "patient_id": "uuid",
    "tenant_id": "string",
    "age": 45,
    "gender": "M",
    "conditions": ["hypertension"],
    "medications": ["lisinopril 10mg"],
    "allergies": ["penicillin"]
  },
  "payload": {},          // task-specific data
  "output_schema": {},    // JSON Schema the response must conform to
  "governance": {
    "require_citations": true,
    "max_confidence": 1.0,
    "abstain_if_uncertain": true,
    "phi_guard": true
  }
}
```

**Response body:**
```json
{
  "surface": "vitals_risk",
  "result": {},              // conforms to output_schema
  "confidence": 0.87,
  "citations": [{"text": "...", "source": "WHO 2023", "url": "..."}],
  "abstained": false,
  "abstain_reason": null,
  "model_id": "llama3.1:latest",
  "latency_ms": 1240
}
```

**Important:** If `abstained: true`, the calling service must handle gracefully — do NOT surface an error to the user, surface a "needs clinician review" state.

### 2.4 Frontend API Call Pattern

All API calls in the frontend go through `services/api.ts`. **Never use fetch/axios directly in components.**

```typescript
// ehr-frontend/src/services/api.ts — ADD new functions here
export const getMyFeatureData = async (patientId: string): Promise<MyFeatureResponse> => {
  const response = await fetch(`${API_BASE_URL}/my-feature/${patientId}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'X-Tenant-ID': getTenantId(),
    },
  });
  if (!response.ok) throw new Error('Failed to fetch my feature data');
  return response.json();
};
```

**Component pattern:**
```typescript
// In component:
const [data, setData] = useState<MyFeatureResponse | null>(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  getMyFeatureData(patientId)
    .then(setData)
    .catch(console.error)
    .finally(() => setLoading(false));
}, [patientId]);
```

### 2.5 How to Add a CDSS Endpoint in Python

```python
# services/cdss-service/main.py — ADD after existing routes in the relevant section

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
    """
    Analyzes [what it does].
    Called by: EHR service MyFeatureService.analyzeFeature()
    Governance: routed through /governed/json
    """
    # implementation
    pass
```

---

## 3. Critical Rules — Anti-Hallucination Contract

These rules exist because AI agents have generated incorrect code by guessing. Violating these causes broken builds.

### 3.1 File Path Rules
- **ALWAYS** verify a file exists before editing: use `Glob` or `ls`
- **NEVER** guess an import path — trace the actual export from the file
- Entity files: `services/ehr-service/src/entities/*.entity.ts`
- Service files: `services/ehr-service/src/services/*.service.ts`
- Controller files: `services/ehr-service/src/controllers/*.controller.ts`
- CDSS routes: all in `services/cdss-service/main.py` (one file)

### 3.2 Database Rules
- **NEVER** use TypeORM `synchronize: true` — schema is managed by provisioning only
- **NEVER** run raw SQL against a tenant DB without `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- **ALWAYS** add both entity + TypeORM registration + provisioning bundle together
- Column names in SQL must **exactly** match the `name:` property in the TypeORM `@Column` decorator

### 3.3 CDSS Call Rules
- **ALL** CDSS calls from EHR service MUST go through `CdssService` — not direct HTTP
- **ALL** CDSS calls that touch PHI MUST call `recordGovernedPromptAudit()` — already done by `callGovernedJson()`
- **NEVER** pass raw patient name, address, or national ID to CDSS — use patient_id only; CDSS fetches context internally
- **ALWAYS** handle `abstained: true` in the response

### 3.4 TypeScript Rules
- DTOs in `services/ehr-service/src/dto/` — use `class-validator` decorators
- All service methods that call CDSS are `async` and return `Promise<T>`
- Inject dependencies via NestJS constructor injection — never `new ServiceName()`
- Add new services to the `providers:` array in the relevant module

### 3.5 Frontend Rules
- **ALL** Tailwind classes must exist in Tailwind v3 — no arbitrary values without `[]` syntax
- **NEVER** add inline `style={{}}` — use Tailwind classes
- Icon imports: `import { IconName } from 'lucide-react'` — verify icon name exists
- API calls: only in `services/api.ts` or custom hooks — never in render functions
- Confidence scores display: always show as percentage `(confidence * 100).toFixed(0)%`

---

## 4. HIPAA Compliance Requirements

Every feature that touches patient data must follow these rules:

### 4.1 PHI Access Logging
```typescript
// services/ehr-service/src/services/hipaa-audit.service.ts
await this.hipaaAuditService.logPhiAccess({
  userId: requestingUserId,
  action: 'ai_recommendation_viewed',    // descriptive action name
  resourceType: 'patient_ai_session',
  resourceId: sessionId,
  patientId: patientId,
  ipAddress: req.ip,
  dataAccessed: ['ai_summary', 'risk_level'],  // field-level tracking
  riskLevel: 'medium',
});
```

### 4.2 Consent Check (Sprint 112 adds this gate)
Before any CDSS call that processes PHI:
```typescript
const hasConsent = await this.consentService.checkAiConsent(patientId, 'cdss_ai_processing');
if (!hasConsent) throw new ForbiddenException('Patient consent required for AI processing');
```

### 4.3 Encryption at Rest
Sensitive fields (SOAP notes, ambient transcripts, diagnoses) must use:
```typescript
@Column({ type: 'text', transformer: encryptionTransformer })
soapNote: string;
// encryptionTransformer is in: services/ehr-service/src/transformers/encryption.transformer.ts
```

### 4.4 Prompt Audit
Already handled by `CdssService.callGovernedJson()` — no extra work needed if you use the governed path.

---

## 5. Provisioning Bundle Reference

### Current Last Bundle Version
`sprint111_entity_completeness` → version `2026.03.26.2`

### New Sprint Bundles (versions to use)
| Sprint | Bundle ID | Version |
|--------|-----------|---------|
| Sprint 112 | sprint112_p0_safety | 2026.03.27.1 |
| Sprint 112 | sprint112_feedback_persistence | 2026.03.27.2 |
| Sprint 113 | sprint113_ui_completeness | 2026.03.27.3 |
| Sprint 114 | sprint114_clinical_rag | 2026.03.28.1 |
| Sprint 115 | sprint115_denial_prediction | 2026.03.28.2 |
| Sprint 116 | sprint116_risk_stratification | 2026.03.29.1 |
| Sprint 116 | sprint116_self_learning | 2026.03.29.2 |

### After Every Sprint
1. Run `./scripts/provision-repair-all.sh` to apply new bundles to all tenants
2. Run `node scripts/generate-tenant-provisioning-alignment.mjs` to regenerate the alignment bundle
3. Commit both the provisioning changes and the regenerated alignment bundle

---

## 6. Environment Variables Reference

These are set in `.env` at the repo root. All services read from Docker env.

| Variable | Value | Used By |
|----------|-------|---------|
| `LLM_MODEL_NAME` | `llama3.1:latest` | CDSS — LLM model |
| `LLM_API_URL` | `http://ollama:11434` | CDSS — LLM endpoint |
| `CDSS_SERVICE_URL` | `http://cdss-service:8000` | EHR — CDSS proxy |
| `CDSS_FEEDBACK_DB_PATH` | *(currently unset → /tmp)* | CDSS — feedback storage (**Sprint 112 fixes**) |
| `SERVICE_POSTGRES_HOST` | `postgres-master` | All services |
| `POSTGRES_USER` | `postgres` | All services |
| `POSTGRES_PASSWORD` | `postgres` | All services |
| `MINIO_ENDPOINT` | `medicore-minio:9000` | EHR — object storage |
| `REDIS_HOST` | `medicore-redis` | EHR, CDSS — caching |
| `ENCRYPTION_KEY` | *(must be set)* | EHR — column encryption (**Sprint 112**) |

---

## 7. CDSS Endpoint Registry

Complete list of all CDSS endpoints. **Do not invent new endpoint paths** — extend these or add new ones in `main.py`.

### Clinical Reasoning
| Endpoint | Method | Called By | Description |
|----------|--------|-----------|-------------|
| `/governed/json` | POST | All governed calls | Universal AI gateway |
| `/diagnosis/suggest` | POST | EncounterService | Differential diagnosis |
| `/diagnosis/suggest/intelligent` | POST | PatientAiService | Advanced diagnosis + triage |
| `/guidelines/check` | POST | CdssService | Guideline adherence |
| `/guidelines/search` | POST | CdssService | RAG guideline retrieval |
| `/drugs/interactions/advanced` | POST | PharmacyIntelligenceService | Drug interaction check |
| `/patient/summarize` | POST | PostVisitService | Clinical summarization |
| `/labs/interpret` | POST | LabService | Lab result interpretation |
| `/care-gaps/detect` | POST | NurseService | Care gap detection |
| `/mental-health/screen` | POST | MentalHealthService | PHQ/GAD screening |
| `/mental-health/risk` | POST | MentalHealthService | Crisis risk assessment |
| `/inbox/triage` | POST | InboxTriageService | Priority assignment |
| `/risk/calculate` | POST | FinancialService | Risk score computation |
| `/risk/deterioration/ml` | POST | EarlyWarningService | ML deterioration prediction |
| `/analyze-image` | POST (multipart) | ImagingService | Medical image analysis |
| `/sdoh/screen` | POST | RegistrationService | SDOH questionnaire |
| `/registration/documents/analyze` | POST | DocumentService | Document OCR |
| `/patient/adherence/chat` | POST | PatientAiService | Adherence conversation |
| `/patient/symptom/check` | POST | PatientAiService | Symptom triage |
| `/formulary/optimize` | POST | PharmacyIntelligenceService | Formulary substitution |
| `/medications/duplicates` | POST | PharmacyIntelligenceService | Duplicate therapy check |
| `/medications/high-risk` | POST | PharmacyIntelligenceService | High-risk medication flag |

### Governance & Monitoring
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/feedback/outcome` | POST | Submit outcome feedback |
| `/feedback/outcome/review/{entry_id}` | PATCH | Approve/reject feedback |
| `/feedback/outcome/learning/claim` | POST | Claim entries for retraining |
| `/admin/status` | GET | CDSS health status |
| `/admin/models` | GET | Registered model list |
| `/admin/metrics` | GET | Prometheus metrics |
| `/fl/train-local` | POST | Federated learning round |

### New Endpoints (Added in Sprints 114–116)
| Endpoint | Sprint | Description |
|----------|--------|-------------|
| `/knowledge/search` | 114 | pgvector RAG knowledge base search |
| `/knowledge/ingest` | 114 | Ingest clinical document |
| `/claims/denial-predict` | 115 | Denial probability for a claim |
| `/patient/risk-stratify` | 116 | Patient risk tier computation |
| `/outcomes/ingest-batch` | 116 | Batch outcome ingestion |

---

## 8. Key File Quick Reference

| What You Need | Where to Find It |
|---------------|-----------------|
| Add a TypeORM entity | `services/ehr-service/src/entities/` |
| Register entity in ORM | `services/ehr-service/src/services/tenant.service.ts` — `entities:[]` array |
| Add provisioning SQL | `services/tenant-service/src/services/database-provisioning.service.ts` |
| Add an EHR API endpoint | `services/ehr-service/src/controllers/` + `services/ehr-service/src/services/` |
| Add a CDSS endpoint | `services/cdss-service/main.py` |
| Add a frontend API call | `ehr-frontend/src/services/api.ts` or `patient-portal/src/services/api.ts` |
| Add a frontend component | `ehr-frontend/src/components/` |
| Add a patient portal page | `patient-portal/src/pages/` + register in `patient-portal/src/App.tsx` |
| HIPAA audit logging | `services/ehr-service/src/services/hipaa-audit.service.ts` |
| Consent checking | `services/ehr-service/src/services/consent.service.ts` |
| Encryption transformer | `services/ehr-service/src/transformers/encryption.transformer.ts` |
| Module registration | `services/ehr-service/src/app.module.ts` |

---

## 9. Sprint Index

| Sprint | Title | Priority | Dependencies |
|--------|-------|----------|--------------|
| [Sprint 112](./SPRINT_112_P0_SAFETY_FOUNDATIONS.md) | P0 Safety Foundations | **MUST DO FIRST** | None |
| [Sprint 113](./SPRINT_113_UI_COMPLETENESS.md) | UI Completeness Pass | High | Sprint 112 |
| [Sprint 114](./SPRINT_114_CLINICAL_RAG.md) | Clinical RAG Knowledge Base | High | Sprint 112 |
| [Sprint 115](./SPRINT_115_DENIAL_PREDICTION.md) | Denial Prediction & Financial AI | Medium | Sprint 112 |
| [Sprint 116](./SPRINT_116_RISK_STRATIFICATION_SELF_LEARNING.md) | Risk Stratification & Self-Learning | High | Sprints 112–113 |
| [Sprint 117](./SPRINT_117_REGISTRATION_AND_RADIOLOGY_VIEWER.md) | Registration AI + DICOM Viewer | Medium | Sprint 114 |

---

## 10. Definition of "Done" — Global Standards

A feature is **done** when ALL of the following are true:
- [ ] TypeScript compiles with zero errors (`npx tsc --noEmit`)
- [ ] Entity created + registered in TypeORM + provisioning bundle added
- [ ] `./scripts/provision-repair-all.sh` runs successfully
- [ ] CDSS endpoint (if new) has a Pydantic request + response model
- [ ] All CDSS calls go through `CdssService.callGovernedJson()` or named proxy methods
- [ ] `recordGovernedPromptAudit()` called for every LLM interaction
- [ ] Frontend renders the AI data (not just logs it to console)
- [ ] Confidence scores displayed where available
- [ ] `abstained: true` response handled gracefully in UI
- [ ] HIPAA audit log called for all PHI access
- [ ] New env vars documented in `.env.example`
