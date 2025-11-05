import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HivMonitoringService {
  private readonly logger = new Logger(HivMonitoringService.name);

  /**
   * Calculate next Viral Load test date based on WHO/CDC guidelines
   * Logic:
   * - After ART initiation: 2-4 weeks, then 4-8 weeks until suppressed
   * - Stable ART: every 3-4 months (6 months if suppressed >2 years)
   * - After regimen change: 4-8 weeks
   * - Treatment failure: 4-8 weeks
   */
  calculateNextViralLoadDate(
    artStartDate: Date | null,
    lastVlDate: Date | null,
    lastVlResult: number | null,
    regimenChangeDate: Date | null,
    visitDate: Date
  ): Date {
    const today = new Date(visitDate);
    today.setHours(0, 0, 0, 0);

    // If no ART start date, recommend baseline test
    if (!artStartDate) {
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + 7); // 1 week from now
      return nextDate;
    }

    const artStart = new Date(artStartDate);
    artStart.setHours(0, 0, 0, 0);
    const daysSinceArtStart = Math.floor((today.getTime() - artStart.getTime()) / (1000 * 60 * 60 * 24));

    // After ART initiation or regimen change: 4-8 weeks
    if (regimenChangeDate) {
      const changeDate = new Date(regimenChangeDate);
      changeDate.setHours(0, 0, 0, 0);
      const daysSinceChange = Math.floor((today.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceChange < 56) { // Less than 8 weeks
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + (56 - daysSinceChange)); // Complete 8 weeks
        return nextDate;
      }
    }

    // First 8 weeks after ART start: 2-4 weeks, then 4-8 weeks until suppressed
    if (daysSinceArtStart < 56) {
      if (!lastVlDate || !lastVlResult) {
        // No VL test yet after ART start
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + 28); // 4 weeks
        return nextDate;
      }

      const lastVl = new Date(lastVlDate);
      lastVl.setHours(0, 0, 0, 0);
      const daysSinceLastVl = Math.floor((today.getTime() - lastVl.getTime()) / (1000 * 60 * 60 * 24));

      if (lastVlResult > 1000) {
        // Not suppressed: test every 4-8 weeks
        if (daysSinceLastVl < 56) {
          const nextDate = new Date(today);
          nextDate.setDate(nextDate.getDate() + (56 - daysSinceLastVl));
          return nextDate;
        }
      } else {
        // Suppressed: test in 4 weeks to confirm
        const nextDate = new Date(today);
        nextDate.setDate(nextDate.getDate() + 28);
        return nextDate;
      }
    }

    // Stable ART: Check suppression status
    if (lastVlResult !== null && lastVlResult < 1000) {
      // Suppressed: Check if suppressed for >2 years
      if (lastVlDate) {
        const lastVl = new Date(lastVlDate);
        lastVl.setHours(0, 0, 0, 0);
        const daysSinceLastVl = Math.floor((today.getTime() - lastVl.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if patient has been suppressed for >2 years
        const suppressedForDays = daysSinceArtStart > 730 ? daysSinceArtStart : 0;
        
        if (suppressedForDays > 730) {
          // Suppressed >2 years: 6 months
          const nextDate = new Date(today);
          nextDate.setMonth(nextDate.getMonth() + 6);
          return nextDate;
        } else {
          // Suppressed <2 years: 3-4 months
          const nextDate = new Date(today);
          nextDate.setMonth(nextDate.getMonth() + 3);
          return nextDate;
        }
      }
    } else if (lastVlResult !== null && lastVlResult >= 1000) {
      // Treatment failure: 4-8 weeks
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + 56); // 8 weeks
      return nextDate;
    }

    // Default: 3 months for stable patients
    const nextDate = new Date(today);
    nextDate.setMonth(nextDate.getMonth() + 3);
    return nextDate;
  }

  /**
   * Calculate next CD4 test date based on WHO guidelines
   */
  calculateNextCD4Date(
    artStartDate: Date | null,
    lastCd4Date: Date | null,
    lastCd4Count: number | null,
    visitDate: Date
  ): Date {
    const today = new Date(visitDate);
    today.setHours(0, 0, 0, 0);

    // Baseline CD4 if no test
    if (!lastCd4Date) {
      const nextDate = new Date(today);
      nextDate.setDate(nextDate.getDate() + 7);
      return nextDate;
    }

    // After ART start: every 6 months for first year, then annually if CD4 >350
    if (artStartDate) {
      const artStart = new Date(artStartDate);
      artStart.setHours(0, 0, 0, 0);
      const daysSinceArtStart = Math.floor((today.getTime() - artStart.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceArtStart < 365) {
        // First year: every 6 months
        const lastCd4 = new Date(lastCd4Date);
        lastCd4.setHours(0, 0, 0, 0);
        const daysSinceLastCd4 = Math.floor((today.getTime() - lastCd4.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastCd4 < 180) {
          const nextDate = new Date(today);
          nextDate.setMonth(nextDate.getMonth() + (180 - daysSinceLastCd4) / 30);
          return nextDate;
        }
      } else {
        // After first year: annually if CD4 >350
        if (lastCd4Count && lastCd4Count > 350) {
          const nextDate = new Date(today);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          return nextDate;
        } else {
          // CD4 <=350: every 6 months
          const nextDate = new Date(today);
          nextDate.setMonth(nextDate.getMonth() + 6);
          return nextDate;
        }
      }
    }

    // Default: 6 months
    const nextDate = new Date(today);
    nextDate.setMonth(nextDate.getMonth() + 6);
    return nextDate;
  }

  /**
   * Check if patient has treatment failure
   */
  checkTreatmentFailure(
    arvStatus: string,
    viralLoad: number | null,
    viralLoadDate: Date | null,
    cd4Count: number | null,
    cd4Date: Date | null,
    visitDate: Date
  ): {
    isTreatmentFailure: boolean;
    reason: string | null;
    severity: 'high' | 'critical';
  } {
    // Patient must be on ART
    if (!['2a', '2b', '3', '4', '6'].includes(arvStatus)) {
      return { isTreatmentFailure: false, reason: null, severity: 'high' };
    }

    // VL >1000 copies/mL on ART = treatment failure
    if (viralLoad !== null && viralLoad > 1000) {
      return {
        isTreatmentFailure: true,
        reason: `High viral load (${viralLoad.toLocaleString()} copies/mL) on ART - Treatment failure`,
        severity: 'critical'
      };
    }

    // Declining CD4 despite ART
    if (cd4Count !== null && cd4Count < 200) {
      return {
        isTreatmentFailure: true,
        reason: `Low CD4 count (${cd4Count} cells/mm³) on ART - Possible treatment failure`,
        severity: 'high'
      };
    }

    return { isTreatmentFailure: false, reason: null, severity: 'high' };
  }

  /**
   * Calculate adherence percentage from pill count
   */
  calculateAdherenceFromPillCount(
    pillsDispensed: number,
    pillsReturned: number,
    daysBetweenVisits: number
  ): number {
    if (!pillsDispensed || pillsDispensed === 0) return 0;

    const pillsTaken = pillsDispensed - (pillsReturned || 0);
    const expectedPills = daysBetweenVisits; // Assuming 1 pill per day
    const adherence = (pillsTaken / expectedPills) * 100;

    return Math.min(100, Math.max(0, Math.round(adherence)));
  }

  /**
   * Check if patient is at risk of LTFU
   */
  checkLTFURisk(
    lastVisitDate: Date | null,
    nextReviewDate: Date | null,
    visitDate: Date
  ): {
    isAtRisk: boolean;
    daysSinceLastVisit: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const today = new Date(visitDate);
    today.setHours(0, 0, 0, 0);

    if (!lastVisitDate) {
      return { isAtRisk: false, daysSinceLastVisit: 0, riskLevel: 'low' };
    }

    const lastVisit = new Date(lastVisitDate);
    lastVisit.setHours(0, 0, 0, 0);
    const daysSinceLastVisit = Math.floor((today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));

    // Check if overdue for next review
    if (nextReviewDate) {
      const nextReview = new Date(nextReviewDate);
      nextReview.setHours(0, 0, 0, 0);
      const daysOverdue = Math.floor((today.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 90) {
        return { isAtRisk: true, daysSinceLastVisit, riskLevel: 'critical' };
      } else if (daysOverdue > 60) {
        return { isAtRisk: true, daysSinceLastVisit, riskLevel: 'high' };
      } else if (daysOverdue > 30) {
        return { isAtRisk: true, daysSinceLastVisit, riskLevel: 'medium' };
      }
    }

    // General LTFU risk based on days since last visit
    if (daysSinceLastVisit > 90) {
      return { isAtRisk: true, daysSinceLastVisit, riskLevel: 'critical' };
    } else if (daysSinceLastVisit > 60) {
      return { isAtRisk: true, daysSinceLastVisit, riskLevel: 'high' };
    } else if (daysSinceLastVisit > 45) {
      return { isAtRisk: true, daysSinceLastVisit, riskLevel: 'medium' };
    }

    return { isAtRisk: false, daysSinceLastVisit, riskLevel: 'low' };
  }
}

