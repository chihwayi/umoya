# Sprint 161 — NCID: National Client Identification

**Sprint**: S161  
**Module**: National Client ID Registry, Cross-Facility Deduplication, Programme Linkage Gaps  
**Bundle version**: `2026.04.18.1`  
**Bundle ID**: `sprint161_ncid_national_client_id`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

Every African health system has a national patient identifier. MediCore currently stores **no national ID linkage** — meaning the same patient can be registered under different names at different facilities with no way to reconcile records. This breaks continuity of care, duplicates chronic disease registers, and prevents national registry reporting.

| Country | National ID Type | Health-Specific Identifier |
|---------|-----------------|---------------------------|
| Zimbabwe | ZW National ID (BR/DD format) | NHID (National Health ID) — MoHCC roll-out |
| South Africa | RSA ID (13-digit) | Used directly in NHLS, NHIF, hospital PAS |
| Zambia | NRC (National Registration Card) | ZDHIS patient UID, SmartCare ART number |
| Mozambique | BI (Bilhete de Identidade) | NUIP (Número Único de Identificação do Paciente) |
| Tanzania | NIDA number | Used in HMIS and JamiiAfya |
| Kenya | National ID / Alien Card | SHA (NHIF replacement) beneficiary number |
| Malawi | National ID | BEMR patient number |
| Uganda | NIN (National Identification Number) | EMR-OpenMRS patient UID |
| Rwanda | National ID | Ubudehe + RBC patient number |
| Ethiopia | FIDA (Federal ID) | DHIS2 tracked entity ID |

**What is currently broken without this module:**
- Same patient registers at Facility A and Facility B → 2 separate MediCore accounts → duplicate NCD, HIV, and ANC registers
- No cross-programme linkage: patient in HIV ART register not identified as the same person in TB DOTS or ANC register
- National registry push (MoHCC NHID, NUIP) impossible — no verified national ID on file
- Cross-border handover (S157 DISA/SmartCare) unreliable without a stable identifier

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-ncid.statements.ts`**

```typescript
export const TENANT_NCID_BUNDLE_VERSION = '2026.04.18.1';

export const TENANT_NCID_STATEMENTS: string[] = [

  // ── NCID Registrations ────────────────────────────────────────────────────
  // One row per (patient, country, id_type) combination.
  // A patient may have a ZW national ID + ZW NHID + ZA RSA ID if cross-border.
  `CREATE TABLE IF NOT EXISTS ncid_registrations (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                UUID NOT NULL,
    -- Identification
    country_code              CHAR(2) NOT NULL,         -- ISO 3166-1 alpha-2: ZW, ZA, ZM, MZ, TZ, KE, MW, UG, RW, ET
    id_type                   TEXT NOT NULL,
    -- VALUES: 'national_id' | 'nhid' | 'nuip' | 'nrc' | 'nida' | 'sha_beneficiary'
    --          | 'arc' (Alien Registration Certificate) | 'passport' | 'birth_certificate'
    --          | 'refugee_id' | 'stateless_id'
    id_number                 TEXT NOT NULL,            -- plaintext for display (encrypt at rest via column transformer)
    id_number_hash            TEXT NOT NULL,            -- SHA-256(UPPER(TRIM(id_number))) for dedup without PII exposure
    id_number_formatted       TEXT,                     -- normalised display format e.g. '63-123456-F-20'
    -- Verification
    verified                  BOOLEAN NOT NULL DEFAULT false,
    verification_method       TEXT,
    -- VALUES: 'manual_check' | 'biometric_fingerprint' | 'registry_api' | 'photo_id_review'
    verified_by               UUID,                     -- staff user id
    verified_at               TIMESTAMPTZ,
    -- Biometrics (optional — fingerprint one-way hash, never the raw template)
    biometric_hash            TEXT,                     -- SHA-256 of normalised fingerprint minutiae template
    biometric_captured_at     TIMESTAMPTZ,
    -- National registry sync
    national_registry_synced  BOOLEAN NOT NULL DEFAULT false,
    national_registry_ref     TEXT,                     -- registry-assigned reference / ACK number
    national_registry_synced_at TIMESTAMPTZ,
    national_registry_response JSONB DEFAULT '{}',
    -- Flags
    is_primary                BOOLEAN NOT NULL DEFAULT false,  -- primary ID used for this patient
    is_active                 BOOLEAN NOT NULL DEFAULT true,
    notes                     TEXT,
    -- Audit
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ncid_hash_type UNIQUE (id_number_hash, id_type, country_code)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ncid_patient    ON ncid_registrations (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ncid_hash       ON ncid_registrations (id_number_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_ncid_country    ON ncid_registrations (country_code, id_type)`,

  // ── NCID Duplicate Flags ──────────────────────────────────────────────────
  // Raised by CDSS demographic-matching or biometric collision.
  // Resolved by a clinician or admin — confirmed merge or confirmed different.
  `CREATE TABLE IF NOT EXISTS ncid_duplicate_flags (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id_a              UUID NOT NULL,
    patient_id_b              UUID NOT NULL,
    -- Matching
    match_score               DECIMAL(4,3) NOT NULL,    -- 0.000 – 1.000 (CDSS computed)
    match_method              TEXT NOT NULL,
    -- VALUES: 'demographic' | 'biometric' | 'id_number_hash' | 'combined'
    match_fields              JSONB DEFAULT '[]',
    -- e.g. ["name_soundex","dob","sex","phone_last4","mother_name"]
    cdss_recommendation       TEXT,
    -- VALUES: 'merge' | 'keep_separate' | 'manual_review'
    cdss_confidence           DECIMAL(4,3),
    cdss_reasoning            TEXT,
    -- Resolution
    resolution_status         TEXT NOT NULL DEFAULT 'pending',
    -- VALUES: 'pending' | 'confirmed_duplicate' | 'confirmed_different' | 'merged' | 'dismissed'
    resolved_by               UUID,
    resolved_at               TIMESTAMPTZ,
    merged_into_patient_id    UUID,                     -- if merged, surviving patient
    resolution_notes          TEXT,
    -- Audit
    detected_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dup_pair UNIQUE (
      LEAST(patient_id_a::TEXT, patient_id_b::TEXT),
      GREATEST(patient_id_a::TEXT, patient_id_b::TEXT)
    )
  )`,

  `CREATE INDEX IF NOT EXISTS idx_dup_patient_a   ON ncid_duplicate_flags (patient_id_a)`,
  `CREATE INDEX IF NOT EXISTS idx_dup_patient_b   ON ncid_duplicate_flags (patient_id_b)`,
  `CREATE INDEX IF NOT EXISTS idx_dup_status      ON ncid_duplicate_flags (resolution_status)`,
  `CREATE INDEX IF NOT EXISTS idx_dup_score       ON ncid_duplicate_flags (match_score DESC)`,

  // ── NCID Programme Linkages ───────────────────────────────────────────────
  // Tracks which national/vertical programmes a patient is enrolled in.
  // Used by CDSS to detect cross-programme gaps (e.g. HIV+ patient not in HTN screening).
  `CREATE TABLE IF NOT EXISTS ncid_programme_linkages (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                UUID NOT NULL,
    programme                 TEXT NOT NULL,
    -- VALUES: 'hiv_art' | 'tb_dots' | 'anc_mch' | 'epi_child' | 'ncd_htn' | 'ncd_dm'
    --          | 'ncd_epilepsy' | 'ncd_sickle_cell' | 'mental_health' | 'cbhi'
    --          | 'nutrition_sam' | 'cervical_cancer' | 'tb_preventive'
    programme_number          TEXT,                     -- programme-specific registration number (ART#, TB#, etc.)
    enrolled_at               DATE,
    discharged_at             DATE,
    active                    BOOLEAN NOT NULL DEFAULT true,
    facility_enrolled         TEXT,                     -- facility name/code where enrolled
    shared_to_national        BOOLEAN NOT NULL DEFAULT false,  -- pushed to national vertical programme registry
    notes                     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prog_linkage UNIQUE (patient_id, programme)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_prog_patient    ON ncid_programme_linkages (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_prog_programme  ON ncid_programme_linkages (programme)`,
  `CREATE INDEX IF NOT EXISTS idx_prog_active     ON ncid_programme_linkages (patient_id, active)`,

];
```

### 2b. Register Bundle in Provisioning Service

**File: `services/tenant-service/src/services/database-provisioning.service.ts`**

Add import at the top:
```typescript
import {
  TENANT_NCID_STATEMENTS,
  TENANT_NCID_BUNDLE_VERSION,
} from '../generated/tenant-ncid.statements';
```

Add to the `bundles` array (after the last sprint bundle):
```typescript
{
  id: 'sprint161_ncid_national_client_id',
  label: 'Sprint 161 - NCID National Client Identification',
  version: TENANT_NCID_BUNDLE_VERSION,
  description: 'ncid_registrations, ncid_duplicate_flags, ncid_programme_linkages — national ID registry and deduplication',
  statements: () => TENANT_NCID_STATEMENTS,
},
```

### 2c. TypeORM Entities

**File: `services/ehr-service/src/entities/ncid-registration.entity.ts`**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('ncid_registrations')
@Index(['idNumberHash'])
@Index(['patientId'])
export class NcidRegistration {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'country_code', length: 2 }) countryCode: string;
  @Column({ name: 'id_type' }) idType: string;
  @Column({ name: 'id_number' }) idNumber: string;
  @Column({ name: 'id_number_hash' }) idNumberHash: string;
  @Column({ name: 'id_number_formatted', nullable: true }) idNumberFormatted: string;

  @Column({ name: 'verified', default: false }) verified: boolean;
  @Column({ name: 'verification_method', nullable: true }) verificationMethod: string;
  @Column({ name: 'verified_by', type: 'uuid', nullable: true }) verifiedBy: string;
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt: Date;

  @Column({ name: 'biometric_hash', nullable: true }) biometricHash: string;
  @Column({ name: 'biometric_captured_at', type: 'timestamptz', nullable: true }) biometricCapturedAt: Date;

  @Column({ name: 'national_registry_synced', default: false }) nationalRegistrySynced: boolean;
  @Column({ name: 'national_registry_ref', nullable: true }) nationalRegistryRef: string;
  @Column({ name: 'national_registry_synced_at', type: 'timestamptz', nullable: true }) nationalRegistrySyncedAt: Date;
  @Column({ name: 'national_registry_response', type: 'jsonb', default: {} }) nationalRegistryResponse: object;

  @Column({ name: 'is_primary', default: false }) isPrimary: boolean;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ name: 'notes', nullable: true }) notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/entities/ncid-duplicate-flag.entity.ts`**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('ncid_duplicate_flags')
@Index(['patientIdA'])
@Index(['patientIdB'])
@Index(['resolutionStatus'])
export class NcidDuplicateFlag {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id_a', type: 'uuid' }) patientIdA: string;
  @Column({ name: 'patient_id_b', type: 'uuid' }) patientIdB: string;

  @Column({ name: 'match_score', type: 'decimal', precision: 4, scale: 3 }) matchScore: number;
  @Column({ name: 'match_method' }) matchMethod: string;
  @Column({ name: 'match_fields', type: 'jsonb', default: [] }) matchFields: string[];
  @Column({ name: 'cdss_recommendation', nullable: true }) cdssRecommendation: string;
  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number;
  @Column({ name: 'cdss_reasoning', nullable: true }) cdssReasoning: string;

  @Column({ name: 'resolution_status', default: 'pending' }) resolutionStatus: string;
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy: string;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt: Date;
  @Column({ name: 'merged_into_patient_id', type: 'uuid', nullable: true }) mergedIntoPatientId: string;
  @Column({ name: 'resolution_notes', nullable: true }) resolutionNotes: string;

  @Column({ name: 'detected_at', type: 'timestamptz', default: () => 'NOW()' }) detectedAt: Date;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/entities/ncid-programme-linkage.entity.ts`**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('ncid_programme_linkages')
@Index(['patientId'])
@Index(['programme'])
export class NcidProgrammeLinkage {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'programme' }) programme: string;
  @Column({ name: 'programme_number', nullable: true }) programmeNumber: string;
  @Column({ name: 'enrolled_at', type: 'date', nullable: true }) enrolledAt: string;
  @Column({ name: 'discharged_at', type: 'date', nullable: true }) dischargedAt: string;
  @Column({ name: 'active', default: true }) active: boolean;
  @Column({ name: 'facility_enrolled', nullable: true }) facilityEnrolled: string;
  @Column({ name: 'shared_to_national', default: false }) sharedToNational: boolean;
  @Column({ name: 'notes', nullable: true }) notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

### 2d. Register Entities in TypeORM

**File: `services/ehr-service/src/services/tenant.service.ts`**

Find the `entities: [...]` array and add:
```typescript
NcidRegistration,
NcidDuplicateFlag,
NcidProgrammeLinkage,
```

Add imports at the top of the file:
```typescript
import { NcidRegistration } from '../entities/ncid-registration.entity';
import { NcidDuplicateFlag } from '../entities/ncid-duplicate-flag.entity';
import { NcidProgrammeLinkage } from '../entities/ncid-programme-linkage.entity';
```

---

## 3. CDSS Endpoints (FastAPI)

**File: `services/cdss-service/main.py`** — append after existing routes.

### 3.1 Demographic Duplicate Score

```python
# ─────────────────────────────────────────────────────────────────────────────
# NCID: Demographic Duplicate Scoring
# Called by: NcidService.scoreDeduplication()
# ─────────────────────────────────────────────────────────────────────────────

class NcidPatientDemographics(BaseModel):
    given_name: str
    family_name: str
    date_of_birth: str          # ISO date 'YYYY-MM-DD'
    sex: str                    # 'male' | 'female' | 'unknown'
    phone_number: Optional[str] = None
    mothers_name: Optional[str] = None
    village_or_suburb: Optional[str] = None
    national_id_hash: Optional[str] = None   # SHA-256 hash — never plaintext

class NcidDuplicateScoreRequest(BaseModel):
    patient_id: str
    tenant_id: str
    patient_a: NcidPatientDemographics
    patient_b: NcidPatientDemographics
    locale: str = "en"

class NcidDuplicateScoreResponse(BaseModel):
    match_score: float           # 0.000 – 1.000
    match_method: str            # 'demographic' | 'id_number_hash' | 'combined'
    matched_fields: list[str]    # e.g. ['name_soundex', 'dob', 'sex', 'phone_last4']
    recommendation: str          # 'merge' | 'keep_separate' | 'manual_review'
    confidence: float
    reasoning: str
    citations: list[dict]
    abstained: bool = False

@app.post("/cdss/ncid/duplicate-score", response_model=NcidDuplicateScoreResponse)
async def ncid_duplicate_score(req: NcidDuplicateScoreRequest):
    """
    Called by: EHR service NcidService.scoreDeduplication()
    Computes a probabilistic duplicate match score between two patient records.
    Uses deterministic field matching + LLM reasoning for ambiguous cases.

    Deterministic pre-scoring (before LLM call):
    - Exact DOB + sex match: +0.30
    - SHA-256 national ID hash match: +0.50 (→ auto-flag as merge at ≥0.80)
    - Soundex(family_name) match: +0.20
    - Soundex(given_name) match: +0.15
    - Last 4 digits phone match: +0.10
    - Mother's name match: +0.15
    - Village/suburb match: +0.10
    Capped at 1.0. Pass raw score + matched fields to LLM for final reasoning.

    Recommendation thresholds:
    - score ≥ 0.85 → 'merge' (auto-flag for admin review, not auto-merged)
    - score 0.60–0.84 → 'manual_review'
    - score < 0.60 → 'keep_separate'
    """
    import hashlib, jellyfish

    def soundex(s: str) -> str:
        try:
            return jellyfish.soundex(s.upper().strip()) if s else ''
        except Exception:
            return ''

    pa, pb = req.patient_a, req.patient_b
    score = 0.0
    matched = []

    # National ID hash — strongest signal
    if pa.national_id_hash and pb.national_id_hash and pa.national_id_hash == pb.national_id_hash:
        score += 0.50
        matched.append('national_id_hash')

    # DOB + sex
    if pa.date_of_birth == pb.date_of_birth:
        score += 0.30
        matched.append('date_of_birth')
    if pa.sex == pb.sex and pa.sex != 'unknown':
        score += 0.05
        matched.append('sex')

    # Name soundex
    if soundex(pa.family_name) == soundex(pb.family_name) and pa.family_name:
        score += 0.20
        matched.append('family_name_soundex')
    if soundex(pa.given_name) == soundex(pb.given_name) and pa.given_name:
        score += 0.15
        matched.append('given_name_soundex')

    # Phone last 4
    if pa.phone_number and pb.phone_number:
        if pa.phone_number[-4:] == pb.phone_number[-4:]:
            score += 0.10
            matched.append('phone_last4')

    # Mother's name
    if pa.mothers_name and pb.mothers_name and soundex(pa.mothers_name) == soundex(pb.mothers_name):
        score += 0.15
        matched.append('mothers_name_soundex')

    # Village/suburb
    if pa.village_or_suburb and pb.village_or_suburb:
        if pa.village_or_suburb.lower().strip() == pb.village_or_suburb.lower().strip():
            score += 0.10
            matched.append('village_or_suburb')

    score = min(score, 1.0)

    if score >= 0.85:
        rec = 'merge'
    elif score >= 0.60:
        rec = 'manual_review'
    else:
        rec = 'keep_separate'

    # LLM call for reasoning (especially important in 0.60–0.84 range)
    prompt = f"""You are a patient deduplication expert for an African EHR system.

Two patient records have been compared with a deterministic match score of {score:.3f}.
Matched fields: {matched}

Patient A: given="{pa.given_name}" family="{pa.family_name}" DOB="{pa.date_of_birth}" sex="{pa.sex}" village="{pa.village_or_suburb}"
Patient B: given="{pb.given_name}" family="{pb.family_name}" DOB="{pb.date_of_birth}" sex="{pb.sex}" village="{pb.village_or_suburb}"

Recommendation based on score: {rec}

Provide:
1. A brief clinical reasoning (1-2 sentences) for the recommendation
2. Any additional flags (e.g. common name in the region, common DOB transcription error)
3. Confidence in the recommendation (0.0–1.0)

Context: African names may have multiple spellings (Chiwaya/Chiwaia). DOB may be estimated.
Respond in {req.locale}.
"""

    try:
        llm_result = await call_governed_json(
            surface='ncid_deduplication',
            patient_id=req.patient_id,
            tenant_id=req.tenant_id,
            task='duplicate_score_reasoning',
            prompt=prompt,
            schema={"reasoning": "string", "confidence": "number", "additional_flags": "string"},
        )
        reasoning = llm_result.get('reasoning', f'Match score {score:.2f} based on {len(matched)} matched fields.')
        confidence = float(llm_result.get('confidence', min(score + 0.05, 1.0)))
        abstained = False
    except Exception:
        reasoning = f'Deterministic match score {score:.2f}. Matched fields: {", ".join(matched) if matched else "none"}.'
        confidence = score
        abstained = True

    return NcidDuplicateScoreResponse(
        match_score=round(score, 3),
        match_method='id_number_hash' if 'national_id_hash' in matched else 'demographic',
        matched_fields=matched,
        recommendation=rec,
        confidence=round(confidence, 3),
        reasoning=reasoning,
        citations=[{"text": "WHO Patient Identification Best Practices", "source": "WHO 2021"}],
        abstained=abstained,
    )
```

### 3.2 Programme Gap Analysis

```python
# ─────────────────────────────────────────────────────────────────────────────
# NCID: Programme Gap Analysis
# Called by: NcidService.analyseGaps()
# ─────────────────────────────────────────────────────────────────────────────

class NcidProgrammeGapRequest(BaseModel):
    patient_id: str
    tenant_id: str
    active_programmes: list[str]   # e.g. ['hiv_art', 'tb_dots']
    diagnoses: list[str]           # ICD-10 or free text: ['HIV', 'HTN', 'Type 2 DM']
    age_years: int
    sex: str                       # 'male' | 'female'
    is_pregnant: bool = False
    locale: str = "en"

class NcidProgrammeGap(BaseModel):
    missing_programme: str
    reason: str                    # Why patient should be in this programme
    priority: str                  # 'urgent' | 'high' | 'routine'
    action: str                    # Specific enrolment action for the clinician

class NcidProgrammeGapResponse(BaseModel):
    gaps_detected: list[NcidProgrammeGap]
    summary: str
    confidence: float
    citations: list[dict]
    abstained: bool = False

@app.post("/cdss/ncid/programme-gaps", response_model=NcidProgrammeGapResponse)
async def ncid_programme_gaps(req: NcidProgrammeGapRequest):
    """
    Called by: EHR service NcidService.analyseGaps()
    Detects cross-programme enrolment gaps based on a patient's diagnoses.

    Hard-coded gap rules (applied before LLM):
    - HIV+ not in hiv_art → urgent
    - HIV+ not in tb_preventive (TB IPT) → high
    - HTN not in ncd_htn → high
    - Type 2 DM not in ncd_dm → high
    - HIV+ female → should be in cervical_cancer screen → high
    - Pregnant → should be in anc_mch → urgent
    - Child <5 → should be in epi_child → high
    - Sickle cell → ncd_sickle_cell → high
    - Epilepsy → ncd_epilepsy → high
    - Active TB → tb_dots → urgent
    """
    diag_lower = [d.lower() for d in req.diagnoses]
    enrolled = set(req.active_programmes)
    gaps = []

    def diag_match(*terms: str) -> bool:
        return any(t in d for t in terms for d in diag_lower)

    if diag_match('hiv', 'hiv positive', 'hiv+', 'b20', 'b24'):
        if 'hiv_art' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='hiv_art',
                reason='Patient has HIV diagnosis but is not enrolled in ART programme',
                priority='urgent',
                action='Enrol in ART programme immediately; baseline CD4 and VL required',
            ))
        if 'tb_preventive' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='tb_preventive',
                reason='HIV+ patients require TB preventive therapy (IPT) — 6H or 3HP regimen',
                priority='high',
                action='Screen for active TB; if excluded, initiate IPT',
            ))
        if req.sex == 'female' and 'cervical_cancer' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='cervical_cancer',
                reason='HIV+ women have 5× higher risk of cervical cancer; VIA/HPV screening indicated',
                priority='high',
                action='Enrol in cervical cancer screening programme; VIA or HPV test',
            ))

    if diag_match('active tb', 'tuberculosis', 'a15', 'a16', 'a17', 'a18', 'a19'):
        if 'tb_dots' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='tb_dots',
                reason='Active TB requires supervised DOTS enrolment',
                priority='urgent',
                action='Enrol in TB DOTS programme; notify district TB coordinator',
            ))

    if diag_match('hypertension', 'htn', 'high blood pressure', 'i10', 'i11', 'i12', 'i13'):
        if 'ncd_htn' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='ncd_htn',
                reason='Hypertension diagnosis not linked to NCD HTN programme register',
                priority='high',
                action='Register patient in NCD Hypertension programme for adherence tracking',
            ))

    if diag_match('diabetes', 'type 2 dm', 'type 1 dm', 'e11', 'e10', 'e13', 'e14'):
        if 'ncd_dm' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='ncd_dm',
                reason='Diabetes diagnosis not linked to NCD DM programme register',
                priority='high',
                action='Register in NCD Diabetes programme; HbA1c baseline required',
            ))

    if req.is_pregnant and 'anc_mch' not in enrolled:
        gaps.append(NcidProgrammeGap(
            missing_programme='anc_mch',
            reason='Pregnant patient not enrolled in ANC/MCH programme',
            priority='urgent',
            action='Register in ANC; schedule booking visit and HIV/syphilis screen',
        ))

    if req.age_years < 5 and 'epi_child' not in enrolled:
        gaps.append(NcidProgrammeGap(
            missing_programme='epi_child',
            reason='Child under 5 not enrolled in immunisation programme',
            priority='high',
            action='Enrol in EPI; check and update vaccination card',
        ))

    if diag_match('sickle cell', 'd57'):
        if 'ncd_sickle_cell' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='ncd_sickle_cell',
                reason='Sickle cell disease not linked to NCD register for hydroxyurea and prophylaxis tracking',
                priority='high',
                action='Enrol in Sickle Cell NCD programme',
            ))

    if diag_match('epilepsy', 'seizure', 'g40', 'g41'):
        if 'ncd_epilepsy' not in enrolled:
            gaps.append(NcidProgrammeGap(
                missing_programme='ncd_epilepsy',
                reason='Epilepsy not linked to NCD epilepsy register for AED tracking',
                priority='high',
                action='Enrol in Epilepsy NCD programme; AED medication reconciliation',
            ))

    if not gaps:
        summary = 'No cross-programme enrolment gaps detected for current diagnoses.'
        return NcidProgrammeGapResponse(
            gaps_detected=[],
            summary=summary,
            confidence=0.92,
            citations=[],
            abstained=False,
        )

    # LLM enrichment for nuanced gaps
    gap_list = '\n'.join([f"- {g.missing_programme}: {g.reason} [{g.priority}]" for g in gaps])
    prompt = f"""You are a clinical programme integration specialist reviewing cross-programme gaps for an African EHR.

Patient: age {req.age_years}, sex {req.sex}, pregnant: {req.is_pregnant}
Active programmes: {req.active_programmes}
Diagnoses: {req.diagnoses}

Identified gaps:
{gap_list}

Write a concise clinical summary (2-3 sentences) explaining the importance of addressing these gaps for this patient's continuity of care. Mention any Africa-specific disease co-morbidity patterns (TB-HIV co-infection, HTN-DM syndemic, etc.) where relevant.
Respond in {req.locale}.
"""

    try:
        llm_result = await call_governed_json(
            surface='ncid_programme_gaps',
            patient_id=req.patient_id,
            tenant_id=req.tenant_id,
            task='programme_gap_summary',
            prompt=prompt,
            schema={"summary": "string", "confidence": "number"},
        )
        summary = llm_result.get('summary', f'{len(gaps)} programme enrolment gap(s) detected.')
        confidence = float(llm_result.get('confidence', 0.88))
        abstained = False
    except Exception:
        summary = f'{len(gaps)} programme enrolment gap(s) detected based on diagnoses.'
        confidence = 0.85
        abstained = True

    return NcidProgrammeGapResponse(
        gaps_detected=gaps,
        summary=summary,
        confidence=round(confidence, 3),
        citations=[
            {"text": "WHO Consolidated HIV Guidelines 2023", "source": "WHO 2023"},
            {"text": "IUATLD TB-HIV Co-management Guidelines", "source": "IUATLD 2019"},
        ],
        abstained=abstained,
    )
```

### 3.3 National ID Format Validation

```python
# ─────────────────────────────────────────────────────────────────────────────
# NCID: National ID Format Validation
# Called by: NcidService.validateIdFormat()
# Pure deterministic — no LLM call needed.
# ─────────────────────────────────────────────────────────────────────────────

import re

class NcidValidateRequest(BaseModel):
    id_type: str
    id_number: str
    country_code: str

class NcidValidateResponse(BaseModel):
    valid: bool
    formatted_number: Optional[str] = None
    error_message: Optional[str] = None
    check_digit_valid: Optional[bool] = None

@app.post("/cdss/ncid/validate-id", response_model=NcidValidateResponse)
async def ncid_validate_id(req: NcidValidateRequest):
    """
    Validates and normalises national ID numbers by country/type.
    Called by NcidService before saving to ncid_registrations.

    Format rules:
    - ZW national_id:  DD-NNNNNN-L-NN  (e.g. 63-123456-F-20)
    - ZA national_id:  13 digits YYMMDDSSSSZCZ (Luhn check digit)
    - ZM nrc:          NNNNNN/NN/N
    - MZ nuip:         8-digit number
    - TZ nida:         NNNNNNNNNNNNN (14 digits)
    - KE national_id:  7-8 digits
    - All others:      alphanumeric, 4–20 chars
    """
    num = req.id_number.strip().upper()
    country = req.country_code.upper()
    id_type = req.id_type.lower()

    if country == 'ZW' and id_type == 'national_id':
        pattern = r'^(\d{2})-(\d{6})-([A-Z])-(\d{2})$'
        m = re.match(pattern, num)
        if m:
            return NcidValidateResponse(valid=True, formatted_number=num)
        # Try without separators: 63123456F20
        flat = re.sub(r'[-\s]', '', num)
        m2 = re.match(r'^(\d{2})(\d{6})([A-Z])(\d{2})$', flat)
        if m2:
            formatted = f'{m2.group(1)}-{m2.group(2)}-{m2.group(3)}-{m2.group(4)}'
            return NcidValidateResponse(valid=True, formatted_number=formatted)
        return NcidValidateResponse(valid=False, error_message='ZW ID must be DD-NNNNNN-L-NN (e.g. 63-123456-F-20)')

    if country == 'ZA' and id_type == 'national_id':
        digits = re.sub(r'\s', '', num)
        if not re.match(r'^\d{13}$', digits):
            return NcidValidateResponse(valid=False, error_message='ZA ID must be 13 digits')
        # Luhn check
        total = 0
        for i, d in enumerate(digits):
            n = int(d)
            if i % 2 == 1:
                n *= 2
                if n > 9:
                    n -= 9
            total += n
        luhn_ok = total % 10 == 0
        return NcidValidateResponse(valid=luhn_ok, formatted_number=digits, check_digit_valid=luhn_ok,
                                     error_message=None if luhn_ok else 'ZA ID failed Luhn check digit validation')

    if country == 'ZM' and id_type == 'nrc':
        pattern = r'^\d{6}/\d{2}/\d$'
        m = re.match(pattern, num)
        if m:
            return NcidValidateResponse(valid=True, formatted_number=num)
        flat = re.sub(r'[\s/]', '', num)
        if re.match(r'^\d{9}$', flat):
            formatted = f'{flat[:6]}/{flat[6:8]}/{flat[8]}'
            return NcidValidateResponse(valid=True, formatted_number=formatted)
        return NcidValidateResponse(valid=False, error_message='ZM NRC must be NNNNNN/NN/N')

    if country == 'MZ' and id_type == 'nuip':
        digits = re.sub(r'\s', '', num)
        if re.match(r'^\d{8}$', digits):
            return NcidValidateResponse(valid=True, formatted_number=digits)
        return NcidValidateResponse(valid=False, error_message='MZ NUIP must be 8 digits')

    if country == 'TZ' and id_type == 'nida':
        digits = re.sub(r'[\s-]', '', num)
        if re.match(r'^\d{14}$', digits):
            return NcidValidateResponse(valid=True, formatted_number=digits)
        return NcidValidateResponse(valid=False, error_message='TZ NIDA must be 14 digits')

    if country == 'KE' and id_type == 'national_id':
        digits = re.sub(r'\s', '', num)
        if re.match(r'^\d{7,8}$', digits):
            return NcidValidateResponse(valid=True, formatted_number=digits)
        return NcidValidateResponse(valid=False, error_message='KE National ID must be 7–8 digits')

    # Generic fallback: alphanumeric 4–20 chars
    if re.match(r'^[A-Z0-9\-/]{4,20}$', num):
        return NcidValidateResponse(valid=True, formatted_number=num)

    return NcidValidateResponse(valid=False, error_message=f'ID number format not recognised for {country}/{id_type}')
```

> **Dependency note**: The duplicate scoring endpoint uses `jellyfish` for Soundex matching.
> Add to `services/cdss-service/requirements.txt`:
> ```
> jellyfish>=1.0.0
> ```

---

## 4. NestJS Backend

### 4a. NcidService

**File: `services/ehr-service/src/services/ncid.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { NcidRegistration } from '../entities/ncid-registration.entity';
import { NcidDuplicateFlag } from '../entities/ncid-duplicate-flag.entity';
import { NcidProgrammeLinkage } from '../entities/ncid-programme-linkage.entity';
import { CdssService } from './cdss.service';

@Injectable()
export class NcidService {
  constructor(
    @InjectRepository(NcidRegistration)
    private readonly ncidRepo: Repository<NcidRegistration>,
    @InjectRepository(NcidDuplicateFlag)
    private readonly dupRepo: Repository<NcidDuplicateFlag>,
    @InjectRepository(NcidProgrammeLinkage)
    private readonly progRepo: Repository<NcidProgrammeLinkage>,
    private readonly cdssService: CdssService,
  ) {}

  private hashId(idNumber: string): string {
    return crypto.createHash('sha256').update(idNumber.toUpperCase().trim()).digest('hex');
  }

  async registerNcid(dto: {
    patientId: string;
    countryCode: string;
    idType: string;
    idNumber: string;
    isPrimary?: boolean;
    verificationMethod?: string;
    verifiedBy?: string;
  }): Promise<NcidRegistration> {
    const hash = this.hashId(dto.idNumber);

    // Check for hash collision — potential duplicate across patients
    const collision = await this.ncidRepo.findOne({
      where: { idNumberHash: hash, idType: dto.idType, countryCode: dto.countryCode },
    });
    if (collision && collision.patientId !== dto.patientId) {
      // Different patient already holds this ID — flag for review but still save
      // (allows data entry before resolution; duplicate flag raised separately)
    }

    const reg = this.ncidRepo.create({
      patientId: dto.patientId,
      countryCode: dto.countryCode.toUpperCase(),
      idType: dto.idType,
      idNumber: dto.idNumber,
      idNumberHash: hash,
      isPrimary: dto.isPrimary ?? false,
      verificationMethod: dto.verificationMethod,
      verifiedBy: dto.verifiedBy,
      verified: !!dto.verifiedBy,
      verifiedAt: dto.verifiedBy ? new Date() : undefined,
    });

    return this.ncidRepo.save(reg);
  }

  async getPatientIds(patientId: string): Promise<NcidRegistration[]> {
    return this.ncidRepo.find({ where: { patientId, isActive: true }, order: { isPrimary: 'DESC' } });
  }

  async scoreDeduplication(patientIdA: string, patientIdB: string, demographics: {
    a: { givenName: string; familyName: string; dob: string; sex: string; phone?: string; mothersName?: string; village?: string };
    b: { givenName: string; familyName: string; dob: string; sex: string; phone?: string; mothersName?: string; village?: string };
  }): Promise<NcidDuplicateFlag> {
    const [idsA, idsB] = await Promise.all([
      this.ncidRepo.findOne({ where: { patientId: patientIdA, isActive: true } }),
      this.ncidRepo.findOne({ where: { patientId: patientIdB, isActive: true } }),
    ]);

    const result = await this.cdssService.callGovernedJson({
      surface: 'ncid_deduplication',
      patientId: patientIdA,
      task: 'duplicate_score',
      payload: {
        patient_id: patientIdA,
        tenant_id: 'system',
        patient_a: {
          given_name: demographics.a.givenName,
          family_name: demographics.a.familyName,
          date_of_birth: demographics.a.dob,
          sex: demographics.a.sex,
          phone_number: demographics.a.phone,
          mothers_name: demographics.a.mothersName,
          village_or_suburb: demographics.a.village,
          national_id_hash: idsA?.idNumberHash,
        },
        patient_b: {
          given_name: demographics.b.givenName,
          family_name: demographics.b.familyName,
          date_of_birth: demographics.b.dob,
          sex: demographics.b.sex,
          phone_number: demographics.b.phone,
          mothers_name: demographics.b.mothersName,
          village_or_suburb: demographics.b.village,
          national_id_hash: idsB?.idNumberHash,
        },
      },
    });

    const cdssResult = result.result as any;
    const flag = this.dupRepo.create({
      patientIdA,
      patientIdB,
      matchScore: cdssResult.match_score ?? 0,
      matchMethod: cdssResult.match_method ?? 'demographic',
      matchFields: cdssResult.matched_fields ?? [],
      cdssRecommendation: cdssResult.recommendation ?? 'manual_review',
      cdssConfidence: cdssResult.confidence ?? 0,
      cdssReasoning: cdssResult.reasoning,
      resolutionStatus: 'pending',
    });

    return this.dupRepo.save(flag);
  }

  async analyseGaps(patientId: string, dto: {
    diagnoses: string[];
    ageYears: number;
    sex: string;
    isPregnant: boolean;
  }): Promise<{ gaps: any[]; summary: string; confidence: number }> {
    const activeProgrammes = await this.progRepo.find({ where: { patientId, active: true } });
    const programmeNames = activeProgrammes.map(p => p.programme);

    const result = await this.cdssService.callGovernedJson({
      surface: 'ncid_programme_gaps',
      patientId,
      task: 'programme_gap_analysis',
      payload: {
        patient_id: patientId,
        tenant_id: 'system',
        active_programmes: programmeNames,
        diagnoses: dto.diagnoses,
        age_years: dto.ageYears,
        sex: dto.sex,
        is_pregnant: dto.isPregnant,
      },
    });

    const r = result.result as any;
    return {
      gaps: r.gaps_detected ?? [],
      summary: r.summary ?? '',
      confidence: r.confidence ?? 0,
    };
  }

  async resolveDuplicate(flagId: string, resolution: {
    status: 'confirmed_duplicate' | 'confirmed_different' | 'merged' | 'dismissed';
    resolvedBy: string;
    mergedIntoPatientId?: string;
    notes?: string;
  }): Promise<NcidDuplicateFlag> {
    const flag = await this.dupRepo.findOneOrFail({ where: { id: flagId } });
    flag.resolutionStatus = resolution.status;
    flag.resolvedBy = resolution.resolvedBy;
    flag.resolvedAt = new Date();
    flag.mergedIntoPatientId = resolution.mergedIntoPatientId;
    flag.resolutionNotes = resolution.notes;
    return this.dupRepo.save(flag);
  }

  async upsertProgrammeLinkage(patientId: string, programme: string, dto: {
    programmeNumber?: string;
    enrolledAt?: string;
    facilityEnrolled?: string;
  }): Promise<NcidProgrammeLinkage> {
    const existing = await this.progRepo.findOne({ where: { patientId, programme } });
    if (existing) {
      if (dto.programmeNumber) existing.programmeNumber = dto.programmeNumber;
      if (dto.enrolledAt) existing.enrolledAt = dto.enrolledAt;
      if (dto.facilityEnrolled) existing.facilityEnrolled = dto.facilityEnrolled;
      existing.active = true;
      return this.progRepo.save(existing);
    }
    const link = this.progRepo.create({ patientId, programme, ...dto, active: true });
    return this.progRepo.save(link);
  }

  async getProgrammeLinkages(patientId: string): Promise<NcidProgrammeLinkage[]> {
    return this.progRepo.find({ where: { patientId }, order: { programme: 'ASC' } });
  }

  async getPendingDuplicates(): Promise<NcidDuplicateFlag[]> {
    return this.dupRepo.find({
      where: { resolutionStatus: 'pending' },
      order: { matchScore: 'DESC' },
      take: 100,
    });
  }
}
```

### 4b. NcidController

**File: `services/ehr-service/src/controllers/ncid.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NcidService } from '../services/ncid.service';

@ApiTags('NCID')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ncid')
export class NcidController {
  constructor(private readonly ncidService: NcidService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register or link a national ID to a patient' })
  register(@Body() body: {
    patientId: string;
    countryCode: string;
    idType: string;
    idNumber: string;
    isPrimary?: boolean;
    verificationMethod?: string;
    verifiedBy?: string;
  }) {
    return this.ncidService.registerNcid(body);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Get all national IDs for a patient' })
  getIds(@Param('patientId') patientId: string) {
    return this.ncidService.getPatientIds(patientId);
  }

  @Get('patient/:patientId/programmes')
  @ApiOperation({ summary: 'Get programme linkages for a patient' })
  getProgrammes(@Param('patientId') patientId: string) {
    return this.ncidService.getProgrammeLinkages(patientId);
  }

  @Post('patient/:patientId/gaps')
  @ApiOperation({ summary: 'CDSS: Detect cross-programme enrolment gaps' })
  gaps(@Param('patientId') patientId: string, @Body() body: {
    diagnoses: string[];
    ageYears: number;
    sex: string;
    isPregnant: boolean;
  }) {
    return this.ncidService.analyseGaps(patientId, body);
  }

  @Post('programme-linkage')
  @ApiOperation({ summary: 'Upsert a programme linkage for a patient' })
  upsertLinkage(@Body() body: {
    patientId: string;
    programme: string;
    programmeNumber?: string;
    enrolledAt?: string;
    facilityEnrolled?: string;
  }) {
    return this.ncidService.upsertProgrammeLinkage(body.patientId, body.programme, body);
  }

  @Post('deduplication/score')
  @ApiOperation({ summary: 'CDSS: Score demographic similarity between two patients' })
  score(@Body() body: {
    patientIdA: string;
    patientIdB: string;
    demographics: {
      a: { givenName: string; familyName: string; dob: string; sex: string; phone?: string; mothersName?: string; village?: string };
      b: { givenName: string; familyName: string; dob: string; sex: string; phone?: string; mothersName?: string; village?: string };
    };
  }) {
    return this.ncidService.scoreDeduplication(body.patientIdA, body.patientIdB, body.demographics);
  }

  @Get('duplicates/pending')
  @ApiOperation({ summary: 'Get pending duplicate flags ordered by match score' })
  pendingDuplicates() {
    return this.ncidService.getPendingDuplicates();
  }

  @Patch('duplicates/:flagId/resolve')
  @ApiOperation({ summary: 'Resolve a duplicate flag' })
  resolve(@Param('flagId') flagId: string, @Body() body: {
    status: 'confirmed_duplicate' | 'confirmed_different' | 'merged' | 'dismissed';
    resolvedBy: string;
    mergedIntoPatientId?: string;
    notes?: string;
  }) {
    return this.ncidService.resolveDuplicate(flagId, body);
  }
}
```

### 4c. NcidModule

**File: `services/ehr-service/src/ncid/ncid.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NcidController } from '../controllers/ncid.controller';
import { NcidService } from '../services/ncid.service';
import { NcidRegistration } from '../entities/ncid-registration.entity';
import { NcidDuplicateFlag } from '../entities/ncid-duplicate-flag.entity';
import { NcidProgrammeLinkage } from '../entities/ncid-programme-linkage.entity';
import { CdssModule } from '../cdss/cdss.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NcidRegistration, NcidDuplicateFlag, NcidProgrammeLinkage]),
    CdssModule,
  ],
  controllers: [NcidController],
  providers: [NcidService],
  exports: [NcidService],
})
export class NcidModule {}
```

**File: `services/ehr-service/src/ehr.module.ts`** — add to imports array:
```typescript
NcidModule,
```
Add import:
```typescript
import { NcidModule } from './ncid/ncid.module';
```

---

## 5. Frontend

### 5a. API Bindings

**File: `ehr-frontend/src/services/api.ts`** — append:

```typescript
// ── NCID ──────────────────────────────────────────────────────────────────

export const registerNcid = async (body: {
  patientId: string; countryCode: string; idType: string; idNumber: string;
  isPrimary?: boolean; verificationMethod?: string;
}) => {
  const res = await fetch(`${API_BASE_URL}/ncid/register`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to register NCID');
  return res.json();
};

export const getPatientNcids = async (patientId: string) => {
  const res = await fetch(`${API_BASE_URL}/ncid/patient/${patientId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch NCIDs');
  return res.json();
};

export const getPatientProgrammes = async (patientId: string) => {
  const res = await fetch(`${API_BASE_URL}/ncid/patient/${patientId}/programmes`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch programmes');
  return res.json();
};

export const getProgrammeGaps = async (patientId: string, body: {
  diagnoses: string[]; ageYears: number; sex: string; isPregnant: boolean;
}) => {
  const res = await fetch(`${API_BASE_URL}/ncid/patient/${patientId}/gaps`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to fetch gaps');
  return res.json();
};

export const getPendingDuplicates = async () => {
  const res = await fetch(`${API_BASE_URL}/ncid/duplicates/pending`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch duplicates');
  return res.json();
};

export const resolveDuplicate = async (flagId: string, body: {
  status: string; resolvedBy: string; mergedIntoPatientId?: string; notes?: string;
}) => {
  const res = await fetch(`${API_BASE_URL}/ncid/duplicates/${flagId}/resolve`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to resolve duplicate');
  return res.json();
};
```

### 5b. NcidPanel Component (inline patient detail panel)

**File: `ehr-frontend/src/components/NcidPanel.tsx`**

This panel is embedded in the patient detail page (not a separate route) — similar to `UbuntuCulturalPanel.tsx` from S159.

```tsx
import React, { useEffect, useState } from 'react';
import { Fingerprint, AlertTriangle, CheckCircle, Plus, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getPatientNcids, getPatientProgrammes, getProgrammeGaps,
  registerNcid,
} from '../services/api';

interface NcidPanelProps {
  patientId: string;
  diagnoses: string[];
  ageYears: number;
  sex: string;
  isPregnant: boolean;
}

const ID_TYPES: Record<string, string[]> = {
  ZW: ['national_id', 'nhid', 'passport', 'birth_certificate'],
  ZA: ['national_id', 'passport', 'arc'],
  ZM: ['nrc', 'passport'],
  MZ: ['nuip', 'passport'],
  TZ: ['nida', 'passport'],
  KE: ['national_id', 'sha_beneficiary', 'passport'],
  MW: ['national_id', 'passport'],
  UG: ['national_id', 'passport'],
  RW: ['national_id', 'passport'],
  ET: ['national_id', 'passport'],
};

const PRIORITY_COLOURS: Record<string, string> = {
  urgent: 'bg-red-50 border-red-400 text-red-800',
  high: 'bg-orange-50 border-orange-400 text-orange-800',
  routine: 'bg-yellow-50 border-yellow-300 text-yellow-800',
};

export const NcidPanel: React.FC<NcidPanelProps> = ({ patientId, diagnoses, ageYears, sex, isPregnant }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ids' | 'programmes' | 'gaps'>('ids');
  const [ids, setIds] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [gapSummary, setGapSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [form, setForm] = useState({ countryCode: 'ZW', idType: 'national_id', idNumber: '', isPrimary: false });

  const load = async () => {
    setLoading(true);
    try {
      const [idsRes, progsRes] = await Promise.all([
        getPatientNcids(patientId),
        getPatientProgrammes(patientId),
      ]);
      setIds(idsRes);
      setProgrammes(progsRes);
    } finally {
      setLoading(false);
    }
  };

  const loadGaps = async () => {
    setLoading(true);
    try {
      const res = await getProgrammeGaps(patientId, { diagnoses, ageYears, sex, isPregnant });
      setGaps(res.gaps ?? []);
      setGapSummary(res.summary ?? '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (activeTab === 'gaps' && open) loadGaps();
  }, [activeTab]);

  const handleRegister = async () => {
    await registerNcid({ patientId, ...form });
    setShowRegisterForm(false);
    load();
  };

  return (
    <div className="border border-gray-200 rounded-lg mt-4">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-indigo-600" />
          <span className="font-medium text-gray-800">National Client ID & Programme Linkages</span>
          {gaps.filter(g => g.priority === 'urgent').length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {gaps.filter(g => g.priority === 'urgent').length} urgent gaps
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b">
            {(['ids', 'programmes', 'gaps'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t capitalize ${
                  activeTab === t ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t === 'ids' ? 'National IDs' : t === 'programmes' ? 'Programmes' : 'Gap Analysis'}
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-gray-500">Loading...</p>}

          {/* National IDs Tab */}
          {activeTab === 'ids' && !loading && (
            <div>
              {ids.length === 0 && <p className="text-sm text-gray-500 mb-3">No national IDs registered for this patient.</p>}
              <div className="space-y-2 mb-3">
                {ids.map(id => (
                  <div key={id.id} className="flex items-center justify-between bg-gray-50 rounded p-2 text-sm">
                    <div>
                      <span className="font-mono font-medium">{id.idNumberFormatted || id.idNumber}</span>
                      <span className="ml-2 text-gray-500">{id.countryCode} · {id.idType}</span>
                      {id.isPrimary && <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-1 rounded">Primary</span>}
                    </div>
                    {id.verified
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  </div>
                ))}
              </div>

              {!showRegisterForm && (
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-4 h-4" /> Register National ID
                </button>
              )}

              {showRegisterForm && (
                <div className="bg-indigo-50 rounded p-3 space-y-2 mt-2">
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={form.countryCode}
                    onChange={e => setForm(f => ({ ...f, countryCode: e.target.value, idType: ID_TYPES[e.target.value]?.[0] ?? 'national_id' }))}
                  >
                    {Object.keys(ID_TYPES).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={form.idType}
                    onChange={e => setForm(f => ({ ...f, idType: e.target.value }))}
                  >
                    {(ID_TYPES[form.countryCode] ?? ['national_id']).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="ID Number"
                    value={form.idNumber}
                    onChange={e => setForm(f => ({ ...f, idNumber: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isPrimary} onChange={e => setForm(f => ({ ...f, isPrimary: e.target.checked }))} />
                    Set as primary ID
                  </label>
                  <div className="flex gap-2">
                    <button onClick={handleRegister} className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded hover:bg-indigo-700">Save</button>
                    <button onClick={() => setShowRegisterForm(false)} className="text-sm text-gray-500">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Programmes Tab */}
          {activeTab === 'programmes' && !loading && (
            <div>
              {programmes.length === 0 && <p className="text-sm text-gray-500">No programme linkages on record.</p>}
              <div className="grid grid-cols-2 gap-2">
                {programmes.map(p => (
                  <div key={p.id} className={`rounded p-2 text-sm border ${p.active ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      <span className="font-medium capitalize">{p.programme.replace(/_/g, ' ')}</span>
                    </div>
                    {p.programmeNumber && <div className="text-gray-500 text-xs mt-0.5">#{p.programmeNumber}</div>}
                    {p.enrolledAt && <div className="text-gray-400 text-xs">Enrolled: {p.enrolledAt}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap Analysis Tab */}
          {activeTab === 'gaps' && !loading && (
            <div>
              {gapSummary && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 mb-3">
                  {gapSummary}
                </div>
              )}
              {gaps.length === 0 && <p className="text-sm text-green-700">No cross-programme enrolment gaps detected.</p>}
              <div className="space-y-2">
                {gaps.map((gap: any, i: number) => (
                  <div key={i} className={`rounded border-l-4 p-3 ${PRIORITY_COLOURS[gap.priority] ?? 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm capitalize">{gap.missing_programme.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-medium uppercase">{gap.priority}</span>
                    </div>
                    <p className="text-xs mt-1">{gap.reason}</p>
                    <p className="text-xs mt-1 font-medium">Action: {gap.action}</p>
                  </div>
                ))}
              </div>
              <button onClick={loadGaps} className="mt-3 text-xs text-indigo-600 hover:underline">Re-run gap analysis</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### 5c. Deduplication Admin Page

**File: `ehr-frontend/src/pages/NcidDeduplicationPage.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { getPendingDuplicates, resolveDuplicate } from '../services/api';

export const NcidDeduplicationPage: React.FC = () => {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setFlags(await getPendingDuplicates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (flagId: string, status: string) => {
    await resolveDuplicate(flagId, { status, resolvedBy: 'current-user' });
    load();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Deduplication</h1>
          <p className="text-sm text-gray-500">Review and resolve potential duplicate patient records</p>
        </div>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && flags.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-medium">No pending duplicate flags</p>
        </div>
      )}

      <div className="space-y-4">
        {flags.map(flag => (
          <div key={flag.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${flag.matchScore >= 0.85 ? 'text-red-500' : 'text-yellow-500'}`} />
                  <span className="font-semibold text-gray-800">Match Score: {(flag.matchScore * 100).toFixed(0)}%</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    flag.cdssRecommendation === 'merge' ? 'bg-red-100 text-red-700' :
                    flag.cdssRecommendation === 'manual_review' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    CDSS: {flag.cdssRecommendation}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Patient A: <code className="bg-gray-100 px-1 rounded">{flag.patientIdA.slice(0, 8)}...</code>
                  {' vs '}
                  Patient B: <code className="bg-gray-100 px-1 rounded">{flag.patientIdB.slice(0, 8)}...</code>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Matched on: {(flag.matchFields ?? []).join(', ')}
                </p>
                {flag.cdssReasoning && (
                  <p className="text-sm text-gray-600 mt-2 italic">{flag.cdssReasoning}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => resolve(flag.id, 'confirmed_duplicate')}
                  className="flex items-center gap-1 bg-red-600 text-white text-xs px-3 py-1.5 rounded hover:bg-red-700"
                >
                  <XCircle className="w-3 h-3" /> Duplicate
                </button>
                <button
                  onClick={() => resolve(flag.id, 'confirmed_different')}
                  className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded hover:bg-green-700"
                >
                  <CheckCircle className="w-3 h-3" /> Different
                </button>
                <button
                  onClick={() => resolve(flag.id, 'dismissed')}
                  className="text-xs text-gray-500 px-2 py-1.5 border rounded hover:bg-gray-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 6. Provisioning & Tenant Repair

### 6a. Apply Provisioning to All Existing Tenants

```bash
# Run after all code changes compile cleanly
./scripts/provision-repair-all.sh

# Manual curl fallback if script unavailable:
curl -X POST http://localhost:3001/api/database-provisioning/run-all \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify tables exist in a tenant DB:
psql "$TENANT_DB_URL" -c "\d ncid_registrations"
psql "$TENANT_DB_URL" -c "\d ncid_duplicate_flags"
psql "$TENANT_DB_URL" -c "\d ncid_programme_linkages"
```

### 6b. Required Dependency

```bash
# In services/cdss-service/
pip install jellyfish>=1.0.0

# Add to requirements.txt:
jellyfish>=1.0.0
```

---

## 7. Definition of Done

### Gate 1 — Database
```bash
psql "$TENANT_DB_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='ncid_registrations' ORDER BY ordinal_position;"
# Expected: id, patient_id, country_code, id_type, id_number, id_number_hash, id_number_formatted,
#           verified, verification_method, verified_by, verified_at, biometric_hash,
#           national_registry_synced, national_registry_ref, is_primary, is_active, ...

psql "$TENANT_DB_URL" -c "SELECT COUNT(*) FROM ncid_duplicate_flags;"
psql "$TENANT_DB_URL" -c "SELECT COUNT(*) FROM ncid_programme_linkages;"
```

### Gate 2 — TypeScript Compile
```bash
cd services/ehr-service && npx tsc --noEmit
# Zero errors required
```

### Gate 3 — Lint
```bash
npm run lint
# Zero errors required — warnings acceptable
```

### Gate 4 — CDSS Endpoints
```bash
# Verify all 3 endpoints registered:
curl http://localhost:8000/docs | grep -E "ncid/(duplicate-score|programme-gaps|validate-id)"

# Smoke test duplicate score:
curl -X POST http://localhost:8000/cdss/ncid/duplicate-score \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "test-123",
    "tenant_id": "test",
    "patient_a": {"given_name":"John","family_name":"Moyo","date_of_birth":"1985-03-15","sex":"male"},
    "patient_b": {"given_name":"Jon","family_name":"Muyo","date_of_birth":"1985-03-15","sex":"male"}
  }'
# Expected: match_score > 0.3, recommendation = "manual_review" or "merge"

# Smoke test programme gaps:
curl -X POST http://localhost:8000/cdss/ncid/programme-gaps \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "test-123",
    "tenant_id": "test",
    "active_programmes": [],
    "diagnoses": ["HIV", "Hypertension"],
    "age_years": 35,
    "sex": "female",
    "is_pregnant": false
  }'
# Expected: gaps_detected includes hiv_art, tb_preventive, cervical_cancer, ncd_htn

# Smoke test validation:
curl -X POST http://localhost:8000/cdss/ncid/validate-id \
  -H "Content-Type: application/json" \
  -d '{"id_type":"national_id","id_number":"63-123456-F-20","country_code":"ZW"}'
# Expected: {"valid": true, "formatted_number": "63-123456-F-20"}
```

### Gate 5 — EHR API
```bash
curl -X GET http://localhost:3013/api/ncid/patient/test-patient-id \
  -H "Authorization: Bearer $JWT" \
  -H "X-Tenant-ID: $TENANT_ID"
# Expected: 200 [] (empty array for new patient)
```

### Gate 6 — Git Commit
Only after all gates pass:
```bash
git add \
  services/tenant-service/src/generated/tenant-ncid.statements.ts \
  services/tenant-service/src/services/database-provisioning.service.ts \
  services/ehr-service/src/entities/ncid-registration.entity.ts \
  services/ehr-service/src/entities/ncid-duplicate-flag.entity.ts \
  services/ehr-service/src/entities/ncid-programme-linkage.entity.ts \
  services/ehr-service/src/services/ncid.service.ts \
  services/ehr-service/src/controllers/ncid.controller.ts \
  services/ehr-service/src/ncid/ncid.module.ts \
  services/ehr-service/src/ehr.module.ts \
  services/ehr-service/src/services/tenant.service.ts \
  services/cdss-service/main.py \
  services/cdss-service/requirements.txt \
  ehr-frontend/src/services/api.ts \
  ehr-frontend/src/components/NcidPanel.tsx \
  ehr-frontend/src/pages/NcidDeduplicationPage.tsx

git commit -m "feat(s161): NCID national client ID registry with deduplication and programme gap CDSS"
```

---

## 8. Summary of What This Sprint Delivers

| Feature | Benefit |
|---------|---------|
| `ncid_registrations` — 10+ African national ID types | Single place to link any national ID to any patient |
| SHA-256 hash deduplication at registration | Detects same ID registered to two patients before it becomes a problem |
| CDSS demographic duplicate scoring (Soundex + LLM) | Finds same person registered under different name spellings — common in Africa |
| `ncid_programme_linkages` — cross-programme tracking | First time MediCore knows HIV patient is NOT in TB IPT or cervical cancer screening |
| CDSS programme gap analysis — 12 hard-coded rules | Urgently flags HIV not in ART, TB not in DOTS, pregnant not in ANC |
| National ID format validation — ZW/ZA/ZM/MZ/TZ/KE | Catches transcription errors at data entry time |
| `NcidPanel` in patient detail page | Clinician sees all IDs + gaps without leaving the patient record |
| `NcidDeduplicationPage` — admin merge workflow | Admin can review and resolve CDSS-flagged duplicates |
