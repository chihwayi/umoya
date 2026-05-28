import { Injectable, Logger, Optional } from '@nestjs/common';
import { AlertDeliveryService } from './alert-delivery.service';

@Injectable()
export class AdherenceEngineService {
  private readonly logger = new Logger(AdherenceEngineService.name);

  constructor(@Optional() private readonly alertDelivery: AlertDeliveryService) {}

  async scorePatient(
    patientId: string,
    db: any,
  ): Promise<{ score: number; level: string; factors: Record<string, unknown> }> {
    const missed7 = await db.query(
      `SELECT COUNT(*) AS cnt FROM medication_administrations
       WHERE patient_id = $1 AND status = 'missed'
         AND scheduled_at > now() - INTERVAL '7 days'`,
      [patientId],
    );
    const missed7Count = parseInt(missed7[0]?.cnt ?? '0');

    const missed30 = await db.query(
      `SELECT COUNT(*) AS cnt FROM medication_administrations
       WHERE patient_id = $1 AND status = 'missed'
         AND scheduled_at > now() - INTERVAL '30 days'`,
      [patientId],
    );
    const missed30Count = parseInt(missed30[0]?.cnt ?? '0');

    const refills = await db.query(
      `SELECT COUNT(*) AS cnt FROM prescriptions
       WHERE patient_id = $1 AND status = 'active'
         AND next_refill_date < now()`,
      [patientId],
    );
    const overdueRefills = parseInt(refills[0]?.cnt ?? '0');

    const appts = await db.query(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE patient_id = $1 AND status = 'no_show'
         AND appointment_date > now() - INTERVAL '60 days'`,
      [patientId],
    );
    const missedAppts = parseInt(appts[0]?.cnt ?? '0');

    const factors: Record<string, unknown> = { missed7Count, missed30Count, overdueRefills, missedAppts };

    const raw =
      Math.min(missed7Count * 10, 40) +
      Math.min(missed30Count * 2, 30) +
      Math.min(overdueRefills * 15, 20) +
      Math.min(missedAppts * 5, 10);

    const score = Math.min(raw, 100);
    const level = score >= 60 ? 'high_risk' : score >= 30 ? 'at_risk' : 'low';

    await db.query(
      `INSERT INTO adherence_risk_scores (patient_id, score, risk_level, factors)
       VALUES ($1,$2,$3,$4)`,
      [patientId, score, level, JSON.stringify(factors)],
    );

    return { score, level, factors };
  }

  async sendNudge(
    patientId: string,
    db: any,
    subdomain: string,
    riskLevel: string,
  ): Promise<boolean> {
    const recent = await db.query(
      `SELECT id FROM adherence_nudges
       WHERE patient_id = $1 AND sent_at > now() - INTERVAL '24 hours'
       LIMIT 1`,
      [patientId],
    );
    if (recent.length > 0) {
      this.logger.debug(`Nudge already sent for patient ${patientId} in last 24h`);
      return false;
    }

    const patientRows = await db.query(
      `SELECT p.first_name, p.phone, pr.drug_name
       FROM patients p
       LEFT JOIN prescriptions pr ON pr.patient_id = p.id AND pr.status = 'active'
       WHERE p.id = $1
       ORDER BY pr.created_at DESC LIMIT 1`,
      [patientId],
    );
    const patient = patientRows[0] ?? {};

    const message = patient.drug_name
      ? `Hi ${patient.first_name ?? 'there'}, this is a reminder to take your ${patient.drug_name}. Consistent medication is key to your recovery.`
      : `Hi ${patient.first_name ?? 'there'}, don't forget to take your medications today. Your health depends on it!`;

    await db.query(
      `INSERT INTO adherence_nudges (patient_id, channel, message_text, risk_level)
       VALUES ($1,'push',$2,$3)`,
      [patientId, message, riskLevel],
    );

    if (this.alertDelivery) {
      try {
        await this.alertDelivery.broadcastCriticalAlert(subdomain, {
          alertType: 'adherence_nudge',
          sourceEntityId: patientId,
          patientId,
          severity: 'info',
          message,
          payload: { type: 'adherence_nudge', riskLevel },
        });
      } catch (err: any) {
        this.logger.warn(`Nudge delivery failed for patient ${patientId}: ${err.message}`);
      }
    }

    await db.query(
      `INSERT INTO patient_notifications (patient_id, type, title, body)
       VALUES ($1,'adherence_reminder','Medication Reminder',$2)
       ON CONFLICT DO NOTHING`,
      [patientId, message],
    );

    return true;
  }

  async runDailySweep(db: any, subdomain: string): Promise<{ scored: number; nudgesSent: number }> {
    const patients = await db.query(
      `SELECT DISTINCT patient_id FROM prescriptions WHERE status = 'active'`,
    );

    let scored = 0;
    let nudgesSent = 0;

    for (const { patient_id } of patients) {
      try {
        const { level } = await this.scorePatient(patient_id, db);
        scored++;
        if (level !== 'low') {
          const sent = await this.sendNudge(patient_id, db, subdomain, level);
          if (sent) nudgesSent++;
        }
      } catch (err: any) {
        this.logger.warn(`Adherence score failed for ${patient_id}: ${err.message}`);
      }
    }

    return { scored, nudgesSent };
  }

  async getAtRiskPatients(db: any, limit = 20): Promise<unknown[]> {
    return db.query(
      `SELECT DISTINCT ON (ars.patient_id)
         ars.patient_id, ars.score, ars.risk_level, ars.scored_at,
         p.first_name, p.last_name, p.mrn
       FROM adherence_risk_scores ars
       JOIN patients p ON p.id = ars.patient_id
       WHERE ars.risk_level IN ('at_risk','high_risk')
         AND ars.scored_at > now() - INTERVAL '25 hours'
       ORDER BY ars.patient_id, ars.score DESC
       LIMIT $1`,
      [limit],
    );
  }

  async getPatientAdherenceHistory(patientId: string, db: any): Promise<unknown[]> {
    return db.query(
      `SELECT score, risk_level, factors, scored_at
       FROM adherence_risk_scores
       WHERE patient_id = $1
       ORDER BY scored_at DESC LIMIT 30`,
      [patientId],
    );
  }
}
