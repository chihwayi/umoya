# NC-S01 — BAA Registry + Zimbabwe CDPA 2021 Compliance

**Sprint ID:** NC-S01  
**Priority:** P1 — Must complete before any production go-live  
**Effort:** 1 week  
**Dependencies:** None  
**Covers gaps:** 4.10 (BAA registry), 4.13 (CDPA 2021 compliance mapping)

---

## 1. Codebase Context — What Already Exists

| File | What it has |
|---|---|
| `services/ehr-service/src/services/hipaa-audit.service.ts` | `HipaaAuditService` — logs access events, PHI access, breach events |
| `services/ehr-service/src/interceptors/hipaa-audit.interceptor.ts` | `HipaaAuditInterceptor` — attaches to every request |
| `services/ehr-service/src/guards/minimum-necessary.guard.ts` | `MinimumNecessaryGuard` — restricts data scope by role |
| `services/tenant-service/src/services/tenant.service.ts` | `ensureSubscriptionSchema()` — safe ADD COLUMN IF NOT EXISTS pattern |
| `services/tenant-service/src/services/database-provisioning.service.ts` | `getProvisioningBundles()` — per-tenant table creation |
| `services/ehr-service/src/ehr.module.ts` | 168 controllers registered |

**No BAA registry or CDPA control mapping exists anywhere in the codebase.**

---

## 2. What This Sprint Builds

1. **BAA Registry** — a system-level (tenants DB) table that tracks every third-party integration (Africa's Talking, Daily.co, Stripe, MinIO, NHLS, Flutterwave, ZimSwitch, OpenAI, Whisper) with signed BAA status, expiry, and contact info.
2. **CDPA Control Checklist** — a per-tenant table tracking Zimbabwe CDPA 2021 compliance controls with pass/fail status, evidence links, and review dates.
3. **Super-admin UI** — pages in `web-app/src/pages/` to view and manage BAAs and CDPA controls.
4. **EHR admin UI** — read-only CDPA compliance dashboard for tenant administrators.

---

## 3. Database Changes

### 3.1 System Table — `baa_registry` (in tenant-service system DB)

Add inside `ensureSubscriptionSchema()` in `services/tenant-service/src/services/tenant.service.ts`:

```sql
CREATE TABLE IF NOT EXISTS baa_registry (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name      VARCHAR(200)  NOT NULL,
  vendor_type      VARCHAR(60)   NOT NULL,  -- 'sms_provider' | 'video_provider' | 'payment_gateway' | 'cloud_storage' | 'ai_provider' | 'lab_integration' | 'other'
  service_url      VARCHAR(500),
  contact_email    VARCHAR(200),
  contact_phone    VARCHAR(50),
  baa_status       VARCHAR(30)   NOT NULL DEFAULT 'pending',  -- 'pending' | 'signed' | 'expired' | 'not_required'
  baa_signed_date  DATE,
  baa_expiry_date  DATE,
  baa_document_url VARCHAR(1000),
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_baa_registry_vendor_type ON baa_registry (vendor_type);
CREATE INDEX IF NOT EXISTS idx_baa_registry_status ON baa_registry (baa_status);
```

Add to `ensureSubscriptionSchema()` after the existing ALTER TABLE block:

```typescript
await this.tenantRepository.query(`
  CREATE TABLE IF NOT EXISTS baa_registry (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name      VARCHAR(200)  NOT NULL,
    vendor_type      VARCHAR(60)   NOT NULL,
    service_url      VARCHAR(500),
    contact_email    VARCHAR(200),
    contact_phone    VARCHAR(50),
    baa_status       VARCHAR(30)   NOT NULL DEFAULT 'pending',
    baa_signed_date  DATE,
    baa_expiry_date  DATE,
    baa_document_url VARCHAR(1000),
    notes            TEXT,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_baa_registry_vendor_type ON baa_registry (vendor_type);
  CREATE INDEX IF NOT EXISTS idx_baa_registry_status ON baa_registry (baa_status);
`);
```

**Seed data** — insert default vendor rows if table is empty:

```typescript
await this.tenantRepository.query(`
  INSERT INTO baa_registry (vendor_name, vendor_type, service_url, baa_status)
  SELECT * FROM (VALUES
    ('Africa''s Talking',  'sms_provider',    'https://africastalking.com', 'pending'),
    ('Daily.co',           'video_provider',  'https://daily.co',           'pending'),
    ('Stripe',             'payment_gateway', 'https://stripe.com',         'pending'),
    ('Flutterwave',        'payment_gateway', 'https://flutterwave.com',    'pending'),
    ('ZimSwitch',          'payment_gateway', 'https://zimswitch.co.zw',    'pending'),
    ('MinIO',              'cloud_storage',   NULL,                         'pending'),
    ('OpenAI / Whisper',   'ai_provider',     'https://openai.com',         'pending'),
    ('NHLS Zimbabwe',      'lab_integration', NULL,                         'pending')
  ) AS v(vendor_name, vendor_type, service_url, baa_status)
  WHERE NOT EXISTS (SELECT 1 FROM baa_registry LIMIT 1)
  ON CONFLICT DO NOTHING;
`);
```

### 3.2 Per-Tenant Table — `cdpa_controls` (in each tenant DB)

Add a new bundle to `getProvisioningBundles()` in `services/tenant-service/src/services/database-provisioning.service.ts`:

```typescript
{
  id: 'nc_cdpa_compliance',
  label: 'Zimbabwe CDPA 2021 Compliance Controls',
  version: '2026.05.17.1',
  description: 'Per-tenant CDPA 2021 control tracking table with evidence links and review dates',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS cdpa_controls (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      control_id      VARCHAR(20)  NOT NULL UNIQUE,  -- e.g. 'CDPA-01'
      category        VARCHAR(80)  NOT NULL,          -- e.g. 'Data Collection', 'Data Security', 'Data Subject Rights'
      control_name    VARCHAR(300) NOT NULL,
      requirement     TEXT         NOT NULL,
      status          VARCHAR(20)  NOT NULL DEFAULT 'not_assessed',  -- 'compliant' | 'partial' | 'non_compliant' | 'not_assessed' | 'not_applicable'
      evidence_url    VARCHAR(1000),
      evidence_notes  TEXT,
      owner           VARCHAR(200),
      last_reviewed   DATE,
      next_review     DATE,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cdpa_controls_category ON cdpa_controls (category)`,
    `CREATE INDEX IF NOT EXISTS idx_cdpa_controls_status   ON cdpa_controls (status)`,
    `INSERT INTO cdpa_controls (control_id, category, control_name, requirement, status) VALUES
      ('CDPA-01', 'Lawful Processing',       'Lawful basis for processing',          'Personal data must be processed on one of the grounds listed in s.14 CDPA 2021',   'not_assessed'),
      ('CDPA-02', 'Consent',                  'Freely given, specific informed consent', 'Consent must be freely given, specific, informed and unambiguous — s.14(1)(a)', 'not_assessed'),
      ('CDPA-03', 'Purpose Limitation',       'Data collected for specified purposes',  'Data must be collected for explicit, specified and legitimate purposes — s.15',   'not_assessed'),
      ('CDPA-04', 'Data Minimisation',        'Minimum necessary data collection',      'Only data adequate, relevant and limited to the purpose — s.15(b)',              'not_assessed'),
      ('CDPA-05', 'Accuracy',                 'Data accuracy and correction',           'Data must be accurate and kept up to date — s.15(c)',                            'not_assessed'),
      ('CDPA-06', 'Storage Limitation',       'Retention policy and deletion',          'Data must not be kept longer than necessary — s.15(d)',                          'not_assessed'),
      ('CDPA-07', 'Security',                 'Appropriate technical security measures', 'Controller must implement appropriate security — s.18',                          'not_assessed'),
      ('CDPA-08', 'Data Subject Rights',      'Right to access personal data',          'Data subjects may request access to their data — s.26',                          'not_assessed'),
      ('CDPA-09', 'Data Subject Rights',      'Right to rectification',                 'Data subjects may request correction — s.27',                                    'not_assessed'),
      ('CDPA-10', 'Data Subject Rights',      'Right to erasure (right to be forgotten)', 'Data subjects may request deletion where no legal basis — s.28',              'not_assessed'),
      ('CDPA-11', 'Data Subject Rights',      'Right to data portability',              'Data must be provided in machine-readable format on request — s.29',             'not_assessed'),
      ('CDPA-12', 'Data Transfers',           'Cross-border data transfer restrictions','Data may only be transferred to countries with adequate protection — s.30',      'not_assessed'),
      ('CDPA-13', 'Breach Notification',      'Breach notification to POTRAZ',          'Data breaches must be notified to POTRAZ within 72 hours — s.21',               'not_assessed'),
      ('CDPA-14', 'Data Protection Officer',  'DPO appointment',                        'Controllers processing sensitive personal data must appoint a DPO — s.33',      'not_assessed'),
      ('CDPA-15', 'Special Categories',       'Sensitive personal data (health data)',  'Health data is a special category requiring explicit consent — s.10',            'not_assessed'),
      ('CDPA-16', 'Children''s Data',         'Protection of children''s data',         'Enhanced protection for data of persons under 18 — s.12',                       'not_assessed'),
      ('CDPA-17', 'Accountability',           'Records of processing activities',       'Controllers must maintain records of processing activities — s.16',             'not_assessed'),
      ('CDPA-18', 'Third Parties',            'Processor agreements (BAA equivalent)',  'Written agreements required with all data processors — s.19',                   'not_assessed')
    ON CONFLICT (control_id) DO NOTHING`,
  ],
},
```

**After adding the bundle:** run `POST /api/admin/tenants/repair-all` to backfill existing tenants.

---

## 4. Backend Implementation

### 4.1 Entity — `BaaRegistryEntry` (system DB)

**File to create:** `services/tenant-service/src/entities/baa-registry.entity.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('baa_registry')
export class BaaRegistryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_name', length: 200 })
  vendorName: string;

  @Index()
  @Column({ name: 'vendor_type', length: 60 })
  vendorType: 'sms_provider' | 'video_provider' | 'payment_gateway' | 'cloud_storage' | 'ai_provider' | 'lab_integration' | 'other';

  @Column({ name: 'service_url', length: 500, nullable: true })
  serviceUrl: string | null;

  @Column({ name: 'contact_email', length: 200, nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', length: 50, nullable: true })
  contactPhone: string | null;

  @Index()
  @Column({ name: 'baa_status', length: 30, default: 'pending' })
  baaStatus: 'pending' | 'signed' | 'expired' | 'not_required';

  @Column({ name: 'baa_signed_date', type: 'date', nullable: true })
  baaSignedDate: string | null;

  @Column({ name: 'baa_expiry_date', type: 'date', nullable: true })
  baaExpiryDate: string | null;

  @Column({ name: 'baa_document_url', length: 1000, nullable: true })
  baaDocumentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Register** in `services/tenant-service/src/tenant.module.ts` — add `BaaRegistryEntry` to `TypeOrmModule.forFeature([...])`.

### 4.2 Service — `BaaRegistryService`

**File to create:** `services/tenant-service/src/services/baa-registry.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaaRegistryEntry } from '../entities/baa-registry.entity';

@Injectable()
export class BaaRegistryService {
  constructor(
    @InjectRepository(BaaRegistryEntry)
    private readonly repo: Repository<BaaRegistryEntry>,
  ) {}

  findAll(): Promise<BaaRegistryEntry[]> {
    return this.repo.find({ order: { vendorType: 'ASC', vendorName: 'ASC' } });
  }

  findOne(id: string): Promise<BaaRegistryEntry | null> {
    return this.repo.findOneBy({ id });
  }

  create(dto: Partial<BaaRegistryEntry>): Promise<BaaRegistryEntry> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<BaaRegistryEntry>): Promise<BaaRegistryEntry> {
    await this.repo.update(id, dto);
    return this.repo.findOneByOrFail({ id });
  }

  remove(id: string): Promise<void> {
    return this.repo.delete(id).then(() => undefined);
  }

  async getComplianceSummary(): Promise<{ total: number; signed: number; pending: number; expired: number }> {
    const all = await this.repo.find();
    return {
      total:   all.length,
      signed:  all.filter(e => e.baaStatus === 'signed').length,
      pending: all.filter(e => e.baaStatus === 'pending').length,
      expired: all.filter(e => e.baaStatus === 'expired').length,
    };
  }
}
```

### 4.3 Controller — `BaaRegistryController` (tenant-service)

**File to create:** `services/tenant-service/src/controllers/baa-registry.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BaaRegistryService } from '../services/baa-registry.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';   // reuse existing guard

@Controller('admin/baa-registry')
@UseGuards(JwtAuthGuard)
export class BaaRegistryController {
  constructor(private readonly svc: BaaRegistryService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get('summary')
  summary() { return this.svc.getComplianceSummary(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: Partial<import('../entities/baa-registry.entity').BaaRegistryEntry>) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<import('../entities/baa-registry.entity').BaaRegistryEntry>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
```

**Register:** Add `BaaRegistryController` to `controllers: []` in `services/tenant-service/src/tenant.module.ts`. Add `BaaRegistryService` to `providers: []`.

### 4.4 CDPA Controller (EHR service — per-tenant)

**File to create:** `services/ehr-service/src/controllers/cdpa.controller.ts`

```typescript
import { Controller, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('cdpa')
@UseGuards(JwtAuthGuard)
export class CdpaController {
  @Get('controls')
  async getControls(@Req() req: any) {
    const db = req.tenantDb;
    const rows = await db.query('SELECT * FROM cdpa_controls ORDER BY control_id ASC');
    return rows;
  }

  @Get('controls/summary')
  async getSummary(@Req() req: any) {
    const db = req.tenantDb;
    const [{ total, compliant, partial, non_compliant, not_assessed }] = await db.query(`
      SELECT
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE status = 'compliant')     AS compliant,
        COUNT(*) FILTER (WHERE status = 'partial')       AS partial,
        COUNT(*) FILTER (WHERE status = 'non_compliant') AS non_compliant,
        COUNT(*) FILTER (WHERE status = 'not_assessed')  AS not_assessed
      FROM cdpa_controls
    `);
    return { total: +total, compliant: +compliant, partial: +partial, nonCompliant: +non_compliant, notAssessed: +not_assessed };
  }

  @Patch('controls/:id')
  async updateControl(
    @Param('id') id: string,
    @Body() body: { status?: string; evidenceUrl?: string; evidenceNotes?: string; owner?: string; lastReviewed?: string; nextReview?: string },
    @Req() req: any,
  ) {
    const db = req.tenantDb;
    await db.query(
      `UPDATE cdpa_controls
       SET status = COALESCE($1, status),
           evidence_url   = COALESCE($2, evidence_url),
           evidence_notes = COALESCE($3, evidence_notes),
           owner          = COALESCE($4, owner),
           last_reviewed  = COALESCE($5::DATE, last_reviewed),
           next_review    = COALESCE($6::DATE, next_review),
           updated_at     = now()
       WHERE id = $7`,
      [body.status, body.evidenceUrl, body.evidenceNotes, body.owner, body.lastReviewed, body.nextReview, id],
    );
    const [row] = await db.query('SELECT * FROM cdpa_controls WHERE id = $1', [id]);
    return row;
  }
}
```

**Register:** Add `CdpaController` to `controllers: []` in `services/ehr-service/src/ehr.module.ts`.

---

## 5. Frontend Implementation

### 5.1 Super-admin — BAA Registry Page

**File to create:** `web-app/src/pages/BaaRegistryPage.tsx`

```tsx
// Displays a table of all BAA vendors with status badges.
// Allows admins to edit status, upload document URL, set expiry date.
// Color coding: signed=green, pending=yellow, expired=red.
// Uses the existing web-app fetch pattern to call GET /api/admin/baa-registry
// and PATCH /api/admin/baa-registry/:id
```

Key UI elements:
- Summary chips at top: "8 vendors | 0 signed | 8 pending | 0 expired"
- Table columns: Vendor Name | Type | BAA Status | Signed Date | Expiry | Document | Actions
- Inline edit modal with: status dropdown, signed date picker, expiry date picker, document URL input, notes textarea
- "Mark as Signed" quick action button per row

### 5.2 EHR Admin — CDPA Controls Dashboard

**File to create:** `ehr-frontend/src/pages/CdpaCompliancePage.tsx`

```tsx
// Shows the 18 CDPA controls grouped by category.
// Progress bar per category showing % compliant.
// Each control row has: Control ID | Name | Requirement | Status badge | Evidence | Owner | Last Reviewed
// Allows tenant admin (role: admin) to update status and add evidence.
// Uses GET /api/cdpa/controls and PATCH /api/cdpa/controls/:id
```

Key UI elements:
- Overall compliance score: `compliant / total * 100`%
- Grouped accordion by category (Lawful Processing, Consent, Security, Data Subject Rights, etc.)
- Status dropdown per control: Not Assessed | Compliant | Partial | Non-Compliant | N/A
- Evidence URL field + notes text area
- "Next review" date picker
- Export to PDF button (browser print)

---

## 6. Tests Required

### 6.1 BAA Service Unit Test

**File:** `services/tenant-service/src/services/baa-registry.service.spec.ts`

```typescript
describe('BaaRegistryService', () => {
  let service: BaaRegistryService;
  let repo: jest.Mocked<Repository<BaaRegistryEntry>>;

  beforeEach(() => {
    repo = { find: jest.fn(), findOneBy: jest.fn(), findOneByOrFail: jest.fn(),
             save: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } as any;
    service = new BaaRegistryService(repo);
  });

  it('getComplianceSummary returns correct counts', async () => {
    repo.find.mockResolvedValue([
      { baaStatus: 'signed' } as any,
      { baaStatus: 'pending' } as any,
      { baaStatus: 'pending' } as any,
      { baaStatus: 'expired' } as any,
    ]);
    const result = await service.getComplianceSummary();
    expect(result).toEqual({ total: 4, signed: 1, pending: 2, expired: 1 });
  });
});
```

### 6.2 CDPA Controller Unit Test

**File:** `services/ehr-service/src/controllers/cdpa.controller.spec.ts`

```typescript
describe('CdpaController', () => {
  it('getSummary returns numeric totals', async () => {
    const ctrl = new CdpaController();
    const mockReq = {
      tenantDb: {
        query: jest.fn().mockResolvedValue([{ total: '18', compliant: '5', partial: '3', non_compliant: '2', not_assessed: '8' }])
      }
    };
    const result = await ctrl.getSummary(mockReq as any);
    expect(result.total).toBe(18);
    expect(result.compliant).toBe(5);
    expect(typeof result.nonCompliant).toBe('number');
  });
});
```

---

## 7. Sign-off Criteria

All must pass before this sprint is closed:

- [ ] `baa_registry` table created in system DB with all 8 seed vendors on first boot
- [ ] `cdpa_controls` table created with all 18 CDPA controls seeded in every tenant DB
- [ ] `POST /api/admin/tenants/repair-all` successfully backfills `cdpa_controls` in existing tenants
- [ ] `GET /api/admin/baa-registry` returns all 8 vendor rows
- [ ] `PATCH /api/admin/baa-registry/:id` correctly updates baaStatus and timestamps
- [ ] `GET /api/cdpa/controls/summary` returns correct numeric totals (not strings)
- [ ] `PATCH /api/cdpa/controls/:id` updates status and evidence without touching unmodified fields
- [ ] BAA Registry Page renders in super-admin portal with status colour badges
- [ ] CDPA Compliance Page renders in EHR frontend with grouped categories and progress bars
- [ ] `npm run lint` passes with zero errors in all modified packages
- [ ] `npm test` passes with zero failures in `tenant-service` and `ehr-service`
- [ ] CI workflow (`build-and-test` job) passes green
