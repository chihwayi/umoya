import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  async enqueue(
    db: DataSource,
    patientId: string,
    appointmentId?: string,
  ): Promise<{ queueId: string; queueNumber: number; estimatedWaitMinutes: number }> {
    const [{ nextNum }] = await db.query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 AS "nextNum"
       FROM clinic_queue WHERE queue_date = CURRENT_DATE`,
    );

    const [{ ahead }] = await db.query(
      `SELECT COUNT(*) AS ahead
       FROM clinic_queue
       WHERE queue_date = CURRENT_DATE AND status = 'waiting' AND queue_number < $1`,
      [nextNum],
    );

    const [config] = await db.query(`SELECT avg_consult_mins FROM queue_config LIMIT 1`);
    const avgMins = config?.avg_consult_mins ?? 10;
    const estimatedWaitMinutes = Number(ahead) * avgMins;

    const [row] = await db.query(
      `INSERT INTO clinic_queue (patient_id, appointment_id, queue_number, estimated_wait_minutes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (queue_date, queue_number, patient_id) DO UPDATE
         SET status = 'waiting', estimated_wait_minutes = EXCLUDED.estimated_wait_minutes,
             updated_at = now()
       RETURNING id, queue_number`,
      [patientId, appointmentId ?? null, nextNum, estimatedWaitMinutes],
    );

    this.logger.log(`Enqueued patient=${patientId} queue#=${row.queue_number} wait=${estimatedWaitMinutes}min`);
    return { queueId: row.id, queueNumber: row.queue_number, estimatedWaitMinutes };
  }

  async getQueueEntry(db: DataSource, patientId: string): Promise<any | null> {
    const [row] = await db.query(
      `SELECT cq.*,
         (SELECT COUNT(*) FROM clinic_queue cq2
          WHERE cq2.queue_date = CURRENT_DATE AND cq2.status = 'waiting'
            AND cq2.queue_number < cq.queue_number) AS patients_ahead
       FROM clinic_queue cq
       WHERE cq.patient_id = $1
         AND cq.queue_date = CURRENT_DATE
         AND cq.status IN ('waiting', 'called')
       ORDER BY cq.checked_in_at DESC
       LIMIT 1`,
      [patientId],
    );
    return row ?? null;
  }

  async getTodayQueue(db: DataSource): Promise<any[]> {
    return db.query(
      `SELECT cq.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM clinic_queue cq
       JOIN patients p ON p.id = cq.patient_id
       WHERE cq.queue_date = CURRENT_DATE
       ORDER BY cq.queue_number ASC`,
    );
  }

  async updateStatus(
    db: DataSource,
    queueId: string,
    status: 'called' | 'in_consultation' | 'done' | 'no_show',
  ): Promise<void> {
    const timestamps: Record<string, string> = {
      called:          'called_at',
      in_consultation: 'seen_at',
      done:            'done_at',
    };
    const tsCol = timestamps[status];
    const extraSet = tsCol ? `, ${tsCol} = now()` : '';
    await db.query(
      `UPDATE clinic_queue SET status = $1, updated_at = now()${extraSet} WHERE id = $2`,
      [status, queueId],
    );
  }

  async recalculateWaits(db: DataSource): Promise<void> {
    const [config] = await db.query(`SELECT avg_consult_mins FROM queue_config LIMIT 1`);
    const avgMins = config?.avg_consult_mins ?? 10;
    await db.query(
      `UPDATE clinic_queue cq
       SET estimated_wait_minutes = (
         SELECT COUNT(*) FROM clinic_queue cq2
         WHERE cq2.queue_date = CURRENT_DATE AND cq2.status = 'waiting'
           AND cq2.queue_number < cq.queue_number
       ) * $1,
       updated_at = now()
       WHERE cq.queue_date = CURRENT_DATE AND cq.status = 'waiting'`,
      [avgMins],
    );
  }
}
