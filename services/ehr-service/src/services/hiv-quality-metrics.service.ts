import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HivQualityMetricsService {
  private readonly logger = new Logger(HivQualityMetricsService.name);

  /**
   * Calculate VL suppression rate
   */
  async calculateVLSuppressionRate(tenantDb: DataSource, enrollmentIds?: string[]): Promise<{
    total: number;
    suppressed: number;
    suppressedRate: number;
    undetectable: number;
    undetectableRate: number;
  }> {
    try {
      let query = `
        SELECT 
          COUNT(DISTINCT e.id) as total,
          COUNT(DISTINCT CASE WHEN v.viral_load < 1000 AND v.viral_load IS NOT NULL THEN e.id END) as suppressed,
          COUNT(DISTINCT CASE WHEN v.viral_load < 50 AND v.viral_load IS NOT NULL THEN e.id END) as undetectable
        FROM hiv_care_enrollments e
        JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
        WHERE e.enrollment_status = 'active'
        AND v.viral_load IS NOT NULL
        AND v.viral_load_test_date IS NOT NULL
        AND v.visit_date >= CURRENT_DATE - INTERVAL '12 months'
      `;

      const params: any[] = [];
      if (enrollmentIds && enrollmentIds.length > 0) {
        query += ` AND e.id = ANY($1)`;
        params.push(enrollmentIds);
      }

      const result = await tenantDb.query(query, params);
      const row = result[0];

      const total = parseInt(row.total || '0');
      const suppressed = parseInt(row.suppressed || '0');
      const undetectable = parseInt(row.undetectable || '0');

      return {
        total,
        suppressed,
        suppressedRate: total > 0 ? (suppressed / total) * 100 : 0,
        undetectable,
        undetectableRate: total > 0 ? (undetectable / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error calculating VL suppression rate:', error);
      return { total: 0, suppressed: 0, suppressedRate: 0, undetectable: 0, undetectableRate: 0 };
    }
  }

  /**
   * Calculate patients on ART percentage
   * Based on latest visit ARV status (not just enrollment art_start_date)
   */
  async calculatePatientsOnART(tenantDb: DataSource): Promise<{
    total: number;
    onART: number;
    onARTRate: number;
  }> {
    try {
      const result = await tenantDb.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total,
          COUNT(DISTINCT CASE 
            WHEN e.art_start_date IS NOT NULL 
               OR latest_visit.arv_status IN ('2a', '2b', '3', '4', '6')
            THEN e.id 
          END) as on_art
        FROM hiv_care_enrollments e
        LEFT JOIN LATERAL (
          SELECT arv_status 
          FROM hiv_clinical_visits v
          WHERE v.enrollment_id = e.id
          ORDER BY v.visit_date DESC, v.visit_number DESC
          LIMIT 1
        ) latest_visit ON true
        WHERE e.enrollment_status = 'active'
      `);

      const row = result[0];
      const total = parseInt(row.total || '0');
      const onART = parseInt(row.on_art || '0');

      return {
        total,
        onART,
        onARTRate: total > 0 ? (onART / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error calculating patients on ART:', error);
      return { total: 0, onART: 0, onARTRate: 0 };
    }
  }

  /**
   * Calculate treatment failure rate
   */
  async calculateTreatmentFailureRate(tenantDb: DataSource): Promise<{
    total: number;
    failures: number;
    failureRate: number;
  }> {
    try {
      const result = await tenantDb.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total,
          COUNT(DISTINCT CASE 
            WHEN v.viral_load > 1000 
            AND v.arv_status IN ('2a', '2b', '3', '4', '6')
            AND v.viral_load_test_date >= CURRENT_DATE - INTERVAL '12 months'
            THEN e.id 
          END) as failures
        FROM hiv_care_enrollments e
        JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
        WHERE e.enrollment_status = 'active'
        AND v.arv_status IN ('2a', '2b', '3', '4', '6')
      `);

      const row = result[0];
      const total = parseInt(row.total || '0');
      const failures = parseInt(row.failures || '0');

      return {
        total,
        failures,
        failureRate: total > 0 ? (failures / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error calculating treatment failure rate:', error);
      return { total: 0, failures: 0, failureRate: 0 };
    }
  }

  /**
   * Calculate LTFU rate
   * Based on patients overdue for visits (not just enrollment_status)
   * Uses 90 days as the standard LTFU definition
   */
  async calculateLTFURate(tenantDb: DataSource): Promise<{
    total: number;
    ltfu: number;
    ltfuRate: number;
  }> {
    try {
      // Standard LTFU definition: 90 days since last visit
      const result = await tenantDb.query(`
        WITH enrollment_data AS (
          SELECT 
            e.id,
            e.enrollment_status,
            MAX(v.visit_date) as last_visit_date,
            MAX(v.next_review_date) as last_next_review_date,
            CASE 
              WHEN MAX(v.visit_date) IS NOT NULL THEN 
                (CURRENT_DATE - MAX(v.visit_date)::date)::integer
              ELSE 
                (CURRENT_DATE - e.enrollment_date::date)::integer
            END as days_since_last_visit
          FROM hiv_care_enrollments e
          LEFT JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
          GROUP BY e.id, e.enrollment_status, e.enrollment_date
        )
        SELECT 
          COUNT(*) as total,
          COUNT(CASE 
            WHEN enrollment_status = 'lost_to_followup' 
              OR (days_since_last_visit >= 90 AND enrollment_status = 'active')
            THEN 1 
          END) as ltfu
        FROM enrollment_data
      `);

      const row = result[0];
      const total = parseInt(row.total || '0');
      const ltfu = parseInt(row.ltfu || '0');

      return {
        total,
        ltfu,
        ltfuRate: total > 0 ? (ltfu / total) * 100 : 0
      };
    } catch (error) {
      this.logger.error('Error calculating LTFU rate:', error);
      return { total: 0, ltfu: 0, ltfuRate: 0 };
    }
  }

  /**
   * Calculate average time to VL suppression
   */
  async calculateAverageTimeToSuppression(tenantDb: DataSource): Promise<{
    averageDays: number;
    medianDays: number;
    sampleSize: number;
  }> {
    try {
      const result = await tenantDb.query(`
        WITH suppression_data AS (
          SELECT 
            e.id,
            e.art_start_date,
            MIN(CASE WHEN v.viral_load < 1000 AND v.viral_load IS NOT NULL THEN v.visit_date END) as first_suppression_date
          FROM hiv_care_enrollments e
          JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
          WHERE e.art_start_date IS NOT NULL
          AND e.enrollment_status = 'active'
          GROUP BY e.id, e.art_start_date
          HAVING MIN(CASE WHEN v.viral_load < 1000 AND v.viral_load IS NOT NULL THEN v.visit_date END) IS NOT NULL
        )
        SELECT 
          COUNT(*) as sample_size,
          AVG(EXTRACT(DAY FROM (first_suppression_date - art_start_date))) as avg_days,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(DAY FROM (first_suppression_date - art_start_date))) as median_days
        FROM suppression_data
      `);

      const row = result[0];
      return {
        averageDays: parseFloat(row.avg_days || '0'),
        medianDays: parseFloat(row.median_days || '0'),
        sampleSize: parseInt(row.sample_size || '0')
      };
    } catch (error) {
      this.logger.error('Error calculating time to suppression:', error);
      return { averageDays: 0, medianDays: 0, sampleSize: 0 };
    }
  }

  /**
   * Get cohort analysis data
   */
  async getCohortAnalysis(cohortType: 'enrollment' | 'art_start', timeRange: string, tenantDb: DataSource) {
    try {
      const dateField = cohortType === 'enrollment' ? 'e.enrollment_date' : 'e.art_start_date';
      let dateFilter = '';
      
      if (timeRange !== 'all') {
        const months = timeRange === '6months' ? 6 : timeRange === '12months' ? 12 : 24;
        dateFilter = `AND ${dateField} >= CURRENT_DATE - INTERVAL '${months} months'`;
      }

      const cohorts = await tenantDb.query(`
        SELECT 
          DATE_TRUNC('month', ${dateField})::date as cohort_period,
          COUNT(DISTINCT e.id) as total_enrolled,
          COUNT(DISTINCT CASE 
            WHEN e.enrollment_status = 'active' 
            AND EXISTS (
              SELECT 1 FROM hiv_clinical_visits v 
              WHERE v.enrollment_id = e.id 
              AND v.visit_date >= CURRENT_DATE - INTERVAL '6 months'
            ) THEN e.id 
          END) as total_retained,
          COUNT(DISTINCT CASE 
            WHEN v.viral_load < 1000 AND v.viral_load IS NOT NULL 
            THEN e.id 
          END) as vl_suppressed
        FROM hiv_care_enrollments e
        LEFT JOIN LATERAL (
          SELECT viral_load 
          FROM hiv_clinical_visits v
          WHERE v.enrollment_id = e.id
          AND v.viral_load IS NOT NULL
          ORDER BY v.viral_load_test_date DESC
          LIMIT 1
        ) v ON true
        WHERE ${dateField} IS NOT NULL ${dateFilter}
        GROUP BY DATE_TRUNC('month', ${dateField})::date
        ORDER BY cohort_period DESC
      `);

      const formattedCohorts = cohorts.map((c: any) => ({
        cohortPeriod: new Date(c.cohort_period).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        totalEnrolled: parseInt(c.total_enrolled || '0'),
        totalRetained: parseInt(c.total_retained || '0'),
        retentionRate: c.total_enrolled > 0 ? (c.total_retained / c.total_enrolled) * 100 : 0,
        vlSuppressed: parseInt(c.vl_suppressed || '0'),
        vlSuppressionRate: c.total_enrolled > 0 ? (c.vl_suppressed / c.total_enrolled) * 100 : 0
      }));

      const totalPatients = formattedCohorts.reduce((sum: number, c: any) => sum + c.totalEnrolled, 0);
      const avgRetention = formattedCohorts.length > 0
        ? formattedCohorts.reduce((sum: number, c: any) => sum + c.retentionRate, 0) / formattedCohorts.length
        : 0;
      const avgVLSuppression = formattedCohorts.length > 0
        ? formattedCohorts.reduce((sum: number, c: any) => sum + c.vlSuppressionRate, 0) / formattedCohorts.length
        : 0;

      return {
        cohorts: formattedCohorts,
        totalCohorts: formattedCohorts.length,
        totalPatients,
        averageRetentionRate: avgRetention,
        averageVLSuppressionRate: avgVLSuppression
      };
    } catch (error) {
      this.logger.error('Error getting cohort analysis:', error);
      return { cohorts: [], totalCohorts: 0, totalPatients: 0, averageRetentionRate: 0, averageVLSuppressionRate: 0 };
    }
  }

  /**
   * Get comparison report between two periods
   */
  async getComparisonReport(params: any, tenantDb: DataSource) {
    try {
      const { period1Start, period1End, period2Start, period2End } = params;

      const period1Data = await tenantDb.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total_patients,
          COUNT(DISTINCT CASE WHEN e.art_start_date IS NOT NULL OR latest_visit.arv_status IN ('2a', '2b', '3', '4', '6') THEN e.id END) as on_art,
          COUNT(DISTINCT CASE WHEN v.viral_load < 1000 AND v.viral_load IS NOT NULL THEN e.id END) as vl_suppressed,
          COUNT(DISTINCT CASE WHEN e.enrollment_status = 'lost_to_followup' OR (e.enrollment_status = 'active' AND (MAX(v.visit_date) < CURRENT_DATE - INTERVAL '90 days' OR MAX(v.visit_date) IS NULL)) THEN e.id END) as ltfu
        FROM hiv_care_enrollments e
        LEFT JOIN LATERAL (
          SELECT arv_status FROM hiv_clinical_visits v
          WHERE v.enrollment_id = e.id
          ORDER BY v.visit_date DESC LIMIT 1
        ) latest_visit ON true
        LEFT JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
        WHERE e.enrollment_date BETWEEN $1::date AND $2::date
        GROUP BY e.id
      `, [period1Start, period1End]);

      const period2Data = await tenantDb.query(`
        SELECT 
          COUNT(DISTINCT e.id) as total_patients,
          COUNT(DISTINCT CASE WHEN e.art_start_date IS NOT NULL OR latest_visit.arv_status IN ('2a', '2b', '3', '4', '6') THEN e.id END) as on_art,
          COUNT(DISTINCT CASE WHEN v.viral_load < 1000 AND v.viral_load IS NOT NULL THEN e.id END) as vl_suppressed,
          COUNT(DISTINCT CASE WHEN e.enrollment_status = 'lost_to_followup' OR (e.enrollment_status = 'active' AND (MAX(v.visit_date) < CURRENT_DATE - INTERVAL '90 days' OR MAX(v.visit_date) IS NULL)) THEN e.id END) as ltfu
        FROM hiv_care_enrollments e
        LEFT JOIN LATERAL (
          SELECT arv_status FROM hiv_clinical_visits v
          WHERE v.enrollment_id = e.id
          ORDER BY v.visit_date DESC LIMIT 1
        ) latest_visit ON true
        LEFT JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
        WHERE e.enrollment_date BETWEEN $1::date AND $2::date
        GROUP BY e.id
      `, [period2Start, period2End]);

      const p1 = period1Data[0] || { total_patients: 0, on_art: 0, vl_suppressed: 0, ltfu: 0 };
      const p2 = period2Data[0] || { total_patients: 0, on_art: 0, vl_suppressed: 0, ltfu: 0 };

      const calculateRate = (value: number, total: number) => total > 0 ? (value / total) * 100 : 0;

      return {
        period1: {
          totalPatients: parseInt(p1.total_patients || '0'),
          onART: parseInt(p1.on_art || '0'),
          artCoverage: calculateRate(parseInt(p1.on_art || '0'), parseInt(p1.total_patients || '0')),
          vlSuppressed: parseInt(p1.vl_suppressed || '0'),
          vlSuppressionRate: calculateRate(parseInt(p1.vl_suppressed || '0'), parseInt(p1.total_patients || '0')),
          ltfu: parseInt(p1.ltfu || '0'),
          ltfuRate: calculateRate(parseInt(p1.ltfu || '0'), parseInt(p1.total_patients || '0')),
          retentionRate: calculateRate(parseInt(p1.total_patients || '0') - parseInt(p1.ltfu || '0'), parseInt(p1.total_patients || '0'))
        },
        period2: {
          totalPatients: parseInt(p2.total_patients || '0'),
          onART: parseInt(p2.on_art || '0'),
          artCoverage: calculateRate(parseInt(p2.on_art || '0'), parseInt(p2.total_patients || '0')),
          vlSuppressed: parseInt(p2.vl_suppressed || '0'),
          vlSuppressionRate: calculateRate(parseInt(p2.vl_suppressed || '0'), parseInt(p2.total_patients || '0')),
          ltfu: parseInt(p2.ltfu || '0'),
          ltfuRate: calculateRate(parseInt(p2.ltfu || '0'), parseInt(p2.total_patients || '0')),
          retentionRate: calculateRate(parseInt(p2.total_patients || '0') - parseInt(p2.ltfu || '0'), parseInt(p2.total_patients || '0'))
        },
        period1Label: `${new Date(period1Start).toLocaleDateString()} - ${new Date(period1End).toLocaleDateString()}`,
        period2Label: `${new Date(period2Start).toLocaleDateString()} - ${new Date(period2End).toLocaleDateString()}`,
        trends: [] // Can be enhanced with monthly trend data
      };
    } catch (error) {
      this.logger.error('Error getting comparison report:', error);
      return { period1: {}, period2: {}, period1Label: '', period2Label: '', trends: [] };
    }
  }
}

