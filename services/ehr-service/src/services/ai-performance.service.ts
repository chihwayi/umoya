import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Injectable()
export class AiPerformanceService {
  constructor(private readonly tenantService: TenantService) {}

  async recordPrediction(tenantId: string, dto: any): Promise<string> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const result = await db.query(
      `INSERT INTO ai_predictions
         (tenant_id, model_name, model_version, patient_id, encounter_id,
          predicted_class, predicted_probability, threshold_used, input_features)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        tenantId, dto.model_name, dto.model_version ?? '1.0',
        dto.patient_id, dto.encounter_id ?? null,
        dto.predicted_class, dto.predicted_probability ?? null,
        dto.threshold_used ?? null,
        dto.input_features ? JSON.stringify(dto.input_features) : null,
      ],
    );
    return result[0].id;
  }

  async verifyOutcome(tenantId: string, predictionId: string, actualOutcome: string, source: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const [pred] = await db.query(
      `SELECT predicted_class, threshold_used FROM ai_predictions WHERE id=$1 AND tenant_id=$2`,
      [predictionId, tenantId],
    );
    if (!pred) return;
    const isCorrect = this.matchOutcome(pred.predicted_class, actualOutcome);
    await db.query(
      `UPDATE ai_predictions SET actual_outcome=$1, outcome_verified_at=NOW(), outcome_source=$2, is_correct=$3
       WHERE id=$4 AND tenant_id=$5`,
      [actualOutcome, source, isCorrect, predictionId, tenantId],
    );
  }

  async computeMonthlySnapshot(tenantId: string, modelName: string, period: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const [modelRow] = await db.query(
      `SELECT model_version, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE actual_outcome IS NOT NULL) AS verified,
              COUNT(*) FILTER (WHERE is_correct = true AND predicted_class IN ('high_risk','positive')) AS tp,
              COUNT(*) FILTER (WHERE is_correct = false AND predicted_class IN ('high_risk','positive')) AS fp,
              COUNT(*) FILTER (WHERE is_correct = true AND predicted_class IN ('low_risk','negative')) AS tn,
              COUNT(*) FILTER (WHERE is_correct = false AND predicted_class IN ('low_risk','negative')) AS fn
       FROM ai_predictions
       WHERE tenant_id=$1 AND model_name=$2
         AND TO_CHAR(prediction_date,'YYYY-MM') = $3
       GROUP BY model_version ORDER BY model_version DESC LIMIT 1`,
      [tenantId, modelName, period],
    );
    if (!modelRow || Number(modelRow.verified) === 0) return;

    const tp = Number(modelRow.tp);
    const fp = Number(modelRow.fp);
    const tn = Number(modelRow.tn);
    const fn = Number(modelRow.fn);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const auc = this.estimateAuc(precision, recall);

    // Check prior period for drift
    const priorPeriod = this.prevPeriod(period);
    const [priorSnap] = await db.query(
      `SELECT auc_roc FROM ai_model_performance_snapshots
       WHERE tenant_id=$1 AND model_name=$2 AND snapshot_period=$3`,
      [tenantId, modelName, priorPeriod],
    );
    const driftFlag = priorSnap?.auc_roc != null && (priorSnap.auc_roc - auc) > 0.05;

    await db.query(
      `INSERT INTO ai_model_performance_snapshots
         (tenant_id, model_name, model_version, snapshot_period, total_predictions,
          predictions_verified, true_positives, false_positives, true_negatives, false_negatives,
          precision, recall, f1_score, auc_roc, drift_flag)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (tenant_id, model_name, snapshot_period)
       DO UPDATE SET
         total_predictions=$5, predictions_verified=$6,
         true_positives=$7, false_positives=$8, true_negatives=$9, false_negatives=$10,
         precision=$11, recall=$12, f1_score=$13, auc_roc=$14, drift_flag=$15,
         computed_at=NOW()`,
      [
        tenantId, modelName, modelRow.model_version, period,
        Number(modelRow.total), Number(modelRow.verified),
        tp, fp, tn, fn,
        Number(precision.toFixed(4)), Number(recall.toFixed(4)),
        Number(f1.toFixed(4)), Number(auc.toFixed(4)), driftFlag,
      ],
    );
  }

  async getModelPerformanceSummary(tenantId: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const rows = await db.query(
      `SELECT DISTINCT ON (model_name) model_name, model_version, snapshot_period,
              precision, recall, f1_score, auc_roc, drift_flag,
              total_predictions, predictions_verified
       FROM ai_model_performance_snapshots
       WHERE tenant_id=$1
       ORDER BY model_name, snapshot_period DESC`,
      [tenantId],
    );
    const [countRow] = await db.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE actual_outcome IS NOT NULL) AS verified
       FROM ai_predictions WHERE tenant_id=$1 AND prediction_date >= NOW() - INTERVAL '30 days'`,
      [tenantId],
    );
    return {
      models: rows.map((r: any) => ({
        name: r.model_name,
        version: r.model_version,
        lastPeriod: r.snapshot_period,
        precision: r.precision ? Number(r.precision) : null,
        recall: r.recall ? Number(r.recall) : null,
        f1: r.f1_score ? Number(r.f1_score) : null,
        auc: r.auc_roc ? Number(r.auc_roc) : null,
        driftFlag: r.drift_flag,
        totalPredictions: Number(r.total_predictions),
        verificationRate: r.total_predictions > 0
          ? Number(((r.predictions_verified / r.total_predictions) * 100).toFixed(1)) : 0,
      })),
      last30d_total: Number(countRow?.total ?? 0),
      last30d_verified: Number(countRow?.verified ?? 0),
    };
  }

  async getModelTrend(tenantId: string, modelName: string, periods = 6): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const rows = await db.query(
      `SELECT snapshot_period AS period, precision, recall, f1_score AS f1, auc_roc AS auc, drift_flag
       FROM ai_model_performance_snapshots
       WHERE tenant_id=$1 AND model_name=$2
       ORDER BY snapshot_period DESC LIMIT $3`,
      [tenantId, modelName, periods],
    );
    return rows.reverse();
  }

  async autoVerifyPredictions(tenantId: string): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    const pending = await db.query(
      `SELECT id, model_name, patient_id, encounter_id, prediction_date, predicted_class
       FROM ai_predictions
       WHERE tenant_id=$1 AND actual_outcome IS NULL AND prediction_date < NOW() - INTERVAL '7 days'
       LIMIT 500`,
      [tenantId],
    );
    for (const pred of pending) {
      const outcome = await this.lookupOutcome(db, tenantId, pred);
      if (outcome) {
        await this.verifyOutcome(tenantId, pred.id, outcome.actual, outcome.source);
      }
    }
  }

  // ── S242: Governance ──────────────────────────────────────────────────────

  async requestModelReview(
    tenantId: string,
    modelName: string,
    reason: string,
    raisedBy: string,
    notes?: string,
  ): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    // F16 fix (S270) — was .catch(() => {}): a failed review-request write looked
    // identical to a successful one to the caller. Let it propagate as a real HTTP
    // error instead.
    await db.query(
      `INSERT INTO ai_model_governance_log
         (tenant_id, model_name, event_type, reason, performed_by, notes)
       VALUES ($1,$2,'review_requested',$3,$4,$5)`,
      [tenantId, modelName, reason, raisedBy, notes ?? null],
    );
  }

  async updateModelStatus(
    tenantId: string,
    modelName: string,
    action: string,
    reviewedBy: string,
    notes: string,
  ): Promise<void> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    // F16 fix (S270) — same as requestModelReview above.
    await db.query(
      `INSERT INTO ai_model_governance_log
         (tenant_id, model_name, event_type, reason, performed_by, notes)
       VALUES ($1,$2,$3,NULL,$4,$5)`,
      [tenantId, modelName, action, reviewedBy, notes],
    );
  }

  async getGovernanceHistory(tenantId: string, modelName: string): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    // F16 fix (S270) — was .catch(() => []): an operator couldn't tell "no
    // governance events" from "the query crashed." Let it propagate — the
    // frontend (AiGovernanceDashboard.tsx) already has ErrorBanner/retry UI built
    // for exactly this, it just never fired because this never threw.
    const rows = await db.query(
      `SELECT event_type, reason, performed_by, notes, created_at
       FROM ai_model_governance_log
       WHERE tenant_id=$1 AND model_name=$2
       ORDER BY created_at DESC LIMIT 50`,
      [tenantId, modelName],
    );
    return rows;
  }

  async getCalibrationPlot(tenantId: string, modelName: string, period: string): Promise<any[]> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    // F16 fix (S270) — was .catch(() => []); same rationale as getGovernanceHistory.
    const rows = await db.query(
      `SELECT
         CONCAT(FLOOR(predicted_probability * 10) * 10, '–', FLOOR(predicted_probability * 10) * 10 + 10, '%') AS predicted_bin,
         FLOOR(predicted_probability * 10) AS bin_idx,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE is_correct = true AND predicted_class IN ('high_risk','positive','readmitted','relapsed','deteriorated','deceased')) AS positives
       FROM ai_predictions
       WHERE tenant_id=$1 AND model_name=$2
         AND predicted_probability IS NOT NULL
         AND actual_outcome IS NOT NULL
         AND TO_CHAR(prediction_date,'YYYY-MM') = $3
       GROUP BY bin_idx, predicted_bin
       ORDER BY bin_idx`,
      [tenantId, modelName, period],
    );
    return rows.map((r: any) => ({
      predicted_bin: r.predicted_bin,
      actual_rate: r.total > 0 ? Number((r.positives / r.total).toFixed(4)) : null,
      count: Number(r.total),
    }));
  }

  async getModelFairness(tenantId: string, modelName: string, period: string): Promise<any> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    // F16 fix (S270) — was .catch(() => []) on both queries; same rationale as
    // getGovernanceHistory above. A crashed fairness-audit query must not look
    // like "no fairness concerns for this model."
    const [sexRows, ageRows] = await Promise.all([
      db.query(
        `SELECT
           COALESCE(p.sex, 'Unknown') AS group_val,
           COUNT(ai.id) AS total,
           COUNT(*) FILTER (WHERE ai.is_correct=true AND ai.predicted_class IN ('high_risk','positive','readmitted','relapsed','deteriorated','deceased')) AS tp,
           COUNT(*) FILTER (WHERE ai.is_correct=false AND ai.predicted_class IN ('high_risk','positive','readmitted','relapsed','deteriorated','deceased')) AS fp,
           COUNT(*) FILTER (WHERE ai.is_correct=true AND ai.predicted_class IN ('low_risk','negative','not_readmitted','no_relapse','stable','alive')) AS tn,
           COUNT(*) FILTER (WHERE ai.is_correct=false AND ai.predicted_class IN ('low_risk','negative','not_readmitted','no_relapse','stable','alive')) AS fn
         FROM ai_predictions ai
         LEFT JOIN patients p ON p.id = ai.patient_id AND p.tenant_id = ai.tenant_id
         WHERE ai.tenant_id=$1 AND ai.model_name=$2
           AND ai.actual_outcome IS NOT NULL
           AND TO_CHAR(ai.prediction_date,'YYYY-MM') = $3
         GROUP BY p.sex`,
        [tenantId, modelName, period],
      ),
      db.query(
        `SELECT
           CASE
             WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) < 25 THEN '<25'
             WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) < 50 THEN '25–49'
             ELSE '50+'
           END AS group_val,
           COUNT(ai.id) AS total,
           COUNT(*) FILTER (WHERE ai.is_correct=true AND ai.predicted_class IN ('high_risk','positive','readmitted','relapsed','deteriorated','deceased')) AS tp,
           COUNT(*) FILTER (WHERE ai.is_correct=false AND ai.predicted_class IN ('high_risk','positive','readmitted','relapsed','deteriorated','deceased')) AS fp,
           COUNT(*) FILTER (WHERE ai.is_correct=true AND ai.predicted_class IN ('low_risk','negative','not_readmitted','no_relapse','stable','alive')) AS tn,
           COUNT(*) FILTER (WHERE ai.is_correct=false AND ai.predicted_class IN ('low_risk','negative','not_readmitted','no_relapse','stable','alive')) AS fn
         FROM ai_predictions ai
         LEFT JOIN patients p ON p.id = ai.patient_id AND p.tenant_id = ai.tenant_id
         WHERE ai.tenant_id=$1 AND ai.model_name=$2
           AND ai.actual_outcome IS NOT NULL
           AND TO_CHAR(ai.prediction_date,'YYYY-MM') = $3
         GROUP BY group_val`,
        [tenantId, modelName, period],
      ),
    ]);

    const toMetrics = (rows: any[]) => rows.map((r: any) => {
      const tp = Number(r.tp); const fp = Number(r.fp);
      const tn = Number(r.tn); const fn = Number(r.fn);
      const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
      return {
        group: r.group_val,
        precision: Number(prec.toFixed(3)),
        recall: Number(rec.toFixed(3)),
        auc: Number(this.estimateAuc(prec, rec).toFixed(3)),
        f1: Number(f1.toFixed(3)),
        count: Number(r.total),
      };
    });

    return { by_sex: toMetrics(sexRows), by_age_band: toMetrics(ageRows) };
  }

  // ── End S242 ──────────────────────────────────────────────────────────────

  private async lookupOutcome(db: any, tenantId: string, pred: any): Promise<{ actual: string; source: string } | null> {
    if (pred.model_name === 'readmission_risk') {
      const [row] = await db.query(
        `SELECT outcome_type FROM encounter_outcomes
         WHERE tenant_id=$1 AND patient_id=$2 AND outcome_type='readmitted'
           AND recorded_at > $3 AND recorded_at < $3::TIMESTAMPTZ + INTERVAL '30 days'`,
        [tenantId, pred.patient_id, pred.prediction_date],
      );
      if (row) return { actual: 'readmitted', source: 'encounter_outcomes' };
      return { actual: 'not_readmitted', source: 'encounter_outcomes' };
    }
    if (pred.model_name === 'malnutrition_relapse') {
      const [row] = await db.query(
        `SELECT id FROM nutrition_relapse_events
         WHERE tenant_id=$1 AND patient_id=$2
           AND relapse_date::TIMESTAMPTZ > $3 AND relapse_date::TIMESTAMPTZ < $3::TIMESTAMPTZ + INTERVAL '180 days'`,
        [tenantId, pred.patient_id, pred.prediction_date],
      );
      return { actual: row ? 'relapsed' : 'no_relapse', source: 'nutrition_relapse_events' };
    }
    return null;
  }

  private matchOutcome(predictedClass: string, actualOutcome: string): boolean {
    const positiveClasses = ['high_risk', 'positive', 'readmitted', 'relapsed', 'deteriorated', 'deceased'];
    const negativeClasses = ['low_risk', 'negative', 'not_readmitted', 'no_relapse', 'stable', 'alive'];
    const predictedPositive = positiveClasses.some((c) => predictedClass.includes(c));
    const actualPositive = positiveClasses.some((c) => actualOutcome.includes(c));
    if (!predictedPositive && negativeClasses.some((c) => actualOutcome.includes(c))) return true;
    return predictedPositive === actualPositive;
  }

  private estimateAuc(precision: number, recall: number): number {
    // Rough AUC approximation from precision/recall using F1 as proxy
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return Math.min(0.5 + f1 / 2, 0.99);
  }

  private prevPeriod(period: string): string {
    const [year, month] = period.split('-').map(Number);
    if (month === 1) return `${year - 1}-12`;
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  }
}
