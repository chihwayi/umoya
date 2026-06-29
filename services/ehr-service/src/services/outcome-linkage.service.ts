import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantService } from './tenant.service';
import { EncounterType, OutcomeType } from '../entities/encounter-outcome.entity';
import { RecordOutcomeDto } from '../dto/outcome-linkage.dto';

const FOLLOW_UP_WINDOWS: Record<EncounterType, number[]> = {
  delivery:               [7, 42],
  hiv_visit:              [30, 90],
  tb_case:                [60, 180],
  nutrition_admission:    [30, 90, 180],
  icu_admission:          [7, 30],
  ncd_visit:              [90, 180],
  postop:                 [30],
  dialysis_session:       [],
  oncology_cycle:         [90, 365],
  nicu_admission:         [30, 90],
  mental_health_session:  [90, 180],
  oem_assessment:         [180, 365],
};

@Injectable()
export class OutcomeLinkageService {
  private readonly logger = new Logger(OutcomeLinkageService.name);

  constructor(private readonly tenantService: TenantService) {}

  private async getTenantDb(tenantId: string): Promise<DataSource> {
    const db = await this.tenantService.getTenantDatabase(tenantId);
    if (!db) throw new ServiceUnavailableException('Tenant database connection unavailable');
    return db;
  }

  private addDays(date: Date, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async scheduleFollowUps(
    tenantId: string,
    encounterId: string,
    encounterType: EncounterType,
    patientId: string,
    baseDate: Date,
  ): Promise<void> {
    const windows = FOLLOW_UP_WINDOWS[encounterType] ?? [];
    if (windows.length === 0) return;

    const db = await this.getTenantDb(tenantId);
    for (const days of windows) {
      const dueDate = this.addDays(baseDate, days);
      await db.query(
        `INSERT INTO outcome_follow_up_schedules
          (tenant_id, encounter_id, encounter_type, patient_id, due_date, window_days, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [tenantId, encounterId, encounterType, patientId, dueDate, days],
      );
    }
  }

  // Called from services/controllers that hold a DataSource directly (older pattern)
  async scheduleFollowUpsFromDb(
    db: DataSource,
    tenantId: string,
    encounterId: string,
    encounterType: EncounterType,
    patientId: string,
    baseDate: Date,
  ): Promise<void> {
    const windows = FOLLOW_UP_WINDOWS[encounterType] ?? [];
    if (windows.length === 0) return;
    for (const days of windows) {
      const dueDate = this.addDays(baseDate, days);
      await db.query(
        `INSERT INTO outcome_follow_up_schedules
          (tenant_id, encounter_id, encounter_type, patient_id, due_date, window_days, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [tenantId, encounterId, encounterType, patientId, dueDate, days],
      );
    }
  }

  async recordOutcome(tenantId: string, dto: RecordOutcomeDto): Promise<any> {
    const db = await this.getTenantDb(tenantId);

    const [row] = await db.query(
      `INSERT INTO encounter_outcomes
        (tenant_id, encounter_id, encounter_type, patient_id, outcome_type,
         outcome_date, follow_up_window_days, clinical_notes, data_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        dto.encounterId,
        dto.encounterType,
        dto.patientId,
        dto.outcomeType,
        dto.outcomeDate,
        dto.followUpWindowDays,
        dto.clinicalNotes ?? null,
        dto.dataSource ?? 'manual',
      ],
    );

    // Mark the matching follow-up schedule as completed
    await db.query(
      `UPDATE outcome_follow_up_schedules
          SET status = 'completed', completed_at = NOW(), outcome_id = $1
        WHERE encounter_id = $2
          AND window_days = $3
          AND status = 'pending'`,
      [row.id, dto.encounterId, dto.followUpWindowDays],
    );

    return row;
  }

  async getPatientOutcomes(tenantId: string, patientId: string): Promise<any[]> {
    const db = await this.getTenantDb(tenantId);
    return db.query(
      `SELECT * FROM encounter_outcomes WHERE patient_id = $1 ORDER BY outcome_date DESC`,
      [patientId],
    );
  }

  async getPendingFollowUps(tenantId: string, dueBefore: Date, assignedTo?: string): Promise<any[]> {
    const db = await this.getTenantDb(tenantId);
    const dueStr = dueBefore.toISOString().slice(0, 10);

    if (assignedTo) {
      return db.query(
        `SELECT s.*, p.full_name AS patient_name
           FROM outcome_follow_up_schedules s
           LEFT JOIN patients p ON p.id = s.patient_id
          WHERE s.tenant_id = $1 AND s.status = 'pending'
            AND s.due_date <= $2 AND s.assigned_to = $3
          ORDER BY s.due_date`,
        [tenantId, dueStr, assignedTo],
      );
    }

    return db.query(
      `SELECT s.*, p.full_name AS patient_name
         FROM outcome_follow_up_schedules s
         LEFT JOIN patients p ON p.id = s.patient_id
        WHERE s.tenant_id = $1 AND s.status = 'pending' AND s.due_date <= $2
        ORDER BY s.due_date`,
      [tenantId, dueStr],
    );
  }

  async getOverdueFollowUps(tenantId: string): Promise<any[]> {
    const db = await this.getTenantDb(tenantId);
    const today = new Date().toISOString().slice(0, 10);
    return db.query(
      `SELECT s.*, p.full_name AS patient_name,
              ($1::date - s.due_date::date) AS days_overdue
         FROM outcome_follow_up_schedules s
         LEFT JOIN patients p ON p.id = s.patient_id
        WHERE s.tenant_id = $2 AND s.status = 'pending' AND s.due_date < $1
        ORDER BY s.due_date`,
      [today, tenantId],
    );
  }

  async getOutcomeRates(
    tenantId: string,
    encounterType: EncounterType,
    windowDays: number,
    startDate: string,
    endDate: string,
  ): Promise<{ total: number; outcomes: Record<OutcomeType, number>; completionRate: number }> {
    const db = await this.getTenantDb(tenantId);

    const rows: any[] = await db.query(
      `SELECT outcome_type, COUNT(*) AS cnt
         FROM encounter_outcomes
        WHERE tenant_id = $1
          AND encounter_type = $2
          AND follow_up_window_days = $3
          AND outcome_date BETWEEN $4 AND $5
        GROUP BY outcome_type`,
      [tenantId, encounterType, windowDays, startDate, endDate],
    );

    const outcomes: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      outcomes[r.outcome_type] = Number(r.cnt);
      total += Number(r.cnt);
    }

    const [{ scheduled }] = await db.query(
      `SELECT COUNT(*) AS scheduled
         FROM outcome_follow_up_schedules
        WHERE tenant_id = $1
          AND encounter_type = $2
          AND window_days = $3
          AND due_date BETWEEN $4 AND $5`,
      [tenantId, encounterType, windowDays, startDate, endDate],
    );

    const completionRate = Number(scheduled) > 0 ? (total / Number(scheduled)) * 100 : 0;

    return { total, outcomes: outcomes as Record<OutcomeType, number>, completionRate };
  }

  async autoDetectReadmissions(tenantId: string): Promise<void> {
    const db = await this.getTenantDb(tenantId);
    // Find ICU/hospital admissions within 30 days of a discharge follow-up schedule
    const candidates: any[] = await db.query(
      `SELECT s.id AS schedule_id, s.patient_id, s.encounter_id, s.due_date
         FROM outcome_follow_up_schedules s
        WHERE s.tenant_id = $1
          AND s.encounter_type = 'icu_admission'
          AND s.window_days = 30
          AND s.status = 'pending'
          AND s.due_date <= CURRENT_DATE`,
      [tenantId],
    );

    for (const c of candidates) {
      // Check for another ICU admission within the window
      const [readmit] = await db.query(
        `SELECT id FROM icu_admissions
          WHERE patient_id = $1
            AND admitted_at::date > $2::date - INTERVAL '30 days'
            AND id != $3
          LIMIT 1`,
        [c.patient_id, c.due_date, c.encounter_id],
      );

      if (readmit) {
        await db.query(
          `INSERT INTO encounter_outcomes
            (tenant_id, encounter_id, encounter_type, patient_id, outcome_type,
             outcome_date, follow_up_window_days, auto_flagged, data_source)
           VALUES ($1, $2, 'icu_admission', $3, 'readmitted', CURRENT_DATE, 30, TRUE, 'system_detected')
           ON CONFLICT DO NOTHING`,
          [tenantId, c.encounter_id, c.patient_id],
        );
        await db.query(
          `UPDATE outcome_follow_up_schedules SET status = 'completed', completed_at = NOW()
            WHERE id = $1`,
          [c.schedule_id],
        );
      }
    }
  }

  async autoDetectLTFU(tenantId: string): Promise<void> {
    const db = await this.getTenantDb(tenantId);
    // HIV patients with a pending 90-day follow-up that is now past due
    const candidates: any[] = await db.query(
      `SELECT s.id AS schedule_id, s.patient_id, s.encounter_id
         FROM outcome_follow_up_schedules s
        WHERE s.tenant_id = $1
          AND s.encounter_type = 'hiv_visit'
          AND s.window_days = 90
          AND s.status = 'pending'
          AND s.due_date < CURRENT_DATE - INTERVAL '7 days'`,
      [tenantId],
    );

    for (const c of candidates) {
      // Check for any HIV visit in the last 90 days
      const [recentVisit] = await db.query(
        `SELECT id FROM hiv_visits
          WHERE patient_id = $1
            AND visit_date >= CURRENT_DATE - INTERVAL '90 days'
          LIMIT 1`,
        [c.patient_id],
      );

      if (!recentVisit) {
        await db.query(
          `INSERT INTO encounter_outcomes
            (tenant_id, encounter_id, encounter_type, patient_id, outcome_type,
             outcome_date, follow_up_window_days, auto_flagged, data_source)
           VALUES ($1, $2, 'hiv_visit', $3, 'ltfu', CURRENT_DATE, 90, TRUE, 'system_detected')
           ON CONFLICT DO NOTHING`,
          [tenantId, c.encounter_id, c.patient_id],
        );
        await db.query(
          `UPDATE outcome_follow_up_schedules SET status = 'completed', completed_at = NOW()
            WHERE id = $1`,
          [c.schedule_id],
        );
      }
    }
  }
}
