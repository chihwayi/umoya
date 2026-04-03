# MediCore Proactive AI Nervous System
## Architecture, Sprints 127–132 — Full Implementation Guide

> **Audience:** AI agents or developers implementing these sprints. This document is self-contained. No prior knowledge of MediCore is required beyond reading this document. All file paths, entity names, port numbers, and service names are explicit.

---

## System Map (Quick Reference)

| Service | Language | Port | Key Role |
|---|---|---|---|
| `ehr-service` | NestJS/TypeScript | 3013 | Main API, DB, business logic |
| `cdss-service` | FastAPI/Python | 8000 | AI inference, RAG, guidelines |
| `tenant-service` | NestJS/TypeScript | 3001 | Multi-tenancy, DB provisioning |
| `ehr-frontend` | React/TypeScript | 3000 | Clinical UI |
| `postgres-master` | PostgreSQL 15 | 5432 | All relational data |
| `redis` | Redis 7 | 6379 | Cache, queues |

**Existing WebSocket namespaces (already live):**
- `/alerts` — pushes `clinical_alert` events to `user:{userId}` rooms
- `/ambient` — transcription session events
- `/telemedicine` — video consultation events

**DB Provisioning Rule (apply to EVERY sprint that adds/modifies a table):**
```
After adding any TypeORM entity or migration:
1. Run: cd services/tenant-service && npx ts-node src/scripts/repairTenants.ts
2. OR call: POST http://localhost:3001/admin/tenants/repair-all
This ensures new tables appear in all existing tenant databases AND all future databases.
```

---

## What We Are Building

The current system is **reactive** — a clinician must ask a question to get AI help. This nervous system makes the AI **proactive** by:

1. **Firing automatically** at 6 trigger points (chart open, vitals saved, labs received, prescription created, admission, nightly batch)
2. **Pushing results** via existing WebSocket to the clinician's screen before they ask
3. **Storing snapshots** so any page that opens a patient chart immediately has fresh AI data
4. **Running risk scores continuously** so deterioration, sepsis, fall risk are always visible

### Trigger Points → Response Channels

```
TRIGGER                          FIRES                              DELIVERED VIA
──────────────────────────────────────────────────────────────────────────────────
Patient chart opened          →  Full patient analysis (async)   →  WebSocket push
Vitals saved                  →  Critical value + sepsis check   →  Inline + WebSocket
Lab results received          →  Lab interpretation + alerts     →  Inline + WebSocket
Prescription created          →  Drug interaction + allergy      →  Inline + WebSocket
Admission recorded            →  Full admission analysis         →  WebSocket push
Nightly 02:00 batch           →  Care gaps, overdue reviews      →  Stored + badge count
Manual "Analyze" button       →  On-demand full analysis         →  Inline + WebSocket
```

### New Tables Summary

| Table | Purpose |
|---|---|
| `patient_ai_snapshots` | Latest full AI analysis per patient (1 row per patient) |
| `proactive_alerts` | Active/acknowledged clinical alerts |
| `patient_risk_scores` | Historical risk score timeseries |
| `proactive_alert_actions` | Audit log of what clinician did with each alert |

---

## Sprint 127 — Nervous System Foundation
### Goal: New entities, CDSS full-analysis endpoint, EHR proactive service layer

**Duration:** 3 days
**Depends on:** Nothing (greenfield)

---

### 127.1 — New TypeORM Entity: `patient_ai_snapshots`

**File:** `services/ehr-service/src/entities/patient-ai-snapshot.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index
} from 'typeorm';

@Entity('patient_ai_snapshots')
@Index(['patientId'])
export class PatientAiSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  // One-line clinical summary for chart header
  @Column({ name: 'clinical_summary', type: 'text', nullable: true })
  clinicalSummary: string;

  // Full structured AI analysis payload
  @Column({ name: 'analysis_payload', type: 'jsonb', nullable: true })
  analysisPayload: Record<string, any>;

  // Risk scores: { sepsis: 0.78, deterioration: 0.45, fall: 0.12, readmission: 0.71 }
  @Column({ name: 'risk_scores', type: 'jsonb', nullable: true })
  riskScores: Record<string, number>;

  // Active flags: ["hiv_no_art", "missed_anc", "critical_bp"]
  @Column({ name: 'active_flags', type: 'jsonb', nullable: true })
  activeFlags: string[];

  // Top 3 guideline citations used in analysis
  @Column({ name: 'guideline_citations', type: 'jsonb', nullable: true })
  guidelineCitations: any[];

  // Which trigger fired this snapshot: chart_open | vitals | labs | admission | batch | manual
  @Column({ name: 'trigger_type', type: 'varchar', length: 40, nullable: true })
  triggerType: string;

  // NEWS2 score at time of snapshot
  @Column({ name: 'news2_score', type: 'int', nullable: true })
  news2Score: number;

  // qSOFA score
  @Column({ name: 'qsofa_score', type: 'int', nullable: true })
  qsofaScore: number;

  // Model used for this snapshot
  @Column({ name: 'model_version', type: 'varchar', length: 80, nullable: true })
  modelVersion: string;

  @Column({ name: 'snapshot_generated_at', type: 'timestamptz', default: () => 'NOW()' })
  snapshotGeneratedAt: Date;

  @Column({ name: 'triggered_by_user_id', type: 'uuid', nullable: true })
  triggeredByUserId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### 127.2 — New TypeORM Entity: `proactive_alerts`

**File:** `services/ehr-service/src/entities/proactive-alert.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index
} from 'typeorm';

export enum AlertSeverity {
  CRITICAL = 'critical',   // Requires immediate action (red)
  HIGH = 'high',           // Requires action this visit (orange)
  MEDIUM = 'medium',       // Should be addressed (yellow)
  LOW = 'low',             // Informational (blue)
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  ACTIONED = 'actioned',
  DISMISSED = 'dismissed',
  EXPIRED = 'expired',
}

export enum AlertCategory {
  SEPSIS = 'sepsis',
  DRUG_INTERACTION = 'drug_interaction',
  CRITICAL_VALUE = 'critical_value',
  CARE_GAP = 'care_gap',
  DETERIORATION = 'deterioration',
  ALLERGY = 'allergy',
  TREATMENT_GAP = 'treatment_gap',
  MISSED_FOLLOWUP = 'missed_followup',
  HIGH_RISK_MED = 'high_risk_med',
  LAB_ABNORMAL = 'lab_abnormal',
  VITALS_ABNORMAL = 'vitals_abnormal',
  GUIDELINE_DEVIATION = 'guideline_deviation',
  PREECLAMPSIA = 'preeclampsia',
  READMISSION_RISK = 'readmission_risk',
  COINFECTION = 'coinfection',
}

@Entity('proactive_alerts')
@Index(['patientId', 'status'])
@Index(['tenantId', 'status', 'severity'])
@Index(['targetUserId', 'status'])
export class ProactiveAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'category', type: 'varchar', length: 60 })
  category: AlertCategory;

  @Column({ name: 'severity', type: 'varchar', length: 20, default: AlertSeverity.MEDIUM })
  severity: AlertSeverity;

  @Column({ name: 'status', type: 'varchar', length: 30, default: AlertStatus.ACTIVE })
  status: AlertStatus;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'message', type: 'text' })
  message: string;

  // Recommended action for the clinician
  @Column({ name: 'recommended_action', type: 'text', nullable: true })
  recommendedAction: string;

  // Guideline reference that backs this alert
  @Column({ name: 'guideline_reference', type: 'varchar', length: 300, nullable: true })
  guidelineReference: string;

  // Raw data that triggered this alert (e.g. the vitals that caused sepsis flag)
  @Column({ name: 'trigger_data', type: 'jsonb', nullable: true })
  triggerData: Record<string, any>;

  // Which trigger type: vitals | labs | prescription | chart_open | batch | admission
  @Column({ name: 'trigger_type', type: 'varchar', length: 40, nullable: true })
  triggerType: string;

  // Target user to notify (null = all clinical staff for this patient)
  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string;

  // Confidence score from CDSS (0.0 - 1.0)
  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidenceScore: number;

  // Auto-expire after this time if not acknowledged
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ name: 'acknowledged_by_id', type: 'uuid', nullable: true })
  acknowledgedById: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId: string;

  // Deduplication key — prevents re-alerting on same condition
  @Column({ name: 'dedup_key', type: 'varchar', length: 200, nullable: true })
  @Index()
  dedupKey: string;

  @Column({ name: 'is_suppressed', type: 'boolean', default: false })
  isSuppressed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

### 127.3 — New TypeORM Entity: `patient_risk_scores`

**File:** `services/ehr-service/src/entities/patient-risk-score.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('patient_risk_scores')
@Index(['patientId', 'scoredAt'])
@Index(['tenantId', 'scoreType'])
export class PatientRiskScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  // Type: sepsis | deterioration | fall | readmission | preeclampsia | news2 | qsofa
  @Column({ name: 'score_type', type: 'varchar', length: 60 })
  scoreType: string;

  @Column({ name: 'score_value', type: 'decimal', precision: 5, scale: 4 })
  scoreValue: number;

  // Risk level derived from score: low | medium | high | critical
  @Column({ name: 'risk_level', type: 'varchar', length: 20 })
  riskLevel: string;

  // The raw data inputs that produced this score
  @Column({ name: 'input_data', type: 'jsonb', nullable: true })
  inputData: Record<string, any>;

  // Trigger: vitals | labs | batch | chart_open | admission
  @Column({ name: 'trigger_type', type: 'varchar', length: 40, nullable: true })
  triggerType: string;

  @Column({ name: 'model_version', type: 'varchar', length: 80, nullable: true })
  modelVersion: string;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId: string;

  @Column({ name: 'scored_at', type: 'timestamptz', default: () => 'NOW()' })
  scoredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

### 127.4 — Register Entities in EHR Service

**File:** `services/ehr-service/src/app.module.ts`

Find the `TypeOrmModule.forRootAsync` entities array and add:
```typescript
import { PatientAiSnapshot } from './entities/patient-ai-snapshot.entity';
import { ProactiveAlert } from './entities/proactive-alert.entity';
import { PatientRiskScore } from './entities/patient-risk-score.entity';

// Add to entities array:
PatientAiSnapshot,
ProactiveAlert,
PatientRiskScore,
```

---

### ⚠ DB PROVISIONING STEP — Sprint 127

After adding the 3 entities above, run provisioning so all tenant databases get the new tables:

```bash
# Option A — CLI script (run from repo root)
cd services/tenant-service
npx ts-node src/scripts/repairTenants.ts

# Option B — HTTP (if tenant-service is running)
curl -X POST http://localhost:3001/admin/tenants/repair-all

# Verify tables exist
docker compose exec postgres-master psql -U $DB_USERNAME -d <tenant_db_name> -c "\dt patient_ai_snapshots"
docker compose exec postgres-master psql -U $DB_USERNAME -d <tenant_db_name> -c "\dt proactive_alerts"
docker compose exec postgres-master psql -U $DB_USERNAME -d <tenant_db_name> -c "\dt patient_risk_scores"
```

---

### 127.5 — New CDSS Endpoint: Full Patient Analysis

**File:** `services/cdss-service/main.py`

Add this endpoint to the FastAPI app. It accepts a condensed patient payload (not raw history) and returns a structured analysis:

```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class PatientSummaryPayload(BaseModel):
    patient_id: str
    age: int
    gender: str
    chronic_conditions: Optional[List[str]] = []
    active_medications: Optional[List[Dict[str, Any]]] = []
    allergies: Optional[List[str]] = []
    latest_vitals: Optional[Dict[str, Any]] = {}
    latest_labs: Optional[List[Dict[str, Any]]] = []
    recent_diagnoses: Optional[List[Dict[str, Any]]] = []
    # Last 3 visits only — do NOT send full history
    recent_visits_summary: Optional[List[Dict[str, Any]]] = []
    pregnancy_status: Optional[str] = None
    hiv_status: Optional[str] = None
    trigger_type: Optional[str] = "chart_open"
    tenant_id: Optional[str] = None

class ProactiveAnalysisResponse(BaseModel):
    patient_id: str
    clinical_summary: str
    risk_scores: Dict[str, float]
    risk_levels: Dict[str, str]
    active_alerts: List[Dict[str, Any]]
    care_gaps: List[Dict[str, Any]]
    treatment_recommendations: List[Dict[str, Any]]
    guideline_citations: List[Dict[str, Any]]
    news2_score: Optional[int]
    qsofa_score: Optional[int]
    model_version: str
    processing_time_ms: int

@app.post("/patient/analyze/proactive", response_model=ProactiveAnalysisResponse)
async def proactive_patient_analysis(payload: PatientSummaryPayload):
    """
    Full proactive patient analysis. Called automatically at trigger points
    (chart open, vitals save, lab results, admission).
    Accepts a condensed patient snapshot — NOT the full history — to keep latency low.
    """
    import time
    start_ms = int(time.time() * 1000)

    patient_context = f"""
Patient: {payload.age}yo {payload.gender}
Chronic conditions: {', '.join(payload.chronic_conditions) if payload.chronic_conditions else 'None documented'}
Active medications: {len(payload.active_medications)} medications
Allergies: {', '.join(payload.allergies) if payload.allergies else 'NKDA'}
HIV status: {payload.hiv_status or 'Unknown'}
Pregnancy: {payload.pregnancy_status or 'N/A'}
"""
    vitals = payload.latest_vitals or {}
    labs = payload.latest_labs or []
    diagnoses = payload.recent_diagnoses or []
    visits = payload.recent_visits_summary or []

    alerts = []
    risk_scores = {}
    risk_levels = {}
    care_gaps = []
    recommendations = []
    citations = []

    # 1. NEWS2 Score
    news2 = _calculate_news2(vitals)
    qsofa = _calculate_qsofa(vitals)
    if news2 is not None:
        risk_scores['news2_raw'] = float(news2)
        if news2 >= 7:
            risk_levels['news2'] = 'critical'
            alerts.append({
                'category': 'deterioration',
                'severity': 'critical',
                'title': f'NEWS2 Score: {news2} — Urgent clinical review required',
                'message': f'NEWS2 score of {news2} indicates high risk of clinical deterioration. Immediate senior review needed.',
                'recommended_action': 'Escalate to senior clinician immediately. Continuous monitoring.',
                'guideline_reference': 'Royal College of Physicians NEWS2 Guidelines 2017',
                'trigger_data': {'news2': news2, 'vitals': vitals}
            })
        elif news2 >= 5:
            risk_levels['news2'] = 'high'
            alerts.append({
                'category': 'deterioration',
                'severity': 'high',
                'title': f'NEWS2 Score: {news2} — Increased monitoring needed',
                'message': f'NEWS2 score of {news2} indicates medium-high risk. Increase monitoring frequency.',
                'recommended_action': 'Monitor vitals every 1 hour. Consider senior review.',
                'guideline_reference': 'Royal College of Physicians NEWS2 Guidelines 2017',
                'trigger_data': {'news2': news2, 'vitals': vitals}
            })
        elif news2 >= 3:
            risk_levels['news2'] = 'medium'
        else:
            risk_levels['news2'] = 'low'

    # 2. Sepsis / qSOFA
    if qsofa is not None:
        risk_scores['qsofa'] = float(qsofa)
        if qsofa >= 2:
            risk_levels['sepsis'] = 'high'
            alerts.append({
                'category': 'sepsis',
                'severity': 'critical',
                'title': f'qSOFA ≥ 2 — Possible Sepsis',
                'message': f'qSOFA score {qsofa}/3. Sepsis protocol should be initiated. Apply Sepsis 6 bundle within 1 hour.',
                'recommended_action': 'Blood cultures × 2, IV access, IV fluids, broad-spectrum antibiotics, urine output monitoring, lactate.',
                'guideline_reference': 'Surviving Sepsis Campaign Guidelines 2021',
                'trigger_data': {'qsofa': qsofa, 'vitals': vitals}
            })
        else:
            risk_levels['sepsis'] = 'low'

    # 3. Critical Vitals
    sbp = vitals.get('systolic_bp') or vitals.get('sbp')
    dbp = vitals.get('diastolic_bp') or vitals.get('dbp')
    spo2 = vitals.get('oxygen_saturation') or vitals.get('spo2')
    if sbp and sbp >= 180:
        alerts.append({
            'category': 'vitals_abnormal',
            'severity': 'high',
            'title': f'Hypertensive Crisis — BP {sbp}/{dbp}',
            'message': 'Systolic BP ≥ 180 mmHg. Assess for end-organ damage. Check for headache, chest pain, visual changes.',
            'recommended_action': 'Immediate BP recheck. Consider IV antihypertensives if symptomatic.',
            'guideline_reference': 'WHO Hypertension Guidelines 2023',
            'trigger_data': vitals
        })
    if payload.pregnancy_status in ['pregnant', 'antenatal'] and sbp and sbp >= 160 and dbp and dbp >= 110:
        alerts.append({
            'category': 'preeclampsia',
            'severity': 'critical',
            'title': 'Severe Pre-eclampsia Criteria Met',
            'message': f'BP {sbp}/{dbp} in pregnancy. Severe pre-eclampsia criteria. Assess for headache, visual disturbance, epigastric pain, oedema.',
            'recommended_action': 'Urgent obstetric review. MgSO4 prophylaxis. Antihypertensive treatment. Consider delivery.',
            'guideline_reference': 'WHO ANC Recommendations 2016 — Hypertension in Pregnancy',
            'trigger_data': vitals
        })
    if spo2 and spo2 < 92:
        alerts.append({
            'category': 'vitals_abnormal',
            'severity': 'critical',
            'title': f'Critical SpO2: {spo2}%',
            'message': f'Oxygen saturation {spo2}% — below 92% threshold. Supplemental oxygen required.',
            'recommended_action': 'Apply supplemental O2 immediately. Assess airway. Consider CPAP/BiPAP if no improvement.',
            'guideline_reference': 'BTS Oxygen Guidelines 2017',
            'trigger_data': vitals
        })

    # 4. HIV/TB Care Gaps
    condition_lower = [c.lower() for c in payload.chronic_conditions]
    med_names = [m.get('name', '').lower() for m in payload.active_medications]
    has_hiv = payload.hiv_status in ['positive', 'hiv_positive'] or 'hiv' in condition_lower or 'aids' in condition_lower
    on_art = any(drug in ' '.join(med_names) for drug in ['tenofovir', 'lamivudine', 'efavirenz', 'dolutegravir', 'lopinavir', 'atazanavir', 'tdf', 'ftc', '3tc'])
    has_tb = any('tuberculosis' in c or ' tb' in c or c.startswith('tb') for c in condition_lower)
    on_tb_tx = any(drug in ' '.join(med_names) for drug in ['isoniazid', 'rifampicin', 'rifampin', 'pyrazinamide', 'ethambutol', 'rhze'])

    if has_hiv and not on_art:
        care_gaps.append({
            'type': 'treatment_gap',
            'category': 'hiv',
            'title': 'HIV — No ART documented',
            'message': 'Patient has HIV diagnosis but no antiretroviral therapy documented in active medications.',
            'recommended_action': 'Review ART status. Initiate or document current ART regimen. Check viral load.',
            'guideline_reference': 'WHO Consolidated HIV Guidelines 2021 — Treat All Policy',
            'priority': 'critical'
        })
    if has_hiv and has_tb and on_tb_tx and not on_art:
        alerts.append({
            'category': 'coinfection',
            'severity': 'critical',
            'title': 'HIV/TB Co-infection — ART not documented',
            'message': 'Patient on TB treatment with HIV diagnosis but no ART documented. WHO recommends ART initiation within 2 weeks of TB treatment start.',
            'recommended_action': 'Initiate ART within 2 weeks of TB treatment. Preferred: dolutegravir-based regimen.',
            'guideline_reference': 'WHO HIV/TB Guidelines 2021',
            'trigger_data': {'has_hiv': True, 'has_tb': True}
        })

    # 5. RAG-backed guideline recommendations
    rag_results = []
    if diagnostic_assistant and diagnostic_assistant.rag_engine:
        query_terms = []
        if payload.chronic_conditions:
            query_terms.extend(payload.chronic_conditions[:3])
        if diagnoses:
            query_terms.extend([d.get('description', '') for d in diagnoses[:2]])
        if query_terms:
            query_str = ' '.join(query_terms)
            try:
                rag_results = diagnostic_assistant.rag_engine.query(query_str, n_results=3, tenant_id=payload.tenant_id)
                citations = [{
                    'source': r.get('source', ''),
                    'text': r.get('text', '')[:300],
                    'confidence': r.get('confidence', 0.0)
                } for r in rag_results]
            except Exception:
                pass

    # 6. Clinical summary (LLM or rule-based fallback)
    clinical_summary = _build_clinical_summary(payload, alerts, care_gaps, news2, qsofa)

    # 7. Deterioration / readmission risk
    det_risk = _estimate_deterioration_risk(vitals, payload.chronic_conditions, labs, news2)
    readm_risk = _estimate_readmission_risk(payload, visits)
    risk_scores['deterioration'] = round(det_risk, 3)
    risk_scores['readmission'] = round(readm_risk, 3)
    risk_levels['deterioration'] = 'critical' if det_risk > 0.7 else 'high' if det_risk > 0.5 else 'medium' if det_risk > 0.3 else 'low'
    risk_levels['readmission'] = 'critical' if readm_risk > 0.7 else 'high' if readm_risk > 0.5 else 'medium' if readm_risk > 0.3 else 'low'

    end_ms = int(time.time() * 1000)

    return ProactiveAnalysisResponse(
        patient_id=payload.patient_id,
        clinical_summary=clinical_summary,
        risk_scores=risk_scores,
        risk_levels=risk_levels,
        active_alerts=alerts,
        care_gaps=care_gaps,
        treatment_recommendations=recommendations,
        guideline_citations=citations,
        news2_score=news2,
        qsofa_score=qsofa,
        model_version="medicore-proactive-v1.0",
        processing_time_ms=(end_ms - start_ms)
    )


def _calculate_news2(vitals: dict) -> Optional[int]:
    """Calculate NEWS2 score from vitals dict."""
    if not vitals:
        return None
    score = 0
    rr = vitals.get('respiratory_rate')
    spo2 = vitals.get('oxygen_saturation') or vitals.get('spo2')
    temp = vitals.get('temperature')
    sbp = vitals.get('systolic_bp') or vitals.get('sbp')
    hr = vitals.get('heart_rate')

    if rr is not None:
        if rr <= 8 or rr >= 25: score += 3
        elif rr >= 21: score += 2
        elif rr <= 11: score += 1

    if spo2 is not None:
        if spo2 <= 91: score += 3
        elif spo2 <= 93: score += 2
        elif spo2 <= 95: score += 1

    if temp is not None:
        if temp <= 35.0 or temp >= 39.1: score += 3
        elif temp >= 38.1: score += 2
        elif temp <= 36.0: score += 1

    if sbp is not None:
        if sbp <= 90 or sbp >= 220: score += 3
        elif sbp <= 100: score += 2
        elif sbp <= 110: score += 1

    if hr is not None:
        if hr <= 40 or hr >= 131: score += 3
        elif hr >= 111: score += 2
        elif hr <= 50 or hr >= 91: score += 1

    return score


def _calculate_qsofa(vitals: dict) -> Optional[int]:
    """Calculate qSOFA score."""
    if not vitals:
        return None
    score = 0
    rr = vitals.get('respiratory_rate')
    sbp = vitals.get('systolic_bp') or vitals.get('sbp')
    if rr and rr >= 22: score += 1
    if sbp and sbp <= 100: score += 1
    # Altered mentation not available from vitals alone — GCS if present
    gcs = vitals.get('glasgow_coma_scale') or vitals.get('gcs_total')
    if gcs and gcs < 15: score += 1
    return score


def _estimate_deterioration_risk(vitals: dict, conditions: list, labs: list, news2: Optional[int]) -> float:
    """Simple heuristic deterioration risk 0.0-1.0."""
    score = 0.0
    if news2 is not None:
        score = min(news2 / 20.0, 0.8)
    condition_risk = {'heart failure': 0.2, 'copd': 0.15, 'diabetes': 0.1, 'ckd': 0.15, 'hiv': 0.1}
    for c in (conditions or []):
        for k, v in condition_risk.items():
            if k in c.lower():
                score = min(score + v, 1.0)
    return min(score, 1.0)


def _estimate_readmission_risk(payload, visits: list) -> float:
    """Simple 30-day readmission risk heuristic."""
    score = 0.1
    if len(payload.chronic_conditions) >= 3: score += 0.2
    if len(payload.active_medications) >= 6: score += 0.1
    if payload.age and payload.age >= 65: score += 0.1
    if payload.age and payload.age >= 80: score += 0.1
    return min(score, 1.0)


def _build_clinical_summary(payload, alerts, care_gaps, news2, qsofa) -> str:
    """Build a one-paragraph clinical summary."""
    parts = [
        f"{payload.age}yo {payload.gender.lower()}",
    ]
    if payload.chronic_conditions:
        parts.append(f"with {', '.join(payload.chronic_conditions[:3])}")
    if payload.pregnancy_status in ['pregnant', 'antenatal']:
        parts.append("(pregnant)")
    if alerts:
        critical = [a for a in alerts if a['severity'] == 'critical']
        if critical:
            parts.append(f"— ⚠ {len(critical)} critical alert(s): {critical[0]['title']}")
    if care_gaps:
        parts.append(f"— {len(care_gaps)} care gap(s) identified")
    if news2 is not None and news2 >= 5:
        parts.append(f"— NEWS2={news2} (elevated risk)")
    return ' '.join(parts)
```

---

### 127.6 — New EHR Service: `ProactiveAiService`

**File:** `services/ehr-service/src/services/proactive-ai.service.ts`

This is the orchestrator. It builds the condensed patient payload, calls CDSS, stores the snapshot, generates alerts, and pushes via WebSocket.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PatientAiSnapshot } from '../entities/patient-ai-snapshot.entity';
import { ProactiveAlert, AlertStatus, AlertSeverity, AlertCategory } from '../entities/proactive-alert.entity';
import { PatientRiskScore } from '../entities/patient-risk-score.entity';
import { CdssService } from './cdss.service';
import { CriticalAlertGateway } from '../gateways/critical-alert.gateway';
import * as crypto from 'crypto';

export interface ProactiveTriggerContext {
  patientId: string;
  tenantId: string;
  triggeredByUserId?: string;
  triggerType: 'chart_open' | 'vitals' | 'labs' | 'prescription' | 'admission' | 'batch' | 'manual';
  // Pass only recent data — do NOT pass full history
  freshVitals?: Record<string, any>;
  freshLabs?: any[];
  freshPrescriptions?: any[];
}

@Injectable()
export class ProactiveAiService {
  private readonly logger = new Logger(ProactiveAiService.name);

  constructor(
    @InjectRepository(PatientAiSnapshot)
    private snapshotRepo: Repository<PatientAiSnapshot>,
    @InjectRepository(ProactiveAlert)
    private alertRepo: Repository<ProactiveAlert>,
    @InjectRepository(PatientRiskScore)
    private riskScoreRepo: Repository<PatientRiskScore>,
    private cdssService: CdssService,
    private alertGateway: CriticalAlertGateway,
    private dataSource: DataSource,
  ) {}

  /**
   * Main entry point. Called from controllers at trigger points.
   * Runs asynchronously — does NOT block the triggering HTTP response.
   */
  async triggerAnalysis(ctx: ProactiveTriggerContext): Promise<void> {
    // Run async — never await from the triggering controller
    this.runAnalysis(ctx).catch(err =>
      this.logger.error(`Proactive analysis failed [${ctx.triggerType}/${ctx.patientId}]: ${err.message}`)
    );
  }

  /**
   * Synchronous version — used when the caller NEEDS the result inline
   * (e.g. chart-open returns summary immediately).
   */
  async runAnalysisSync(ctx: ProactiveTriggerContext): Promise<PatientAiSnapshot | null> {
    return this.runAnalysis(ctx);
  }

  private async runAnalysis(ctx: ProactiveTriggerContext): Promise<PatientAiSnapshot | null> {
    try {
      // 1. Build condensed patient payload from DB
      const patientPayload = await this.buildPatientPayload(ctx);
      if (!patientPayload) return null;

      // 2. Call CDSS
      const analysis = await this.cdssService.proactiveAnalysis(patientPayload);
      if (!analysis) return null;

      // 3. Store snapshot (upsert — one row per patient)
      const snapshot = await this.upsertSnapshot(ctx, analysis);

      // 4. Store risk scores (historical series)
      await this.storeRiskScores(ctx, analysis, snapshot.id);

      // 5. Generate and store alerts (with deduplication)
      const newAlerts = await this.processAlerts(ctx, analysis, snapshot.id);

      // 6. Push via WebSocket to any connected clinicians caring for this patient
      if (newAlerts.length > 0) {
        await this.pushAlerts(ctx, newAlerts, snapshot);
      }

      return snapshot;
    } catch (err) {
      this.logger.error(`runAnalysis error: ${err.message}`);
      return null;
    }
  }

  private async buildPatientPayload(ctx: ProactiveTriggerContext): Promise<any> {
    const { patientId, tenantId, freshVitals, freshLabs, freshPrescriptions } = ctx;

    // Use raw queries for performance — we only need specific fields
    const patient = await this.dataSource.query(
      `SELECT id, date_of_birth, gender, chronic_conditions, allergies, pregnancy_status
       FROM patients WHERE id = $1`,
      [patientId]
    );
    if (!patient.length) return null;
    const p = patient[0];

    const age = p.date_of_birth
      ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0;

    // Latest vitals (prefer freshly-passed vitals, fall back to DB)
    const latestVitals = freshVitals ?? (await this.dataSource.query(
      `SELECT systolic_bp, diastolic_bp, heart_rate, temperature, oxygen_saturation,
              respiratory_rate, weight, height, bmi, blood_glucose, glasgow_coma_scale
       FROM vitals WHERE patient_id = $1
       ORDER BY recorded_at DESC LIMIT 1`,
      [patientId]
    ).then(rows => rows[0] || {}));

    // Active medications (names only — no PHI beyond drug names)
    const meds = freshPrescriptions ?? (await this.dataSource.query(
      `SELECT medication_name, dosage, frequency
       FROM prescriptions WHERE patient_id = $1 AND status = 'active' LIMIT 20`,
      [patientId]
    ));

    // Recent lab results (last 5, key values only)
    const labs = freshLabs ?? (await this.dataSource.query(
      `SELECT tests, results, created_at FROM lab_orders
       WHERE patient_id = $1 AND status = 'completed'
       ORDER BY created_at DESC LIMIT 5`,
      [patientId]
    ));

    // Recent diagnoses (last 3 encounters — NOT full history)
    const diagnoses = await this.dataSource.query(
      `SELECT diagnoses, visit_date FROM medical_records
       WHERE patient_id = $1
       ORDER BY visit_date DESC LIMIT 3`,
      [patientId]
    ).then(rows => rows.flatMap(r => r.diagnoses || []));

    // Visit summaries (last 3 visits — chief complaint + assessment only)
    const visits = await this.dataSource.query(
      `SELECT chief_complaint, assessment, visit_date FROM medical_records
       WHERE patient_id = $1
       ORDER BY visit_date DESC LIMIT 3`,
      [patientId]
    );

    return {
      patient_id: patientId,
      age,
      gender: p.gender || 'unknown',
      chronic_conditions: this.parseStringArray(p.chronic_conditions),
      active_medications: meds.map((m: any) => ({ name: m.medication_name, dosage: m.dosage })),
      allergies: this.parseStringArray(p.allergies),
      latest_vitals: latestVitals,
      latest_labs: labs.map((l: any) => l.results || []).flat().slice(0, 10),
      recent_diagnoses: diagnoses.slice(0, 6),
      recent_visits_summary: visits.map((v: any) => ({
        date: v.visit_date,
        chief_complaint: v.chief_complaint,
        assessment: v.assessment?.substring(0, 200)
      })),
      pregnancy_status: p.pregnancy_status,
      hiv_status: null, // derived from conditions above
      trigger_type: ctx.triggerType,
      tenant_id: tenantId,
    };
  }

  private parseStringArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return [value]; }
    }
    return [];
  }

  private async upsertSnapshot(ctx: ProactiveTriggerContext, analysis: any): Promise<PatientAiSnapshot> {
    const existing = await this.snapshotRepo.findOne({
      where: { patientId: ctx.patientId, tenantId: ctx.tenantId }
    });

    const data: Partial<PatientAiSnapshot> = {
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      clinicalSummary: analysis.clinical_summary,
      analysisPayload: analysis,
      riskScores: analysis.risk_scores,
      activeFlags: (analysis.active_alerts || []).map((a: any) => a.category),
      guidelineCitations: analysis.guideline_citations || [],
      triggerType: ctx.triggerType,
      news2Score: analysis.news2_score,
      qsofaScore: analysis.qsofa_score,
      modelVersion: analysis.model_version,
      snapshotGeneratedAt: new Date(),
      triggeredByUserId: ctx.triggeredByUserId || null,
    };

    if (existing) {
      await this.snapshotRepo.update(existing.id, data);
      return { ...existing, ...data } as PatientAiSnapshot;
    } else {
      return this.snapshotRepo.save(this.snapshotRepo.create(data));
    }
  }

  private async storeRiskScores(ctx: ProactiveTriggerContext, analysis: any, snapshotId: string): Promise<void> {
    const scores = analysis.risk_scores || {};
    const levels = analysis.risk_levels || {};
    const entries = Object.entries(scores).map(([type, value]) => ({
      patientId: ctx.patientId,
      tenantId: ctx.tenantId,
      scoreType: type,
      scoreValue: value as number,
      riskLevel: levels[type] || 'unknown',
      triggerType: ctx.triggerType,
      modelVersion: analysis.model_version,
      snapshotId,
      scoredAt: new Date(),
    }));
    if (entries.length) {
      await this.riskScoreRepo.save(this.riskScoreRepo.create(entries as any));
    }
  }

  private async processAlerts(ctx: ProactiveTriggerContext, analysis: any, snapshotId: string): Promise<ProactiveAlert[]> {
    const rawAlerts = [...(analysis.active_alerts || []), ...(analysis.care_gaps || [])];
    const newAlerts: ProactiveAlert[] = [];

    for (const raw of rawAlerts) {
      // Build dedup key — prevents same alert firing twice for same patient/condition
      const dedupKey = crypto
        .createHash('md5')
        .update(`${ctx.patientId}:${raw.category || raw.type}:${raw.title}`)
        .digest('hex');

      // Check if active alert with same dedup key exists
      const existing = await this.alertRepo.findOne({
        where: { patientId: ctx.patientId, dedupKey, status: AlertStatus.ACTIVE }
      });
      if (existing) continue; // Already alerted

      const alert = this.alertRepo.create({
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        category: (raw.category || raw.type || 'care_gap') as AlertCategory,
        severity: (raw.severity || raw.priority || AlertSeverity.MEDIUM) as AlertSeverity,
        status: AlertStatus.ACTIVE,
        title: raw.title,
        message: raw.message,
        recommendedAction: raw.recommended_action,
        guidelineReference: raw.guideline_reference,
        triggerData: raw.trigger_data || {},
        triggerType: ctx.triggerType,
        confidenceScore: raw.confidence || null,
        snapshotId,
        dedupKey,
        // Critical alerts expire after 4h, others after 24h
        expiresAt: new Date(Date.now() + (raw.severity === 'critical' ? 4 : 24) * 3600 * 1000),
      });
      newAlerts.push(await this.alertRepo.save(alert));
    }

    return newAlerts;
  }

  private async pushAlerts(ctx: ProactiveTriggerContext, alerts: ProactiveAlert[], snapshot: PatientAiSnapshot): Promise<void> {
    // Find users currently caring for this patient (attending doctor + assigned nurses)
    const careTeam = await this.dataSource.query(
      `SELECT DISTINCT doctor_id as user_id FROM appointments
       WHERE patient_id = $1 AND status IN ('in_progress','checked_in')
       AND appointment_date >= NOW() - INTERVAL '8 hours'
       UNION
       SELECT DISTINCT recorded_by as user_id FROM vitals
       WHERE patient_id = $1 AND created_at >= NOW() - INTERVAL '8 hours'`,
      [ctx.patientId]
    );

    const payload = {
      type: 'proactive_analysis',
      patientId: ctx.patientId,
      clinicalSummary: snapshot.clinicalSummary,
      riskScores: snapshot.riskScores,
      alerts: alerts.map(a => ({
        id: a.id,
        category: a.category,
        severity: a.severity,
        title: a.title,
        message: a.message,
        recommendedAction: a.recommendedAction,
        guidelineReference: a.guidelineReference,
      })),
      news2Score: snapshot.news2Score,
      qsofaScore: snapshot.qsofaScore,
      triggerType: ctx.triggerType,
      generatedAt: snapshot.snapshotGeneratedAt,
    };

    for (const member of careTeam) {
      if (member.user_id) {
        this.alertGateway.sendToUser(member.user_id, payload);
      }
    }

    // Also push to the triggering user
    if (ctx.triggeredByUserId) {
      this.alertGateway.sendToUser(ctx.triggeredByUserId, payload);
    }
  }

  // ── Public query methods ───────────────────────────────────────

  async getSnapshot(patientId: string, tenantId: string): Promise<PatientAiSnapshot | null> {
    return this.snapshotRepo.findOne({ where: { patientId, tenantId } });
  }

  async getActiveAlerts(patientId: string, tenantId: string): Promise<ProactiveAlert[]> {
    return this.alertRepo.find({
      where: { patientId, tenantId, status: AlertStatus.ACTIVE },
      order: { severity: 'DESC', createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(alertId: string, userId: string, tenantId: string): Promise<ProactiveAlert | null> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId, tenantId } });
    if (!alert) return null;
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async dismissAlert(alertId: string, userId: string, tenantId: string): Promise<ProactiveAlert | null> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId, tenantId } });
    if (!alert) return null;
    alert.status = AlertStatus.DISMISSED;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    return this.alertRepo.save(alert);
  }

  async getRiskScoreHistory(patientId: string, tenantId: string, scoreType: string, days = 7): Promise<PatientRiskScore[]> {
    return this.riskScoreRepo.createQueryBuilder('r')
      .where('r.patient_id = :patientId', { patientId })
      .andWhere('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.score_type = :scoreType', { scoreType })
      .andWhere('r.scored_at >= NOW() - INTERVAL :days', { days: `${days} days` })
      .orderBy('r.scored_at', 'ASC')
      .getMany();
  }
}
```

---

### 127.7 — Add `proactiveAnalysis` to `CdssService`

**File:** `services/ehr-service/src/services/cdss.service.ts`

Add this method to the existing `CdssService` class:

```typescript
async proactiveAnalysis(payload: Record<string, any>): Promise<any> {
  try {
    const response = await this.cdssClient.post('/patient/analyze/proactive', payload);
    return response.data;
  } catch (err) {
    this.logger.warn(`proactiveAnalysis CDSS call failed: ${err.message}`);
    return null;
  }
}
```

---

### 127.8 — Register in App Module

**File:** `services/ehr-service/src/app.module.ts`

```typescript
import { ProactiveAiService } from './services/proactive-ai.service';
import { PatientAiSnapshot } from './entities/patient-ai-snapshot.entity';
import { ProactiveAlert } from './entities/proactive-alert.entity';
import { PatientRiskScore } from './entities/patient-risk-score.entity';

// In TypeOrmModule.forRootAsync entities: add PatientAiSnapshot, ProactiveAlert, PatientRiskScore
// In providers: add ProactiveAiService
// In exports: add ProactiveAiService (so other modules can inject it)
```

---

## Sprint 128 — Chart-Open Auto-Analysis
### Goal: When any patient chart is opened, the AI immediately analyses and returns a snapshot

**Duration:** 2 days
**Depends on:** Sprint 127

---

### 128.1 — Hook into Patient Context Endpoint

**File:** `services/ehr-service/src/controllers/patient.controller.ts`

Find the `GET /patients/:id/context` route handler. This is the one the frontend calls when opening a patient chart. Add proactive analysis trigger here:

```typescript
// Inject ProactiveAiService in constructor
constructor(
  // ... existing injections ...
  private readonly proactiveAiService: ProactiveAiService,
) {}

// In the GET /patients/:id/context handler, AFTER building the response:
@Get(':id/context')
async getPatientContext(@Param('id') id: string, @Request() req) {
  // ... existing logic to build context response ...
  const context = await this.patientService.getPatientContext(id);

  // ── PROACTIVE TRIGGER ──
  // Kick off async analysis — does NOT block this response
  const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
  const userId = req.user?.id;
  this.proactiveAiService.triggerAnalysis({
    patientId: id,
    tenantId,
    triggeredByUserId: userId,
    triggerType: 'chart_open',
  }).catch(() => {}); // fire-and-forget

  // Attach latest snapshot if already available (may be from previous trigger)
  const snapshot = await this.proactiveAiService.getSnapshot(id, tenantId);
  if (snapshot) {
    context['aiSnapshot'] = {
      clinicalSummary: snapshot.clinicalSummary,
      riskScores: snapshot.riskScores,
      activeFlags: snapshot.activeFlags,
      news2Score: snapshot.news2Score,
      qsofaScore: snapshot.qsofaScore,
      generatedAt: snapshot.snapshotGeneratedAt,
    };
  }

  return context;
}
```

---

### 128.2 — New Proactive Controller

**File:** `services/ehr-service/src/controllers/proactive-ai.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Body, Request, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProactiveAiService } from '../services/proactive-ai.service';

@Controller('proactive')
@UseGuards(JwtAuthGuard)
export class ProactiveAiController {
  constructor(private readonly proactiveAiService: ProactiveAiService) {}

  /** GET /proactive/patient/:patientId/snapshot — latest AI snapshot */
  @Get('patient/:patientId/snapshot')
  async getSnapshot(@Param('patientId') patientId: string, @Request() req) {
    const tenantId = req.user?.tenantId;
    return this.proactiveAiService.getSnapshot(patientId, tenantId);
  }

  /** POST /proactive/patient/:patientId/analyze — manual trigger */
  @Post('patient/:patientId/analyze')
  async triggerAnalysis(@Param('patientId') patientId: string, @Request() req) {
    const tenantId = req.user?.tenantId;
    const snapshot = await this.proactiveAiService.runAnalysisSync({
      patientId,
      tenantId,
      triggeredByUserId: req.user?.id,
      triggerType: 'manual',
    });
    return snapshot || { message: 'Analysis queued' };
  }

  /** GET /proactive/patient/:patientId/alerts — all active alerts for patient */
  @Get('patient/:patientId/alerts')
  async getPatientAlerts(@Param('patientId') patientId: string, @Request() req) {
    const tenantId = req.user?.tenantId;
    return this.proactiveAiService.getActiveAlerts(patientId, tenantId);
  }

  /** PATCH /proactive/alerts/:alertId/acknowledge */
  @Patch('alerts/:alertId/acknowledge')
  async acknowledgeAlert(@Param('alertId') alertId: string, @Request() req) {
    return this.proactiveAiService.acknowledgeAlert(alertId, req.user.id, req.user.tenantId);
  }

  /** PATCH /proactive/alerts/:alertId/dismiss */
  @Patch('alerts/:alertId/dismiss')
  async dismissAlert(@Param('alertId') alertId: string, @Request() req) {
    return this.proactiveAiService.dismissAlert(alertId, req.user.id, req.user.tenantId);
  }

  /** GET /proactive/patient/:patientId/risk-history?type=deterioration&days=7 */
  @Get('patient/:patientId/risk-history')
  async getRiskHistory(
    @Param('patientId') patientId: string,
    @Query('type') scoreType: string = 'deterioration',
    @Query('days') days: number = 7,
    @Request() req,
  ) {
    return this.proactiveAiService.getRiskScoreHistory(patientId, req.user.tenantId, scoreType, days);
  }

  /** GET /proactive/alerts/ward — all active alerts for current ward/tenant */
  @Get('alerts/ward')
  async getWardAlerts(@Request() req, @Query('severity') severity?: string) {
    // Returns all active alerts for this tenant (for nurse station overview)
    const tenantId = req.user?.tenantId;
    return this.proactiveAiService.getWardActiveAlerts(tenantId, severity);
  }
}
```

Add `getWardActiveAlerts` to `ProactiveAiService`:

```typescript
async getWardActiveAlerts(tenantId: string, severity?: string): Promise<ProactiveAlert[]> {
  const qb = this.alertRepo.createQueryBuilder('a')
    .where('a.tenant_id = :tenantId', { tenantId })
    .andWhere('a.status = :status', { status: AlertStatus.ACTIVE })
    .andWhere('(a.expires_at IS NULL OR a.expires_at > NOW())')
    .orderBy('CASE a.severity WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END', 'ASC')
    .addOrderBy('a.created_at', 'DESC')
    .limit(100);
  if (severity) qb.andWhere('a.severity = :severity', { severity });
  return qb.getMany();
}
```

---

## Sprint 129 — Real-Time Vitals Intelligence
### Goal: Every vitals save instantly triggers sepsis check, NEWS2, critical value alerts

**Duration:** 2 days
**Depends on:** Sprint 127

---

### 129.1 — Hook into Vitals Controller

**File:** `services/ehr-service/src/controllers/vitals.controller.ts`

Find `POST /vitals` handler. After saving vitals, trigger proactive analysis:

```typescript
@Post()
async createVitals(@Body() dto: CreateVitalsDto, @Request() req) {
  const saved = await this.vitalsService.create(dto);

  // ── PROACTIVE TRIGGER — pass fresh vitals so analysis doesn't re-fetch ──
  const tenantId = req.user?.tenantId;
  this.proactiveAiService.triggerAnalysis({
    patientId: dto.patientId,
    tenantId,
    triggeredByUserId: req.user?.id,
    triggerType: 'vitals',
    freshVitals: {
      systolic_bp: dto.systolicBp,
      diastolic_bp: dto.diastolicBp,
      heart_rate: dto.heartRate,
      temperature: dto.temperature,
      oxygen_saturation: dto.oxygenSaturation,
      respiratory_rate: dto.respiratoryRate,
      glasgow_coma_scale: dto.glasgowComaScale,
    },
  }).catch(() => {});

  return saved;
}
```

---

### 129.2 — Fast Vitals Alert Endpoint in CDSS (sub-100ms)

**File:** `services/cdss-service/main.py`

```python
class VitalsAlertPayload(BaseModel):
    patient_id: str
    vitals: Dict[str, Any]
    patient_age: Optional[int] = None
    pregnancy_status: Optional[str] = None
    known_conditions: Optional[List[str]] = []
    tenant_id: Optional[str] = None

@app.post("/vitals/analyze-realtime")
async def analyze_vitals_realtime(payload: VitalsAlertPayload):
    """
    Fast vitals-only analysis. Must return in < 200ms.
    Does NOT do RAG lookup. Pure rule-based + scoring.
    """
    vitals = payload.vitals
    alerts = []
    news2 = _calculate_news2(vitals)
    qsofa = _calculate_qsofa(vitals)

    sbp = vitals.get('systolic_bp') or vitals.get('sbp')
    dbp = vitals.get('diastolic_bp') or vitals.get('dbp')
    spo2 = vitals.get('oxygen_saturation') or vitals.get('spo2')
    temp = vitals.get('temperature')
    hr = vitals.get('heart_rate')
    rr = vitals.get('respiratory_rate')
    glucose = vitals.get('blood_glucose')

    if news2 is not None and news2 >= 5:
        alerts.append({'severity': 'critical' if news2 >= 7 else 'high', 'category': 'deterioration',
                       'title': f'NEWS2={news2}', 'message': f'NEWS2 score {news2} — clinical review needed'})
    if qsofa is not None and qsofa >= 2:
        alerts.append({'severity': 'critical', 'category': 'sepsis',
                       'title': f'qSOFA={qsofa} — Sepsis', 'message': 'Sepsis 6 bundle within 1 hour'})
    if sbp and sbp >= 180:
        alerts.append({'severity': 'high', 'category': 'vitals_abnormal',
                       'title': f'BP {sbp}/{dbp}', 'message': 'Hypertensive crisis — assess for end-organ damage'})
    if payload.pregnancy_status in ['pregnant', 'antenatal'] and sbp and sbp >= 160 and dbp and dbp >= 110:
        alerts.append({'severity': 'critical', 'category': 'preeclampsia',
                       'title': 'Severe Pre-eclampsia', 'message': 'Urgent obstetric review + MgSO4'})
    if spo2 and spo2 < 92:
        alerts.append({'severity': 'critical', 'category': 'vitals_abnormal',
                       'title': f'SpO2 {spo2}%', 'message': 'Critical hypoxia — supplemental O2 immediately'})
    if temp and temp >= 39.5:
        alerts.append({'severity': 'high', 'category': 'vitals_abnormal',
                       'title': f'High Fever {temp}°C', 'message': 'Consider sepsis screen, malaria RDT in endemic area'})
    if hr and hr > 130:
        alerts.append({'severity': 'high', 'category': 'vitals_abnormal',
                       'title': f'Tachycardia HR={hr}', 'message': 'Assess cause: sepsis, dehydration, pain, arrhythmia'})
    if glucose and glucose > 20.0:
        alerts.append({'severity': 'high', 'category': 'vitals_abnormal',
                       'title': f'Hyperglycaemia {glucose} mmol/L', 'message': 'Consider DKA/HHS workup. IV fluids + insulin protocol.'})
    if glucose and glucose < 3.0:
        alerts.append({'severity': 'critical', 'category': 'vitals_abnormal',
                       'title': f'Hypoglycaemia {glucose} mmol/L', 'message': 'Immediate glucose — 50ml 50% dextrose IV or oral if conscious'})

    return {
        'patient_id': payload.patient_id,
        'news2_score': news2,
        'qsofa_score': qsofa,
        'alerts': alerts,
        'alert_count': len(alerts),
        'has_critical': any(a['severity'] == 'critical' for a in alerts),
    }
```

---

## Sprint 130 — Lab Result Auto-Interpretation
### Goal: When lab results are posted, they are immediately interpreted and critical values alerted

**Duration:** 2 days
**Depends on:** Sprint 127

---

### 130.1 — Hook into Lab Order Controller

**File:** `services/ehr-service/src/controllers/lab-order.controller.ts`

Find `PUT /lab-orders/:id/results` or `PUT /lab-orders/:id/submit-results`:

```typescript
@Put(':id/submit-results')
async submitResults(@Param('id') id: string, @Body() dto: SubmitLabResultsDto, @Request() req) {
  const updated = await this.labOrderService.submitResults(id, dto);

  // ── PROACTIVE TRIGGER — pass fresh lab results ──
  const tenantId = req.user?.tenantId;
  this.proactiveAiService.triggerAnalysis({
    patientId: updated.patientId,
    tenantId,
    triggeredByUserId: req.user?.id,
    triggerType: 'labs',
    freshLabs: dto.results || [],
  }).catch(() => {});

  return updated;
}
```

### 130.2 — Critical Lab Values Endpoint in CDSS

**File:** `services/cdss-service/main.py`

```python
class LabCriticalCheckPayload(BaseModel):
    patient_id: str
    results: List[Dict[str, Any]]
    patient_age: Optional[int] = None
    known_conditions: Optional[List[str]] = []
    tenant_id: Optional[str] = None

@app.post("/labs/critical-check")
async def labs_critical_check(payload: LabCriticalCheckPayload):
    """
    Fast critical lab value detection. Returns immediately.
    Does not do LLM lookup — pure reference range checking.
    """
    CRITICAL_THRESHOLDS = {
        # (test_name_fragment, low_critical, high_critical, unit, message)
        'haemoglobin': (5.0, None, 'g/dL', 'Critical anaemia — transfusion may be required'),
        'hemoglobin': (5.0, None, 'g/dL', 'Critical anaemia — transfusion may be required'),
        'potassium': (2.5, 6.5, 'mmol/L', 'Critical potassium — cardiac arrhythmia risk'),
        'sodium': (120, 160, 'mmol/L', 'Critical sodium — neurological emergency risk'),
        'glucose': (2.0, 30.0, 'mmol/L', 'Critical glucose — DKA/HHS or hypoglycaemia'),
        'creatinine': (None, 800, 'μmol/L', 'Critical renal failure — consider dialysis'),
        'troponin': (None, 0.1, 'ng/mL', 'Elevated troponin — possible ACS'),
        'lactate': (None, 4.0, 'mmol/L', 'Critical lactate — septic shock / tissue hypoperfusion'),
        'platelet': (20, None, '×10⁹/L', 'Critical thrombocytopenia — bleeding risk'),
        'inr': (None, 5.0, '', 'Critical INR — major bleeding risk'),
        'ph': (7.2, 7.6, '', 'Critical blood pH — metabolic/respiratory emergency'),
    }
    alerts = []
    for result in payload.results:
        test_name = (result.get('testName') or result.get('test_name') or '').lower()
        value_raw = result.get('value') or result.get('result')
        try:
            value = float(str(value_raw).replace(',', '.'))
        except (TypeError, ValueError):
            continue
        for key, (low, high, unit, msg) in CRITICAL_THRESHOLDS.items():
            if key in test_name:
                is_critical = (low is not None and value < low) or (high is not None and value > high)
                if is_critical:
                    alerts.append({
                        'severity': 'critical',
                        'category': 'critical_value',
                        'title': f'Critical {result.get("testName", key)}: {value} {unit}',
                        'message': msg,
                        'trigger_data': result,
                        'recommended_action': 'Notify attending physician immediately. Repeat confirmatory test if needed.',
                        'guideline_reference': 'Laboratory Critical Values Protocol',
                    })
    return {'patient_id': payload.patient_id, 'alerts': alerts, 'critical_count': len(alerts)}
```

---

## Sprint 131 — Prescription Safety Auto-Check
### Goal: Every new prescription automatically checked for interactions, allergies, high-risk meds

**Duration:** 2 days
**Depends on:** Sprint 127

---

### 131.1 — Hook into Prescription Controller

**File:** `services/ehr-service/src/controllers/prescription.controller.ts`

```typescript
@Post()
async createPrescription(@Body() dto: CreatePrescriptionDto, @Request() req) {
  const saved = await this.prescriptionService.create(dto);

  // ── PROACTIVE TRIGGER ──
  const tenantId = req.user?.tenantId;
  this.proactiveAiService.triggerAnalysis({
    patientId: dto.patientId,
    tenantId,
    triggeredByUserId: req.user?.id,
    triggerType: 'prescription',
    freshPrescriptions: [{ name: dto.medicationName, dosage: dto.dosage }],
  }).catch(() => {});

  return saved;
}
```

---

## Sprint 132 — Nightly Care Gap Batch & Treatment Gap Detection
### Goal: Every night at 02:00, scan all active patients for care gaps and missed follow-ups

**Duration:** 3 days
**Depends on:** Sprint 127

---

### 132.1 — Add Nightly Batch to CdssOutcomeBatchService

**File:** `services/ehr-service/src/services/cdss-outcome-batch.service.ts`

Add a new `@Cron` job to the existing class:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProactiveAiService } from './proactive-ai.service';

// Inject ProactiveAiService in constructor

@Cron('0 2 * * *') // 02:00 every night
async runNightlyProactiveAnalysis() {
  this.logger.log('Starting nightly proactive AI analysis batch...');
  try {
    // Get all active patients across all tenants
    const tenants = await this.tenantService.getActiveTenants();
    for (const tenant of tenants) {
      await this.runProactiveBatchForTenant(tenant);
    }
  } catch (err) {
    this.logger.error(`Nightly proactive batch failed: ${err.message}`);
  }
}

private async runProactiveBatchForTenant(tenant: any): Promise<void> {
  try {
    // Get patients with active conditions (not all patients — too many)
    const patients = await this.dataSource.query(`
      SELECT DISTINCT p.id, p.chronic_conditions
      FROM patients p
      WHERE p.is_active = true
      AND (
        p.chronic_conditions IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM prescriptions pr WHERE pr.patient_id = p.id AND pr.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM appointments a WHERE a.patient_id = p.id
          AND a.appointment_date >= NOW() - INTERVAL '90 days'
        )
      )
      LIMIT 500
    `);

    this.logger.log(`Nightly batch: ${patients.length} patients for tenant ${tenant.id}`);

    // Process in batches of 10 to avoid overloading CDSS
    for (let i = 0; i < patients.length; i += 10) {
      const batch = patients.slice(i, i + 10);
      await Promise.allSettled(
        batch.map(p =>
          this.proactiveAiService.triggerAnalysis({
            patientId: p.id,
            tenantId: tenant.id,
            triggerType: 'batch',
          })
        )
      );
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } catch (err) {
    this.logger.error(`Nightly batch failed for tenant ${tenant.id}: ${err.message}`);
  }
}
```

### 132.2 — Care Gap Detection in CDSS (Disease Program Specific)

**File:** `services/cdss-service/main.py`

```python
class CareGapBatchPayload(BaseModel):
    patient_id: str
    age: int
    gender: str
    chronic_conditions: List[str] = []
    active_medications: List[Dict[str, Any]] = []
    hiv_status: Optional[str] = None
    pregnancy_status: Optional[str] = None
    last_visit_date: Optional[str] = None
    last_lab_date: Optional[str] = None
    last_viral_load_date: Optional[str] = None
    last_bp_check_date: Optional[str] = None
    last_hba1c_date: Optional[str] = None
    tenant_id: Optional[str] = None

@app.post("/care-gaps/batch-detect")
async def care_gaps_batch_detect(payload: CareGapBatchPayload):
    """
    Comprehensive care gap detection for nightly batch.
    Checks disease program requirements, overdue reviews, monitoring gaps.
    """
    from datetime import datetime, timedelta
    gaps = []
    today = datetime.utcnow()

    def months_since(date_str) -> Optional[float]:
        if not date_str:
            return None
        try:
            d = datetime.fromisoformat(str(date_str).replace('Z',''))
            return (today - d).days / 30.0
        except:
            return None

    conditions = [c.lower() for c in payload.chronic_conditions]
    med_names = ' '.join([m.get('name','').lower() for m in payload.active_medications])

    # HIV monitoring gaps
    has_hiv = payload.hiv_status in ['positive','hiv_positive'] or 'hiv' in conditions
    if has_hiv:
        vl_months = months_since(payload.last_viral_load_date)
        if vl_months is None or vl_months > 6:
            gaps.append({
                'type': 'care_gap', 'category': 'treatment_gap',
                'title': 'HIV — Viral Load overdue',
                'message': f'Last viral load: {"never" if vl_months is None else f"{vl_months:.0f} months ago"}. WHO recommends 6-monthly for stable patients.',
                'recommended_action': 'Order viral load test.',
                'guideline_reference': 'WHO HIV Monitoring Guidelines 2021',
                'priority': 'high'
            })
        on_art = any(d in med_names for d in ['tenofovir','lamivudine','efavirenz','dolutegravir','lopinavir'])
        if not on_art:
            gaps.append({
                'type': 'care_gap', 'category': 'treatment_gap',
                'title': 'HIV — No ART documented',
                'message': 'Active HIV diagnosis without documented ART.',
                'recommended_action': 'Confirm ART status. Initiate if not on treatment.',
                'guideline_reference': 'WHO HIV Treat-All Guidelines 2021',
                'priority': 'critical'
            })

    # Diabetes monitoring
    has_dm = any(d in ' '.join(conditions) for d in ['diabetes','dm '])
    if has_dm:
        hba1c_months = months_since(payload.last_hba1c_date)
        if hba1c_months is None or hba1c_months > 3:
            gaps.append({
                'type': 'care_gap', 'category': 'care_gap',
                'title': 'Diabetes — HbA1c overdue',
                'message': f'Last HbA1c: {"never documented" if hba1c_months is None else f"{hba1c_months:.0f} months ago"}.',
                'recommended_action': 'Order HbA1c. Target <7% (53 mmol/mol).',
                'guideline_reference': 'WHO Diabetes Management Guidelines 2023',
                'priority': 'medium'
            })

    # Hypertension monitoring
    has_htn = any(d in ' '.join(conditions) for d in ['hypertension','htn '])
    if has_htn:
        bp_months = months_since(payload.last_bp_check_date)
        if bp_months is None or bp_months > 1:
            gaps.append({
                'type': 'care_gap', 'category': 'care_gap',
                'title': 'Hypertension — BP check overdue',
                'message': f'Last BP recorded: {"never" if bp_months is None else f"{bp_months:.0f} months ago"}.',
                'recommended_action': 'Record blood pressure at every visit.',
                'guideline_reference': 'WHO Hypertension Guidelines 2023',
                'priority': 'medium'
            })

    # Pregnancy ANC monitoring
    if payload.pregnancy_status in ['pregnant', 'antenatal']:
        visit_months = months_since(payload.last_visit_date)
        if visit_months is None or visit_months > 1:
            gaps.append({
                'type': 'care_gap', 'category': 'missed_followup',
                'title': 'ANC visit overdue',
                'message': 'Pregnant patient with no visit in over 4 weeks.',
                'recommended_action': 'Contact patient for ANC follow-up.',
                'guideline_reference': 'WHO ANC Recommendations 2016',
                'priority': 'high'
            })

    # General follow-up gap
    visit_months = months_since(payload.last_visit_date)
    if payload.chronic_conditions and (visit_months is None or visit_months > 6):
        gaps.append({
            'type': 'care_gap', 'category': 'missed_followup',
            'title': 'Chronic condition — no visit in 6 months',
            'message': f'Patient with chronic conditions last seen {"never" if visit_months is None else f"{visit_months:.0f} months ago"}.',
            'recommended_action': 'Contact patient. Schedule follow-up appointment.',
            'guideline_reference': 'Chronic Disease Management Standards',
            'priority': 'medium'
        })

    return {
        'patient_id': payload.patient_id,
        'care_gaps': gaps,
        'gap_count': len(gaps),
        'has_critical': any(g.get('priority') == 'critical' for g in gaps)
    }
```

---

## Sprint 133 — Proactive Frontend Integration
### Goal: Nurses and doctors see live alerts, risk scores, and AI summary without clicking anything

**Duration:** 3 days
**Depends on:** Sprints 127–132

---

### 133.1 — Alert Bell Component (Ward-Wide)

**File:** `ehr-frontend/src/components/ProactiveAlertBell.tsx` (new file)

```typescript
import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Alert {
  id: string;
  patientId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  recommendedAction?: string;
  guidelineReference?: string;
}

const SEVERITY_COLOR = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-black',
  low: 'bg-blue-500 text-white',
};

export function ProactiveAlertBell({ userId, token }: { userId: string; token: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const socket: Socket = io(`${process.env.REACT_APP_EHR_API_URL}/alerts`, {
      auth: { userId, token },
    });

    socket.on('connect', () => {
      // Fetch existing active alerts on connect
      fetch(`${process.env.REACT_APP_EHR_API_URL}/proactive/alerts/ward`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => setAlerts(data || []));
    });

    socket.on('clinical_alert', (payload: any) => {
      if (payload.type === 'proactive_analysis' && payload.alerts?.length) {
        setAlerts(prev => {
          const newAlerts = payload.alerts as Alert[];
          // Deduplicate by id
          const ids = new Set(prev.map(a => a.id));
          return [...prev, ...newAlerts.filter(a => !ids.has(a.id))];
        });
      }
    });

    return () => { socket.disconnect(); };
  }, [userId, token]);

  const critical = alerts.filter(a => a.severity === 'critical').length;
  const total = alerts.length;

  const acknowledge = async (alertId: string) => {
    await fetch(`${process.env.REACT_APP_EHR_API_URL}/proactive/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-slate-700 transition-colors"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {total > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-xs flex items-center justify-center font-bold ${critical > 0 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
            {total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[420px] max-h-[500px] overflow-y-auto bg-slate-800 rounded-xl shadow-2xl border border-slate-600 z-50">
          <div className="p-3 border-b border-slate-600 flex justify-between items-center">
            <h3 className="text-white font-semibold text-sm">Clinical Alerts ({total})</h3>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
          {alerts.length === 0 && (
            <div className="p-4 text-slate-400 text-sm text-center">No active alerts</div>
          )}
          {alerts.map(alert => (
            <div key={alert.id} className={`p-3 border-b border-slate-700 ${alert.severity === 'critical' ? 'border-l-4 border-l-red-500' : alert.severity === 'high' ? 'border-l-4 border-l-orange-500' : ''}`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[alert.severity]}`}>
                  {alert.severity.toUpperCase()}
                </span>
                <button onClick={() => acknowledge(alert.id)} className="text-slate-500 hover:text-slate-300 text-xs">✓ Ack</button>
              </div>
              <p className="text-white text-sm font-medium">{alert.title}</p>
              <p className="text-slate-300 text-xs mt-1">{alert.message}</p>
              {alert.recommendedAction && (
                <p className="text-amber-400 text-xs mt-1">→ {alert.recommendedAction}</p>
              )}
              {alert.guidelineReference && (
                <p className="text-slate-500 text-xs mt-1 italic">{alert.guidelineReference}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 133.2 — Patient Risk Score Panel

**File:** `ehr-frontend/src/components/PatientRiskPanel.tsx` (new file)

```typescript
import React, { useEffect, useState } from 'react';

interface RiskScores {
  deterioration?: number;
  readmission?: number;
  news2_raw?: number;
  qsofa?: number;
}

interface RiskLevels {
  deterioration?: string;
  readmission?: string;
  news2?: string;
  sepsis?: string;
}

interface AiSnapshot {
  clinicalSummary: string;
  riskScores: RiskScores;
  activeFlags: string[];
  news2Score: number | null;
  qsofaScore: number | null;
  generatedAt: string;
}

const LEVEL_COLOR = {
  critical: 'text-red-400 bg-red-900/40',
  high: 'text-orange-400 bg-orange-900/40',
  medium: 'text-yellow-400 bg-yellow-900/40',
  low: 'text-green-400 bg-green-900/40',
  unknown: 'text-slate-400 bg-slate-800',
};

function RiskBadge({ label, value, level }: { label: string; value?: number; level?: string }) {
  const pct = value !== undefined ? Math.round(value * 100) : null;
  const color = LEVEL_COLOR[level as keyof typeof LEVEL_COLOR] || LEVEL_COLOR.unknown;
  return (
    <div className={`rounded-lg px-3 py-2 ${color} flex flex-col items-center min-w-[90px]`}>
      <span className="text-[10px] uppercase font-semibold opacity-70">{label}</span>
      <span className="text-lg font-bold">{pct !== null ? `${pct}%` : 'N/A'}</span>
      <span className="text-[10px] capitalize opacity-80">{level || '—'}</span>
    </div>
  );
}

export function PatientRiskPanel({ patientId, token, snapshot: initialSnapshot }: {
  patientId: string;
  token: string;
  snapshot?: AiSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(initialSnapshot || null);
  const [loading, setLoading] = useState(!initialSnapshot);

  useEffect(() => {
    if (initialSnapshot) { setSnapshot(initialSnapshot); return; }
    setLoading(true);
    fetch(`${process.env.REACT_APP_EHR_API_URL}/proactive/patient/${patientId}/snapshot`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { setSnapshot(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="text-slate-500 text-xs p-2">Analysing patient...</div>;
  if (!snapshot) return null;

  const analysis = snapshot as any;
  const riskLevels = analysis.analysisPayload?.risk_levels || {};

  return (
    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
      {/* Clinical Summary */}
      {snapshot.clinicalSummary && (
        <p className="text-slate-300 text-xs mb-3 italic border-l-2 border-amber-500 pl-2">
          {snapshot.clinicalSummary}
        </p>
      )}

      {/* Risk Scores Row */}
      <div className="flex gap-2 flex-wrap mb-3">
        {snapshot.news2Score !== null && (
          <div className={`rounded-lg px-3 py-2 flex flex-col items-center min-w-[80px] ${
            (snapshot.news2Score || 0) >= 7 ? LEVEL_COLOR.critical :
            (snapshot.news2Score || 0) >= 5 ? LEVEL_COLOR.high :
            (snapshot.news2Score || 0) >= 3 ? LEVEL_COLOR.medium : LEVEL_COLOR.low
          }`}>
            <span className="text-[10px] uppercase font-semibold opacity-70">NEWS2</span>
            <span className="text-xl font-bold">{snapshot.news2Score}</span>
            <span className="text-[10px] opacity-80">/20</span>
          </div>
        )}
        {snapshot.qsofaScore !== null && (
          <div className={`rounded-lg px-3 py-2 flex flex-col items-center min-w-[80px] ${
            (snapshot.qsofaScore || 0) >= 2 ? LEVEL_COLOR.critical : LEVEL_COLOR.low
          }`}>
            <span className="text-[10px] uppercase font-semibold opacity-70">qSOFA</span>
            <span className="text-xl font-bold">{snapshot.qsofaScore}</span>
            <span className="text-[10px] opacity-80">/3</span>
          </div>
        )}
        <RiskBadge label="Deterioration" value={snapshot.riskScores?.deterioration} level={riskLevels.deterioration} />
        <RiskBadge label="Readmission" value={snapshot.riskScores?.readmission} level={riskLevels.readmission} />
      </div>

      {/* Active Flags */}
      {snapshot.activeFlags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {snapshot.activeFlags.map(flag => (
            <span key={flag} className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 font-medium">
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <p className="text-slate-600 text-[10px] mt-2">
        ⚠ AI-assisted — verify against official hospital protocols before acting.
        Last updated: {new Date(snapshot.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
```

---

### 133.3 — Wire into NurseDashboard and DoctorDashboard

**File:** `ehr-frontend/src/pages/NurseDashboard.tsx`

In the top navigation bar section, add `<ProactiveAlertBell />`:
```typescript
import { ProactiveAlertBell } from '../components/ProactiveAlertBell';

// In the nav bar JSX, next to the existing notification icons:
<ProactiveAlertBell userId={currentUser.id} token={authToken} />
```

**File:** `ehr-frontend/src/pages/DoctorDashboard.tsx`

Same addition.

When opening a patient chart (in `PatientDetail.tsx` or wherever patient context is rendered):
```typescript
import { PatientRiskPanel } from '../components/PatientRiskPanel';

// In the patient header section, after name/DOB:
<PatientRiskPanel
  patientId={patient.id}
  token={authToken}
  snapshot={patient.aiSnapshot || null}
/>
```

---

## ⚠ DB Provisioning — Final Step (Apply After All Sprints)

After all entity files are created and registered:

```bash
# Step 1 — Restart EHR service to apply TypeORM auto-sync (if synchronize: true in dev)
docker compose restart ehr-service

# Step 2 — Provision all tenant databases
cd services/tenant-service
npx ts-node src/scripts/repairTenants.ts

# Step 3 — Verify
docker compose exec postgres-master psql -U $DB_USERNAME -d <any_tenant_db> -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('patient_ai_snapshots','proactive_alerts','patient_risk_scores');
"

# Step 4 — Test the proactive endpoint directly
curl -X POST http://localhost:8000/patient/analyze/proactive \
  -H 'Content-Type: application/json' \
  -d '{"patient_id":"test-123","age":52,"gender":"male","chronic_conditions":["HIV","Tuberculosis"],"latest_vitals":{"systolic_bp":185,"heart_rate":112,"respiratory_rate":24,"oxygen_saturation":88}}'

# Step 5 — Test EHR trigger
curl -X POST http://localhost:3013/proactive/patient/<patient-uuid>/analyze \
  -H 'Authorization: Bearer <jwt-token>'
```

---

## Summary: All New Endpoints

### EHR Service (port 3013)
| Method | Path | When Used |
|---|---|---|
| `GET` | `/proactive/patient/:id/snapshot` | Frontend polls for latest AI state |
| `POST` | `/proactive/patient/:id/analyze` | Manual "Re-analyse" button |
| `GET` | `/proactive/patient/:id/alerts` | Patient-specific alert list |
| `GET` | `/proactive/alerts/ward` | Nurse station alert overview |
| `PATCH` | `/proactive/alerts/:id/acknowledge` | Clinician acknowledges alert |
| `PATCH` | `/proactive/alerts/:id/dismiss` | Clinician dismisses alert |
| `GET` | `/proactive/patient/:id/risk-history` | Risk score chart over time |

### CDSS Service (port 8000)
| Method | Path | Latency Target |
|---|---|---|
| `POST` | `/patient/analyze/proactive` | < 2 seconds (full analysis) |
| `POST` | `/vitals/analyze-realtime` | < 200ms (rule-based only) |
| `POST` | `/labs/critical-check` | < 100ms (threshold lookup) |
| `POST` | `/care-gaps/batch-detect` | < 3 seconds (nightly batch) |

### WebSocket Events (existing `/alerts` namespace)
| Event | Direction | Payload |
|---|---|---|
| `clinical_alert` | Server → Client | `{type:'proactive_analysis', patientId, clinicalSummary, riskScores, alerts[], news2Score, qsofaScore}` |
| `acknowledge` | Client → Server | `{alertId}` |

---

## Patient History — Large Data Strategy

Large patient histories are handled by **never sending full history to CDSS**:

| Data | Strategy |
|---|---|
| Medical records | Send last 3 visits: chief_complaint + assessment only (first 200 chars) |
| Lab results | Send last 5 completed orders, max 10 result rows, key values only |
| Medications | Send active medications only (max 20), name + dosage |
| Diagnoses | Send last 6 diagnosis codes + descriptions |
| Vitals | Send single most recent record (or the freshly saved record) |
| Allergies | Send as string array |
| Full notes | Never sent — too large, PHI-heavy |

This keeps each CDSS payload under ~5KB regardless of how large the patient's full history is.

---

## Sprint Order & Dependencies

```
Sprint 127 (Foundation)     ← Start here. No dependencies.
     ↓
Sprint 128 (Chart Open)     ← Depends on 127
Sprint 129 (Vitals)         ← Depends on 127 (can parallel with 128)
Sprint 130 (Labs)           ← Depends on 127 (can parallel with 128+129)
Sprint 131 (Prescriptions)  ← Depends on 127 (can parallel)
     ↓
Sprint 132 (Nightly Batch)  ← Depends on 127+128
     ↓
Sprint 133 (Frontend)       ← Depends on all above
```
