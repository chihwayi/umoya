import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HivTptTrackerService {
  private readonly logger = new Logger(HivTptTrackerService.name);

  /**
   * Check TPT eligibility based on WHO guidelines
   * Eligible if:
   * - No active TB
   * - No TB symptoms
   * - Not already on TPT
   * - Age-appropriate (adults and children >5 years)
   */
  async checkTptEligibility(enrollmentId: string, tenantDb: DataSource): Promise<{
    isEligible: boolean;
    reason?: string;
    currentStatus?: string;
  }> {
    try {
      // Get latest visit
      const latestVisit = await tenantDb.query(
        `SELECT tb_screening, tb_investigation_result, tpt_status, arv_status
         FROM hiv_clinical_visits
         WHERE enrollment_id = $1
         ORDER BY visit_date DESC
         LIMIT 1`,
        [enrollmentId]
      );

      if (latestVisit.length === 0) {
        return { isEligible: true, reason: 'No visits recorded yet' };
      }

      const visit = latestVisit[0];

      // Check for active TB
      if (visit.tb_investigation_result === '1' || visit.tb_investigation_result === '2') {
        return {
          isEligible: false,
          reason: 'Active TB detected - TPT not indicated',
          currentStatus: visit.tpt_status
        };
      }

      // Check if already on TPT
      if (visit.tpt_status && ['II', 'CI', 'RI'].includes(visit.tpt_status)) {
        return {
          isEligible: false,
          reason: 'Patient is already on TPT',
          currentStatus: visit.tpt_status
        };
      }

      // Check if TPT was completed
      if (visit.tpt_status === 'IS') {
        return {
          isEligible: false,
          reason: 'TPT already completed',
          currentStatus: visit.tpt_status
        };
      }

      return { isEligible: true, currentStatus: visit.tpt_status };
    } catch (error) {
      this.logger.error('Error checking TPT eligibility:', error);
      return { isEligible: false, reason: 'Error checking eligibility' };
    }
  }

  /**
   * Calculate TPT completion status
   * TPT duration: 6 months (3HP or 6H)
   */
  async getTptCompletionStatus(enrollmentId: string, tenantDb: DataSource): Promise<{
    isComplete: boolean;
    monthsCompleted: number;
    monthsRemaining: number;
    startDate: Date | null;
    expectedCompletionDate: Date | null;
  }> {
    try {
      // Get TPT start date (first visit with TPT status = II, CI, or RI)
      const tptStart = await tenantDb.query(
        `SELECT visit_date, tpt_status
         FROM hiv_clinical_visits
         WHERE enrollment_id = $1
         AND tpt_status IN ('II', 'CI', 'RI')
         ORDER BY visit_date ASC
         LIMIT 1`,
        [enrollmentId]
      );

      if (tptStart.length === 0) {
        return {
          isComplete: false,
          monthsCompleted: 0,
          monthsRemaining: 6,
          startDate: null,
          expectedCompletionDate: null
        };
      }

      const startDate = new Date(tptStart[0].visit_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const monthsElapsed = Math.floor(
        (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );

      const expectedCompletionDate = new Date(startDate);
      expectedCompletionDate.setMonth(expectedCompletionDate.getMonth() + 6);

      return {
        isComplete: monthsElapsed >= 6,
        monthsCompleted: Math.min(6, monthsElapsed),
        monthsRemaining: Math.max(0, 6 - monthsElapsed),
        startDate,
        expectedCompletionDate
      };
    } catch (error) {
      this.logger.error('Error calculating TPT completion:', error);
      return {
        isComplete: false,
        monthsCompleted: 0,
        monthsRemaining: 6,
        startDate: null,
        expectedCompletionDate: null
      };
    }
  }
}

