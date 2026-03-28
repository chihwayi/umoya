import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

const ALLOWED_BUNDLE_ELEMENTS = [
  'lactate_measured',
  'blood_cultures_drawn',
  'broad_spectrum_antibiotics_given',
  'fluid_bolus_given',
  'vasopressors_initiated',
  'repeat_lactate_measured',
] as const;

// ── Sepsis scoring helpers ──────────────────────────────────────────────────

function deriveQsofaCriteria(d: any): { alteredMentalStatus: boolean; systolicBpLow: boolean; respiratoryRateHigh: boolean } {
  const sbp = Number(d.systolicBp ?? d.systolic_bp ?? NaN);
  const rr  = Number(d.respiratoryRate ?? d.respiratory_rate ?? NaN);
  return {
    alteredMentalStatus: Boolean(d.qsofaAlteredMentalStatus ?? d.alteredMentalStatus ?? d.gcs_lt15 ?? false),
    systolicBpLow:      !isNaN(sbp) ? sbp <= 100 : Boolean(d.qsofaSystolicBpLow ?? false),
    respiratoryRateHigh: !isNaN(rr)  ? rr >= 22   : Boolean(d.qsofaRespiratoryRateHigh ?? false),
  };
}

function deriveSirsCriteria(d: any): { tempAbnormal: boolean; heartRateHigh: boolean; respiratoryRateHigh: boolean; wbcAbnormal: boolean } {
  const temp = Number(d.temperature ?? NaN);
  const hr   = Number(d.heartRate ?? d.heart_rate ?? NaN);
  const rr   = Number(d.respiratoryRate ?? d.respiratory_rate ?? NaN);
  const wbc  = Number(d.wbcCount ?? d.wbc_count ?? NaN);
  return {
    tempAbnormal:       !isNaN(temp) ? (temp < 36 || temp > 38)  : Boolean(d.sirsTempAbnormal ?? false),
    heartRateHigh:      !isNaN(hr)   ? hr > 90                   : Boolean(d.sirsHeartRateHigh ?? false),
    respiratoryRateHigh:!isNaN(rr)   ? rr > 20                   : Boolean(d.sirsRespiratoryRateHigh ?? false),
    wbcAbnormal:        !isNaN(wbc)  ? (wbc < 4 || wbc > 12)    : Boolean(d.sirsWbcAbnormal ?? false),
  };
}

/**
 * National Early Warning Score 2 (NEWS2) — Royal College of Physicians standard.
 * Higher = more physiologically deranged.
 */
function calculateNEWS2(d: any): { score: number; components: Record<string, number>; riskCategory: string } {
  const rr   = Number(d.respiratoryRate ?? d.respiratory_rate ?? NaN);
  const spo2 = Number(d.oxygenSaturation ?? d.spo2 ?? NaN);
  const sbp  = Number(d.systolicBp ?? d.systolic_bp ?? NaN);
  const hr   = Number(d.heartRate ?? d.heart_rate ?? NaN);
  const temp = Number(d.temperature ?? NaN);
  const avpu = String(d.consciousness ?? d.avpu ?? 'A').toUpperCase();

  const rrScore  = isNaN(rr)   ? 0 : rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2Score= isNaN(spo2) ? 0 : spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  const sbpScore = isNaN(sbp)  ? 0 : sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
  const hrScore  = isNaN(hr)   ? 0 : hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  const tempScore= isNaN(temp) ? 0 : temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2;
  const avpuScore= avpu.startsWith('A') ? 0 : 3;

  const total = rrScore + spo2Score + sbpScore + hrScore + tempScore + avpuScore;
  const riskCategory = total >= 7 ? 'high' : total >= 5 ? 'medium' : total >= 1 ? 'low' : 'minimal';

  return {
    score: total,
    components: { rr: rrScore, spo2: spo2Score, sbp: sbpScore, hr: hrScore, temp: tempScore, avpu: avpuScore },
    riskCategory,
  };
}

/**
 * Composite sepsis probability (0–1) fusing qSOFA, SIRS, NEWS2 and lactate.
 * Returns an interpretable risk label and early-sepsis flag.
 */
function calculateCompositeRisk(args: {
  qsofaScore: number; sirsScore: number; news2: number;
  lactate: number | null; age: number | null;
}): { probability: number; label: 'septic_shock' | 'severe_sepsis' | 'sepsis' | 'early_concern' | 'low'; earlyWarning: boolean; earlyWarningReason: string } {
  const { qsofaScore, sirsScore, news2, lactate, age } = args;
  const lac = lactate !== null && !isNaN(lactate) ? lactate : 0;

  let score = 0;
  score += qsofaScore >= 2 ? 0.35 : qsofaScore === 1 ? 0.15 : 0;
  score += sirsScore >= 2  ? 0.25 : sirsScore === 1 ? 0.10 : 0;
  score += news2 >= 7      ? 0.20 : news2 >= 5 ? 0.12 : news2 >= 3 ? 0.05 : 0;
  score += lac >= 4        ? 0.25 : lac >= 2 ? 0.15 : lac >= 1.5 ? 0.05 : 0;
  if (age !== null && age >= 65) score += 0.05;

  const probability = Math.min(score, 0.98);

  const septicShock  = (qsofaScore >= 2 || sirsScore >= 2) && lac >= 2;
  const severeSepsis = (qsofaScore >= 2 || sirsScore >= 2) && lac >= 1;
  const sepsis       = qsofaScore >= 2 || sirsScore >= 2;
  const earlyConcern = (qsofaScore === 1 && lac >= 2) || (news2 >= 5 && sirsScore >= 1) || (lac >= 2 && sirsScore >= 2);

  const earlyWarningReasons: string[] = [];
  if (qsofaScore === 1 && lac >= 2) earlyWarningReasons.push('qSOFA=1 with lactate ≥2 mmol/L — early sepsis concern');
  if (news2 >= 5)                   earlyWarningReasons.push(`NEWS2=${news2} (${news2 >= 7 ? 'high' : 'medium'} clinical risk)`);
  if (lac >= 2 && qsofaScore < 2)   earlyWarningReasons.push('Lactate ≥2 mmol/L with sub-threshold qSOFA — monitor closely');

  const label = septicShock ? 'septic_shock' : severeSepsis ? 'severe_sepsis' : sepsis ? 'sepsis' : earlyConcern ? 'early_concern' : 'low';

  return {
    probability: Math.round(probability * 100) / 100,
    label,
    earlyWarning: earlyConcern && !sepsis,
    earlyWarningReason: earlyWarningReasons.join('; '),
  };
}

// ───────────────────────────────────────────────────────────────────────────

@Injectable()
export class SepsisService {
  private readonly logger = new Logger(SepsisService.name);

  constructor() {}

  async screenForSepsis(
    screeningData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    // Auto-derive criteria from raw vitals (overrides manual booleans when vitals present)
    const qsofa = deriveQsofaCriteria(screeningData);
    const sirs  = deriveSirsCriteria(screeningData);
    const news2 = calculateNEWS2(screeningData);
    const lactate = screeningData.lactate != null ? Number(screeningData.lactate) : null;
    const age     = screeningData.age != null ? Number(screeningData.age) : null;

    const qsofaScore = (qsofa.alteredMentalStatus ? 1 : 0) + (qsofa.systolicBpLow ? 1 : 0) + (qsofa.respiratoryRateHigh ? 1 : 0);
    const sirsScore  = (sirs.tempAbnormal ? 1 : 0) + (sirs.heartRateHigh ? 1 : 0) + (sirs.respiratoryRateHigh ? 1 : 0) + (sirs.wbcAbnormal ? 1 : 0);

    const composite = calculateCompositeRisk({ qsofaScore, sirsScore, news2: news2.score, lactate, age });

    // Expanded sepsis detection: standard threshold + early warning signals
    const sepsisSuspected = qsofaScore >= 2
      || (sirsScore >= 2 && (lactate ?? 0) > 2)
      || composite.earlyWarning
      || news2.score >= 7;

    const result = await tenantDb.query(
      `INSERT INTO sepsis_screenings (patient_id, admission_id, screening_location,
        qsofa_altered_mental_status, qsofa_systolic_bp_low, qsofa_respiratory_rate_high, qsofa_score,
        sirs_temp_abnormal, sirs_heart_rate_high, sirs_respiratory_rate_high, sirs_wbc_abnormal, sirs_score,
        temperature, heart_rate, respiratory_rate, systolic_bp, oxygen_saturation, wbc_count, lactate,
        sepsis_suspected, sepsis_alert_triggered, screened_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING *`,
      [
        screeningData.patientId, screeningData.admissionId, screeningData.screeningLocation,
        // Use auto-derived criteria (more reliable than manual boolean entry)
        qsofa.alteredMentalStatus, qsofa.systolicBpLow, qsofa.respiratoryRateHigh, qsofaScore,
        sirs.tempAbnormal, sirs.heartRateHigh, sirs.respiratoryRateHigh, sirs.wbcAbnormal, sirsScore,
        screeningData.temperature, screeningData.heartRate, screeningData.respiratoryRate,
        screeningData.systolicBp, screeningData.oxygenSaturation, screeningData.wbcCount, screeningData.lactate,
        sepsisSuspected, sepsisSuspected, userId,
      ],
    );

    const row = result[0];
    return {
      ...row,
      // Enriched AI scoring fields returned to caller
      news2Score:            news2.score,
      news2RiskCategory:     news2.riskCategory,
      news2Components:       news2.components,
      compositeProbability:  composite.probability,
      compositeLabel:        composite.label,
      earlyWarning:          composite.earlyWarning,
      earlyWarningReason:    composite.earlyWarningReason,
      derivedCriteria: {
        qsofa, sirs,
        lactateMmolL: lactate,
      },
    };
  }

  /**
   * Calculate sepsis risk scores from raw vitals without persisting a screening.
   * Used by real-time monitoring and nurse copilot.
   */
  calculateRiskFromVitals(vitals: {
    temperature?: number; heartRate?: number; respiratoryRate?: number;
    systolicBp?: number; oxygenSaturation?: number; wbcCount?: number;
    lactate?: number; age?: number; consciousness?: string;
  }): {
    qsofaScore: number; qsofa: ReturnType<typeof deriveQsofaCriteria>;
    sirsScore: number;  sirs: ReturnType<typeof deriveSirsCriteria>;
    news2: ReturnType<typeof calculateNEWS2>;
    composite: ReturnType<typeof calculateCompositeRisk>;
    sepsisSuspected: boolean;
    immediateActions: string[];
  } {
    const qsofa = deriveQsofaCriteria(vitals);
    const sirs  = deriveSirsCriteria(vitals);
    const news2 = calculateNEWS2(vitals);
    const lactate = vitals.lactate != null ? Number(vitals.lactate) : null;
    const age     = vitals.age != null ? Number(vitals.age) : null;
    const qsofaScore = (qsofa.alteredMentalStatus ? 1 : 0) + (qsofa.systolicBpLow ? 1 : 0) + (qsofa.respiratoryRateHigh ? 1 : 0);
    const sirsScore  = (sirs.tempAbnormal ? 1 : 0) + (sirs.heartRateHigh ? 1 : 0) + (sirs.respiratoryRateHigh ? 1 : 0) + (sirs.wbcAbnormal ? 1 : 0);
    const composite  = calculateCompositeRisk({ qsofaScore, sirsScore, news2: news2.score, lactate, age });
    const sepsisSuspected = qsofaScore >= 2 || (sirsScore >= 2 && (lactate ?? 0) > 2) || composite.earlyWarning || news2.score >= 7;

    const immediateActions: string[] = [];
    if (composite.label === 'septic_shock')  immediateActions.push('SEPTIC SHOCK: IV broad-spectrum antibiotics NOW, 30ml/kg fluid bolus, noradrenaline if MAP <65.');
    if (composite.label === 'severe_sepsis') immediateActions.push('SEVERE SEPSIS: Blood cultures ×2, IV antibiotics within 1h, lactate, IV fluid resuscitation.');
    if (composite.label === 'sepsis')        immediateActions.push('SEPSIS: Initiate 1-hour bundle — cultures, antibiotics, lactate, fluid assessment.');
    if (composite.earlyWarning)              immediateActions.push(`Early concern: ${composite.earlyWarningReason}. Increase monitoring frequency, reassess in 30 min.`);
    if (news2.score >= 7)                    immediateActions.push(`NEWS2=${news2.score} (HIGH risk) — urgent clinical review required.`);
    else if (news2.score >= 5)               immediateActions.push(`NEWS2=${news2.score} (medium risk) — increase vital signs monitoring to every 1h.`);
    if (lactate !== null && lactate >= 4)    immediateActions.push('Lactate ≥4 mmol/L — septic shock criterion met. Resuscitate and recheck lactate within 2h.');
    else if (lactate !== null && lactate >= 2) immediateActions.push('Lactate ≥2 mmol/L — repeat within 2–4h to assess trajectory.');

    return { qsofaScore, qsofa, sirsScore, sirs, news2, composite, sepsisSuspected, immediateActions };
  }

  async initiateSepsisBundle(
    bundleData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    const screening = bundleData?.sepsisScreeningId
      ? (
          await tenantDb.query(
            `SELECT id, screening_datetime, lactate, severe_sepsis, septic_shock
             FROM sepsis_screenings
             WHERE id = $1
             LIMIT 1`,
            [bundleData.sepsisScreeningId],
          )
        )?.[0]
      : null;

    const onsetTime =
      bundleData?.sepsisOnsetTime || screening?.screening_datetime || bundleData?.bundleStartTime || new Date();
    const lactateValue =
      bundleData?.lactateValue !== undefined && bundleData?.lactateValue !== null
        ? Number(bundleData.lactateValue)
        : screening?.lactate !== undefined && screening?.lactate !== null
        ? Number(screening.lactate)
        : null;

    const result = await tenantDb.query(
      `INSERT INTO sepsis_bundles (
         patient_id,
         admission_id,
         sepsis_screening_id,
         bundle_start_time,
         sepsis_onset_time,
         lactate_value,
         managed_by
       )
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        bundleData.patientId,
        bundleData.admissionId,
        bundleData.sepsisScreeningId,
        new Date(),
        onsetTime,
        Number.isFinite(lactateValue) ? lactateValue : null,
        userId,
      ],
    );
    return result[0];
  }

  async updateBundleElement(
    bundleId: string,
    element: string,
    value: any,
    tenantDb: DataSource,
  ): Promise<any> {
    if (!ALLOWED_BUNDLE_ELEMENTS.includes(element as any)) {
      throw new BadRequestException(`Invalid bundle element: ${element}`);
    }
    const timeColMap: Record<string, string> = {
      lactate_measured: 'lactate_measured_at',
      blood_cultures_drawn: 'blood_cultures_drawn_at',
      broad_spectrum_antibiotics_given: 'antibiotics_given_at',
      fluid_bolus_given: 'fluid_bolus_given_at',
      vasopressors_initiated: 'vasopressors_initiated_at',
      repeat_lactate_measured: 'repeat_lactate_time',
    };
    const timeColumn = timeColMap[element] || element.replace('_given', '_time').replace('_measured', '_time');

    const result = await tenantDb.query(
      `UPDATE sepsis_bundles SET ${element} = $1, ${timeColumn} = NOW() WHERE id = $2 RETURNING *`,
      [value, bundleId],
    );
    const updated = result[0];

    if (updated) {
      if (value === true) {
        await this.checkThreeHourBundleComplete(tenantDb, bundleId, updated);
      }
      await this.recomputeBundleCompliance(tenantDb, bundleId);
    }

    const [hydrated] = await tenantDb.query(
      `SELECT *
       FROM sepsis_bundles
       WHERE id = $1
       LIMIT 1`,
      [bundleId],
    );

    return hydrated || updated;
  }

  async updateBundleNotes(bundleId: string, notes: string, tenantDb: DataSource): Promise<any> {
    const [updated] = await tenantDb.query(
      `
      UPDATE sepsis_bundles
      SET notes = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [notes, bundleId],
    );
    return updated;
  }

  private async checkThreeHourBundleComplete(
    tenantDb: DataSource,
    bundleId: string,
    bundle: any,
  ): Promise<void> {
    const lactate = bundle.lactate_measured === true;
    const cultures = bundle.blood_cultures_drawn === true;
    const antibiotics = bundle.broad_spectrum_antibiotics_given === true;

    if (!lactate || !cultures || !antibiotics) return;

    const onset = bundle.sepsis_onset_time;
    if (!onset) return;

    const onsetMs = new Date(onset).getTime();
    const threeHoursMs = 3 * 60 * 60 * 1000;

    const times = [
      bundle.lactate_measured_at,
      bundle.blood_cultures_drawn_at,
      bundle.antibiotics_given_at,
    ].filter(Boolean).map((t: string) => new Date(t).getTime());

    if (times.length < 3) return;

    const allWithinThreeHours = times.every((t) => t - onsetMs <= threeHoursMs);
    if (allWithinThreeHours) {
      await tenantDb.query(
        `UPDATE sepsis_bundles SET three_hour_bundle_complete = true WHERE id = $1`,
        [bundleId],
      );
      this.logger.log(`Three-hour bundle auto-completed for bundle ${bundleId}`);
    }
  }

  async getSepsisAlerts(
    tenantDb: DataSource,
  ): Promise<any[]> {
    return await tenantDb.query(
      `SELECT s.*, p.first_name, p.last_name, a.current_ward as ward_name, b.bed_number
      FROM sepsis_screenings s
      JOIN patients p ON s.patient_id = p.id
      LEFT JOIN admissions a ON s.admission_id = a.id
      LEFT JOIN beds b ON a.current_bed_id = b.id
      WHERE s.sepsis_suspected = true AND s.screening_datetime > NOW() - INTERVAL '24 hours'
      ORDER BY s.screening_datetime DESC`
    );
  }

  async getBundleCompliance(
    startDate: Date,
    endDate: Date,
    tenantDb: DataSource,
  ): Promise<any> {
    const [result] = await tenantDb.query(
      `SELECT 
        COUNT(*) as total_bundles,
        SUM(CASE WHEN three_hour_bundle_complete THEN 1 ELSE 0 END) as three_hour_compliant,
        SUM(CASE WHEN six_hour_bundle_complete THEN 1 ELSE 0 END) as six_hour_compliant,
        SUM(CASE WHEN overall_compliance THEN 1 ELSE 0 END) as overall_compliant
      FROM sepsis_bundles
      WHERE bundle_start_time >= $1 AND bundle_start_time <= $2`,
      [startDate, endDate]
    );

    const bundles = await this.getBundleWorklist(tenantDb, {
      startDate,
      endDate,
      includeCompleted: true,
      limit: 100,
    });

    return {
      total_bundles: Number(result?.total_bundles || 0),
      three_hour_compliant: Number(result?.three_hour_compliant || 0),
      six_hour_compliant: Number(result?.six_hour_compliant || 0),
      overall_compliant: Number(result?.overall_compliant || 0),
      bundles,
    };
  }

  async getBundleWorklist(
    tenantDb: DataSource,
    options?: {
      startDate?: Date;
      endDate?: Date;
      includeCompleted?: boolean;
      limit?: number;
      focus?: string;
    },
  ): Promise<any[]> {
    const includeCompleted = Boolean(options?.includeCompleted);
    const focus = String(options?.focus || 'all').toLowerCase();
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 50;
    const startDate = options?.startDate || new Date(new Date().setDate(new Date().getDate() - 14));
    const endDate = options?.endDate || new Date();

    const rows = await tenantDb.query(
      `
      SELECT
        sb.id,
        sb.patient_id,
        sb.admission_id,
        sb.sepsis_screening_id,
        sb.bundle_start_time,
        sb.sepsis_onset_time,
        sb.three_hour_bundle_complete,
        sb.six_hour_bundle_complete,
        sb.overall_compliance,
        sb.repeat_lactate_measured,
        sb.repeat_lactate_time,
        sb.lactate_value,
        sb.repeat_lactate_value,
        sb.lactate_measured,
        sb.lactate_measured_at,
        sb.blood_cultures_drawn,
        sb.blood_cultures_drawn_at,
        sb.broad_spectrum_antibiotics_given,
        sb.antibiotics_given_at,
        sb.fluid_bolus_given,
        sb.fluid_bolus_given_at,
        sb.vasopressors_initiated,
        sb.vasopressors_initiated_at,
        sb.notes,
        sb.updated_at,
        ss.qsofa_score,
        ss.sirs_score,
        ss.lactate as screening_lactate,
        ss.sepsis_suspected,
        ss.severe_sepsis,
        ss.septic_shock,
        ss.sepsis_alert_triggered,
        p.first_name,
        p.last_name,
        p.patient_number,
        a.current_ward as ward_name
      FROM sepsis_bundles sb
      INNER JOIN patients p ON p.id = sb.patient_id
      LEFT JOIN sepsis_screenings ss ON ss.id = sb.sepsis_screening_id
      LEFT JOIN admissions a ON a.id = sb.admission_id
      WHERE sb.bundle_start_time >= $1
        AND sb.bundle_start_time <= $2
        AND (
          $3::boolean = true
          OR COALESCE(sb.overall_compliance, false) = false
          OR COALESCE(sb.three_hour_bundle_complete, false) = false
          OR (
            (
              COALESCE(ss.severe_sepsis, false) = true
              OR COALESCE(ss.septic_shock, false) = true
              OR COALESCE(sb.lactate_value, 0) >= 4
            )
            AND COALESCE(sb.six_hour_bundle_complete, false) = false
          )
        )
      ORDER BY sb.bundle_start_time DESC, sb.updated_at DESC
      LIMIT $4
      `,
      [startDate, endDate, includeCompleted, limit],
    );

    const normalized = (rows || []).map((row: any) => {
      const derivedLactate = Number(row?.lactate_value ?? row?.screening_lactate ?? 0);
      const severeSignal =
        Boolean(row?.severe_sepsis) || Boolean(row?.septic_shock) || (Number.isFinite(derivedLactate) && derivedLactate >= 4);
      const threeHourComplete = Boolean(row?.three_hour_bundle_complete);
      const sixHourComplete = Boolean(row?.six_hour_bundle_complete);
      const overallCompliance = Boolean(row?.overall_compliance);

      const startTime = row?.bundle_start_time ? new Date(row.bundle_start_time) : null;
      const onsetTime = row?.sepsis_onset_time ? new Date(row.sepsis_onset_time) : null;
      const antibioticsTime = row?.antibiotics_given_at ? new Date(row.antibiotics_given_at) : null;
      const culturesTime = row?.blood_cultures_drawn_at ? new Date(row.blood_cultures_drawn_at) : null;
      const elapsedMinutes = startTime ? Math.max(0, Math.floor((Date.now() - startTime.getTime()) / (1000 * 60))) : null;
      const threeHourRemainingMinutes = elapsedMinutes === null ? null : 180 - elapsedMinutes;

      const antibioticsDelayMinutes =
        onsetTime && antibioticsTime
          ? Math.max(0, Math.round((antibioticsTime.getTime() - onsetTime.getTime()) / (1000 * 60)))
          : onsetTime && !antibioticsTime
          ? Math.max(0, Math.round((Date.now() - onsetTime.getTime()) / (1000 * 60)))
          : null;
      const antibioticsDelayOver60 =
        antibioticsDelayMinutes !== null && antibioticsDelayMinutes > 60;
      const culturesAfterAntibiotics =
        Boolean(culturesTime && antibioticsTime && culturesTime.getTime() > antibioticsTime.getTime());
      const repeatLactateRequired = Number.isFinite(derivedLactate) && derivedLactate >= 2;
      const repeatLactateOverdue =
        repeatLactateRequired &&
        !Boolean(row?.repeat_lactate_measured) &&
        elapsedMinutes !== null &&
        elapsedMinutes > 360;
      const severeWithoutHemodynamicPlan =
        severeSignal && !Boolean(row?.fluid_bolus_given) && !Boolean(row?.vasopressors_initiated);
      const missingBundleNote = !String(row?.notes || '').trim();
      const missingOnsetTime = !Boolean(onsetTime);

      const cdssFlags: string[] = [];
      if (!threeHourComplete) cdssFlags.push('3-hour bundle incomplete');
      if (antibioticsDelayOver60) cdssFlags.push('Antibiotics delayed >60 min from onset');
      if (culturesAfterAntibiotics) cdssFlags.push('Blood cultures collected after antibiotics');
      if (repeatLactateOverdue) cdssFlags.push('Repeat lactate overdue');
      if (severeWithoutHemodynamicPlan) cdssFlags.push('No fluids/vasopressor plan in severe signal');
      if (missingBundleNote) cdssFlags.push('Clinical note missing');
      if (missingOnsetTime) cdssFlags.push('Sepsis onset time missing');

      let riskLevel: 'critical' | 'high' | 'moderate' | 'low' = severeSignal
        ? 'critical'
        : !threeHourComplete || !overallCompliance
        ? 'high'
        : !sixHourComplete
        ? 'moderate'
        : 'low';
      if (repeatLactateOverdue && severeSignal) {
        riskLevel = 'critical';
      } else if (
        (antibioticsDelayOver60 || culturesAfterAntibiotics || severeWithoutHemodynamicPlan) &&
        riskLevel === 'moderate'
      ) {
        riskLevel = 'high';
      } else if (missingOnsetTime && riskLevel === 'low') {
        riskLevel = 'moderate';
      }

      const recommendedActions: string[] = [];
      if (!threeHourComplete) {
        recommendedActions.push('Complete lactate, blood cultures, and broad-spectrum antibiotic timing within 3 hours.');
      }
      if (!Boolean(row?.fluid_bolus_given)) {
        recommendedActions.push('Document initial fluid resuscitation status for sepsis bundle progression.');
      }
      if (severeSignal && !sixHourComplete) {
        recommendedActions.push('Complete six-hour goals: repeat lactate and shock-targeted escalation.');
      }
      if (antibioticsDelayOver60) {
        recommendedActions.push('Escalate delayed antibiotics review and document sepsis-onset to antibiotic interval.');
      }
      if (culturesAfterAntibiotics) {
        recommendedActions.push('Review culture timing variance and document rationale for post-antibiotic sampling.');
      }
      if (!Boolean(row?.repeat_lactate_measured) && Number.isFinite(derivedLactate) && derivedLactate >= 2) {
        recommendedActions.push('Plan and capture repeat lactate measurement for trending.');
      }
      if (repeatLactateOverdue) {
        recommendedActions.push('Obtain repeat lactate now and notify attending for delayed reassessment.');
      }
      if (severeWithoutHemodynamicPlan) {
        recommendedActions.push('Document fluid bolus or vasopressor plan for severe sepsis/shock signal.');
      }
      if (missingBundleNote) {
        recommendedActions.push('Add clinician note with reassessment and source-control strategy.');
      }
      if (missingOnsetTime) {
        recommendedActions.push('Capture sepsis onset timestamp to anchor SEP-1 timing windows.');
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push('Maintain ongoing monitoring and doctor synchronization until final disposition.');
      }

      return {
        ...row,
        lactate_value: Number.isFinite(derivedLactate) ? Number(derivedLactate.toFixed(2)) : null,
        risk_level: riskLevel,
        severe_signal: severeSignal,
        elapsed_minutes: elapsedMinutes,
        three_hour_remaining_minutes: threeHourRemainingMinutes,
        antibiotics_delay_minutes: antibioticsDelayMinutes,
        antibiotics_delay_over_60: antibioticsDelayOver60,
        cultures_after_antibiotics: culturesAfterAntibiotics,
        repeat_lactate_required: repeatLactateRequired,
        repeat_lactate_overdue: repeatLactateOverdue,
        severe_without_hemodynamic_plan: severeWithoutHemodynamicPlan,
        missing_bundle_note: missingBundleNote,
        missing_onset_time: missingOnsetTime,
        cdss_flags: cdssFlags,
        cdss_compliant: cdssFlags.length === 0,
        recommended_actions: recommendedActions.slice(0, 5),
      };
    });

    return normalized.filter((item: any) => {
      if (focus === 'critical') return ['critical', 'high'].includes(String(item?.risk_level || '').toLowerCase());
      if (focus === 'three-hour') return !Boolean(item?.three_hour_bundle_complete);
      if (focus === 'repeat-lactate') return Boolean(item?.repeat_lactate_overdue);
      if (focus === 'antibiotics') return Boolean(item?.antibiotics_delay_over_60 || item?.cultures_after_antibiotics);
      if (focus === 'documentation') return Boolean(item?.missing_bundle_note || item?.missing_onset_time);
      return true;
    });
  }

  async getOperationalBrief(
    tenantDb: DataSource,
    options?: {
      includeCompleted?: boolean;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<any> {
    const now = new Date();
    const startDate = options?.startDate || new Date(new Date().setDate(new Date().getDate() - 14));
    const endDate = options?.endDate || now;
    const limit = Number.isFinite(Number(options?.limit)) ? Number(options?.limit) : 120;

    const [alerts, bundles, compliance] = await Promise.all([
      this.getSepsisAlerts(tenantDb).catch(() => []),
      this.getBundleWorklist(tenantDb, {
        startDate,
        endDate,
        includeCompleted: Boolean(options?.includeCompleted),
        focus: 'all',
        limit,
      }).catch(() => []),
      this.getBundleCompliance(startDate, endDate, tenantDb).catch(() => null),
    ]);

    const bundleList = Array.isArray(bundles) ? bundles : [];
    const alertList = Array.isArray(alerts) ? alerts : [];

    const overdueThreeHour = bundleList.filter((bundle: any) => Number(bundle?.three_hour_remaining_minutes) < 0).length;
    const severeSignals = bundleList.filter((bundle: any) => Boolean(bundle?.severe_signal)).length;
    const criticalRisk = bundleList.filter((bundle: any) => String(bundle?.risk_level || '').toLowerCase() === 'critical').length;
    const highRisk = bundleList.filter((bundle: any) => String(bundle?.risk_level || '').toLowerCase() === 'high').length;
    const antibioticsDelayOver60 = bundleList.filter((bundle: any) => Boolean(bundle?.antibiotics_delay_over_60)).length;
    const culturesAfterAntibiotics = bundleList.filter((bundle: any) => Boolean(bundle?.cultures_after_antibiotics)).length;
    const repeatLactateOverdue = bundleList.filter((bundle: any) => Boolean(bundle?.repeat_lactate_overdue)).length;
    const severeWithoutHemodynamicPlan = bundleList.filter((bundle: any) => Boolean(bundle?.severe_without_hemodynamic_plan)).length;
    const missingBundleNotes = bundleList.filter((bundle: any) => Boolean(bundle?.missing_bundle_note)).length;
    const missingOnsetTime = bundleList.filter((bundle: any) => Boolean(bundle?.missing_onset_time)).length;
    const cdssCoveragePercent =
      bundleList.length > 0
        ? Math.round((bundleList.filter((bundle: any) => Boolean(bundle?.cdss_compliant)).length / bundleList.length) * 100)
        : 100;

    const startedScreenings = new Set<string>(
      bundleList
        .map((bundle: any) => String(bundle?.sepsis_screening_id || '').trim())
        .filter((value: string) => Boolean(value)),
    );
    const alertsWithoutBundle = alertList.filter((alert: any) => !startedScreenings.has(String(alert?.id || '').trim())).length;

    const highPriorityQueue = [...bundleList]
      .sort((a: any, b: any) => {
        const riskRank = { critical: 0, high: 1, moderate: 2, low: 3 } as const;
        const aRisk = riskRank[String(a?.risk_level || 'low').toLowerCase() as keyof typeof riskRank] ?? 4;
        const bRisk = riskRank[String(b?.risk_level || 'low').toLowerCase() as keyof typeof riskRank] ?? 4;
        if (aRisk !== bRisk) return aRisk - bRisk;
        return Number(a?.three_hour_remaining_minutes || 9999) - Number(b?.three_hour_remaining_minutes || 9999);
      })
      .slice(0, 10)
      .map((bundle: any) => ({
        id: bundle.id,
        patientId: bundle.patient_id,
        patientName: `${bundle.first_name || ''} ${bundle.last_name || ''}`.trim() || 'Unknown patient',
        patientNumber: bundle.patient_number || null,
        wardName: bundle.ward_name || null,
        riskLevel: bundle.risk_level || 'low',
        severeSignal: Boolean(bundle.severe_signal),
        lactateValue: Number(bundle.lactate_value || 0),
        threeHourRemainingMinutes:
          bundle.three_hour_remaining_minutes === null || bundle.three_hour_remaining_minutes === undefined
            ? null
            : Number(bundle.three_hour_remaining_minutes),
        cdssFlags: Array.isArray(bundle.cdss_flags) ? bundle.cdss_flags.slice(0, 4) : [],
        recommendedActions: Array.isArray(bundle.recommended_actions)
          ? bundle.recommended_actions.slice(0, 3)
          : [],
      }));

    const recommendations = new Set<string>();
    if (alertsWithoutBundle > 0) {
      recommendations.add('Start SEP-1 bundles immediately for active sepsis alerts without initiated bundles.');
    }
    if (overdueThreeHour > 0) {
      recommendations.add('Escalate overdue 3-hour bundles to senior clinician and rapid response workflow.');
    }
    if (severeSignals > 0) {
      recommendations.add('Ensure severe sepsis/shock cases complete six-hour goals including repeat lactate strategy.');
    }
    if (criticalRisk + highRisk > 0) {
      recommendations.add('Run multidisciplinary sepsis huddle for high and critical risk bundle queue.');
    }
    if (antibioticsDelayOver60 > 0) {
      recommendations.add('Escalate delayed antibiotic administration and validate first-dose timestamp workflows.');
    }
    if (culturesAfterAntibiotics > 0) {
      recommendations.add('Audit blood culture sequencing and enforce culture-before-antibiotics where feasible.');
    }
    if (repeatLactateOverdue > 0) {
      recommendations.add('Clear overdue repeat lactate backlog for high-risk bundles immediately.');
    }
    if (severeWithoutHemodynamicPlan > 0) {
      recommendations.add('Document fluid or vasopressor strategy for severe sepsis/shock bundles.');
    }
    if (missingBundleNotes > 0 || missingOnsetTime > 0) {
      recommendations.add('Close sepsis documentation gaps: onset timestamp and clinician progress notes.');
    }
    if (cdssCoveragePercent < 85) {
      recommendations.add('Perform shift-level SEP-1 checklist huddle to improve CDSS coverage adherence.');
    }
    for (const item of highPriorityQueue) {
      for (const action of item.recommendedActions || []) {
        if (String(action || '').trim()) {
          recommendations.add(String(action).trim());
        }
      }
      if (recommendations.size >= 8) break;
    }
    if (!recommendations.size) {
      recommendations.add('Maintain current SEP-1 adherence and ongoing bedside reassessment cadence.');
    }

    return {
      generatedAt: now.toISOString(),
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalAlerts24h: alertList.length,
        alertsWithoutBundle,
        openBundles: bundleList.length,
        criticalRisk,
        highRisk,
        severeSignals,
        overdueThreeHour,
        antibioticsDelayOver60,
        culturesAfterAntibiotics,
        repeatLactateOverdue,
        severeWithoutHemodynamicPlan,
        missingBundleNotes,
        missingOnsetTime,
        cdssCoveragePercent,
        avgThreeHourRemainingMinutes:
          bundleList.length > 0
            ? Math.round(
                bundleList.reduce((sum: number, item: any) => sum + Number(item?.three_hour_remaining_minutes || 0), 0) /
                  bundleList.length,
              )
            : 0,
      },
      compliance: compliance
        ? {
            totalBundles: Number(compliance.total_bundles || 0),
            threeHourCompliant: Number(compliance.three_hour_compliant || 0),
            sixHourCompliant: Number(compliance.six_hour_compliant || 0),
            overallCompliant: Number(compliance.overall_compliant || 0),
          }
        : null,
      highPriorityQueue,
      recommendations: Array.from(recommendations).slice(0, 8),
    };
  }

  private async recomputeBundleCompliance(tenantDb: DataSource, bundleId: string): Promise<void> {
    const [bundle] = await tenantDb.query(
      `
      SELECT
        sb.id,
        sb.lactate_measured,
        sb.blood_cultures_drawn,
        sb.broad_spectrum_antibiotics_given,
        sb.fluid_bolus_given,
        sb.vasopressors_initiated,
        sb.repeat_lactate_measured,
        sb.lactate_value,
        sb.repeat_lactate_value,
        ss.severe_sepsis,
        ss.septic_shock
      FROM sepsis_bundles sb
      LEFT JOIN sepsis_screenings ss ON ss.id = sb.sepsis_screening_id
      WHERE sb.id = $1
      LIMIT 1
      `,
      [bundleId],
    );

    if (!bundle) return;

    const threeHourComplete =
      Boolean(bundle.lactate_measured) &&
      Boolean(bundle.blood_cultures_drawn) &&
      Boolean(bundle.broad_spectrum_antibiotics_given);

    const lactateValue = Number(bundle?.lactate_value || 0);
    const requiresSixHour =
      Boolean(bundle?.severe_sepsis) || Boolean(bundle?.septic_shock) || (Number.isFinite(lactateValue) && lactateValue >= 4);

    const sixHourComplete = !requiresSixHour
      ? true
      : Boolean(bundle.repeat_lactate_measured) &&
        (Boolean(bundle.fluid_bolus_given) || Boolean(bundle.vasopressors_initiated));

    const overallCompliance = threeHourComplete && sixHourComplete;

    await tenantDb.query(
      `
      UPDATE sepsis_bundles
      SET
        three_hour_bundle_complete = $1,
        six_hour_bundle_complete = $2,
        overall_compliance = $3,
        updated_at = NOW()
      WHERE id = $4
      `,
      [threeHourComplete, sixHourComplete, overallCompliance, bundleId],
    );
  }
}
