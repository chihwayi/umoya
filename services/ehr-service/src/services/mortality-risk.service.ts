import { Injectable, Logger, Optional } from '@nestjs/common';
import { AlertDeliveryService } from './alert-delivery.service';

interface MortalityFactors {
  age: number;
  news2Score: number;
  comorbidityCount: number;
  criticalLabFlags: number;
  icuStatus: boolean;
  activeDiagnosisSeverity: number;
}

@Injectable()
export class MortalityRiskService {
  private readonly logger = new Logger(MortalityRiskService.name);

  constructor(
    @Optional() private readonly alertDelivery: AlertDeliveryService,
  ) {}

  async scorePatient(
    patientId: string,
    db: any,
    subdomain: string,
    scoredBy = 'cron',
  ): Promise<{ score: number; band: string; factors: MortalityFactors }> {
    const ageRows = await db.query(
      `SELECT date_of_birth FROM patients WHERE id = $1`,
      [patientId],
    );
    const dob = ageRows[0]?.date_of_birth;
    const age = dob
      ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 50;

    const news2Rows = await db.query(
      `SELECT total_score FROM news2_assessments
       WHERE patient_id = $1 ORDER BY assessed_at DESC LIMIT 1`,
      [patientId],
    );
    const news2Score = news2Rows[0]?.total_score ?? 0;

    const comorbRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM patient_diagnoses
       WHERE patient_id = $1 AND status = 'chronic'`,
      [patientId],
    );
    const comorbidityCount = parseInt(comorbRows[0]?.cnt ?? '0');

    const labRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM lab_results
       WHERE patient_id = $1 AND flag IN ('HH','LL','critical')
         AND resulted_at > now() - INTERVAL '7 days'`,
      [patientId],
    );
    const criticalLabFlags = parseInt(labRows[0]?.cnt ?? '0');

    const icuRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM encounters
       WHERE patient_id = $1 AND ward IN ('ICU','HDU','INTENSIVE_CARE')
         AND status = 'active'`,
      [patientId],
    );
    const icuStatus = parseInt(icuRows[0]?.cnt ?? '0') > 0;

    const sevRows = await db.query(
      `SELECT COUNT(*) AS cnt FROM patient_diagnoses
       WHERE patient_id = $1 AND status = 'active'
         AND (icd10_code LIKE 'C%' OR icd10_code LIKE 'I%' OR icd10_code LIKE 'J%')`,
      [patientId],
    );
    const activeDiagnosisSeverity = parseInt(sevRows[0]?.cnt ?? '0');

    const factors: MortalityFactors = {
      age, news2Score, comorbidityCount, criticalLabFlags, icuStatus, activeDiagnosisSeverity,
    };

    const ageContrib = age >= 80 ? 25 : age >= 65 ? 15 : age >= 50 ? 8 : 3;
    const news2Contrib = Math.min(news2Score * 3.5, 35);
    const comorbContrib = Math.min(comorbidityCount * 4, 16);
    const labContrib = Math.min(criticalLabFlags * 6, 12);
    const icuContrib = icuStatus ? 10 : 0;
    const diagContrib = Math.min(activeDiagnosisSeverity * 3, 9);

    const raw = ageContrib + news2Contrib + comorbContrib + labContrib + icuContrib + diagContrib;
    const score = Math.min(Math.round(raw), 100);
    const band =
      score >= 75 ? 'critical' :
      score >= 50 ? 'high' :
      score >= 20 ? 'moderate' : 'low';

    await db.query(
      `INSERT INTO mortality_risk_scores (patient_id, score, band, factors, scored_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [patientId, score, band, JSON.stringify(factors), scoredBy],
    );

    if (band === 'critical' && this.alertDelivery) {
      const lastAlert = await db.query(
        `SELECT id FROM mortality_risk_scores
         WHERE patient_id = $1 AND alert_sent = true
           AND scored_at > now() - INTERVAL '6 hours'
         LIMIT 1`,
        [patientId],
      );
      if (lastAlert.length === 0) {
        try {
          await this.alertDelivery.broadcastCriticalAlert(subdomain, {
            alertType: 'mortality_risk_critical',
            sourceEntityId: patientId,
            patientId,
            severity: 'critical',
            message: `30-day mortality risk score: ${score}/100 (${band.toUpperCase()}) — immediate review recommended`,
            payload: { score, band, factors },
          });
          await db.query(
            `UPDATE mortality_risk_scores SET alert_sent = true
             WHERE patient_id = $1 AND scored_at = (
               SELECT MAX(scored_at) FROM mortality_risk_scores WHERE patient_id = $1
             )`,
            [patientId],
          );
        } catch (err) {
          this.logger.warn(`Mortality alert failed: ${err.message}`);
        }
      }
    }

    return { score, band, factors };
  }

  async getLatestScore(patientId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM mortality_risk_scores
       WHERE patient_id = $1 ORDER BY scored_at DESC LIMIT 1`,
      [patientId],
    );
    return rows[0] ?? null;
  }

  async getCriticalPatients(db: any, limit = 20): Promise<unknown[]> {
    return db.query(
      `SELECT DISTINCT ON (mrs.patient_id)
         mrs.patient_id, mrs.score, mrs.band, mrs.scored_at,
         p.first_name, p.last_name, p.mrn
       FROM mortality_risk_scores mrs
       JOIN patients p ON p.id = mrs.patient_id
       WHERE mrs.band IN ('critical','high')
         AND mrs.scored_at > now() - INTERVAL '25 hours'
       ORDER BY mrs.patient_id, mrs.score DESC
       LIMIT $1`,
      [limit],
    );
  }

  async runDailySweep(db: any, subdomain: string): Promise<{ scored: number }> {
    const patients = await db.query(
      `SELECT DISTINCT p.id FROM patients p
       JOIN encounters e ON e.patient_id = p.id
       WHERE e.status = 'active'`,
    );
    let scored = 0;
    for (const { id } of patients) {
      try {
        await this.scorePatient(id, db, subdomain);
        scored++;
      } catch (err) {
        this.logger.warn(`Mortality score failed for ${id}: ${err.message}`);
      }
    }
    return { scored };
  }
}
