import { Injectable, Logger, Optional } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Vitals } from '../entities/vitals.entity';
import { PatientVitalBaseline } from '../entities/patient-vital-baseline.entity';
import { TenantService } from './tenant.service';
import { CdssHookService } from './cdss-hook.service';
import { ClinicalWorkflowService } from './clinical-workflow.service';
import { EarlyWarningService } from './early-warning.service';

// ── NEWS2 scoring ────────────────────────────────────────────────────────────
// Royal College of Physicians NEWS2 (2017).
// Consciousness component (AVPU/GCS) is omitted here — requires a dedicated
// field added in Sprint 71 (Neurology). Score is marked partial until then.
function calculateNews2(v: Partial<Vitals>): number | null {
  let score = 0;
  let scoredParams = 0;

  // Respiratory Rate
  if (v.respiratoryRate != null) {
    scoredParams++;
    const rr = v.respiratoryRate;
    if (rr <= 8)        score += 3;
    else if (rr <= 11)  score += 1;
    else if (rr <= 20)  score += 0;
    else if (rr <= 24)  score += 2;
    else                score += 3;
  }

  // SpO2 — Scale 1 (no known hypercapnic respiratory failure)
  if (v.oxygenSaturation != null) {
    scoredParams++;
    const o2 = v.oxygenSaturation;
    if (o2 <= 91)       score += 3;
    else if (o2 <= 93)  score += 2;
    else if (o2 <= 95)  score += 1;
    // else 0
  }

  // Systolic BP — uses INT column (no regex needed)
  if (v.systolicBp != null) {
    scoredParams++;
    const sbp = v.systolicBp;
    if (sbp <= 90)       score += 3;
    else if (sbp <= 100) score += 2;
    else if (sbp <= 110) score += 1;
    else if (sbp <= 219) score += 0;
    else                 score += 3;
  }

  // Pulse
  if (v.heartRate != null) {
    scoredParams++;
    const hr = v.heartRate;
    if (hr <= 40)        score += 3;
    else if (hr <= 50)   score += 1;
    else if (hr <= 90)   score += 0;
    else if (hr <= 110)  score += 1;
    else if (hr <= 130)  score += 2;
    else                 score += 3;
  }

  // Temperature
  if (v.temperature != null) {
    scoredParams++;
    const t = Number(v.temperature);
    if (t <= 35.0)       score += 3;
    else if (t <= 36.0)  score += 1;
    else if (t <= 38.0)  score += 0;
    else if (t <= 39.0)  score += 1;
    else                 score += 2;
  }

  // Need at least 3 parameters for a meaningful score
  return scoredParams >= 3 ? score : null;
}

function news2RiskLabel(score: number | null): string {
  if (score == null) return 'insufficient_data';
  if (score === 0)   return 'low';
  if (score <= 4)    return 'low';
  if (score <= 6)    return 'medium';
  return 'high';
}

@Injectable()
export class VitalsService {
  private readonly logger = new Logger(VitalsService.name);
  private readonly baselineWindowDays = 14;
  private readonly baselineMetricDefinitions: Array<{
    metricName: string;
    extractor: (vitals: Vitals) => number | null;
    minimumTolerance: number;
  }> = [
    { metricName: 'systolicBp', extractor: (vitals) => vitals.systolicBp ?? null, minimumTolerance: 12 },
    { metricName: 'diastolicBp', extractor: (vitals) => vitals.diastolicBp ?? null, minimumTolerance: 8 },
    { metricName: 'heartRate', extractor: (vitals) => vitals.heartRate ?? null, minimumTolerance: 10 },
    { metricName: 'respiratoryRate', extractor: (vitals) => vitals.respiratoryRate ?? null, minimumTolerance: 3 },
    { metricName: 'spo2', extractor: (vitals) => vitals.oxygenSaturation ?? null, minimumTolerance: 2 },
    { metricName: 'temperature', extractor: (vitals) => vitals.temperature != null ? Number(vitals.temperature) : null, minimumTolerance: 0.5 },
    { metricName: 'bmi', extractor: (vitals) => vitals.bmi != null ? Number(vitals.bmi) : null, minimumTolerance: 1 },
    { metricName: 'bloodGlucose', extractor: (vitals) => vitals.bloodGlucose != null ? Number(vitals.bloodGlucose) : null, minimumTolerance: 20 },
  ];

  constructor(
    private tenantService: TenantService,
    private cdssHookService: CdssHookService,
    @Optional() private workflowService?: ClinicalWorkflowService,
    @Optional() private earlyWarningService?: EarlyWarningService,
  ) {}

  private async getRepository(tenantId: string): Promise<Repository<Vitals>> {
    const connection = await this.tenantService.getTenantDatabase(tenantId);
    return connection.getRepository(Vitals);
  }

  private normalizeDateOnly(value?: string): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private stddev(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async refreshPatientBaselines(tenantId: string, savedVitals: Vitals): Promise<void> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    if (!tenantDb) return;

    const vitalsRepo = tenantDb.getRepository(Vitals);
    const baselineRepo = tenantDb.getRepository(PatientVitalBaseline);

    const recentVitals = await vitalsRepo
      .createQueryBuilder('vitals')
      .where('vitals.patientId = :patientId', { patientId: savedVitals.patientId })
      .andWhere('vitals.recordedAt >= NOW() - INTERVAL \'14 days\'')
      .orderBy('vitals.recordedAt', 'DESC')
      .limit(25)
      .getMany();

    for (const definition of this.baselineMetricDefinitions) {
      const values = recentVitals
        .map((row) => definition.extractor(row))
        .filter((value): value is number => value != null && !Number.isNaN(Number(value)))
        .map((value) => Number(value));

      if (values.length < 3) {
        continue;
      }

      const mean = Number(this.average(values).toFixed(2));
      const stddev = this.stddev(values, mean);
      const tolerance = Math.max(definition.minimumTolerance, stddev * 1.5);
      const lowerBound = Number((mean - tolerance).toFixed(2));
      const upperBound = Number((mean + tolerance).toFixed(2));

      let baseline = await baselineRepo.findOne({
        where: { patientId: savedVitals.patientId, metricName: definition.metricName },
      });

      if (!baseline) {
        baseline = baselineRepo.create({
          patientId: savedVitals.patientId,
          metricName: definition.metricName,
        });
      }

      baseline.baselineValue = mean;
      baseline.lowerBound = lowerBound;
      baseline.upperBound = upperBound;
      baseline.sampleCount = values.length;
      baseline.baselineWindowDays = this.baselineWindowDays;
      baseline.source = 'rolling_recent';
      baseline.lastVitalsId = savedVitals.id;
      baseline.lastRecordedAt = savedVitals.recordedAt ?? savedVitals.createdAt ?? new Date();
      baseline.metadata = {
        recentValueCount: values.length,
        tolerance: Number(tolerance.toFixed(2)),
      };

      await baselineRepo.save(baseline);
    }
  }

  async recordVitals(
    data: Partial<Vitals> & Record<string, any>,
    tenantId: string,
  ): Promise<Vitals & { cdssInsights?: any; earlyWarningAssessment?: any }> {
    const tenantDb = await this.tenantService.getTenantDatabase(tenantId);
    const repo     = tenantDb.getRepository(Vitals);
    const vitalsData: any = { ...data };

    // ── Normalise BP input ───────────────────────────────────────────────────
    // Accept either:
    //   (a) separate numeric fields: bloodPressureSystolic / bloodPressureDiastolic
    //   (b) legacy combined string:  bloodPressure "120/80"
    if (vitalsData.bloodPressureSystolic != null || vitalsData.bloodPressureDiastolic != null) {
      const sys  = vitalsData.bloodPressureSystolic != null ? Number(vitalsData.bloodPressureSystolic) : null;
      const dia  = vitalsData.bloodPressureDiastolic != null ? Number(vitalsData.bloodPressureDiastolic) : null;

      vitalsData.systolicBp  = sys;
      vitalsData.diastolicBp = dia;

      if (sys != null && dia != null) {
        vitalsData.bloodPressure = `${sys}/${dia}`;
      } else if (sys != null) {
        vitalsData.bloodPressure = `${sys}/--`;
      } else if (dia != null) {
        vitalsData.bloodPressure = `--/${dia}`;
      }

      delete vitalsData.bloodPressureSystolic;
      delete vitalsData.bloodPressureDiastolic;

    } else if (vitalsData.bloodPressure && typeof vitalsData.bloodPressure === 'string') {
      // Parse the legacy string and populate the INT columns too
      const match = vitalsData.bloodPressure.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (match) {
        vitalsData.systolicBp  = parseInt(match[1], 10);
        vitalsData.diastolicBp = parseInt(match[2], 10);
      }
    }

    // ── Auto-calculate BMI ───────────────────────────────────────────────────
    if (vitalsData.weight && vitalsData.height && !vitalsData.bmi) {
      const hm = vitalsData.height / 100;
      vitalsData.bmi = Number((vitalsData.weight / (hm * hm)).toFixed(2));
    }

    // ── Auto-calculate NEWS2 ─────────────────────────────────────────────────
    const newsScore = calculateNews2(vitalsData);
    if (newsScore !== null) {
      vitalsData.newsScore = newsScore;
    }

    const entity = repo.create(vitalsData as Vitals);
    const saved  = await repo.save(entity);

    let earlyWarningAssessment: any = null;
    if (this.earlyWarningService) {
      try {
        earlyWarningAssessment = await this.earlyWarningService.recordNews2Score(tenantDb, {
          patientId: saved.patientId,
          vitalsId: saved.id,
          respiratoryRate: saved.respiratoryRate ?? null,
          spo2: saved.oxygenSaturation ?? null,
          onSupplementalOxygen: Boolean(vitalsData.onSupplementalOxygen),
          temperature: saved.temperature != null ? Number(saved.temperature) : null,
          systolicBp: saved.systolicBp ?? null,
          heartRate: saved.heartRate ?? null,
          consciousness: saved.glasgowComaScale != null && saved.glasgowComaScale < 15 ? 'confused' : 'alert',
        }, tenantId);
      } catch (error) {
        this.logger.warn(`Early warning scoring failed for vitals: ${error instanceof Error ? error.message : error}`);
      }
    }

    // ── qSOFA sepsis screen ──────────────────────────────────────────────────
    try {
      await this.checkQsofaAndAlertSepsis(tenantDb, saved);
    } catch (err) {
      this.logger.warn(`qSOFA check failed: ${err instanceof Error ? err.message : err}`);
    }

    // ── NEWS2 high-score alert (≥7 = emergency) ──────────────────────────────
    if (saved.newsScore != null && saved.newsScore >= 7) {
      this.logger.warn(`NEWS2 ≥ 7 (score=${saved.newsScore}) for patient ${saved.patientId} — emergency review required`);
      try {
        await tenantDb.query(
          `INSERT INTO critical_result_alerts (patient_id, alert_type, severity, message, source, status)
           VALUES ($1, 'NEWS2_HIGH', 'critical', $2, 'vitals_auto', 'open')
           ON CONFLICT DO NOTHING`,
          [
            saved.patientId,
            `NEWS2 score ${saved.newsScore} — emergency clinical review required immediately.`,
          ],
        );
      } catch {
        // critical_result_alerts table may not have ON CONFLICT target; swallow
      }
    }

    // ── CDSS hook ────────────────────────────────────────────────────────────
    let cdssInsights: any = null;
    try {
      cdssInsights = await this.cdssHookService.handleVitalsRecorded({ tenantId, tenantDb, vitals: saved });
    } catch (error) {
      this.logger.warn(`CDSS hook failed for vitals: ${error instanceof Error ? error.message : error}`);
    }

    // Persist the computed insights so the copilot interpretation can be
    // re-displayed per record (Vitals History) after the pane is closed.
    if (cdssInsights) {
      try {
        saved.cdssInsights = cdssInsights;
        await repo.update(saved.id, { cdssInsights });
      } catch (error) {
        this.logger.warn(`Failed to persist CDSS insights for vitals ${saved.id}: ${error instanceof Error ? error.message : error}`);
      }
    }

    // ── Workflow hook ────────────────────────────────────────────────────────
    if (this.workflowService) {
      try {
        await this.workflowService.executeWorkflow(
          'vitals_recorded',
          {
            entityType: 'vitals',
            entityId:   saved.id,
            patientId:  saved.patientId,
            data: {
              systolicBp:       saved.systolicBp,
              diastolicBp:      saved.diastolicBp,
              bloodPressure:    saved.bloodPressure,
              heartRate:        saved.heartRate,
              temperature:      saved.temperature,
              oxygenSaturation: saved.oxygenSaturation,
              newsScore:        saved.newsScore,
            },
          },
          tenantDb,
        );
      } catch (error) {
        this.logger.warn(`Workflow trigger failed for vitals_recorded: ${error instanceof Error ? error.message : error}`);
      }
    }

    try {
      await this.refreshPatientBaselines(tenantId, saved);
    } catch (error) {
      this.logger.warn(`Baseline refresh failed for vitals ${saved.id}: ${error instanceof Error ? error.message : error}`);
    }

    return { ...saved, cdssInsights, earlyWarningAssessment };
  }

  private async checkQsofaAndAlertSepsis(tenantDb: any, vitals: Vitals): Promise<void> {
    let qsofaScore = 0;
    const factors: string[] = [];

    if (vitals.respiratoryRate && vitals.respiratoryRate >= 22) {
      qsofaScore++;
      factors.push(`RR ${vitals.respiratoryRate} >= 22`);
    }

    // Use INT column directly — no string parsing needed
    if (vitals.systolicBp != null && vitals.systolicBp <= 100) {
      qsofaScore++;
      factors.push(`SBP ${vitals.systolicBp} <= 100`);
    }

    if (qsofaScore < 2) return;

    const existing = await tenantDb.query(
      `SELECT id FROM sepsis_screenings
       WHERE patient_id = $1 AND created_at > NOW() - INTERVAL '6 hours'
       LIMIT 1`,
      [vitals.patientId],
    );
    if (existing?.length) return;

    await tenantDb.query(
      `INSERT INTO sepsis_screenings (patient_id, screening_tool, qsofa_score, sirs_criteria_met, notes, screened_by, status)
       VALUES ($1, 'qSOFA', $2, false, $3, NULL, 'positive')`,
      [
        vitals.patientId,
        qsofaScore,
        `Auto-generated from vitals: ${factors.join(', ')}. qSOFA >= 2 — sepsis workup recommended.`,
      ],
    );

    this.logger.warn(`qSOFA >= 2 for patient ${vitals.patientId}: ${factors.join(', ')} — sepsis screening created`);
  }

  async getByPatient(
    patientId: string,
    tenantId: string,
    options: number | { limit?: number; recordedDate?: string; latestOnDate?: boolean } = 100,
  ): Promise<Vitals[]> {
    const resolvedOptions =
      typeof options === 'number'
        ? { limit: options, recordedDate: null as string | null, latestOnDate: false }
        : {
            limit:       options.limit ?? 100,
            recordedDate: this.normalizeDateOnly(options.recordedDate),
            latestOnDate: Boolean(options.latestOnDate),
          };

    const repo  = await this.getRepository(tenantId);
    const query = repo
      .createQueryBuilder('vitals')
      .leftJoinAndSelect('vitals.recordedByUser', 'recordedByUser')
      .where('vitals.patientId = :patientId', { patientId })
      .orderBy('vitals.recordedAt', 'DESC');

    if (resolvedOptions.recordedDate) {
      query.andWhere(`DATE(vitals.recordedAt) = :recordedDate`, {
        recordedDate: resolvedOptions.recordedDate,
      });
    }

    query.take(resolvedOptions.latestOnDate ? 1 : resolvedOptions.limit);
    const vitals = await query.getMany();

    // Ensure every record exposes both formats for frontend compatibility
    return vitals.map((v: any) => {
      // Populate INT fields from legacy string if still missing (old rows)
      if (v.systolicBp == null && v.bloodPressure) {
        const match = String(v.bloodPressure).match(/^(\d+)\s*\/\s*(\d+)$/);
        if (match) {
          v.systolicBp  = parseInt(match[1], 10);
          v.diastolicBp = parseInt(match[2], 10);
        }
      }
      // Always expose camelCase aliases that the frontend expects
      v.bloodPressureSystolic  = v.systolicBp  ?? null;
      v.bloodPressureDiastolic = v.diastolicBp ?? null;
      return v;
    });
  }

  async getPatientVitalTrends(patientId: string, tenantId: string, limit = 30) {
    const vitals  = await this.getByPatient(patientId, tenantId, { limit });
    const reverse = [...vitals].reverse();

    const formatTrend = (mapper: (v: Vitals) => number | null) =>
      reverse
        .map((vital) => {
          const value = mapper(vital);
          if (value === null || value === undefined || Number.isNaN(value) || value === 0) return null;
          return { timestamp: vital.recordedAt || vital.createdAt, value };
        })
        .filter(Boolean);

    return {
      patientId,
      count:  vitals.length,
      latest: vitals[0] || null,
      trends: {
        // INT columns — no string parsing
        systolic:         formatTrend((v) => (v as any).systolicBp  ?? null),
        diastolic:        formatTrend((v) => (v as any).diastolicBp ?? null),
        heartRate:        formatTrend((v) => v.heartRate        ?? null),
        temperature:      formatTrend((v) => v.temperature != null ? Number(v.temperature) : null),
        oxygenSaturation: formatTrend((v) => v.oxygenSaturation ?? null),
        respiratoryRate:  formatTrend((v) => v.respiratoryRate  ?? null),
        weight:           formatTrend((v) => v.weight != null   ? Number(v.weight) : null),
        bmi:              formatTrend((v) => v.bmi   != null    ? Number(v.bmi)    : null),
        newsScore:        formatTrend((v) => v.newsScore        ?? null),
      },
    };
  }
}
