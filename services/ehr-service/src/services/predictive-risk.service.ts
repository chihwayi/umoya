import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';
import { DeteriorationPrediction } from '../entities/deterioration-prediction.entity';
import { ReadmissionPrediction } from '../entities/readmission-prediction.entity';
import { CdssService } from './cdss.service';

// S278 — a critical-direction vital moving toward its threshold over the trailing
// window is a real (if simple) lookahead signal, distinct from the static
// MEWS-score-band timeframe estimate. Honestly labeled as trend extrapolation.
interface VitalTrendConfig {
  column: string;
  label: string;
  criticalThreshold: number;
  worseningDirection: 'up' | 'down';
}

const TREND_VITALS: VitalTrendConfig[] = [
  { column: 'oxygen_saturation', label: 'spo2', criticalThreshold: 90, worseningDirection: 'down' },
  { column: 'respiratory_rate', label: 'respiratoryRate', criticalThreshold: 30, worseningDirection: 'up' },
  { column: 'heart_rate', label: 'heartRate', criticalThreshold: 140, worseningDirection: 'up' },
  { column: 'systolic_bp', label: 'systolicBp', criticalThreshold: 85, worseningDirection: 'down' },
];

function linearRegressionSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

@Injectable()
export class PredictiveRiskService {
  private readonly logger = new Logger(PredictiveRiskService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cdssService: CdssService,
  ) {}

  // ── Deterioration ─────────────────────────────────────────────────────────

  /**
   * Computes a per-vital rate-of-change trend from the trailing 12h of recorded
   * vitals and, for any vital trending toward its critical threshold, linearly
   * extrapolates hours-to-threshold. Requires >=3 readings per vital; otherwise
   * that vital is reported as insufficient_data rather than guessed.
   */
  async computeVitalsTrend(ds: DataSource, patientId: string): Promise<{
    trendDirection: string;
    projectedHoursToCritical: number | null;
    trendDetails: Record<string, any>;
  }> {
    const rows = await ds.query(
      `SELECT recorded_at, heart_rate, respiratory_rate, oxygen_saturation, systolic_bp
       FROM vitals WHERE patient_id = $1 AND recorded_at >= NOW() - INTERVAL '12 hours'
       ORDER BY recorded_at ASC`,
      [patientId],
    ).catch(() => []);

    if (!rows || rows.length < 3) {
      return { trendDirection: 'insufficient_data', projectedHoursToCritical: null, trendDetails: { windowHours: 12, readingCount: rows?.length || 0 } };
    }

    const t0 = new Date(rows[0].recorded_at).getTime();
    const perVital: Record<string, any> = {};
    let worstHours: number | null = null;
    let worseningCount = 0;

    for (const cfg of TREND_VITALS) {
      const points = rows
        .map((r: any) => ({ x: (new Date(r.recorded_at).getTime() - t0) / 3_600_000, y: r[cfg.column] == null ? null : Number(r[cfg.column]) }))
        .filter((p: any) => p.y != null);

      if (points.length < 3) {
        perVital[cfg.label] = { insufficientData: true };
        continue;
      }

      const slope = linearRegressionSlope(points);
      const latest = points[points.length - 1].y;
      const movingTowardCritical =
        (cfg.worseningDirection === 'down' && slope < -0.01) ||
        (cfg.worseningDirection === 'up' && slope > 0.01);

      let hoursToCritical: number | null = null;
      if (movingTowardCritical) {
        const projected = (cfg.criticalThreshold - latest) / slope;
        hoursToCritical = projected > 0 ? Math.round(projected) : null;
      }

      perVital[cfg.label] = {
        latestValue: latest,
        slopePerHour: Number(slope.toFixed(3)),
        movingTowardCritical,
        hoursToCriticalThreshold: hoursToCritical,
      };

      if (movingTowardCritical) {
        worseningCount++;
        if (hoursToCritical != null && (worstHours == null || hoursToCritical < worstHours)) {
          worstHours = hoursToCritical;
        }
      }
    }

    return {
      trendDirection: worseningCount > 0 ? 'worsening' : 'stable',
      projectedHoursToCritical: worstHours,
      trendDetails: { windowHours: 12, readingCount: rows.length, perVital },
    };
  }

  async predictDeterioration(subdomain: string, patientId: string, admissionId?: string, vitals?: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let predData: any = { score: 0, event_type: null, timeframe_hours: null, features: {}, model: 'MEWS' };
    try {
      predData = await this.cdssService.predictDeteriorationRisk(
        { patientId, admissionId, vitals },
        subdomain,
        ds,
      );
    } catch (e: any) {
      this.logger.warn(`Deterioration prediction failed: ${e?.message}`);
    }

    const trend = await this.computeVitalsTrend(ds, patientId).catch((e: any) => {
      this.logger.warn(`Vitals trend computation failed: ${e?.message}`);
      return { trendDirection: 'insufficient_data', projectedHoursToCritical: null, trendDetails: {} };
    });

    const repo = ds.getRepository(DeteriorationPrediction);
    const saved = await repo.save(repo.create({
      patientId, admissionId,
      predictionTime: new Date(),
      deteriorationScore: predData.score,
      predictedEventType: predData.event_type,
      predictedTimeframeHours: predData.timeframe_hours,
      featureContributions: predData.features || {},
      triggeredAlert: predData.score >= 70,
      modelUsed: predData.model || 'MEWS',
      trendDirection: trend.trendDirection,
      projectedHoursToCritical: trend.projectedHoursToCritical,
      trendDetails: trend.trendDetails,
    }));
    return saved;
  }

  async getDeteriorationHistory(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(DeteriorationPrediction).find({
      where: { patientId },
      order: { predictionTime: 'DESC' },
    });
  }

  /** Facility-wide watch list: each patient's latest prediction, where either the
   * current score triggered an alert or the trend is worsening (lookahead signal). */
  async getActiveWorseningTrends(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.query(
      `SELECT DISTINCT ON (dp.patient_id) dp.*, p.first_name, p.last_name
       FROM deterioration_predictions dp
       JOIN patients p ON p.id = dp.patient_id
       WHERE dp.prediction_time >= NOW() - INTERVAL '24 hours'
         AND (dp.triggered_alert = true OR dp.trend_direction = 'worsening')
       ORDER BY dp.patient_id, dp.prediction_time DESC`,
    );
  }

  // ── Readmission ───────────────────────────────────────────────────────────

  async predictReadmission(subdomain: string, patientId: string, dischargeId?: string, clinicalData?: any) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    let predData: any = { risk: 0.1, category: 'low', factors: [], followup_days: 30, model: 'LACE+' };
    try {
      predData = await this.cdssService.predictReadmissionRisk(
        { patientId, dischargeId, clinicalData },
        subdomain,
        ds,
      );
    } catch (e: any) {
      this.logger.warn(`Readmission prediction failed: ${e?.message}`);
    }

    const repo = ds.getRepository(ReadmissionPrediction);
    const saved = await repo.save(repo.create({
      patientId, dischargeId,
      predictionDate: new Date().toISOString().split('T')[0],
      readmission30DayRisk: predData.risk,
      riskCategory: predData.category,
      keyRiskFactors: predData.factors || [],
      recommendedFollowupInterval: predData.followup_days,
      predictionModel: predData.model,
    }));

    // Update discharge record
    if (dischargeId) {
      await ds.query(
        `UPDATE discharges SET readmission_risk_score=$1, readmission_risk_category=$2, ai_followup_recommendation=$3 WHERE id=$4`,
        [predData.risk, predData.category, `Follow up in ${predData.followup_days} days`, dischargeId]
      ).catch(() => {});
    }
    return saved;
  }

  async getReadmissionRisk(subdomain: string, patientId: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    return ds.getRepository(ReadmissionPrediction).find({
      where: { patientId },
      order: { predictionDate: 'DESC' },
    });
  }

  // ── 4-hour cron for active admissions ─────────────────────────────────────

  @Cron('0 */4 * * *')
  async runDeteriorationSweep() {
    this.logger.log('Running 4-hourly deterioration prediction sweep…');
    try {
      const tenants = await this.tenantService.getAllActiveTenants?.() ?? [];
      for (const tenant of tenants) {
        const subdomain = typeof tenant === 'string' ? tenant : tenant?.subdomain;
        if (!subdomain) {
          continue;
        }
        await this.sweepActiveAdmissions(subdomain).catch(e =>
          this.logger.error(`Deterioration sweep failed for ${subdomain}: ${e?.message}`));
      }
    } catch (e: any) { this.logger.error(`Deterioration sweep error: ${e?.message}`); }
  }

  private async sweepActiveAdmissions(subdomain: string) {
    const ds = await this.tenantService.getTenantDatabase(subdomain);
    const active = await ds.query(
      `SELECT id, patient_id FROM admissions WHERE discharge_date IS NULL LIMIT 100`
    ).catch(() => []);
    for (const adm of active) {
      await this.predictDeterioration(subdomain, adm.patient_id, adm.id).catch(() => {});
    }
  }
}
