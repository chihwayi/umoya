import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateClinicalOutcomeDto,
  UpdateClinicalOutcomeDto,
  ClinicalOutcomeQueryDto,
} from '../dto/analytics.dto';
import { ClinicalOutcome } from '../entities/clinical-outcome.entity';

@Injectable()
export class ClinicalOutcomesService {
  private readonly logger = new Logger(ClinicalOutcomesService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Record a clinical outcome
   */
  async recordOutcome(tenantDb: DataSource, dto: CreateClinicalOutcomeDto, userId?: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO clinical_outcomes (
        patient_id, outcome_type, condition, snomed_code, baseline_date,
        outcome_date, outcome_value, outcome_unit, outcome_status, severity,
        related_appointment_id, related_prescription_id, related_lab_order_id,
        notes, recorded_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *`,
      [
        dto.patientId,
        dto.outcomeType,
        dto.condition ?? null,
        dto.snomedCode ?? null,
        dto.baselineDate ?? null,
        dto.outcomeDate ?? null,
        dto.outcomeValue ?? null,
        dto.outcomeUnit ?? null,
        dto.outcomeStatus ?? null,
        dto.severity ?? null,
        dto.relatedAppointmentId ?? null,
        dto.relatedPrescriptionId ?? null,
        dto.relatedLabOrderId ?? null,
        dto.notes ?? null,
        userId ?? null,
      ],
    );

    return result[0];
  }

  /**
   * Get patient outcomes
   */
  async getPatientOutcomes(tenantDb: DataSource, patientId: string, filters?: Record<string, any>) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = [`patient_id = $1`];
    const params: any[] = [patientId];

    if (filters?.outcomeType) {
      where.push(`outcome_type = $${params.length + 1}`);
      params.push(filters.outcomeType);
    }
    if (filters?.condition) {
      where.push(`condition = $${params.length + 1}`);
      params.push(filters.condition);
    }
    if (filters?.dateFrom) {
      where.push(`outcome_date >= $${params.length + 1}`);
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      where.push(`outcome_date <= $${params.length + 1}`);
      params.push(filters.dateTo);
    }

    const whereClause = where.join(' AND ');
    const outcomes = await tenantDb.query(
      `SELECT * FROM clinical_outcomes WHERE ${whereClause} ORDER BY outcome_date DESC`,
      params,
    );

    return outcomes;
  }

  /**
   * Get outcomes with filters
   */
  async getOutcomes(tenantDb: DataSource, query: ClinicalOutcomeQueryDto) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = [];
    const params: any[] = [];
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    if (query.patientId) {
      where.push(`patient_id = $${params.length + 1}`);
      params.push(query.patientId);
    }
    if (query.outcomeType) {
      where.push(`outcome_type = $${params.length + 1}`);
      params.push(query.outcomeType);
    }
    if (query.condition) {
      where.push(`condition = $${params.length + 1}`);
      params.push(query.condition);
    }
    if (query.dateFrom) {
      where.push(`outcome_date >= $${params.length + 1}`);
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      where.push(`outcome_date <= $${params.length + 1}`);
      params.push(query.dateTo);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await tenantDb.query(
      `SELECT COUNT(*) as total FROM clinical_outcomes ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].total);

    const outcomes = await tenantDb.query(
      `SELECT * FROM clinical_outcomes ${whereClause} ORDER BY outcome_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      outcomes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get outcome trends
   */
  async getOutcomeTrends(tenantDb: DataSource, condition: string, dateRange: { from: string; to: string }) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `SELECT
        DATE_TRUNC('month', outcome_date) as period,
        outcome_status,
        COUNT(*) as count,
        AVG(outcome_value) as avg_value
      FROM clinical_outcomes
      WHERE condition = $1
        AND outcome_date >= $2
        AND outcome_date <= $3
      GROUP BY period, outcome_status
      ORDER BY period ASC`,
      [condition, dateRange.from, dateRange.to],
    );

    return result;
  }

  /**
   * Calculate outcome metrics
   */
  async calculateOutcomeMetrics(tenantDb: DataSource, condition: string, period: string) {
    this.ensureTenantDb(tenantDb);

    const dateFrom = this.getDateFromPeriod(period);

    const result = await tenantDb.query(
      `SELECT
        outcome_status,
        COUNT(*) as count,
        AVG(outcome_value) as avg_value,
        MIN(outcome_value) as min_value,
        MAX(outcome_value) as max_value
      FROM clinical_outcomes
      WHERE condition = $1
        AND outcome_date >= $2
      GROUP BY outcome_status`,
      [condition, dateFrom],
    );

    return result;
  }

  /**
   * Get outcome comparisons
   */
  async getOutcomeComparisons(tenantDb: DataSource, condition: string, groups: string[]) {
    this.ensureTenantDb(tenantDb);

    // This would compare outcomes across different groups (e.g., treatment groups, age groups)
    const result = await tenantDb.query(
      `SELECT
        outcome_status,
        COUNT(*) as count,
        AVG(outcome_value) as avg_value
      FROM clinical_outcomes
      WHERE condition = $1
      GROUP BY outcome_status`,
      [condition],
    );

    return result;
  }

  /**
   * Update an outcome
   */
  async updateOutcome(tenantDb: DataSource, id: string, dto: UpdateClinicalOutcomeDto) {
    this.ensureTenantDb(tenantDb);

    const updates: string[] = [];
    const params: any[] = [];

    const fields: Array<keyof UpdateClinicalOutcomeDto> = [
      'outcomeType',
      'condition',
      'snomedCode',
      'baselineDate',
      'outcomeDate',
      'outcomeValue',
      'outcomeUnit',
      'outcomeStatus',
      'severity',
      'relatedAppointmentId',
      'relatedPrescriptionId',
      'relatedLabOrderId',
      'notes',
    ];

    let paramIndex = 1;
    fields.forEach((field) => {
      if (dto[field] !== undefined) {
        const snakeField = this.camelToSnake(field as string);
        updates.push(`${snakeField} = $${paramIndex}`);
        params.push(dto[field]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      const result = await tenantDb.query(`SELECT * FROM clinical_outcomes WHERE id = $1`, [id]);
      if (!result || result.length === 0) {
        throw new NotFoundException(`Clinical outcome ${id} not found`);
      }
      return result[0];
    }

    updates.push(`updated_at = NOW()`);
    const finalParamIndex = paramIndex;
    params.push(id);

    const query = `UPDATE clinical_outcomes SET ${updates.join(', ')} WHERE id = $${finalParamIndex} RETURNING *`;
    const result = await tenantDb.query(query, params);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Clinical outcome ${id} not found`);
    }

    return result[0];
  }

  /**
   * Delete an outcome
   */
  async deleteOutcome(tenantDb: DataSource, id: string) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(`DELETE FROM clinical_outcomes WHERE id = $1 RETURNING *`, [id]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Clinical outcome ${id} not found`);
    }

    return { message: 'Outcome deleted successfully' };
  }

  private getDateFromPeriod(period: string): string {
    const now = new Date();
    const dateFrom = new Date(now);

    switch (period) {
      case '7d':
        dateFrom.setDate(dateFrom.getDate() - 7);
        break;
      case '30d':
        dateFrom.setDate(dateFrom.getDate() - 30);
        break;
      case '90d':
        dateFrom.setDate(dateFrom.getDate() - 90);
        break;
      case '1y':
        dateFrom.setFullYear(dateFrom.getFullYear() - 1);
        break;
      default:
        dateFrom.setDate(dateFrom.getDate() - 30);
    }

    return dateFrom.toISOString().split('T')[0];
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

