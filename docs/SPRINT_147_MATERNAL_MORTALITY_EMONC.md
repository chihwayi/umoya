# Sprint 147 — Maternal Mortality Audit & EmONC

**Sprint**: S147  
**Module**: Maternal Death Surveillance & Response (MDSR), Emergency Obstetric & Neonatal Care (EmONC) signal tracking  
**Bundle version**: `2026.04.16.1`  
**Bundle ID**: `sprint147_maternal_mortality_emonc`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

Sub-Saharan Africa accounts for **66% of global maternal deaths** (WHO 2023). The SADC region has a maternal mortality ratio (MMR) of ~450/100,000 live births vs. a global target of <70. MediCore already has a Maternity module (antenatal, partograph, delivery, postnatal). What is completely missing:

1. **Maternal Death Surveillance and Response (MDSR)** — WHO mandates structured case review for every maternal death. Without it, facilities cannot identify avoidable causes or report to national systems.
2. **EmONC Signal Function Tracking** — UN/WHO measures EmONC capability by 9 signal functions. Facilities must track which they can perform to classify as Basic (BEmONC) or Comprehensive (CEmONC) EmONC facilities.

### Clinical standards implemented in this sprint

| Standard | Application |
|---|---|
| WHO MDSR Guidelines 2013 | Maternal death notification form, case review, Three Delays model |
| UN Process Indicators for EmONC 2009 | 7 basic + 2 comprehensive signal function tracking |
| ICD-MM Classification | Direct/indirect/coincidental/undetermined cause classification |
| SADC RMNCH Strategy | Regional MMR reduction targets, audit reporting |
| FIGO LOGIC 2024 | Near-miss audit alongside maternal death audit |

### What already exists (do NOT recreate)

- Maternity module (`MaternityController`, `MaternityService`, `ANCVisit`, `DeliveryRecord`, `PostnatalVisit` entities)
- `MaternityDoctorDashboard.tsx` (the frontend dashboard — add new tabs here)
- `MidwifeDashboard.tsx` (if it exists — check with `grep -r "MidwifeDashboard" ehr-frontend/src -l`)
- Notification service (`notificationsService.sendSms`)
- `hipaaAuditService` for PHI access logging

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-maternal-mortality-emonc.statements.ts`**

```typescript
export const TENANT_MATERNAL_MORTALITY_EMONC_BUNDLE_VERSION = '2026.04.16.1';

export const TENANT_MATERNAL_MORTALITY_EMONC_STATEMENTS: string[] = [

  // ── Maternal Death Registry ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS maternal_deaths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    facility_id UUID,
    reported_by UUID NOT NULL,
    death_date DATE NOT NULL,
    age_at_death INT,
    gestational_age_weeks INT,                 -- weeks at time of death
    -- ICD-MM Classification (WHO 2012)
    death_category TEXT NOT NULL DEFAULT 'undetermined',
    -- VALUES: 'direct_obstetric' | 'indirect_obstetric' | 'coincidental' | 'undetermined'
    primary_cause TEXT,                        -- free text + ICD-10 code (e.g. "Haemorrhage O72")
    icd10_primary TEXT,
    contributing_causes JSONB DEFAULT '[]',    -- [{ "cause": "Anaemia", "icd10": "D64" }]
    -- Three Delays Model (Thaddeus & Maine 1994)
    delay_1_recognition BOOLEAN,              -- delay in recognising danger sign / deciding to seek care
    delay_2_reaching BOOLEAN,                 -- delay in reaching facility
    delay_3_care BOOLEAN,                     -- delay in receiving adequate care at facility
    delay_notes TEXT,
    -- Avoidability
    avoidable BOOLEAN,
    avoidability_factors JSONB DEFAULT '[]',  -- [{ "factor": "No blood available", "level": "facility" }]
    -- Referral chain
    referred_from TEXT,                       -- facility name if referred in
    mode_of_admission TEXT,                   -- 'referred' | 'self_referred' | 'brought_in_dead'
    -- Near miss
    is_near_miss BOOLEAN NOT NULL DEFAULT false,  -- true = SAMM (Severe Acute Maternal Morbidity)
    -- Status
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMPTZ,
    review_status TEXT NOT NULL DEFAULT 'pending',
    -- VALUES: 'pending' | 'under_review' | 'completed' | 'submitted_to_district'
    district_submission_ref TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_patient ON maternal_deaths(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_date ON maternal_deaths(death_date)`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_category ON maternal_deaths(death_category)`,
  `CREATE INDEX IF NOT EXISTS idx_maternal_deaths_review ON maternal_deaths(review_status)`,

  // ── Maternal Death Case Review Sessions ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS maternal_death_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maternal_death_id UUID NOT NULL,
    reviewed_by UUID NOT NULL,           -- lead reviewer (doctor/obstetrician)
    review_date DATE NOT NULL DEFAULT CURRENT_DATE,
    review_team JSONB DEFAULT '[]',      -- [{ "name": "Dr X", "role": "obstetrician" }]
    -- Review findings
    timeline_summary TEXT,              -- what happened, step by step
    standard_of_care TEXT,              -- 'substandard' | 'standard_met' | 'unavoidable'
    -- Recommendations
    recommendations JSONB DEFAULT '[]', -- [{ "action": "Stock O2 concentrator", "responsible": "facility_manager", "due_date": "2026-06-01" }]
    action_plan_agreed BOOLEAN NOT NULL DEFAULT false,
    follow_up_date DATE,
    -- Outcome
    review_complete BOOLEAN NOT NULL DEFAULT false,
    submitted_to_district BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mdr_death_id ON maternal_death_reviews(maternal_death_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mdr_reviewed_by ON maternal_death_reviews(reviewed_by)`,

  // ── EmONC Signal Function Tracking ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS emonc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID,
    recorded_by UUID NOT NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    assessment_period_months INT NOT NULL DEFAULT 3,  -- rolling window assessed
    -- 7 Basic EmONC signal functions (UN 2009)
    -- For each: 'performed' | 'not_performed' | 'not_available' | 'unknown'
    sf1_parenteral_antibiotics TEXT NOT NULL DEFAULT 'unknown',     -- Admin parenteral antibiotics for sepsis
    sf2_parenteral_oxytocics TEXT NOT NULL DEFAULT 'unknown',       -- Admin parenteral uterotonics (oxytocin)
    sf3_parenteral_anticonvulsants TEXT NOT NULL DEFAULT 'unknown', -- Admin parenteral anticonvulsants (MgSO4)
    sf4_manual_removal_placenta TEXT NOT NULL DEFAULT 'unknown',    -- Manual removal of retained placenta
    sf5_removal_retained_products TEXT NOT NULL DEFAULT 'unknown',  -- Removal of retained products (MVA/D&C)
    sf6_neonatal_resuscitation TEXT NOT NULL DEFAULT 'unknown',     -- Neonatal resuscitation with bag+mask
    sf7_assisted_vaginal_delivery TEXT NOT NULL DEFAULT 'unknown',  -- Assisted vaginal delivery (vacuum/forceps)
    -- 2 Comprehensive EmONC additional signal functions
    sf8_caesarean_section TEXT NOT NULL DEFAULT 'unknown',          -- Caesarean section
    sf9_blood_transfusion TEXT NOT NULL DEFAULT 'unknown',          -- Blood transfusion
    -- Computed classification
    emonc_classification TEXT,
    -- VALUES: 'CEmONC' | 'BEmONC' | 'partial_BEmONC' | 'not_EmONC'
    -- Barriers / notes per non-performed function
    barriers JSONB DEFAULT '{}',  -- { "sf1": "No IV antibiotics stocked", "sf8": "No OT" }
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_emonc_facility ON emonc_signals(facility_id)`,
  `CREATE INDEX IF NOT EXISTS idx_emonc_date ON emonc_signals(assessment_date)`,
];
```

### 2b. Register bundle in `database-provisioning.service.ts`

Add after `sprint126_reporting_completeness` block:

```typescript
{
  id: 'sprint147_maternal_mortality_emonc',
  label: 'Maternal Mortality Audit & EmONC Signal Function Tracking',
  version: TENANT_MATERNAL_MORTALITY_EMONC_BUNDLE_VERSION,
  description: 'S147 — maternal_deaths, maternal_death_reviews, emonc_signals tables',
  statements: TENANT_MATERNAL_MORTALITY_EMONC_STATEMENTS,
},
```

Add import:

```typescript
import {
  TENANT_MATERNAL_MORTALITY_EMONC_STATEMENTS,
  TENANT_MATERNAL_MORTALITY_EMONC_BUNDLE_VERSION,
} from '../generated/tenant-maternal-mortality-emonc.statements';
```

---

## 3. TypeORM Entities

### 3a. `services/ehr-service/src/entities/maternal-death.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('maternal_deaths')
export class MaternalDeath {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'facility_id', type: 'uuid', nullable: true }) facilityId: string | null;
  @Column({ name: 'reported_by', type: 'uuid' }) reportedBy: string;
  @Column({ name: 'death_date', type: 'date' }) deathDate: string;
  @Column({ name: 'age_at_death', type: 'int', nullable: true }) ageAtDeath: number | null;
  @Column({ name: 'gestational_age_weeks', type: 'int', nullable: true }) gestationalAgeWeeks: number | null;
  @Column({ name: 'death_category', type: 'text', default: 'undetermined' }) deathCategory: string;
  @Column({ name: 'primary_cause', type: 'text', nullable: true }) primaryCause: string | null;
  @Column({ name: 'icd10_primary', type: 'text', nullable: true }) icd10Primary: string | null;
  @Column({ name: 'contributing_causes', type: 'jsonb', default: [] }) contributingCauses: Record<string, any>[];
  @Column({ name: 'delay_1_recognition', type: 'boolean', nullable: true }) delay1Recognition: boolean | null;
  @Column({ name: 'delay_2_reaching', type: 'boolean', nullable: true }) delay2Reaching: boolean | null;
  @Column({ name: 'delay_3_care', type: 'boolean', nullable: true }) delay3Care: boolean | null;
  @Column({ name: 'delay_notes', type: 'text', nullable: true }) delayNotes: string | null;
  @Column({ nullable: true }) avoidable: boolean | null;
  @Column({ name: 'avoidability_factors', type: 'jsonb', default: [] }) avoidabilityFactors: Record<string, any>[];
  @Column({ name: 'referred_from', type: 'text', nullable: true }) referredFrom: string | null;
  @Column({ name: 'mode_of_admission', type: 'text', nullable: true }) modeOfAdmission: string | null;
  @Column({ name: 'is_near_miss', type: 'boolean', default: false }) isNearMiss: boolean;
  @Column({ name: 'notification_sent', type: 'boolean', default: false }) notificationSent: boolean;
  @Column({ name: 'notification_sent_at', type: 'timestamptz', nullable: true }) notificationSentAt: Date | null;
  @Column({ name: 'review_status', type: 'text', default: 'pending' }) reviewStatus: string;
  @Column({ name: 'district_submission_ref', type: 'text', nullable: true }) districtSubmissionRef: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 3b. `services/ehr-service/src/entities/maternal-death-review.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('maternal_death_reviews')
export class MaternalDeathReview {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'maternal_death_id', type: 'uuid' }) maternalDeathId: string;
  @Column({ name: 'reviewed_by', type: 'uuid' }) reviewedBy: string;
  @Column({ name: 'review_date', type: 'date' }) reviewDate: string;
  @Column({ name: 'review_team', type: 'jsonb', default: [] }) reviewTeam: Record<string, any>[];
  @Column({ name: 'timeline_summary', type: 'text', nullable: true }) timelineSummary: string | null;
  @Column({ name: 'standard_of_care', type: 'text', nullable: true }) standardOfCare: string | null;
  @Column({ type: 'jsonb', default: [] }) recommendations: Record<string, any>[];
  @Column({ name: 'action_plan_agreed', type: 'boolean', default: false }) actionPlanAgreed: boolean;
  @Column({ name: 'follow_up_date', type: 'date', nullable: true }) followUpDate: string | null;
  @Column({ name: 'review_complete', type: 'boolean', default: false }) reviewComplete: boolean;
  @Column({ name: 'submitted_to_district', type: 'boolean', default: false }) submittedToDistrict: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 3c. `services/ehr-service/src/entities/emonc-signal.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('emonc_signals')
export class EmoncSignal {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'facility_id', type: 'uuid', nullable: true }) facilityId: string | null;
  @Column({ name: 'recorded_by', type: 'uuid' }) recordedBy: string;
  @Column({ name: 'assessment_date', type: 'date' }) assessmentDate: string;
  @Column({ name: 'assessment_period_months', type: 'int', default: 3 }) assessmentPeriodMonths: number;
  @Column({ name: 'sf1_parenteral_antibiotics', type: 'text', default: 'unknown' }) sf1ParenteralAntibiotics: string;
  @Column({ name: 'sf2_parenteral_oxytocics', type: 'text', default: 'unknown' }) sf2ParenteralOxytocics: string;
  @Column({ name: 'sf3_parenteral_anticonvulsants', type: 'text', default: 'unknown' }) sf3ParenteralAnticonvulsants: string;
  @Column({ name: 'sf4_manual_removal_placenta', type: 'text', default: 'unknown' }) sf4ManualRemovalPlacenta: string;
  @Column({ name: 'sf5_removal_retained_products', type: 'text', default: 'unknown' }) sf5RemovalRetainedProducts: string;
  @Column({ name: 'sf6_neonatal_resuscitation', type: 'text', default: 'unknown' }) sf6NeonatalResuscitation: string;
  @Column({ name: 'sf7_assisted_vaginal_delivery', type: 'text', default: 'unknown' }) sf7AssistedVaginalDelivery: string;
  @Column({ name: 'sf8_caesarean_section', type: 'text', default: 'unknown' }) sf8CaesareanSection: string;
  @Column({ name: 'sf9_blood_transfusion', type: 'text', default: 'unknown' }) sf9BloodTransfusion: string;
  @Column({ name: 'emonc_classification', type: 'text', nullable: true }) emoncClassification: string | null;
  @Column({ type: 'jsonb', default: {} }) barriers: Record<string, any>;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

---

## 4. CDSS Endpoint

**File**: `services/cdss-service/main.py` — add after the S146 zoonotic block.

### 4a. Pydantic models

```python
# Sprint 147 — Maternal Mortality / EmONC
class EmoncClassifyRequest(BaseModel):
    sf1_parenteral_antibiotics: str = 'unknown'
    sf2_parenteral_oxytocics: str = 'unknown'
    sf3_parenteral_anticonvulsants: str = 'unknown'
    sf4_manual_removal_placenta: str = 'unknown'
    sf5_removal_retained_products: str = 'unknown'
    sf6_neonatal_resuscitation: str = 'unknown'
    sf7_assisted_vaginal_delivery: str = 'unknown'
    sf8_caesarean_section: str = 'unknown'
    sf9_blood_transfusion: str = 'unknown'

class MaternalDeathAuditRequest(BaseModel):
    death_category: str                        # 'direct_obstetric' | 'indirect_obstetric' | 'coincidental' | 'undetermined'
    primary_cause: Optional[str] = None
    delay_1_recognition: Optional[bool] = None
    delay_2_reaching: Optional[bool] = None
    delay_3_care: Optional[bool] = None
    gestational_age_weeks: Optional[int] = None
    mode_of_admission: Optional[str] = None
    contributing_causes: Optional[List[str]] = []
```

### 4b. `POST /cdss/maternal/emonc-classify`

```python
@app.post("/cdss/maternal/emonc-classify")
async def emonc_classify(req: EmoncClassifyRequest):
    """
    Classify facility as CEmONC / BEmONC / partial_BEmONC / not_EmONC
    based on UN 9 signal functions. Returns classification + gaps + action items.
    """
    sf_values = {
        'sf1': req.sf1_parenteral_antibiotics,
        'sf2': req.sf2_parenteral_oxytocics,
        'sf3': req.sf3_parenteral_anticonvulsants,
        'sf4': req.sf4_manual_removal_placenta,
        'sf5': req.sf5_removal_retained_products,
        'sf6': req.sf6_neonatal_resuscitation,
        'sf7': req.sf7_assisted_vaginal_delivery,
        'sf8': req.sf8_caesarean_section,
        'sf9': req.sf9_blood_transfusion,
    }
    basic_sfs = ['sf1', 'sf2', 'sf3', 'sf4', 'sf5', 'sf6', 'sf7']
    comprehensive_sfs = ['sf8', 'sf9']

    basic_performed = [sf for sf in basic_sfs if sf_values.get(sf) == 'performed']
    comprehensive_performed = [sf for sf in comprehensive_sfs if sf_values.get(sf) == 'performed']
    basic_gaps = [sf for sf in basic_sfs if sf_values.get(sf) != 'performed']

    if len(basic_performed) == 7 and len(comprehensive_performed) == 2:
        classification = 'CEmONC'
        level = 'Comprehensive Emergency Obstetric & Neonatal Care'
        message = 'All 9 signal functions performed. This facility qualifies as a CEmONC facility.'
    elif len(basic_performed) == 7:
        classification = 'BEmONC'
        level = 'Basic Emergency Obstetric & Neonatal Care'
        message = 'All 7 basic signal functions performed. Missing CS and/or blood transfusion for CEmONC.'
    elif len(basic_performed) >= 4:
        classification = 'partial_BEmONC'
        level = 'Partial Basic EmONC'
        message = f'Only {len(basic_performed)}/7 basic signal functions performed. BEmONC requires all 7.'
    else:
        classification = 'not_EmONC'
        level = 'Not EmONC'
        message = f'Fewer than 4 basic signal functions performed ({len(basic_performed)}/7). Facility does not meet EmONC criteria.'

    sf_labels = {
        'sf1': 'Parenteral antibiotics (sepsis)',
        'sf2': 'Parenteral oxytocics (PPH)',
        'sf3': 'Parenteral anticonvulsants (eclampsia / MgSO4)',
        'sf4': 'Manual removal of retained placenta',
        'sf5': 'Removal of retained products (MVA/D&C)',
        'sf6': 'Neonatal resuscitation (bag + mask)',
        'sf7': 'Assisted vaginal delivery (vacuum / forceps)',
        'sf8': 'Caesarean section',
        'sf9': 'Blood transfusion',
    }

    gaps = [{'signal_function': sf, 'label': sf_labels[sf], 'status': sf_values.get(sf, 'unknown')} for sf in basic_gaps]
    comp_gaps = [{'signal_function': sf, 'label': sf_labels[sf], 'status': sf_values.get(sf, 'unknown')} for sf in comprehensive_sfs if sf_values.get(sf) != 'performed']

    return {
        'classification': classification,
        'level': level,
        'message': message,
        'basic_performed': len(basic_performed),
        'basic_required': 7,
        'comprehensive_performed': len(comprehensive_performed),
        'comprehensive_required': 2,
        'gaps': gaps,
        'comprehensive_gaps': comp_gaps,
        'recommendation': 'Address signal function gaps to upgrade facility classification.' if gaps else 'Maintain current EmONC capability and conduct quarterly assessments.',
    }
```

### 4c. `POST /cdss/maternal/death-audit-review`

```python
@app.post("/cdss/maternal/death-audit-review")
async def maternal_death_audit_review(req: MaternalDeathAuditRequest):
    """
    Given maternal death characteristics → Three Delays analysis,
    ICD-MM classification guidance, avoidability flags, and recommended audit questions.
    """
    delays_identified = []
    if req.delay_1_recognition:
        delays_identified.append({
            'delay': 1,
            'type': 'Recognition / decision to seek care',
            'common_causes': ['Patient / family did not recognise danger sign', 'Cultural barriers', 'Previous negative health experience', 'Cost fears'],
            'action': 'Community health education, CHW early warning systems, reduce financial barrier to seeking care',
        })
    if req.delay_2_reaching:
        delays_identified.append({
            'delay': 2,
            'type': 'Reaching appropriate facility',
            'common_causes': ['No transport', 'Long distance', 'Road impassable', 'Referral pathway unclear'],
            'action': 'Community transport scheme, maternity waiting home, clear referral protocols',
        })
    if req.delay_3_care:
        delays_identified.append({
            'delay': 3,
            'type': 'Receiving adequate care at facility',
            'common_causes': ['Staff shortage', 'Missing supplies/blood', 'Inadequate EmONC capability', 'Delayed diagnosis'],
            'action': 'EmONC signal function upgrade, blood bank stock, staff skills training, clinical audit',
        })

    avoidability_flags = []
    if req.delay_3_care:
        avoidability_flags.append('Facility-level delay suggests potentially avoidable death — review EmONC capability and supply chain')
    if req.death_category == 'direct_obstetric':
        avoidability_flags.append('Direct obstetric death — review clinical management against WHO/FIGO guidelines')
    if req.gestational_age_weeks and req.gestational_age_weeks >= 28:
        avoidability_flags.append('Death at ≥28 weeks — full perinatal audit recommended alongside maternal audit')

    icd_mm_guidance = {
        'direct_obstetric': 'Direct obstetric death: O00–O95, O98–O99 (excluding O96–O97). Caused by obstetric complication, intervention, omission, incorrect treatment.',
        'indirect_obstetric': 'Indirect obstetric death: O98–O99. Pre-existing disease aggravated by pregnancy (e.g., cardiac disease, HIV, malaria).',
        'coincidental': 'Coincidental (fortuitous) death: Not related to or influenced by pregnancy (e.g., trauma, cancer). Code underlying cause.',
        'undetermined': 'Undetermined: Insufficient information to classify. Attempt to clarify through death review.',
    }

    audit_questions = [
        'Was antenatal care received? How many visits?',
        'Were danger signs identified and acted upon promptly?',
        'Was the referral decision made in a timely manner?',
        'Was transport available within 30 minutes of referral decision?',
        'Was the facility equipped to manage the presenting complication?',
        'Were appropriate drugs (oxytocin, MgSO4, antibiotics, IV fluids) available and administered?',
        'Was blood available? If transfusion was needed, was it given within 1 hour?',
        'Was a senior clinician involved in decision-making?',
        'Were partograph recordings completed for all labour cases?',
        'Was the death notification submitted to district within 24 hours?',
    ]

    return {
        'death_category': req.death_category,
        'icd_mm_guidance': icd_mm_guidance.get(req.death_category, ''),
        'delays_identified': delays_identified,
        'number_of_delays': len(delays_identified),
        'avoidability_flags': avoidability_flags,
        'likely_avoidable': len(avoidability_flags) > 0,
        'audit_questions': audit_questions,
        'next_steps': [
            'Complete maternal death notification form within 24 hours',
            'Convene multidisciplinary case review within 7 days',
            'Document Three Delays and avoidability',
            'Agree facility-level action plan with responsible parties and due dates',
            'Submit to district health information system',
            'Follow up on action plan at next facility meeting',
        ],
    }
```

---

## 5. EHR Service

### 5a. `services/ehr-service/src/services/maternal-mortality.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CdssService } from './cdss.service';
import { MaternalDeath } from '../entities/maternal-death.entity';
import { MaternalDeathReview } from '../entities/maternal-death-review.entity';
import { EmoncSignal } from '../entities/emonc-signal.entity';

@Injectable()
export class MaternalMortalityService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Maternal Deaths ────────────────────────────────────────────────────────

  async reportDeath(
    tenantId: string,
    reportedBy: string,
    dto: Partial<MaternalDeath>,
  ): Promise<{ death: MaternalDeath; auditGuidance: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MaternalDeath);
    const entity = repo.create({ ...dto, reportedBy } as Partial<MaternalDeath>);
    const death = await repo.save(entity) as unknown as MaternalDeath;

    // Auto-run CDSS audit review for Three Delays + ICD-MM guidance
    let auditGuidance: Record<string, any> = {};
    try {
      auditGuidance = await this.cdssService.requestWithPolicy<Record<string, any>>(
        'POST', 'maternalDeathAudit', '/cdss/maternal/death-audit-review',
        {
          death_category: dto.deathCategory ?? 'undetermined',
          primary_cause: dto.primaryCause ?? undefined,
          delay_1_recognition: dto.delay1Recognition ?? undefined,
          delay_2_reaching: dto.delay2Reaching ?? undefined,
          delay_3_care: dto.delay3Care ?? undefined,
          gestational_age_weeks: dto.gestationalAgeWeeks ?? undefined,
          contributing_causes: dto.contributingCauses ?? [],
        },
        15000,
        tenantId,
      );
    } catch (_) { /* non-blocking — CDSS unavailable does not block death recording */ }

    return { death, auditGuidance };
  }

  async listDeaths(
    tenantId: string,
    options: { from?: string; to?: string; reviewStatus?: string } = {},
  ): Promise<MaternalDeath[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(MaternalDeath).createQueryBuilder('md');
    if (options.from) qb.andWhere('md.deathDate >= :from', { from: options.from });
    if (options.to) qb.andWhere('md.deathDate <= :to', { to: options.to });
    if (options.reviewStatus) qb.andWhere('md.reviewStatus = :status', { status: options.reviewStatus });
    return qb.orderBy('md.deathDate', 'DESC').getMany();
  }

  async updateDeathReviewStatus(
    tenantId: string,
    deathId: string,
    reviewStatus: string,
  ): Promise<MaternalDeath> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(MaternalDeath);
    await repo.update(deathId, { reviewStatus });
    return repo.findOneByOrFail({ id: deathId });
  }

  // ── Case Reviews ──────────────────────────────────────────────────────────

  async createReview(
    tenantId: string,
    reviewedBy: string,
    dto: Partial<MaternalDeathReview>,
  ): Promise<MaternalDeathReview> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const entity = db.getRepository(MaternalDeathReview).create({
      ...dto,
      reviewedBy,
      reviewDate: dto.reviewDate ?? new Date().toISOString().slice(0, 10),
    } as Partial<MaternalDeathReview>);
    const saved = await db.getRepository(MaternalDeathReview).save(entity) as unknown as MaternalDeathReview;

    // Mark parent death as under_review
    await db.getRepository(MaternalDeath).update(
      dto.maternalDeathId!,
      { reviewStatus: dto.reviewComplete ? 'completed' : 'under_review' },
    );

    return saved;
  }

  async getReviews(tenantId: string, maternalDeathId: string): Promise<MaternalDeathReview[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    return db.getRepository(MaternalDeathReview).find({
      where: { maternalDeathId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── EmONC Signals ─────────────────────────────────────────────────────────

  async recordEmoncAssessment(
    tenantId: string,
    recordedBy: string,
    dto: Partial<EmoncSignal>,
  ): Promise<{ signal: EmoncSignal; classification: Record<string, any> }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);

    // Run CDSS classification
    let classification: Record<string, any> = {};
    try {
      classification = await this.cdssService.requestWithPolicy<Record<string, any>>(
        'POST', 'emoncClassify', '/cdss/maternal/emonc-classify',
        {
          sf1_parenteral_antibiotics: dto.sf1ParenteralAntibiotics ?? 'unknown',
          sf2_parenteral_oxytocics: dto.sf2ParenteralOxytocics ?? 'unknown',
          sf3_parenteral_anticonvulsants: dto.sf3ParenteralAnticonvulsants ?? 'unknown',
          sf4_manual_removal_placenta: dto.sf4ManualRemovalPlacenta ?? 'unknown',
          sf5_removal_retained_products: dto.sf5RemovalRetainedProducts ?? 'unknown',
          sf6_neonatal_resuscitation: dto.sf6NeonatalResuscitation ?? 'unknown',
          sf7_assisted_vaginal_delivery: dto.sf7AssistedVaginalDelivery ?? 'unknown',
          sf8_caesarean_section: dto.sf8CaesareanSection ?? 'unknown',
          sf9_blood_transfusion: dto.sf9BloodTransfusion ?? 'unknown',
        },
        10000,
        tenantId,
      );
    } catch (_) { /* non-blocking */ }

    const entity = db.getRepository(EmoncSignal).create({
      ...dto,
      recordedBy,
      emoncClassification: classification?.classification ?? null,
    } as Partial<EmoncSignal>);
    const signal = await db.getRepository(EmoncSignal).save(entity) as unknown as EmoncSignal;

    return { signal, classification };
  }

  async getLatestEmoncAssessment(tenantId: string, facilityId?: string): Promise<EmoncSignal | null> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(EmoncSignal).createQueryBuilder('es')
      .orderBy('es.assessmentDate', 'DESC')
      .limit(1);
    if (facilityId) qb.where('es.facilityId = :facilityId', { facilityId });
    return qb.getOne();
  }

  async getEmoncHistory(tenantId: string, facilityId?: string): Promise<EmoncSignal[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const qb = db.getRepository(EmoncSignal).createQueryBuilder('es')
      .orderBy('es.assessmentDate', 'DESC')
      .limit(12);
    if (facilityId) qb.where('es.facilityId = :facilityId', { facilityId });
    return qb.getMany();
  }

  // ── Summary Statistics (for dashboard) ────────────────────────────────────

  async getMortalitySummary(
    tenantId: string,
    year: number,
  ): Promise<{
    totalDeaths: number;
    nearMisses: number;
    byCategory: Record<string, number>;
    byDelay: { delay1: number; delay2: number; delay3: number };
    reviewCompletion: { pending: number; completed: number; total: number };
    mmr: number | null;
  }> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const deaths = await db.getRepository(MaternalDeath).find({
      where: { isNearMiss: false },
    });

    const yearDeaths = deaths.filter(
      d => d.deathDate >= startDate && d.deathDate <= endDate,
    );

    const byCategory: Record<string, number> = {};
    let delay1 = 0, delay2 = 0, delay3 = 0;

    for (const d of yearDeaths) {
      byCategory[d.deathCategory] = (byCategory[d.deathCategory] ?? 0) + 1;
      if (d.delay1Recognition) delay1++;
      if (d.delay2Reaching) delay2++;
      if (d.delay3Care) delay3++;
    }

    const nearMisses = (await db.getRepository(MaternalDeath).count({
      where: { isNearMiss: true },
    }));

    const pending = yearDeaths.filter(d => ['pending', 'under_review'].includes(d.reviewStatus)).length;
    const completed = yearDeaths.filter(d => d.reviewStatus === 'completed').length;

    return {
      totalDeaths: yearDeaths.length,
      nearMisses,
      byCategory,
      byDelay: { delay1, delay2, delay3 },
      reviewCompletion: { pending, completed, total: yearDeaths.length },
      mmr: null, // Requires live births denominator — set to null; facility can input manually
    };
  }
}
```

### 5b. `services/ehr-service/src/controllers/maternal-mortality.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';
import { MaternalMortalityService } from '../services/maternal-mortality.service';

@Controller('maternal-mortality')
@UseGuards(JwtAuthGuard)
export class MaternalMortalityController {
  constructor(private readonly svc: MaternalMortalityService) {}

  // Maternal Deaths
  @Post('deaths')
  reportDeath(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.svc.reportDeath(req.tenantId!, user?.userId ?? user?.id, body);
  }

  @Get('deaths')
  listDeaths(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('reviewStatus') reviewStatus?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.svc.listDeaths(req!.tenantId!, { from, to, reviewStatus });
  }

  @Patch('deaths/:id/review-status')
  updateReviewStatus(
    @Param('id') id: string,
    @Body('reviewStatus') reviewStatus: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.updateDeathReviewStatus(req.tenantId!, id, reviewStatus);
  }

  // Case Reviews
  @Post('deaths/:deathId/reviews')
  createReview(
    @Param('deathId') deathId: string,
    @Body() body: any,
    @Request() req: RequestWithTenant,
  ) {
    const user = req.user as any;
    return this.svc.createReview(req.tenantId!, user?.userId ?? user?.id, { ...body, maternalDeathId: deathId });
  }

  @Get('deaths/:deathId/reviews')
  getReviews(@Param('deathId') deathId: string, @Request() req: RequestWithTenant) {
    return this.svc.getReviews(req.tenantId!, deathId);
  }

  // EmONC
  @Post('emonc')
  recordEmoncAssessment(@Body() body: any, @Request() req: RequestWithTenant) {
    const user = req.user as any;
    return this.svc.recordEmoncAssessment(req.tenantId!, user?.userId ?? user?.id, body);
  }

  @Get('emonc/latest')
  getLatestEmoncAssessment(
    @Query('facilityId') facilityId?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.svc.getLatestEmoncAssessment(req!.tenantId!, facilityId);
  }

  @Get('emonc/history')
  getEmoncHistory(
    @Query('facilityId') facilityId?: string,
    @Request() req?: RequestWithTenant,
  ) {
    return this.svc.getEmoncHistory(req!.tenantId!, facilityId);
  }

  // Summary
  @Get('summary')
  getMortalitySummary(
    @Query('year') year: string,
    @Request() req: RequestWithTenant,
  ) {
    return this.svc.getMortalitySummary(req.tenantId!, parseInt(year) || new Date().getFullYear());
  }
}
```

### Route Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/maternal-mortality/deaths` | Report new maternal death; returns CDSS audit guidance |
| GET | `/maternal-mortality/deaths` | List deaths (filter by date range, review status) |
| PATCH | `/maternal-mortality/deaths/:id/review-status` | Update review status |
| POST | `/maternal-mortality/deaths/:deathId/reviews` | Create case review session |
| GET | `/maternal-mortality/deaths/:deathId/reviews` | Get all reviews for a death |
| POST | `/maternal-mortality/emonc` | Record EmONC assessment; auto-classifies facility |
| GET | `/maternal-mortality/emonc/latest` | Latest EmONC assessment |
| GET | `/maternal-mortality/emonc/history` | Last 12 EmONC assessments |
| GET | `/maternal-mortality/summary?year=2026` | Annual mortality statistics for dashboard |

---

## 6. Module Registration

### `services/ehr-service/src/services/tenant.service.ts` — entities array

```typescript
MaternalDeath,
MaternalDeathReview,
EmoncSignal,
```

Imports:

```typescript
import { MaternalDeath } from '../entities/maternal-death.entity';
import { MaternalDeathReview } from '../entities/maternal-death-review.entity';
import { EmoncSignal } from '../entities/emonc-signal.entity';
```

### `services/ehr-service/src/ehr.module.ts`

Add to `controllers`:
```typescript
MaternalMortalityController,
```

Add to `providers`:
```typescript
MaternalMortalityService,
```

Imports:
```typescript
import { MaternalMortalityController } from './controllers/maternal-mortality.controller';
import { MaternalMortalityService } from './services/maternal-mortality.service';
```

---

## 7. Frontend

### 7a. `ehr-frontend/src/services/api.ts` — add after `oneHealthApi`

```typescript
export const maternalMortalityApi = {
  reportDeath: (data: Record<string, any>) =>
    ehrAxios.post('/maternal-mortality/deaths', data),
  listDeaths: (params?: { from?: string; to?: string; reviewStatus?: string }) =>
    ehrAxios.get('/maternal-mortality/deaths', { params }),
  updateReviewStatus: (deathId: string, reviewStatus: string) =>
    ehrAxios.patch(`/maternal-mortality/deaths/${deathId}/review-status`, { reviewStatus }),
  createReview: (deathId: string, data: Record<string, any>) =>
    ehrAxios.post(`/maternal-mortality/deaths/${deathId}/reviews`, data),
  getReviews: (deathId: string) =>
    ehrAxios.get(`/maternal-mortality/deaths/${deathId}/reviews`),
  recordEmoncAssessment: (data: Record<string, any>) =>
    ehrAxios.post('/maternal-mortality/emonc', data),
  getLatestEmonc: (facilityId?: string) =>
    ehrAxios.get('/maternal-mortality/emonc/latest', { params: { facilityId } }),
  getEmoncHistory: (facilityId?: string) =>
    ehrAxios.get('/maternal-mortality/emonc/history', { params: { facilityId } }),
  getSummary: (year: number) =>
    ehrAxios.get('/maternal-mortality/summary', { params: { year } }),
};
```

### 7b. `ehr-frontend/src/components/MaternalMortalityDashboard.tsx`

3-tab component: `audit` | `emonc` | `summary`

**Props**: none (facility-scoped data)

**Tab: `audit` — Maternal Death Audit**

- "Report New Maternal Death" button → slide-in form with:
  - Patient ID (text input), Death Date (date), Age, Gestational Age (weeks), Mode of Admission (select: referred/self_referred/brought_in_dead)
  - Death Category (select: direct_obstetric, indirect_obstetric, coincidental, undetermined) — show ICD-MM definition tooltip per option
  - Primary Cause (text), ICD-10 Code (text)
  - Three Delays checkboxes: Delay 1 (recognition), Delay 2 (reaching), Delay 3 (care at facility)
  - Delay Notes (textarea)
  - Avoidable (yes/no/unknown select)
  - Is Near Miss (checkbox)
  - On submit: call `maternalMortalityApi.reportDeath()` → show returned CDSS `auditGuidance` in a highlighted panel (Three Delays analysis, recommended audit questions)
- Death registry table: date, category, primary cause, delays count (badge), review status badge (pending=amber/under_review=blue/completed=green)
- Per row: "Start Review" button → review form modal:
  - Timeline summary (textarea), Standard of care (select: substandard/standard_met/unavoidable)
  - Recommendations (add/remove pairs: action + responsible party + due date)
  - Review Complete checkbox
  - On submit: `maternalMortalityApi.createReview()`
- Review status filter tabs: All / Pending / Under Review / Completed

**Tab: `emonc` — EmONC Assessment**

- "Record Assessment" button → assessment form:
  - Assessment date (date), Assessment period (select: 3 months / 6 months / 12 months)
  - 9 signal function rows, each with a 4-option select: Performed / Not performed (can but didn't) / Not available (capability gap) / Unknown
    - SF1: Parenteral antibiotics (sepsis treatment)
    - SF2: Parenteral uterotonics (oxytocin for PPH)
    - SF3: Parenteral anticonvulsants (MgSO4 for eclampsia)
    - SF4: Manual removal of retained placenta
    - SF5: Removal of retained products (MVA/D&C)
    - SF6: Neonatal resuscitation (bag + mask)
    - SF7: Assisted vaginal delivery (vacuum/forceps)
    - SF8: Caesarean section *(Comprehensive)*
    - SF9: Blood transfusion *(Comprehensive)*
  - Barriers text boxes (appear when a signal function is "not_available")
  - On submit: `maternalMortalityApi.recordEmoncAssessment()` → immediately show CDSS classification result
- Classification result card:
  - Big badge: CEmONC (green) / BEmONC (teal) / partial_BEmONC (amber) / not_EmONC (red)
  - Progress: X/7 basic + Y/2 comprehensive performed
  - Gap list with action items
- History table: date, classification badge, basic score, comprehensive score

**Tab: `summary` — Annual Statistics**

- Year selector (default: current year)
- On load: `maternalMortalityApi.getSummary(year)`
- Stat cards: Total Deaths | Near Misses | Avoidable (estimated) | Reviews Completed %
- Deaths by category — horizontal bar chart (use `recharts` `BarChart`)
- Three Delays breakdown — bar chart (Delay 1 / 2 / 3 as %)
- MMR note: "To calculate MMR, enter live births for this period:" + input field + `=  X per 100,000 live births` computed client-side

### 7c. Add tab to `MaternityDoctorDashboard.tsx`

Find `MaternityDoctorDashboard.tsx` with: `grep -r "MaternityDoctor" ehr-frontend/src -l`

Add import:

```tsx
import MaternalMortalityDashboard from '../components/MaternalMortalityDashboard';
```

Add tab to the sidebar/tab list:

```tsx
{ label: 'Mortality Audit', tab: 'mortality', icon: AlertTriangle },
```

Add render block:

```tsx
{activeTab === 'mortality' && <MaternalMortalityDashboard />}
```

`AlertTriangle` is in `lucide-react`.

---

## 8. Post-Implementation Steps

> **Why these steps are mandatory**: The `sprint147_maternal_mortality_emonc` bundle only runs on new tenants
> automatically. Every *existing* tenant DB must have the bundle applied manually via step 2 below.
> Skipping step 2 means live clinics will get 404 / missing-table errors on the new endpoints.

```bash
# 1. Rebuild tenant-service so the new statements file is compiled in
docker compose build tenant-service

# 2. Apply provisioning bundle to ALL existing tenant databases (mandatory)
./scripts/provision-repair-all.sh
# If the script is unavailable, use the API endpoint instead:
curl -X POST http://localhost:3001/admin/tenants/repair-all \
  -H "Authorization: Bearer <admin-token>"

# 3. Verify tables exist in the tenant DB (replace DB name as needed)
psql $DATABASE_URL -c "\d maternal_deaths"
psql $DATABASE_URL -c "\d maternal_death_reviews"
psql $DATABASE_URL -c "\d emonc_signals"
# All three must return column listings — if any says "Did not find any relation" the bundle did not apply.

# 4. TypeScript check
npx tsc --noEmit

# 5. Test CDSS EmONC classification
curl -X POST http://localhost:8000/cdss/maternal/emonc-classify \
  -H "Content-Type: application/json" \
  -d '{"sf1_parenteral_antibiotics":"performed","sf2_parenteral_oxytocics":"performed","sf3_parenteral_anticonvulsants":"performed","sf4_manual_removal_placenta":"performed","sf5_removal_retained_products":"performed","sf6_neonatal_resuscitation":"performed","sf7_assisted_vaginal_delivery":"performed","sf8_caesarean_section":"not_available","sf9_blood_transfusion":"performed"}'
# Expected: classification: "BEmONC"
```

---

## 9. Done When

- [ ] `maternal_deaths`, `maternal_death_reviews`, `emonc_signals` tables exist in all tenant DBs
- [ ] `POST /maternal-mortality/deaths` saves record and returns live CDSS Three Delays analysis
- [ ] `POST /maternal-mortality/emonc` saves assessment and returns EmONC classification (CEmONC/BEmONC/partial/not_EmONC)
- [ ] `GET /maternal-mortality/summary?year=2026` returns real statistics from DB
- [ ] `MaternityDoctorDashboard` shows "Mortality Audit" tab
- [ ] Audit tab: death can be reported → review form opens → review saved → status updates to completed
- [ ] EmONC tab: assessment form → classification result displayed immediately (no hardcoded values)
- [ ] Summary tab: bar charts render with real data (recharts)
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npm run lint` passes for all touched files
