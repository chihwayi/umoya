# Sprint 230 — Occupational Medicine Core

**Module key:** `occupational_medicine`  
**Bundle ID:** `sprint230_occupational_medicine_core`  
**Version:** `2026.06.23.0`  
**Depends on:** none (standalone new module)  
**Followed by:** S231 (Surveillance & RTW)

---

## Sprint Goal

Add a fully functional Occupational Medicine (OEM) module: employer/corporate client registry, pre-employment physicals, fitness-for-duty (FFD) certificates, and employee–patient linkage. This is the foundation sprint — S231 builds surveillance and RTW on top of these tables.

---

## Scope

**IN:**
- Employer register (CRUD)
- Employee–patient linkage (one patient → many employers)
- Pre-employment physical encounter type + structured form
- Fitness-for-duty (FFD) evaluation + tiered certificate generation
- `OccupationalMedicineDashboard.tsx` (web)
- `OccupationalMedicineScreen.tsx` (mobile)
- `OccupationalMedicineController` registered in `ehr.module.ts`
- `occupational_medicine` added to `ALL_MODULE_KEYS` in `tenant.service.ts`
- Provisioning bundle in `database-provisioning.service.ts`

**OUT:** Drug testing, exposure monitoring, OSHA recording, RTW case management (→ S231)

---

## Cornerstone 1: Database Provisioning

### Step 1 — Add module key to `ALL_MODULE_KEYS`

**File:** `services/tenant-service/src/services/tenant.service.ts`

Locate `const ALL_MODULE_KEYS = [` (line ~99) and add:

```typescript
const ALL_MODULE_KEYS = [
  ...FULL_EHR_CORE_MODULES,
  ...CLAIMS_ONLY_CORE_MODULES,
  'hiv',
  'maternity',
  'radiology',
  'oncology',
  'cardiology',
  'diabetes',
  'pharmacy',
  'laboratory',
  'telemedicine',
  'patient_portal',
  'claims',
  'operating_room',
  'emergency',
  'ophthalmology',
  'blood_bank',
  'infection_control',
  'revenue_cycle',
  'population_health',
  'occupational_medicine',   // ← ADD THIS
] as const;
```

### Step 2 — Add provisioning bundle

**File:** `services/tenant-service/src/services/database-provisioning.service.ts`

Add at the END of `getProvisioningBundles()` array (after the `sprint228_partograph` bundle):

```typescript
{
  id: 'sprint230_occupational_medicine_core',
  label: 'Sprint 230 — Occupational Medicine: employer register, employee linkage, pre-employment physicals, FFD certificates',
  version: '2026.06.23.0',
  description: 'Foundation tables for the occupational medicine module: employers, employee_patient_links, oem_encounters, oem_certificates',
  statements: () => [
    // ── Employer / Corporate Client Register ──────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_employers (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name               TEXT NOT NULL,
      industry_sector    TEXT,
      nssa_number        TEXT,
      registration_number TEXT,
      contact_person     TEXT,
      contact_email      TEXT,
      contact_phone      TEXT,
      physical_address   TEXT,
      contracted_services JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes              TEXT,
      is_active          BOOLEAN NOT NULL DEFAULT TRUE,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_employers_name ON oem_employers(name)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_employers_active ON oem_employers(is_active)`,

    // ── Employee–Patient Linkage ───────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_employee_links (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      employer_id   UUID NOT NULL REFERENCES oem_employers(id) ON DELETE CASCADE,
      employee_number TEXT,
      job_title     TEXT,
      department    TEXT,
      start_date    DATE,
      end_date      DATE,
      is_current    BOOLEAN NOT NULL DEFAULT TRUE,
      hazard_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_oem_employee_links_uniq
      ON oem_employee_links(patient_id, employer_id)
      WHERE is_current = TRUE`,
    `CREATE INDEX IF NOT EXISTS idx_oem_employee_links_employer ON oem_employee_links(employer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_employee_links_patient ON oem_employee_links(patient_id)`,

    // ── OEM Encounters (pre-employment, periodic, FFD, etc.) ──────────────
    `CREATE TABLE IF NOT EXISTS oem_encounters (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      employer_id     UUID NOT NULL REFERENCES oem_employers(id) ON DELETE CASCADE,
      encounter_type  TEXT NOT NULL CHECK (encounter_type IN ('pre_employment','periodic','ffd','dot_transport','return_to_work','exit')),
      encounter_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      clinician_id    UUID REFERENCES users(id),
      job_title       TEXT,
      job_demands     TEXT,
      findings        JSONB NOT NULL DEFAULT '{}'::jsonb,
      vision_right_va TEXT,
      vision_left_va  TEXT,
      colour_vision   TEXT,
      hearing_right   TEXT,
      hearing_left    TEXT,
      bp_systolic     SMALLINT,
      bp_diastolic    SMALLINT,
      pulse           SMALLINT,
      bmi             NUMERIC(5,2),
      spirometry_fev1 NUMERIC(5,2),
      spirometry_fvc  NUMERIC(5,2),
      urinalysis      JSONB NOT NULL DEFAULT '{}'::jsonb,
      ecg_result      TEXT,
      xray_result     TEXT,
      blood_results   JSONB NOT NULL DEFAULT '{}'::jsonb,
      substance_screen_result TEXT CHECK (substance_screen_result IN ('negative','positive','inconclusive','not_done')),
      comorbidities   TEXT,
      current_medications TEXT,
      restrictions    TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_encounters_patient ON oem_encounters(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_encounters_employer ON oem_encounters(employer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_encounters_date ON oem_encounters(encounter_date DESC)`,

    // ── FFD / Fitness Certificates ────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS oem_certificates (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      oem_encounter_id UUID NOT NULL REFERENCES oem_encounters(id) ON DELETE CASCADE,
      patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      employer_id     UUID NOT NULL REFERENCES oem_employers(id) ON DELETE CASCADE,
      cert_type       TEXT NOT NULL CHECK (cert_type IN ('pre_employment','ffd','periodic','dot','exit')),
      fitness_category TEXT NOT NULL CHECK (fitness_category IN ('fit','fit_with_restrictions','temporarily_unfit','permanently_unfit')),
      restrictions_detail TEXT,
      valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
      valid_until     DATE,
      issued_by       UUID REFERENCES users(id),
      pdf_path        TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_oem_certs_patient ON oem_certificates(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_certs_employer ON oem_certificates(employer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_oem_certs_valid ON oem_certificates(valid_until)`,

    // ── Updated_at trigger for oem_encounters ─────────────────────────────
    `CREATE OR REPLACE TRIGGER trg_oem_encounters_updated_at
      BEFORE UPDATE ON oem_encounters
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,

    `CREATE OR REPLACE TRIGGER trg_oem_employers_updated_at
      BEFORE UPDATE ON oem_employers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
  ],
},
```

---

## Cornerstone 2: Backend — NestJS EHR Service

### Controller

**Create file:** `services/ehr-service/src/controllers/occupational-medicine.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OccupationalMedicineService } from '../services/occupational-medicine.service';

@UseGuards(JwtAuthGuard)
@Controller('oem')
export class OccupationalMedicineController {
  constructor(private readonly oem: OccupationalMedicineService) {}

  // ── Employers ──────────────────────────────────────────────────────────

  @Get('employers')
  listEmployers(@Req() req: any, @Query('active') active?: string) {
    return this.oem.listEmployers(req.tenantDb, active !== 'false');
  }

  @Post('employers')
  createEmployer(@Req() req: any, @Body() body: any) {
    return this.oem.createEmployer(req.tenantDb, body);
  }

  @Patch('employers/:id')
  updateEmployer(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.oem.updateEmployer(req.tenantDb, id, body);
  }

  // ── Employee links ──────────────────────────────────────────────────────

  @Get('employers/:id/employees')
  listEmployees(@Req() req: any, @Param('id') id: string) {
    return this.oem.listEmployeesByEmployer(req.tenantDb, id);
  }

  @Post('employee-links')
  linkEmployee(@Req() req: any, @Body() body: { patientId: string; employerId: string; jobTitle?: string; department?: string; hazardClasses?: string[] }) {
    return this.oem.linkEmployee(req.tenantDb, body);
  }

  @Get('patients/:patientId/employers')
  getPatientEmployers(@Req() req: any, @Param('patientId') patientId: string) {
    return this.oem.getPatientEmployers(req.tenantDb, patientId);
  }

  // ── Encounters ──────────────────────────────────────────────────────────

  @Post('encounters')
  createEncounter(
    @Req() req: any,
    @Body() body: {
      patientId: string;
      employerId: string;
      encounterType: string;
      jobTitle?: string;
      jobDemands?: string;
      findings?: Record<string, any>;
      bpSystolic?: number;
      bpDiastolic?: number;
      pulse?: number;
      bmi?: number;
      spirometryFev1?: number;
      spirometryFvc?: number;
      substanceScreenResult?: string;
      restrictions?: string;
      notes?: string;
    },
  ) {
    return this.oem.createEncounter(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/encounters')
  getPatientEncounters(@Req() req: any, @Param('patientId') patientId: string) {
    return this.oem.getPatientEncounters(req.tenantDb, patientId);
  }

  @Get('employers/:employerId/encounters')
  getEmployerEncounters(
    @Req() req: any,
    @Param('employerId') employerId: string,
    @Query('encounterType') encounterType?: string,
  ) {
    return this.oem.getEmployerEncounters(req.tenantDb, employerId, encounterType);
  }

  // ── Certificates ────────────────────────────────────────────────────────

  @Post('certificates')
  issueCertificate(
    @Req() req: any,
    @Body() body: {
      oemEncounterId: string;
      patientId: string;
      employerId: string;
      certType: string;
      fitnessCategory: 'fit' | 'fit_with_restrictions' | 'temporarily_unfit' | 'permanently_unfit';
      restrictionsDetail?: string;
      validUntil?: string;
    },
  ) {
    return this.oem.issueCertificate(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/certificates')
  getPatientCertificates(@Req() req: any, @Param('patientId') patientId: string) {
    return this.oem.getPatientCertificates(req.tenantDb, patientId);
  }

  // ── Dashboard summary ───────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.oem.getDashboardSummary(req.tenantDb);
  }
}
```

### Service (key methods)

**Create file:** `services/ehr-service/src/services/occupational-medicine.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class OccupationalMedicineService {

  async listEmployers(db: any, activeOnly = true): Promise<any[]> {
    const rows = await db.query(
      `SELECT id, name, industry_sector, nssa_number, contact_person, contact_email, contact_phone, is_active
       FROM oem_employers
       WHERE ($1 = FALSE OR is_active = TRUE)
       ORDER BY name`,
      [activeOnly],
    );
    return rows;
  }

  async createEmployer(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_employers (name, industry_sector, nssa_number, registration_number, contact_person, contact_email, contact_phone, physical_address, contracted_services, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       RETURNING *`,
      [body.name, body.industrySector, body.nssaNumber, body.registrationNumber, body.contactPerson, body.contactEmail, body.contactPhone, body.physicalAddress, JSON.stringify(body.contractedServices ?? []), body.notes],
    );
    return rows[0] ?? null;
  }

  async updateEmployer(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE oem_employers SET name=$1, industry_sector=$2, contact_person=$3, contact_email=$4, contact_phone=$5, is_active=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [body.name, body.industrySector, body.contactPerson, body.contactEmail, body.contactPhone, body.isActive ?? true, id],
    );
    return rows[0] ?? null;
  }

  async linkEmployee(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_employee_links (patient_id, employer_id, job_title, department, hazard_classes, is_current)
       VALUES ($1,$2,$3,$4,$5::jsonb,TRUE)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [body.patientId, body.employerId, body.jobTitle, body.department, JSON.stringify(body.hazardClasses ?? [])],
    );
    return rows[0] ?? null;
  }

  async listEmployeesByEmployer(db: any, employerId: string): Promise<any[]> {
    return db.query(
      `SELECT el.id, el.employee_number, el.job_title, el.department, el.hazard_classes,
              p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM oem_employee_links el
       JOIN patients p ON p.id = el.patient_id
       WHERE el.employer_id = $1 AND el.is_current = TRUE
       ORDER BY p.last_name, p.first_name`,
      [employerId],
    );
  }

  async getPatientEmployers(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT el.id, el.job_title, el.department, el.hazard_classes, el.is_current, el.start_date,
              e.name AS employer_name, e.industry_sector, e.nssa_number
       FROM oem_employee_links el
       JOIN oem_employers e ON e.id = el.employer_id
       WHERE el.patient_id = $1
       ORDER BY el.is_current DESC, el.start_date DESC`,
      [patientId],
    );
  }

  async createEncounter(db: any, clinicianId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_encounters (patient_id, employer_id, encounter_type, clinician_id, job_title, job_demands,
         bp_systolic, bp_diastolic, pulse, bmi, spirometry_fev1, spirometry_fvc,
         substance_screen_result, restrictions, notes, findings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       RETURNING *`,
      [body.patientId, body.employerId, body.encounterType, clinicianId, body.jobTitle, body.jobDemands,
       body.bpSystolic, body.bpDiastolic, body.pulse, body.bmi, body.spirometryFev1, body.spirometryFvc,
       body.substanceScreenResult, body.restrictions, body.notes, JSON.stringify(body.findings ?? {})],
    );
    return rows[0] ?? null;
  }

  async getPatientEncounters(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT oe.*, e.name AS employer_name
       FROM oem_encounters oe
       JOIN oem_employers e ON e.id = oe.employer_id
       WHERE oe.patient_id = $1
       ORDER BY oe.encounter_date DESC`,
      [patientId],
    );
  }

  async getEmployerEncounters(db: any, employerId: string, encounterType?: string): Promise<any[]> {
    return db.query(
      `SELECT oe.id, oe.encounter_type, oe.encounter_date, oe.fitness_category,
              p.first_name, p.last_name
       FROM oem_encounters oe
       JOIN patients p ON p.id = oe.patient_id
       WHERE oe.employer_id = $1 AND ($2::text IS NULL OR oe.encounter_type = $2)
       ORDER BY oe.encounter_date DESC`,
      [employerId, encounterType ?? null],
    );
  }

  async issueCertificate(db: any, issuedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO oem_certificates (oem_encounter_id, patient_id, employer_id, cert_type, fitness_category, restrictions_detail, valid_from, valid_until, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8)
       RETURNING *`,
      [body.oemEncounterId, body.patientId, body.employerId, body.certType, body.fitnessCategory, body.restrictionsDetail, body.validUntil ?? null, issuedBy],
    );
    return rows[0] ?? null;
  }

  async getPatientCertificates(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT oc.*, e.name AS employer_name, u.first_name AS issuer_first, u.last_name AS issuer_last
       FROM oem_certificates oc
       JOIN oem_employers e ON e.id = oc.employer_id
       LEFT JOIN users u ON u.id = oc.issued_by
       WHERE oc.patient_id = $1
       ORDER BY oc.created_at DESC`,
      [patientId],
    );
  }

  async getDashboardSummary(db: any): Promise<any> {
    const [employers, encounters, certs] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM oem_employers`),
      db.query(`SELECT encounter_type, COUNT(*) AS cnt FROM oem_encounters WHERE encounter_date >= CURRENT_DATE - 30 GROUP BY encounter_type`),
      db.query(`SELECT fitness_category, COUNT(*) AS cnt FROM oem_certificates WHERE valid_until >= CURRENT_DATE OR valid_until IS NULL GROUP BY fitness_category`),
    ]);
    return {
      employers: employers[0],
      recentEncounters: encounters,
      activeCertificates: certs,
    };
  }
}
```

### Module registration

**File:** `services/ehr-service/src/ehr.module.ts`

Add to `controllers: []`:
```typescript
OccupationalMedicineController,
```

Add to `providers: []`:
```typescript
OccupationalMedicineService,
```

Add imports at top:
```typescript
import { OccupationalMedicineController } from './controllers/occupational-medicine.controller';
import { OccupationalMedicineService } from './services/occupational-medicine.service';
```

---

## Cornerstone 3: Frontend Web UI

### Page

**Create file:** `ehr-frontend/src/pages/OccupationalMedicineDashboard.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Users, Building2, FileCheck, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface Employer { id: string; name: string; industry_sector: string; is_active: boolean; }
interface DashSummary { employers: { total: string; active: string }; recentEncounters: any[]; activeCertificates: any[]; }

const FITNESS_COLORS: Record<string, string> = {
  fit: '#1B6B3A',
  fit_with_restrictions: '#F0954A',
  temporarily_unfit: '#E8614D',
  permanently_unfit: '#C62828',
};

export default function OccupationalMedicineDashboard() {
  const [summary, setSummary] = useState<DashSummary | null>(null);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'employers' | 'encounter'>('dashboard');

  useEffect(() => {
    Promise.all([
      api.get('/oem/dashboard'),
      api.get('/oem/employers'),
    ]).then(([d, e]) => {
      setSummary(d.data ?? d);
      setEmployers(e.data ?? e);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#7A9CBC]">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#080E1A] text-[#E2EDF8] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans', letterSpacing: '-0.02em' }}>
          Occupational Medicine
        </h1>
        <p className="text-[#7A9CBC] text-sm mt-1">Workplace health, fitness-for-duty & employer surveillance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
        <StatCard icon={<Building2 size={20} />} label="Employers" value={summary?.employers.active ?? '—'} sub="active" color="#0AA98A" />
        <StatCard icon={<Users size={20} />} label="Encounters (30d)" value={summary?.recentEncounters.reduce((a, r) => a + Number(r.cnt), 0) ?? 0} color="#3B9EFF" />
        <StatCard icon={<FileCheck size={20} />} label="Fit Certificates" value={summary?.activeCertificates.find(c => c.fitness_category === 'fit')?.cnt ?? 0} color="#1B6B3A" />
        <StatCard icon={<AlertTriangle size={20} />} label="Unfit / Restricted" value={summary?.activeCertificates.filter(c => c.fitness_category !== 'fit').reduce((a, r) => a + Number(r.cnt), 0) ?? 0} color="#E8614D" />
      </div>

      {/* Employer List */}
      <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-5">
        <h2 className="text-base font-semibold mb-4">Corporate Clients</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7A9CBC] text-xs border-b border-[#162440]">
              <th className="text-left py-2">Employer</th>
              <th className="text-left py-2">Industry</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {employers.map(e => (
              <tr key={e.id} className="border-b border-[#162440] hover:bg-[#0C1528] cursor-pointer">
                <td className="py-3 font-medium">{e.name}</td>
                <td className="py-3 text-[#7A9CBC]">{e.industry_sector ?? '—'}</td>
                <td className="py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: e.is_active ? '#1B6B3A22' : '#3D607F22', color: e.is_active ? '#22C55E' : '#7A9CBC' }}>
                    {e.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: any; sub?: string; color: string }) {
  return (
    <div className="bg-[#111E35] rounded-[14px] border border-[#162440] p-4">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-xs text-[#7A9CBC] font-medium uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{value}</div>
      {sub && <div className="text-xs text-[#7A9CBC] mt-0.5">{sub}</div>}
    </div>
  );
}
```

### Add route to sidebar/navigation

In `ehr-frontend/src/App.tsx` (or router config), add:
```tsx
<Route path="/occupational-medicine" element={<OccupationalMedicineDashboard />} />
```

In the sidebar nav config, add:
```tsx
{ path: '/occupational-medicine', label: 'Occ. Medicine', icon: <Briefcase size={18} />, module: 'occupational_medicine' }
```

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/OccupationalMedicineScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Building2, FileCheck, Users } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Employer {
  id: string;
  name: string;
  industry_sector: string;
  is_active: boolean;
}

export default function OccupationalMedicineScreen() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/oem/employers')
      .then((r: any) => setEmployers(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={C.teal} />
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.heading}>Occupational Medicine</Text>
      <Text style={styles.sub}>Workplace health & fitness-for-duty</Text>

      <FlatList
        data={employers}
        keyExtractor={e => e.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardRow}>
              <Building2 size={18} color={C.teal} />
              <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            <Text style={styles.cardSub}>{item.industry_sector ?? 'General industry'}</Text>
            <View style={[styles.badge, { backgroundColor: item.is_active ? '#1B6B3A33' : '#3D607F33' }]}>
              <Text style={[styles.badgeText, { color: item.is_active ? C.green : C.textMuted }]}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No employers registered yet.</Text>
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:    { fontFamily: FONT.uiBd, fontSize: 22, color: C.text, marginBottom: 4 },
  sub:        { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  card:       { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.sm },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle:  { fontFamily: FONT.uiSb, fontSize: 15, color: C.text },
  cardSub:    { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  badge:      { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText:  { fontFamily: FONT.uiMd, fontSize: 11, letterSpacing: 0.5 },
  empty:      { fontFamily: FONT.ui, fontSize: 14, color: C.textMuted, textAlign: 'center', marginTop: 40 },
});
```

### Register in navigation

**File:** `mobile/src/navigation/RootNavigator.tsx`

```tsx
import OccupationalMedicineScreen from '../screens/OccupationalMedicineScreen';
// Add inside the Stack.Navigator:
<Stack.Screen name="OccupationalMedicine" component={OccupationalMedicineScreen} options={{ title: 'Occ. Medicine' }} />
```

---

## CDSS / AI Integration

### Python file: `services/cdss-service/occupational_medicine.py`

```python
from dataclasses import dataclass
from typing import Optional

# ── FFD Decision Support ──────────────────────────────────────────────────────

FFD_RULES = {
    "hypertension_stage2": {
        "condition": lambda v: v.get("bp_systolic", 0) > 160 or v.get("bp_diastolic", 0) > 100,
        "flag": "Blood pressure exceeds Stage 2 threshold (>160/100). Restrict from safety-critical roles (heights, heavy machinery) pending cardiology review.",
        "suggested_category": "fit_with_restrictions",
    },
    "spirometry_obstruction": {
        "condition": lambda v: (v.get("fev1_fvc_ratio", 1.0)) < 0.70 and v.get("spirometry_fev1", 100) < 60,
        "flag": "FEV1/FVC < 0.70 with FEV1 < 60% predicted. Significant obstruction. Consider respiratory surveillance protocol and restrict from dusty environments.",
        "suggested_category": "fit_with_restrictions",
    },
    "substance_positive": {
        "condition": lambda v: v.get("substance_screen_result") == "positive",
        "flag": "Positive substance screen. Employee must not operate vehicles or heavy machinery. Refer to EAP/SAP before return-to-work clearance.",
        "suggested_category": "temporarily_unfit",
    },
}


def evaluate_ffd(vitals: dict) -> dict:
    """
    Returns a fitness-for-duty recommendation based on structured encounter vitals.
    Called by POST /oem/cdss/ffd-eval
    """
    flags = []
    suggested_category = "fit"

    for rule_name, rule in FFD_RULES.items():
        if rule["condition"](vitals):
            flags.append({"rule": rule_name, "message": rule["flag"]})
            # Escalate category: permanently_unfit > temporarily_unfit > fit_with_restrictions > fit
            escalation = ["fit", "fit_with_restrictions", "temporarily_unfit", "permanently_unfit"]
            current_idx = escalation.index(suggested_category)
            new_idx = escalation.index(rule["suggested_category"])
            if new_idx > current_idx:
                suggested_category = rule["suggested_category"]

    return {
        "suggested_fitness_category": suggested_category,
        "flags": flags,
        "requires_specialist_review": len(flags) > 0,
    }
```

### Expose endpoint in `services/cdss-service/main.py`

```python
from occupational_medicine import evaluate_ffd

@app.post("/oem/cdss/ffd-eval")
async def ffd_evaluation(body: dict):
    return evaluate_ffd(body.get("vitals", {}))
```

---

## Acceptance Criteria

- [ ] `oem_employers`, `oem_employee_links`, `oem_encounters`, `oem_certificates` tables provision on new tenant creation
- [ ] `POST /oem/employers` creates employer; `GET /oem/employers` returns list
- [ ] `POST /oem/employee-links` links a patient to an employer
- [ ] `POST /oem/encounters` records pre-employment or FFD encounter
- [ ] `POST /oem/certificates` issues fitness certificate with correct `fitness_category`
- [ ] `GET /oem/dashboard` returns summary stats
- [ ] `POST /oem/cdss/ffd-eval` returns suggested category + flags
- [ ] `OccupationalMedicineDashboard.tsx` renders employer list + stat cards
- [ ] `OccupationalMedicineScreen.tsx` renders on mobile using `C`, `FONT`, `RADIUS`, `SHADOW` tokens
- [ ] `'occupational_medicine'` appears in `ALL_MODULE_KEYS`
- [ ] Smoke test passes (`npm run test:smoke` in `services/tenant-service`)
