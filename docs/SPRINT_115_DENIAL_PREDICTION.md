# SPRINT 115 — Denial Prediction ML + Financial AI
### AI-First, Human-Last | MediCore Sprint Series

**Version:** 1.0.0
**Created:** 2026-03-26
**Depends on:** SPRINT_112 (consent guard, PostgreSQL feedback), SPRINT_114 (RAG / pgvector enabled)
**Master Guide:** `docs/AI_FIRST_MASTER_GUIDE.md` — READ BEFORE CODING

---

## AGENT BOOTSTRAP CHECKLIST

Before writing a single line of code:
- [ ] Read `docs/AI_FIRST_MASTER_GUIDE.md` sections 1–5
- [ ] Run `ls services/ehr-service/src/entities/` to verify entity files exist
- [ ] Run `grep -r "getSchemaVersionBundles" services/tenant-service/src/services/database-provisioning.service.ts` to find the bundle array
- [ ] Confirm `services/ehr-service/src/services/cdss.service.ts` exposes `callGovernedJson()`
- [ ] Confirm `services/ehr-service/src/app.module.ts` exists for entity registration
- [ ] Never invent table names — verify against existing entities in `services/ehr-service/src/entities/`

---

## Sprint Goal

Turn claims denial from a surprise event into a **pre-submission prediction** — AI scores every claim before it leaves the system, surfaces denial probability with reasons, generates an appeal template if denied, and routes financial hardship cases to assistance programs automatically.

**Outcome:** Zero surprise denials. Every claim has an AI risk score before submission. Appeal productivity increases by removing blank-page problem. Financial hardship never falls through the cracks.

---

## Recommendation Coverage

This sprint covers recommendations from the AI analysis:

| Recommendation | Source |
|---|---|
| Denial Prediction ML model (gradient boosted) | Financial AI analysis |
| Pre-submission claim risk scoring | Financial AI analysis |
| Denial reason surfacing (top 3 reasons) | Financial AI analysis |
| Appeal letter template generation | Financial AI analysis |
| Financial hardship auto-routing | Financial AI analysis |
| PDMP controlled substance check integration | Pharmacy safety analysis |
| Claims outcome feedback into self-learning loop | Self-learning analysis |
| Medical aid authorization pre-check | Financial AI analysis |

---

## Architecture Overview

```
Clinician submits claim
        │
        ▼
EHR: ClaimSubmissionController.submit()
        │
        ▼
ClaimsService.scoreBeforeSubmit()
        │
        ├──► CdssService.callGovernedJson({ surface: 'denial_prediction' })
        │           │
        │           ▼
        │    CDSS: /governed/json
        │    → DenialPredictionModel (XGBoost/sklearn)
        │    → Returns: risk_score (0-1), top_reasons[], confidence
        │           │
        │           ▼
        │    ClaimRiskScore entity saved
        │
        ├──► If risk_score >= 0.70: WARN clinician, require confirmation
        ├──► If risk_score >= 0.90: BLOCK submission, require senior override
        │
        ▼
Claim submitted → outcome recorded → feeds self-learning loop
        │
        ▼
If DENIED → AppealService.generateTemplate()
        │
        ▼
CdssService.callGovernedJson({ surface: 'appeal_template' })
        │
        ▼
CDSS: /governed/json → RAG-grounded appeal letter draft
```

```
PDMP Check (controlled substances):
PharmacyService.dispense()
        │
        ▼
CdssService.callGovernedJson({ surface: 'pdmp_check' })
        │
        ▼
CDSS: /cdss/pharmacy/pdmp-check
Returns: risk_level, morphine_equivalent_dose, prescriber_alerts[]
```

---

## Step 1: New Database Tables (Provisioning)

### 1.1 New TypeORM Entities

**File: `services/ehr-service/src/entities/claim-risk-score.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('claim_risk_scores')
export class ClaimRiskScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  @Index()
  claimId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  @Column({ name: 'risk_score', type: 'decimal', precision: 5, scale: 4 })
  riskScore: number;

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @Column({ name: 'top_reasons', type: 'jsonb', default: [] })
  topReasons: Array<{ code: string; description: string; weight: number }>;

  @Column({ name: 'model_version', type: 'varchar', length: 50 })
  modelVersion: string;

  @Column({ name: 'feature_snapshot', type: 'jsonb', default: {} })
  featureSnapshot: Record<string, unknown>;

  @Column({ name: 'threshold_action', type: 'varchar', length: 20, default: 'allow' })
  thresholdAction: 'allow' | 'warn' | 'block';

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string | null;

  @Column({ name: 'override_user_id', type: 'uuid', nullable: true })
  overrideUserId: string | null;

  @Column({ name: 'actual_outcome', type: 'varchar', length: 30, nullable: true })
  actualOutcome: 'approved' | 'denied' | 'partial' | 'appealed' | null;

  @Column({ name: 'feedback_recorded_at', type: 'timestamptz', nullable: true })
  feedbackRecordedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**File: `services/ehr-service/src/entities/claim-appeal.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('claim_appeals')
export class ClaimAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'claim_id', type: 'uuid' })
  @Index()
  claimId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'denial_reason_code', type: 'varchar', length: 50 })
  denialReasonCode: string;

  @Column({ name: 'denial_reason_description', type: 'text' })
  denialReasonDescription: string;

  @Column({ name: 'draft_letter', type: 'text' })
  draftLetter: string;

  @Column({ name: 'rag_sources', type: 'jsonb', default: [] })
  ragSources: Array<{ documentId: string; title: string; excerpt: string; relevanceScore: number }>;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'draft' })
  status: 'draft' | 'submitted' | 'won' | 'lost' | 'withdrawn';

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'outcome_at', type: 'timestamptz', nullable: true })
  outcomeAt: Date | null;

  @Column({ name: 'outcome_notes', type: 'text', nullable: true })
  outcomeNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**File: `services/ehr-service/src/entities/financial-hardship-referral.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('financial_hardship_referrals')
export class FinancialHardshipReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'claim_id', type: 'uuid', nullable: true })
  claimId: string | null;

  @Column({ name: 'trigger_reason', type: 'varchar', length: 100 })
  triggerReason: string;

  @Column({ name: 'household_size', type: 'int', nullable: true })
  householdSize: number | null;

  @Column({ name: 'estimated_income_band', type: 'varchar', length: 30, nullable: true })
  estimatedIncomeBand: string | null;

  @Column({ name: 'programs_matched', type: 'jsonb', default: [] })
  programsMatched: Array<{ name: string; code: string; eligibility: string; url: string }>;

  @Column({ name: 'assigned_to_user_id', type: 'uuid', nullable: true })
  assignedToUserId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'pending' })
  status: 'pending' | 'contacted' | 'enrolled' | 'ineligible' | 'declined';

  @Column({ name: 'ai_recommendation', type: 'text', nullable: true })
  aiRecommendation: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**File: `services/ehr-service/src/entities/pdmp-check.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('pdmp_checks')
export class PdmpCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'prescriber_id', type: 'uuid' })
  prescriberId: string;

  @Column({ name: 'drug_name', type: 'varchar', length: 200 })
  drugName: string;

  @Column({ name: 'dea_schedule', type: 'varchar', length: 10, nullable: true })
  deaSchedule: string | null;

  @Column({ name: 'morphine_milligram_equivalent', type: 'decimal', precision: 8, scale: 2, nullable: true })
  morphineMilligramEquivalent: number | null;

  @Column({ name: 'risk_level', type: 'varchar', length: 20 })
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';

  @Column({ name: 'prescriber_alerts', type: 'jsonb', default: [] })
  prescriberAlerts: Array<{ type: string; message: string; severity: string }>;

  @Column({ name: 'other_active_prescriptions', type: 'jsonb', default: [] })
  otherActivePrescriptions: Array<{ drug: string; prescriber: string; date: string; quantity: number }>;

  @Column({ name: 'dispensing_blocked', type: 'boolean', default: false })
  dispensingBlocked: boolean;

  @Column({ name: 'block_override_reason', type: 'text', nullable: true })
  blockOverrideReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

### 1.2 TypeORM Registration

**File to edit: `services/ehr-service/src/app.module.ts`**

Add all four new entities to the `entities: []` array:

```typescript
// ADD to the entities array in TypeOrmModule.forRootAsync (around existing entities):
import { ClaimRiskScore } from './entities/claim-risk-score.entity';
import { ClaimAppeal } from './entities/claim-appeal.entity';
import { FinancialHardshipReferral } from './entities/financial-hardship-referral.entity';
import { PdmpCheck } from './entities/pdmp-check.entity';

// In the entities array:
ClaimRiskScore,
ClaimAppeal,
FinancialHardshipReferral,
PdmpCheck,
```

### 1.3 Provisioning Bundle

**File to edit: `services/tenant-service/src/services/database-provisioning.service.ts`**

**Step A:** In `getSchemaVersionBundles()`, add entry AFTER the `sprint114_clinical_rag` entry:

```typescript
{
  version: '2026.03.29.1',
  name: 'sprint115_denial_prediction',
  statements: this.getSprint115DenialPredictionStatements(),
},
```

**Step B:** Add the private method (add BEFORE the closing brace of the class):

```typescript
private getSprint115DenialPredictionStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS claim_risk_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      encounter_id UUID,
      risk_score DECIMAL(5,4) NOT NULL,
      confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
      top_reasons JSONB NOT NULL DEFAULT '[]',
      model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
      feature_snapshot JSONB NOT NULL DEFAULT '{}',
      threshold_action VARCHAR(20) NOT NULL DEFAULT 'allow',
      override_reason TEXT,
      override_user_id UUID,
      actual_outcome VARCHAR(30),
      feedback_recorded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_claim_risk_scores_claim_id ON claim_risk_scores(claim_id)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_risk_scores_patient_id ON claim_risk_scores(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_claim_risk_scores_risk_score ON claim_risk_scores(risk_score DESC)`,

    `CREATE TABLE IF NOT EXISTS claim_appeals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id UUID NOT NULL,
      patient_id UUID NOT NULL,
      denial_reason_code VARCHAR(50) NOT NULL,
      denial_reason_description TEXT NOT NULL,
      draft_letter TEXT NOT NULL,
      rag_sources JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      submitted_at TIMESTAMPTZ,
      outcome_at TIMESTAMPTZ,
      outcome_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_claim_appeals_claim_id ON claim_appeals(claim_id)`,

    `CREATE TABLE IF NOT EXISTS financial_hardship_referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      claim_id UUID,
      trigger_reason VARCHAR(100) NOT NULL,
      household_size INT,
      estimated_income_band VARCHAR(30),
      programs_matched JSONB NOT NULL DEFAULT '[]',
      assigned_to_user_id UUID,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      ai_recommendation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_financial_hardship_patient_id ON financial_hardship_referrals(patient_id)`,

    `CREATE TABLE IF NOT EXISTS pdmp_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      prescriber_id UUID NOT NULL,
      drug_name VARCHAR(200) NOT NULL,
      dea_schedule VARCHAR(10),
      morphine_milligram_equivalent DECIMAL(8,2),
      risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
      prescriber_alerts JSONB NOT NULL DEFAULT '[]',
      other_active_prescriptions JSONB NOT NULL DEFAULT '[]',
      dispensing_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      block_override_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pdmp_checks_patient_id ON pdmp_checks(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pdmp_checks_risk_level ON pdmp_checks(risk_level)`,
  ];
}
```

---

## Step 2: CDSS — Denial Prediction Model

**File: `services/cdss-service/main.py`**

Add the following. Search for the last `@app.post` before the end of the file and add after it:

```python
# ─────────────────────────────────────────────────────────────────────────────
# DENIAL PREDICTION
# ─────────────────────────────────────────────────────────────────────────────
import pickle
import os
from pathlib import Path

# Model cache — loaded once at startup
_DENIAL_MODEL = None
_DENIAL_MODEL_VERSION = "v1.0.0"
_DENIAL_MODEL_PATH = Path(os.environ.get("DENIAL_MODEL_PATH", "/models/denial_prediction.pkl"))

def _get_denial_model():
    global _DENIAL_MODEL
    if _DENIAL_MODEL is None and _DENIAL_MODEL_PATH.exists():
        with open(_DENIAL_MODEL_PATH, "rb") as f:
            _DENIAL_MODEL = pickle.load(f)
    return _DENIAL_MODEL

def _extract_denial_features(payload: dict) -> dict:
    """Extract feature vector from claim payload for ML prediction."""
    return {
        "procedure_code_count": len(payload.get("procedure_codes", [])),
        "diagnosis_code_count": len(payload.get("diagnosis_codes", [])),
        "total_claim_amount": float(payload.get("total_amount", 0)),
        "patient_age": int(payload.get("patient_age", 0)),
        "days_since_last_claim": int(payload.get("days_since_last_claim", 999)),
        "has_pre_auth": int(payload.get("has_pre_authorization", False)),
        "plan_type": hash(payload.get("plan_type", "unknown")) % 100,
        "provider_specialty_code": hash(payload.get("provider_specialty", "GP")) % 50,
        "prior_denial_count_12m": int(payload.get("prior_denial_count_12m", 0)),
        "is_inpatient": int(payload.get("is_inpatient", False)),
        "modifier_count": len(payload.get("modifiers", [])),
        "referral_present": int(payload.get("referral_code") is not None),
    }

DENIAL_REASON_CODES = {
    "no_pre_auth": "Prior authorization not obtained",
    "medical_necessity": "Medical necessity not established",
    "plan_exclusion": "Service excluded from plan benefits",
    "duplicate_claim": "Duplicate claim submission",
    "incorrect_coding": "Incorrect procedure/diagnosis coding",
    "coordination_of_benefits": "Coordination of benefits issue",
    "timely_filing": "Claim filed outside timely filing limit",
}

@app.post("/cdss/claims/denial-prediction")
async def predict_denial(request: Request):
    body = await request.json()
    payload = body.get("payload", {})
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")

    features = _extract_denial_features(payload)
    model = _get_denial_model()

    if model is not None:
        import numpy as np
        feature_vector = np.array([[features[k] for k in sorted(features.keys())]])
        risk_score = float(model.predict_proba(feature_vector)[0][1])
        model_version = _DENIAL_MODEL_VERSION
    else:
        # Heuristic fallback when model file is not yet trained
        risk_score = 0.0
        if not features["has_pre_auth"] and features["total_claim_amount"] > 5000:
            risk_score += 0.35
        if features["prior_denial_count_12m"] > 2:
            risk_score += 0.25
        if features["procedure_code_count"] > 10:
            risk_score += 0.15
        risk_score = min(risk_score, 0.95)
        model_version = "heuristic-v1.0"

    # Determine top reasons (always rule-based for explainability regardless of model)
    top_reasons = []
    if not payload.get("has_pre_authorization") and float(payload.get("total_amount", 0)) > 1000:
        top_reasons.append({"code": "no_pre_auth", "description": DENIAL_REASON_CODES["no_pre_auth"], "weight": 0.35})
    if payload.get("prior_denial_count_12m", 0) > 1:
        top_reasons.append({"code": "duplicate_claim", "description": DENIAL_REASON_CODES["duplicate_claim"], "weight": 0.20})
    if len(payload.get("diagnosis_codes", [])) == 0:
        top_reasons.append({"code": "medical_necessity", "description": DENIAL_REASON_CODES["medical_necessity"], "weight": 0.30})
    if len(top_reasons) == 0:
        top_reasons.append({"code": "incorrect_coding", "description": DENIAL_REASON_CODES["incorrect_coding"], "weight": 0.15})
    top_reasons = sorted(top_reasons, key=lambda x: x["weight"], reverse=True)[:3]

    threshold_action = "allow"
    if risk_score >= 0.90:
        threshold_action = "block"
    elif risk_score >= 0.70:
        threshold_action = "warn"

    return {
        "risk_score": round(risk_score, 4),
        "confidence": 0.82 if model is not None else 0.55,
        "threshold_action": threshold_action,
        "top_reasons": top_reasons,
        "model_version": model_version,
        "feature_snapshot": features,
    }


@app.post("/cdss/claims/appeal-template")
async def generate_appeal_template(request: Request):
    """Generate a RAG-grounded appeal letter for a denied claim."""
    body = await request.json()
    payload = body.get("payload", {})
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")

    denial_code = payload.get("denial_reason_code", "medical_necessity")
    denial_description = DENIAL_REASON_CODES.get(denial_code, "Claim denied")
    patient_name = payload.get("patient_name", "[Patient Name]")
    claim_ref = payload.get("claim_reference", "[Claim Reference]")
    procedure_codes = ", ".join(payload.get("procedure_codes", []))
    diagnosis_codes = ", ".join(payload.get("diagnosis_codes", []))
    provider_name = payload.get("provider_name", "[Provider Name]")
    plan_name = payload.get("plan_name", "[Plan Name]")
    service_date = payload.get("service_date", "[Service Date]")

    # Attempt RAG retrieval for supporting evidence
    rag_sources = []
    if _pg_pool is not None:
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("all-MiniLM-L6-v2")
            query = f"appeal {denial_code} medical necessity {procedure_codes}"
            embedding = model.encode([query])[0].tolist()
            async with _pg_pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT d.title, c.chunk_text,
                              1 - (c.embedding <=> $1::vector) AS similarity
                       FROM clinical_knowledge_chunks c
                       JOIN clinical_knowledge_documents d ON d.id = c.document_id
                       WHERE 1 - (c.embedding <=> $1::vector) > 0.6
                       ORDER BY similarity DESC LIMIT 3""",
                    embedding,
                )
                rag_sources = [
                    {"documentId": str(r["document_id"]) if "document_id" in r else "",
                     "title": r["title"],
                     "excerpt": r["chunk_text"][:200],
                     "relevanceScore": round(float(r["similarity"]), 3)}
                    for r in rows
                ]
        except Exception:
            rag_sources = []

    # Build appeal letter
    rag_evidence_section = ""
    if rag_sources:
        rag_evidence_section = "\n\nSupporting Clinical Evidence:\n" + "\n".join(
            f"- {s['title']}: {s['excerpt']}" for s in rag_sources
        )

    draft_letter = f"""[Date]

Appeals Department
{plan_name}

RE: Appeal for Claim {claim_ref} — {denial_description}

Dear Appeals Committee,

I am writing on behalf of {patient_name} to formally appeal the denial of claim {claim_ref} \
for services rendered on {service_date} by {provider_name}.

The denied services (Procedure Code(s): {procedure_codes}; Diagnosis Code(s): {diagnosis_codes}) \
were medically necessary as determined by the treating clinician based on the patient's clinical \
presentation and established evidence-based guidelines.

Reason for Denial: {denial_description}

Clinical Justification:
The services provided were clinically indicated and consistent with accepted standards of care. \
[CLINICIAN: Insert specific clinical justification here referencing patient history, \
examination findings, and treatment rationale.]
{rag_evidence_section}

We respectfully request a full review of this claim and the supporting clinical documentation \
attached to this appeal. Please contact our office at [PHONE] if additional information is required.

Sincerely,

{provider_name}
[License Number]
[Contact Information]
"""

    return {
        "draft_letter": draft_letter,
        "denial_reason_code": denial_code,
        "rag_sources": rag_sources,
        "model_version": "template-v1.0-rag",
    }


@app.post("/cdss/pharmacy/pdmp-check")
async def pdmp_check(request: Request):
    """
    PDMP (Prescription Drug Monitoring Program) controlled substance check.
    In production, this calls the state PDMP API. For now, returns AI risk assessment
    based on drug schedule, MME calculation, and patient prescription history.
    """
    body = await request.json()
    payload = body.get("payload", {})

    drug_name = payload.get("drug_name", "")
    dea_schedule = payload.get("dea_schedule")
    daily_dose_mg = float(payload.get("daily_dose_mg", 0))
    other_active = payload.get("other_active_controlled_prescriptions", [])
    prior_abuse_flags = payload.get("prior_substance_abuse_flags", [])

    # Morphine Milligram Equivalent calculation (simplified)
    MME_FACTORS = {
        "morphine": 1.0, "oxycodone": 1.5, "hydrocodone": 1.0,
        "codeine": 0.15, "tramadol": 0.1, "fentanyl": 100.0,
        "hydromorphone": 4.0, "methadone": 3.0, "buprenorphine": 30.0,
    }
    drug_lower = drug_name.lower()
    mme_factor = next((v for k, v in MME_FACTORS.items() if k in drug_lower), None)
    mme = round(daily_dose_mg * mme_factor, 2) if mme_factor else None

    # Risk assessment
    alerts = []
    risk_score = 0.0

    if dea_schedule in ["II", "III"]:
        risk_score += 0.2
        alerts.append({"type": "schedule", "message": f"DEA Schedule {dea_schedule} substance", "severity": "info"})

    if mme and mme >= 90:
        risk_score += 0.4
        alerts.append({"type": "high_mme", "message": f"MME {mme} mg/day exceeds CDC guideline threshold of 90 MME/day", "severity": "warning"})
    elif mme and mme >= 50:
        risk_score += 0.2
        alerts.append({"type": "moderate_mme", "message": f"MME {mme} mg/day approaching CDC threshold", "severity": "caution"})

    if len(other_active) >= 2:
        risk_score += 0.25
        alerts.append({"type": "multiple_prescribers", "message": f"Patient has {len(other_active)} other active controlled substance prescriptions", "severity": "warning"})

    if prior_abuse_flags:
        risk_score += 0.35
        alerts.append({"type": "substance_history", "message": "Patient has prior substance use disorder flags on record", "severity": "critical"})

    risk_score = min(risk_score, 1.0)

    if risk_score >= 0.75:
        risk_level = "critical"
        dispensing_blocked = True
    elif risk_score >= 0.50:
        risk_level = "high"
        dispensing_blocked = False
    elif risk_score >= 0.25:
        risk_level = "moderate"
        dispensing_blocked = False
    else:
        risk_level = "low"
        dispensing_blocked = False

    return {
        "risk_level": risk_level,
        "risk_score": round(risk_score, 4),
        "morphine_milligram_equivalent": mme,
        "dispensing_blocked": dispensing_blocked,
        "prescriber_alerts": alerts,
        "other_active_prescriptions": other_active,
        "cdss_recommendation": (
            "DO NOT DISPENSE — PDMP risk critical. Senior pharmacist review required." if dispensing_blocked
            else "Proceed with caution. Document clinical rationale in patient record." if risk_level == "high"
            else "Standard dispensing with patient counseling recommended." if risk_level == "moderate"
            else "Standard dispensing."
        ),
    }
```

**File: `services/cdss-service/requirements.txt`** — Add:
```
xgboost>=2.0.0
scikit-learn==1.3.2
```
(scikit-learn may already be present — check first with `grep scikit-learn requirements.txt`)

---

## Step 3: EHR Service — Claims AI Service

**File: `services/ehr-service/src/services/claims-ai.service.ts`** (new file)

```typescript
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CdssService } from './cdss.service';
import { ClaimRiskScore } from '../entities/claim-risk-score.entity';
import { ClaimAppeal } from '../entities/claim-appeal.entity';
import { FinancialHardshipReferral } from '../entities/financial-hardship-referral.entity';

export interface ClaimPayload {
  claimId: string;
  patientId: string;
  encounterId?: string;
  procedureCodes: string[];
  diagnosisCodes: string[];
  totalAmount: number;
  planType: string;
  hasPreAuthorization: boolean;
  isInpatient: boolean;
  patientAge: number;
  priorDenialCount12m: number;
  providerSpecialty: string;
  modifiers?: string[];
  referralCode?: string;
  daysSinceLastClaim?: number;
}

@Injectable()
export class ClaimsAiService {
  private readonly logger = new Logger(ClaimsAiService.name);
  private readonly WARN_THRESHOLD = 0.70;
  private readonly BLOCK_THRESHOLD = 0.90;

  constructor(
    private readonly cdssService: CdssService,
    @InjectRepository(ClaimRiskScore)
    private readonly riskScoreRepo: Repository<ClaimRiskScore>,
    @InjectRepository(ClaimAppeal)
    private readonly appealRepo: Repository<ClaimAppeal>,
    @InjectRepository(FinancialHardshipReferral)
    private readonly hardshipRepo: Repository<FinancialHardshipReferral>,
  ) {}

  async scoreClaimBeforeSubmission(
    claim: ClaimPayload,
    tenantId: string,
  ): Promise<{ allowed: boolean; action: 'allow' | 'warn' | 'block'; riskScore: ClaimRiskScore }> {
    const cdssPayload = {
      procedure_codes: claim.procedureCodes,
      diagnosis_codes: claim.diagnosisCodes,
      total_amount: claim.totalAmount,
      plan_type: claim.planType,
      has_pre_authorization: claim.hasPreAuthorization,
      is_inpatient: claim.isInpatient,
      patient_age: claim.patientAge,
      prior_denial_count_12m: claim.priorDenialCount12m,
      provider_specialty: claim.providerSpecialty,
      modifiers: claim.modifiers ?? [],
      referral_code: claim.referralCode ?? null,
      days_since_last_claim: claim.daysSinceLastClaim ?? 999,
    };

    const result = await this.cdssService.callGovernedJson({
      surface: 'denial_prediction',
      patientId: claim.patientId,
      tenantId,
      encounterId: claim.encounterId,
      task: 'score_claim',
      payload: cdssPayload,
      outputSchema: null,
    });

    const score = this.riskScoreRepo.create({
      claimId: claim.claimId,
      patientId: claim.patientId,
      encounterId: claim.encounterId ?? null,
      riskScore: result.risk_score,
      confidence: result.confidence,
      topReasons: result.top_reasons,
      modelVersion: result.model_version,
      featureSnapshot: result.feature_snapshot,
      thresholdAction: result.threshold_action,
    });
    await this.riskScoreRepo.save(score);

    // Auto-trigger financial hardship referral for high-risk / high-cost claims
    if (result.threshold_action !== 'allow' && claim.totalAmount > 10000) {
      await this.createHardshipReferral(claim.patientId, claim.claimId, tenantId, 'high_risk_claim');
    }

    return {
      allowed: result.threshold_action !== 'block',
      action: result.threshold_action,
      riskScore: score,
    };
  }

  async overrideBlock(
    riskScoreId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    if (reason.length < 30) {
      throw new BadRequestException('Override reason must be at least 30 characters');
    }
    await this.riskScoreRepo.update(riskScoreId, {
      thresholdAction: 'allow',
      overrideReason: reason,
      overrideUserId: userId,
    });
  }

  async generateAppealTemplate(
    claimId: string,
    patientId: string,
    denialReasonCode: string,
    claimDetails: Record<string, unknown>,
    tenantId: string,
  ): Promise<ClaimAppeal> {
    const result = await this.cdssService.callGovernedJson({
      surface: 'appeal_template',
      patientId,
      tenantId,
      task: 'generate_appeal',
      payload: { claim_id: claimId, denial_reason_code: denialReasonCode, ...claimDetails },
      outputSchema: null,
    });

    const appeal = this.appealRepo.create({
      claimId,
      patientId,
      denialReasonCode,
      denialReasonDescription: result.denial_reason_code,
      draftLetter: result.draft_letter,
      ragSources: result.rag_sources ?? [],
      status: 'draft',
    });
    return this.appealRepo.save(appeal);
  }

  async recordClaimOutcome(
    claimId: string,
    outcome: 'approved' | 'denied' | 'partial' | 'appealed',
  ): Promise<void> {
    await this.riskScoreRepo.update(
      { claimId },
      { actualOutcome: outcome, feedbackRecordedAt: new Date() },
    );
    // Log to CDSS feedback for self-learning
    this.logger.log(`Claim outcome recorded: claimId=${claimId} outcome=${outcome}`);
  }

  private async createHardshipReferral(
    patientId: string,
    claimId: string,
    tenantId: string,
    triggerReason: string,
  ): Promise<void> {
    const existing = await this.hardshipRepo.findOne({
      where: { patientId, claimId },
    });
    if (existing) return;

    const result = await this.cdssService.callGovernedJson({
      surface: 'financial_hardship',
      patientId,
      tenantId,
      task: 'match_assistance_programs',
      payload: { trigger_reason: triggerReason },
      outputSchema: null,
    }).catch(() => ({ programs_matched: [], ai_recommendation: null }));

    const referral = this.hardshipRepo.create({
      patientId,
      claimId,
      triggerReason,
      programsMatched: result.programs_matched ?? [],
      aiRecommendation: result.ai_recommendation ?? null,
      status: 'pending',
    });
    await this.hardshipRepo.save(referral);
  }
}
```

---

## Step 4: EHR Service — PDMP Service Extension

**File: `services/ehr-service/src/services/pharmacy.service.ts`** — Locate `dispense()` method and add PDMP check before dispensing:

```typescript
// ADD to PharmacyService constructor:
@InjectRepository(PdmpCheck)
private readonly pdmpCheckRepo: Repository<PdmpCheck>,

// ADD this method to PharmacyService:
async checkPdmp(
  patientId: string,
  prescriberId: string,
  drugName: string,
  deaSchedule: string | null,
  dailyDoseMg: number,
  tenantId: string,
): Promise<PdmpCheck> {
  const result = await this.cdssService.callGovernedJson({
    surface: 'pdmp_check',
    patientId,
    tenantId,
    task: 'check_controlled_substance',
    payload: {
      drug_name: drugName,
      dea_schedule: deaSchedule,
      daily_dose_mg: dailyDoseMg,
      other_active_controlled_prescriptions: [],
      prior_substance_abuse_flags: [],
    },
    outputSchema: null,
  });

  const check = this.pdmpCheckRepo.create({
    patientId,
    prescriberId,
    drugName,
    deaSchedule: deaSchedule ?? null,
    morphineMilligramEquivalent: result.morphine_milligram_equivalent ?? null,
    riskLevel: result.risk_level,
    prescriberAlerts: result.prescriber_alerts,
    otherActivePrescriptions: result.other_active_prescriptions,
    dispensingBlocked: result.dispensing_blocked,
  });
  const saved = await this.pdmpCheckRepo.save(check);

  if (result.dispensing_blocked) {
    throw new BadRequestException({
      code: 'PDMP_BLOCK',
      message: result.cdss_recommendation,
      pdmpCheckId: saved.id,
      alerts: result.prescriber_alerts,
    });
  }

  return saved;
}
```

---

## Step 5: EHR Service — Claims Controller

**File: `services/ehr-service/src/controllers/claims-ai.controller.ts`** (new file)

```typescript
import { Controller, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ClaimsAiService, ClaimPayload } from '../services/claims-ai.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('claims')
@UseGuards(JwtAuthGuard)
export class ClaimsAiController {
  constructor(private readonly claimsAiService: ClaimsAiService) {}

  @Post('score')
  async scoreClaim(
    @Body() body: { claim: ClaimPayload },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    return this.claimsAiService.scoreClaimBeforeSubmission(body.claim, tenantId);
  }

  @Post(':claimId/appeal')
  async generateAppeal(
    @Param('claimId') claimId: string,
    @Body() body: { patientId: string; denialReasonCode: string; claimDetails: Record<string, unknown> },
    @Request() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'];
    return this.claimsAiService.generateAppealTemplate(
      claimId,
      body.patientId,
      body.denialReasonCode,
      body.claimDetails,
      tenantId,
    );
  }

  @Patch('risk-score/:id/override')
  async overrideBlock(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    await this.claimsAiService.overrideBlock(id, req.user.sub, body.reason);
    return { overridden: true };
  }

  @Post(':claimId/outcome')
  async recordOutcome(
    @Param('claimId') claimId: string,
    @Body() body: { outcome: 'approved' | 'denied' | 'partial' | 'appealed' },
  ) {
    await this.claimsAiService.recordClaimOutcome(claimId, body.outcome);
    return { recorded: true };
  }
}
```

---

## Step 6: Frontend — Claim Risk Badge

**File: `ehr-frontend/src/components/ClaimRiskBadge.tsx`** (new file)

```tsx
import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface DenialReason {
  code: string;
  description: string;
  weight: number;
}

interface ClaimRiskBadgeProps {
  riskScore: number;
  action: 'allow' | 'warn' | 'block';
  topReasons: DenialReason[];
  onOverride?: (reason: string) => void;
  className?: string;
}

export const ClaimRiskBadge: React.FC<ClaimRiskBadgeProps> = ({
  riskScore,
  action,
  topReasons,
  onOverride,
  className = '',
}) => {
  const [showOverride, setShowOverride] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState('');
  const pct = Math.round(riskScore * 100);

  const config = {
    allow: { color: 'green', Icon: CheckCircle, label: 'Low Denial Risk', bg: 'bg-green-50 border-green-200' },
    warn: { color: 'yellow', Icon: AlertTriangle, label: 'Elevated Denial Risk', bg: 'bg-yellow-50 border-yellow-200' },
    block: { color: 'red', Icon: XCircle, label: 'High Denial Risk — Review Required', bg: 'bg-red-50 border-red-200' },
  }[action];

  return (
    <div className={`rounded-lg border p-4 ${config.bg} ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <config.Icon className={`h-5 w-5 text-${config.color}-600`} />
        <span className={`font-semibold text-${config.color}-800`}>{config.label}</span>
        <span className={`ml-auto text-2xl font-bold text-${config.color}-700`}>{pct}%</span>
      </div>

      {topReasons.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Top denial risk factors:</p>
          <ul className="space-y-1">
            {topReasons.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-sm">
                <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{r.description}</span>
                <span className="ml-auto text-xs text-gray-400">{Math.round(r.weight * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {action === 'block' && onOverride && (
        <div className="mt-3">
          {!showOverride ? (
            <button
              onClick={() => setShowOverride(true)}
              className="text-sm text-red-700 underline"
            >
              Submit anyway with clinical override
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Clinical override reason (minimum 30 characters)..."
                className="w-full text-sm border border-red-300 rounded p-2"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  disabled={overrideReason.length < 30}
                  onClick={() => onOverride(overrideReason)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded disabled:opacity-40"
                >
                  Confirm Override
                </button>
                <button
                  onClick={() => setShowOverride(false)}
                  className="px-3 py-1 text-sm border rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

**Where to integrate:** In the billing/claims submission page (locate `BillsPage.tsx` or claims form), add:

```tsx
// In BillsPage.tsx or ClaimsSubmissionForm component:
import { ClaimRiskBadge } from '../components/ClaimRiskBadge';

// Before submit button:
{claimRiskScore && (
  <ClaimRiskBadge
    riskScore={claimRiskScore.riskScore}
    action={claimRiskScore.thresholdAction}
    topReasons={claimRiskScore.topReasons}
    onOverride={handleOverride}
  />
)}
```

---

## Step 7: Frontend — Appeal Letter Panel

**File: `ehr-frontend/src/components/AppealLetterPanel.tsx`** (new file)

```tsx
import React from 'react';
import { FileText, ExternalLink, CheckCircle } from 'lucide-react';

interface RagSource {
  documentId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
}

interface AppealLetterPanelProps {
  claimId: string;
  denialReasonCode: string;
  draftLetter: string;
  ragSources: RagSource[];
  onSubmit: () => void;
}

export const AppealLetterPanel: React.FC<AppealLetterPanelProps> = ({
  claimId,
  denialReasonCode,
  draftLetter,
  ragSources,
  onSubmit,
}) => {
  const [letter, setLetter] = React.useState(draftLetter);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit();
  };

  return (
    <div className="bg-white border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">AI-Generated Appeal Letter</h3>
        <span className="ml-auto text-xs text-gray-400">Claim: {claimId}</span>
      </div>

      {ragSources.length > 0 && (
        <div className="bg-blue-50 rounded p-3">
          <p className="text-xs font-medium text-blue-700 mb-2">Evidence used from knowledge base:</p>
          <ul className="space-y-1">
            {ragSources.map((s, i) => (
              <li key={i} className="text-xs text-blue-600 flex items-start gap-1">
                <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span><strong>{s.title}</strong> — {s.excerpt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Review and edit the appeal letter:
        </label>
        <textarea
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          className="w-full h-64 text-sm font-mono border border-gray-200 rounded p-3"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          AI drafted. Clinician must review before submission.
        </span>
        {submitted ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Appeal submitted</span>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Submit Appeal
          </button>
        )}
      </div>
    </div>
  );
};
```

---

## Step 8: Model Training Script (ML Bootstrap)

**File: `scripts/train-denial-prediction-model.py`** (new file)

```python
"""
Train the denial prediction model from historical claims data.
Run once to bootstrap the model, then retrain monthly via nightly job.

Usage:
  python scripts/train-denial-prediction-model.py \
    --db-dsn "postgresql://user:pass@localhost:5432/clinic_demo_db" \
    --output /models/denial_prediction.pkl
"""
import argparse
import pickle
import psycopg2
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-dsn", required=True)
    parser.add_argument("--output", default="/models/denial_prediction.pkl")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db_dsn)
    df = pd.read_sql("""
        SELECT
            crs.risk_score,
            crs.feature_snapshot,
            crs.actual_outcome
        FROM claim_risk_scores crs
        WHERE crs.actual_outcome IS NOT NULL
    """, conn)
    conn.close()

    if len(df) < 100:
        print(f"Only {len(df)} labeled samples — need 100+ to train. Exiting.")
        return

    features_df = pd.json_normalize(df["feature_snapshot"])
    y = (df["actual_outcome"] == "denied").astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        features_df, y, test_size=0.2, random_state=42
    )

    model = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)
    print(f"AUC-ROC: {auc:.4f}")
    print(classification_report(y_test, (y_pred_proba > 0.5).astype(int)))

    with open(args.output, "wb") as f:
        pickle.dump(model, f)
    print(f"Model saved to {args.output}")

if __name__ == "__main__":
    main()
```

---

## Step 9: API Endpoints Reference

All endpoints served by EHR Service (`http://localhost:3013`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/claims/score` | Bearer | Score claim before submission |
| POST | `/claims/:claimId/appeal` | Bearer | Generate AI appeal letter |
| PATCH | `/claims/risk-score/:id/override` | Bearer | Override blocked claim (requires reason) |
| POST | `/claims/:claimId/outcome` | Bearer | Record actual claim outcome (feeds ML) |

CDSS Service endpoints (`http://localhost:8000`) — called by EHR service, not frontend directly:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cdss/claims/denial-prediction` | ML risk score + top reasons |
| POST | `/cdss/claims/appeal-template` | RAG-grounded appeal draft |
| POST | `/cdss/pharmacy/pdmp-check` | Controlled substance PDMP assessment |

---

## Step 10: Environment Variables

Add to EHR service `.env` / Docker compose:

```env
DENIAL_MODEL_PATH=/models/denial_prediction.pkl
```

Add to CDSS service:
```env
DENIAL_MODEL_PATH=/models/denial_prediction.pkl
```

---

## Definition of Done

- [ ] All 4 new entities have TypeORM files in `services/ehr-service/src/entities/`
- [ ] All 4 entities registered in `services/ehr-service/src/app.module.ts`
- [ ] Provisioning bundle `sprint115_denial_prediction` (v`2026.03.29.1`) in `database-provisioning.service.ts`
- [ ] Running tenant repair creates all 4 tables in every tenant DB
- [ ] CDSS `/cdss/claims/denial-prediction` returns `{ risk_score, confidence, threshold_action, top_reasons, model_version }`
- [ ] CDSS `/cdss/claims/appeal-template` returns `{ draft_letter, rag_sources }` with at least 1 RAG source when knowledge base populated
- [ ] CDSS `/cdss/pharmacy/pdmp-check` blocks dispensing when `risk_score >= 0.75`
- [ ] EHR `/claims/score` blocks submission (HTTP 422) when `threshold_action === 'block'` without override
- [ ] Override requires minimum 30-character reason
- [ ] `ClaimRiskBadge` renders in claims submission flow with correct color per risk level
- [ ] `AppealLetterPanel` renders in billing page when claim is denied
- [ ] Claim outcome recording endpoint writes `actual_outcome` to `claim_risk_scores`
- [ ] Training script `scripts/train-denial-prediction-model.py` runs without error when 100+ labeled samples exist
- [ ] PDMP check runs on every Schedule II/III controlled substance dispensing request
- [ ] Financial hardship referral auto-created for blocked high-value claims (> $10,000)
- [ ] All new tables have `IF NOT EXISTS` guards in provisioning — safe to re-run

---

## Anti-Hallucination Rules for This Sprint

1. **CDSS endpoint prefix:** All CDSS endpoints in this sprint use `/cdss/claims/` and `/cdss/pharmacy/` — not `/governed/json`. They are still called via `CdssService.callGovernedJson()` which routes to `/governed/json` internally.
2. **Model file path:** `DENIAL_MODEL_PATH` default is `/models/denial_prediction.pkl`. This file does NOT exist until `train-denial-prediction-model.py` runs. The CDSS endpoint must fall back to heuristics gracefully.
3. **Claim entity:** There is NO `Claim` entity in the codebase yet. `ClaimRiskScore.claimId` references a future entity by UUID. Do not invent a `Claim` entity.
4. **PDMP:** This is NOT a real PDMP API integration. It is an AI risk model that simulates PDMP logic. A real PDMP integration requires state-level API credentials — that is out of scope.
5. **No `@Roles()` decorator exists yet.** Use `req.user.role` check inside the service method until RBAC guard is implemented.
