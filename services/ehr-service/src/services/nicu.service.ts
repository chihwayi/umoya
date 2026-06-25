import { Injectable } from '@nestjs/common';

// Bhutani nomogram thresholds (total bilirubin μmol/L by hours of life, term infants ≥38 weeks)
// Source: Bhutani VK, Johnson L, Sivieri EM. Pediatrics 1999
const PHOTOTHERAPY_THRESHOLDS = [
  { hourMin: 0,  hourMax: 24,  photoThreshold: 102, exchangeThreshold: 257 },
  { hourMin: 24, hourMax: 48,  photoThreshold: 154, exchangeThreshold: 308 },
  { hourMin: 48, hourMax: 72,  photoThreshold: 188, exchangeThreshold: 342 },
  { hourMin: 72, hourMax: 999, photoThreshold: 205, exchangeThreshold: 359 },
];

function getBilirubinThresholds(hoursOfLife: number): { photoThreshold: number; exchangeThreshold: number } {
  const row = PHOTOTHERAPY_THRESHOLDS.find(r => hoursOfLife >= r.hourMin && hoursOfLife < r.hourMax);
  return row
    ? { photoThreshold: row.photoThreshold, exchangeThreshold: row.exchangeThreshold }
    : { photoThreshold: 205, exchangeThreshold: 359 };
}

@Injectable()
export class NicuService {

  async admitNewborn(db: any, admittedBy: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_admissions (
         patient_id, delivery_id, mother_patient_id, gestational_age_weeks, birth_weight_grams,
         birth_length_cm, head_circumference_cm, apgar_1min, apgar_5min, delivery_type,
         admission_reason, incubator_code, hiv_exposed, resuscitation_required, admitted_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *, is_premature, is_vlbw, is_elbw`,
      [
        body.patientId, body.deliveryId ?? null, body.motherPatientId ?? null,
        body.gestationalAgeWeeks, body.birthWeightGrams, body.birthLengthCm ?? null,
        body.headCircumferenceCm ?? null, body.apgar1min ?? null, body.apgar5min ?? null,
        body.deliveryType ?? null, body.admissionReason, body.incubatorCode ?? null,
        body.hivExposed ?? false, body.resuscitationRequired ?? false, admittedBy,
      ],
    );
    return rows[0] ?? null;
  }

  async getCensus(db: any): Promise<any[]> {
    return db.query(
      `SELECT na.id, na.gestational_age_weeks, na.birth_weight_grams, na.is_premature, na.is_vlbw,
              na.is_elbw, na.incubator_code, na.los_days, na.hiv_exposed, na.status,
              p.first_name, p.last_name,
              latest_bili.total_bilirubin, latest_bili.hours_of_life,
              latest_bili.above_phototherapy_threshold,
              kmc_today.total_hours AS kmc_hours_today,
              latest_weight.weight_grams AS current_weight
       FROM nicu_admissions na
       JOIN patients p ON p.id = na.patient_id
       LEFT JOIN LATERAL (
         SELECT total_bilirubin, hours_of_life, above_phototherapy_threshold
         FROM nicu_bilirubin_readings
         WHERE admission_id = na.id
         ORDER BY measured_at DESC LIMIT 1
       ) latest_bili ON TRUE
       LEFT JOIN nicu_kmc_daily_summary kmc_today
         ON kmc_today.admission_id = na.id AND kmc_today.kmc_date = CURRENT_DATE
       LEFT JOIN LATERAL (
         SELECT weight_grams
         FROM nicu_vitals
         WHERE admission_id = na.id AND weight_grams IS NOT NULL
         ORDER BY charted_at DESC LIMIT 1
       ) latest_weight ON TRUE
       WHERE na.status = 'active'
       ORDER BY na.is_vlbw DESC, na.gestational_age_weeks ASC`,
    );
  }

  async getAdmission(db: any, id: string): Promise<any> {
    const rows = await db.query(
      `SELECT na.*, p.first_name, p.last_name, p.date_of_birth,
              m.first_name AS mother_first, m.last_name AS mother_last
       FROM nicu_admissions na
       JOIN patients p ON p.id = na.patient_id
       LEFT JOIN patients m ON m.id = na.mother_patient_id
       WHERE na.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async discharge(db: any, id: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE nicu_admissions
       SET status = COALESCE($1, 'discharged'), discharge_at = NOW(),
           discharge_weight_grams = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *, los_days`,
      [body.status ?? null, body.dischargeWeightGrams ?? null, id],
    );
    return rows[0] ?? null;
  }

  async recordIncubatorSettings(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_incubator_settings (
         admission_id, device_type, set_temp_celsius, humidity_pct,
         skin_temp_celsius, axillary_temp_celsius, notes, recorded_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        admissionId, body.deviceType ?? 'incubator', body.setTempCelsius ?? null,
        body.humidityPct ?? null, body.skinTempCelsius ?? null,
        body.axillaryTempCelsius ?? null, body.notes ?? null, recordedBy,
      ],
    );
    return rows[0] ?? null;
  }

  async getLatestIncubatorSettings(db: any, admissionId: string): Promise<any> {
    const rows = await db.query(
      `SELECT * FROM nicu_incubator_settings WHERE admission_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [admissionId],
    );
    return rows[0] ?? null;
  }

  async chartVitals(db: any, chartedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_vitals (
         admission_id, hr, rr, spo2, temperature, bp_systolic, weight_grams,
         blood_glucose, crt_seconds, color, tone, activity, apnoea_episodes, charted_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        admissionId, body.hr ?? null, body.rr ?? null, body.spo2 ?? null,
        body.temperature ?? null, body.bpSystolic ?? null, body.weightGrams ?? null,
        body.bloodGlucose ?? null, body.crtSeconds ?? null, body.color ?? null,
        body.tone ?? null, body.activity ?? null, body.apnoeaEpisodes ?? null, chartedBy,
      ],
    );
    return rows[0] ?? null;
  }

  async getVitals(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM nicu_vitals WHERE admission_id = $1 ORDER BY charted_at DESC LIMIT 24`,
      [admissionId],
    );
  }

  async recordBilirubin(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const thresholds = getBilirubinThresholds(body.hoursOfLife);
    const abovePhoto    = body.totalBilirubin >= thresholds.photoThreshold;
    const aboveExchange = body.totalBilirubin >= thresholds.exchangeThreshold;

    const rows = await db.query(
      `INSERT INTO nicu_bilirubin_readings (
         admission_id, session_id, hours_of_life, total_bilirubin, method,
         above_phototherapy_threshold, above_exchange_threshold, recorded_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        admissionId, body.sessionId ?? null, body.hoursOfLife, body.totalBilirubin,
        body.method ?? 'serum_tsb', abovePhoto, aboveExchange, recordedBy,
      ],
    );

    return {
      ...(rows[0] ?? {}),
      thresholds,
      cdss_alert: aboveExchange
        ? '⚠ EXCHANGE TRANSFUSION THRESHOLD MET. Urgent senior review required.'
        : abovePhoto
          ? 'Phototherapy indicated based on Bhutani nomogram.'
          : null,
    };
  }

  async getBilirubinHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM nicu_bilirubin_readings WHERE admission_id = $1 ORDER BY measured_at ASC`,
      [admissionId],
    );
  }

  async startPhototherapy(db: any, orderedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_phototherapy_sessions (
         admission_id, total_bilirubin, hours_of_life, phototherapy_type, ordered_by
       ) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        admissionId, body.totalBilirubin, body.hoursOfLife,
        body.phototherapyType ?? 'conventional', orderedBy,
      ],
    );
    return rows[0] ?? null;
  }

  async stopPhototherapy(db: any, sessionId: string, stoppedReason: string): Promise<any> {
    const rows = await db.query(
      `UPDATE nicu_phototherapy_sessions
       SET ended_at = NOW(), stopped_reason = $1
       WHERE id = $2 RETURNING *`,
      [stoppedReason, sessionId],
    );
    return rows[0] ?? null;
  }

  async startKmc(db: any, recordedBy: string, admissionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO nicu_kmc_sessions (admission_id, mother_patient_id, caregiver_name, recorded_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [admissionId, body.motherPatientId ?? null, body.caregiverName ?? null, recordedBy],
    );
    return rows[0] ?? null;
  }

  async stopKmc(db: any, sessionId: string, body: any): Promise<any> {
    const rows = await db.query(
      `UPDATE nicu_kmc_sessions
       SET ended_at = NOW(), temp_during_kmc = $1, fed_during_kmc = $2, notes = $3
       WHERE id = $4
       RETURNING *, duration_mins`,
      [body.tempDuringKmc ?? null, body.fedDuringKmc ?? false, body.notes ?? null, sessionId],
    );
    return rows[0] ?? null;
  }

  async getKmcSummary(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM nicu_kmc_daily_summary WHERE admission_id = $1 ORDER BY kmc_date DESC LIMIT 7`,
      [admissionId],
    );
  }

  async getDashboard(db: any): Promise<any> {
    const [census, jaundice, kmc] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_premature) AS premature,
                COUNT(*) FILTER (WHERE is_vlbw)      AS vlbw
         FROM nicu_admissions WHERE status = 'active'`,
      ),
      db.query(
        `SELECT COUNT(*) AS needs_photo
         FROM nicu_bilirubin_readings
         WHERE above_phototherapy_threshold = TRUE
           AND measured_at >= NOW() - INTERVAL '24 hours'`,
      ),
      db.query(
        `SELECT ROUND(AVG(total_hours), 1) AS avg_kmc_hrs
         FROM nicu_kmc_daily_summary WHERE kmc_date = CURRENT_DATE`,
      ),
    ]);
    return { census: census[0], jaundice: jaundice[0], kmcToday: kmc[0] };
  }
}
