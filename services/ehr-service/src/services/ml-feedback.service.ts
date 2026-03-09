import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ModelPerformanceReport {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  sampleSize: number;
  periodStart: string;
  periodEnd: string;
}

@Injectable()
export class MlFeedbackService {
  private readonly logger = new Logger(MlFeedbackService.name);

  async recordNoShowOutcome(
    tenantDb: DataSource,
    appointmentId: string,
    actualStatus: string,
  ): Promise<void> {
    const outcomeMap: Record<string, string> = {
      completed: 'attended',
      checked_in: 'attended',
      confirmed: 'attended',
      in_progress: 'attended',
      no_show: 'no_show',
      cancelled: 'cancelled',
    };

    const outcome = outcomeMap[actualStatus] || 'attended';

    try {
      const predictionExists = await tenantDb.query(
        `SELECT id FROM appointment_no_show_predictions WHERE appointment_id = $1 LIMIT 1`,
        [appointmentId],
      );
      if (!predictionExists?.length) return;

      await tenantDb.query(
        `UPDATE appointment_no_show_predictions
         SET actual_outcome = $1, outcome_recorded_at = NOW()
         WHERE appointment_id = $2 AND actual_outcome IS NULL`,
        [outcome, appointmentId],
      );
      this.logger.log(`Recorded no-show outcome: ${outcome} for appointment ${appointmentId}`);
    } catch (err) {
      this.logger.warn(`Failed to record no-show outcome: ${err.message}`);
    }
  }

  async recordCodingFeedback(
    tenantDb: DataSource,
    suggestionId: string,
  ): Promise<void> {
    try {
      const rows = await tenantDb.query(
        `SELECT id, session_id, suggested_icd10, suggested_cpt, accepted_codes, rejected_codes
         FROM encounter_code_suggestions WHERE id = $1 LIMIT 1`,
        [suggestionId],
      );
      if (!rows?.length) return;

      const row = rows[0];
      const accepted: string[] = typeof row.accepted_codes === 'string'
        ? JSON.parse(row.accepted_codes) : (row.accepted_codes || []);
      const rejected: string[] = typeof row.rejected_codes === 'string'
        ? JSON.parse(row.rejected_codes) : (row.rejected_codes || []);
      const suggestedIcd: any[] = typeof row.suggested_icd10 === 'string'
        ? JSON.parse(row.suggested_icd10) : (row.suggested_icd10 || []);
      const suggestedCpt: any[] = typeof row.suggested_cpt === 'string'
        ? JSON.parse(row.suggested_cpt) : (row.suggested_cpt || []);

      const totalSuggested = suggestedIcd.length + suggestedCpt.length;
      const totalAccepted = accepted.length;
      const totalRejected = rejected.length;
      const totalReviewed = totalAccepted + totalRejected;

      if (totalReviewed === 0) return;

      const precision = totalReviewed > 0 ? totalAccepted / totalReviewed : 0;
      const recall = totalSuggested > 0 ? totalAccepted / totalSuggested : 0;

      const now = new Date().toISOString();
      await tenantDb.query(
        `INSERT INTO ml_model_metrics (model_name, metric_name, metric_value, sample_size, period_start, period_end)
         VALUES ('encounter_coding', 'precision', $1, $2, $3, $3),
                ('encounter_coding', 'recall', $4, $5, $6, $6)`,
        [precision, totalReviewed, now, recall, totalSuggested, now],
      );

      if (row.session_id) {
        const textRows = await tenantDb.query(
          `SELECT content FROM post_visit_draft_artifacts
           WHERE session_id = $1 AND artifact_type IN ('soap_note', 'visit_summary')
           ORDER BY artifact_type ASC LIMIT 2`,
          [row.session_id],
        );
        if (textRows?.length) {
          const clinicalText = textRows
            .map((r: any) => {
              const c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
              return c?.subjective || c?.summaryText || JSON.stringify(c);
            })
            .join(' ')
            .substring(0, 5000);

          if (clinicalText.trim()) {
            await tenantDb.query(
              `INSERT INTO ml_coding_corpus (clinical_text, accepted_icd_codes, accepted_cpt_codes)
               VALUES ($1, $2, $3)`,
              [
                clinicalText,
                JSON.stringify(accepted.filter((c: string) => suggestedIcd.some((s: any) => s.code === c))),
                JSON.stringify(accepted.filter((c: string) => suggestedCpt.some((s: any) => s.code === c))),
              ],
            );
          }
        }
      }

      this.logger.log(`Recorded coding feedback for suggestion ${suggestionId}: precision=${precision.toFixed(2)}, recall=${recall.toFixed(2)}`);
    } catch (err) {
      this.logger.warn(`Failed to record coding feedback: ${err.message}`);
    }
  }

  async getModelPerformance(
    tenantDb: DataSource,
    modelName: string,
    startDate: string,
    endDate: string,
  ): Promise<ModelPerformanceReport> {
    if (modelName === 'no_show_prediction') {
      return this.getNoShowPerformance(tenantDb, startDate, endDate);
    }
    if (modelName === 'encounter_coding') {
      return this.getCodingPerformance(tenantDb, startDate, endDate);
    }
    return { modelName, accuracy: 0, precision: 0, recall: 0, sampleSize: 0, periodStart: startDate, periodEnd: endDate };
  }

  private async getNoShowPerformance(
    tenantDb: DataSource,
    startDate: string,
    endDate: string,
  ): Promise<ModelPerformanceReport> {
    try {
      const rows = await tenantDb.query(
        `SELECT no_show_probability, actual_outcome
         FROM appointment_no_show_predictions
         WHERE actual_outcome IS NOT NULL
           AND outcome_recorded_at >= $1 AND outcome_recorded_at <= $2`,
        [startDate, endDate],
      );

      if (!rows?.length) {
        return { modelName: 'no_show_prediction', accuracy: 0, precision: 0, recall: 0, sampleSize: 0, periodStart: startDate, periodEnd: endDate };
      }

      const threshold = 0.4;
      let tp = 0, fp = 0, tn = 0, fn = 0;

      for (const r of rows) {
        const predictedHighRisk = r.no_show_probability >= threshold;
        const actualNoShow = r.actual_outcome === 'no_show';

        if (predictedHighRisk && actualNoShow) tp++;
        else if (predictedHighRisk && !actualNoShow) fp++;
        else if (!predictedHighRisk && !actualNoShow) tn++;
        else fn++;
      }

      const total = tp + fp + tn + fn;
      return {
        modelName: 'no_show_prediction',
        accuracy: total > 0 ? Math.round(((tp + tn) / total) * 10000) / 10000 : 0,
        precision: (tp + fp) > 0 ? Math.round((tp / (tp + fp)) * 10000) / 10000 : 0,
        recall: (tp + fn) > 0 ? Math.round((tp / (tp + fn)) * 10000) / 10000 : 0,
        sampleSize: total,
        periodStart: startDate,
        periodEnd: endDate,
      };
    } catch (err) {
      this.logger.warn(`Failed to compute no-show performance: ${err.message}`);
      return { modelName: 'no_show_prediction', accuracy: 0, precision: 0, recall: 0, sampleSize: 0, periodStart: startDate, periodEnd: endDate };
    }
  }

  private async getCodingPerformance(
    tenantDb: DataSource,
    startDate: string,
    endDate: string,
  ): Promise<ModelPerformanceReport> {
    try {
      const rows = await tenantDb.query(
        `SELECT metric_name, AVG(metric_value) as avg_value, COUNT(*) as cnt
         FROM ml_model_metrics
         WHERE model_name = 'encounter_coding'
           AND created_at >= $1 AND created_at <= $2
         GROUP BY metric_name`,
        [startDate, endDate],
      );

      let precision = 0, recall = 0, sampleSize = 0;
      for (const r of (rows || [])) {
        if (r.metric_name === 'precision') { precision = parseFloat(r.avg_value) || 0; sampleSize = parseInt(r.cnt, 10) || 0; }
        if (r.metric_name === 'recall') recall = parseFloat(r.avg_value) || 0;
      }

      const accuracy = (precision + recall) / 2;
      return {
        modelName: 'encounter_coding',
        accuracy: Math.round(accuracy * 10000) / 10000,
        precision: Math.round(precision * 10000) / 10000,
        recall: Math.round(recall * 10000) / 10000,
        sampleSize,
        periodStart: startDate,
        periodEnd: endDate,
      };
    } catch (err) {
      this.logger.warn(`Failed to compute coding performance: ${err.message}`);
      return { modelName: 'encounter_coding', accuracy: 0, precision: 0, recall: 0, sampleSize: 0, periodStart: startDate, periodEnd: endDate };
    }
  }
}
