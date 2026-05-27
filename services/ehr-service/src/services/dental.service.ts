import { Injectable, BadRequestException } from '@nestjs/common';

type ToothCondition =
  | 'healthy' | 'caries' | 'filled' | 'missing' | 'crown'
  | 'rct' | 'bridge' | 'implant' | 'extraction_needed' | 'watch';

type PerioSite = 'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL';

export function validateToothNumber(toothNumber: number): boolean {
  return toothNumber >= 11 && toothNumber <= 48;
}

@Injectable()
export class DentalService {
  async createDentalChart(
    data: {
      patientId: string;
      dentistId: string;
      chiefComplaint?: string;
      oralHygieneIndex?: string;
      notes?: string;
    },
    db: any,
  ): Promise<{ id: string }> {
    const rows = await db.query(
      `INSERT INTO dental_charts (patient_id, dentist_id, chief_complaint, oral_hygiene_index, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [
        data.patientId, data.dentistId,
        data.chiefComplaint ?? null, data.oralHygieneIndex ?? null, data.notes ?? null,
      ],
    );
    return rows[0];
  }

  async recordToothCondition(
    chartId: string,
    toothNumber: number,
    surface: string | null,
    condition: ToothCondition,
    notes: string | null,
    db: any,
  ): Promise<void> {
    if (!validateToothNumber(toothNumber)) {
      throw new BadRequestException(`Invalid FDI tooth number: ${toothNumber}. Must be 11–48.`);
    }
    await db.query(
      `INSERT INTO dental_tooth_conditions (chart_id, tooth_number, surface, condition_code, notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (chart_id, tooth_number, surface) DO UPDATE
         SET condition_code = EXCLUDED.condition_code, notes = EXCLUDED.notes`,
      [chartId, toothNumber, surface, condition, notes],
    );
  }

  async recordPerioChart(
    chartId: string,
    entries: Array<{
      toothNumber: number;
      site: PerioSite;
      probingDepthMm: number;
      bleedingOnProbing: boolean;
      recessionMm?: number;
    }>,
    db: any,
  ): Promise<void> {
    for (const entry of entries) {
      await db.query(
        `INSERT INTO dental_perio_charts (chart_id, tooth_number, site, probing_depth_mm, bleeding_on_probing, recession_mm)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (chart_id, tooth_number, site) DO UPDATE SET
           probing_depth_mm = EXCLUDED.probing_depth_mm,
           bleeding_on_probing = EXCLUDED.bleeding_on_probing,
           recession_mm = EXCLUDED.recession_mm`,
        [
          chartId, entry.toothNumber, entry.site,
          entry.probingDepthMm, entry.bleedingOnProbing, entry.recessionMm ?? 0,
        ],
      );
    }
  }

  async addTreatmentPlan(
    data: {
      patientId: string;
      chartId?: string;
      toothNumber?: number;
      procedureCode: string;
      procedureDescription: string;
      plannedDate?: string;
      costUsd?: number;
      notes?: string;
    },
    db: any,
  ): Promise<{ id: string }> {
    const rows = await db.query(
      `INSERT INTO dental_treatment_plans (patient_id, chart_id, tooth_number, procedure_code, procedure_description, planned_date, cost_usd, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        data.patientId, data.chartId ?? null, data.toothNumber ?? null,
        data.procedureCode, data.procedureDescription, data.plannedDate ?? null,
        data.costUsd ?? null, data.notes ?? null,
      ],
    );
    return rows[0];
  }

  async completeTreatment(treatmentPlanId: string, completedDate: string, db: any): Promise<void> {
    await db.query(
      `UPDATE dental_treatment_plans SET status = 'completed', completed_date = $2 WHERE id = $1`,
      [treatmentPlanId, completedDate],
    );
  }

  async getPatientDentalHistory(patientId: string, db: any) {
    return db.query(
      `SELECT dc.*,
              json_agg(DISTINCT dtc.*) FILTER (WHERE dtc.id IS NOT NULL) AS tooth_conditions,
              json_agg(DISTINCT dtp.*) FILTER (WHERE dtp.id IS NOT NULL) AS treatment_plans
       FROM dental_charts dc
       LEFT JOIN dental_tooth_conditions dtc ON dtc.chart_id = dc.id
       LEFT JOIN dental_treatment_plans dtp ON dtp.chart_id = dc.id
       WHERE dc.patient_id = $1
       GROUP BY dc.id
       ORDER BY dc.visit_date DESC`,
      [patientId],
    );
  }
}
