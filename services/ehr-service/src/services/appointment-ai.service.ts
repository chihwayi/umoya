import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CdssService } from './cdss.service';

@Injectable()
export class AppointmentAiService {
  private readonly logger = new Logger(AppointmentAiService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
  ) {}

  async scoreNoShow(
    appointmentId: string,
    patientId: string,
    db: any,
  ): Promise<{ score: number; riskLevel: string; factors: Record<string, unknown> }> {
    const noShows = await db.query(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE patient_id = $1 AND status = 'no_show'`,
      [patientId],
    );
    const priorNoShows = parseInt(noShows[0]?.cnt ?? '0');

    const total = await db.query(
      `SELECT COUNT(*) AS cnt FROM appointments
       WHERE patient_id = $1 AND status IN ('completed','no_show','cancelled')`,
      [patientId],
    );
    const totalAppointments = parseInt(total[0]?.cnt ?? '0');
    const noShowRate = totalAppointments > 0 ? priorNoShows / totalAppointments : 0;

    const apptRows = await db.query(
      `SELECT appointment_type, appointment_date, EXTRACT(DOW FROM appointment_date) AS dow
       FROM appointments WHERE id = $1`,
      [appointmentId],
    );
    const appt = apptRows[0] ?? {};
    const dow = parseInt(appt.dow ?? '1');

    const factors: Record<string, unknown> = {
      noShowRate: Math.round(noShowRate * 100),
      priorNoShows,
      totalAppointments,
      dayOfWeek: dow,
      appointmentType: appt.appointment_type,
    };

    const raw =
      Math.min(noShowRate * 60, 60) +
      (dow === 1 || dow === 5 ? 15 : 0) +
      (appt.appointment_type === 'follow_up' ? 0 : 10);

    const score = Math.min(Math.round(raw), 100);
    const riskLevel =
      score >= 70 ? 'high' :
      score >= 40 ? 'medium' : 'low';

    await db.query(
      `INSERT INTO appointment_noshow_scores
         (appointment_id, patient_id, score, risk_level, factors)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (appointment_id) DO UPDATE SET
         score = EXCLUDED.score,
         risk_level = EXCLUDED.risk_level,
         factors = EXCLUDED.factors,
         scored_at = now()`,
      [appointmentId, patientId, score, riskLevel, JSON.stringify(factors)],
    );

    return { score, riskLevel, factors };
  }

  async generateBrief(appointmentId: string, db: any): Promise<unknown> {
    const apptRows = await db.query(
      `SELECT a.*, p.first_name, p.last_name, p.date_of_birth, p.sex
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.id = $1`,
      [appointmentId],
    );
    const appt = apptRows[0] ?? null;
    if (!appt) throw new Error('Appointment not found');

    const patientId = appt.patient_id;
    const doctorId = appt.doctor_id;

    const [diagnoses, labs, meds, tasks] = await Promise.all([
      db.query(
        `SELECT icd10_code, description, status FROM patient_diagnoses
         WHERE patient_id = $1 AND status IN ('active','chronic') LIMIT 10`,
        [patientId],
      ),
      db.query(
        `SELECT test_name, value, unit, flag, resulted_at FROM lab_results
         WHERE patient_id = $1 AND status = 'resulted'
         ORDER BY resulted_at DESC LIMIT 5`,
        [patientId],
      ),
      db.query(
        `SELECT drug_name, dose, frequency, status FROM prescriptions
         WHERE patient_id = $1 AND status = 'active' LIMIT 10`,
        [patientId],
      ),
      db.query(
        `SELECT title, priority, due_date FROM clinical_tasks
         WHERE patient_id = $1 AND status = 'open' LIMIT 5`,
        [patientId],
      ),
    ]);

    const briefText = this.buildRawBrief(appt, diagnoses, labs, meds, tasks);

    const rows = await db.query(
      `INSERT INTO appointment_ai_briefs
         (appointment_id, patient_id, doctor_id, brief_text,
          active_diagnoses, recent_labs, active_medications, open_tasks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (appointment_id) DO UPDATE SET
         brief_text = EXCLUDED.brief_text,
         active_diagnoses = EXCLUDED.active_diagnoses,
         recent_labs = EXCLUDED.recent_labs,
         active_medications = EXCLUDED.active_medications,
         open_tasks = EXCLUDED.open_tasks,
         generated_at = now()
       RETURNING *`,
      [
        appointmentId, patientId, doctorId, briefText,
        JSON.stringify(diagnoses), JSON.stringify(labs),
        JSON.stringify(meds), JSON.stringify(tasks),
      ],
    );
    return rows[0];
  }

  private buildRawBrief(
    appt: any,
    diagnoses: any[],
    labs: any[],
    meds: any[],
    tasks: any[],
  ): string {
    const age = appt.date_of_birth
      ? Math.floor((Date.now() - new Date(appt.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : '?';

    const lines = [
      `PATIENT: ${appt.first_name} ${appt.last_name}, ${age}y ${appt.sex ?? ''}`,
      `APPOINTMENT TYPE: ${appt.appointment_type ?? 'Consultation'}`,
      '',
      'ACTIVE DIAGNOSES:',
      ...diagnoses.map((d) => `  • ${d.icd10_code} — ${d.description} (${d.status})`),
      diagnoses.length === 0 ? '  None on record' : '',
      '',
      'RECENT LABS:',
      ...labs.map((l) => `  • ${l.test_name}: ${l.value} ${l.unit ?? ''} ${l.flag ? `[${l.flag}]` : ''}`),
      labs.length === 0 ? '  None in last 72h' : '',
      '',
      'ACTIVE MEDICATIONS:',
      ...meds.map((m) => `  • ${m.drug_name} ${m.dose} ${m.frequency}`),
      meds.length === 0 ? '  None active' : '',
      '',
      'OPEN TASKS:',
      ...tasks.map((t) => `  • [${t.priority}] ${t.title}`),
      tasks.length === 0 ? '  None' : '',
    ];

    return lines.filter((l) => l !== undefined).join('\n');
  }

  async getBrief(appointmentId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM appointment_ai_briefs WHERE appointment_id = $1`,
      [appointmentId],
    );
    return rows[0] ?? null;
  }

  async getNoShowScore(appointmentId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM appointment_noshow_scores WHERE appointment_id = $1`,
      [appointmentId],
    );
    return rows[0] ?? null;
  }

  @Cron('*/5 * * * *')
  generateUpcomingBriefsTickLog(): void {
    this.logger.debug('Brief cron tick — handled by CronBriefService');
  }

  async generateBriefsForWindow(db: any): Promise<number> {
    const upcoming = await db.query(
      `SELECT id FROM appointments
       WHERE appointment_date BETWEEN now() + INTERVAL '25 minutes'
         AND now() + INTERVAL '35 minutes'
         AND status = 'scheduled'`,
    );

    let count = 0;
    for (const { id } of upcoming) {
      try {
        await this.generateBrief(id, db);
        count++;
      } catch (err: any) {
        this.logger.warn(`Brief generation failed for appt ${id}: ${err.message}`);
      }
    }
    return count;
  }
}
