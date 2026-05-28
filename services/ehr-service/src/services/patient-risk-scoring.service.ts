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
      `SELECT total_score FROM news2_assessments
       WHERE patient_id = $1 ORDER BY assessed_at DESC LIMIT 1`,
      [patientId],
    );
    const news2Score = news2Rows[0]?.total_score ?? 0;

    const oiRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM oi_alerts
       WHERE patient_id = $1 AND status = 'active'
         AND created_at > now() - INTERVAL '48 hours'`,
      [patientId],
    );
    const oiAlertCount = parseInt(oiRows[0]?.cnt ?? '0');

    const medRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM medication_administrations
       WHERE patient_id = $1 AND status = 'missed'
         AND scheduled_at > now() - INTERVAL '7 days'`,
      [patientId],
    );
    const missedMedications = parseInt(medRows[0]?.cnt ?? '0');

    const vitalRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM vitals
       WHERE patient_id = $1 AND is_abnormal = true
         AND recorded_at > now() - INTERVAL '24 hours'`,
      [patientId],
    );
    const abnormalVitals = parseInt(vitalRows[0]?.cnt ?? '0');

    const labRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM lab_results
       WHERE patient_id = $1 AND flag IN ('H','L','HH','LL','critical')
         AND resulted_at > now() - INTERVAL '72 hours'`,
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
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
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
       JOIN encounters e ON e.patient_id = p.id
       WHERE e.status = 'active' OR e.created_at > now() - INTERVAL '30 days'`,
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
         p.first_name, p.last_name, p.mrn,
         e.ward, e.bed_number
       FROM patient_risk_scores prs
       JOIN patients p ON p.id = prs.patient_id
       LEFT JOIN encounters e ON e.patient_id = prs.patient_id AND e.status = 'active'
       WHERE prs.risk_level IN ('high','critical')
         AND prs.scored_at > now() - INTERVAL '25 hours'
       ORDER BY prs.patient_id, prs.scored_at DESC, prs.score DESC
       LIMIT $1`,
      [limit],
    );
  }
}
