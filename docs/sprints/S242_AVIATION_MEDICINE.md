# Sprint 242 — Aviation Medicine (CAAZ/ICAO Class 1 & 2 Medical Examinations)

**Module key:** `aviation_medicine`
**Bundle ID:** `sprint242_aviation_medicine`
**Version:** `2026.06.23.0`
**Depends on:** `sprint230_occupational_medicine_core` (AME is a specialised OEM physician)
**Followed by:** S243 (Hyperbaric Medicine)

---

## Sprint Goal

Build an Aviation Medicine module compliant with Zimbabwe CAAZ (Civil Aviation Authority of Zimbabwe) and ICAO Annex 1 requirements:
1. **Applicant register** — pilot/air traffic controller applicants linked to patients; licence type, certificate class
2. **AME (Authorised Medical Examiner) registry** — AME details, authorisation number, expiry
3. **Medical examination forms** — Class 1 (professional pilots/ATCOs) and Class 2 (private pilots); structured history, systems review, physical exam findings, vision/hearing standards
4. **Certificate generation** — fit/unfit/fit-with-limitation decision, validity dates, CAAZ certificate number
5. **Disqualifying condition tracker** — track conditions that require CAAZ waiver, multi-cycle monitoring

---

## Cornerstone 1: Database Provisioning

```typescript
{
  id: 'sprint242_aviation_medicine',
  label: 'Sprint 242 — Aviation Medicine: CAAZ/ICAO Class 1/2 exams, AME registry, certificate generation, disqualifying conditions',
  version: '2026.06.23.0',
  description: 'ame_examiners, aviation_applicants, aviation_examinations, aviation_certificates, aviation_waivers',
  statements: () => [
    // ── AME Registry ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ame_examiners (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID NOT NULL UNIQUE REFERENCES users(id),
      ame_number      TEXT NOT NULL UNIQUE,
      authorised_classes JSONB NOT NULL DEFAULT '["class1","class2"]'::jsonb,
      authorisation_expiry DATE NOT NULL,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,

    // ── Aviation Applicants ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aviation_applicants (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id      UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      licence_type    TEXT NOT NULL CHECK (licence_type IN ('atpl','cpl','ppl','lapl','atco','student')),
      class_required  TEXT NOT NULL CHECK (class_required IN ('class1','class2','class3')),
      caaz_licence_number TEXT,
      total_flight_hours NUMERIC(8,1),
      aircraft_types  JSONB NOT NULL DEFAULT '[]'::jsonb,
      next_medical_due DATE,
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aviation_applicant_patient ON aviation_applicants(patient_id)`,

    // ── Aviation Medical Examinations ─────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aviation_examinations (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_id    UUID NOT NULL REFERENCES aviation_applicants(id) ON DELETE CASCADE,
      ame_id          UUID NOT NULL REFERENCES ame_examiners(id),
      exam_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      exam_class      TEXT NOT NULL CHECK (exam_class IN ('class1','class2','class3')),
      exam_type       TEXT NOT NULL CHECK (exam_type IN ('initial','renewal','renewal_after_gap')),

      -- Anthropometrics
      height_cm       NUMERIC(5,1),
      weight_kg       NUMERIC(5,2),
      bmi             NUMERIC(5,2) GENERATED ALWAYS AS (
                          CASE WHEN height_cm > 0 THEN
                               ROUND(weight_kg / ((height_cm / 100.0) ^ 2), 2) ELSE NULL END
                        ) STORED,

      -- Vision
      distant_va_right_uncorrected TEXT,
      distant_va_left_uncorrected  TEXT,
      distant_va_right_corrected   TEXT,
      distant_va_left_corrected    TEXT,
      near_va_right    TEXT,
      near_va_left     TEXT,
      colour_vision    TEXT CHECK (colour_vision IN ('normal','deficient','failed',NULL)),
      vision_meets_standard BOOLEAN,

      -- Hearing
      audiometry_right_250hz SMALLINT, audiometry_right_500hz SMALLINT, audiometry_right_1khz SMALLINT,
      audiometry_right_2khz SMALLINT, audiometry_right_3khz SMALLINT, audiometry_right_4khz SMALLINT,
      audiometry_left_250hz SMALLINT, audiometry_left_500hz SMALLINT, audiometry_left_1khz SMALLINT,
      audiometry_left_2khz SMALLINT, audiometry_left_3khz SMALLINT, audiometry_left_4khz SMALLINT,
      hearing_meets_standard BOOLEAN,

      -- Cardiovascular
      resting_hr      SMALLINT,
      bp_systolic     SMALLINT,
      bp_diastolic    SMALLINT,
      bp_meets_standard BOOLEAN GENERATED ALWAYS AS (
                          bp_systolic IS NOT NULL AND bp_diastolic IS NOT NULL
                          AND bp_systolic <= 160 AND bp_diastolic <= 95
                        ) STORED,
      ecg_performed   BOOLEAN NOT NULL DEFAULT FALSE,
      ecg_result      TEXT,

      -- Respiratory
      fev1_percent    NUMERIC(5,1),
      fvc_percent     NUMERIC(5,1),
      spirometry_normal BOOLEAN,

      -- Neurological & Psychiatric
      no_disqualifying_neuro  BOOLEAN NOT NULL DEFAULT TRUE,
      no_disqualifying_psych  BOOLEAN NOT NULL DEFAULT TRUE,
      no_substance_use        BOOLEAN NOT NULL DEFAULT TRUE,
      no_medications_disqualifying BOOLEAN NOT NULL DEFAULT TRUE,

      -- Outcome
      overall_decision TEXT NOT NULL DEFAULT 'pending'
                       CHECK (overall_decision IN ('fit','fit_with_limitations','unfit','refer_specialist','pending')),
      limitations      JSONB NOT NULL DEFAULT '[]'::jsonb,
      next_exam_months SMALLINT DEFAULT 12,
      examiner_notes   TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aviation_exam_applicant ON aviation_examinations(applicant_id)`,

    // ── Aviation Certificates ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS aviation_certificates (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      examination_id  UUID NOT NULL REFERENCES aviation_examinations(id) ON DELETE CASCADE,
      applicant_id    UUID NOT NULL REFERENCES aviation_applicants(id),
      cert_number     TEXT NOT NULL UNIQUE,
      cert_class      TEXT NOT NULL,
      issued_date     DATE NOT NULL DEFAULT CURRENT_DATE,
      expiry_date     DATE NOT NULL,
      is_valid        BOOLEAN GENERATED ALWAYS AS (expiry_date >= CURRENT_DATE) STORED,
      days_to_expiry  INTEGER GENERATED ALWAYS AS ((expiry_date - CURRENT_DATE)) STORED,
      limitations_text TEXT,
      issued_by       UUID REFERENCES users(id),
      voided          BOOLEAN NOT NULL DEFAULT FALSE,
      void_reason     TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_aviation_cert_applicant ON aviation_certificates(applicant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_aviation_cert_expiring ON aviation_certificates(expiry_date) WHERE voided = FALSE`,

    // ── Aviation Waivers (Disqualifying Conditions) ────────────────────────
    `CREATE TABLE IF NOT EXISTS aviation_waivers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      applicant_id    UUID NOT NULL REFERENCES aviation_applicants(id),
      condition_code  TEXT NOT NULL,
      condition_desc  TEXT NOT NULL,
      waiver_requested BOOLEAN NOT NULL DEFAULT FALSE,
      caaz_waiver_ref TEXT,
      waiver_granted  BOOLEAN,
      waiver_expiry   DATE,
      review_frequency_months SMALLINT DEFAULT 12,
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ],
},
```

**Add `aviation_medicine` to `ALL_MODULE_KEYS`** in `tenant.service.ts`.

---

## Cornerstone 2: Backend

**Create file:** `services/ehr-service/src/controllers/aviation-medicine.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AviationMedicineService } from '../services/aviation-medicine.service';

@UseGuards(JwtAuthGuard)
@Controller('aviation')
export class AviationMedicineController {
  constructor(private readonly svc: AviationMedicineService) {}

  @Post('applicants')
  registerApplicant(@Req() req: any, @Body() body: any) {
    return this.svc.registerApplicant(req.tenantDb, body);
  }

  @Get('applicants')
  getApplicants(@Req() req: any) {
    return this.svc.getApplicants(req.tenantDb);
  }

  @Post('examinations')
  createExamination(@Req() req: any, @Body() body: any) {
    return this.svc.createExamination(req.tenantDb, req.user.id, body);
  }

  @Patch('examinations/:id/decision')
  recordDecision(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { decision: string; limitations?: string[]; nextExamMonths?: number; notes?: string },
  ) {
    return this.svc.recordDecision(req.tenantDb, id, body);
  }

  @Post('certificates')
  issueCertificate(
    @Req() req: any,
    @Body() body: { examinationId: string; applicantId: string; certClass: string; validityMonths: number; limitationsText?: string },
  ) {
    return this.svc.issueCertificate(req.tenantDb, req.user.id, body);
  }

  @Get('certificates/:applicantId')
  getCertificates(@Req() req: any, @Param('applicantId') applicantId: string) {
    return this.svc.getCertificates(req.tenantDb, applicantId);
  }

  @Get('certificates/expiring-soon')
  getExpiringSoon(@Req() req: any) {
    return this.svc.getExpiringSoon(req.tenantDb);
  }

  @Post('waivers')
  recordWaiver(@Req() req: any, @Body() body: any) {
    return this.svc.recordWaiver(req.tenantDb, body);
  }
}
```

**Create file:** `services/ehr-service/src/services/aviation-medicine.service.ts`

```typescript
import { Injectable } from '@nestjs/common';

// ICAO Annex 1 certificate validity periods
const VALIDITY_MONTHS: Record<string, Record<string, number>> = {
  class1: { age_lt_40: 12, age_40_to_60: 6, age_gt_60: 6 },
  class2: { age_lt_40: 24, age_40_to_60: 12, age_gt_60: 12 },
  class3: { default: 48 },
};

// ICAO Annex 1 disqualifying conditions for Class 1
const DISQUALIFYING_CONDITIONS_CLASS1 = [
  'epilepsy', 'insulin_dependent_diabetes', 'psychosis', 'bipolar_disorder',
  'alcohol_dependence', 'drug_dependence', 'permanent_cardiac_pacemaker',
  'chronic_renal_failure_on_dialysis', 'active_tb',
];

@Injectable()
export class AviationMedicineService {

  async registerApplicant(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aviation_applicants (patient_id, licence_type, class_required, caaz_licence_number, total_flight_hours)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (patient_id) DO UPDATE SET licence_type=$2, class_required=$3 RETURNING *`,
      [body.patientId, body.licenceType, body.classRequired, body.caazLicenceNumber ?? null, body.totalFlightHours ?? null],
    );
    return rows[0] ?? null;
  }

  async getApplicants(db: any): Promise<any[]> {
    return db.query(
      `SELECT aa.*, p.first_name, p.last_name, p.date_of_birth
       FROM aviation_applicants aa
       JOIN patients p ON p.id = aa.patient_id
       WHERE aa.is_active ORDER BY p.last_name`,
    );
  }

  async createExamination(db: any, ameUserId: string, body: any): Promise<any> {
    // Resolve AME ID from user
    const ameRows = await db.query(`SELECT id FROM ame_examiners WHERE user_id=$1 LIMIT 1`, [ameUserId]);
    if (!ameRows[0]) throw new Error('Current user is not registered as an AME.');
    const ameId = ameRows[0].id;

    const rows = await db.query(
      `INSERT INTO aviation_examinations (
         applicant_id, ame_id, exam_class, exam_type,
         height_cm, weight_kg, bp_systolic, bp_diastolic, resting_hr,
         vision_meets_standard, hearing_meets_standard,
         colour_vision, ecg_performed, ecg_result,
         fev1_percent, fvc_percent, spirometry_normal,
         no_disqualifying_neuro, no_disqualifying_psych, no_substance_use, no_medications_disqualifying
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *, bmi, bp_meets_standard`,
      [body.applicantId, ameId, body.examClass, body.examType ?? 'renewal',
       body.heightCm ?? null, body.weightKg ?? null, body.bpSystolic ?? null, body.bpDiastolic ?? null, body.restingHr ?? null,
       body.visionMeetsStandard ?? null, body.hearingMeetsStandard ?? null,
       body.colourVision ?? null, body.ecgPerformed ?? false, body.ecgResult ?? null,
       body.fev1Percent ?? null, body.fvcPercent ?? null, body.spirometryNormal ?? null,
       body.noDisqualifyingNeuro ?? true, body.noDisqualifyingPsych ?? true, body.noSubstanceUse ?? true, body.noMedicationsDisqualifying ?? true],
    );
    return rows[0] ?? null;
  }

  async recordDecision(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE aviation_examinations SET overall_decision=$1, limitations=$2::jsonb, next_exam_months=$3, examiner_notes=$4
       WHERE id=$5 RETURNING *, bmi, bp_meets_standard`,
      [body.decision, JSON.stringify(body.limitations ?? []), body.nextExamMonths ?? 12, body.notes ?? null, id],
    );
    const result = rows[0];
    const alerts: string[] = [];
    if (!result.bp_meets_standard) alerts.push(`Blood pressure ${result.bp_systolic}/${result.bp_diastolic} mmHg exceeds ICAO Class 1 standard (≤160/95). Certificate cannot be issued.`);
    if (!result.vision_meets_standard) alerts.push('Visual acuity does not meet ICAO standard. Refer to ophthalmology.');
    if (!result.hearing_meets_standard) alerts.push('Hearing does not meet audiometric standard. Refer to audiologist.');
    return { ...result, cdss_alerts: alerts };
  }

  async issueCertificate(db: any, issuedBy: string, body: any): Promise<any> {
    const certNumber = `ZW-CAA-${Date.now().toString(36).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (body.validityMonths ?? 12));

    const rows = await db.query(
      `INSERT INTO aviation_certificates (examination_id, applicant_id, cert_number, cert_class, expiry_date, limitations_text, issued_by)
       VALUES ($1,$2,$3,$4,$5::date,$6,$7) RETURNING *, is_valid, days_to_expiry`,
      [body.examinationId, body.applicantId, certNumber, body.certClass, expiryDate.toISOString().slice(0, 10), body.limitationsText ?? null, issuedBy],
    );
    // Update next medical due on applicant
    await db.query(`UPDATE aviation_applicants SET next_medical_due=$1 WHERE id=$2`, [expiryDate.toISOString().slice(0, 10), body.applicantId]);
    return rows[0] ?? null;
  }

  async getCertificates(db: any, applicantId: string): Promise<any[]> {
    return db.query(
      `SELECT *, is_valid, days_to_expiry FROM aviation_certificates WHERE applicant_id=$1 AND voided=FALSE ORDER BY issued_date DESC`,
      [applicantId],
    );
  }

  async getExpiringSoon(db: any): Promise<any[]> {
    return db.query(
      `SELECT ac.*, p.first_name, p.last_name, aa.licence_type
       FROM aviation_certificates ac
       JOIN aviation_applicants aa ON aa.id = ac.applicant_id
       JOIN patients p ON p.id = aa.patient_id
       WHERE ac.voided=FALSE AND ac.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
       ORDER BY ac.expiry_date ASC`,
    );
  }

  async recordWaiver(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO aviation_waivers (applicant_id, condition_code, condition_desc, waiver_requested, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.applicantId, body.conditionCode, body.conditionDesc, body.waiverRequested ?? true, body.notes ?? null],
    );
    return rows[0] ?? null;
  }
}
```

---

## Cornerstone 3: Frontend Web UI

Key UI elements in `ehr-frontend/src/pages/AviationMedicineDashboard.tsx`:
- **Applicant List** — table with licence type chip (ATPL=teal, CPL=blue, PPL=amber), certificate valid/expired badge, next medical due date
- **Expiring Certificates Alert Queue** — amber list of certs expiring within 60 days
- **Examination Form** — structured form with sections: Vision, Hearing, Cardiovascular, Respiratory, Neurological — each section collapsible with a colour indicator (green=pass, amber=borderline, coral=fail)

---

## Cornerstone 4: Mobile Screen

**Create file:** `mobile/src/screens/AviationCertScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Shield, AlertTriangle, Clock } from 'lucide-react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

export default function AviationCertScreen({ route }: { route: any }) {
  const { applicantId, applicantName } = route.params;
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/aviation/certificates/${applicantId}`)
      .then((r: any) => setCerts(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [applicantId]);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.teal} /></View>;

  return (
    <View style={s.container}>
      <Text style={s.heading}>Aviation Medical Certificates</Text>
      <Text style={s.sub}>{applicantName}</Text>
      <FlatList
        data={certs}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const expiring = item.days_to_expiry < 60 && item.is_valid;
          const expired = !item.is_valid;
          return (
            <View style={[s.card, { borderLeftColor: expired ? C.coral : expiring ? C.amber : C.teal, borderLeftWidth: 4 }]}>
              <View style={s.row}>
                <Shield size={16} color={expired ? C.coral : C.teal} />
                <Text style={s.certClass}> {item.cert_class?.toUpperCase()}</Text>
              </View>
              <Text style={s.certNum}>{item.cert_number}</Text>
              <View style={s.row}>
                <Clock size={12} color={C.textMuted} />
                <Text style={s.expiry}> Expires: {item.expiry_date} ({item.days_to_expiry} days)</Text>
              </View>
              {expiring && <Text style={s.warnText}>⚠ Renewal required soon</Text>}
              {expired && <Text style={s.expiredText}>EXPIRED</Text>}
              {item.limitations_text && <Text style={s.limit}>Limitations: {item.limitations_text}</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 20 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  heading:     { fontFamily: FONT.uiBd, fontSize: 22, color: C.text },
  sub:         { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary, marginBottom: 16 },
  card:        { backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 16, marginBottom: 12, ...SHADOW.card },
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  certClass:   { fontFamily: FONT.uiBd, fontSize: 16, color: C.text },
  certNum:     { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  expiry:      { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary },
  warnText:    { fontFamily: FONT.uiSb, fontSize: 12, color: C.amber, marginTop: 6 },
  expiredText: { fontFamily: FONT.uiSb, fontSize: 13, color: C.coral, marginTop: 6 },
  limit:       { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 4 },
});
```

**Register:** `<Stack.Screen name="AviationCert" component={AviationCertScreen} />`

---

## CDSS Integration

`services/cdss-service/main.py`:
```python
DISQ_CLASS1 = {
    "epilepsy": "Permanent disqualification for Class 1. CAAZ waiver exceptional only.",
    "insulin_dependent_diabetes": "Class 1 disqualifying under ICAO Annex 1 standard. Class 2 possible with controlled T2DM.",
    "psychosis": "Active psychosis disqualifying. Assess after sustained remission.",
    "bipolar_disorder": "Disqualifying if unstable or on lithium. Stable on monotherapy — specialist review.",
    "alcohol_dependence": "Disqualifying. Minimum 2 years sobriety with documentation before reassessment.",
    "permanent_cardiac_pacemaker": "Pacemaker disqualifying for Class 1 in most CAAZ/ICAO states. May apply for Class 2 waiver.",
}

@app.post("/aviation/cdss/fitness-check")
async def aviation_fitness_check(body: dict):
    """
    Check for ICAO Annex 1 disqualifying conditions.
    body: { exam_class: str, conditions: list[str], bp_systolic: int, bp_diastolic: int,
             vision_meets_standard: bool, hearing_meets_standard: bool, colour_vision: str }
    """
    exam_class = body.get("exam_class", "class1")
    conditions = body.get("conditions", [])
    flags = []

    # Check disqualifying conditions
    for cond in conditions:
        if cond in DISQ_CLASS1:
            flags.append({"severity": "disqualifying", "condition": cond, "guidance": DISQ_CLASS1[cond]})

    # Blood pressure
    systolic = body.get("bp_systolic", 0)
    diastolic = body.get("bp_diastolic", 0)
    if systolic > 160 or diastolic > 95:
        flags.append({"severity": "fail", "condition": "hypertension", "guidance": f"BP {systolic}/{diastolic} exceeds ICAO standard (≤160/95). Cannot certify until controlled."})

    # Vision
    if not body.get("vision_meets_standard", True):
        flags.append({"severity": "fail", "condition": "vision", "guidance": "Visual acuity below ICAO standard. Ophthalmology referral required before certificate."})

    # Colour vision for Class 1
    if exam_class == "class1" and body.get("colour_vision") == "failed":
        flags.append({"severity": "disqualifying", "condition": "colour_vision", "guidance": "Colour vision failure — Class 1 disqualifying. Class 2 possible (day/sunset VFR limitations)."})

    return {
        "fit_to_certify": len(flags) == 0,
        "flags": flags,
        "recommendation": "UNFIT — resolve disqualifying conditions before certification." if flags else "No disqualifying conditions identified. Proceed with certification."
    }
```

---

## Acceptance Criteria

- [ ] `aviation_examinations.bmi` is a generated column using height/weight
- [ ] `aviation_examinations.bp_meets_standard` generated as `bp_systolic <= 160 AND bp_diastolic <= 95`
- [ ] `aviation_certificates.is_valid` and `days_to_expiry` are generated columns
- [ ] `POST /aviation/certificates` auto-generates `cert_number` and updates `aviation_applicants.next_medical_due`
- [ ] `GET /aviation/certificates/expiring-soon` returns certs expiring within 60 days
- [ ] `POST /aviation/cdss/fitness-check` correctly flags insulin-dependent diabetes and BP >160/95
- [ ] `AviationCertScreen.tsx` shows expiry colour: teal=valid, amber=expiring <60d, coral=expired
- [ ] `'aviation_medicine'` in `ALL_MODULE_KEYS`
- [ ] Smoke test passes
