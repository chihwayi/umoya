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

@Injectable()
export class SepsisService {
  private readonly logger = new Logger(SepsisService.name);

  constructor() {}

  async screenForSepsis(
    screeningData: any,
    userId: string,
    tenantDb: DataSource,
  ): Promise<any> {
    // Calculate scores
    const qsofaScore = (screeningData.qsofaAlteredMentalStatus ? 1 : 0) + 
                      (screeningData.qsofaSystolicBpLow ? 1 : 0) + 
                      (screeningData.qsofaRespiratoryRateHigh ? 1 : 0);
    
    const sirsScore = (screeningData.sirsTempAbnormal ? 1 : 0) + 
                     (screeningData.sirsHeartRateHigh ? 1 : 0) + 
                     (screeningData.sirsRespiratoryRateHigh ? 1 : 0) + 
                     (screeningData.sirsWbcAbnormal ? 1 : 0);
    
    const sepsisSuspected = qsofaScore >= 2 || (sirsScore >= 2 && screeningData.lactate > 2);

    const result = await tenantDb.query(
      `INSERT INTO sepsis_screenings (patient_id, admission_id, screening_location,
        qsofa_altered_mental_status, qsofa_systolic_bp_low, qsofa_respiratory_rate_high, qsofa_score,
        sirs_temp_abnormal, sirs_heart_rate_high, sirs_respiratory_rate_high, sirs_wbc_abnormal, sirs_score,
        temperature, heart_rate, respiratory_rate, systolic_bp, oxygen_saturation, wbc_count, lactate,
        sepsis_suspected, sepsis_alert_triggered, screened_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING *`,
      [screeningData.patientId, screeningData.admissionId, screeningData.screeningLocation,
       screeningData.qsofaAlteredMentalStatus, screeningData.qsofaSystolicBpLow, screeningData.qsofaRespiratoryRateHigh, qsofaScore,
       screeningData.sirsTempAbnormal, screeningData.sirsHeartRateHigh, screeningData.sirsRespiratoryRateHigh, screeningData.sirsWbcAbnormal, sirsScore,
       screeningData.temperature, screeningData.heartRate, screeningData.respiratoryRate, 
       screeningData.systolicBp, screeningData.oxygenSaturation, screeningData.wbcCount, screeningData.lactate,
       sepsisSuspected, sepsisSuspected, userId]
    );

    return result[0];
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
