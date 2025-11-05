import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LabOrder } from '../entities/lab-order.entity';

@Injectable()
export class LabResultsMatchingService {
  /**
   * Find matching viral load results for a visit date
   * Logic:
   * Once lab results are released/reviewed, they should be available for ANY subsequent visit.
   * Show the most recent released results that haven't been used yet.
   */
  async findMatchingViralLoad(
    patientId: string,
    visitDate: Date,
    tenantDb: DataSource
  ): Promise<{
    viralLoad: number | null;
    viralLoadUnit: string;
    viralLoadTestDate: Date | null;
    viralLoadSuppressed: boolean | null;
    source: 'lab_system' | 'manual' | null;
    labOrderId: string | null;
    matchedBy: 'collection_date' | 'release_date' | null;
  }> {
    try {
      // Get all completed lab orders for this patient with viral load tests
      // Only include orders that have been reviewed/released (reviewed_at is not null)
      // We'll check the results array for viral load tests, not the order-level test_name/test_code
      const labOrders = await tenantDb.query(
        `SELECT 
          id, 
          collected_at, 
          reviewed_at, 
          results,
          created_at,
          test_name,
          test_code,
          tests
        FROM lab_orders
        WHERE patient_id = $1
        AND status = 'completed'
        AND results IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND (
          -- Check if results array contains viral load
          results::text ILIKE '%viral%'
          OR results::text ILIKE '%VL%'
          OR results::text ILIKE '%hiv rna%'
          OR results::text ILIKE '%hivrna%'
          -- Also check tests array (for orders with multiple tests)
          OR tests::text ILIKE '%viral load%'
          OR tests::text ILIKE '%VL%'
          OR tests::text ILIKE '%HIV RNA%'
          -- Or check order-level test name/code (for single-test orders)
          OR test_name ILIKE '%viral load%' 
          OR test_name ILIKE '%VL%' 
          OR test_name ILIKE '%HIV RNA%'
          OR test_code ILIKE '%VL%'
          OR test_code ILIKE '%HIVRNA%'
        )
        ORDER BY reviewed_at DESC NULLS LAST
        LIMIT 20`,
        [patientId]
      );

      console.log(`[LabResultsMatching] Found ${labOrders?.length || 0} lab orders for patient ${patientId}`);
      
      if (!labOrders || labOrders.length === 0) {
        console.log(`[LabResultsMatching] No lab orders found for patient ${patientId}`);
        return {
          viralLoad: null,
          viralLoadUnit: 'copies/mL',
          viralLoadTestDate: null,
          viralLoadSuppressed: null,
          source: null,
          labOrderId: null,
          matchedBy: null
        };
      }

      const visitDateObj = new Date(visitDate);
      visitDateObj.setHours(0, 0, 0, 0);

      // Find the most recent released result that hasn't been used yet
      // Results are available for ONLY ONE visit after they are released
      // Once saved in a visit, they won't appear again until a new result is released
      for (const order of labOrders) {
        console.log(`[LabResultsMatching] Checking order ${order.id}, results:`, JSON.stringify(order.results));
        const results = order.results || [];
        const vlResult = this.extractViralLoadFromResults(results);
        
        if (!vlResult) {
          console.log(`[LabResultsMatching] No viral load found in order ${order.id}`);
          continue;
        }
        
        console.log(`[LabResultsMatching] Found VL result: ${vlResult.value} ${vlResult.unit}`);

        const reviewedAt = order.reviewed_at ? new Date(order.reviewed_at) : null;
        
        if (!reviewedAt) continue; // Skip if not reviewed/released yet

        const reviewedDate = new Date(reviewedAt);
        reviewedDate.setHours(0, 0, 0, 0);
        
        // Results released on or before visit date are available for this visit
        if (reviewedDate <= visitDateObj) {
          // Check if this result hasn't been used in ANY visit yet
          // Once used, it won't be available for subsequent visits
          const alreadyUsed = await this.isResultAlreadyUsed(
            patientId,
            order.id,
            visitDateObj,
            tenantDb
          );
          
          if (!alreadyUsed) {
            // This is the most recent unused result - return it
            return {
              viralLoad: vlResult.value,
              viralLoadUnit: vlResult.unit || 'copies/mL',
              viralLoadTestDate: reviewedAt,
              viralLoadSuppressed: vlResult.value < 1000,
              source: 'lab_system',
              labOrderId: order.id,
              matchedBy: 'release_date'
            };
          }
          // If already used, continue to check next result (in case there are multiple)
        }
      }

      // No matching results found
      return {
        viralLoad: null,
        viralLoadUnit: 'copies/mL',
        viralLoadTestDate: null,
        viralLoadSuppressed: null,
        source: null,
        labOrderId: null,
        matchedBy: null
      };
    } catch (error) {
      console.error('Error finding matching viral load:', error);
      return {
        viralLoad: null,
        viralLoadUnit: 'copies/mL',
        viralLoadTestDate: null,
        viralLoadSuppressed: null,
        source: null,
        labOrderId: null,
        matchedBy: null
      };
    }
  }

  /**
   * Extract viral load value from lab order results
   */
  private extractViralLoadFromResults(results: any[]): { value: number; unit: string } | null {
    if (!Array.isArray(results)) return null;

    for (const result of results) {
      const testName = (result.testName || '').toLowerCase();
      const testCode = (result.testCode || '').toLowerCase();
      
      // Check if this is a viral load test
      if (
        testName.includes('viral load') ||
        testName.includes('vl') ||
        testName.includes('hiv rna') ||
        testCode.includes('vl') ||
        testCode.includes('hivrna')
      ) {
        const value = parseFloat(result.value);
        if (!isNaN(value) && value > 0) {
          return {
            value: value,
            unit: result.unit || 'copies/mL'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a lab result has already been used in ANY visit
   * Once a result is saved in a visit, it should not be available for subsequent visits
   */
  private async isResultAlreadyUsed(
    patientId: string,
    labOrderId: string,
    currentVisitDate: Date,
    tenantDb: DataSource
  ): Promise<boolean> {
    try {
      // Get the lab order details to match by value and date
      const labOrder = await tenantDb.query(
        `SELECT results, reviewed_at FROM lab_orders WHERE id = $1`,
        [labOrderId]
      );
      
      if (!labOrder || labOrder.length === 0) return false;
      
      const orderResults = labOrder[0].results || [];
      const vlResult = this.extractViralLoadFromResults(orderResults);
      
      if (!vlResult) return false;
      
      const reviewedAt = labOrder[0].reviewed_at;
      if (!reviewedAt) return false;
      
      // Check if there's any visit for this patient that has:
      // 1. The same viral load value (within reasonable tolerance for floating point)
      // 2. A test date that matches the reviewed_at date
      // This means the result was already saved in a visit
      const result = await tenantDb.query(
        `SELECT COUNT(*) as count
         FROM hiv_clinical_visits v
         JOIN hiv_care_enrollments e ON v.enrollment_id = e.id
         WHERE e.patient_id = $1
         AND v.viral_load IS NOT NULL
         AND v.viral_load_test_date IS NOT NULL
         AND ABS(v.viral_load - $2) < 0.01
         AND DATE(v.viral_load_test_date) = DATE($3)`,
        [patientId, vlResult.value, reviewedAt]
      );
      
      // If count > 0, this result has already been used in a visit
      return parseInt(result[0]?.count || '0') > 0;
    } catch (error) {
      console.error('Error checking if result already used:', error);
      return false;
    }
  }

  /**
   * Find if there's a visit on a specific date
   */
  private async findVisitOnDate(
    patientId: string,
    date: Date,
    tenantDb: DataSource
  ): Promise<boolean> {
    try {
      const result = await tenantDb.query(
        `SELECT COUNT(*) as count
         FROM hiv_clinical_visits v
         JOIN hiv_care_enrollments e ON v.enrollment_id = e.id
         WHERE e.patient_id = $1
         AND v.visit_date = $2`,
        [patientId, date.toISOString().split('T')[0]]
      );
      
      return parseInt(result[0]?.count || '0') > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find matching viral load for EAC session
   * Similar logic but for EAC session dates
   */
  async findMatchingViralLoadForEac(
    patientId: string,
    sessionDate: Date,
    tenantDb: DataSource
  ): Promise<{
    viralLoad: number | null;
    viralLoadUnit: string;
    viralLoadTestDate: Date | null;
    viralLoadSuppressed: boolean | null;
    source: 'lab_system' | 'manual' | null;
    labOrderId: string | null;
  }> {
    // Use the same logic as visit matching
    const result = await this.findMatchingViralLoad(patientId, sessionDate, tenantDb);
    return {
      viralLoad: result.viralLoad,
      viralLoadUnit: result.viralLoadUnit,
      viralLoadTestDate: result.viralLoadTestDate,
      viralLoadSuppressed: result.viralLoadSuppressed,
      source: result.source,
      labOrderId: result.labOrderId
    };
  }
}

