# Sprint 154 — CBHI Deep Module: Contributions, Exemptions & Waiver Workflows

**Sprint**: S154  
**Module**: Community-Based Health Insurance — Contribution Management, Indigent Exemptions, Waiver Workflows, Claims Adjudication AI  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint154_cbhi_deep_module`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

MediCore has basic CBHI billing from S134. What is entirely missing is the **operational management layer** that makes CBHI programmes functional in Africa:

| Gap | Impact |
|---|---|
| No contribution tracking | Cannot verify who is paid-up vs. defaulted at point of care |
| No household scheme membership | CBHI insures households, not individuals — no family unit concept |
| No indigent/waiver register | ~30-40% of African CBHI members are government-subsidised; no exemption workflow |
| No claims adjudication | Claims sit unprocessed; facilities don't know what they'll be reimbursed |
| No fraud/anomaly detection | Duplicate claims and inflated procedures go undetected |

### What already exists (do NOT recreate)

- `NhifCbhiBilling` from S134/S149 — basic billing claim submission
- `PatientService`, `CdssService`
- Mobile money from S134 — can be linked to contributions
- `database-provisioning.service.ts`, `tenant.service.ts`, `ehr.module.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-cbhi-deep-module.statements.ts`**

```typescript
export const TENANT_CBHI_DEEP_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_CBHI_DEEP_STATEMENTS: string[] = [

  // ── CBHI Households ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cbhi_households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Household identity
    household_id TEXT NOT NULL UNIQUE,   -- scheme-assigned household number
    scheme_id TEXT NOT NULL,             -- CBHI scheme code (e.g. 'ZKHA_LUSAKA_2024')
    scheme_name TEXT NOT NULL,
    head_of_household_patient_id UUID,   -- references patients table
    household_name TEXT NOT NULL,
    village TEXT,
    ward TEXT,
    district TEXT,
    -- Membership
    membership_status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'lapsed' | 'exempted'
    membership_start_date DATE NOT NULL,
    membership_expiry_date DATE,
    member_count INTEGER NOT NULL DEFAULT 1,
    -- Financial
    annual_premium_amount DECIMAL(10,2),
    premium_currency TEXT NOT NULL DEFAULT 'USD',
    premium_frequency TEXT NOT NULL DEFAULT 'annual',  -- 'monthly' | 'quarterly' | 'annual'
    -- Indigent / Waiver
    indigent_status BOOLEAN NOT NULL DEFAULT false,
    indigent_certified_by TEXT,
    indigent_certification_date DATE,
    waiver_type TEXT,                    -- 'full_government' | 'partial_subsidy' | 'ngo_sponsored'
    waiver_percentage DECIMAL(5,2),      -- 0-100
    waiver_sponsor TEXT,
    waiver_expiry_date DATE,
    -- Contact
    phone TEXT,
    -- Audit
    registered_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cbhi_households_scheme ON cbhi_households(scheme_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_households_status ON cbhi_households(membership_status)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_households_head ON cbhi_households(head_of_household_patient_id)`,

  // ── CBHI Household Members ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cbhi_household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES cbhi_households(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    member_number TEXT,                  -- member card number
    relationship_to_head TEXT NOT NULL,  -- 'head' | 'spouse' | 'child' | 'dependent'
    member_status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'deceased' | 'removed'
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    left_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS uidx_cbhi_member_patient ON cbhi_household_members(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_members_household ON cbhi_household_members(household_id)`,

  // ── CBHI Contributions ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cbhi_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES cbhi_households(id),
    -- Payment details
    payment_date DATE NOT NULL,
    period_covered_from DATE NOT NULL,
    period_covered_to DATE NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    -- Subsidy / waiver portion
    subsidy_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    member_contribution DECIMAL(10,2) NOT NULL,
    -- Payment method
    payment_method TEXT NOT NULL,        -- 'cash' | 'mobile_money' | 'bank_transfer' | 'subsidy_credit'
    mobile_money_ref TEXT,               -- M-Pesa / EcoCash / MTN reference
    receipt_number TEXT,
    -- Status
    payment_status TEXT NOT NULL DEFAULT 'confirmed',  -- 'pending' | 'confirmed' | 'reversed'
    -- Collector
    collected_by UUID,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cbhi_contributions_household ON cbhi_contributions(household_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_contributions_period ON cbhi_contributions(period_covered_from, period_covered_to)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_contributions_date ON cbhi_contributions(payment_date)`,

  // ── CBHI Claims ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cbhi_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Claim identity
    claim_number TEXT NOT NULL UNIQUE,
    household_id UUID NOT NULL REFERENCES cbhi_households(id),
    patient_id UUID NOT NULL,
    scheme_id TEXT NOT NULL,
    -- Episode
    encounter_id UUID,
    admission_date DATE,
    discharge_date DATE,
    principal_diagnosis_icd TEXT NOT NULL,
    secondary_diagnoses JSONB DEFAULT '[]',
    procedures JSONB DEFAULT '[]',       -- [{code, description, quantity, unit_cost}]
    -- Financial
    total_billed DECIMAL(12,2) NOT NULL,
    claimed_amount DECIMAL(12,2) NOT NULL,
    co_payment_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    approved_amount DECIMAL(12,2),
    paid_amount DECIMAL(12,2),
    rejection_reason TEXT,
    -- AI Adjudication
    cdss_fraud_score DECIMAL(5,4),       -- 0-1 probability of anomaly
    cdss_approval_recommendation TEXT,  -- 'approve' | 'review' | 'reject'
    cdss_confidence DECIMAL(4,3),
    cdss_flags JSONB DEFAULT '[]',       -- ['duplicate_possible','inflated_procedure','diagnosis_procedure_mismatch']
    -- Status workflow
    claim_status TEXT NOT NULL DEFAULT 'submitted',  -- 'submitted' | 'under_review' | 'approved' | 'partially_approved' | 'rejected' | 'paid'
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by UUID,
    adjudicated_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cbhi_claims_household ON cbhi_claims(household_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_claims_patient ON cbhi_claims(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_claims_status ON cbhi_claims(claim_status)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_claims_scheme ON cbhi_claims(scheme_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cbhi_claims_submitted ON cbhi_claims(submitted_at)`,

];
```

### 2b. Register Bundle in `database-provisioning.service.ts`

```typescript
import {
  TENANT_CBHI_DEEP_BUNDLE_VERSION,
  TENANT_CBHI_DEEP_STATEMENTS,
} from './generated/tenant-cbhi-deep-module.statements';

{
  id: 'sprint154_cbhi_deep_module',
  label: 'Sprint 154 — CBHI Deep Module (Contributions, Exemptions, Claims AI)',
  version: TENANT_CBHI_DEEP_BUNDLE_VERSION,
  description: 'Creates cbhi_households, cbhi_household_members, cbhi_contributions, cbhi_claims tables',
  statements: TENANT_CBHI_DEEP_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/cbhi/entities/cbhi-household.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CbhiHouseholdMember } from './cbhi-household-member.entity';
import { CbhiContribution } from './cbhi-contribution.entity';
import { CbhiClaim } from './cbhi-claim.entity';

@Entity({ name: 'cbhi_households' })
export class CbhiHousehold {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'household_id', unique: true }) householdId: string;
  @Column({ name: 'scheme_id' }) schemeId: string;
  @Column({ name: 'scheme_name' }) schemeName: string;
  @Column({ name: 'head_of_household_patient_id', nullable: true }) headOfHouseholdPatientId: string;
  @Column({ name: 'household_name' }) householdName: string;
  @Column({ name: 'village', nullable: true }) village: string;
  @Column({ name: 'ward', nullable: true }) ward: string;
  @Column({ name: 'district', nullable: true }) district: string;
  @Column({ name: 'membership_status', default: 'active' }) membershipStatus: string;
  @Column({ name: 'membership_start_date', type: 'date' }) membershipStartDate: string;
  @Column({ name: 'membership_expiry_date', type: 'date', nullable: true }) membershipExpiryDate: string;
  @Column({ name: 'member_count', default: 1 }) memberCount: number;
  @Column({ name: 'annual_premium_amount', type: 'decimal', precision: 10, scale: 2, nullable: true }) annualPremiumAmount: number;
  @Column({ name: 'premium_currency', default: 'USD' }) premiumCurrency: string;
  @Column({ name: 'premium_frequency', default: 'annual' }) premiumFrequency: string;
  @Column({ name: 'indigent_status', default: false }) indigentStatus: boolean;
  @Column({ name: 'indigent_certified_by', nullable: true }) indigentCertifiedBy: string;
  @Column({ name: 'indigent_certification_date', type: 'date', nullable: true }) indigentCertificationDate: string;
  @Column({ name: 'waiver_type', nullable: true }) waiverType: string;
  @Column({ name: 'waiver_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true }) waiverPercentage: number;
  @Column({ name: 'waiver_sponsor', nullable: true }) waiverSponsor: string;
  @Column({ name: 'waiver_expiry_date', type: 'date', nullable: true }) waiverExpiryDate: string;
  @Column({ name: 'phone', nullable: true }) phone: string;
  @Column({ name: 'registered_by', nullable: true }) registeredBy: string;
  @OneToMany(() => CbhiHouseholdMember, m => m.household) members: CbhiHouseholdMember[];
  @OneToMany(() => CbhiContribution, c => c.household) contributions: CbhiContribution[];
  @OneToMany(() => CbhiClaim, c => c.household) claims: CbhiClaim[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/cbhi/entities/cbhi-household-member.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { CbhiHousehold } from './cbhi-household.entity';

@Entity({ name: 'cbhi_household_members' })
export class CbhiHouseholdMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'household_id' }) householdId: string;
  @ManyToOne(() => CbhiHousehold, h => h.members) @JoinColumn({ name: 'household_id' }) household: CbhiHousehold;
  @Column({ name: 'patient_id', unique: true }) patientId: string;
  @Column({ name: 'member_number', nullable: true }) memberNumber: string;
  @Column({ name: 'relationship_to_head' }) relationshipToHead: string;
  @Column({ name: 'member_status', default: 'active' }) memberStatus: string;
  @Column({ name: 'joined_date', type: 'date' }) joinedDate: string;
  @Column({ name: 'left_date', type: 'date', nullable: true }) leftDate: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

**File: `services/ehr-service/src/cbhi/entities/cbhi-contribution.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { CbhiHousehold } from './cbhi-household.entity';

@Entity({ name: 'cbhi_contributions' })
export class CbhiContribution {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'household_id' }) householdId: string;
  @ManyToOne(() => CbhiHousehold, h => h.contributions) @JoinColumn({ name: 'household_id' }) household: CbhiHousehold;
  @Column({ name: 'payment_date', type: 'date' }) paymentDate: string;
  @Column({ name: 'period_covered_from', type: 'date' }) periodCoveredFrom: string;
  @Column({ name: 'period_covered_to', type: 'date' }) periodCoveredTo: string;
  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2 }) amountPaid: number;
  @Column({ name: 'currency', default: 'USD' }) currency: string;
  @Column({ name: 'subsidy_amount', type: 'decimal', precision: 10, scale: 2, default: 0 }) subsidyAmount: number;
  @Column({ name: 'member_contribution', type: 'decimal', precision: 10, scale: 2 }) memberContribution: number;
  @Column({ name: 'payment_method' }) paymentMethod: string;
  @Column({ name: 'mobile_money_ref', nullable: true }) mobileMoDelRef: string;
  @Column({ name: 'receipt_number', nullable: true }) receiptNumber: string;
  @Column({ name: 'payment_status', default: 'confirmed' }) paymentStatus: string;
  @Column({ name: 'collected_by', nullable: true }) collectedBy: string;
  @Column({ name: 'notes', nullable: true }) notes: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

**File: `services/ehr-service/src/cbhi/entities/cbhi-claim.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CbhiHousehold } from './cbhi-household.entity';

@Entity({ name: 'cbhi_claims' })
export class CbhiClaim {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'claim_number', unique: true }) claimNumber: string;
  @Column({ name: 'household_id' }) householdId: string;
  @ManyToOne(() => CbhiHousehold, h => h.claims) @JoinColumn({ name: 'household_id' }) household: CbhiHousehold;
  @Column({ name: 'patient_id' }) patientId: string;
  @Column({ name: 'scheme_id' }) schemeId: string;
  @Column({ name: 'encounter_id', nullable: true }) encounterId: string;
  @Column({ name: 'admission_date', type: 'date', nullable: true }) admissionDate: string;
  @Column({ name: 'discharge_date', type: 'date', nullable: true }) dischargeDate: string;
  @Column({ name: 'principal_diagnosis_icd' }) principalDiagnosisIcd: string;
  @Column({ name: 'secondary_diagnoses', type: 'jsonb', default: [] }) secondaryDiagnoses: string[];
  @Column({ name: 'procedures', type: 'jsonb', default: [] }) procedures: object[];
  @Column({ name: 'total_billed', type: 'decimal', precision: 12, scale: 2 }) totalBilled: number;
  @Column({ name: 'claimed_amount', type: 'decimal', precision: 12, scale: 2 }) claimedAmount: number;
  @Column({ name: 'co_payment_amount', type: 'decimal', precision: 12, scale: 2, default: 0 }) coPaymentAmount: number;
  @Column({ name: 'approved_amount', type: 'decimal', precision: 12, scale: 2, nullable: true }) approvedAmount: number;
  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, nullable: true }) paidAmount: number;
  @Column({ name: 'rejection_reason', nullable: true }) rejectionReason: string;
  @Column({ name: 'cdss_fraud_score', type: 'decimal', precision: 5, scale: 4, nullable: true }) cdssFraudScore: number;
  @Column({ name: 'cdss_approval_recommendation', nullable: true }) cdssApprovalRecommendation: string;
  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number;
  @Column({ name: 'cdss_flags', type: 'jsonb', default: [] }) cdssFlags: string[];
  @Column({ name: 'claim_status', default: 'submitted' }) claimStatus: string;
  @Column({ name: 'submitted_at', type: 'timestamp' }) submittedAt: Date;
  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true }) reviewedAt: Date;
  @Column({ name: 'reviewed_by', nullable: true }) reviewedBy: string;
  @Column({ name: 'adjudicated_at', type: 'timestamp', nullable: true }) adjudicatedAt: Date;
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true }) paidAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 3a. Register in `tenant.service.ts`

```typescript
import { CbhiHousehold } from '../ehr/cbhi/entities/cbhi-household.entity';
import { CbhiHouseholdMember } from '../ehr/cbhi/entities/cbhi-household-member.entity';
import { CbhiContribution } from '../ehr/cbhi/entities/cbhi-contribution.entity';
import { CbhiClaim } from '../ehr/cbhi/entities/cbhi-claim.entity';
// Add to entities array: CbhiHousehold, CbhiHouseholdMember, CbhiContribution, CbhiClaim
```

---

## 4. CDSS Python Endpoints

```python
class CbhiClaimAdjudicationRequest(BaseModel):
    claim_number: str
    scheme_id: str
    principal_diagnosis_icd: str
    secondary_diagnoses: List[str]
    procedures: List[Dict[str, Any]]    # [{code, description, quantity, unit_cost}]
    total_billed: float
    claimed_amount: float
    length_of_stay_days: Optional[int]
    patient_age_years: int
    similar_claims_last_90_days: int    # same patient, same diagnosis window
    procedure_count: int

class CbhiClaimAdjudicationResponse(BaseModel):
    fraud_score: float                  # 0-1
    approval_recommendation: str        # 'approve' | 'review' | 'reject'
    flags: List[str]
    flag_explanations: Dict[str, str]   # flag_name -> explanation
    recommended_approved_amount: float
    review_priority: str                # 'immediate' | 'standard' | 'low'
    denial_reasons: List[str]
    confidence: float
    citations: List[str]

@app.post("/cdss/cbhi/claim-adjudication", response_model=CbhiClaimAdjudicationResponse)
async def cbhi_claim_adjudication(req: CbhiClaimAdjudicationRequest):
    """
    CBHI claims fraud detection and adjudication recommendation.
    Flags duplicate claims, inflated procedures, diagnosis-procedure mismatches.
    Based on WHO health financing fraud detection guidelines and AfHEA CBHI claim audit frameworks.
    """
    prompt = f"""
    You are a health insurance claims adjudicator using AfHEA CBHI Claims Audit Framework
    and WHO Health Financing Fraud Detection Guidelines.

    Claim:
    - Claim: {req.claim_number}, Scheme: {req.scheme_id}
    - Diagnosis: {req.principal_diagnosis_icd}, Secondary: {req.secondary_diagnoses}
    - Procedures ({req.procedure_count}): {req.procedures}
    - Billed: {req.total_billed}, Claimed: {req.claimed_amount}
    - LOS: {req.length_of_stay_days} days
    - Patient age: {req.patient_age_years}
    - Similar claims last 90d: {req.similar_claims_last_90_days}

    Assess for:
    1. Duplicate claim (same patient, diagnosis, period) → flag 'possible_duplicate'
    2. Unbundling (procedures that should be one code split into many) → 'unbundling_suspected'
    3. Upcoding (procedure coded at higher complexity than warranted by diagnosis) → 'upcoding_suspected'
    4. Diagnosis-procedure mismatch (e.g. C-section coded for male patient) → 'diagnosis_procedure_mismatch'
    5. Excessive LOS for diagnosis → 'excessive_los'
    6. Inflated unit costs vs. standard tariff → 'above_tariff'
    7. Fraud score 0-1: 0=clean, 1=highly suspicious

    Return JSON: fraud_score, approval_recommendation, flags (list), flag_explanations (dict),
    recommended_approved_amount, review_priority, denial_reasons (list), confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="cbhi_claim_adjudication", phi_present=True)
    return result
```

---

## 5. NestJS Service

**File: `services/ehr-service/src/cbhi/cbhi.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CbhiHousehold } from './entities/cbhi-household.entity';
import { CbhiHouseholdMember } from './entities/cbhi-household-member.entity';
import { CbhiContribution } from './entities/cbhi-contribution.entity';
import { CbhiClaim } from './entities/cbhi-claim.entity';
import { CdssService } from '../cdss/cdss.service';

@Injectable()
export class CbhiService {
  constructor(
    @InjectRepository(CbhiHousehold) private householdRepo: Repository<CbhiHousehold>,
    @InjectRepository(CbhiHouseholdMember) private memberRepo: Repository<CbhiHouseholdMember>,
    @InjectRepository(CbhiContribution) private contributionRepo: Repository<CbhiContribution>,
    @InjectRepository(CbhiClaim) private claimRepo: Repository<CbhiClaim>,
    private cdssService: CdssService,
  ) {}

  // ── Households ─────────────────────────────────────────────────────────────
  async registerHousehold(dto: Partial<CbhiHousehold>): Promise<CbhiHousehold> {
    return this.householdRepo.save(this.householdRepo.create(dto));
  }

  async getHouseholds(schemeId?: string): Promise<CbhiHousehold[]> {
    const where = schemeId ? { schemeId } : {};
    return this.householdRepo.find({ where, relations: ['members'], order: { createdAt: 'DESC' } });
  }

  async getHousehold(id: string): Promise<CbhiHousehold> {
    return this.householdRepo.findOneOrFail({ where: { id }, relations: ['members', 'contributions', 'claims'] });
  }

  async updateHousehold(id: string, dto: Partial<CbhiHousehold>): Promise<CbhiHousehold> {
    await this.householdRepo.update(id, dto);
    return this.getHousehold(id);
  }

  async verifyMembership(patientId: string): Promise<{ active: boolean; household: CbhiHousehold | null; message: string }> {
    const member = await this.memberRepo.findOne({ where: { patientId, memberStatus: 'active' }, relations: ['household'] });
    if (!member) return { active: false, household: null, message: 'Patient not enrolled in CBHI' };
    const household = member.household;
    if (household.membershipStatus !== 'active') return { active: false, household, message: `Household membership is ${household.membershipStatus}` };
    if (household.membershipExpiryDate && new Date(household.membershipExpiryDate) < new Date()) {
      return { active: false, household, message: 'Membership expired' };
    }
    return { active: true, household, message: 'Active CBHI member' };
  }

  // ── Members ────────────────────────────────────────────────────────────────
  async addMember(householdId: string, dto: Partial<CbhiHouseholdMember>): Promise<CbhiHouseholdMember> {
    const member = this.memberRepo.create({ ...dto, householdId });
    const saved = await this.memberRepo.save(member);
    const count = await this.memberRepo.count({ where: { householdId, memberStatus: 'active' } });
    await this.householdRepo.update(householdId, { memberCount: count });
    return saved;
  }

  // ── Contributions ──────────────────────────────────────────────────────────
  async recordContribution(dto: Partial<CbhiContribution>): Promise<CbhiContribution> {
    const saved = await this.contributionRepo.save(this.contributionRepo.create(dto));
    // Activate household if it was suspended and payment received
    const total = await this.getHouseholdContributionTotal(dto.householdId!);
    if (total > 0) await this.householdRepo.update(dto.householdId!, { membershipStatus: 'active' });
    return saved;
  }

  async getContributions(householdId: string): Promise<CbhiContribution[]> {
    return this.contributionRepo.find({ where: { householdId }, order: { paymentDate: 'DESC' } });
  }

  async getHouseholdContributionTotal(householdId: string): Promise<number> {
    const result = await this.contributionRepo
      .createQueryBuilder('c')
      .select('SUM(c.amount_paid)', 'total')
      .where('c.household_id = :householdId', { householdId })
      .andWhere('c.payment_status = :status', { status: 'confirmed' })
      .getRawOne();
    return parseFloat(result?.total ?? '0');
  }

  // ── Claims ─────────────────────────────────────────────────────────────────
  async submitClaim(dto: Partial<CbhiClaim>): Promise<CbhiClaim> {
    const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const saved = await this.claimRepo.save(
      this.claimRepo.create({ ...dto, claimNumber, submittedAt: new Date() }),
    );

    // Auto-adjudicate via CDSS
    try {
      const cdssResult = await this.cdssService.callGovernedJson('/cdss/cbhi/claim-adjudication', {
        claim_number: claimNumber,
        scheme_id: saved.schemeId,
        principal_diagnosis_icd: saved.principalDiagnosisIcd,
        secondary_diagnoses: saved.secondaryDiagnoses,
        procedures: saved.procedures,
        total_billed: saved.totalBilled,
        claimed_amount: saved.claimedAmount,
        length_of_stay_days: null,
        patient_age_years: 30,
        similar_claims_last_90_days: 0,
        procedure_count: (saved.procedures as object[]).length,
      });
      if (cdssResult && !cdssResult.abstained) {
        const r = cdssResult.result;
        await this.claimRepo.update(saved.id, {
          cdssFraudScore: r.fraud_score,
          cdssApprovalRecommendation: r.approval_recommendation,
          cdssConfidence: cdssResult.confidence,
          cdssFlags: r.flags ?? [],
          claimStatus: r.approval_recommendation === 'approve' ? 'approved' : 'under_review',
          approvedAmount: r.recommended_approved_amount,
        });
      }
    } catch {
      // Non-blocking
    }

    return this.claimRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async getClaims(filters?: { schemeId?: string; status?: string }): Promise<CbhiClaim[]> {
    const qb = this.claimRepo.createQueryBuilder('c').orderBy('c.submitted_at', 'DESC');
    if (filters?.schemeId) qb.andWhere('c.scheme_id = :s', { s: filters.schemeId });
    if (filters?.status) qb.andWhere('c.claim_status = :st', { st: filters.status });
    return qb.getMany();
  }

  async adjudicateClaim(id: string, decision: { status: string; approvedAmount: number; rejectionReason?: string; reviewedBy: string }): Promise<CbhiClaim> {
    await this.claimRepo.update(id, {
      claimStatus: decision.status,
      approvedAmount: decision.approvedAmount,
      rejectionReason: decision.rejectionReason,
      reviewedBy: decision.reviewedBy,
      reviewedAt: new Date(),
    });
    return this.claimRepo.findOneOrFail({ where: { id } });
  }

  async getCbhiSummary(schemeId: string): Promise<object> {
    const [households, activeHouseholds, indigent, claims, pendingClaims] = await Promise.all([
      this.householdRepo.count({ where: { schemeId } }),
      this.householdRepo.count({ where: { schemeId, membershipStatus: 'active' } }),
      this.householdRepo.count({ where: { schemeId, indigentStatus: true } }),
      this.claimRepo.count({ where: { schemeId } }),
      this.claimRepo.count({ where: { schemeId, claimStatus: 'submitted' } }),
    ]);
    return { households, activeHouseholds, indigent, claims, pendingClaims };
  }
}
```

---

## 6. NestJS Controller

**File: `services/ehr-service/src/cbhi/cbhi.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CbhiService } from './cbhi.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('cbhi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CbhiController {
  constructor(private readonly cbhiService: CbhiService) {}

  @Post('households') @Roles('admin', 'billing', 'receptionist')
  registerHousehold(@Body() dto: any) { return this.cbhiService.registerHousehold(dto); }

  @Get('households') @Roles('admin', 'billing', 'receptionist', 'doctor', 'nurse')
  getHouseholds(@Query('schemeId') schemeId?: string) { return this.cbhiService.getHouseholds(schemeId); }

  @Get('households/:id') @Roles('admin', 'billing', 'receptionist', 'doctor', 'nurse')
  getHousehold(@Param('id') id: string) { return this.cbhiService.getHousehold(id); }

  @Patch('households/:id') @Roles('admin', 'billing')
  updateHousehold(@Param('id') id: string, @Body() dto: any) { return this.cbhiService.updateHousehold(id, dto); }

  @Get('verify/:patientId') @Roles('admin', 'billing', 'receptionist', 'doctor', 'nurse')
  verifyMembership(@Param('patientId') patientId: string) { return this.cbhiService.verifyMembership(patientId); }

  @Post('households/:id/members') @Roles('admin', 'billing', 'receptionist')
  addMember(@Param('id') id: string, @Body() dto: any) { return this.cbhiService.addMember(id, dto); }

  @Post('contributions') @Roles('admin', 'billing', 'receptionist')
  recordContribution(@Body() dto: any) { return this.cbhiService.recordContribution(dto); }

  @Get('contributions/:householdId') @Roles('admin', 'billing', 'receptionist')
  getContributions(@Param('householdId') householdId: string) { return this.cbhiService.getContributions(householdId); }

  @Post('claims') @Roles('admin', 'billing', 'doctor')
  submitClaim(@Body() dto: any) { return this.cbhiService.submitClaim(dto); }

  @Get('claims') @Roles('admin', 'billing', 'doctor')
  getClaims(@Query('schemeId') schemeId?: string, @Query('status') status?: string) {
    return this.cbhiService.getClaims({ schemeId, status });
  }

  @Patch('claims/:id/adjudicate') @Roles('admin', 'billing')
  adjudicateClaim(@Param('id') id: string, @Body() dto: any) { return this.cbhiService.adjudicateClaim(id, dto); }

  @Get('summary/:schemeId') @Roles('admin', 'billing', 'public_health')
  summary(@Param('schemeId') schemeId: string) { return this.cbhiService.getCbhiSummary(schemeId); }
}
```

### Module + `ehr.module.ts`

**File: `services/ehr-service/src/cbhi/cbhi.module.ts`** — standard pattern with `TypeOrmModule.forFeature([CbhiHousehold, CbhiHouseholdMember, CbhiContribution, CbhiClaim])` and `CdssModule`.

In `ehr.module.ts`: `import { CbhiModule } from './cbhi/cbhi.module';` and add to imports.

---

## 7. Frontend

### API in `ehr-frontend/src/services/api.ts`

```typescript
export const cbhiApi = {
  registerHousehold: (d: any) => api.post('/cbhi/households', d),
  getHouseholds: (schemeId?: string) => api.get('/cbhi/households', { params: { schemeId } }),
  getHousehold: (id: string) => api.get(`/cbhi/households/${id}`),
  updateHousehold: (id: string, d: any) => api.patch(`/cbhi/households/${id}`, d),
  verifyMembership: (patientId: string) => api.get(`/cbhi/verify/${patientId}`),
  addMember: (householdId: string, d: any) => api.post(`/cbhi/households/${householdId}/members`, d),
  recordContribution: (d: any) => api.post('/cbhi/contributions', d),
  getContributions: (householdId: string) => api.get(`/cbhi/contributions/${householdId}`),
  submitClaim: (d: any) => api.post('/cbhi/claims', d),
  getClaims: (params?: any) => api.get('/cbhi/claims', { params }),
  adjudicateClaim: (id: string, d: any) => api.patch(`/cbhi/claims/${id}/adjudicate`, d),
  getCbhiSummary: (schemeId: string) => api.get(`/cbhi/summary/${schemeId}`),
};
```

### Component Spec — `CbhiDashboard.tsx`

Four tabs:

1. **Household Registry** — Search by household ID or patient. Registration form. Shows: membership status badge (green/red/amber), indigent flag, waiver details, member list. "Verify Membership" lookup at point of care returns green/red banner.

2. **Contributions** — Contribution recording form (amount, method, period). Contribution history table with payment status. Household balance summary.

3. **Claims** — Submit claim form (diagnosis ICD selector, procedures list, amount). After submit: CDSS auto-adjudication result panel showing fraud score (0-1 progress bar), flags list, recommended approval amount, review priority. Adjudicator can override and finalize decision.

4. **Summary** — Scheme-level stats: enrolled households, active %, indigent %, pending claims, flagged claims count.

Wire into billing section of admin dashboard.

---

## 8. Post-Implementation Steps

```bash
docker compose build tenant-service
./scripts/provision-repair-all.sh
# Fallback: curl -X POST http://localhost:3001/admin/tenants/repair-all -H "Authorization: Bearer <token>"

psql $DATABASE_URL -c "\d cbhi_households"
psql $DATABASE_URL -c "\d cbhi_household_members"
psql $DATABASE_URL -c "\d cbhi_contributions"
psql $DATABASE_URL -c "\d cbhi_claims"

npx tsc --noEmit

curl -X POST http://localhost:8000/cdss/cbhi/claim-adjudication \
  -H "Content-Type: application/json" \
  -d '{"claim_number":"CLM-TEST-001","scheme_id":"ZKHA_LUSAKA_2024","principal_diagnosis_icd":"J18.9","secondary_diagnoses":[],"procedures":[{"code":"99213","description":"Office Visit","quantity":1,"unit_cost":45}],"total_billed":45,"claimed_amount":45,"length_of_stay_days":0,"patient_age_years":35,"similar_claims_last_90_days":0,"procedure_count":1}'

npm run lint

git add services/tenant-service/src/generated/tenant-cbhi-deep-module.statements.ts \
        services/ehr-service/src/cbhi/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/CbhiDashboard.tsx
git commit -m "feat: implement Sprint 154 — CBHI deep module with contributions, exemptions, claims AI"
```

---

## 9. Done-When Checklist

- [ ] `tenant-cbhi-deep-module.statements.ts` with idempotent SQL for 4 tables
- [ ] Bundle registered in `database-provisioning.service.ts`
- [ ] `CbhiHousehold`, `CbhiHouseholdMember`, `CbhiContribution`, `CbhiClaim` TypeORM entities
- [ ] All 4 entities in `tenant.service.ts`
- [ ] `CbhiModule` created and in `ehr.module.ts`
- [ ] `CbhiService` with all methods including `verifyMembership()` point-of-care check
- [ ] `CbhiController` with 12 routes
- [ ] CDSS `POST /cdss/cbhi/claim-adjudication` — fraud scoring + flags + recommended amount
- [ ] Claims auto-adjudicated on submission; CDSS result stored on claim record
- [ ] `cbhiApi` in `api.ts`
- [ ] `CbhiDashboard.tsx` — 4 tabs with CDSS fraud panel
- [ ] `provision-repair-all.sh` clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 154 — CBHI deep module with contributions, exemptions, claims AI`
