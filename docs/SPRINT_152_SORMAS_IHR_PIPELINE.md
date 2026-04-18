# Sprint 152 — SORMAS Bridge & IHR Alert Pipeline

**Sprint**: S152  
**Module**: SORMAS Integration, WHO IHR 2005 Notification Pipeline, Event-Based Surveillance  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint152_sormas_ihr_pipeline`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

SORMAS (Surveillance Outbreak Response Management and Analysis System) is the WHO/Helmholtz-recommended EBS platform used across Nigeria, DRC, Ghana, Cameroon, Senegal, and increasingly Southern Africa following AFRO adoption agreements. MediCore can detect outbreak-relevant cases (VHF, plague, meningitis) but cannot push them to national SORMAS instances or generate IHR Annex 2 PHEIC assessments. This sprint closes the surveillance loop.

| Gap | Impact |
|---|---|
| No SORMAS case export | Cases sit siloed in MediCore; national surveillance blind to facility-level detections |
| No IHR Annex 2 algorithm | Staff cannot determine whether an event meets PHEIC notification criteria |
| No sync audit trail | No evidence of timely reporting for WHO accreditation or IDSR compliance |
| No event-based surveillance log | Rumours, media alerts, community reports go unrecorded |

### What already exists (do NOT recreate)

- `VhfCase`, `PlagueCase`, `YellowFeverCase`, `MeningitisCase` entities from S150/S151
- `CdssService` with `callGovernedJson()` and `requestWithPolicy()`
- HTTP client utility — use NestJS `HttpModule` / `HttpService`
- `ehr.module.ts`, `tenant.service.ts`, `database-provisioning.service.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-sormas-ihr-pipeline.statements.ts`**

```typescript
export const TENANT_SORMAS_IHR_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_SORMAS_IHR_STATEMENTS: string[] = [

  // ── SORMAS Sync Log ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sormas_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Source case reference
    source_table TEXT NOT NULL,          -- 'vhf_cases' | 'plague_cases' | 'yellow_fever_cases' | 'meningitis_cases'
    local_case_id UUID NOT NULL,
    -- SORMAS reference
    sormas_case_uuid TEXT,               -- assigned by SORMAS after successful push
    sormas_person_uuid TEXT,
    sormas_instance_url TEXT NOT NULL,   -- target SORMAS base URL for the tenant
    -- Disease mapped to SORMAS disease enum
    sormas_disease TEXT NOT NULL,        -- 'MONKEYPOX' | 'EVD' | 'PLAGUE' | 'YELLOW_FEVER' | 'CSM' | 'LASSA' | 'OTHER'
    -- Sync metadata
    sync_direction TEXT NOT NULL,        -- 'push' | 'pull'
    sync_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'success' | 'failed' | 'conflict'
    http_status_code INTEGER,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempted_at TIMESTAMP,
    last_synced_at TIMESTAMP,
    sormas_response JSONB DEFAULT '{}',  -- full SORMAS API response
    -- Audit
    created_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sormas_sync_local_case ON sormas_sync_log(local_case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sormas_sync_status ON sormas_sync_log(sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_sormas_sync_disease ON sormas_sync_log(sormas_disease)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uidx_sormas_sync_case_direction ON sormas_sync_log(local_case_id, sync_direction)`,

  // ── IHR Notifications ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ihr_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Event details
    event_type TEXT NOT NULL,            -- 'case' | 'cluster' | 'signal' | 'unusual_event'
    disease TEXT NOT NULL,
    disease_category TEXT,               -- 'iha' | 'polio' | 'sars' | 'smallpox' | 'ihd_annex2'
    case_count INTEGER NOT NULL DEFAULT 1,
    death_count INTEGER NOT NULL DEFAULT 0,
    -- Geography
    facility_name TEXT,
    district TEXT,
    province TEXT,
    affected_country TEXT NOT NULL,
    -- Assessment
    ihr_annex2_criteria_met JSONB DEFAULT '{}',  -- {unusual_unexpected: bool, significant_public_health_impact: bool, significant_spread: bool, travel_trade_restriction: bool}
    pheic_relevant BOOLEAN NOT NULL DEFAULT false,
    -- IHR Annex 2 CDSS result
    cdss_annex2_assessment JSONB DEFAULT '{}',
    cdss_confidence DECIMAL(4,3),
    -- Source cases
    source_case_ids JSONB DEFAULT '[]',  -- [uuid, ...]
    local_case_ref TEXT,
    -- Notification tracking
    notification_date TIMESTAMP NOT NULL DEFAULT NOW(),
    notified_nfp BOOLEAN NOT NULL DEFAULT false,         -- National Focal Point
    nfp_notified_at TIMESTAMP,
    nfp_contact_name TEXT,
    notified_who_afro BOOLEAN NOT NULL DEFAULT false,
    who_afro_notified_at TIMESTAMP,
    who_event_id TEXT,                   -- assigned by WHO after acknowledgement
    who_acknowledgement JSONB DEFAULT '{}',
    -- Submission
    submitted_by UUID,
    submitted_at TIMESTAMP,
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ihr_notifications_disease ON ihr_notifications(disease)`,
  `CREATE INDEX IF NOT EXISTS idx_ihr_notifications_pheic ON ihr_notifications(pheic_relevant)`,
  `CREATE INDEX IF NOT EXISTS idx_ihr_notifications_date ON ihr_notifications(notification_date)`,
  `CREATE INDEX IF NOT EXISTS idx_ihr_notifications_status ON ihr_notifications(notified_nfp, notified_who_afro)`,

  // ── Event-Based Surveillance Signals ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ebs_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Signal source
    signal_source TEXT NOT NULL,         -- 'community_report' | 'media' | 'chw' | 'lab' | 'clinical' | 'social_media'
    signal_type TEXT NOT NULL,           -- 'disease_cluster' | 'unusual_death' | 'rumour' | 'laboratory_alert' | 'outbreak_alert'
    disease_suspected TEXT,
    -- Location
    district TEXT,
    village_area TEXT,
    -- Description
    description TEXT NOT NULL,
    raw_source_text TEXT,                -- original report or media extract
    -- Triage
    triage_status TEXT NOT NULL DEFAULT 'unverified',  -- 'unverified' | 'under_investigation' | 'verified_event' | 'discarded'
    triage_by UUID,
    triage_at TIMESTAMP,
    -- CDSS risk assessment
    cdss_risk_level TEXT,                -- 'low' | 'moderate' | 'high' | 'critical'
    cdss_recommended_action TEXT,
    cdss_confidence DECIMAL(4,3),
    -- Investigation
    investigation_started_at TIMESTAMP,
    investigation_outcome TEXT,
    linked_ihr_notification_id UUID REFERENCES ihr_notifications(id),
    -- Audit
    reported_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ebs_signals_status ON ebs_signals(triage_status)`,
  `CREATE INDEX IF NOT EXISTS idx_ebs_signals_source ON ebs_signals(signal_source)`,
  `CREATE INDEX IF NOT EXISTS idx_ebs_signals_date ON ebs_signals(created_at)`,

];
```

### 2b. Register Bundle in `database-provisioning.service.ts`

```typescript
import {
  TENANT_SORMAS_IHR_BUNDLE_VERSION,
  TENANT_SORMAS_IHR_STATEMENTS,
} from './generated/tenant-sormas-ihr-pipeline.statements';

{
  id: 'sprint152_sormas_ihr_pipeline',
  label: 'Sprint 152 — SORMAS Bridge + IHR Alert Pipeline',
  version: TENANT_SORMAS_IHR_BUNDLE_VERSION,
  description: 'Creates sormas_sync_log, ihr_notifications, ebs_signals tables',
  statements: TENANT_SORMAS_IHR_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/surveillance/entities/sormas-sync-log.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'sormas_sync_log' })
export class SormasSyncLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'source_table' }) sourceTable: string;
  @Column({ name: 'local_case_id' }) localCaseId: string;
  @Column({ name: 'sormas_case_uuid', nullable: true }) sormasCaseUuid: string;
  @Column({ name: 'sormas_person_uuid', nullable: true }) sormasPersonUuid: string;
  @Column({ name: 'sormas_instance_url' }) sormasInstanceUrl: string;
  @Column({ name: 'sormas_disease' }) sormasDisease: string;
  @Column({ name: 'sync_direction' }) syncDirection: string;
  @Column({ name: 'sync_status', default: 'pending' }) syncStatus: string;
  @Column({ name: 'http_status_code', nullable: true }) httpStatusCode: number;
  @Column({ name: 'error_message', nullable: true }) errorMessage: string;
  @Column({ name: 'retry_count', default: 0 }) retryCount: number;
  @Column({ name: 'last_attempted_at', type: 'timestamp', nullable: true }) lastAttemptedAt: Date;
  @Column({ name: 'last_synced_at', type: 'timestamp', nullable: true }) lastSyncedAt: Date;
  @Column({ name: 'sormas_response', type: 'jsonb', default: {} }) sormasResponse: object;
  @Column({ name: 'created_by', nullable: true }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/surveillance/entities/ihr-notification.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ihr_notifications' })
export class IhrNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'event_type' }) eventType: string;
  @Column({ name: 'disease' }) disease: string;
  @Column({ name: 'disease_category', nullable: true }) diseaseCategory: string;
  @Column({ name: 'case_count', default: 1 }) caseCount: number;
  @Column({ name: 'death_count', default: 0 }) deathCount: number;
  @Column({ name: 'facility_name', nullable: true }) facilityName: string;
  @Column({ name: 'district', nullable: true }) district: string;
  @Column({ name: 'province', nullable: true }) province: string;
  @Column({ name: 'affected_country' }) affectedCountry: string;
  @Column({ name: 'ihr_annex2_criteria_met', type: 'jsonb', default: {} }) ihrAnnex2CriteriaMet: object;
  @Column({ name: 'pheic_relevant', default: false }) pheicRelevant: boolean;
  @Column({ name: 'cdss_annex2_assessment', type: 'jsonb', default: {} }) cdssAnnex2Assessment: object;
  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number;
  @Column({ name: 'source_case_ids', type: 'jsonb', default: [] }) sourceCaseIds: string[];
  @Column({ name: 'local_case_ref', nullable: true }) localCaseRef: string;
  @Column({ name: 'notification_date', type: 'timestamp' }) notificationDate: Date;
  @Column({ name: 'notified_nfp', default: false }) notifiedNfp: boolean;
  @Column({ name: 'nfp_notified_at', type: 'timestamp', nullable: true }) nfpNotifiedAt: Date;
  @Column({ name: 'nfp_contact_name', nullable: true }) nfpContactName: string;
  @Column({ name: 'notified_who_afro', default: false }) notifiedWhoAfro: boolean;
  @Column({ name: 'who_afro_notified_at', type: 'timestamp', nullable: true }) whoAfroNotifiedAt: Date;
  @Column({ name: 'who_event_id', nullable: true }) whoEventId: string;
  @Column({ name: 'who_acknowledgement', type: 'jsonb', default: {} }) whoAcknowledgement: object;
  @Column({ name: 'submitted_by', nullable: true }) submittedBy: string;
  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true }) submittedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

**File: `services/ehr-service/src/surveillance/entities/ebs-signal.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ebs_signals' })
export class EbsSignal {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'signal_source' }) signalSource: string;
  @Column({ name: 'signal_type' }) signalType: string;
  @Column({ name: 'disease_suspected', nullable: true }) diseaseSuspected: string;
  @Column({ name: 'district', nullable: true }) district: string;
  @Column({ name: 'village_area', nullable: true }) villageArea: string;
  @Column({ name: 'description' }) description: string;
  @Column({ name: 'raw_source_text', nullable: true }) rawSourceText: string;
  @Column({ name: 'triage_status', default: 'unverified' }) triageStatus: string;
  @Column({ name: 'triage_by', nullable: true }) triageBy: string;
  @Column({ name: 'triage_at', type: 'timestamp', nullable: true }) triageAt: Date;
  @Column({ name: 'cdss_risk_level', nullable: true }) cdssRiskLevel: string;
  @Column({ name: 'cdss_recommended_action', nullable: true }) cdssRecommendedAction: string;
  @Column({ name: 'cdss_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true }) cdssConfidence: number;
  @Column({ name: 'investigation_started_at', type: 'timestamp', nullable: true }) investigationStartedAt: Date;
  @Column({ name: 'investigation_outcome', nullable: true }) investigationOutcome: string;
  @Column({ name: 'linked_ihr_notification_id', nullable: true }) linkedIhrNotificationId: string;
  @Column({ name: 'reported_by', nullable: true }) reportedBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
```

### 3a. Register entities in `tenant.service.ts`

```typescript
import { SormasSyncLog } from '../ehr/surveillance/entities/sormas-sync-log.entity';
import { IhrNotification } from '../ehr/surveillance/entities/ihr-notification.entity';
import { EbsSignal } from '../ehr/surveillance/entities/ebs-signal.entity';

// Add to entities array:
SormasSyncLog,
IhrNotification,
EbsSignal,
```

---

## 4. CDSS Python Endpoints

Add to `services/cdss-service/main.py`:

```python
class IhrAnnex2Request(BaseModel):
    disease: str
    is_pheic_listed: bool               # smallpox, polio, SARS, COVID → always PHEIC
    case_count: int
    death_count: int
    unusual_or_unexpected: bool         # unusual presentation, unusual agent, unexpected location
    significant_public_health_impact: bool  # severity, transmissibility, political/social/economic
    significant_international_spread: bool  # cross-border movement, travel-linked cases
    trade_travel_restriction_risk: bool
    affected_country: str
    days_since_first_case: int
    healthcare_workers_affected: bool
    laboratory_confirmed: bool

class IhrAnnex2Response(BaseModel):
    pheic_notification_required: bool
    notification_urgency: str           # 'immediate_24h' | 'within_48h' | 'routine_weekly' | 'not_required'
    annex2_criteria_met: List[str]
    annex2_decision_path: str
    nfp_notification_required: bool
    recommended_actions: List[str]
    reporting_template: str             # text template for WHO notification
    confidence: float
    citations: List[str]

class EbsTriageRequest(BaseModel):
    signal_source: str
    signal_type: str
    disease_suspected: Optional[str]
    case_count: Optional[int]
    death_count: Optional[int]
    description: str
    district: str
    days_since_signal: int
    similar_signals_last_30_days: int

class EbsTriageResponse(BaseModel):
    risk_level: str                     # 'low' | 'moderate' | 'high' | 'critical'
    verification_priority: str          # 'immediate' | 'within_24h' | 'within_72h' | 'routine'
    investigation_required: bool
    recommended_action: str
    ihr_assessment_required: bool
    sormas_report_required: bool
    confidence: float

@app.post("/cdss/surveillance/ihr-annex2", response_model=IhrAnnex2Response)
async def ihr_annex2_assessment(req: IhrAnnex2Request):
    """
    IHR 2005 Annex 2 decision algorithm — determines whether an event is a PHEIC.
    Four criteria decision tree: unusual/unexpected + public health impact + international spread + trade/travel risk.
    If any 2 criteria met AND disease is not category A → NFP notification; if PHEIC-listed disease confirmed → immediate.
    """
    prompt = f"""
    You are a WHO IHR 2005 expert trained on IHR Annex 2 decision instrument.

    Event:
    - Disease: {req.disease}
    - PHEIC-listed disease: {req.is_pheic_listed} (smallpox, polio wild, SARS, SARS-CoV-2 of concern = automatic PHEIC)
    - Cases: {req.case_count}, Deaths: {req.death_count}, Days since first case: {req.days_since_first_case}
    - Country: {req.affected_country}
    - Annex 2 Criteria:
      A. Unusual/unexpected: {req.unusual_or_unexpected}
      B. Significant public health impact: {req.significant_public_health_impact}
      C. International spread risk: {req.significant_international_spread}
      D. Trade/travel restriction risk: {req.trade_travel_restriction_risk}
    - Healthcare workers affected: {req.healthcare_workers_affected}
    - Lab confirmed: {req.laboratory_confirmed}

    Apply IHR Annex 2 Algorithm:
    Step 1: If PHEIC-listed disease → notify NFP immediately regardless
    Step 2: Score criteria A+B+C+D — if 2+ criteria met → notify NFP within 24h
    Step 3: NFP assesses within 48h and notifies WHO if PHEIC likely
    Step 4: Generate notification text per IHR Art. 7 template (disease, location, cases, deaths, measures taken)

    Return JSON: pheic_notification_required, notification_urgency, annex2_criteria_met (list of criteria names),
    annex2_decision_path (string explanation), nfp_notification_required, recommended_actions (list),
    reporting_template (string — fill-in-the-blank notification text), confidence (0-1), citations (list).
    """
    result = await call_governed_json(prompt, surface="ihr_annex2_assessment", phi_present=False)
    return result

@app.post("/cdss/surveillance/ebs-triage", response_model=EbsTriageResponse)
async def ebs_signal_triage(req: EbsTriageRequest):
    """
    Event-Based Surveillance signal triage — risk-stratify unverified signals.
    Based on WHO EBS Operational Guidelines 2014 and Africa CDC EBS Handbook 2020.
    """
    prompt = f"""
    You are a surveillance epidemiologist using WHO EBS Operational Guidelines 2014 and Africa CDC EBS Handbook 2020.

    Signal:
    - Source: {req.signal_source}, Type: {req.signal_type}
    - Disease suspected: {req.disease_suspected}
    - Cases: {req.case_count}, Deaths: {req.death_count}
    - Description: {req.description}
    - District: {req.district}
    - Days since signal: {req.days_since_signal}
    - Similar signals last 30 days: {req.similar_signals_last_30_days}

    Triage this signal:
    1. Risk level (critical = potential PHEIC disease or cluster deaths; high = unusual disease pattern; moderate = single case notifiable disease; low = endemic disease, expected presentation)
    2. Verification priority (immediate field investigation vs. phone verification vs. routine)
    3. Whether IHR Annex 2 assessment is warranted
    4. Whether SORMAS case creation is required

    Return JSON: risk_level, verification_priority, investigation_required, recommended_action,
    ihr_assessment_required, sormas_report_required, confidence (0-1).
    """
    result = await call_governed_json(prompt, surface="ebs_signal_triage", phi_present=False)
    return result
```

---

## 5. NestJS Service

**File: `services/ehr-service/src/surveillance/surveillance.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SormasSyncLog } from './entities/sormas-sync-log.entity';
import { IhrNotification } from './entities/ihr-notification.entity';
import { EbsSignal } from './entities/ebs-signal.entity';
import { CdssService } from '../cdss/cdss.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SurveillanceService {
  private readonly logger = new Logger(SurveillanceService.name);

  constructor(
    @InjectRepository(SormasSyncLog) private sormasLogRepo: Repository<SormasSyncLog>,
    @InjectRepository(IhrNotification) private ihrRepo: Repository<IhrNotification>,
    @InjectRepository(EbsSignal) private ebsRepo: Repository<EbsSignal>,
    private cdssService: CdssService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  // ── SORMAS ─────────────────────────────────────────────────────────────────
  async pushCaseToSormas(
    localCaseId: string,
    sourceTable: string,
    casePayload: object,
    sormasDisease: string,
  ): Promise<SormasSyncLog> {
    const sormasUrl = this.configService.get<string>('SORMAS_BASE_URL', '');
    const sormasToken = this.configService.get<string>('SORMAS_API_TOKEN', '');

    const log = await this.sormasLogRepo.save(
      this.sormasLogRepo.create({
        sourceTable,
        localCaseId,
        sormasInstanceUrl: sormasUrl,
        sormasDisease,
        syncDirection: 'push',
        syncStatus: 'pending',
        lastAttemptedAt: new Date(),
      }),
    );

    if (!sormasUrl || !sormasToken) {
      await this.sormasLogRepo.update(log.id, {
        syncStatus: 'failed',
        errorMessage: 'SORMAS_BASE_URL or SORMAS_API_TOKEN not configured',
      });
      return this.sormasLogRepo.findOneOrFail({ where: { id: log.id } });
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${sormasUrl}/api/cases/push`, casePayload, {
          headers: { Authorization: `Bearer ${sormasToken}`, 'Content-Type': 'application/json' },
          timeout: 10000,
        }),
      );
      await this.sormasLogRepo.update(log.id, {
        syncStatus: 'success',
        httpStatusCode: response.status,
        sormasCaseUuid: response.data?.caseUuid,
        sormasPersonUuid: response.data?.personUuid,
        sormasResponse: response.data,
        lastSyncedAt: new Date(),
      });
    } catch (err: any) {
      await this.sormasLogRepo.update(log.id, {
        syncStatus: 'failed',
        httpStatusCode: err?.response?.status,
        errorMessage: err?.message,
        retryCount: log.retryCount + 1,
      });
    }

    return this.sormasLogRepo.findOneOrFail({ where: { id: log.id } });
  }

  async getSormasSyncStatus(localCaseId: string): Promise<SormasSyncLog[]> {
    return this.sormasLogRepo.find({ where: { localCaseId }, order: { createdAt: 'DESC' } });
  }

  async retrySormasSync(logId: string): Promise<SormasSyncLog> {
    const log = await this.sormasLogRepo.findOneOrFail({ where: { id: logId } });
    // Re-attempt the push with original payload — caller must provide updated payload
    await this.sormasLogRepo.update(logId, { syncStatus: 'pending', retryCount: log.retryCount + 1, lastAttemptedAt: new Date() });
    return this.sormasLogRepo.findOneOrFail({ where: { id: logId } });
  }

  // ── IHR Notifications ──────────────────────────────────────────────────────
  async createIhrNotification(dto: Partial<IhrNotification>): Promise<IhrNotification> {
    const saved = await this.ihrRepo.save(this.ihrRepo.create({ ...dto, notificationDate: new Date() }));

    // CDSS Annex 2 assessment
    try {
      const cdssResult = await this.cdssService.callGovernedJson('/cdss/surveillance/ihr-annex2', {
        disease: saved.disease,
        is_pheic_listed: ['smallpox', 'polio', 'sars', 'ebola', 'marburg'].includes(saved.disease.toLowerCase()),
        case_count: saved.caseCount,
        death_count: saved.deathCount,
        unusual_or_unexpected: (saved.ihrAnnex2CriteriaMet as any)?.unusual_unexpected ?? false,
        significant_public_health_impact: (saved.ihrAnnex2CriteriaMet as any)?.significant_public_health_impact ?? false,
        significant_international_spread: (saved.ihrAnnex2CriteriaMet as any)?.significant_spread ?? false,
        trade_travel_restriction_risk: (saved.ihrAnnex2CriteriaMet as any)?.travel_trade_restriction ?? false,
        affected_country: saved.affectedCountry,
        days_since_first_case: 0,
        healthcare_workers_affected: false,
        laboratory_confirmed: false,
      });
      if (cdssResult && !cdssResult.abstained) {
        await this.ihrRepo.update(saved.id, {
          cdssAnnex2Assessment: cdssResult.result,
          cdssConfidence: cdssResult.confidence,
          pheicRelevant: cdssResult.result?.pheic_notification_required ?? false,
        });
      }
    } catch {
      this.logger.warn(`CDSS Annex 2 assessment failed for IHR notification ${saved.id}`);
    }

    return this.ihrRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async getIhrNotifications(): Promise<IhrNotification[]> {
    return this.ihrRepo.find({ order: { notificationDate: 'DESC' } });
  }

  async updateIhrNotification(id: string, dto: Partial<IhrNotification>): Promise<IhrNotification> {
    await this.ihrRepo.update(id, dto);
    return this.ihrRepo.findOneOrFail({ where: { id } });
  }

  async runIhrAnnex2Assessment(ihrId: string, criteria: object): Promise<object> {
    const notification = await this.ihrRepo.findOneOrFail({ where: { id: ihrId } });
    return this.cdssService.callGovernedJson('/cdss/surveillance/ihr-annex2', {
      disease: notification.disease,
      affected_country: notification.affectedCountry,
      case_count: notification.caseCount,
      death_count: notification.deathCount,
      ...criteria,
    });
  }

  // ── EBS Signals ───────────────────────────────────────────────────────────
  async reportEbsSignal(dto: Partial<EbsSignal>): Promise<EbsSignal> {
    const saved = await this.ebsRepo.save(this.ebsRepo.create(dto));

    // Auto-triage via CDSS
    try {
      const cdssResult = await this.cdssService.callGovernedJson('/cdss/surveillance/ebs-triage', {
        signal_source: saved.signalSource,
        signal_type: saved.signalType,
        disease_suspected: saved.diseaseSuspected ?? null,
        case_count: null,
        death_count: null,
        description: saved.description,
        district: saved.district ?? 'unknown',
        days_since_signal: 0,
        similar_signals_last_30_days: 0,
      });
      if (cdssResult && !cdssResult.abstained) {
        await this.ebsRepo.update(saved.id, {
          cdssRiskLevel: cdssResult.result?.risk_level,
          cdssRecommendedAction: cdssResult.result?.recommended_action,
          cdssConfidence: cdssResult.confidence,
        });
        saved.cdssRiskLevel = cdssResult.result?.risk_level;
      }
    } catch {
      this.logger.warn(`CDSS EBS triage failed for signal ${saved.id}`);
    }

    return saved;
  }

  async getEbsSignals(status?: string): Promise<EbsSignal[]> {
    const where = status ? { triageStatus: status } : {};
    return this.ebsRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async updateEbsSignal(id: string, dto: Partial<EbsSignal>): Promise<EbsSignal> {
    await this.ebsRepo.update(id, dto);
    return this.ebsRepo.findOneOrFail({ where: { id } });
  }

  async getSurveillanceSummary(): Promise<object> {
    const [totalSormas, failedSormas, totalIhr, pheicRelevant, totalEbs, unverifiedEbs] = await Promise.all([
      this.sormasLogRepo.count(),
      this.sormasLogRepo.count({ where: { syncStatus: 'failed' } }),
      this.ihrRepo.count(),
      this.ihrRepo.count({ where: { pheicRelevant: true } }),
      this.ebsRepo.count(),
      this.ebsRepo.count({ where: { triageStatus: 'unverified' } }),
    ]);
    return { sormas: { total: totalSormas, failed: failedSormas }, ihr: { total: totalIhr, pheicRelevant }, ebs: { total: totalEbs, unverified: unverifiedEbs } };
  }
}
```

---

## 6. NestJS Controller

**File: `services/ehr-service/src/surveillance/surveillance.controller.ts`**

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SurveillanceService } from './surveillance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('surveillance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SurveillanceController {
  constructor(private readonly surveillanceService: SurveillanceService) {}

  // SORMAS
  @Post('sormas/push') @Roles('admin', 'public_health')
  pushToSormas(@Body() dto: { localCaseId: string; sourceTable: string; casePayload: object; sormasDisease: string }) {
    return this.surveillanceService.pushCaseToSormas(dto.localCaseId, dto.sourceTable, dto.casePayload, dto.sormasDisease);
  }

  @Get('sormas/sync-status/:caseId') @Roles('admin', 'public_health', 'infection_control')
  getSyncStatus(@Param('caseId') caseId: string) {
    return this.surveillanceService.getSormasSyncStatus(caseId);
  }

  @Post('sormas/retry/:logId') @Roles('admin', 'public_health')
  retrySync(@Param('logId') logId: string) {
    return this.surveillanceService.retrySormasSync(logId);
  }

  // IHR
  @Post('ihr') @Roles('admin', 'public_health', 'infection_control')
  createIhr(@Body() dto: any) { return this.surveillanceService.createIhrNotification(dto); }

  @Get('ihr') @Roles('admin', 'public_health', 'infection_control', 'doctor')
  getIhr() { return this.surveillanceService.getIhrNotifications(); }

  @Patch('ihr/:id') @Roles('admin', 'public_health')
  updateIhr(@Param('id') id: string, @Body() dto: any) { return this.surveillanceService.updateIhrNotification(id, dto); }

  @Post('ihr/:id/annex2-assessment') @Roles('admin', 'public_health')
  runAnnex2(@Param('id') id: string, @Body() dto: any) { return this.surveillanceService.runIhrAnnex2Assessment(id, dto); }

  // EBS
  @Post('ebs') @Roles('admin', 'public_health', 'nurse', 'doctor', 'infection_control')
  reportSignal(@Body() dto: any) { return this.surveillanceService.reportEbsSignal(dto); }

  @Get('ebs') @Roles('admin', 'public_health', 'nurse', 'doctor', 'infection_control')
  getSignals(@Query('status') status?: string) { return this.surveillanceService.getEbsSignals(status); }

  @Patch('ebs/:id') @Roles('admin', 'public_health', 'infection_control')
  updateSignal(@Param('id') id: string, @Body() dto: any) { return this.surveillanceService.updateEbsSignal(id, dto); }

  @Get('summary') @Roles('admin', 'public_health', 'infection_control', 'doctor')
  summary() { return this.surveillanceService.getSurveillanceSummary(); }
}
```

### 6a. Module + `ehr.module.ts`

**File: `services/ehr-service/src/surveillance/surveillance.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SormasSyncLog } from './entities/sormas-sync-log.entity';
import { IhrNotification } from './entities/ihr-notification.entity';
import { EbsSignal } from './entities/ebs-signal.entity';
import { SurveillanceService } from './surveillance.service';
import { SurveillanceController } from './surveillance.controller';
import { CdssModule } from '../cdss/cdss.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SormasSyncLog, IhrNotification, EbsSignal]),
    HttpModule,
    CdssModule,
  ],
  providers: [SurveillanceService],
  controllers: [SurveillanceController],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
```

In `ehr.module.ts`:
```typescript
import { SurveillanceModule } from './surveillance/surveillance.module';
// Add to @Module imports: SurveillanceModule
```

---

## 7. Environment Variables

Add to `.env` (and `.env.example`) for each facility deployment:

```bash
# SORMAS Integration (Sprint 152)
SORMAS_BASE_URL=https://sormas.your-country-moh.gov
SORMAS_API_TOKEN=your-sormas-bearer-token
```

The system gracefully degrades if not configured (logs a `failed` sync with descriptive error).

---

## 8. Frontend

### 8a. API in `ehr-frontend/src/services/api.ts`

```typescript
export const surveillanceApi = {
  // SORMAS
  pushToSormas: (data: any) => api.post('/surveillance/sormas/push', data),
  getSormasSyncStatus: (caseId: string) => api.get(`/surveillance/sormas/sync-status/${caseId}`),
  retrySormasSync: (logId: string) => api.post(`/surveillance/sormas/retry/${logId}`),
  // IHR
  createIhr: (data: any) => api.post('/surveillance/ihr', data),
  getIhrNotifications: () => api.get('/surveillance/ihr'),
  updateIhr: (id: string, data: any) => api.patch(`/surveillance/ihr/${id}`, data),
  runAnnex2Assessment: (id: string, data: any) => api.post(`/surveillance/ihr/${id}/annex2-assessment`, data),
  // EBS
  reportEbsSignal: (data: any) => api.post('/surveillance/ebs', data),
  getEbsSignals: (status?: string) => api.get('/surveillance/ebs', { params: { status } }),
  updateEbsSignal: (id: string, data: any) => api.patch(`/surveillance/ebs/${id}`, data),
  // Summary
  getSurveillanceSummary: () => api.get('/surveillance/summary'),
};
```

### 8b. Frontend Component Spec

**File: `ehr-frontend/src/components/SurveillanceDashboard.tsx`**

Four tabs:

1. **EBS Signals** — Signal intake form (source, type, disease suspected, description, district). After submit, CDSS auto-triages and displays: risk level (colour-coded badge), recommended action, IHR assessment needed flag. Signal list with filter by status (unverified/under investigation/verified/discarded).

2. **IHR Notifications** — Form to create IHR notification (disease, case count, death count, Annex 2 criteria checkboxes). "Run CDSS Annex 2 Assessment" button shows: PHEIC required (yes/no), notification urgency, criteria met list, recommended actions, draft notification template text (pre-filled textarea ready to copy). Mark NFP / WHO AFRO notified with timestamp.

3. **SORMAS Sync** — List of sync log entries with status badges (success=green, failed=red, pending=yellow). Failed entries show error message + Retry button. For each VHF/plague/YF/meningitis case, show SORMAS sync status inline.

4. **Summary** — Cards: SORMAS failed syncs (red if >0), IHR PHEIC-relevant events, EBS unverified signals. System health indicator.

CDSS confidence always shown as `{(confidence * 100).toFixed(0)}% confidence`. Abstained = amber banner.

Wire into navigation alongside VHF Surveillance (`/surveillance`).

---

## 9. Post-Implementation Steps

```bash
# 1. Rebuild tenant-service
docker compose build tenant-service

# ⚠️  MANDATORY: Provision before startup
./scripts/provision-repair-all.sh
# Fallback:
curl -X POST http://localhost:3001/admin/tenants/repair-all \
  -H "Authorization: Bearer <admin-token>"

# 2. Verify tables
psql $DATABASE_URL -c "\d sormas_sync_log"
psql $DATABASE_URL -c "\d ihr_notifications"
psql $DATABASE_URL -c "\d ebs_signals"
# "Did not find any relation" = re-run provision.

# 3. TypeScript check
npx tsc --noEmit   # 0 errors required

# 4. Test CDSS
curl -X POST http://localhost:8000/cdss/surveillance/ihr-annex2 \
  -H "Content-Type: application/json" \
  -d '{"disease":"ebola","is_pheic_listed":true,"case_count":2,"death_count":1,"unusual_or_unexpected":true,"significant_public_health_impact":true,"significant_international_spread":false,"trade_travel_restriction_risk":false,"affected_country":"DRC","days_since_first_case":3,"healthcare_workers_affected":true,"laboratory_confirmed":true}'

curl -X POST http://localhost:8000/cdss/surveillance/ebs-triage \
  -H "Content-Type: application/json" \
  -d '{"signal_source":"community_report","signal_type":"unusual_death","disease_suspected":"ebola","case_count":3,"death_count":2,"description":"Three deaths in same village with bleeding","district":"Kivu","days_since_signal":1,"similar_signals_last_30_days":0}'

# 5. Lint
npm run lint   # 0 errors

# 6. Commit
git add services/tenant-service/src/generated/tenant-sormas-ihr-pipeline.statements.ts \
        services/ehr-service/src/surveillance/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/SurveillanceDashboard.tsx \
        .env.example
git commit -m "feat: implement Sprint 152 — SORMAS bridge and IHR alert pipeline"
```

---

## 10. Done-When Checklist

- [ ] `tenant-sormas-ihr-pipeline.statements.ts` with idempotent SQL for 3 tables
- [ ] Bundle registered in `database-provisioning.service.ts`
- [ ] `SormasSyncLog`, `IhrNotification`, `EbsSignal` TypeORM entities created
- [ ] All 3 entities in `tenant.service.ts` entities array
- [ ] `SurveillanceModule` (with `HttpModule`) created and imported in `ehr.module.ts`
- [ ] `SurveillanceService` with SORMAS push (graceful degradation if URL not configured), IHR create + Annex 2, EBS triage
- [ ] `SurveillanceController` with 12 routes
- [ ] CDSS `POST /cdss/surveillance/ihr-annex2` implementing IHR Annex 2 decision tree
- [ ] CDSS `POST /cdss/surveillance/ebs-triage` implementing EBS risk stratification
- [ ] All CDSS calls via `callGovernedJson()` — never direct HTTP
- [ ] `SORMAS_BASE_URL` + `SORMAS_API_TOKEN` documented in `.env.example`
- [ ] `surveillanceApi` in `ehr-frontend/src/services/api.ts`
- [ ] `SurveillanceDashboard.tsx` with 4 tabs: EBS Signals, IHR Notifications, SORMAS Sync, Summary
- [ ] CDSS confidence and abstention displayed correctly
- [ ] `provision-repair-all.sh` clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 152 — SORMAS bridge and IHR alert pipeline`
