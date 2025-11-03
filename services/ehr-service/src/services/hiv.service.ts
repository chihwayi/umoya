import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';

@Injectable()
export class HivService {
  private readonly logger = new Logger(HivService.name);
  private readonly cdssUrl = process.env.CDSS_SERVICE_URL || 'http://cdss-service:8000';

  async createHivTest(body: any, tenantDb: DataSource) {
    const { patientId, testKitName, testResult, testKitLot, testKitExpiry, notes, testedBy } = body;
    
    // Generate test number
    const testNumber = `HIV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await tenantDb.query(`
      INSERT INTO hiv_tests (
        patient_id, test_number, test_date, test_type, test_kit_name, 
        test_kit_lot, test_kit_expiry, test_result, tested_by, notes, testing_algorithm_step
      ) VALUES ($1, $2, NOW(), 'rapid_antibody', $3, $4, $5, $6, $7, $8, 1)
      RETURNING *
    `, [patientId, testNumber, testKitName, testKitLot, testKitExpiry, testResult, testedBy, notes]);
    
    // Process algorithm
    const algorithmResult = await this.processTestingAlgorithm(result[0].id, tenantDb);
    
    return { test: result[0], algorithm: algorithmResult };
  }

  async processTestingAlgorithm(testId: string, tenantDb: DataSource) {
    // Get all tests for this patient
    const test = await tenantDb.query('SELECT * FROM hiv_tests WHERE id = $1', [testId]);
    if (!test[0]) throw new NotFoundException('Test not found');
    
    const patientId = test[0].patient_id;
    const allTests = await tenantDb.query(
      'SELECT * FROM hiv_tests WHERE patient_id = $1 ORDER BY test_date ASC',
      [patientId]
    );
    
    // Send to CDSS algorithm
    try {
      const response = await axios.post(`${this.cdssUrl}/hiv/testing/algorithm`, {
        tests: allTests.map(t => ({
          test_kit_name: t.test_kit_name,
          test_result: t.test_result,
          test_date: t.test_date,
          tested_by: t.tested_by
        }))
      }, { timeout: 10000 });
      
      const algorithmData = response.data;
      
      // Update test with algorithm result
      await tenantDb.query(
        `UPDATE hiv_tests SET algorithm_result = $1, updated_at = NOW() WHERE id = $2`,
        [algorithmData.algorithm_result, testId]
      );
      
      return algorithmData;
    } catch (error) {
      this.logger.warn('CDSS algorithm unavailable, using basic logic');
      // Basic fallback
      const testResult = test[0].test_result;
      let algorithmResult = 'incomplete';
      if (testResult === 'non_reactive') algorithmResult = 'negative';
      if (testResult === 'reactive' && allTests.length === 1) algorithmResult = 'incomplete';
      if (allTests.length >= 2) {
        const reactiveCount = allTests.filter(t => t.test_result === 'reactive').length;
        if (reactiveCount >= 2) algorithmResult = 'positive';
        else if (allTests[0].test_result === 'non_reactive') algorithmResult = 'negative';
        else algorithmResult = 'indeterminate';
      }
      
      await tenantDb.query(
        `UPDATE hiv_tests SET algorithm_result = $1 WHERE id = $2`,
        [algorithmResult, testId]
      );
      
      return { algorithm_result: algorithmResult, confidence: 'low', next_step: 'Continue testing' };
    }
  }

  async getPatientHivTests(patientId: string, tenantDb: DataSource) {
    const tests = await tenantDb.query(
      'SELECT * FROM hiv_tests WHERE patient_id = $1 ORDER BY test_date DESC',
      [patientId]
    );
    return { tests };
  }

  async enrollInCare(body: any, tenantDb: DataSource) {
    const { patientId, enrollmentDate, dateConfirmedPositive, baselineCd4, baselineViralLoad, createdBy } = body;
    const enrollmentNumber = `ENR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const result = await tenantDb.query(`
      INSERT INTO hiv_care_enrollments (
        patient_id, enrollment_date, enrollment_number, date_confirmed_positive,
        baseline_cd4, baseline_viral_load, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [patientId, enrollmentDate || new Date().toISOString().split('T')[0], enrollmentNumber, 
        dateConfirmedPositive, baselineCd4, baselineViralLoad, createdBy]);
    
    // Update test enrollment status
    await tenantDb.query(
      `UPDATE hiv_tests SET enrolled_in_care = true WHERE patient_id = $1`,
      [patientId]
    );
    
    return result[0];
  }

  async getEnrollments(query: any, tenantDb: DataSource) {
    const status = query.status || 'active';
    const enrollments = await tenantDb.query(
      `SELECT e.*, p.first_name, p.last_name, p.patient_number 
       FROM hiv_care_enrollments e
       JOIN patients p ON e.patient_id = p.id
       WHERE e.enrollment_status = $1
       ORDER BY e.enrollment_date DESC`,
      [status]
    );
    return { enrollments };
  }

  async getPatientEnrollment(patientId: string, tenantDb: DataSource) {
    const result = await tenantDb.query(
      `SELECT * FROM hiv_care_enrollments WHERE patient_id = $1 AND enrollment_status = 'active' ORDER BY enrollment_date DESC LIMIT 1`,
      [patientId]
    );
    return result[0] || null;
  }

  async getEnrollmentById(enrollmentId: string, tenantDb: DataSource) {
    const result = await tenantDb.query(
      `SELECT * FROM hiv_care_enrollments WHERE id = $1`,
      [enrollmentId]
    );
    if (!result[0]) throw new NotFoundException('Enrollment not found');
    return result[0];
  }

  async createClinicalVisit(body: any, tenantDb: DataSource) {
    const { enrollmentId, visitDate, visitType, providerId, cd4Count, viralLoad, adherence, notes } = body;
    
    const result = await tenantDb.query(`
      INSERT INTO hiv_clinical_visits (
        enrollment_id, visit_date, visit_type, provider_id, cd4_count,
        viral_load, adherence_percentage, visit_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [enrollmentId, visitDate, visitType, providerId, cd4Count, viralLoad, adherence, notes]);
    
    return result[0];
  }

  async getClinicalVisits(enrollmentId: string, tenantDb: DataSource) {
    const visits = await tenantDb.query(
      `SELECT * FROM hiv_clinical_visits WHERE enrollment_id = $1 ORDER BY visit_date DESC`,
      [enrollmentId]
    );
    return { visits };
  }

  async createTbScreening(body: any, tenantDb: DataSource) {
    const { patientId, screeningDate, screeningType, screeningResult, symptoms, screenedBy, notes } = body;
    
    const result = await tenantDb.query(`
      INSERT INTO tb_screenings (
        patient_id, screening_date, screening_type, screening_result,
        symptom_cough, symptom_fever, symptom_night_sweats, symptom_weight_loss,
        screened_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [patientId, screeningDate, screeningType, screeningResult,
        symptoms?.cough || false, symptoms?.fever || false, 
        symptoms?.nightSweats || false, symptoms?.weightLoss || false,
        screenedBy, notes]);
    
    return result[0];
  }

  async createCervicalCancerScreening(body: any, tenantDb: DataSource) {
    const { patientId, screeningDate, screeningMethod, screeningResult, screenedBy, notes } = body;
    
    const result = await tenantDb.query(`
      INSERT INTO cervical_cancer_screenings (
        patient_id, screening_date, screening_method, screening_result, screened_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [patientId, screeningDate, screeningMethod, screeningResult, screenedBy, notes]);
    
    return result[0];
  }
}
