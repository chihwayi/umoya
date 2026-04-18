# Sprint 157 — DISA VL Integration (Mozambique) & SmartCare (Zambia)

**Sprint**: S157  
**Module**: DISA Lab API Bridge, SmartCare Patient Record Sync, Cross-Border Patient Continuity  
**Bundle version**: `2026.04.17.1`  
**Bundle ID**: `sprint157_disa_smartcare_integration`  
**Prerequisite reading**: `MEDICORE_REFERENCE.md` — architecture, DB rules, CDSS call patterns.

---

## 1. Clinical Rationale

Two critical SADC country-specific integrations are missing:

| System | Country | Purpose | Gap |
|---|---|---|---|
| **DISA** (Data Integration, Sharing and Analytics) | Mozambique | National VL/EID lab result platform — receives all PCR results from NHLS-Mozambique and INS | No VL result pull, no EID result integration, no patient linkage to DISA |
| **SmartCare** (OpenMRS-derived) | Zambia | National HIV ART EMR — used in 1800+ Zambian facilities | No patient import, no ART history sync, no cross-border continuity for migrant patients |

Combined impact: Patients moving between Zambia and Mozambique (a common labour migration corridor) have no ART history continuity. HIV VL results from DISA never flow into MediCore. EID results in Mozambique are lost.

### What already exists (do NOT recreate)

- OpenMRS FHIR integration (`openmrs-fhir.controller.ts`, `openmrs-fhir.service.ts`) — SmartCare uses OpenMRS; REUSE this service as the base
- TIER.net integration from S135 — pattern reference for HIV programme integrations
- `PatientService`, `CdssService`, `HttpModule`
- `database-provisioning.service.ts`, `tenant.service.ts`, `ehr.module.ts`

---

## 2. Database Changes

### 2a. Provisioning Statements

**File: `services/tenant-service/src/generated/tenant-disa-smartcare.statements.ts`**

```typescript
export const TENANT_DISA_SMARTCARE_BUNDLE_VERSION = '2026.04.17.1';

export const TENANT_DISA_SMARTCARE_STATEMENTS: string[] = [

  // ── DISA Sync Log ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS disa_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,                     -- local patient (may be NULL if unmatched)
    disa_patient_id TEXT,                -- DISA internal patient identifier
    nid TEXT,                            -- Mozambique National ID (NID/NUIC)
    -- Sync details
    sync_type TEXT NOT NULL,             -- 'vl_result' | 'eid_result' | 'cd4_result'
    sync_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'success' | 'failed' | 'unmatched'
    -- Lab result data (populated on success)
    sample_id TEXT,
    sample_collection_date DATE,
    result_type TEXT,                    -- 'HIV_VL' | 'HIV_EID' | 'CD4'
    result_value TEXT,                   -- e.g. '< 40 copies/mL' | 'Detected' | 'Not detected'
    result_numeric DECIMAL(12,2),        -- numeric value for VL
    result_date DATE,
    suppressed BOOLEAN,                  -- VL < 1000 copies/mL
    -- Meta
    disa_facility_code TEXT,
    disa_province TEXT,
    error_message TEXT,
    synced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_disa_sync_patient ON disa_sync_log(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_disa_sync_nid ON disa_sync_log(nid)`,
  `CREATE INDEX IF NOT EXISTS idx_disa_sync_type ON disa_sync_log(sync_type)`,
  `CREATE INDEX IF NOT EXISTS idx_disa_sync_status ON disa_sync_log(sync_status)`,

  // ── SmartCare Patient Links ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS smartcare_patient_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_patient_id UUID NOT NULL,
    smartcare_patient_uuid TEXT NOT NULL UNIQUE,  -- SmartCare/OpenMRS patient UUID
    smartcare_art_number TEXT,           -- Zambia ART number
    zambia_national_id TEXT,
    last_sync_at TIMESTAMP,
    sync_status TEXT NOT NULL DEFAULT 'linked',  -- 'linked' | 'sync_failed' | 'unlinked'
    -- Imported data summary
    art_start_date DATE,
    last_regimen TEXT,
    last_cd4 INTEGER,
    last_vl DECIMAL(12,2),
    last_vl_date DATE,
    import_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_smartcare_links_patient ON smartcare_patient_links(local_patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_smartcare_links_uuid ON smartcare_patient_links(smartcare_patient_uuid)`,

  // ── Cross-Border Patient Flags ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cross_border_patient_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE,
    origin_country TEXT NOT NULL,        -- 'MZ' | 'ZM' | 'ZW' | other ISO 3166-1 alpha-2
    current_country TEXT NOT NULL,
    cross_border_reason TEXT,            -- 'labour_migration' | 'refugee' | 'seasonal' | 'other'
    foreign_art_number TEXT,
    foreign_facility TEXT,
    last_foreign_visit_date DATE,
    -- Data completeness
    art_history_imported BOOLEAN NOT NULL DEFAULT false,
    vl_history_imported BOOLEAN NOT NULL DEFAULT false,
    -- Flags
    continuity_gap_detected BOOLEAN NOT NULL DEFAULT false,
    continuity_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cross_border_patient ON cross_border_patient_flags(patient_id)`,

];
```

### 2b. Register Bundle

```typescript
import {
  TENANT_DISA_SMARTCARE_BUNDLE_VERSION,
  TENANT_DISA_SMARTCARE_STATEMENTS,
} from './generated/tenant-disa-smartcare.statements';

{
  id: 'sprint157_disa_smartcare_integration',
  label: 'Sprint 157 — DISA VL Integration + SmartCare Zambia',
  version: TENANT_DISA_SMARTCARE_BUNDLE_VERSION,
  description: 'Creates disa_sync_log, smartcare_patient_links, cross_border_patient_flags tables',
  statements: TENANT_DISA_SMARTCARE_STATEMENTS,
},
```

---

## 3. TypeORM Entities

**File: `services/ehr-service/src/interop/entities/disa-sync-log.entity.ts`**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'disa_sync_log' })
export class DisaSyncLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', nullable: true }) patientId: string;
  @Column({ name: 'disa_patient_id', nullable: true }) disaPatientId: string;
  @Column({ name: 'nid', nullable: true }) nid: string;
  @Column({ name: 'sync_type' }) syncType: string;
  @Column({ name: 'sync_status', default: 'pending' }) syncStatus: string;
  @Column({ name: 'sample_id', nullable: true }) sampleId: string;
  @Column({ name: 'sample_collection_date', type: 'date', nullable: true }) sampleCollectionDate: string;
  @Column({ name: 'result_type', nullable: true }) resultType: string;
  @Column({ name: 'result_value', nullable: true }) resultValue: string;
  @Column({ name: 'result_numeric', type: 'decimal', precision: 12, scale: 2, nullable: true }) resultNumeric: number;
  @Column({ name: 'result_date', type: 'date', nullable: true }) resultDate: string;
  @Column({ name: 'suppressed', nullable: true }) suppressed: boolean;
  @Column({ name: 'disa_facility_code', nullable: true }) disaFacilityCode: string;
  @Column({ name: 'disa_province', nullable: true }) disaProvince: string;
  @Column({ name: 'error_message', nullable: true }) errorMessage: string;
  @Column({ name: 'synced_at', type: 'timestamp', nullable: true }) syncedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

**File: `services/ehr-service/src/interop/entities/smartcare-patient-link.entity.ts`** — mirror `smartcare_patient_links` columns.

**File: `services/ehr-service/src/interop/entities/cross-border-patient-flag.entity.ts`** — mirror `cross_border_patient_flags` columns.

Register all 3 in `tenant.service.ts`.

---

## 4. CDSS Python Endpoint

```python
class CrossBorderContinuityRequest(BaseModel):
    origin_country: str
    current_country: str
    art_start_date_imported: Optional[str]
    last_regimen_imported: Optional[str]
    last_vl_imported: Optional[float]
    last_vl_date_imported: Optional[str]
    days_since_last_foreign_visit: int
    current_vl: Optional[float]
    current_cd4: Optional[int]
    current_regimen: Optional[str]
    patient_disclosed_foreign_treatment: bool

class CrossBorderContinuityResponse(BaseModel):
    continuity_gap_detected: bool
    gap_severity: str                    # 'none' | 'low' | 'moderate' | 'high'
    gap_explanation: str
    recommended_actions: List[str]       # ['order_VL', 'switch_regimen_review', 'adherence_counselling']
    estimated_days_off_art: Optional[int]
    resistance_risk: str                 # 'low' | 'moderate' | 'high'
    confidence: float

@app.post("/cdss/interop/cross-border-continuity")
async def cross_border_continuity(req: CrossBorderContinuityRequest):
    prompt = f"""
    You are an HIV programme specialist using WHO Consolidated HIV Guidelines 2021
    and SADC Cross-Border HIV Patient Management Protocol.

    Migrant patient:
    - Origin: {req.origin_country} → Current: {req.current_country}
    - ART history: started {req.art_start_date_imported}, last regimen: {req.last_regimen_imported}
    - Last VL: {req.last_vl_imported} (date: {req.last_vl_date_imported})
    - Days since last foreign facility visit: {req.days_since_last_foreign_visit}
    - Current: VL={req.current_vl}, CD4={req.current_cd4}, regimen={req.current_regimen}
    - Disclosed foreign treatment: {req.patient_disclosed_foreign_treatment}

    Assess:
    1. Treatment gap (>30 days off ART = moderate risk; >90 days = high risk)
    2. Regimen continuity (same regimen or switch needed?)
    3. VL rebound risk
    4. Recommended actions for care continuity

    Return JSON: continuity_gap_detected, gap_severity, gap_explanation, recommended_actions (list),
    estimated_days_off_art, resistance_risk, confidence (0-1).
    """
    result = await call_governed_json(prompt, surface="cross_border_continuity", phi_present=True)
    return result
```

---

## 5. NestJS Service

**File: `services/ehr-service/src/interop/disa-smartcare.service.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DisaSyncLog } from './entities/disa-sync-log.entity';
import { SmartcarePatientLink } from './entities/smartcare-patient-link.entity';
import { CrossBorderPatientFlag } from './entities/cross-border-patient-flag.entity';
import { CdssService } from '../cdss/cdss.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DisaSmartcareService {
  private readonly logger = new Logger(DisaSmartcareService.name);

  constructor(
    @InjectRepository(DisaSyncLog) private disaLogRepo: Repository<DisaSyncLog>,
    @InjectRepository(SmartcarePatientLink) private smartcareLinkRepo: Repository<SmartcarePatientLink>,
    @InjectRepository(CrossBorderPatientFlag) private crossBorderRepo: Repository<CrossBorderPatientFlag>,
    private cdssService: CdssService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  // ── DISA ──────────────────────────────────────────────────────────────────
  async pullDisaVlResults(nid: string, patientId?: string): Promise<DisaSyncLog[]> {
    const disaUrl = this.configService.get<string>('DISA_BASE_URL', '');
    const disaToken = this.configService.get<string>('DISA_API_TOKEN', '');

    if (!disaUrl || !disaToken) {
      return [await this.disaLogRepo.save(this.disaLogRepo.create({
        nid, patientId, syncType: 'vl_result', syncStatus: 'failed',
        errorMessage: 'DISA_BASE_URL or DISA_API_TOKEN not configured',
      }))];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${disaUrl}/api/results?nid=${nid}&type=VL`, {
          headers: { Authorization: `Bearer ${disaToken}` },
          timeout: 15000,
        }),
      );
      const results = response.data?.results ?? [];
      const saved: DisaSyncLog[] = [];
      for (const r of results) {
        const log = await this.disaLogRepo.save(this.disaLogRepo.create({
          patientId, nid, syncType: 'vl_result', syncStatus: 'success',
          sampleId: r.sampleId, sampleCollectionDate: r.collectionDate,
          resultType: 'HIV_VL', resultValue: r.result, resultNumeric: parseFloat(r.resultNumeric) || null,
          resultDate: r.resultDate, suppressed: parseFloat(r.resultNumeric) < 1000,
          disaFacilityCode: r.facilityCode, disaProvince: r.province, syncedAt: new Date(),
        }));
        saved.push(log);
      }
      return saved;
    } catch (err: any) {
      return [await this.disaLogRepo.save(this.disaLogRepo.create({
        nid, patientId, syncType: 'vl_result', syncStatus: 'failed',
        errorMessage: err?.message,
      }))];
    }
  }

  async getDisaSyncHistory(patientId: string): Promise<DisaSyncLog[]> {
    return this.disaLogRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  // ── SmartCare ─────────────────────────────────────────────────────────────
  async linkSmartcarePatient(localPatientId: string, smartcareUuid: string, artNumber?: string): Promise<SmartcarePatientLink> {
    const smartcareUrl = this.configService.get<string>('SMARTCARE_BASE_URL', '');
    const smartcareToken = this.configService.get<string>('SMARTCARE_API_TOKEN', '');

    const link = await this.smartcareLinkRepo.save(this.smartcareLinkRepo.create({
      localPatientId, smartcarePatientUuid: smartcareUuid, smartcareArtNumber: artNumber,
      syncStatus: 'linked', lastSyncAt: new Date(),
    }));

    if (smartcareUrl && smartcareToken) {
      try {
        // Pull ART history from SmartCare (OpenMRS FHIR endpoint)
        const patientRes = await firstValueFrom(
          this.httpService.get(`${smartcareUrl}/ws/fhir2/R4/Patient/${smartcareUuid}`, {
            headers: { Authorization: `Bearer ${smartcareToken}` },
          }),
        );
        const artRes = await firstValueFrom(
          this.httpService.get(`${smartcareUrl}/ws/fhir2/R4/MedicationRequest?patient=${smartcareUuid}`, {
            headers: { Authorization: `Bearer ${smartcareToken}` },
          }),
        );
        const artEntry = artRes.data?.entry?.[0]?.resource;
        await this.smartcareLinkRepo.update(link.id, {
          lastRegimen: artEntry?.medicationCodeableConcept?.text,
          artStartDate: artEntry?.authoredOn?.split('T')[0],
          lastSyncAt: new Date(),
        });
      } catch (err: any) {
        await this.smartcareLinkRepo.update(link.id, { syncStatus: 'sync_failed', importError: err?.message });
      }
    }

    return this.smartcareLinkRepo.findOneOrFail({ where: { id: link.id } });
  }

  async getSmartcareLink(localPatientId: string): Promise<SmartcarePatientLink | null> {
    return this.smartcareLinkRepo.findOne({ where: { localPatientId } });
  }

  // ── Cross-Border ──────────────────────────────────────────────────────────
  async flagCrossBorderPatient(dto: Partial<CrossBorderPatientFlag>): Promise<CrossBorderPatientFlag> {
    const existing = await this.crossBorderRepo.findOne({ where: { patientId: dto.patientId } });
    if (existing) {
      await this.crossBorderRepo.update(existing.id, dto);
      return this.crossBorderRepo.findOneOrFail({ where: { id: existing.id } });
    }
    return this.crossBorderRepo.save(this.crossBorderRepo.create(dto));
  }

  async assessCrossBorderContinuity(patientId: string): Promise<object> {
    const flag = await this.crossBorderRepo.findOne({ where: { patientId } });
    const link = await this.getSmartcareLink(patientId);
    if (!flag) return { continuity_gap_detected: false, gap_severity: 'none', gap_explanation: 'No cross-border flag on this patient' };

    return this.cdssService.callGovernedJson('/cdss/interop/cross-border-continuity', {
      origin_country: flag.originCountry,
      current_country: flag.currentCountry,
      art_start_date_imported: link?.artStartDate ?? null,
      last_regimen_imported: link?.lastRegimen ?? null,
      last_vl_imported: link?.lastVl ?? null,
      last_vl_date_imported: link?.lastVlDate ?? null,
      days_since_last_foreign_visit: flag.lastForeignVisitDate
        ? Math.floor((Date.now() - new Date(flag.lastForeignVisitDate).getTime()) / 86400000)
        : 999,
      current_vl: null,
      current_cd4: link?.lastCd4 ?? null,
      current_regimen: link?.lastRegimen ?? null,
      patient_disclosed_foreign_treatment: true,
    });
  }

  async getInteropSummary(): Promise<object> {
    const [disaTotal, disaSuccess, smartcareLinks, crossBorder] = await Promise.all([
      this.disaLogRepo.count(),
      this.disaLogRepo.count({ where: { syncStatus: 'success' } }),
      this.smartcareLinkRepo.count(),
      this.crossBorderRepo.count(),
    ]);
    return { disa: { total: disaTotal, success: disaSuccess }, smartcareLinks, crossBorderPatients: crossBorder };
  }
}
```

---

## 6. NestJS Controller

**File: `services/ehr-service/src/interop/disa-smartcare.controller.ts`**

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DisaSmartcareService } from './disa-smartcare.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('interop')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisaSmartcareController {
  constructor(private readonly service: DisaSmartcareService) {}

  @Post('disa/pull-vl') @Roles('doctor', 'nurse', 'admin')
  pullDisa(@Body() dto: { nid: string; patientId?: string }) {
    return this.service.pullDisaVlResults(dto.nid, dto.patientId);
  }

  @Get('disa/history/:patientId') @Roles('doctor', 'nurse', 'admin')
  getDisaHistory(@Param('patientId') patientId: string) {
    return this.service.getDisaSyncHistory(patientId);
  }

  @Post('smartcare/link') @Roles('doctor', 'nurse', 'admin')
  linkSmartcare(@Body() dto: { localPatientId: string; smartcareUuid: string; artNumber?: string }) {
    return this.service.linkSmartcarePatient(dto.localPatientId, dto.smartcareUuid, dto.artNumber);
  }

  @Get('smartcare/link/:patientId') @Roles('doctor', 'nurse', 'admin')
  getSmartcareLink(@Param('patientId') patientId: string) {
    return this.service.getSmartcareLink(patientId);
  }

  @Post('cross-border/flag') @Roles('doctor', 'nurse', 'admin')
  flagCrossBorder(@Body() dto: any) { return this.service.flagCrossBorderPatient(dto); }

  @Get('cross-border/continuity/:patientId') @Roles('doctor', 'nurse', 'admin')
  assessContinuity(@Param('patientId') patientId: string) {
    return this.service.assessCrossBorderContinuity(patientId);
  }

  @Get('summary') @Roles('admin', 'public_health')
  summary() { return this.service.getInteropSummary(); }
}
```

**Module** (`disa-smartcare.module.ts`) — `HttpModule` + `CdssModule`; register in `ehr.module.ts`.

---

## 7. Environment Variables (`.env.example`)

```bash
# DISA Integration — Mozambique (Sprint 157)
DISA_BASE_URL=https://disa.misau.gov.mz
DISA_API_TOKEN=your-disa-api-token

# SmartCare Integration — Zambia (Sprint 157)
SMARTCARE_BASE_URL=https://smartcare.moh.gov.zm
SMARTCARE_API_TOKEN=your-smartcare-api-token
```

---

## 8. Frontend

### API in `api.ts`

```typescript
export const interopApi = {
  pullDisaVl: (data: { nid: string; patientId?: string }) => api.post('/interop/disa/pull-vl', data),
  getDisaHistory: (patientId: string) => api.get(`/interop/disa/history/${patientId}`),
  linkSmartcare: (data: any) => api.post('/interop/smartcare/link', data),
  getSmartcareLink: (patientId: string) => api.get(`/interop/smartcare/link/${patientId}`),
  flagCrossBorder: (data: any) => api.post('/interop/cross-border/flag', data),
  assessContinuity: (patientId: string) => api.get(`/interop/cross-border/continuity/${patientId}`),
  getInteropSummary: () => api.get('/interop/summary'),
};
```

### Component Spec — `InteropDashboard.tsx`

Three tabs:

1. **DISA (Mozambique VL)** — NID lookup field + "Pull Results" button. Results table: sample ID, collection date, VL result, suppressed (green/red badge). Sync status indicator.

2. **SmartCare (Zambia ART)** — Patient UUID input + ART number. "Link & Import" button imports regimen + VL history. Shows imported ART start date, last regimen, last VL. Continuity assessment button → CDSS result: gap severity badge, recommended actions list.

3. **Cross-Border Patients** — List of flagged patients with origin/current country, last foreign visit, continuity gap flag (red if detected), CDSS gap severity. "Assess Continuity" calls CDSS inline.

Wire into HIV/ART patient management section.

---

## 9. Post-Implementation Steps

```bash
docker compose build tenant-service
./scripts/provision-repair-all.sh

psql $DATABASE_URL -c "\d disa_sync_log"
psql $DATABASE_URL -c "\d smartcare_patient_links"
psql $DATABASE_URL -c "\d cross_border_patient_flags"

npx tsc --noEmit
npm run lint

git add services/tenant-service/src/generated/tenant-disa-smartcare.statements.ts \
        services/ehr-service/src/interop/ \
        ehr-frontend/src/services/api.ts \
        ehr-frontend/src/components/InteropDashboard.tsx \
        .env.example
git commit -m "feat: implement Sprint 157 — DISA VL integration and SmartCare Zambia patient sync"
```

---

## 10. Done-When Checklist

- [ ] `tenant-disa-smartcare.statements.ts` — 3 tables, idempotent SQL
- [ ] Bundle in `database-provisioning.service.ts`
- [ ] `DisaSyncLog`, `SmartcarePatientLink`, `CrossBorderPatientFlag` entities in `tenant.service.ts`
- [ ] `DisaSmartcareModule` (with `HttpModule`) in `ehr.module.ts`
- [ ] `DisaSmartcareService` with graceful degradation when URLs not configured
- [ ] `DisaSmartcareController` with 7 routes
- [ ] CDSS `POST /cdss/interop/cross-border-continuity` — ART gap severity + actions
- [ ] `DISA_BASE_URL` + `SMARTCARE_BASE_URL` in `.env.example`
- [ ] `interopApi` in `api.ts`
- [ ] `InteropDashboard.tsx` — 3 tabs: DISA, SmartCare, Cross-Border
- [ ] `provision-repair-all.sh` clean
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] Git committed: `feat: implement Sprint 157 — DISA VL integration and SmartCare Zambia patient sync`
