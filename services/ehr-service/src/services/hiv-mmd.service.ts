import { Injectable } from '@nestjs/common';

@Injectable()
export class HivMmdService {
  async scheduleMmd(params: {
    patientId: string;
    mmdMonths: 3 | 6;
    drugs: string[];
    daysDispensed: number;
    dispensedBy: string;
    db: any;
  }): Promise<void> {
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + params.mmdMonths);

    await params.db.query(
      `INSERT INTO hiv_mmd_schedules
         (patient_id, mmd_months, last_dispensed, next_due, drugs_dispensed, days_dispensed, dispensed_by, status)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'dispensed')`,
      [
        params.patientId,
        params.mmdMonths,
        nextDue.toISOString().split('T')[0],
        params.drugs.join(', '),
        params.daysDispensed,
        params.dispensedBy,
      ],
    );
  }

  async getOverdueMmdPatients(db: any): Promise<any[]> {
    return db.query(`
      SELECT s.*, p.first_name, p.last_name, p.phone
      FROM hiv_mmd_schedules s
      JOIN patients p ON p.id = s.patient_id
      WHERE s.status = 'scheduled' AND s.next_due < CURRENT_DATE
      ORDER BY s.next_due ASC
    `);
  }

  async markOverdueAlerts(db: any): Promise<number> {
    const result = await db.query(`
      UPDATE hiv_mmd_schedules
      SET status = 'overdue', overdue_alerted = true, updated_at = now()
      WHERE status = 'scheduled' AND next_due < CURRENT_DATE AND NOT overdue_alerted
      RETURNING id
    `);
    return Array.isArray(result) ? result.length : result.rowCount ?? 0;
  }

  async getPatientMmdHistory(patientId: string, db: any): Promise<any[]> {
    return db.query(
      `SELECT * FROM hiv_mmd_schedules WHERE patient_id = $1 ORDER BY created_at DESC`,
      [patientId],
    );
  }
}
