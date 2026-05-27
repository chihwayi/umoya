# S172 — Education Personalization Engine

**Phase:** 1 — Fix Broken Wires  
**Effort:** M  
**Depends on:** S171  
**Goal:** Use each patient's confirmed diagnoses, chronic conditions, and demographics to automatically serve a personalized education course list on the patient portal and mobile app — instead of showing a generic catalogue.

---

## Problem

The education module has a full course catalogue, but every patient sees the same generic list. Diagnoses from the EHR are never used to filter or rank courses. The wire from `patient_diagnoses` → education recommendations is completely missing.

---

## Acceptance Criteria

1. `GET /patient-portal/education/personalized` returns courses ranked by relevance to the patient's diagnoses.
2. Courses are mapped to ICD-10/SNOMED codes via a `education_course_diagnosis_map` table.
3. Courses a patient has already completed are excluded (or shown as "completed").
4. New diagnoses added to a patient's record trigger a background re-ranking.
5. Patient portal shows "Recommended for you" section above the generic catalogue.
6. Mobile app shows personalized course chips at the top of the Education screen.
7. Clinician can manually recommend a course to a patient from the EHR.
8. `GET /education/courses/:courseId/enrolment-stats` shows uptake per diagnosis code.
9. `tsc --noEmit` and lint pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'education_personalization',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS education_course_diagnosis_map (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL,
      icd10_code VARCHAR(16),
      snomed_code VARCHAR(32),
      relevance_weight NUMERIC(4,3) NOT NULL DEFAULT 1.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ecdm_course
      ON education_course_diagnosis_map(course_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ecdm_icd10
      ON education_course_diagnosis_map(icd10_code)`,
    `CREATE TABLE IF NOT EXISTS education_clinician_recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      course_id UUID NOT NULL,
      recommended_by UUID NOT NULL,
      note TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','completed','dismissed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(patient_id, course_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ecr_patient
      ON education_clinician_recommendations(patient_id)`,
  ],
},
```

---

## 2. Backend — EducationPersonalizationService

Create `services/ehr-service/src/services/education-personalization.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';

interface RankedCourse {
  courseId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  relevanceScore: number;
  matchedDiagnoses: string[];
  completionStatus: 'not_started' | 'in_progress' | 'completed';
  clinicianRecommended: boolean;
}

@Injectable()
export class EducationPersonalizationService {
  private readonly logger = new Logger(EducationPersonalizationService.name);

  async getPersonalizedCourses(
    patientId: string,
    db: any,
    limit = 10,
  ): Promise<RankedCourse[]> {
    // Get patient's active diagnoses
    const diagnoses = await db.query(
      `SELECT d.icd10_code, d.snomed_code, d.status
       FROM patient_diagnoses d
       WHERE d.patient_id = $1 AND d.status IN ('active','chronic')`,
      [patientId],
    );

    if (diagnoses.length === 0) {
      // Fall back to most popular courses
      return this.getPopularCourses(patientId, db, limit);
    }

    const icd10Codes = diagnoses
      .map((d: any) => d.icd10_code)
      .filter(Boolean);
    const snomedCodes = diagnoses
      .map((d: any) => d.snomed_code)
      .filter(Boolean);

    // Get mapped courses with relevance scores
    const mapped = await db.query(
      `SELECT
         ec.id AS course_id, ec.title, ec.description,
         ec.thumbnail_url,
         SUM(ecdm.relevance_weight) AS relevance_score,
         ARRAY_AGG(DISTINCT COALESCE(ecdm.icd10_code, ecdm.snomed_code)) AS matched_codes
       FROM education_courses ec
       JOIN education_course_diagnosis_map ecdm ON ecdm.course_id = ec.id
       WHERE ecdm.icd10_code = ANY($1) OR ecdm.snomed_code = ANY($2)
       GROUP BY ec.id, ec.title, ec.description, ec.thumbnail_url
       ORDER BY relevance_score DESC
       LIMIT $3`,
      [icd10Codes, snomedCodes, limit * 2],
    );

    // Get completion status
    const enrolments = await db.query(
      `SELECT course_id, status
       FROM education_enrolments
       WHERE patient_id = $1`,
      [patientId],
    );
    const enrolmentMap = new Map<string, string>(
      enrolments.map((e: any) => [e.course_id, e.status]),
    );

    // Get clinician recommendations
    const recommendations = await db.query(
      `SELECT course_id FROM education_clinician_recommendations
       WHERE patient_id = $1 AND status IN ('pending','accepted')`,
      [patientId],
    );
    const recommendedSet = new Set<string>(
      recommendations.map((r: any) => r.course_id),
    );

    const ranked: RankedCourse[] = mapped
      .filter((c: any) => enrolmentMap.get(c.course_id) !== 'completed')
      .slice(0, limit)
      .map((c: any) => ({
        courseId: c.course_id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnail_url,
        relevanceScore: parseFloat(c.relevance_score),
        matchedDiagnoses: c.matched_codes,
        completionStatus: (enrolmentMap.get(c.course_id) as any) ?? 'not_started',
        clinicianRecommended: recommendedSet.has(c.course_id),
      }));

    // Prepend clinician-recommended courses if not already in list
    const recommendedCourses = await this.getClinicianRecommended(patientId, db);
    const rankedIds = new Set(ranked.map((r) => r.courseId));
    for (const rec of recommendedCourses) {
      if (!rankedIds.has(rec.courseId)) {
        ranked.unshift({ ...rec, clinicianRecommended: true, relevanceScore: 999 });
      }
    }

    return ranked;
  }

  async getClinicianRecommended(patientId: string, db: any): Promise<RankedCourse[]> {
    const rows = await db.query(
      `SELECT ec.id AS course_id, ec.title, ec.description, ec.thumbnail_url,
              ecr.status AS enrolment_status
       FROM education_clinician_recommendations ecr
       JOIN education_courses ec ON ec.id = ecr.course_id
       WHERE ecr.patient_id = $1 AND ecr.status IN ('pending','accepted')
       ORDER BY ecr.created_at DESC`,
      [patientId],
    );
    return rows.map((r: any) => ({
      courseId: r.course_id,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnail_url,
      relevanceScore: 999,
      matchedDiagnoses: [],
      completionStatus: r.enrolment_status ?? 'not_started',
      clinicianRecommended: true,
    }));
  }

  private async getPopularCourses(
    patientId: string,
    db: any,
    limit: number,
  ): Promise<RankedCourse[]> {
    const rows = await db.query(
      `SELECT ec.id AS course_id, ec.title, ec.description, ec.thumbnail_url,
              COUNT(ee.id) AS enrolment_count
       FROM education_courses ec
       LEFT JOIN education_enrolments ee ON ee.course_id = ec.id
       GROUP BY ec.id, ec.title, ec.description, ec.thumbnail_url
       ORDER BY enrolment_count DESC NULLS LAST
       LIMIT $1`,
      [limit],
    );
    const enrolments = await db.query(
      `SELECT course_id, status FROM education_enrolments WHERE patient_id = $1`,
      [patientId],
    );
    const enrolmentMap = new Map<string, string>(
      enrolments.map((e: any) => [e.course_id, e.status]),
    );
    return rows.map((r: any) => ({
      courseId: r.course_id,
      title: r.title,
      description: r.description,
      thumbnailUrl: r.thumbnail_url,
      relevanceScore: parseInt(r.enrolment_count ?? '0'),
      matchedDiagnoses: [],
      completionStatus: (enrolmentMap.get(r.course_id) as any) ?? 'not_started',
      clinicianRecommended: false,
    }));
  }

  async recommendCourse(
    patientId: string,
    courseId: string,
    recommendedBy: string,
    note: string | undefined,
    db: any,
  ): Promise<unknown> {
    const rows = await db.query(
      `INSERT INTO education_clinician_recommendations
         (patient_id, course_id, recommended_by, note)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (patient_id, course_id)
         DO UPDATE SET note = EXCLUDED.note, status = 'pending', recommended_by = EXCLUDED.recommended_by
       RETURNING *`,
      [patientId, courseId, recommendedBy, note ?? null],
    );
    return rows[0];
  }

  async seedDiagnosisMap(
    courseId: string,
    mappings: Array<{ icd10Code?: string; snomedCode?: string; weight?: number }>,
    db: any,
  ): Promise<void> {
    for (const m of mappings) {
      await db.query(
        `INSERT INTO education_course_diagnosis_map
           (course_id, icd10_code, snomed_code, relevance_weight)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [courseId, m.icd10Code ?? null, m.snomedCode ?? null, m.weight ?? 1.0],
      );
    }
  }

  async getEnrolmentStats(courseId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT ecdm.icd10_code, ecdm.snomed_code,
              COUNT(DISTINCT ee.patient_id) AS enrolled_patients
       FROM education_course_diagnosis_map ecdm
       LEFT JOIN education_enrolments ee ON ee.course_id = ecdm.course_id
       WHERE ecdm.course_id = $1
       GROUP BY ecdm.icd10_code, ecdm.snomed_code`,
      [courseId],
    );
  }
}
```

---

## 3. Backend — EducationPersonalizationController

Create `services/ehr-service/src/controllers/education-personalization.controller.ts`:

```typescript
import {
  Controller, Get, Post, Body, Param, Req, UseGuards, Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PatientJwtAuthGuard } from '../guards/patient-jwt-auth.guard';
import { EducationPersonalizationService } from '../services/education-personalization.service';

@Controller('education')
export class EducationPersonalizationController {
  constructor(private readonly eduPersonal: EducationPersonalizationService) {}

  // Patient portal — personalized list
  @UseGuards(PatientJwtAuthGuard)
  @Get('patient/personalized')
  async getPersonalized(
    @Req() req: any,
    @Query('limit') limit?: string,
  ): Promise<unknown[]> {
    return this.eduPersonal.getPersonalizedCourses(
      req.patientId,
      req.tenantDb,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // Staff — recommend a course to a patient
  @UseGuards(JwtAuthGuard)
  @Post('clinician/recommend')
  async recommend(
    @Body() body: { patientId: string; courseId: string; note?: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.eduPersonal.recommendCourse(
      body.patientId,
      body.courseId,
      req.user.sub,
      body.note,
      req.tenantDb,
    );
  }

  // Staff — seed diagnosis mappings for a course
  @UseGuards(JwtAuthGuard)
  @Post('courses/:courseId/diagnosis-map')
  async seedMap(
    @Param('courseId') courseId: string,
    @Body() body: { mappings: Array<{ icd10Code?: string; snomedCode?: string; weight?: number }> },
    @Req() req: any,
  ): Promise<{ ok: boolean }> {
    await this.eduPersonal.seedDiagnosisMap(courseId, body.mappings, req.tenantDb);
    return { ok: true };
  }

  // Staff — get enrolment stats per diagnosis for a course
  @UseGuards(JwtAuthGuard)
  @Get('courses/:courseId/enrolment-stats')
  async enrolmentStats(
    @Param('courseId') courseId: string,
    @Req() req: any,
  ): Promise<unknown[]> {
    return this.eduPersonal.getEnrolmentStats(courseId, req.tenantDb);
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { EducationPersonalizationService } from './services/education-personalization.service';
import { EducationPersonalizationController } from './controllers/education-personalization.controller';

controllers: [ /* ...existing... */ EducationPersonalizationController ],
providers: [ /* ...existing... */ EducationPersonalizationService ],
```

---

## 5. Patient Portal — Personalized Section

In `patient-portal/src/pages/EducationPage.tsx`, add at the top:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

// Inside component:
const [personalized, setPersonalized] = useState<any[]>([]);

useEffect(() => {
  api.get('/education/patient/personalized?limit=6')
    .then((res) => setPersonalized(res.data ?? []))
    .catch(() => setPersonalized([]));
}, []);

// In JSX — before the catalogue grid:
{personalized.length > 0 && (
  <section>
    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
      Recommended for You
    </h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
      {personalized.map((course) => (
        <div key={course.courseId} style={{
          border: '1px solid #e5e7eb', borderRadius: 8, padding: 12,
          position: 'relative',
        }}>
          {course.clinicianRecommended && (
            <span style={{
              position: 'absolute', top: 8, right: 8, fontSize: 10,
              backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: 10,
            }}>
              Clinician Pick
            </span>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{course.title}</h3>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{course.description}</p>
          {course.completionStatus === 'in_progress' && (
            <span style={{ fontSize: 11, color: '#2563eb' }}>In Progress</span>
          )}
          <button style={{
            padding: '6px 14px', backgroundColor: '#2563eb', color: 'white',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, width: '100%',
          }}>
            {course.completionStatus === 'not_started' ? 'Start' : 'Continue'}
          </button>
        </div>
      ))}
    </div>
  </section>
)}
```

---

## 6. EHR Frontend — Clinician Recommend Button

In the patient detail view, add a "Recommend Education" button. On click, open a modal to select course + add a note, then call `POST /education/clinician/recommend`.

Minimal inline implementation in `ehr-frontend/src/components/RecommendEducationButton.tsx`:

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

interface Props { patientId: string; }

export const RecommendEducationButton: React.FC<Props> = ({ patientId }) => {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [note, setNote] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [sent, setSent] = useState(false);

  const openModal = async () => {
    const res = await api.get('/education/courses?limit=50');
    setCourses(res.data ?? []);
    setOpen(true);
  };

  const send = async () => {
    await api.post('/education/clinician/recommend', { patientId, courseId, note });
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); }, 1500);
  };

  if (!open) {
    return (
      <button
        onClick={openModal}
        style={{
          padding: '6px 14px', backgroundColor: '#7c3aed', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
        }}
      >
        Recommend Education
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 12, width: 400 }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Recommend a Course</h3>
        {sent ? (
          <p style={{ color: '#16a34a', fontWeight: 600 }}>Recommendation sent!</p>
        ) : (
          <>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              <option value="">Select a course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for the patient (optional)"
              rows={3}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={send}
                disabled={!courseId}
                style={{
                  flex: 1, padding: 8, backgroundColor: '#7c3aed', color: 'white',
                  border: 'none', borderRadius: 6, cursor: 'pointer',
                }}
              >
                Send Recommendation
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: 8, backgroundColor: '#f3f4f6', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

---

## 7. Mobile — Personalized Education Chips

In `mobile/src/screens/EducationScreen.tsx`, add at the top of the screen before the full catalogue:

```tsx
import { AiStatusChip } from '../components/AiStatusChip';

// State
const [recommended, setRecommended] = useState<any[]>([]);
const [loadingRec, setLoadingRec] = useState(true);

useEffect(() => {
  api.get('/education/patient/personalized?limit=6')
    .then((res) => setRecommended(res.data ?? []))
    .catch(() => setRecommended([]))
    .finally(() => setLoadingRec(false));
}, []);

// JSX — before catalogue FlatList
{!loadingRec && recommended.length > 0 && (
  <View style={{ marginBottom: SPACING.lg }}>
    <Text style={{ fontFamily: FONT.uiBd, fontSize: 16, marginBottom: SPACING.sm }}>
      {t('education.recommended_for_you')}
    </Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {recommended.map((course) => (
        <TouchableOpacity
          key={course.courseId}
          onPress={() => navigation.navigate('CourseDetail', { courseId: course.courseId })}
          style={{
            width: 160, marginRight: SPACING.sm,
            backgroundColor: C.bg, borderRadius: RADIUS.md,
            padding: SPACING.sm, ...SHADOW.sm,
          }}
        >
          {course.clinicianRecommended && (
            <View style={{ backgroundColor: C.blue + '20', borderRadius: RADIUS.xs, padding: 3, marginBottom: 4, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: FONT.uiBd, fontSize: 9, color: C.blue }}>
                {t('education.clinician_pick')}
              </Text>
            </View>
          )}
          <Text style={{ fontFamily: FONT.uiBd, fontSize: 13 }} numberOfLines={2}>
            {course.title}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
)}
```

---

## 8. i18n Keys — All 8 Locales

### `en.json`:
```json
"education": {
  "recommended_for_you": "Recommended for You",
  "clinician_pick": "Clinician Pick",
  "start": "Start",
  "continue": "Continue",
  "in_progress": "In Progress",
  "completed": "Completed"
}
```

### `sn.json`:
```json
"education": {
  "recommended_for_you": "Yakakurongererwa Iwe",
  "clinician_pick": "Sarudzo yeGurukota",
  "start": "Tanga",
  "continue": "Enderera",
  "in_progress": "Iri Kufamba",
  "completed": "Yapedzwa"
}
```

### `nd.json`:
```json
"education": {
  "recommended_for_you": "Ikhethwe Ngokukhethela Wena",
  "clinician_pick": "Ukukhethwa Kwe-Clinician",
  "start": "Qala",
  "continue": "Qhubeka",
  "in_progress": "Kuyaqhubeka",
  "completed": "Kuphelile"
}
```

### `pt.json`:
```json
"education": {
  "recommended_for_you": "Recomendado para Você",
  "clinician_pick": "Escolha do Clínico",
  "start": "Começar",
  "continue": "Continuar",
  "in_progress": "Em Progresso",
  "completed": "Concluído"
}
```

### `fr.json`:
```json
"education": {
  "recommended_for_you": "Recommandé pour Vous",
  "clinician_pick": "Choix du Clinicien",
  "start": "Commencer",
  "continue": "Continuer",
  "in_progress": "En cours",
  "completed": "Terminé"
}
```

### `sw.json`:
```json
"education": {
  "recommended_for_you": "Iliyopendekezwa Kwako",
  "clinician_pick": "Uchaguzi wa Klinisheni",
  "start": "Anza",
  "continue": "Endelea",
  "in_progress": "Inaendelea",
  "completed": "Imekamilika"
}
```

### `zu.json`:
```json
"education": {
  "recommended_for_you": "Ikhethwe Ngokukhethela Wena",
  "clinician_pick": "Ukukhetha Kwezempilo",
  "start": "Qala",
  "continue": "Qhubeka",
  "in_progress": "Kuyaqhubeka",
  "completed": "Kuphelile"
}
```

### `af.json`:
```json
"education": {
  "recommended_for_you": "Aanbeveel vir Jou",
  "clinician_pick": "Klinikus se Keuse",
  "start": "Begin",
  "continue": "Gaan voort",
  "in_progress": "In Vordering",
  "completed": "Voltooi"
}
```

---

## 9. Jest Spec

Create `services/ehr-service/src/services/education-personalization.service.spec.ts`:

```typescript
import { EducationPersonalizationService } from './education-personalization.service';

function makeService() {
  return new EducationPersonalizationService();
}

describe('EducationPersonalizationService', () => {
  it('returns popular courses when patient has no diagnoses', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([]) // diagnoses
        .mockResolvedValueOnce([{ course_id: 'c1', title: 'Health 101', description: 'Basics', thumbnail_url: null, enrolment_count: '10' }])
        .mockResolvedValueOnce([]), // enrolments
    };
    const result = await svc.getPersonalizedCourses('p1', db);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Health 101');
  });

  it('returns ranked courses when patient has diagnoses', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([{ icd10_code: 'E11', snomed_code: null, status: 'chronic' }])
        .mockResolvedValueOnce([{
          course_id: 'c2', title: 'Diabetes Management',
          description: 'Managing T2DM', thumbnail_url: null, relevance_score: '2.5',
          matched_codes: ['E11'],
        }])
        .mockResolvedValueOnce([]) // enrolments
        .mockResolvedValueOnce([]) // recommendations
        .mockResolvedValueOnce([]), // clinician recommended
    };
    const result = await svc.getPersonalizedCourses('p1', db);
    expect(result.length).toBeGreaterThan(0);
  });

  it('excludes completed courses', async () => {
    const svc = makeService();
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([{ icd10_code: 'E11', snomed_code: null, status: 'chronic' }])
        .mockResolvedValueOnce([{
          course_id: 'c2', title: 'DM Course', description: '',
          thumbnail_url: null, relevance_score: '1.0', matched_codes: ['E11'],
        }])
        .mockResolvedValueOnce([{ course_id: 'c2', status: 'completed' }]) // enrolments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    const result = await svc.getPersonalizedCourses('p1', db);
    expect(result.find((r) => r.courseId === 'c2')).toBeUndefined();
  });

  it('recommendCourse upserts recommendation', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'rec-1' }]) };
    const result = await svc.recommendCourse('p1', 'c1', 'doc1', 'Take this course', db);
    expect(result).toMatchObject({ id: 'rec-1' });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO education_clinician_recommendations'),
      expect.any(Array),
    );
  });
});
```

---

## 10. Definition of Done

- [ ] `education_course_diagnosis_map` and `education_clinician_recommendations` tables provisioned
- [ ] `EducationPersonalizationService` and `EducationPersonalizationController` in `ehr.module.ts`
- [ ] `GET /education/patient/personalized` returns ranked courses using patient diagnoses
- [ ] `POST /education/clinician/recommend` persists recommendation
- [ ] Patient portal shows "Recommended for You" section
- [ ] Mobile shows horizontal chip strip of recommended courses at top of Education screen
- [ ] EHR shows "Recommend Education" button on patient detail
- [ ] `tsc --noEmit` passes in all three frontend targets
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
- [ ] `npx expo export --platform all` passes
