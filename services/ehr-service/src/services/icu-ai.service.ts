import { Injectable } from '@nestjs/common';

const VENT_LIMITS = {
  plateau_max_cmH2O: 30,
  driving_max_cmH2O: 15,
  tv_max_ml_per_kg: 6,
  tv_warning_ml_per_kg: 8,
};

const VAP_BUNDLE_ITEMS = [
  'head_of_bed_30_45_degrees',
  'daily_sedation_vacation',
  'daily_extubation_assessment',
  'peptic_ulcer_prophylaxis',
  'dvt_prophylaxis',
  'oral_care_with_chlorhexidine',
];

const CAUTI_BUNDLE_ITEMS = [
  'catheter_necessity_reviewed',
  'closed_drainage_system',
  'catheter_below_bladder',
  'daily_catheter_care',
  'consider_removal_today',
];

export const DEFAULT_BUNDLE_ITEMS: Record<string, string[]> = {
  vap:   VAP_BUNDLE_ITEMS,
  cauti: CAUTI_BUNDLE_ITEMS,
};

@Injectable()
export class IcuAiService {
  async createSofaAlert(db: any, body: any): Promise<any> {
    const rows = await db.query(
      `INSERT INTO icu_sofa_delta_alerts (admission_id, patient_id, score_now, score_24h_ago)
       VALUES ($1,$2,$3,$4) RETURNING *, delta, is_deteriorating, alert_severity`,
      [body.admissionId, body.patientId, body.scoreNow, body.score24hAgo],
    );
    return rows[0] ?? null;
  }

  async getActiveSofaAlerts(db: any): Promise<any[]> {
    return db.query(
      `SELECT sa.*, p.first_name, p.last_name, ia.bed_code AS bed_number
       FROM icu_sofa_delta_alerts sa
       JOIN patients p ON p.id = sa.patient_id
       JOIN icu_admissions ia ON ia.id = sa.admission_id
       WHERE sa.acknowledged = FALSE AND sa.is_deteriorating = TRUE
       ORDER BY sa.alert_severity DESC, sa.created_at DESC`,
    );
  }

  async acknowledgeSofaAlert(db: any, id: string, acknowledgedBy: string): Promise<any> {
    const rows = await db.query(
      `UPDATE icu_sofa_delta_alerts
       SET acknowledged=TRUE, acknowledged_by=$1, acknowledged_at=NOW()
       WHERE id=$2 RETURNING *`,
      [acknowledgedBy, id],
    );
    return rows[0] ?? null;
  }

  async runVentSafetyCheck(db: any, body: any): Promise<any> {
    const settings = await db.query(
      `SELECT * FROM icu_ventilator_settings WHERE admission_id=$1 ORDER BY recorded_at DESC LIMIT 1`,
      [body.admissionId],
    );
    if (!settings[0]) return { safe: null, message: 'No ventilator settings found.' };

    const vent = settings[0];
    const ibwKg = body.patientIbwKg ?? 70;
    const tvPerKg = vent.tidal_volume_ml / ibwKg;
    const violations: string[] = [];

    const plateauSafe  = (vent.plateau_pressure ?? 0) <= VENT_LIMITS.plateau_max_cmH2O;
    const drivingSafe  = (vent.driving_pressure ?? 0) <= VENT_LIMITS.driving_max_cmH2O;
    const tvSafe       = tvPerKg <= VENT_LIMITS.tv_max_ml_per_kg;

    if (!plateauSafe) violations.push(`Plateau ${vent.plateau_pressure} cmH₂O exceeds 30 cmH₂O — adjust PEEP or TV.`);
    if (!drivingSafe) violations.push(`Driving pressure ${vent.driving_pressure} cmH₂O exceeds 15 cmH₂O — increase PEEP or reduce TV.`);
    if (!tvSafe)      violations.push(`TV ${tvPerKg.toFixed(1)} ml/kg IBW exceeds ARDSnet 6 ml/kg — reduce tidal volume.`);
    else if (tvPerKg > VENT_LIMITS.tv_warning_ml_per_kg) violations.push(`TV ${tvPerKg.toFixed(1)} ml/kg IBW > 8 ml/kg — consider reduction if ARDS suspected.`);

    await db.query(
      `INSERT INTO icu_vent_safety_checks
         (admission_id, vent_setting_id, patient_ibw_kg, plateau_safe, driving_safe, tv_safe, violations)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        body.admissionId, vent.id, ibwKg,
        plateauSafe, drivingSafe, tvSafe,
        JSON.stringify(violations.map(v => ({ message: v }))),
      ],
    );
    return {
      overall_safe:     plateauSafe && drivingSafe && tvSafe,
      plateau_safe:     plateauSafe,
      driving_safe:     drivingSafe,
      tv_safe:          tvSafe,
      tv_per_kg_ibw:    tvPerKg.toFixed(2),
      violations,
    };
  }

  async documentCareBundle(db: any, documentedBy: string, body: any): Promise<any> {
    const compliantCount = body.items.filter((i: any) => i.compliant).length;
    const rows = await db.query(
      `INSERT INTO icu_care_bundles
         (admission_id, bundle_type, items, compliant_count, total_items, documented_by)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6)
       ON CONFLICT (admission_id, bundle_date, bundle_type)
       DO UPDATE SET items=$3::jsonb, compliant_count=$4, total_items=$5, documented_by=$6, created_at=NOW()
       RETURNING *, compliance_pct`,
      [body.admissionId, body.bundleType, JSON.stringify(body.items), compliantCount, body.items.length, documentedBy],
    );
    const result = rows[0];
    return {
      ...result,
      cdss_alert: result?.compliance_pct < 80
        ? `⚠ ${body.bundleType.toUpperCase()} bundle compliance ${result.compliance_pct}% — below 80% threshold. Review non-compliant items.`
        : null,
    };
  }

  async getBundleHistory(db: any, admissionId: string): Promise<any[]> {
    return db.query(
      `SELECT * FROM icu_care_bundles WHERE admission_id=$1 ORDER BY bundle_date DESC, bundle_type`,
      [admissionId],
    );
  }

  async generateHandoverNote(db: any, generatedBy: string, shift: string): Promise<any> {
    const [census, alerts, ventAlarms, fluidWarnings] = await Promise.all([
      db.query(
        `SELECT p.first_name, p.last_name, ia.bed_code, ia.admission_diagnosis AS diagnosis,
                s.sofa_total AS sofa_score
         FROM icu_admissions ia
         JOIN patients p ON p.id = ia.patient_id
         LEFT JOIN LATERAL (
           SELECT sofa_total FROM icu_scores
           WHERE admission_id = ia.id ORDER BY scored_at DESC LIMIT 1
         ) s ON TRUE
         WHERE ia.discharge_at IS NULL
         ORDER BY s.sofa_total DESC NULLS LAST`,
      ),
      db.query(
        `SELECT p.first_name, ia.bed_code, sa.score_now, sa.delta
         FROM icu_sofa_delta_alerts sa
         JOIN icu_admissions ia ON ia.id = sa.admission_id
         JOIN patients p ON p.id = sa.patient_id
         WHERE sa.acknowledged = FALSE AND sa.is_deteriorating = TRUE`,
      ),
      db.query(
        `SELECT ia.bed_code, p.first_name
         FROM icu_ventilator_settings vs
         JOIN icu_admissions ia ON ia.id = vs.admission_id
         JOIN patients p ON p.id = ia.patient_id
         WHERE vs.is_alarm_driving_pressure = TRUE OR vs.is_alarm_plateau = TRUE`,
      ),
      db.query(
        `SELECT ia.bed_code, p.first_name, f.cumulative_48h_ml
         FROM icu_fluid_48h_summary f
         JOIN icu_admissions ia ON ia.id = f.admission_id
         JOIN patients p ON p.id = ia.patient_id
         WHERE f.cumulative_48h_ml > 3000`,
      ),
    ]);

    const criticalCount = census.filter((p: any) => (p.sofa_score ?? 0) >= 10).length;
    const today = new Date().toISOString().slice(0, 10);

    const summaryLines = [
      `ICU ${shift.toUpperCase()} HANDOVER — ${today}`,
      `Total patients: ${census.length} | Critical (SOFA≥10): ${criticalCount}`,
      '',
      '--- ACTIVE DETERIORATION ALERTS ---',
      ...(alerts.length > 0
        ? alerts.map((a: any) => `• Bed ${a.bed_code} ${a.first_name}: SOFA ${a.score_now} (Δ+${a.delta})`)
        : ['None']),
      '',
      '--- VENTILATOR ALARMS ---',
      ...(ventAlarms.length > 0
        ? ventAlarms.map((v: any) => `• Bed ${v.bed_code} ${v.first_name}: Vent alarm active`)
        : ['None']),
      '',
      '--- FLUID OVERLOAD WARNINGS (48h cumulative >3L) ---',
      ...(fluidWarnings.length > 0
        ? fluidWarnings.map((f: any) => `• Bed ${f.bed_code} ${f.first_name}: +${f.cumulative_48h_ml} ml`)
        : ['None']),
      '',
      '--- CENSUS ---',
      ...census.map((p: any) =>
        `Bed ${p.bed_code}: ${p.first_name} ${p.last_name} — ${p.diagnosis ?? 'unknown'} — SOFA ${p.sofa_score ?? '?'}`),
    ];

    const summaryText = summaryLines.join('\n');

    const rows = await db.query(
      `INSERT INTO icu_handover_notes
         (handover_date, shift, generated_by, is_ai_generated, patient_count, critical_count, summary_text, key_actions)
       VALUES (CURRENT_DATE,$1,$2,TRUE,$3,$4,$5,'[]'::jsonb)
       ON CONFLICT (handover_date, shift)
       DO UPDATE SET summary_text=$5, patient_count=$3, critical_count=$4, created_at=NOW()
       RETURNING *`,
      [shift, generatedBy, census.length, criticalCount, summaryText],
    );
    return rows[0] ?? null;
  }

  async getLatestHandover(db: any): Promise<any> {
    const rows = await db.query(
      `SELECT * FROM icu_handover_notes ORDER BY handover_date DESC, created_at DESC LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async getFluidOverloadWarnings(db: any): Promise<any[]> {
    return db.query(
      `SELECT f.*, ia.bed_code AS bed_number, p.first_name, p.last_name
       FROM icu_fluid_48h_summary f
       JOIN icu_admissions ia ON ia.id = f.admission_id
       JOIN patients p ON p.id = ia.patient_id
       WHERE f.cumulative_48h_ml > 3000
       ORDER BY f.cumulative_48h_ml DESC`,
    );
  }
}
