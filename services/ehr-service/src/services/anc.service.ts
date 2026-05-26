import { Injectable } from '@nestjs/common';

@Injectable()
export class AncService {
  computeEdd(lmpDate: string): string {
    const lmp = new Date(lmpDate);
    const edd = new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);
    return edd.toISOString().split('T')[0];
  }

  isMaternalTransmissionRisk(gestationalAgeWeeks: number, viralLoad: number | undefined): boolean {
    return gestationalAgeWeeks >= 36 && viralLoad !== undefined && viralLoad > 1000;
  }

  async registerAnc(
    data: {
      patientId: string;
      lmpDate: string;
      gravida: number;
      para: number;
      artStartDate?: string;
      currentRegimen?: string;
    },
    db: any,
  ): Promise<{ id: string; edd: string }> {
    const edd = this.computeEdd(data.lmpDate);

    const rows = await db.query(
      `INSERT INTO anc_registrations (patient_id, lmp_date, edd, gravida, para, hiv_status, art_start_date, current_regimen)
       VALUES ($1, $2, $3, $4, $5, 'positive', $6, $7)
       ON CONFLICT (patient_id) DO UPDATE SET
         lmp_date = EXCLUDED.lmp_date, edd = EXCLUDED.edd,
         gravida = EXCLUDED.gravida, para = EXCLUDED.para,
         updated_at = NOW()
       RETURNING id`,
      [
        data.patientId, data.lmpDate, edd, data.gravida, data.para,
        data.artStartDate ?? null, data.currentRegimen ?? null,
      ],
    );

    return { id: rows[0].id, edd };
  }

  async recordPmtctVisit(
    data: {
      ancRegistrationId: string;
      visitDate: string;
      gestationalAgeWeeks: number;
      weightKg?: number;
      bloodPressure?: string;
      cd4Count?: number;
      viralLoad?: number;
      adherenceScore?: number;
    },
    clinicianId: string,
    db: any,
  ): Promise<{ id: string; maternalTransmissionRisk?: string }> {
    let mtr: string | undefined;

    if (this.isMaternalTransmissionRisk(data.gestationalAgeWeeks, data.viralLoad)) {
      mtr = 'high';
      await db.query(
        `UPDATE anc_registrations SET vl_at_36_weeks = $2, maternal_transmission_risk = 'high', updated_at = NOW()
         WHERE id = $1`,
        [data.ancRegistrationId, data.viralLoad],
      );
    }

    const rows = await db.query(
      `INSERT INTO pmtct_visits (anc_registration_id, visit_date, gestational_age_weeks, weight_kg, blood_pressure, cd4_count, viral_load, adherence_score, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        data.ancRegistrationId, data.visitDate, data.gestationalAgeWeeks,
        data.weightKg ?? null, data.bloodPressure ?? null,
        data.cd4Count ?? null, data.viralLoad ?? null,
        data.adherenceScore ?? null, clinicianId,
      ],
    );

    return { id: rows[0].id, maternalTransmissionRisk: mtr };
  }

  async createEidSchedule(
    data: {
      motherPatientId: string;
      infantName: string;
      birthDate: string;
      isHighRisk: boolean;
    },
    db: any,
  ): Promise<{ id: string }> {
    const birth = new Date(data.birthDate);
    const addWeeks = (d: Date, w: number) =>
      new Date(d.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const addMonths = (d: Date, m: number) => {
      const r = new Date(d);
      r.setMonth(r.getMonth() + m);
      return r;
    };
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const nvpDuration = data.isHighRisk ? 12 : 6;

    const rows = await db.query(
      `INSERT INTO eid_schedules (
         mother_patient_id, infant_name, birth_date, nvp_start_date, nvp_duration_weeks,
         test_6w_due, test_4m_due, test_12m_due, test_18m_due
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        data.motherPatientId, data.infantName, data.birthDate,
        fmt(birth), nvpDuration,
        fmt(addWeeks(birth, 6)),
        fmt(addMonths(birth, 4)),
        fmt(addMonths(birth, 12)),
        fmt(addMonths(birth, 18)),
      ],
    );

    return rows[0];
  }

  async recordEidResult(
    eidId: string,
    timepoint: '6w' | '4m' | '12m' | '18m',
    result: 'positive' | 'negative' | 'indeterminate',
    doneDate: string,
    db: any,
  ): Promise<{ requiresImmediateArt: boolean }> {
    const col = `test_${timepoint}`;
    await db.query(
      `UPDATE eid_schedules SET ${col}_result = $2, ${col}_done_at = $3, updated_at = NOW() WHERE id = $1`,
      [eidId, result, doneDate],
    );

    if (result === 'positive') {
      await db.query(
        `UPDATE eid_schedules SET final_hiv_status = 'positive', transmission_occurred = true WHERE id = $1`,
        [eidId],
      );
      return { requiresImmediateArt: true };
    }

    if (timepoint === '18m' && result === 'negative') {
      await db.query(
        `UPDATE eid_schedules SET final_hiv_status = 'negative', transmission_occurred = false WHERE id = $1`,
        [eidId],
      );
    }

    return { requiresImmediateArt: false };
  }

  async getOverdueEid(db: any) {
    return db.query(
      `SELECT e.*, p.first_name || ' ' || p.last_name AS mother_name
       FROM eid_schedules e
       JOIN patients p ON p.id = e.mother_patient_id
       WHERE (e.test_6w_result IS NULL AND e.test_6w_due < CURRENT_DATE)
          OR (e.test_4m_result IS NULL AND e.test_4m_due < CURRENT_DATE)
          OR (e.test_12m_result IS NULL AND e.test_12m_due < CURRENT_DATE)
          OR (e.test_18m_result IS NULL AND e.test_18m_due < CURRENT_DATE)
       ORDER BY LEAST(
         CASE WHEN e.test_6w_result IS NULL THEN e.test_6w_due END,
         CASE WHEN e.test_4m_result IS NULL THEN e.test_4m_due END
       ) ASC`,
      [],
    );
  }

  async getAncByPatient(patientId: string, db: any) {
    const rows = await db.query(
      `SELECT ar.*, json_agg(pv ORDER BY pv.visit_date DESC) FILTER (WHERE pv.id IS NOT NULL) AS visits
       FROM anc_registrations ar
       LEFT JOIN pmtct_visits pv ON pv.anc_registration_id = ar.id
       WHERE ar.patient_id = $1
       GROUP BY ar.id`,
      [patientId],
    );
    return rows[0] ?? null;
  }
}
