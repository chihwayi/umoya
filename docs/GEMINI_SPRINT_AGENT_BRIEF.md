# MediCore — Gemini Sprint Agent Brief
## Sprints S130–S146: SADC Health System Completion

**Created:** 2026-04-09
**Your Role:** Implement each sprint fully — DB provisioning, backend, CDSS, frontend.
**Reviewer:** Claude (signs off each sprint before you move to the next).

---

## 1. Project Overview

MediCore is a multi-tenant, AI-first Electronic Health Record system targeting the 16 SADC (Southern African Development Community) member states. It is a production system — every line of code you write goes into production.

### Monorepo Layout
```
/
├── services/
│   ├── tenant-service/          NestJS — tenant CRUD, DB provisioning, subscription
│   │   └── src/
│   │       ├── generated/       ← DB provisioning statement files (one per bundle)
│   │       └── services/
│   │           └── database-provisioning.service.ts  ← bundle registry
│   ├── ehr-service/             NestJS — clinical records, EHR APIs
│   │   └── src/
│   │       ├── controllers/
│   │       ├── services/
│   │       ├── entities/
│   │       ├── guards/
│   │       └── ehr.module.ts    ← register new controllers/services here
│   ├── cdss-service/            Python FastAPI — AI, DHIS2, SORMAS, external integrations
│   │   ├── main.py              ← register new routers here
│   │   ├── diagnostic_assistant.py
│   │   ├── dhis2_tracker.py
│   │   └── ingest_guidelines.py
│   └── auth-service/            NestJS — JWT, RBAC
├── ehr-frontend/                React 18 + TypeScript + TailwindCSS
│   └── src/
│       ├── pages/               ← new dashboards go here
│       ├── components/
│       ├── services/
│       │   └── api.ts           ← ehrAxios, tenantApi, cdssAxios
│       └── App.tsx              ← routing, register new routes here
└── docs/
    └── SADC_SPRINTS_S129_S146_MASTER_GUIDE.md  ← full sprint specs
```

### Tech Stack
| Layer | Tech |
|---|---|
| EHR backend | NestJS (TypeScript), TypeORM, PostgreSQL |
| CDSS | Python 3.11, FastAPI, httpx, pydantic |
| Frontend | React 18, TypeScript, TailwindCSS, lucide-react, recharts |
| Database | PostgreSQL 15 per tenant (separate DB per tenant) |
| Auth | JWT, `JwtAuthGuard`, `RequestWithTenant` middleware |
| Inter-service | REST over internal Docker network |

---

## 2. Non-Negotiable Rules (All Sprints)

### Rule 1 — Database Changes MUST Use DatabaseProvisioningService

**Never** create tables or ALTER columns with direct SQL. Every schema change goes through:

**Step A: Create provisioning statements file**
```typescript
// File: services/tenant-service/src/generated/tenant-{sprint-name}.statements.ts
export const TENANT_{NAME}_BUNDLE_VERSION = '2026.04.09.{N}';
export const TENANT_{NAME}_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS your_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_col VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_your_table_col ON your_table(tenant_col)`,
];
```
- All SQL must be **idempotent** (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Use `gen_random_uuid()` for primary keys.
- Include `created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL` on every table.

**Step B: Register the bundle**
```typescript
// File: services/tenant-service/src/services/database-provisioning.service.ts
// Add to getProvisioningBundles() return array:
import { TENANT_{NAME}_BUNDLE_VERSION, TENANT_{NAME}_STATEMENTS } from '../generated/tenant-{sprint-name}.statements';

{
  id: '{sprint-id}',
  label: '{Human Readable Label}',
  version: TENANT_{NAME}_BUNDLE_VERSION,
  description: 'S1XX — brief description',
  statements: () => TENANT_{NAME}_STATEMENTS,
},
```

**Step C: Run tenant repair**
After registering, call the tenant repair endpoint so every existing tenant's database gets the new tables:
```bash
curl -X POST http://localhost:3001/admin/repair-all-tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
Or if running in Docker:
```bash
docker exec medicore-tenant-service curl -X POST http://localhost:3001/admin/repair-all-tenants
```

**Step D: Confirm the schema exists**
Query one tenant database to confirm:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('your_new_table', 'another_table');
```

### Rule 2 — No Mock Data

- Zero `setTimeout(() => resolve(fakeData), 500)` patterns.
- Zero hardcoded arrays of fake patients/records.
- Zero `Math.random()` for chart data.
- If the endpoint doesn't exist yet — **create it** in the same sprint before the frontend uses it.
- Remove any existing mocks you find in touched files.

### Rule 3 — Code Quality Gate Before Every Commit

```bash
# EHR service (TypeScript)
cd services/ehr-service && npx tsc --noEmit
npm run build -w @medicore/ehr-service

# CDSS service (Python)
cd services/cdss-service && python -m py_compile main.py dhis2_tracker.py {new_file}.py

# Frontend (TypeScript)
npx tsc --noEmit -p ehr-frontend/tsconfig.json
npm run build -w medicore-ehr-frontend
```

All must pass with zero errors before committing.

### Rule 4 — TypeScript Entity Patterns (EHR Service)

```typescript
// services/ehr-service/src/entities/example.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('your_table_name')
export class YourEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'status', default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

### Rule 5 — NestJS Controller/Service Pattern

```typescript
// Controller
import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@UseGuards(JwtAuthGuard)
@Controller('your-module')
export class YourController {
  constructor(private readonly yourService: YourService) {}

  @Post()
  async create(@Body() body: any, @Request() req: RequestWithTenant) {
    const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
    return this.yourService.create(req.tenantId, userId, body);
  }
}
```

```typescript
// Service — always use TenantService to get DB connection
import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class YourService {
  constructor(private tenantService: TenantService) {}

  async create(tenantId: string, userId: string, body: any) {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const repo = db.getRepository(YourEntity);
    const entity = repo.create({ ...body, createdBy: userId });
    return repo.save(entity);
  }
}
```

### Rule 6 — Register in ehr.module.ts

```typescript
// services/ehr-service/src/ehr.module.ts
// Add to controllers: [..., YourController]
// Add to providers: [..., YourService]
```

### Rule 7 — FastAPI Router Pattern (CDSS Service)

```python
# services/cdss-service/your_module.py
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import httpx, os

router = APIRouter(prefix="/your-module", tags=["your-module"])

class YourRequest(BaseModel):
    field: str

@router.post("/action")
async def do_action(body: YourRequest, x_tenant_id: str = Header(...)):
    ehr_base = os.getenv("EHR_SERVICE_URL", "http://ehr-service:3000").rstrip("/")
    service_token = os.getenv("INTERNAL_SERVICE_TOKEN", "")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{ehr_base}/your-endpoint",
            headers={"X-Tenant-ID": x_tenant_id, "Authorization": f"Bearer {service_token}"},
            json=body.dict(),
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"EHR call failed: {resp.text[:200]}")
    return resp.json()
```

Register in `main.py`:
```python
from your_module import router as your_module_router
app.include_router(your_module_router)
```

### Rule 8 — Frontend Patterns

```typescript
// Always use ehrAxios from services/api.ts
import { ehrAxios } from '../services/api';

// Auth headers pattern
const token = localStorage.getItem('ehr_token') || '';
const tenantSlug = useParams<{ tenantSlug: string }>().tenantSlug;

const resp = await ehrAxios.get('/your-endpoint', {
  headers: {
    'X-Tenant-ID': tenantSlug!,
    Authorization: `Bearer ${token}`,
  },
});
```

```typescript
// Notifications — always use (title, message) signature
import { useNotification } from '../components/GlobalNotification';
const { showSuccess, showError } = useNotification();

showSuccess('Success', 'Record saved.');
showError('Error', 'Failed to load data.');
```

```typescript
// Route registration in App.tsx
const YourDashboard = lazy(() => import('./pages/YourDashboard'));

// In Routes:
<Route
  path="/ehr/:tenantSlug/your-module"
  element={
    <RoleProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']} moduleKey="your_module">
      <YourDashboard />
    </RoleProtectedRoute>
  }
/>
```

### Rule 9 — UI/UX Standards

The frontend uses a dark-first EHR theme with TailwindCSS. Match the existing design:
- Background: `bg-slate-950` (page), `bg-slate-900/80` (cards), `border border-slate-800`
- Text: `text-slate-200` (primary), `text-slate-400` (secondary), `text-slate-500` (muted)
- Accent: `text-blue-400`, `bg-blue-500/20`, `border-blue-500/30`
- Success: `text-green-400`, `bg-green-500/20`
- Warning: `text-yellow-400`, `bg-yellow-500/20`
- Error/Danger: `text-red-400`, `bg-red-500/20`
- Buttons: `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium`
- Loading: use `Loader2` from `lucide-react` with `animate-spin`
- Icons: `lucide-react` only (already installed)
- Charts: `recharts` (already installed) — `BarChart`, `LineChart`, `PieChart`
- Tabs: plain `<div>` with active border-bottom `border-b-2 border-blue-500`

Look at existing dashboards like `ehr-frontend/src/pages/InfectionControlDashboard.tsx` or `ehr-frontend/src/pages/PopulationHealthDashboard.tsx` for UI reference.

---

## 3. Sprint Specifications (S130–S146)

The full specifications for each sprint are in:
```
docs/SADC_SPRINTS_S129_S146_MASTER_GUIDE.md
```

Read this file to get the exact SQL, endpoint list, external API contracts, and done criteria for each sprint.

### Sprint Version Map for Provisioning Bundles
| Sprint | Bundle Version |
|---|---|
| S130 | 2026.04.09.2 |
| S131 | 2026.04.09.3 |
| S132 | 2026.04.09.4 |
| S133 | 2026.04.09.5 |
| S134 | 2026.04.09.6 |
| S135 | 2026.04.09.7 |
| S136 | 2026.04.09.8 |
| S137 | 2026.04.09.9 |
| S138 | 2026.04.09.10 |
| S139 | 2026.04.09.11 |
| S140 | 2026.04.09.12 |
| S141 | 2026.04.09.13 |
| S142 | 2026.04.09.14 |
| S143 | 2026.04.09.15 |
| S144 | 2026.04.09.16 |
| S145 | 2026.04.09.17 |
| S146 | 2026.04.09.18 |

---

## 4. Per-Sprint Workflow (Follow This Every Time)

### Step 1: Read the sprint spec
Open `docs/SADC_SPRINTS_S129_S146_MASTER_GUIDE.md` and read the full section for the sprint you're implementing.

### Step 2: Create the DB provisioning bundle
- File in `services/tenant-service/src/generated/`
- Register in `services/tenant-service/src/services/database-provisioning.service.ts`
- All SQL idempotent

### Step 3: Build EHR Service backend
- New entities in `services/ehr-service/src/entities/`
- New service in `services/ehr-service/src/services/`
- New controller in `services/ehr-service/src/controllers/`
- Register in `services/ehr-service/src/ehr.module.ts`

### Step 4: Build CDSS Python integration (if sprint requires it)
- New router file in `services/cdss-service/`
- Register in `services/cdss-service/main.py`
- Wire to real external APIs (SORMAS, DHIS2, Africa's Talking, OpenMRS, etc.)
- All credentials from environment variables

### Step 5: Build Frontend dashboard
- New page in `ehr-frontend/src/pages/`
- Register in `ehr-frontend/src/App.tsx`
- All data from real API calls — no mock data
- Match the existing dark EHR theme

### Step 6: Run quality gates
```bash
npx tsc --noEmit -p ehr-frontend/tsconfig.json  # Must pass
npx tsc --noEmit -p services/ehr-service/tsconfig.json  # Must pass
python -m py_compile services/cdss-service/main.py  # Must pass
```

### Step 7: Commit
```bash
git add [changed files]
git commit -m "feat(s1XX): [description]

Co-Authored-By: Gemini <noreply@google.com>"
```

### Step 8: Notify Claude for review
After committing, tell Claude:
> "Sprint S1XX is complete. Commit: [hash]. Please review."

Claude will review and either sign off or return a list of corrections.

---

## 5. Key Reference Files

### Existing patterns to follow:
- **Provisioning bundle example**: `services/tenant-service/src/generated/tenant-epi-registry.statements.ts`
- **Entity example**: `services/ehr-service/src/entities/aefi-report.entity.ts`
- **Service example**: `services/ehr-service/src/services/epi.service.ts`
- **Controller example**: `services/ehr-service/src/controllers/epi.controller.ts`
- **CDSS router example**: `services/cdss-service/dhis2_tracker.py`
- **Frontend dashboard example**: `ehr-frontend/src/pages/ImmunizationDashboard.tsx`
- **App.tsx routing example**: last route added is `/ehr/:tenantSlug/immunization`

### Existing API clients in frontend:
- `ehrAxios` — calls EHR service (port 3000 in dev)
- `cdssAxios` — calls CDSS service (port 8000 in dev)
- `tenantApi` — calls tenant service (port 3001 in dev)
All defined in `ehr-frontend/src/services/api.ts`.

### Auth guards:
- `JwtAuthGuard` — use on all new controllers
- `RequestWithTenant` — typed request gives you `req.tenantId` and `req.user`

---

## 6. External API Contracts Per Sprint

### S130 — SORMAS (Outbreak Surveillance)
```
Base URL: SORMAS_BASE_URL env var
Auth: Basic base64(SORMAS_USERNAME:SORMAS_PASSWORD)
POST {SORMAS_BASE_URL}/sormas-rest/cases/push — push a case JSON
GET  {SORMAS_BASE_URL}/sormas-rest/cases/{uuid} — fetch case status
SORMAS case schema: https://github.com/hzi-braunschweig/SORMAS-Project/blob/development/sormas-api/src/main/java/de/symeda/sormas/api/caze/CaseDataDto.java
```

### S135 — Africa's Talking SMS/USSD
```
Base URL: https://api.africastalking.com/version1
API Key: AFRICASTALKING_API_KEY env var
Username: AFRICASTALKING_USERNAME env var
POST /messaging — send SMS
Content-Type: application/x-www-form-urlencoded
Body: username={username}&to={phone}&message={text}&from={shortcode}
```

### S136 — OpenMRS Import
```
Base URL: OPENMRS_BASE_URL env var
Auth: Basic base64(OPENMRS_USERNAME:OPENMRS_PASSWORD)
GET  {base}/ws/rest/v1/patient?q={name}&v=full
GET  {base}/ws/rest/v1/obs?patient={uuid}&concept={uuid}&v=full
POST {base}/ws/rest/v1/patient — create patient
```

### S139 — mhGAP Mental Health (WHO mhGAP API)
```
Use CDSS for all mhGAP screening logic (PHQ-9, GAD-7, AUDIT-C)
No external API — screening logic is rule-based in CDSS
Store results in ehr-service PostgreSQL
```

### S142 — OpenLMIS / GS1
```
Base URL: OPENLMIS_BASE_URL env var
Auth: Bearer OPENLMIS_API_KEY
GET  {base}/api/stockCards — stock levels
GET  {base}/api/requisitions — pending orders
POST {base}/api/requisitions — submit requisition
```

### S144 — PACTR Clinical Trial Matching
```
PACTR API: https://pactr.samrc.ac.za/api/
GET /api/trials?condition={condition}&country={countryCode}
No auth required (public API)
```

### DHIS2 Aggregate (used in multiple sprints)
```
Base URL: DHIS2_BASE_URL env var
Auth: Basic base64(DHIS2_USERNAME:DHIS2_PASSWORD)
POST {base}/api/dataValueSets — push aggregate data
GET  {base}/api/dataValueSets?dataSet={ds}&period={period}&orgUnit={ou}
```

---

## 7. What Claude Will Check (Sign-off Criteria)

Claude will review each sprint commit and check:

1. **DB provisioning complete** — new statements file exists, registered in `getProvisioningBundles()`, idempotent SQL.
2. **No mock data** — no `setTimeout`, no hardcoded arrays, no `Math.random()`.
3. **TypeScript zero errors** — `tsc --noEmit` passes on both ehr-service and ehr-frontend.
4. **Python syntax clean** — all new `.py` files parse without error.
5. **Real API calls** — frontend fetches from real endpoints, CDSS calls real external APIs.
6. **UI matches design system** — dark slate theme, lucide icons, recharts for charts.
7. **Module registered** — controller/service in `ehr.module.ts`, router in `main.py`, route in `App.tsx`.
8. **Correct auth** — all routes use `JwtAuthGuard`, all requests send `X-Tenant-ID` + `Authorization`.
9. **Commit message format** — `feat(s1XX): ...` with Co-Author footer.

If any of these fail, Claude will return corrections. Fix them and re-commit before moving to the next sprint.

---

## 8. Sprint Order

Implement in this exact order. Do not skip ahead.

1. **S130** — Outbreak Surveillance + Notifiable Disease Alerts
2. **S131** — Mobile Money + Health Insurance Premium Collection
3. **S132** — Community Health Worker (CHW) Module
4. **S133** — SAM/CMAM Severe Acute Malnutrition
5. **S134** — NHIF / CBHI National Health Insurance Integration
6. **S135** — South Africa HPCSA + NHI Interoperability
7. **S136** — DHIS2 Tracker + DATIM Advanced Sync
8. **S137** — Africa's Talking SMS/USSD Patient Engagement
9. **S138** — OpenMRS Patient Import + Bidirectional Sync
10. **S139** — CRVS (Civil Registration + Vital Statistics)
11. **S140** — NTD / Malaria Integrated Case Management
12. **S141** — mhGAP Mental Health Gap Action Programme
13. **S142** — Multi-language Clinical Forms (French, Portuguese, Swahili, Zulu)
14. **S143** — Traditional Medicine Integration
15. **S144** — Refugee + IDP Workflows (UNHCR)
16. **S145** — OpenLMIS / GS1 Supply Chain Integration
17. **S146** — PACTR / One Health Surveillance

---

## 9. How to Start

1. Read `docs/SADC_SPRINTS_S129_S146_MASTER_GUIDE.md` fully.
2. Start with Sprint S130.
3. Follow the Per-Sprint Workflow (Section 4) exactly.
4. After each sprint commit, tell Claude: **"Sprint S130 complete. Commit: [hash]. Please review."**
5. Wait for Claude's sign-off before starting S131.

Do not batch multiple sprints into one commit. Each sprint is one git commit (or a small set of commits if the sprint has multiple workstreams).

---

## 10. Environment Variables Reference

All external credentials come from environment variables. Never hardcode them. Add to `docker-compose.yml` under the appropriate service's `environment:` block.

| Variable | Service | Purpose |
|---|---|---|
| `DHIS2_BASE_URL` | cdss-service | DHIS2 instance URL |
| `DHIS2_USERNAME` | cdss-service | DHIS2 service account |
| `DHIS2_PASSWORD` | cdss-service | DHIS2 service account password |
| `DHIS2_EPI_PROGRAM` | cdss-service | EPI tracker program UID |
| `DHIS2_ORG_UNIT` | cdss-service | Default org unit UID |
| `SORMAS_BASE_URL` | cdss-service | SORMAS instance URL |
| `SORMAS_USERNAME` | cdss-service | SORMAS service account |
| `SORMAS_PASSWORD` | cdss-service | SORMAS service account password |
| `AFRICASTALKING_API_KEY` | cdss-service | Africa's Talking API key |
| `AFRICASTALKING_USERNAME` | cdss-service | Africa's Talking username |
| `OPENMRS_BASE_URL` | cdss-service | OpenMRS instance URL |
| `OPENMRS_USERNAME` | cdss-service | OpenMRS service account |
| `OPENMRS_PASSWORD` | cdss-service | OpenMRS service account password |
| `OPENLMIS_BASE_URL` | cdss-service | OpenLMIS instance URL |
| `OPENLMIS_API_KEY` | cdss-service | OpenLMIS API key |
| `EHR_SERVICE_URL` | cdss-service | Internal EHR service URL (default: http://ehr-service:3000) |
| `INTERNAL_SERVICE_TOKEN` | cdss-service | Service-to-service JWT |

When adding new env vars, also add placeholder entries (empty string) to `docker-compose.yml` so the service starts cleanly without crashing.
