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
   */
  async calculatePatientsOnART(tenantDb: DataSource): Promise<{
    total: number;
    onART: number;
    onARTRate: number;
  }> {
    try {
      const result = await tenantDb.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN art_start_date IS NOT NULL THEN 1 END) as on_art
        FROM hiv_care_enrollments
        WHERE enrollment_status = 'active'
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
   */
  async calculateLTFURate(tenantDb: DataSource): Promise<{
    total: number;
    ltfu: number;
    ltfuRate: number;
  }> {
    try {
      const result = await tenantDb.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN enrollment_status = 'lost_to_followup' THEN 1 END) as ltfu
        FROM hiv_care_enrollments
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
}

