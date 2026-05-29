import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface UtilizationMetrics {
  utilization_pct: number;
  on_time_start_pct: number;
  avg_turnover_mins: number;
  cancellation_rate_pct: number;
  total_cases: number;
  cancelled_cases: number;
  completed_cases: number;
}

@Injectable()
export class TheatreService {
  private readonly logger = new Logger(TheatreService.name);

  async scheduleCase(
    db: DataSource,
    payload: {
      roomId: string;
      patientId: string;
      surgeonId: string;
      anaesthetistId?: string;
      procedureName: string;
      procedureCodes?: string[];
      plannedStart: string;
      plannedEnd: string;
    },
  ): Promise<string> {
    const [row] = await db.query(
      `INSERT INTO theatre_cases
         (room_id, patient_id, surgeon_id, anaesthetist_id, procedure_name, procedure_codes, planned_start, planned_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        payload.roomId, payload.patientId, payload.surgeonId,
        payload.anaesthetistId ?? null, payload.procedureName,
        payload.procedureCodes ?? null, payload.plannedStart, payload.plannedEnd,
      ],
    );
    return row.id as string;
  }

  async startCase(db: DataSource, caseId: string): Promise<void> {
    await db.query(
      `UPDATE theatre_cases SET status = 'in_progress', actual_start = now(), updated_at = now() WHERE id = $1`,
      [caseId],
    );
  }

  async endCase(db: DataSource, caseId: string): Promise<void> {
    await db.query(
      `UPDATE theatre_cases SET status = 'completed', actual_end = now(), updated_at = now() WHERE id = $1`,
      [caseId],
    );
  }

  async cancelCase(
    db: DataSource,
    caseId: string,
    reason: string,
    note?: string,
  ): Promise<void> {
    await db.query(
      `UPDATE theatre_cases
       SET status = 'cancelled', cancellation_reason = $2, cancellation_note = $3,
           cancelled_at = now(), updated_at = now()
       WHERE id = $1`,
      [caseId, reason, note ?? null],
    );
  }

  async getDaySchedule(db: DataSource, date: string): Promise<any[]> {
    return db.query(
      `SELECT tc.*,
         tr.name AS room_name,
         p.first_name || ' ' || p.last_name AS patient_name,
         u.first_name || ' ' || u.last_name AS surgeon_name
       FROM theatre_cases tc
       JOIN theatre_rooms tr ON tr.id = tc.room_id
       JOIN patients p ON p.id = tc.patient_id
       LEFT JOIN users u ON u.id = tc.surgeon_id
       WHERE DATE(tc.planned_start) = $1
       ORDER BY tr.name, tc.planned_start`,
      [date],
    );
  }

  async getUtilizationMetrics(db: DataSource, date: string): Promise<UtilizationMetrics> {
    const [metrics] = await db.query(
      `SELECT
         COUNT(*) AS total_cases,
         COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled_cases,
         COUNT(*) FILTER (WHERE status = 'completed')  AS completed_cases,
         COUNT(*) FILTER (WHERE actual_start <= planned_start + interval '10 minutes' AND actual_start IS NOT NULL) AS on_time_cases,
         AVG(
           EXTRACT(EPOCH FROM (tc_next.actual_start - tc.actual_end)) / 60
         ) FILTER (WHERE tc.actual_end IS NOT NULL) AS avg_turnover_mins,
         SUM(
           EXTRACT(EPOCH FROM (COALESCE(tc.actual_end, tc.planned_end) - COALESCE(tc.actual_start, tc.planned_start))) / 60
         ) AS total_used_mins
       FROM theatre_cases tc
       LEFT JOIN theatre_cases tc_next
         ON tc_next.room_id = tc.room_id
        AND DATE(tc_next.planned_start) = $1
        AND tc_next.planned_start = (
          SELECT MIN(t2.planned_start) FROM theatre_cases t2
          WHERE t2.room_id = tc.room_id AND t2.planned_start > tc.planned_start
            AND DATE(t2.planned_start) = $1
        )
       WHERE DATE(tc.planned_start) = $1`,
      [date],
    );

    const [rooms] = await db.query(
      `SELECT COUNT(*) * (17 * 60 - 7.5 * 60) AS available_mins
       FROM theatre_rooms WHERE is_active = TRUE`,
    );

    const total = Number(metrics.total_cases);
    const cancelled = Number(metrics.cancelled_cases);
    const completed = Number(metrics.completed_cases);
    const onTime = Number(metrics.on_time_cases);
    const usedMins = Number(metrics.total_used_mins ?? 0);
    const availMins = Number(rooms.available_mins ?? 570);

    return {
      total_cases:           total,
      cancelled_cases:       cancelled,
      completed_cases:       completed,
      utilization_pct:       availMins > 0 ? Math.round((usedMins / availMins) * 100) : 0,
      on_time_start_pct:     total > 0 ? Math.round((onTime / (total - cancelled)) * 100) : 0,
      avg_turnover_mins:     Math.round(Number(metrics.avg_turnover_mins ?? 0)),
      cancellation_rate_pct: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    };
  }

  async listRooms(db: DataSource): Promise<any[]> {
    return db.query(`SELECT * FROM theatre_rooms WHERE is_active = TRUE ORDER BY name`);
  }
}
