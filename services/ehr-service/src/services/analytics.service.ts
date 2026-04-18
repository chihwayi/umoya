import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateAnalyticsMetricDto,
  UpdateAnalyticsMetricDto,
  AnalyticsMetricQueryDto,
  GetMetricTrendsDto,
  CompareMetricsDto,
} from '../dto/analytics.dto';
import { AnalyticsMetric } from '../entities/analytics-metric.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  private ensureTenantDb(tenantDb: DataSource) {
    if (!tenantDb) {
      throw new BadRequestException('Tenant database connection unavailable');
    }
  }

  /**
   * Calculate metrics
   */
  async calculateMetrics(
    tenantDb: DataSource,
    metricNames: string[],
    dateRange: { from: string; to: string },
    dimensions?: Record<string, any>,
  ) {
    this.ensureTenantDb(tenantDb);

    const metrics: any[] = [];

    for (const metricName of metricNames) {
      const value = await this.calculateMetric(tenantDb, metricName, dateRange, dimensions);
      metrics.push({
        metricName,
        value,
        dateRange,
        dimensions,
      });
    }

    return metrics;
  }

  /**
   * Calculate a single metric
   */
  private async calculateMetric(
    tenantDb: DataSource,
    metricName: string,
    dateRange: { from: string; to: string },
    dimensions?: Record<string, any>,
  ): Promise<number> {
    // This is a simplified version - in production, you'd have metric-specific calculation logic
    switch (metricName) {
      case 'daily_revenue':
        return await this.calculateDailyRevenue(tenantDb, dateRange);
      case 'patient_satisfaction':
        return await this.calculatePatientSatisfaction(tenantDb, dateRange);
      case 'appointment_count':
        return await this.calculateAppointmentCount(tenantDb, dateRange);
      case 'prescription_count':
        return await this.calculatePrescriptionCount(tenantDb, dateRange);
      case 'unassigned_studies_count':
        return await this.calculateUnassignedStudiesCount(tenantDb);
      case 'critical_findings_count':
        return await this.calculateCriticalFindingsCount(tenantDb, dateRange);
      case 'outstanding_balance':
        return await this.calculateOutstandingBalance(tenantDb);
      case 'medical_aid_pending':
        return await this.calculateMedicalAidPending(tenantDb);
      case 'active_patients_count':
        return await this.calculateActivePatientsCount(tenantDb);
      case 'pending_results_count':
        return await this.calculatePendingResultsCount(tenantDb);
      case 'unread_messages_count':
        return await this.calculateUnreadMessagesCount(tenantDb);
      case 'my_queue_count':
        return await this.calculateMyQueueCount(tenantDb, dimensions?.userId);
      case 'draft_reports_count':
        return await this.calculateDraftReportsCount(tenantDb, dimensions?.userId);
      case 'refund_requests_count':
        return await this.calculateRefundRequestsCount(tenantDb);
      default:
        // Try to get from pre-calculated metrics
        const result = await tenantDb.query(
          `SELECT AVG(metric_value) as avg_value
           FROM analytics_metrics
           WHERE metric_name = $1
             AND metric_date >= $2
             AND metric_date <= $3`,
          [metricName, dateRange.from, dateRange.to],
        );
        return parseFloat(result[0]?.avg_value || '0');
    }
  }

  /**
   * Get metric trends
   */
  async getMetricTrends(tenantDb: DataSource, dto: GetMetricTrendsDto) {
    this.ensureTenantDb(tenantDb);

    const dateFrom = dto.dateFrom || this.getDateFromPeriod(dto.period || '30d');
    const dateTo = dto.dateTo || new Date().toISOString().split('T')[0];
    const groupBy = dto.groupBy || 'day';

    const result = await tenantDb.query(
      `SELECT
        DATE_TRUNC($1, metric_date) as period,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value,
        COUNT(*) as count
      FROM analytics_metrics
      WHERE metric_name = $2
        AND metric_date >= $3
        AND metric_date <= $4
      GROUP BY period
      ORDER BY period ASC`,
      [groupBy, dto.metricName, dateFrom, dateTo],
    );

    return result;
  }

  /**
   * Compare metrics across periods
   */
  async compareMetrics(tenantDb: DataSource, dto: CompareMetricsDto) {
    this.ensureTenantDb(tenantDb);

    const period1 = await tenantDb.query(
      `SELECT
        AVG(metric_value) as avg_value,
        COUNT(*) as count,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value
      FROM analytics_metrics
      WHERE metric_name = $1
        AND metric_date >= $2
        AND metric_date <= $3`,
      [dto.metricName, dto.period1Start, dto.period1End],
    );

    const period2 = await tenantDb.query(
      `SELECT
        AVG(metric_value) as avg_value,
        COUNT(*) as count,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value
      FROM analytics_metrics
      WHERE metric_name = $1
        AND metric_date >= $2
        AND metric_date <= $3`,
      [dto.metricName, dto.period2Start, dto.period2End],
    );

    const p1 = period1[0];
    const p2 = period2[0];
    const change = p1.avg_value && p2.avg_value ? ((p2.avg_value - p1.avg_value) / p1.avg_value) * 100 : 0;

    return {
      period1: {
        ...p1,
        start: dto.period1Start,
        end: dto.period1End,
      },
      period2: {
        ...p2,
        start: dto.period2Start,
        end: dto.period2End,
      },
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(change.toFixed(2)),
    };
  }

  /**
   * Get benchmarks
   */
  async getBenchmarks(tenantDb: DataSource, metricName: string) {
    this.ensureTenantDb(tenantDb);

    // Get historical averages as benchmarks
    const result = await tenantDb.query(
      `SELECT
        DATE_TRUNC('month', metric_date) as period,
        AVG(metric_value) as benchmark_value
      FROM analytics_metrics
      WHERE metric_name = $1
        AND metric_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY period
      ORDER BY period DESC
      LIMIT 12`,
      [metricName],
    );

    return {
      metricName,
      benchmarks: result,
      industryAverage: null, // Would come from external data
    };
  }

  async getDefaultTemplates(tenantDb: DataSource): Promise<any[]> {
    this.ensureTenantDb(tenantDb);

    return tenantDb.query(
      `SELECT *
       FROM analytics_templates
       WHERE is_default = true
       ORDER BY name ASC`,
    );
  }

  /**
   * Create or update a metric
   */
  async createMetric(tenantDb: DataSource, dto: CreateAnalyticsMetricDto) {
    this.ensureTenantDb(tenantDb);

    const result = await tenantDb.query(
      `INSERT INTO analytics_metrics (
        metric_name, metric_category, metric_date, metric_value,
        metric_unit, dimensions, calculation_method, calculated_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
      RETURNING *`,
      [
        dto.metricName,
        dto.metricCategory ?? null,
        dto.metricDate,
        dto.metricValue ?? null,
        dto.metricUnit ?? null,
        JSON.stringify(dto.dimensions ?? {}),
        dto.calculationMethod ?? null,
      ],
    );

    return result[0];
  }

  /**
   * Get metrics with filters
   */
  async getMetrics(tenantDb: DataSource, query: AnalyticsMetricQueryDto) {
    this.ensureTenantDb(tenantDb);

    const where: string[] = [];
    const params: any[] = [];
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    if (query.metricName) {
      where.push(`metric_name = $${params.length + 1}`);
      params.push(query.metricName);
    }
    if (query.metricCategory) {
      where.push(`metric_category = $${params.length + 1}`);
      params.push(query.metricCategory);
    }
    if (query.dateFrom) {
      where.push(`metric_date >= $${params.length + 1}`);
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      where.push(`metric_date <= $${params.length + 1}`);
      params.push(query.dateTo);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countResult = await tenantDb.query(
      `SELECT COUNT(*) as total FROM analytics_metrics ${whereClause}`,
      params,
    );
    const total = parseInt(countResult[0].total);

    const metrics = await tenantDb.query(
      `SELECT * FROM analytics_metrics ${whereClause} ORDER BY metric_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      metrics,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Helper methods for specific metric calculations
  private async calculateDailyRevenue(tenantDb: DataSource, dateRange: { from: string; to: string }): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM billing
       WHERE invoice_date >= $1 AND invoice_date <= $2
         AND status = 'paid'`,
      [dateRange.from, dateRange.to],
    );
    return parseFloat(result[0]?.total || '0');
  }

  private async calculatePatientSatisfaction(tenantDb: DataSource, dateRange: { from: string; to: string }): Promise<number> {
    // This would calculate from satisfaction ratings if available
    const result = await tenantDb.query(
      `SELECT COALESCE(AVG(satisfaction_rating), 0) as avg_rating
       FROM telemedicine_consultations
       WHERE actual_end_time >= $1 AND actual_end_time <= $2
         AND satisfaction_rating IS NOT NULL`,
      [dateRange.from, dateRange.to],
    );
    return parseFloat(result[0]?.avg_rating || '0');
  }

  private async calculateAppointmentCount(tenantDb: DataSource, dateRange: { from: string; to: string }): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM appointments
       WHERE appointment_date >= $1 AND appointment_date <= $2`,
      [dateRange.from, dateRange.to],
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculatePrescriptionCount(tenantDb: DataSource, dateRange: { from: string; to: string }): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM prescriptions
       WHERE created_at >= $1 AND created_at <= $2`,
      [dateRange.from, dateRange.to],
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateUnassignedStudiesCount(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM lab_orders lo
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(lo.tests) as test
         WHERE test->>'category' = 'radiology'
       )
       AND lo.reviewed_by_id IS NULL
       AND lo.status != 'cancelled'`,
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateCriticalFindingsCount(tenantDb: DataSource, dateRange: { from: string; to: string }): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM lab_orders lo
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(lo.results) as result
         WHERE result->>'flag' = 'critical'
       )
       AND lo.created_at >= $1 AND lo.created_at <= $2`,
      [dateRange.from, dateRange.to],
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateOutstandingBalance(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM billing
       WHERE status IN ('sent', 'pending', 'overdue')`,
    );
    return parseFloat(result[0]?.total || '0');
  }

  private async calculateMedicalAidPending(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COALESCE(SUM(claim_amount), 0) as total
       FROM medical_aid_claims
       WHERE status IN ('submitted', 'processing')`,
    );
    return parseFloat(result[0]?.total || '0');
  }

  private async calculateActivePatientsCount(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM patients
       WHERE is_active = true`,
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculatePendingResultsCount(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM lab_orders
       WHERE status IN ('ordered', 'in_progress', 'collected')`,
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateUnreadMessagesCount(tenantDb: DataSource): Promise<number> {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM patient_messages
       WHERE read = false`,
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateMyQueueCount(tenantDb: DataSource, userId?: string): Promise<number> {
    if (!userId) return 0;
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM lab_orders
       WHERE reviewed_by_id = $1
       AND status NOT IN ('completed', 'cancelled')`,
      [userId],
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateDraftReportsCount(tenantDb: DataSource, userId?: string): Promise<number> {
    if (!userId) return 0;
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM lab_orders
       WHERE reviewed_by_id = $1
       AND status = 'in_progress'`,
      [userId],
    );
    return parseInt(result[0]?.count || '0');
  }

  private async calculateRefundRequestsCount(tenantDb: DataSource): Promise<number> {
    // Placeholder implementation until Refund entity is defined
    return 0;
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
}

