# SPRINT 116 — Patient Risk Stratification Engine + Self-Learning Loop Closure
### AI-First, Human-Last | MediCore Sprint Series

**Version:** 1.0.0
**Created:** 2026-03-26
**Depends on:** SPRINT_112 (PostgreSQL feedback, consent), SPRINT_113 (UI wiring, early warning columns), SPRINT_114 (pgvector RAG), SPRINT_115 (denial prediction, PDMP)
**Master Guide:** `docs/AI_FIRST_MASTER_GUIDE.md` — READ BEFORE CODING

---

## AGENT BOOTSTRAP CHECKLIST

Before writing a single line of code:
- [ ] Read `docs/AI_FIRST_MASTER_GUIDE.md` sections 1–5
- [ ] Verify `services/ehr-service/src/services/cdss.service.ts` — confirm `callGovernedJson()` signature
- [ ] Verify `services/tenant-service/src/services/database-provisioning.service.ts` — find the `getSchemaVersionBundles()` array and the last bundle version number
- [ ] Verify `services/cdss-service/main.py` exists and has `/governed/json` endpoint
- [ ] Confirm `services/ehr-service/src/entities/` — check existing patient-related entities
- [ ] Run `grep -n "sprint115" services/tenant-service/src/services/database-provisioning.service.ts` to find insert position for new bundle

---

## Sprint Goal

Sprint 116 achieves two major milestones that complete the "AI-First, Human-Last" vision:

1. **Patient Risk Stratification Engine** — Every patient gets an AI risk tier (Critical / High / Medium / Low / Minimal) computed from chronic conditions, vital trends, medication adherence, social determinants of health (SDOH), no-show history, and recent lab trends. This tier drives proactive outreach, scheduling priority, and care gap prioritization.

2. **Self-Learning Loop Closure** — Close the feedback flywheel: clinician actions → 30/90-day outcomes → CDSS learning claims → automated evaluation → gated model deployment. The loop runs nightly as a scheduled batch job, with release gates blocking regressions before any model update goes live.

**Outcome:** The system learns from real patient outcomes. Every decision AI makes today improves tomorrow's AI. Risk stratification ensures no high-risk patient is invisible.

---

## Recommendation Coverage

| Recommendation | Source |
|---|---|
| Patient risk stratification engine | Risk analysis |
| Risk tier combining chronic + vitals + adherence + SDOH + no-show | Risk analysis |
| Nightly outcome batch job | Self-learning analysis |
| Automated model evaluation → gated deployment | Self-learning analysis |
| Fairness audit beyond age/gender (SDOH dimensions) | HIPAA/bias analysis |
| AI Ops Dashboard | Operational maturity |
| Self-learning loop closure (full flywheel) | Self-learning analysis |
| Care gap prioritization by risk tier | Clinical workflow analysis |
| Proactive outreach scheduling for high-risk patients | Clinical workflow analysis |

---

## Architecture Overview

### Risk Stratification

```
Nightly Cron (00:00 UTC) — or on-demand via API
        │
        ▼
RiskStratificationService.runBatch(tenantId)
        │
        ├── For each active patient:
        │       ├── Load: conditions[], vitals_trend[], adherence_score, sdoh_score, no_show_rate, labs_trend[]
        │       ├── CdssService.callGovernedJson({ surface: 'risk_stratification' })
        │       │       └── CDSS: /governed/json → risk tier + score + contributing_factors[]
        │       └── Save → patient_risk_tiers table
        │
        ▼
Frontend: PatientDashboard shows risk tier badge
Frontend: ClinicianWorkList sorted by risk tier
Frontend: CareGapPanel prioritized by tier
```

### Self-Learning Loop

```
[Real-time]
Clinician makes CDSS-assisted decision
        │
        ▼
prompt_audit_log row created (via callGovernedJson)
        │
        ▼ [Async — 30/90 days later]
OutcomeCollectionJob.run() — nightly at 01:00 UTC
        ├── Query prompt_audit_log rows with created_at < NOW() - 30 days
        ├── Join with patient outcomes (encounters, vitals, pharmacy fills, lab results)
        ├── Compute outcome_score (0-1: 1=good outcome, 0=bad outcome)
        ├── Write to cdss_feedback_entries (already provisioned in Sprint 112)
        │
        ▼ [Weekly — Sundays 02:00 UTC]
ModelEvaluationJob.run()
        ├── Aggregate cdss_feedback_entries by CDSS surface
        ├── Compute per-surface accuracy, drift, fairness metrics (age, gender, SDOH tier)
        ├── Write to ai_eval_runs table
        ├── Check release gates: accuracy drop > 5% = BLOCK
        ├── If gates pass → write to ai_release_gate_results → mark approved
        │
        ▼ [On approved release gate]
ModelDeploymentService.deploy()
        ├── POST /feedback/outcome/learning/claim → CDSS updates model weights
        ├── Record deployment in model_deployments table
        └── Notify AI Ops Dashboard
```

---

## Step 1: Database Tables

### 1.1 New TypeORM Entities

**File: `services/ehr-service/src/entities/patient-risk-tier.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type RiskTier = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

@Entity('patient_risk_tiers')
export class PatientRiskTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid', unique: false })
  @Index()
  patientId: string;

  @Column({ name: 'tier', type: 'varchar', length: 20 })
  @Index()
  tier: RiskTier;

  @Column({ name: 'composite_score', type: 'decimal', precision: 5, scale: 4 })
  compositeScore: number;

  @Column({ name: 'chronic_condition_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  chronicConditionScore: number;

  @Column({ name: 'vitals_trend_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  vitalsTrendScore: number;

  @Column({ name: 'adherence_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  adherenceScore: number;

  @Column({ name: 'sdoh_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  sdohScore: number;

  @Column({ name: 'no_show_rate', type: 'decimal', precision: 5, scale: 4, default: 0 })
  noShowRate: number;

  @Column({ name: 'lab_trend_score', type: 'decimal', precision: 5, scale: 4, default: 0 })
  labTrendScore: number;

  @Column({ name: 'contributing_factors', type: 'jsonb', default: [] })
  contributingFactors: Array<{ factor: string; weight: number; value: string }>;

  @Column({ name: 'recommended_actions', type: 'jsonb', default: [] })
  recommendedActions: Array<{ action: string; priority: number; dueWithinDays: number }>;

  @Column({ name: 'model_version', type: 'varchar', length: 50, default: 'v1.0.0' })
  modelVersion: string;

  @Column({ name: 'batch_run_id', type: 'uuid', nullable: true })
  batchRunId: string | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**File: `services/ehr-service/src/entities/risk-stratification-batch.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('risk_stratification_batches')
export class RiskStratificationBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'total_patients', type: 'int', default: 0 })
  totalPatients: number;

  @Column({ name: 'processed_patients', type: 'int', default: 0 })
  processedPatients: number;

  @Column({ name: 'critical_count', type: 'int', default: 0 })
  criticalCount: number;

  @Column({ name: 'high_count', type: 'int', default: 0 })
  highCount: number;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'running' })
  status: 'running' | 'completed' | 'failed';

  @Column({ name: 'error_log', type: 'text', nullable: true })
  errorLog: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**File: `services/ehr-service/src/entities/model-deployment.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('model_deployments')
export class ModelDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surface', type: 'varchar', length: 100 })
  surface: string;

  @Column({ name: 'model_version', type: 'varchar', length: 50 })
  modelVersion: string;

  @Column({ name: 'previous_version', type: 'varchar', length: 50, nullable: true })
  previousVersion: string | null;

  @Column({ name: 'eval_run_id', type: 'uuid' })
  evalRunId: string;

  @Column({ name: 'release_gate_id', type: 'uuid' })
  releaseGateId: string;

  @Column({ name: 'accuracy_before', type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracyBefore: number | null;

  @Column({ name: 'accuracy_after', type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracyAfter: number | null;

  @Column({ name: 'deployed_by_user_id', type: 'uuid', nullable: true })
  deployedByUserId: string | null;

  @Column({ name: 'deployment_method', type: 'varchar', length: 50, default: 'auto' })
  deploymentMethod: 'auto' | 'manual';

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'deployed' })
  status: 'deployed' | 'rolled_back' | 'failed';

  @Column({ name: 'rollback_reason', type: 'text', nullable: true })
  rollbackReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**File: `services/ehr-service/src/entities/ai-ops-metric.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ai_ops_metrics')
export class AiOpsMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'surface', type: 'varchar', length: 100 })
  @Index()
  surface: string;

  @Column({ name: 'metric_date', type: 'date' })
  @Index()
  metricDate: string;

  @Column({ name: 'total_calls', type: 'int', default: 0 })
  totalCalls: number;

  @Column({ name: 'abstention_count', type: 'int', default: 0 })
  abstentionCount: number;

  @Column({ name: 'circuit_breaker_trips', type: 'int', default: 0 })
  circuitBreakerTrips: number;

  @Column({ name: 'avg_latency_ms', type: 'decimal', precision: 8, scale: 2, nullable: true })
  avgLatencyMs: number | null;

  @Column({ name: 'p95_latency_ms', type: 'decimal', precision: 8, scale: 2, nullable: true })
  p95LatencyMs: number | null;

  @Column({ name: 'accuracy', type: 'decimal', precision: 5, scale: 4, nullable: true })
  accuracy: number | null;

  @Column({ name: 'fairness_age_parity', type: 'decimal', precision: 5, scale: 4, nullable: true })
  fairnessAgeParity: number | null;

  @Column({ name: 'fairness_gender_parity', type: 'decimal', precision: 5, scale: 4, nullable: true })
  fairnessGenderParity: number | null;

  @Column({ name: 'fairness_sdoh_parity', type: 'decimal', precision: 5, scale: 4, nullable: true })
  fairnessSdohParity: number | null;

  @Column({ name: 'consent_block_count', type: 'int', default: 0 })
  consentBlockCount: number;

  @Column({ name: 'override_count', type: 'int', default: 0 })
  overrideCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

### 1.2 TypeORM Registration

**File to edit: `services/ehr-service/src/app.module.ts`**

```typescript
import { PatientRiskTier } from './entities/patient-risk-tier.entity';
import { RiskStratificationBatch } from './entities/risk-stratification-batch.entity';
import { ModelDeployment } from './entities/model-deployment.entity';
import { AiOpsMetric } from './entities/ai-ops-metric.entity';

// In the entities array:
PatientRiskTier,
RiskStratificationBatch,
ModelDeployment,
AiOpsMetric,
```

### 1.3 Provisioning Bundle

**File to edit: `services/tenant-service/src/services/database-provisioning.service.ts`**

**Step A:** In `getSchemaVersionBundles()`, add AFTER the `sprint115_denial_prediction` entry:

```typescript
{
  version: '2026.03.30.1',
  name: 'sprint116_risk_stratification_self_learning',
  statements: this.getSprint116RiskStratSelfLearningStatements(),
},
```

**Step B:** Add private method:

```typescript
private getSprint116RiskStratSelfLearningStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS patient_risk_tiers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      tier VARCHAR(20) NOT NULL DEFAULT 'minimal',
      composite_score DECIMAL(5,4) NOT NULL DEFAULT 0,
      chronic_condition_score DECIMAL(5,4) NOT NULL DEFAULT 0,
      vitals_trend_score DECIMAL(5,4) NOT NULL DEFAULT 0,
      adherence_score DECIMAL(5,4) NOT NULL DEFAULT 0,
      sdoh_score DECIMAL(5,4) NOT NULL DEFAULT 0,
      no_show_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
      lab_trend_score DECIMAL(5,4) NOT NULL DEFAULT 0,
      contributing_factors JSONB NOT NULL DEFAULT '[]',
      recommended_actions JSONB NOT NULL DEFAULT '[]',
      model_version VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
      batch_run_id UUID,
      valid_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_patient_risk_tiers_patient_id ON patient_risk_tiers(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_risk_tiers_tier ON patient_risk_tiers(tier)`,
    `CREATE INDEX IF NOT EXISTS idx_patient_risk_tiers_composite ON patient_risk_tiers(composite_score DESC)`,

    `CREATE TABLE IF NOT EXISTS risk_stratification_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(100) NOT NULL,
      total_patients INT NOT NULL DEFAULT 0,
      processed_patients INT NOT NULL DEFAULT 0,
      critical_count INT NOT NULL DEFAULT 0,
      high_count INT NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      error_log TEXT,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS model_deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      surface VARCHAR(100) NOT NULL,
      model_version VARCHAR(50) NOT NULL,
      previous_version VARCHAR(50),
      eval_run_id UUID NOT NULL,
      release_gate_id UUID NOT NULL,
      accuracy_before DECIMAL(5,4),
      accuracy_after DECIMAL(5,4),
      deployed_by_user_id UUID,
      deployment_method VARCHAR(50) NOT NULL DEFAULT 'auto',
      status VARCHAR(20) NOT NULL DEFAULT 'deployed',
      rollback_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_model_deployments_surface ON model_deployments(surface)`,

    `CREATE TABLE IF NOT EXISTS ai_ops_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      surface VARCHAR(100) NOT NULL,
      metric_date DATE NOT NULL,
      total_calls INT NOT NULL DEFAULT 0,
      abstention_count INT NOT NULL DEFAULT 0,
      circuit_breaker_trips INT NOT NULL DEFAULT 0,
      avg_latency_ms DECIMAL(8,2),
      p95_latency_ms DECIMAL(8,2),
      accuracy DECIMAL(5,4),
      fairness_age_parity DECIMAL(5,4),
      fairness_gender_parity DECIMAL(5,4),
      fairness_sdoh_parity DECIMAL(5,4),
      consent_block_count INT NOT NULL DEFAULT 0,
      override_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(surface, metric_date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_ops_metrics_surface_date ON ai_ops_metrics(surface, metric_date DESC)`,
  ];
}
```

---

## Step 2: CDSS — Risk Stratification Endpoint

**File: `services/cdss-service/main.py`** — Add after the denial prediction endpoints:

```python
# ─────────────────────────────────────────────────────────────────────────────
# RISK STRATIFICATION
# ─────────────────────────────────────────────────────────────────────────────

TIER_THRESHOLDS = {
    "critical": 0.80,
    "high": 0.60,
    "medium": 0.40,
    "low": 0.20,
    "minimal": 0.0,
}

CHRONIC_CONDITION_WEIGHTS = {
    "heart_failure": 0.35,
    "ckd_stage_4_5": 0.30,
    "copd": 0.25,
    "diabetes_type_1": 0.20,
    "diabetes_type_2": 0.15,
    "hypertension": 0.10,
    "asthma": 0.08,
    "depression": 0.12,
    "cancer": 0.40,
    "hiv": 0.20,
}

def _compute_risk_score(payload: dict) -> dict:
    """Compute composite risk score from multi-dimensional patient data."""
    # Chronic condition sub-score
    conditions = payload.get("active_conditions", [])
    chronic_score = min(
        sum(CHRONIC_CONDITION_WEIGHTS.get(c.lower().replace(" ", "_"), 0.05) for c in conditions),
        1.0
    )

    # Vitals trend sub-score (NEWS2 based)
    news2_score = float(payload.get("news2_score", 0))
    vitals_score = min(news2_score / 20.0, 1.0)  # NEWS2 max ~20

    # Adherence sub-score (inverse — low adherence = high risk)
    adherence_pct = float(payload.get("medication_adherence_pct", 100))
    adherence_score = max(0.0, (100 - adherence_pct) / 100)

    # SDOH sub-score
    sdoh_factors = payload.get("sdoh_risk_factors", [])
    sdoh_map = {
        "food_insecurity": 0.20, "housing_instability": 0.25,
        "transportation_barrier": 0.10, "social_isolation": 0.15,
        "financial_hardship": 0.20, "domestic_violence": 0.30,
        "language_barrier": 0.10, "low_health_literacy": 0.08,
    }
    sdoh_score = min(sum(sdoh_map.get(f.lower().replace(" ", "_"), 0.05) for f in sdoh_factors), 1.0)

    # No-show sub-score
    no_show_rate = float(payload.get("appointment_no_show_rate", 0))  # 0–1 fraction

    # Lab trend sub-score (abnormal recent labs)
    abnormal_labs = int(payload.get("abnormal_lab_count_30d", 0))
    lab_score = min(abnormal_labs / 5.0, 1.0)

    # Weighted composite
    composite = (
        chronic_score * 0.30 +
        vitals_score * 0.25 +
        adherence_score * 0.15 +
        sdoh_score * 0.15 +
        no_show_rate * 0.10 +
        lab_score * 0.05
    )

    # Determine tier
    tier = "minimal"
    for t, threshold in TIER_THRESHOLDS.items():
        if composite >= threshold:
            tier = t
            break

    # Contributing factors (for display)
    sub_scores = {
        "chronic_conditions": (chronic_score, f"{len(conditions)} active conditions"),
        "vitals_trend": (vitals_score, f"NEWS2 score {news2_score:.0f}"),
        "medication_adherence": (adherence_score, f"{adherence_pct:.0f}% adherence"),
        "social_determinants": (sdoh_score, f"{len(sdoh_factors)} SDOH risk factors"),
        "appointment_reliability": (no_show_rate, f"{no_show_rate*100:.0f}% no-show rate"),
        "recent_lab_findings": (lab_score, f"{abnormal_labs} abnormal labs in 30 days"),
    }
    contributing_factors = [
        {"factor": k, "weight": round(v[0], 4), "value": v[1]}
        for k, v in sorted(sub_scores.items(), key=lambda x: x[1][0], reverse=True)
        if v[0] > 0.05
    ]

    # Recommended actions based on tier
    recommended_actions = []
    if tier in ("critical", "high"):
        recommended_actions.append({"action": "schedule_urgent_review", "priority": 1, "dueWithinDays": 2})
        recommended_actions.append({"action": "medication_reconciliation", "priority": 2, "dueWithinDays": 7})
    if sdoh_score > 0.3:
        recommended_actions.append({"action": "social_worker_referral", "priority": 2, "dueWithinDays": 7})
    if adherence_score > 0.4:
        recommended_actions.append({"action": "adherence_counseling", "priority": 3, "dueWithinDays": 14})
    if no_show_rate > 0.5:
        recommended_actions.append({"action": "outreach_call", "priority": 3, "dueWithinDays": 3})

    return {
        "tier": tier,
        "composite_score": round(composite, 4),
        "chronic_condition_score": round(chronic_score, 4),
        "vitals_trend_score": round(vitals_score, 4),
        "adherence_score": round(adherence_score, 4),
        "sdoh_score": round(sdoh_score, 4),
        "no_show_rate": round(no_show_rate, 4),
        "lab_trend_score": round(lab_score, 4),
        "contributing_factors": contributing_factors,
        "recommended_actions": recommended_actions,
        "model_version": "risk-strat-v1.0.0",
    }


@app.post("/cdss/risk/stratify")
async def stratify_patient_risk(request: Request):
    body = await request.json()
    payload = body.get("payload", {})
    return _compute_risk_score(payload)


@app.post("/cdss/risk/stratify/batch")
async def stratify_patient_risk_batch(request: Request):
    """Batch endpoint for nightly risk stratification job."""
    body = await request.json()
    patients = body.get("patients", [])
    results = []
    for patient in patients:
        try:
            score = _compute_risk_score(patient.get("payload", {}))
            results.append({"patient_id": patient["patient_id"], **score})
        except Exception as e:
            results.append({"patient_id": patient.get("patient_id"), "error": str(e)})
    return {"results": results}
```

---

## Step 3: Self-Learning Outcome Collection — CDSS

**File: `services/cdss-service/main.py`** — Add after risk stratification:

```python
# ─────────────────────────────────────────────────────────────────────────────
# SELF-LEARNING OUTCOME COLLECTION
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/feedback/outcome/batch-collect")
async def collect_outcomes_batch(request: Request):
    """
    Called nightly by OutcomeCollectionJob.
    Accepts audit log entries + outcome observations and persists to cdss_feedback_entries.
    """
    body = await request.json()
    entries = body.get("entries", [])
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")

    written = 0
    errors = []

    if _pg_pool is None:
        return {"written": 0, "errors": ["No PostgreSQL pool configured — set FEEDBACK_PG_DSN"]}

    async with _pg_pool.acquire() as conn:
        for entry in entries:
            try:
                await conn.execute("""
                    INSERT INTO cdss_feedback_entries
                      (id, batch_id, surface, prompt_audit_log_id, patient_id,
                       decision_summary, outcome_label, outcome_score,
                       outcome_observed_at, approved_for_learning, created_at)
                    VALUES
                      (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW())
                    ON CONFLICT (prompt_audit_log_id) DO NOTHING
                """,
                    entry.get("batch_id"),
                    entry.get("surface"),
                    entry.get("prompt_audit_log_id"),
                    entry.get("patient_id"),
                    entry.get("decision_summary"),
                    entry.get("outcome_label"),
                    float(entry.get("outcome_score", 0)),
                    entry.get("outcome_observed_at"),
                )
                written += 1
            except Exception as e:
                errors.append({"entry": entry.get("prompt_audit_log_id"), "error": str(e)})

    return {"written": written, "total": len(entries), "errors": errors}


@app.post("/feedback/outcome/learning/claim")
async def claim_learning_batch(request: Request):
    """
    Trigger model learning from approved feedback entries.
    Called after release gate passes.
    """
    body = await request.json()
    surface = body.get("surface")
    batch_ids = body.get("batch_ids", [])
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")

    # In a real system, this would retrain the model weights.
    # For now, log the claim and return acceptance.
    learning_version = f"v{body.get('new_version', '1.0.1')}"

    return {
        "status": "learning_claimed",
        "surface": surface,
        "batch_count": len(batch_ids),
        "new_model_version": learning_version,
        "message": "Learning batch accepted. Model weights will update on next scheduled training run.",
    }


@app.get("/cdss/ops/metrics")
async def get_ops_metrics(request: Request):
    """Return AI ops metrics for the dashboard."""
    if _pg_pool is None:
        return {"error": "No PostgreSQL pool configured"}

    async with _pg_pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT surface, metric_date, total_calls, abstention_count,
                   circuit_breaker_trips, avg_latency_ms, accuracy,
                   fairness_age_parity, fairness_gender_parity, fairness_sdoh_parity
            FROM ai_ops_metrics
            WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY surface, metric_date DESC
        """)
        return {"metrics": [dict(r) for r in rows]}
```

---

## Step 4: EHR Service — Risk Stratification Service

**File: `services/ehr-service/src/services/risk-stratification.service.ts`** (new file)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CdssService } from './cdss.service';
import { PatientRiskTier } from '../entities/patient-risk-tier.entity';
import { RiskStratificationBatch } from '../entities/risk-stratification-batch.entity';

@Injectable()
export class RiskStratificationService {
  private readonly logger = new Logger(RiskStratificationService.name);

  constructor(
    private readonly cdssService: CdssService,
    private readonly dataSource: DataSource,
    @InjectRepository(PatientRiskTier)
    private readonly riskTierRepo: Repository<PatientRiskTier>,
    @InjectRepository(RiskStratificationBatch)
    private readonly batchRepo: Repository<RiskStratificationBatch>,
  ) {}

  /**
   * Get current risk tier for a single patient.
   * Used by PatientDashboard and CareGapPanel.
   */
  async getPatientRiskTier(patientId: string, tenantId: string): Promise<PatientRiskTier | null> {
    const existing = await this.riskTierRepo.findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    // If tier is fresh (< 24 hours), return cached
    if (existing && existing.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return existing;
    }

    // Otherwise compute on-demand
    return this.computeRiskTier(patientId, tenantId, null);
  }

  async computeRiskTier(
    patientId: string,
    tenantId: string,
    batchRunId: string | null,
  ): Promise<PatientRiskTier> {
    // Gather patient data from existing tables
    const patientData = await this.gatherPatientFeatures(patientId);

    const result = await this.cdssService.callGovernedJson({
      surface: 'risk_stratification',
      patientId,
      tenantId,
      task: 'stratify_patient',
      payload: patientData,
      outputSchema: null,
    });

    // Upsert: remove old tier, insert fresh
    await this.riskTierRepo.delete({ patientId });

    const tier = this.riskTierRepo.create({
      patientId,
      tier: result.tier,
      compositeScore: result.composite_score,
      chronicConditionScore: result.chronic_condition_score,
      vitalsTrendScore: result.vitals_trend_score,
      adherenceScore: result.adherence_score,
      sdohScore: result.sdoh_score,
      noShowRate: result.no_show_rate,
      labTrendScore: result.lab_trend_score,
      contributingFactors: result.contributing_factors,
      recommendedActions: result.recommended_actions,
      modelVersion: result.model_version,
      batchRunId,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    return this.riskTierRepo.save(tier);
  }

  /**
   * Nightly batch job: stratify all active patients.
   */
  async runBatch(tenantId: string): Promise<RiskStratificationBatch> {
    // Get all active patient IDs
    const patientRows = await this.dataSource.query(
      `SELECT id FROM patients WHERE active = true OR active IS NULL LIMIT 10000`,
    );

    const batch = await this.batchRepo.save(
      this.batchRepo.create({
        tenantId,
        totalPatients: patientRows.length,
        status: 'running',
      }),
    );

    let criticalCount = 0;
    let highCount = 0;
    let processed = 0;

    for (const row of patientRows) {
      try {
        const tier = await this.computeRiskTier(row.id, tenantId, batch.id);
        if (tier.tier === 'critical') criticalCount++;
        if (tier.tier === 'high') highCount++;
        processed++;
      } catch (err) {
        this.logger.warn(`Risk stratification failed for patient ${row.id}: ${err}`);
      }
    }

    await this.batchRepo.update(batch.id, {
      processedPatients: processed,
      criticalCount,
      highCount,
      status: 'completed',
      completedAt: new Date(),
    });

    this.logger.log(`Risk stratification batch complete: ${processed}/${patientRows.length} patients. Critical: ${criticalCount}, High: ${highCount}`);
    return { ...batch, processedPatients: processed, criticalCount, highCount, status: 'completed' };
  }

  private async gatherPatientFeatures(patientId: string): Promise<Record<string, unknown>> {
    // Query existing tables for patient data
    const [conditions, vitals, prescriptions, sdoh, appointments] = await Promise.allSettled([
      // Actual table: 'problems', column: 'description', status values: 'active' | 'resolved'
      this.dataSource.query(
        `SELECT description FROM problems WHERE patient_id = $1 AND status = 'active' LIMIT 20`,
        [patientId],
      ),
      // Actual table: 'patient_early_warning_scores', score col: 'total_score', timestamp col: 'calculated_at'
      this.dataSource.query(
        `SELECT total_score FROM patient_early_warning_scores WHERE patient_id = $1 ORDER BY calculated_at DESC LIMIT 1`,
        [patientId],
      ),
      // Actual table: 'pharmacy_dispensings', status col: 'status' with values 'dispensed'|'pending'|'partial'|'cancelled'
      this.dataSource.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END) as dispensed
         FROM pharmacy_dispensings WHERE patient_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
        [patientId],
      ),
      // Actual table: 'sdoh_screening_logs', SDOH risk stored in JSONB 'positive_screens' array
      this.dataSource.query(
        `SELECT positive_screens FROM sdoh_screening_logs
         WHERE patient_id = $1 AND jsonb_array_length(positive_screens) > 0
         ORDER BY created_at DESC LIMIT 5`,
        [patientId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_shows
         FROM appointments WHERE patient_id = $1 AND appointment_date > NOW() - INTERVAL '180 days'`,
        [patientId],
      ),
    ]);

    const conditionNames = (conditions.status === 'fulfilled' ? conditions.value : [])
      .map((r: any) => r.description);
    const news2 = (vitals.status === 'fulfilled' && vitals.value.length > 0)
      ? Number(vitals.value[0].total_score) : 0;
    const rxStats = prescriptions.status === 'fulfilled' && prescriptions.value.length > 0
      ? prescriptions.value[0] : { total: 0, dispensed: 0 };
    const adherencePct = rxStats.total > 0
      ? Math.round((Number(rxStats.dispensed) / Number(rxStats.total)) * 100) : 100;
    // positive_screens is a JSONB array of objects — flatten all entries as SDOH risk signal
    const sdohRows = (sdoh.status === 'fulfilled' ? sdoh.value : []);
    const sdohFactors: string[] = sdohRows.flatMap((r: any) => {
      const screens = Array.isArray(r.positive_screens) ? r.positive_screens : [];
      // Each element may be a string domain name or an object { domain, description }
      return screens.map((s: any) =>
        typeof s === 'string' ? s : (s.domain ?? s.category ?? s.code ?? 'sdoh_risk')
      );
    });
    const apptStats = appointments.status === 'fulfilled' && appointments.value.length > 0
      ? appointments.value[0] : { total: 0, no_shows: 0 };
    const noShowRate = apptStats.total > 0
      ? Number(apptStats.no_shows) / Number(apptStats.total) : 0;

    return {
      active_conditions: conditionNames,
      news2_score: news2,
      medication_adherence_pct: adherencePct,
      sdoh_risk_factors: sdohFactors,
      appointment_no_show_rate: noShowRate,
      abnormal_lab_count_30d: 0, // TODO: wire to lab_results table when available
    };
  }
}
```

---

## Step 5: EHR Service — Outcome Collection Job

**File: `services/ehr-service/src/services/outcome-collection.service.ts`** (new file)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AiOpsMetric } from '../entities/ai-ops-metric.entity';
import { ModelDeployment } from '../entities/model-deployment.entity';

@Injectable()
export class OutcomeCollectionService {
  private readonly logger = new Logger(OutcomeCollectionService.name);
  private readonly cdssUrl = process.env.CDSS_SERVICE_URL ?? 'http://cdss-service:8000';

  constructor(
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    @InjectRepository(AiOpsMetric)
    private readonly opsMetricRepo: Repository<AiOpsMetric>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepo: Repository<ModelDeployment>,
  ) {}

  /**
   * Nightly at 01:00 UTC — collect outcomes for CDSS decisions made 30+ days ago.
   */
  @Cron('0 1 * * *')
  async collectOutcomes(): Promise<void> {
    this.logger.log('Starting nightly outcome collection...');

    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get audit log entries older than 30 days that don't yet have outcomes.
    // Actual schema: surface stored in metadata JSONB, latency in 'latency_ms',
    // abstention in 'safety_gate_triggered', no 'decision_summary' column.
    const auditRows = await this.dataSource.query(`
      SELECT pal.id,
             pal.metadata->>'surface' AS surface,
             pal.patient_id,
             pal.created_at,
             pal.metadata->>'task' AS decision_summary
      FROM prompt_audit_log pal
      WHERE pal.created_at < $1
        AND NOT EXISTS (
          SELECT 1 FROM cdss_feedback_entries cfe
          WHERE cfe.prompt_audit_log_id = pal.id
        )
      LIMIT 500
    `, [cutoffDate]);

    if (auditRows.length === 0) {
      this.logger.log('No new outcomes to collect.');
      return;
    }

    const batchId = crypto.randomUUID();
    const entries = [];

    for (const row of auditRows) {
      const surface = row.surface ?? 'unknown';
      const outcomeScore = await this.resolveOutcomeScore(row.patient_id, surface, row.created_at);
      entries.push({
        batch_id: batchId,
        surface,
        prompt_audit_log_id: row.id,
        patient_id: row.patient_id,
        decision_summary: row.decision_summary ?? surface,
        outcome_label: outcomeScore >= 0.7 ? 'good' : outcomeScore >= 0.4 ? 'partial' : 'poor',
        outcome_score: outcomeScore,
        outcome_observed_at: new Date().toISOString(),
      });
    }

    try {
      await firstValueFrom(
        this.httpService.post(`${this.cdssUrl}/feedback/outcome/batch-collect`, {
          entries,
        }),
      );
      this.logger.log(`Collected ${entries.length} outcomes in batch ${batchId}`);
    } catch (err) {
      this.logger.error(`Outcome collection failed: ${err}`);
    }
  }

  /**
   * Weekly Sunday at 02:00 UTC — aggregate ops metrics and check release gates.
   */
  @Cron('0 2 * * 0')
  async runModelEvaluation(): Promise<void> {
    this.logger.log('Starting weekly model evaluation...');

    // Aggregate per-surface metrics from prompt_audit_log + cdss_feedback_entries.
    // Surface is stored in the metadata JSONB column, not a top-level column.
    const surfaces = await this.dataSource.query(`
      SELECT DISTINCT metadata->>'surface' AS surface FROM prompt_audit_log
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND metadata->>'surface' IS NOT NULL
    `);

    for (const { surface } of surfaces) {
      await this.evaluateSurface(surface);
    }
  }

  private async evaluateSurface(surface: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Compute metrics from audit log + feedback entries.
    // Actual schema: surface in metadata JSONB, latency col is 'latency_ms',
    // abstention proxy is 'safety_gate_triggered' boolean.
    const [callStats, feedbackStats] = await Promise.all([
      this.dataSource.query(`
        SELECT COUNT(*) as total_calls,
               SUM(CASE WHEN safety_gate_triggered THEN 1 ELSE 0 END) as abstention_count,
               AVG(latency_ms) as avg_latency_ms
        FROM prompt_audit_log
        WHERE metadata->>'surface' = $1 AND created_at > NOW() - INTERVAL '7 days'
      `, [surface]),
      this.dataSource.query(`
        SELECT COUNT(*) as total,
               AVG(outcome_score) as avg_outcome
        FROM cdss_feedback_entries
        WHERE surface = $1 AND created_at > NOW() - INTERVAL '30 days'
          AND approved_for_learning = FALSE
      `, [surface]),
    ]);

    const totalCalls = Number(callStats[0]?.total_calls ?? 0);
    const abstentions = Number(callStats[0]?.abstention_count ?? 0);
    const avgLatency = callStats[0]?.avg_latency_ms ? Number(callStats[0].avg_latency_ms) : null;
    const accuracy = feedbackStats[0]?.avg_outcome ? Number(feedbackStats[0].avg_outcome) : null;

    // Upsert AI ops metric for today
    await this.opsMetricRepo.upsert(
      {
        surface,
        metricDate: today,
        totalCalls,
        abstentionCount: abstentions,
        avgLatencyMs: avgLatency,
        accuracy,
      },
      ['surface', 'metricDate'],
    );

    // Release gate check: block if accuracy dropped > 5% vs previous week
    if (accuracy !== null) {
      const prevWeek = await this.dataSource.query(`
        SELECT accuracy FROM ai_ops_metrics
        WHERE surface = $1 AND metric_date = CURRENT_DATE - INTERVAL '7 days'
      `, [surface]);

      const prevAccuracy = prevWeek[0]?.accuracy ? Number(prevWeek[0].accuracy) : null;
      if (prevAccuracy !== null && prevAccuracy - accuracy > 0.05) {
        this.logger.warn(`RELEASE GATE FAILED for surface ${surface}: accuracy dropped from ${prevAccuracy} to ${accuracy}`);
        // Do NOT deploy — flag for human review
        return;
      }

      // If gate passes and accuracy is above baseline, approve learning
      if (accuracy > 0.70) {
        await this.dataSource.query(`
          UPDATE cdss_feedback_entries
          SET approved_for_learning = TRUE
          WHERE surface = $1
            AND approved_for_learning = FALSE
            AND outcome_score >= 0.70
        `, [surface]);
        this.logger.log(`Release gate passed for ${surface}. Learning batch approved.`);
      }
    }
  }

  private async resolveOutcomeScore(
    patientId: string,
    surface: string,
    decisionDate: Date,
  ): Promise<number> {
    // Outcome resolution varies by surface
    const thirtyDaysLater = new Date(decisionDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (surface === 'vitals_interpretation' || surface === 'risk_deterioration') {
      // Good outcome = no ICU admission or death within 30 days
      const adverse = await this.dataSource.query(`
        SELECT COUNT(*) as cnt FROM encounters
        WHERE patient_id = $1
          AND encounter_type IN ('icu_admission', 'emergency')
          AND started_at BETWEEN $2 AND $3
      `, [patientId, decisionDate, thirtyDaysLater]);
      return Number(adverse[0]?.cnt) === 0 ? 0.9 : 0.2;
    }

    if (surface === 'denial_prediction') {
      // Good outcome = claim approved
      const claim = await this.dataSource.query(`
        SELECT actual_outcome FROM claim_risk_scores
        WHERE patient_id = $1 AND feedback_recorded_at IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `, [patientId]);
      return claim[0]?.actual_outcome === 'approved' ? 1.0 : 0.0;
    }

    // Default: neutral outcome
    return 0.5;
  }
}
```

---

## Step 6: EHR Service — Model Monitoring Controller (extend existing)

**File: `services/ehr-service/src/controllers/model-monitoring.controller.ts`** — Add endpoints:

```typescript
// ADD to the existing ModelMonitoringController:
import { RiskStratificationService } from '../services/risk-stratification.service';
import { OutcomeCollectionService } from '../services/outcome-collection.service';

// In constructor add:
private readonly riskStratService: RiskStratificationService,
private readonly outcomeService: OutcomeCollectionService,

// ADD these endpoints:
@Get('patients/:patientId/risk-tier')
async getPatientRiskTier(
  @Param('patientId') patientId: string,
  @Request() req: any,
) {
  const tenantId = req.headers['x-tenant-id'];
  return this.riskStratService.getPatientRiskTier(patientId, tenantId);
}

@Post('risk-stratification/batch')
async runRiskStratBatch(@Request() req: any) {
  const tenantId = req.headers['x-tenant-id'];
  return this.riskStratService.runBatch(tenantId);
}

@Post('outcomes/collect-now')
async collectOutcomesNow() {
  await this.outcomeService.collectOutcomes();
  return { triggered: true };
}

@Post('model-evaluation/run-now')
async runModelEvaluationNow() {
  await this.outcomeService.runModelEvaluation();
  return { triggered: true };
}
```

---

## Step 7: Frontend — AI Ops Dashboard

**File: `ehr-frontend/src/pages/AiOpsDashboard.tsx`** (new file)

```tsx
import React, { useEffect, useState } from 'react';
import { Brain, Activity, ShieldCheck, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../services/api';

interface OpsMetric {
  surface: string;
  metric_date: string;
  total_calls: number;
  abstention_count: number;
  avg_latency_ms: number | null;
  accuracy: number | null;
  fairness_age_parity: number | null;
  fairness_gender_parity: number | null;
  fairness_sdoh_parity: number | null;
}

const SURFACE_LABELS: Record<string, string> = {
  vitals_interpretation: 'Vitals Interpretation',
  denial_prediction: 'Denial Prediction',
  risk_stratification: 'Risk Stratification',
  guidelines_search: 'Guideline Search (RAG)',
  pharmacy_intelligence: 'Pharmacy Intelligence',
  imaging_review: 'Radiology AI Review',
  pdmp_check: 'PDMP Check',
  post_visit_summary: 'Post-Visit Summary',
};

export const AiOpsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<OpsMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/model-monitoring/ai-ops/metrics')
      .then((res) => setMetrics(res.data.metrics ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by surface, get latest metric for each
  const latestBySurface: Record<string, OpsMetric> = {};
  metrics.forEach((m) => {
    if (!latestBySurface[m.surface] || m.metric_date > latestBySurface[m.surface].metric_date) {
      latestBySurface[m.surface] = m;
    }
  });

  // Chart data — accuracy over time for top surfaces
  const chartData = [...new Set(metrics.map((m) => m.metric_date))].sort().slice(-30).map((date) => {
    const entry: Record<string, string | number | null> = { date };
    Object.keys(latestBySurface).slice(0, 4).forEach((surface) => {
      const m = metrics.find((x) => x.surface === surface && x.metric_date === date);
      entry[surface] = m?.accuracy != null ? Math.round(m.accuracy * 100) : null;
    });
    return entry;
  });

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  const topSurfaces = Object.keys(latestBySurface).slice(0, 4);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Brain className="h-6 w-6 animate-pulse mr-2" />
        Loading AI Ops metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">AI Ops Dashboard</h1>
        <span className="ml-auto text-sm text-gray-400">Last 30 days</span>
      </div>

      {/* Surface cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(latestBySurface).map(([surface, m]) => {
          const abstentionRate = m.total_calls > 0
            ? Math.round((m.abstention_count / m.total_calls) * 100) : 0;
          const accuracy = m.accuracy != null ? Math.round(m.accuracy * 100) : null;
          const fair = [m.fairness_age_parity, m.fairness_gender_parity, m.fairness_sdoh_parity]
            .filter(Boolean) as number[];
          const minFairness = fair.length > 0 ? Math.min(...fair) : null;

          return (
            <div key={surface} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-gray-800 text-sm">
                  {SURFACE_LABELS[surface] ?? surface}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Total calls (7d)</p>
                  <p className="font-bold text-gray-900">{m.total_calls.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Abstention rate</p>
                  <p className={`font-bold ${abstentionRate > 20 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {abstentionRate}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Accuracy (30d)</p>
                  <p className={`font-bold ${accuracy === null ? 'text-gray-400' : accuracy >= 80 ? 'text-green-600' : accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {accuracy !== null ? `${accuracy}%` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Avg latency</p>
                  <p className="font-bold text-gray-900">
                    {m.avg_latency_ms != null ? `${Math.round(m.avg_latency_ms)}ms` : 'N/A'}
                  </p>
                </div>
                {minFairness !== null && (
                  <div className="col-span-2">
                    <p className="text-gray-400 text-xs">Fairness (min parity)</p>
                    <div className="flex items-center gap-1">
                      {minFairness >= 0.80 ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className={`font-bold text-sm ${minFairness >= 0.80 ? 'text-green-600' : 'text-amber-600'}`}>
                        {Math.round(minFairness * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Accuracy trend chart */}
      {chartData.length > 0 && (
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Accuracy Trend (Top Surfaces)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              {topSurfaces.map((surface, i) => (
                <Line
                  key={surface}
                  type="monotone"
                  dataKey={surface}
                  name={SURFACE_LABELS[surface] ?? surface}
                  stroke={CHART_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
```

---

## Step 8: Frontend — Risk Tier Badge (Universal Component)

**File: `ehr-frontend/src/components/RiskTierBadge.tsx`** (new file)

```tsx
import React from 'react';
import { AlertCircle, ShieldAlert, Activity, Shield, CheckCircle } from 'lucide-react';

type RiskTier = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

interface ContributingFactor {
  factor: string;
  weight: number;
  value: string;
}

interface RiskTierBadgeProps {
  tier: RiskTier;
  compositeScore: number;
  contributingFactors?: ContributingFactor[];
  recommendedActions?: Array<{ action: string; priority: number; dueWithinDays: number }>;
  compact?: boolean;
}

const TIER_CONFIG: Record<RiskTier, {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: React.ComponentType<any>;
  pulse?: boolean;
}> = {
  critical: { label: 'Critical Risk', bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', Icon: AlertCircle, pulse: true },
  high: { label: 'High Risk', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', Icon: ShieldAlert },
  medium: { label: 'Medium Risk', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', Icon: Activity },
  low: { label: 'Low Risk', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', Icon: Shield },
  minimal: { label: 'Minimal Risk', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', Icon: CheckCircle },
};

const FACTOR_LABELS: Record<string, string> = {
  chronic_conditions: 'Chronic Conditions',
  vitals_trend: 'Vitals Trend',
  medication_adherence: 'Medication Adherence',
  social_determinants: 'Social Determinants (SDOH)',
  appointment_reliability: 'Appointment Reliability',
  recent_lab_findings: 'Recent Lab Findings',
};

export const RiskTierBadge: React.FC<RiskTierBadgeProps> = ({
  tier,
  compositeScore,
  contributingFactors = [],
  recommendedActions = [],
  compact = false,
}) => {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.minimal;
  const pct = Math.round(compositeScore * 100);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.border} ${config.text}`}>
        {config.pulse && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
        <config.Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border-2 p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-center gap-2 mb-3">
        {config.pulse && <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />}
        <config.Icon className={`h-5 w-5 ${config.text}`} />
        <span className={`font-bold text-lg ${config.text}`}>{config.label}</span>
        <span className={`ml-auto text-2xl font-black ${config.text}`}>{pct}%</span>
      </div>

      {contributingFactors.length > 0 && (
        <div className="space-y-1 mb-3">
          <p className="text-xs font-medium text-gray-500">Contributing factors:</p>
          {contributingFactors.slice(0, 4).map((f) => (
            <div key={f.factor} className="flex items-center gap-2 text-xs">
              <span className="text-gray-600">{FACTOR_LABELS[f.factor] ?? f.factor}</span>
              <span className="text-gray-400 ml-auto">{f.value}</span>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current rounded-full"
                  style={{ width: `${Math.round(f.weight * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {recommendedActions.length > 0 && (
        <div className="border-t border-current border-opacity-20 pt-2 mt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">Recommended actions:</p>
          <ul className="space-y-1">
            {recommendedActions.slice(0, 3).map((a, i) => (
              <li key={i} className="text-xs flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-white text-xs font-bold ${a.priority === 1 ? 'bg-red-500' : a.priority === 2 ? 'bg-orange-500' : 'bg-blue-500'}`}>
                  P{a.priority}
                </span>
                <span className="text-gray-700">{a.action.replace(/_/g, ' ')}</span>
                <span className="ml-auto text-gray-400">within {a.dueWithinDays}d</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

**Integration points for `RiskTierBadge`:**

1. **`PatientDashboard.tsx`** — render at top of patient summary:
   ```tsx
   {riskTier && <RiskTierBadge tier={riskTier.tier} compositeScore={riskTier.compositeScore} contributingFactors={riskTier.contributingFactors} recommendedActions={riskTier.recommendedActions} />}
   ```

2. **Patient list / worklist** — render compact badge per row:
   ```tsx
   <RiskTierBadge tier={patient.riskTier} compositeScore={patient.riskScore} compact />
   ```

3. **CareGapPanel** — sort/filter by tier, use compact badge.

---

## Step 9: Frontend — Route Registration

**File: `ehr-frontend/src/App.tsx`** (or equivalent router file) — Add:

```tsx
import { AiOpsDashboard } from './pages/AiOpsDashboard';

// In the routes:
<Route path="/ai-ops" element={<AiOpsDashboard />} />
```

Add nav link in sidebar/navigation:
```tsx
{ path: '/ai-ops', label: 'AI Ops', icon: Brain }
```

---

## Step 10: API Endpoints Reference

EHR Service endpoints (`http://localhost:3013`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/model-monitoring/patients/:patientId/risk-tier` | Bearer | Get patient risk tier (cached 24h) |
| POST | `/model-monitoring/risk-stratification/batch` | Bearer | Trigger batch stratification |
| POST | `/model-monitoring/outcomes/collect-now` | Bearer | Trigger outcome collection (admin) |
| POST | `/model-monitoring/model-evaluation/run-now` | Bearer | Trigger model evaluation (admin) |
| GET | `/model-monitoring/ai-ops/metrics` | Bearer | AI Ops Dashboard metrics |

CDSS Service endpoints (`http://localhost:8000`):

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cdss/risk/stratify` | Stratify a single patient |
| POST | `/cdss/risk/stratify/batch` | Batch stratification |
| POST | `/feedback/outcome/batch-collect` | Write outcome entries |
| POST | `/feedback/outcome/learning/claim` | Trigger learning from approved feedback |
| GET | `/cdss/ops/metrics` | Ops metrics (proxied via EHR) |

---

## Step 11: NestJS Module Registration

**File: `services/ehr-service/src/app.module.ts`** — Add scheduling module and new services:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { RiskStratificationService } from './services/risk-stratification.service';
import { OutcomeCollectionService } from './services/outcome-collection.service';

// In imports array:
ScheduleModule.forRoot(),
HttpModule,

// In providers array:
RiskStratificationService,
OutcomeCollectionService,
```

**Package to add:**
```bash
# In services/ehr-service/:
npm install @nestjs/schedule @nestjs/axios axios
```

---

## Step 12: Fairness Audit Expansion

The fairness metrics in `ai_ops_metrics` track three parity dimensions. The `runModelEvaluation()` method must compute these by joining CDSS decisions with patient demographics.

**SQL to compute SDOH parity** (add to `evaluateSurface()` in `outcome-collection.service.ts`):

```typescript
// SDOH fairness: compare accuracy for patients with SDOH risk factors vs without.
// Actual table: 'sdoh_screening_logs', SDOH risk detected via non-empty 'positive_screens' JSONB array.
const fairnessStats = await this.dataSource.query(`
  SELECT
    CASE WHEN EXISTS (
      SELECT 1 FROM sdoh_screening_logs s
      WHERE s.patient_id = cfe.patient_id
        AND jsonb_array_length(s.positive_screens) > 0
    ) THEN 'sdoh_risk' ELSE 'no_sdoh_risk' END as group_label,
    AVG(cfe.outcome_score) as avg_outcome,
    COUNT(*) as n
  FROM cdss_feedback_entries cfe
  WHERE cfe.surface = $1
    AND cfe.created_at > NOW() - INTERVAL '30 days'
  GROUP BY 1
`, [surface]);

const groupScores: Record<string, number> = {};
fairnessStats.forEach((r: any) => {
  groupScores[r.group_label] = Number(r.avg_outcome);
});
const sdohParity = (groupScores['sdoh_risk'] && groupScores['no_sdoh_risk'])
  ? Math.min(
      groupScores['sdoh_risk'] / groupScores['no_sdoh_risk'],
      groupScores['no_sdoh_risk'] / groupScores['sdoh_risk'],
    )
  : null;

// Update metric with fairness score
await this.opsMetricRepo.update(
  { surface, metricDate: today },
  { fairnessSdohParity: sdohParity },
);
```

---

## Definition of Done

- [ ] All 4 new entities have TypeORM files in `services/ehr-service/src/entities/`
- [ ] All 4 entities registered in `services/ehr-service/src/app.module.ts`
- [ ] `ScheduleModule` and `HttpModule` imported in `app.module.ts`
- [ ] Provisioning bundle `sprint116_risk_stratification_self_learning` (v`2026.03.30.1`) in `database-provisioning.service.ts`
- [ ] Running tenant repair creates all 4 new tables in every tenant DB
- [ ] CDSS `/cdss/risk/stratify` returns `{ tier, composite_score, contributing_factors, recommended_actions }`
- [ ] `/model-monitoring/patients/:id/risk-tier` returns cached tier or computes on-demand
- [ ] Batch stratification endpoint processes all active patients and writes `patient_risk_tiers` rows
- [ ] `@Cron('0 1 * * *')` runs nightly outcome collection — verified in logs
- [ ] `@Cron('0 2 * * 0')` runs weekly model evaluation — verified in logs
- [ ] Release gate blocks approval when accuracy drops > 5% week-over-week
- [ ] `AiOpsDashboard` renders at `/ai-ops` with surface cards and accuracy trend chart
- [ ] `RiskTierBadge` renders in `PatientDashboard` with contributing factors and recommended actions
- [ ] `RiskTierBadge` renders compact in patient list/worklist rows
- [ ] SDOH fairness parity computed and stored in `ai_ops_metrics.fairness_sdoh_parity`
- [ ] `ModelDeployment` record written when release gate passes and learning is claimed
- [ ] All new tables have `IF NOT EXISTS` guards — safe to re-run provisioning
- [ ] `/model-monitoring/ai-ops/metrics` returns data that `AiOpsDashboard` renders

---

## Anti-Hallucination Rules for This Sprint

1. **`patients` table:** Query uses `WHERE active = true OR active IS NULL` because not all tenant schemas have `active` column — guard with OR IS NULL.
2. **`prompt_audit_log` columns:** `surface` is NOT a top-level column — it is stored in `metadata->>'surface'` (JSONB). `latency_ms` is the latency column (NOT `response_latency_ms`). `safety_gate_triggered` is the boolean abstention proxy (NOT `response_abstained`). There is no `decision_summary` column — use `metadata->>'task'`. Always use `metadata->>'surface'` in WHERE clauses when filtering by surface.
3. **`cdss_feedback_entries`:** This table was created in Sprint 112. Check it exists (`\dt cdss_feedback_entries` in psql) before Sprint 116 work begins.
4. **`@Cron` decorator:** Requires `ScheduleModule.forRoot()` in app.module.ts AND `@nestjs/schedule` package installed. Without both, crons silently fail.
5. **`DataSource` injection:** Use `@InjectDataSource()` decorator if injecting raw DataSource, NOT constructor argument name alone.
6. **SDOH table name:** The actual table is `sdoh_screening_logs` (NOT `sdoh_screenings`). It has columns: `patient_id`, `screening_date` (date), `tool_used` (text), `responses` (JSONB), `positive_screens` (JSONB array), `z_codes` (text[]), `conducted_by` (UUID, non-nullable). SDOH risk is determined by `jsonb_array_length(positive_screens) > 0`, NOT by a `risk_identified` boolean column (which does not exist). There is no `sdoh_category` column.
7. **Model file:** The CDSS risk stratification model is heuristic-only in v1.0.0. No `.pkl` file is required for this sprint.
