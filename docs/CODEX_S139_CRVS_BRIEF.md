# Codex Sprint Brief — S139: CRVS Birth / Death Notification

**Date:** 2026-04-11
**Branch:** main
**Reviewer:** Claude (signs off before you move to S140)

---

## 1. Goal

Build a Civil Registration & Vital Statistics (CRVS) module that:
- Records **birth notifications** (live births, stillbirths) and submits them to the configured national CRVS API
- Generates **ICD-10 coded death certificates** and submits them to the national CRVS API
- Sends **Maternal Death Surveillance (MDSR)** notifications to MoH
- Supports **Perinatal Death Review** committee workflow with action points

---

## 2. Monorepo Layout (reminder)

```
services/
  tenant-service/src/generated/          ← new provisioning bundle goes here
  tenant-service/src/services/
    database-provisioning.service.ts     ← register bundle here
  ehr-service/src/
    entities/                            ← new TypeORM entities
    services/                            ← new NestJS service
    controllers/                         ← new NestJS controller
    ehr.module.ts                        ← register controller + service here
    services/tenant.service.ts           ← register entities in DataSource here
ehr-frontend/src/
  pages/CrvsDashboard.tsx                ← new frontend dashboard
  App.tsx                                ← add lazy route here
```

---

## 3. Non-Negotiable Rules

### 3.1 — No hardcoded credentials or URLs
- **Never** put real passwords, API keys, or production URLs in source code.
- **Never** write `process.env.SOME_PASSWORD = 'literal-value'` in spec files.
- In spec files, use the `Object.assign(process.env, TEST_ENV)` pattern where `TEST_ENV` reads from `process.env` with `?? 'ci-stub'` fallbacks:
  ```typescript
  const TEST_ENV: Record<string, string> = {
    CRVS_API_KEY: process.env.CRVS_API_KEY ?? 'ci-key-stub',
    CRVS_BASE_URL: process.env.CRVS_BASE_URL ?? 'https://crvs.example.test',
  };
  // In beforeEach:
  Object.assign(process.env, TEST_ENV);
  ```
- In service files, never fallback to real production URLs:
  ```typescript
  // ✅ correct
  const baseUrl = String(process.env.CRVS_BASE_URL || '').trim();

  // ❌ wrong — hardcoded production URL
  const baseUrl = process.env.CRVS_BASE_URL || 'https://api.zimstat.gov.zw';
  ```
- Guard against unconfigured env: if `baseUrl` is empty, store the submission as `status: 'pending_config'` rather than throwing.

### 3.2 — No mock data
- Zero `setTimeout(() => resolve(fakeData))`.
- Zero hardcoded arrays of fake records.
- All frontend API calls use `ehrAxios` from `src/services/api.ts`.

### 3.3 — Dual entity registration
Every new entity MUST appear in TWO places:
1. `services/ehr-service/src/services/tenant.service.ts` — add to the `entities: [...]` array in `getTenantDatabase()`
2. `services/ehr-service/src/ehr.module.ts` — add controller to `controllers:[]`, service to `providers:[]`

### 3.4 — DB changes via DatabaseProvisioningService only
Never execute raw DDL directly. Follow the 4-step pattern in section 4.

### 3.5 — TypeScript quality gate
Before committing, all three must pass with zero errors:
```bash
cd services/ehr-service && npx tsc --noEmit
cd services/tenant-service && npx tsc --noEmit
cd ehr-frontend && npx tsc --noEmit
```

---

## 4. Database Provisioning (Step-by-Step)

### Step A — Create provisioning file

**File:** `services/tenant-service/src/generated/tenant-crvs.statements.ts`

```typescript
export const TENANT_CRVS_BUNDLE_VERSION = '2026.04.11.12';

export const TENANT_CRVS_STATEMENTS = (): string[] => [
  `CREATE TABLE IF NOT EXISTS birth_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    mother_patient_id UUID,
    maternity_record_id UUID,
    birth_date TIMESTAMP WITH TIME ZONE NOT NULL,
    birth_type VARCHAR(20) NOT NULL,
    gestational_age_weeks INTEGER,
    birth_weight_grams INTEGER,
    delivery_mode VARCHAR(30),
    birth_order INTEGER DEFAULT 1,
    plurality VARCHAR(10),
    place_of_birth VARCHAR(100),
    crvs_reference VARCHAR(50),
    submitted_to_crvs BOOLEAN DEFAULT false NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_birth_notifications_patient ON birth_notifications(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_birth_notifications_mother ON birth_notifications(mother_patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_birth_notifications_type ON birth_notifications(birth_type)`,

  `CREATE TABLE IF NOT EXISTS death_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    death_date DATE NOT NULL,
    death_time TIME,
    place_of_death VARCHAR(100),
    cause_of_death_primary VARCHAR(200) NOT NULL,
    cause_of_death_icd10 VARCHAR(10) NOT NULL,
    cause_of_death_secondary VARCHAR(200),
    cause_of_death_secondary_icd10 VARCHAR(10),
    manner_of_death VARCHAR(30),
    certifying_provider UUID,
    crvs_reference VARCHAR(50),
    submitted_to_crvs BOOLEAN DEFAULT false NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    pdf_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_death_certificates_patient ON death_certificates(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_death_certificates_icd10 ON death_certificates(cause_of_death_icd10)`,

  `CREATE TABLE IF NOT EXISTS mdsr_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    death_certificate_id UUID,
    death_date DATE NOT NULL,
    weeks_gestation_at_death INTEGER,
    primary_cause VARCHAR(200),
    primary_cause_icd10 VARCHAR(10),
    avoidable BOOLEAN,
    avoidance_factors TEXT,
    committee_review_date DATE,
    reviewed_by UUID,
    action_points TEXT,
    submitted_to_moh BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mdsr_notifications_patient ON mdsr_notifications(patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mdsr_notifications_cert ON mdsr_notifications(death_certificate_id)`,
];
```

### Step B — Register in DatabaseProvisioningService

In `services/tenant-service/src/services/database-provisioning.service.ts`, add to `getProvisioningBundles()`:

```typescript
import { TENANT_CRVS_BUNDLE_VERSION, TENANT_CRVS_STATEMENTS } from '../generated/tenant-crvs.statements';

// Add to the bundles array:
{
  id: 'sprint139_crvs',
  label: 'CRVS Birth/Death Notification',
  version: TENANT_CRVS_BUNDLE_VERSION,
  description: 'S139 — birth notifications, death certificates, MDSR notifications',
  statements: TENANT_CRVS_STATEMENTS,
},
```

### Step C — Run tenant repair

```bash
# From medicore root (outside Docker):
DB_HOST=127.0.0.1 DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD=postgres \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/medicore \
npm run provision:all-tenants -w @medicore/tenant-service
```

Or via the HTTP endpoint if the service is running:
```bash
curl -X POST http://localhost:3001/admin/repair-all-tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Step D — Confirm tables exist

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('birth_notifications', 'death_certificates', 'mdsr_notifications');
-- Must return all 3 rows in each tenant DB
```

---

## 5. New Entities

### `services/ehr-service/src/entities/birth-notification.entity.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('birth_notifications')
export class BirthNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'mother_patient_id', type: 'uuid', nullable: true }) motherPatientId: string | null;
  @Column({ name: 'maternity_record_id', type: 'uuid', nullable: true }) maternityRecordId: string | null;
  @Column({ name: 'birth_date', type: 'timestamptz' }) birthDate: Date;
  @Column({ name: 'birth_type' }) birthType: string; // live_birth | stillbirth | miscarriage
  @Column({ name: 'gestational_age_weeks', type: 'int', nullable: true }) gestationalAgeWeeks: number | null;
  @Column({ name: 'birth_weight_grams', type: 'int', nullable: true }) birthWeightGrams: number | null;
  @Column({ name: 'delivery_mode', nullable: true }) deliveryMode: string | null;
  @Column({ name: 'birth_order', type: 'int', default: 1 }) birthOrder: number;
  @Column({ name: 'plurality', nullable: true }) plurality: string | null;
  @Column({ name: 'place_of_birth', nullable: true }) placeOfBirth: string | null;
  @Column({ name: 'crvs_reference', nullable: true }) crvsReference: string | null;
  @Column({ name: 'submitted_to_crvs', default: false }) submittedToCrvs: boolean;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `services/ehr-service/src/entities/death-certificate.entity.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('death_certificates')
export class DeathCertificate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'death_date', type: 'date' }) deathDate: string;
  @Column({ name: 'death_time', type: 'time', nullable: true }) deathTime: string | null;
  @Column({ name: 'place_of_death', nullable: true }) placeOfDeath: string | null;
  @Column({ name: 'cause_of_death_primary' }) causeOfDeathPrimary: string;
  @Column({ name: 'cause_of_death_icd10' }) causeOfDeathIcd10: string;
  @Column({ name: 'cause_of_death_secondary', nullable: true }) causeOfDeathSecondary: string | null;
  @Column({ name: 'cause_of_death_secondary_icd10', nullable: true }) causeOfDeathSecondaryIcd10: string | null;
  @Column({ name: 'manner_of_death', nullable: true }) mannerOfDeath: string | null;
  @Column({ name: 'certifying_provider', type: 'uuid', nullable: true }) certifyingProvider: string | null;
  @Column({ name: 'crvs_reference', nullable: true }) crvsReference: string | null;
  @Column({ name: 'submitted_to_crvs', default: false }) submittedToCrvs: boolean;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'pdf_path', type: 'text', nullable: true }) pdfPath: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

### `services/ehr-service/src/entities/mdsr-notification.entity.ts`

```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('mdsr_notifications')
export class MdsrNotification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'patient_id', type: 'uuid' }) patientId: string;
  @Column({ name: 'death_certificate_id', type: 'uuid', nullable: true }) deathCertificateId: string | null;
  @Column({ name: 'death_date', type: 'date' }) deathDate: string;
  @Column({ name: 'weeks_gestation_at_death', type: 'int', nullable: true }) weeksGestationAtDeath: number | null;
  @Column({ name: 'primary_cause', nullable: true }) primaryCause: string | null;
  @Column({ name: 'primary_cause_icd10', nullable: true }) primaryCauseIcd10: string | null;
  @Column({ name: 'avoidable', type: 'boolean', nullable: true }) avoidable: boolean | null;
  @Column({ name: 'avoidance_factors', type: 'text', nullable: true }) avoidanceFactors: string | null;
  @Column({ name: 'committee_review_date', type: 'date', nullable: true }) committeeReviewDate: string | null;
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy: string | null;
  @Column({ name: 'action_points', type: 'text', nullable: true }) actionPoints: string | null;
  @Column({ name: 'submitted_to_moh', default: false }) submittedToMoh: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
```

---

## 6. Backend — CrvsService

**File:** `services/ehr-service/src/services/crvs.service.ts`

Key methods:

```typescript
@Injectable()
export class CrvsService {
  constructor(private readonly tenantService: TenantService) {}

  async registerBirth(tenantId: string, body: any): Promise<BirthNotification>
  async registerDeath(tenantId: string, body: any): Promise<DeathCertificate>
  async getDeathCertificate(tenantId: string, patientId: string): Promise<DeathCertificate | null>
  async submitMdsr(tenantId: string, body: any): Promise<MdsrNotification>
  async listMdsr(tenantId: string): Promise<MdsrNotification[]>
  async reviewMdsr(tenantId: string, id: string, body: any): Promise<MdsrNotification>
}
```

**CRVS API submission logic:**

```typescript
private async submitToCrvsApi(payload: any, eventType: 'birth' | 'death'): Promise<string | null> {
  const baseUrl = String(process.env.CRVS_BASE_URL || '').trim();
  const apiKey = String(process.env.CRVS_API_KEY || '').trim();
  const countryCode = String(process.env.CRVS_COUNTRY_CODE || '').trim().toUpperCase();

  if (!baseUrl || !apiKey) return null; // caller stores as pending_config

  // Route by country code
  let endpoint = `${baseUrl}/api/vital-events`; // generic fallback
  if (countryCode === 'ZW' && process.env.ZIMSTAT_BASE_URL) {
    endpoint = `${String(process.env.ZIMSTAT_BASE_URL).trim()}/api/${eventType}-notification`;
  } else if (countryCode === 'ZA' && process.env.DHA_BASE_URL) {
    endpoint = `${String(process.env.DHA_BASE_URL).trim()}/api/notifications/${eventType}`;
  }

  const response = await axios.post(endpoint, payload, {
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return response.data?.reference ?? response.data?.id ?? null;
}
```

- If `CRVS_BASE_URL` is not set, save record with `submittedToCrvs: false` and `errorMessage: 'CRVS not configured'` — **do not throw**.
- Wrap the HTTP call in try/catch; on failure store `errorMessage` from `error.response?.data` or `error.message`.
- Death certificate PDF: generate a simple structured text blob stored as `pdfPath` (or skip PDF for now and return `null` — **do not block the endpoint on PDF generation**).

---

## 7. Backend — CrvsController

**File:** `services/ehr-service/src/controllers/crvs.controller.ts`

```typescript
@UseGuards(JwtAuthGuard)
@Controller('crvs')
export class CrvsController {
  constructor(private readonly crvsService: CrvsService) {}

  @Post('birth')      // Register live birth or stillbirth
  @Post('death')      // Register death + generate certificate
  @Get('death/:patientId')      // Get death certificate for patient
  @Post('mdsr')       // Submit maternal death notification
  @Get('mdsr')        // List MDSR notifications
  @Patch('mdsr/:id/review')     // Record committee review
}
```

All endpoints are JWT-guarded. Extract `tenantId` from `req.tenantId` (injected by `TenantMiddleware`).

---

## 8. Entity Registration

### In `services/ehr-service/src/services/tenant.service.ts`

Find the `entities: [` array in `getTenantDatabase()` and append:

```typescript
BirthNotification,
DeathCertificate,
MdsrNotification,
```

(Add the corresponding imports at the top of the file.)

### In `services/ehr-service/src/ehr.module.ts`

Add to `controllers: [...]`:
```typescript
CrvsController,
```

Add to `providers: [...]`:
```typescript
CrvsService,
```

(Add the corresponding imports at the top of the file.)

---

## 9. Frontend — CrvsDashboard

**File:** `ehr-frontend/src/pages/CrvsDashboard.tsx`

### Props
```typescript
interface CrvsDashboardProps {
  tenantSlug: string;
  token?: string;
}
```

### Tabs
1. **Birth Registration** — form to record a live birth or stillbirth; shows list of recent birth notifications with CRVS submission status badge
2. **Death Certificates** — form to record a death (ICD-10 cause required); shows list of death records with submission status
3. **MDSR / Perinatal Review** — form to submit a maternal death notification; table of MDSR records with committee review status; inline "Record Review" action on pending records

### Theme (match existing dashboards)
```
bg-slate-950      — page background
bg-slate-900/80   — card/panel background
border-slate-800  — card border
text-slate-300    — body text
text-white        — headings
```

### API calls (all via `ehrAxios`)
```typescript
import { ehrAxios } from '../services/api';

// Birth
ehrAxios.post(`/ehr/${tenantSlug}/crvs/birth`, body)
ehrAxios.get(`/ehr/${tenantSlug}/crvs/birth`)  // if you add a list endpoint

// Death
ehrAxios.post(`/ehr/${tenantSlug}/crvs/death`, body)
ehrAxios.get(`/ehr/${tenantSlug}/crvs/death/${patientId}`)

// MDSR
ehrAxios.post(`/ehr/${tenantSlug}/crvs/mdsr`, body)
ehrAxios.get(`/ehr/${tenantSlug}/crvs/mdsr`)
ehrAxios.patch(`/ehr/${tenantSlug}/crvs/mdsr/${id}/review`, body)
```

### Route in `App.tsx`

```typescript
const CrvsDashboard = lazy(() => import('./pages/CrvsDashboard'));

// In TenantScopedCrvsDashboard wrapper (same pattern as other wrappers):
<Route
  path="/ehr/:tenantSlug/crvs"
  element={
    <RoleProtectedRoute allowedRoles={['doctor', 'nurse', 'admin']}>
      <TenantScopedCrvsDashboard />
    </RoleProtectedRoute>
  }
/>
```

---

## 10. Spec Files

### `services/ehr-service/src/services/crvs.service.spec.ts`

Write focused unit tests for:
1. `registerBirth` — live birth stored with `submitted_to_crvs: false` when `CRVS_BASE_URL` is empty
2. `registerBirth` — stillbirth type stored correctly
3. `registerDeath` — death certificate created; CRVS API called when env vars present
4. `submitMdsr` — MDSR notification created
5. `reviewMdsr` — committee review fields persisted

Use the `Object.assign(process.env, TEST_ENV)` spec credential pattern (see Rule 3.1 above):
```typescript
const TEST_ENV: Record<string, string> = {
  CRVS_API_KEY: process.env.CRVS_API_KEY ?? 'ci-key-stub',
  CRVS_BASE_URL: process.env.CRVS_BASE_URL ?? 'https://crvs.example.test',
  CRVS_COUNTRY_CODE: process.env.CRVS_COUNTRY_CODE ?? 'ZW',
};
```

Mock `axios` with `jest.mock('axios')`.

---

## 11. New Env Vars

Add to `services/ehr-service/.env` (leave values blank — facility admins fill in their CRVS credentials):

```
# CRVS — Civil Registration & Vital Statistics
CRVS_BASE_URL=
CRVS_API_KEY=
CRVS_COUNTRY_CODE=ZW
ZIMSTAT_BASE_URL=
DHA_BASE_URL=
```

---

## 12. Done-When Checklist

- [ ] `tenant-crvs.statements.ts` created and registered in `database-provisioning.service.ts`
- [ ] Tenant repair run; `birth_notifications`, `death_certificates`, `mdsr_notifications` exist in all tenant DBs
- [ ] Three entities created and registered in both `tenant.service.ts` and `ehr.module.ts`
- [ ] `CrvsService` implements all 6 methods; CRVS API submission is env-driven with graceful no-config fallback
- [ ] `CrvsController` exposes all 6+ endpoints, all JWT-guarded
- [ ] `CrvsDashboard.tsx` has 3 tabs; all API calls use `ehrAxios`; no mocks
- [ ] Route added to `App.tsx`
- [ ] `crvs.service.spec.ts` covers at least 5 scenarios; credential pattern uses `Object.assign(process.env, TEST_ENV)`
- [ ] `npx tsc --noEmit` passes in `ehr-service`, `tenant-service`, and `ehr-frontend`
- [ ] `git diff --check` passes (no whitespace errors)
- [ ] No hardcoded credentials or production URLs anywhere in new files

---

## 13. Commit Message

```
feat: complete sprint 139 CRVS birth/death notification

Add birth notification, death certificate, and MDSR/perinatal review
workflows with env-driven submission to national CRVS APIs (ZIMSTAT,
DHA, generic MOH). Graceful fallback when CRVS not configured.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
