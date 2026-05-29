import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PatientRiskScoringService } from './patient-risk-scoring.service';

@Injectable()
export class ProRiskLoopService {
  private readonly logger = new Logger(ProRiskLoopService.name);

  constructor(private readonly riskScoring: PatientRiskScoringService) {}

  async recalculateRisk(
    db: DataSource,
    patientId: string,
    triggeredBy: string,
    subdomain: string,
  ): Promise<void> {
    const result = await this.riskScoring.scoreAndPersist(patientId, db, subdomain, triggeredBy);

    // Update cache columns on patients
    await db.query(
      `UPDATE patients
       SET latest_risk_score = $1, latest_risk_level = $2, risk_updated_at = now()
       WHERE id = $3`,
      [result.score, result.level, patientId],
    );

    if (result.score >= 70) {
      await this.ensureOutreachTask(db, patientId);
    }

    this.logger.log(`PRO risk loop: patient=${patientId} score=${result.score} level=${result.level} trigger=${triggeredBy}`);
  }

  private async ensureOutreachTask(db: DataSource, patientId: string): Promise<void> {
    const [existing] = await db.query(
      `SELECT id FROM risk_outreach_tasks WHERE patient_id = $1 AND status = 'open' LIMIT 1`,
      [patientId],
    );
    if (existing) return;

    const [doctor] = await db.query(
      `SELECT primary_doctor_id FROM patients WHERE id = $1`,
      [patientId],
    );

    await db.query(
      `INSERT INTO risk_outreach_tasks (patient_id, assigned_to, due_at)
       VALUES ($1, $2, now() + interval '24 hours')`,
      [patientId, doctor?.primary_doctor_id ?? null],
    );
  }

  async getScoreHistory(db: DataSource, patientId: string, days = 30): Promise<any[]> {
    return this.riskScoring.getRiskScoreHistory(patientId, db, days) as Promise<any[]>;
  }

  async getHighRiskPatients(db: DataSource, minScore = 70): Promise<any[]> {
    return db.query(
      `SELECT id, first_name, last_name, latest_risk_score, latest_risk_level, risk_updated_at
       FROM patients
       WHERE latest_risk_score >= $1
       ORDER BY latest_risk_score DESC`,
      [minScore],
    );
  }

  async getPendingOutreachTasks(db: DataSource, assignedTo?: string): Promise<any[]> {
    if (assignedTo) {
      return db.query(
        `SELECT t.*, p.first_name || ' ' || p.last_name AS patient_name, p.latest_risk_score AS risk_score
         FROM risk_outreach_tasks t
         JOIN patients p ON p.id = t.patient_id
         WHERE t.assigned_to = $1 AND t.status = 'open'
         ORDER BY p.latest_risk_score DESC`,
        [assignedTo],
      );
    }
    return db.query(
      `SELECT t.*, p.first_name || ' ' || p.last_name AS patient_name, p.latest_risk_score AS risk_score
       FROM risk_outreach_tasks t
       JOIN patients p ON p.id = t.patient_id
       WHERE t.status = 'open'
       ORDER BY p.latest_risk_score DESC`,
    );
  }

  async completeOutreachTask(db: DataSource, taskId: string): Promise<void> {
    await db.query(
      `UPDATE risk_outreach_tasks SET status = 'done', completed_at = now() WHERE id = $1`,
      [taskId],
    );
  }
}
