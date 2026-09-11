import { Injectable, Logger, Optional } from '@nestjs/common';
import { AlertDeliveryService } from './alert-delivery.service';

interface RiskComponents {
  news2Score: number;
  oiAlertCount: number;
  missedMedications: number;
  abnormalVitals: number;
  labFlags: number;
}

interface RiskResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  components: RiskComponents;
}

@Injectable()
export class PatientRiskScoringService {
  private readonly logger = new Logger(PatientRiskScoringService.name);

  constructor(
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async scorePatient(patientId: string, db: any): Promise<RiskResult> {
    const news2Rows = await db.query(
      `SELECT total_score FROM patient_early_warning_scores
       WHERE patient_id = $1 AND score_type = 'NEWS2' ORDER BY calculated_at DESC LIMIT 1`,
      [patientId],
    );
    const news2Score = news2Rows[0]?.total_score ?? 0;

    const oiRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM oi_early_warning_alerts
       WHERE patient_id = $1 AND status = 'active'
         AND created_at > now() - INTERVAL '48 hours'`,
      [patientId],
    );
    const oiAlertCount = parseInt(oiRows[0]?.cnt ?? '0');

    // medication_administrations has no "missed dose" status/schedule concept in the real
    // schema (it only records doses that were actually given) — no equivalent data source exists.
    const missedMedications = 0;

    // vitals has no is_abnormal flag in the real schema — no equivalent data source exists.
    const abnormalVitals = 0;

    const labRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM lab_results
       WHERE patient_id = $1 AND status = 'critical'
         AND completed_at > now() - INTERVAL '72 hours'`,
      [patientId],
    );
    const labFlags = parseInt(labRows[0]?.cnt ?? '0');

    const components: RiskComponents = { news2Score, oiAlertCount, missedMedications, abnormalVitals, labFlags };

    const raw =
      Math.min(news2Score * 4, 40) +
      Math.min(oiAlertCount * 10, 20) +
      Math.min(missedMedications * 3, 15) +
      Math.min(abnormalVitals * 5, 15) +
      Math.min(labFlags * 5, 10);

    const score = Math.min(Math.round(raw), 100);
    const level: RiskResult['level'] =
      score >= 86 ? 'critical' :
      score >= 61 ? 'high' :
      score >= 31 ? 'medium' : 'low';

    return { score, level, components };
  }

  async scoreAndPersist(
    patientId: string,
    db: any,
    subdomain: string,
    scoredBy = 'cron',
  ): Promise<RiskResult> {
    const result = await this.scorePatient(patientId, db);

    await db.query(
      `INSERT INTO patient_risk_scores
         (patient_id, score, risk_level, components, scored_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [patientId, result.score, result.level, JSON.stringify(result.components), scoredBy],
    );

    if (['high', 'critical'].includes(result.level) && this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(db, {
          alertType: 'proactive_risk_alert',
          sourceEntityId: patientId,
          patientId,
          severity: result.level === 'critical' ? 'critical' : 'urgent',
          message: `Proactive Risk Alert: Patient score ${result.score}/100 (${result.level.toUpperCase()})`,
          payload: { score: result.score, components: result.components },
        });
        await db.query(
          `UPDATE patient_risk_scores SET alert_sent = true
           WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`,
          [patientId],
        );
      } catch (err: any) {
        this.logger.warn(`Alert failed for patient ${patientId}: ${err.message}`);
      }
    }

    return result;
  }

  async runNightlySweep(db: any, subdomain: string): Promise<{ scored: number; alerts: number }> {
    const patients = await db.query(
      `SELECT DISTINCT p.id FROM patients p
       JOIN medical_records e ON e.patient_id = p.id
       WHERE e.created_at > now() - INTERVAL '30 days'`,
    );

    let scored = 0;
    let alerts = 0;

    for (const { id } of patients) {
      try {
        const result = await this.scoreAndPersist(id, db, subdomain);
        scored++;
        if (['high', 'critical'].includes(result.level)) alerts++;
      } catch (err: any) {
        this.logger.warn(`Scoring failed for patient ${id}: ${err.message}`);
      }
    }

    this.logger.log(`Nightly sweep: ${scored} patients scored, ${alerts} alerts sent`);
    return { scored, alerts };
  }

  async getRiskScoreHistory(patientId: string, db: any, days = 30): Promise<unknown[]> {
    return db.query(
      `SELECT score, risk_level, components, scored_at
       FROM patient_risk_scores
       WHERE patient_id = $1 AND scored_at > now() - ($2 || ' days')::INTERVAL
       ORDER BY scored_at ASC`,
      [patientId, days],
    );
  }

  async getHighRiskPatients(db: any, limit = 50): Promise<unknown[]> {
    return db.query(
      `SELECT DISTINCT ON (prs.patient_id)
         prs.patient_id, prs.score, prs.risk_level, prs.scored_at,
         p.first_name, p.last_name, p.patient_number AS mrn,
         e.ward, e.bed_number
       FROM patient_risk_scores prs
       JOIN patients p ON p.id = prs.patient_id
       LEFT JOIN medical_records e ON e.patient_id = prs.patient_id
       WHERE prs.risk_level IN ('high','critical')
         AND prs.scored_at > now() - INTERVAL '25 hours'
       ORDER BY prs.patient_id, prs.scored_at DESC, prs.score DESC
       LIMIT $1`,
      [limit],
    );
  }
}
