# Sprint 239 — EPI / Immunisation Management

**Module key:** `immunisation`  
**Bundle ID:** `sprint239_epi_immunisation`  
**Version:** `2026.06.23.0`  
**Depends on:** `well_baby_clinic` (S238 — patients and WBC visits used here)  
**Followed by:** S240 (Neonatal Screening)

---

## Sprint Goal

Implement a complete Zimbabwe MOHCC Expanded Programme on Immunisation (EPI): schedule-driven vaccination records, digital vaccination card / child health booklet, cold chain temperature logging, defaulter (missed dose) management with SMS outreach task creation, AEFI reporting, and facility-level EPI coverage dashboard.

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint239_epi_immunisation',
  label: 'Sprint 239 — EPI/Immunisation: Zimbabwe EPI schedule, vaccination records, cold chain, AEFI, coverage reporting',
  version: '2026.06.23.0',
  description: 'vaccine_catalog (Zimbabwe EPI antigens), vaccination_records, cold_chain_logs, aefi_reports, epi_outreach_tasks',
  statements: () => [
    // ── Vaccine Catalog ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS vaccine_catalog (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      antigen_code     TEXT NOT NULL UNIQUE,
      antigen_name     TEXT NOT NULL,
      schedule_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
      min_age_weeks    SMALLINT,
      max_age_years    SMALLINT,
      doses_required   SMALLINT NOT NULL DEFAULT 1,
      interval_weeks   SMALLINT,
      route            TEXT CHECK (route IN ('im','sc','oral','id','intranasal')),
      site             TEXT,
      storage_min_c    NUMERIC(4,1) NOT NULL DEFAULT 2.0,
      storage_max_c    NUMERIC(4,1) NOT NULL DEFAULT 8.0,
      is_live_vaccine  BOOLEAN NOT NULL DEFAULT FALSE,
      is_active        BOOLEAN NOT NULL DEFAULT TRUE
    )`,
    // Seed Zimbabwe EPI schedule antigens
    `INSERT INTO vaccine_catalog (antigen_code, antigen_name, doses_required, schedule_contacts, min_age_weeks, route, site, is_live_vaccine)
     VALUES
       ('BCG','BCG (Bacillus Calmette-Guérin)',1,'["birth"]'::jsonb,0,'id','left_upper_arm',TRUE),
       ('OPV0','OPV Birth Dose',1,'["birth"]'::jsonb,0,'oral',NULL,TRUE),
       ('OPV1','OPV Dose 1',1,'["6_weeks"]'::jsonb,6,'oral',NULL,TRUE),
       ('OPV2','OPV Dose 2',1,'["10_weeks"]'::jsonb,10,'oral',NULL,TRUE),
       ('OPV3','OPV Dose 3',1,'["14_weeks"]'::jsonb,14,'oral',NULL,TRUE),
       ('IPV','IPV (Injectable Polio)',1,'["14_weeks"]'::jsonb,14,'im','right_thigh',FALSE),
       ('PENTA1','Pentavalent (DPT-HepB-Hib) Dose 1',1,'["6_weeks"]'::jsonb,6,'im','left_thigh',FALSE),
       ('PENTA2','Pentavalent Dose 2',1,'["10_weeks"]'::jsonb,10,'im','left_thigh',FALSE),
       ('PENTA3','Pentavalent Dose 3',1,'["14_weeks"]'::jsonb,14,'im','left_thigh',FALSE),
       ('PCV1','PCV10 Dose 1',1,'["6_weeks"]'::jsonb,6,'im','right_thigh',FALSE),
       ('PCV2','PCV10 Dose 2',1,'["10_weeks"]'::jsonb,10,'im','right_thigh',FALSE),
       ('PCV3','PCV10 Dose 3',1,'["14_weeks"]'::jsonb,14,'im','right_thigh',FALSE),
       ('ROTA1','Rotavirus Dose 1',1,'["6_weeks"]'::jsonb,6,'oral',NULL,TRUE),
       ('ROTA2','Rotavirus Dose 2',1,'["10_weeks"]'::jsonb,10,'oral',NULL,TRUE),
       ('MR1','Measles-Rubella Dose 1',1,'["9_months"]'::jsonb,36,'sc','left_upper_arm',TRUE),
       ('MR2','Measles-Rubella Dose 2',1,'["18_months"]'::jsonb,72,'sc','left_upper_arm',TRUE),
       ('YF','Yellow Fever',1,'["9_months"]'::jsonb,36,'sc','right_upper_arm',TRUE),
       ('HPV1','HPV Dose 1 (girls 10yr)',1,'["10_years"]'::jsonb,520,'im','left_upper_arm',FALSE),
       ('HPV2','HPV Dose 2 (girls, 6m later)',1,'["10_years_6m"]'::jsonb,546,'im','left_upper_arm',FALSE)
     ON CONFLICT DO NOTHING`,

    // ── Vaccination Records ────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS vaccination_records (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      antigen_code     TEXT NOT NULL,
      dose_number      SMALLINT NOT NULL DEFAULT 1,
      given_at         DATE NOT NULL DEFAULT CURRENT_DATE,
      age_at_dose_weeks SMALLINT,
      lot_number       TEXT,
      expiry_date      DATE,
      site_given       TEXT,
      administered_by  UUID REFERENCES users(id),
      batch_verified   BOOLEAN NOT NULL DEFAULT FALSE,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_vacc_records_uniq ON vaccination_records(patient_id, antigen_code, dose_number)`,
    `CREATE INDEX IF NOT EXISTS idx_vacc_records_patient ON vaccination_records(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vacc_records_antigen ON vaccination_records(antigen_code)`,

    // ── Cold Chain Temperature Log ─────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS cold_chain_logs (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fridge_id        TEXT NOT NULL,
      recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      temp_celsius     NUMERIC(4,1) NOT NULL,
      recorded_by      UUID REFERENCES users(id),
      is_excursion     BOOLEAN GENERATED ALWAYS AS (temp_celsius < 2.0 OR temp_celsius > 8.0) STORED,
      excursion_type   TEXT GENERATED ALWAYS AS (
                         CASE WHEN temp_celsius < 2.0 THEN 'freeze_risk'
                              WHEN temp_celsius > 8.0 THEN 'heat_excursion'
                              ELSE NULL END
                       ) STORED,
      notes            TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cold_chain_fridge ON cold_chain_logs(fridge_id, recorded_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_cold_chain_excursion ON cold_chain_logs(is_excursion) WHERE is_excursion = TRUE`,

    // ── AEFI Reports ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aefi_reports (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      vaccination_id   UUID REFERENCES vaccination_records(id),
      antigen_code     TEXT NOT NULL,
      onset_date       DATE NOT NULL,
      reported_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      classification   TEXT NOT NULL CHECK (classification IN ('minor','moderate','severe','death')),
      aefi_type        TEXT NOT NULL,
      description      TEXT NOT NULL,
      outcome          TEXT CHECK (outcome IN ('recovered','recovering','unknown','permanent_disability','death')),
      reported_to_epi  BOOLEAN NOT NULL DEFAULT FALSE,
      reported_by      UUID REFERENCES users(id),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aefi_patient ON aefi_reports(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_aefi_antigen ON aefi_reports(antigen_code)`,

    // ── EPI Coverage View ──────────────────────────────────────────────────
    `CREATE OR REPLACE VIEW epi_coverage_summary AS
      SELECT
        antigen_code,
        COUNT(DISTINCT patient_id) AS vaccinated_count,
        DATE_TRUNC('month', given_at) AS month
      FROM vaccination_records
      GROUP BY antigen_code, DATE_TRUNC('month', given_at)
      ORDER BY month DESC, antigen_code`,
  ],
},
```

**Add `immunisation` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/immunisation.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ImmunisationService } from '../services/immunisation.service';

@UseGuards(JwtAuthGuard)
@Controller('immunisation')
export class ImmunisationController {
  constructor(private readonly imm: ImmunisationService) {}

  @Get('catalog')
  getCatalog(@Req() req: any) {
    return this.imm.getCatalog(req.tenantDb);
  }

  @Post('records')
  recordVaccination(
    @Req() req: any,
    @Body() body: {
      patientId: string; antigenCode: string; doseNumber?: number;
      lotNumber?: string; expiryDate?: string; siteGiven?: string; notes?: string;
    },
  ) {
    return this.imm.recordVaccination(req.tenantDb, req.user.id, body);
  }

  @Get('patients/:patientId/records')
  getPatientRecord(@Req() req: any, @Param('patientId') patientId: string) {
    return this.imm.getPatientVaccinationRecord(req.tenantDb, patientId);
  }

  @Get('patients/:patientId/schedule')
  getSchedule(@Req() req: any, @Param('patientId') patientId: string) {
    return this.imm.getVaccinationSchedule(req.tenantDb, patientId);
  }

  @Post('cold-chain')
  logColdChain(
    @Req() req: any,
    @Body() body: { fridgeId: string; tempCelsius: number; notes?: string },
  ) {
    return this.imm.logColdChain(req.tenantDb, req.user.id, body);
  }

  @Get('cold-chain/excursions')
  getColdChainExcursions(@Req() req: any) {
    return this.imm.getColdChainExcursions(req.tenantDb);
  }

  @Post('aefi')
  reportAefi(@Req() req: any, @Body() body: any) {
    return this.imm.reportAefi(req.tenantDb, req.user.id, body);
  }

  @Get('coverage')
  getCoverage(@Req() req: any) {
    return this.imm.getCoverage(req.tenantDb);
  }

  @Get('defaulters')
  getDefaulters(@Req() req: any, @Query('days') days?: string) {
    return this.imm.getDefaulters(req.tenantDb, Number(days ?? 30));
  }
}
```

**Create file:** `services/ehr-service/src/services/immunisation.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// Next contact schedule: Zimbabwe MOHCC MNCH contact ages in weeks
const CONTACT_AGE_WEEKS: Record<string, number> = {
  birth: 0, '6_weeks': 6, '10_weeks': 10, '14_weeks': 14,
  '6_months': 26, '9_months': 39, '18_months': 78, '24_months': 104,
  '10_years': 520,
};

@Injectable()
export class ImmunisationService {

  async getCatalog(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM vaccine_catalog WHERE is_active ORDER BY min_age_weeks, antigen_code`);
  }

  async recordVaccination(db: any, administeredBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO vaccination_records (patient_id, antigen_code, dose_number, lot_number, expiry_date, site_given, administered_by, notes)
       VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8)
       ON CONFLICT (patient_id, antigen_code, dose_number) DO NOTHING
       RETURNING *`,
      [body.patientId, body.antigenCode, body.doseNumber ?? 1, body.lotNumber, body.expiryDate ?? null, body.siteGiven, administeredBy, body.notes],
    );
    return rows[0] ?? { conflict: 'Dose already recorded for this patient and antigen.' };
  }

  async getPatientVaccinationRecord(db: any, patientId: string): Promise<any[]> {
    return db.query(
      `SELECT vr.*, vc.antigen_name, vc.route, vc.is_live_vaccine
       FROM vaccination_records vr
       JOIN vaccine_catalog vc ON vc.antigen_code = vr.antigen_code
       WHERE vr.patient_id = $1
       ORDER BY vr.given_at ASC`,
      [patientId],
    );
  }

  async getVaccinationSchedule(db: any, patientId: string): Promise<any[]> {
    // Return catalog with each antigen's received/pending status for this patient
    return db.query(
      `SELECT vc.antigen_code, vc.antigen_name, vc.doses_required, vc.min_age_weeks, vc.schedule_contacts,
              COALESCE(done.doses_given, 0) AS doses_given,
              vc.doses_required - COALESCE(done.doses_given, 0) AS doses_remaining
       FROM vaccine_catalog vc
       LEFT JOIN (
         SELECT antigen_code, COUNT(*) AS doses_given
         FROM vaccination_records WHERE patient_id=$1 GROUP BY antigen_code
       ) done ON done.antigen_code = vc.antigen_code
       WHERE vc.is_active
       ORDER BY vc.min_age_weeks`,
      [patientId],
    );
  }

  async logColdChain(db: any, recordedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO cold_chain_logs (fridge_id, temp_celsius, recorded_by, notes)
       VALUES ($1,$2,$3,$4) RETURNING *, is_excursion, excursion_type`,
      [body.fridgeId, body.tempCelsius, recordedBy, body.notes ?? null],
    );
    const result = rows[0] ?? null;
    return {
      ...result,
      alert: result?.is_excursion
        ? `⚠ COLD CHAIN EXCURSION: ${result.excursion_type === 'heat_excursion' ? 'Temperature too HIGH' : 'FREEZE RISK — live vaccines may be damaged'}. Action required immediately.`
        : null,
    };
  }

  async getColdChainExcursions(db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM cold_chain_logs WHERE is_excursion = TRUE ORDER BY recorded_at DESC LIMIT 50`,
    );
  }

  async reportAefi(db: any, reportedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aefi_reports (patient_id, vaccination_id, antigen_code, onset_date, classification, aefi_type, description, outcome, reported_by)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9) RETURNING *`,
      [body.patientId, body.vaccinationId ?? null, body.antigenCode, body.onsetDate, body.classification, body.aefiType, body.description, body.outcome, reportedBy],
    );
    return rows[0] ?? null;
  }

  async getCoverage(db: any): Promise<any[]> {
    return db.query(`SELECT * FROM epi_coverage_summary LIMIT 100`);
  }

  async getDefaulters(db: any, daysOverdue: number): Promise<any[]> {
    // Patients with a WBC visit that had next_visit_due passed but no subsequent vaccination
    return db.query(
      `SELECT DISTINCT p.id, p.first_name, p.last_name, p.phone,
              latest_vacc.given_at AS last_vaccination, latest_vacc.antigen_code AS last_antigen
       FROM patients p
       JOIN vaccination_records vr ON vr.patient_id = p.id
       LEFT JOIN LATERAL (
         SELECT given_at, antigen_code FROM vaccination_records
         WHERE patient_id = p.id ORDER BY given_at DESC LIMIT 1
       ) latest_vacc ON TRUE
       WHERE latest_vacc.given_at < CURRENT_DATE - ($1 || ' days')::interval
         AND NOT EXISTS (
           SELECT 1 FROM vaccination_records vr2
           WHERE vr2.patient_id = p.id AND vr2.given_at >= CURRENT_DATE - ($1 || ' days')::interval
         )
       ORDER BY latest_vacc.given_at ASC
       LIMIT 200`,
      [daysOverdue],
    );
  }
}
```

**Register in `ehr.module.ts`:**
```typescript
import { ImmunisationController } from './controllers/immunisation.controller';
import { ImmunisationService } from './services/immunisation.service';
```

---

## Cornerstone 3: Frontend Web UI

**Create file:** `ehr-frontend/src/pages/EpiDashboard.tsx`

Key UI elements:
- **Digital Vaccination Card** — per-patient table showing all EPI antigens, checkmark (green `#1B6B3A`) if given, clock icon (amber) if due, exclamation (coral) if overdue. Print-ready layout.
- **Cold Chain Status Panel** — fridge list with last temperature and excursion alert if `is_excursion` is true (coral banner).
- **Coverage Bar Chart** — per-antigen coverage percentage for current month using `#0AA98A` bars.

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/VaccinationCardScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CheckCircle, Clock, AlertTriangle, Thermometer } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function VaccinationCardScreen({ route }: { route: any }) {
  const { patientId, patientName } = route.params;
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/immunisation/patients/${patientId}/schedule`)
      .then((r: any) => setSchedule(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Vaccination Card</Text>
      <Text style={s.sub}>{patientName}</Text>

      <FlatList
        data={schedule}
        keyExtractor={i => i.antigen_code}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const complete = item.doses_remaining === 0;
          const partial  = item.doses_given > 0 && !complete;
          return (
            <View style={s.row}>
              {complete
                ? <CheckCircle size={18} color={C.green} />
                : partial
                  ? <Clock size={18} color={C.amber} />
                  : <AlertTriangle size={18} color={C.textMuted} />
              }
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.antigen}>{item.antigen_name}</Text>
                <Text style={s.doses}>
                  {item.doses_given}/{item.doses_required} dose{item.doses_required > 1 ? 's' : ''}
                </Text>
              </View>
              {complete && (
                <Text style={s.completeText}>Done</Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:      { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:          { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 20 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, ...SHADOW.sm },
  antigen:      { fontFamily: FONT.uiSb, fontSize: 14, color: C.text },
  doses:        { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, marginTop: 2 },
  completeText: { fontFamily: FONT.uiMd, fontSize: 12, color: C.green },
});
```

**Register:** `<Stack.Screen name="VaccinationCard" component={VaccinationCardScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
@app.post("/immunisation/cdss/contraindication-check")
async def vacc_contraindication_check(body: dict):
    """
    Check for live vaccine contraindications before administering.
    body: { is_live_vaccine: bool, hiv_status: str, is_immunosuppressed: bool, recent_immunoglobulin_days: int }
    """
    flags = []
    if body.get("is_live_vaccine"):
        if body.get("is_immunosuppressed"):
            flags.append({"severity": "critical", "message": "Live vaccines CONTRAINDICATED in immunosuppressed patients. Defer until immune status reviewed."})
        if body.get("hiv_status") == "positive" and not body.get("on_art_6_months"):
            flags.append({"severity": "high", "message": "Live vaccine caution in HIV+ patient not yet virally suppressed on ART ≥6 months. Discuss with clinician."})
        if body.get("recent_immunoglobulin_days", 0) < 28:
            flags.append({"severity": "high", "message": f"Immunoglobulin given {body['recent_immunoglobulin_days']} days ago. Live vaccine may be ineffective — delay 28 days."})
    return {"flags": flags, "safe_to_administer": len(flags) == 0}
```

---

## Acceptance Criteria

- [ ] `vaccine_catalog` seeds all Zimbabwe EPI antigens (BCG through HPV) on new tenant provision
- [ ] `vaccination_records` has `UNIQUE` on `(patient_id, antigen_code, dose_number)` — no duplicate dose entries
- [ ] `cold_chain_logs.is_excursion` and `excursion_type` auto-compute as generated columns
- [ ] `POST /immunisation/cold-chain` returns `alert` when excursion detected
- [ ] `GET /immunisation/patients/:id/schedule` returns full schedule with doses_given vs doses_required
- [ ] `POST /immunisation/cdss/contraindication-check` flags live vaccine contraindications
- [ ] `VaccinationCardScreen.tsx` shows CheckCircle (green), Clock (amber), AlertTriangle (muted) per antigen status
- [ ] `'immunisation'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
