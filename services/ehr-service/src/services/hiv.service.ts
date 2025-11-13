import { Injectable, Logger, NotFoundException, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { LabResultsMatchingService } from './lab-results-matching.service';
import { HivMonitoringService } from './hiv-monitoring.service';
import { HivQualityMetricsService } from './hiv-quality-metrics.service';
import { HivVisitTemplatesService } from './hiv-visit-templates.service';
import { HivTptTrackerService } from './hiv-tpt-tracker.service';
import { HivPediatricDosingService } from './hiv-pediatric-dosing.service';
import { AppointmentService } from './appointment.service';
import { TenantService } from './tenant.service';

@Injectable()
export class HivService {
  private readonly logger = new Logger(HivService.name);
  private readonly cdssUrl = process.env.CDSS_SERVICE_URL || 'http://cdss-service:8000';
  
  constructor(
    private labResultsMatchingService: LabResultsMatchingService,
    private monitoringService: HivMonitoringService,
    private qualityMetricsService: HivQualityMetricsService,
    private visitTemplatesService: HivVisitTemplatesService,
    private tptTrackerService: HivTptTrackerService,
    private pediatricDosingService: HivPediatricDosingService,
    @Inject(forwardRef(() => AppointmentService))
    private appointmentService: AppointmentService,
    private tenantService: TenantService
  ) {}

  private hydrateNurseIntake(row: any) {
    if (!row) {
      return null;
    }

    let form = row.form ?? {};
    if (typeof form === 'string') {
      try {
        form = JSON.parse(form);
      } catch {
        form = {};
      }
    }

    let vitals = row.vitals ?? {};
    if (typeof vitals === 'string') {
      try {
        vitals = JSON.parse(vitals);
      } catch {
        vitals = {};
      }
    }

    return {
      ...row,
      form,
      vitals,
    };
  }

  async saveNurseIntake(body: any, tenantDb: DataSource, userId?: string) {
    const { patientId, appointmentId, intakeDate, form, vitals, adherencePercentage, regimen } = body;

    if (!patientId) {
      throw new BadRequestException('patientId is required');
    }

    const normalizedForm = typeof form === 'string' ? (() => {
      try {
        return JSON.parse(form);
      } catch {
        return {};
      }
    })() : form ?? {};

    const normalizedVitals = typeof vitals === 'string' ? (() => {
      try {
        return JSON.parse(vitals);
      } catch {
        return {};
      }
    })() : vitals ?? {};

    const intakeDateValue = intakeDate ? new Date(intakeDate) : null;
    const adherenceValue = typeof adherencePercentage === 'number' ? adherencePercentage : null;

    let existing: any = null;
    if (appointmentId) {
      const rows = await tenantDb.query(
        `SELECT * FROM hiv_nurse_intakes WHERE appointment_id = $1 LIMIT 1`,
        [appointmentId],
      );
      existing = rows[0] || null;
    }

    if (existing) {
      const [updated] = await tenantDb.query(
        `
        UPDATE hiv_nurse_intakes
        SET form = $1::jsonb,
            vitals = $2::jsonb,
            adherence_percentage = $3,
            regimen = $4,
            intake_date = COALESCE($5::date, intake_date),
            recorded_by = COALESCE($6::uuid, recorded_by),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
        [
          JSON.stringify(normalizedForm),
          JSON.stringify(normalizedVitals),
          adherenceValue,
          regimen || null,
          intakeDateValue ? intakeDateValue.toISOString() : null,
          userId || null,
          existing.id,
        ],
      );
      return this.hydrateNurseIntake(updated);
    }

    const [inserted] = await tenantDb.query(
      `
      INSERT INTO hiv_nurse_intakes (
        patient_id,
        appointment_id,
        recorded_by,
        intake_date,
        form,
        vitals,
        adherence_percentage,
        regimen
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
      RETURNING *
    `,
      [
        patientId,
        appointmentId || null,
        userId || null,
        intakeDateValue ? intakeDateValue.toISOString() : null,
        JSON.stringify(normalizedForm),
        JSON.stringify(normalizedVitals),
        adherenceValue,
        regimen || null,
      ],
    );

    return this.hydrateNurseIntake(inserted);
  }

  async getNurseIntakesByPatient(patientId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `
      SELECT *
      FROM hiv_nurse_intakes
      WHERE patient_id = $1
      ORDER BY recorded_at DESC
    `,
      [patientId],
    );

    return {
      intakes: rows.map((row: any) => this.hydrateNurseIntake(row)),
    };
  }

  async getNurseIntakeByAppointment(appointmentId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `
      SELECT *
      FROM hiv_nurse_intakes
      WHERE appointment_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
      [appointmentId],
    );

    return {
      intake: this.hydrateNurseIntake(rows[0]),
    };
  }

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
    const { patientId, enrollmentDate, dateConfirmedPositive, baselineCd4, baselineViralLoad, baselineClinicalStage, baselineWhoStage, enrollmentNotes, createdBy } = body;
    const enrollmentNumber = `ENR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const result = await tenantDb.query(`
      INSERT INTO hiv_care_enrollments (
        patient_id, enrollment_date, enrollment_number, date_confirmed_positive,
        baseline_cd4, baseline_viral_load, baseline_clinical_stage, baseline_who_stage, enrollment_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [patientId, enrollmentDate || new Date().toISOString().split('T')[0], enrollmentNumber, 
        dateConfirmedPositive, baselineCd4, baselineViralLoad, baselineClinicalStage, baselineWhoStage, enrollmentNotes, createdBy]);
    
    // Update test enrollment status
    await tenantDb.query(
      `UPDATE hiv_tests SET enrolled_in_care = true WHERE patient_id = $1`,
      [patientId]
    );
    
    return result[0];
  }

  async saveArtInitiationDetails(body: any, tenantDb: DataSource) {
    const {
      patientId,
      enrollmentId,
      oiArtNumber,
      dateOfRegistration,
      nameOfRegistrationHealthCentre,
      ageAtRegistration,
      sexAssignedAtBirth,
      // Marital Status
      maritalStatusMarried,
      maritalStatusNeverMarried,
      maritalStatusWidowed,
      maritalStatusDivorcedSeparated,
      maritalStatusLivingTogether,
      maritalStatusMinor,
      // Patient Profile
      patientProfileGeneralPopulation,
      patientProfileSexWorker,
      patientProfileMsm,
      patientProfileWsw,
      patientProfilePwud,
      patientProfilePwid,
      patientProfileTransgender,
      patientProfileOthers,
      patientProfileOthersDetails,
      // Education
      educationLevel,
      // Contact Information
      physicalAddress,
      kraal,
      village,
      school,
      clinic,
      telephone,
      cellphone,
      workAddress,
      workTelephone,
      occupation,
      // Next of Kin
      nextOfKinName,
      // Linkage Information
      linkageFromEid,
      linkageFromHts,
      linkageFromPmtct,
      linkageFromSti,
      linkageFromTbProgram,
      linkageFromVmmc,
      linkageFromOther,
      linkageFromOtherDetails,
      // Orphan Status
      orphanStatusDouble,
      orphanStatusSingle,
      orphanStatusNotOrphan,
      // HIV Test Details
      dateFirstConfirmedHivTest,
      institutionNameVctPmtct,
      hivTestUsedAntibody,
      hivTestUsedPcr,
      // Reason for HIV Test
      reasonHivTestAntenatal,
      reasonHivTestPep,
      reasonHivTestDeathChildSpouse,
      reasonHivTestPrep,
      reasonHivTestHospitalIllness,
      reasonHivTestSpouseChildLt5Art,
      reasonHivTestOccupational,
      reasonHivTestTb,
      reasonHivTestVct,
      reasonHivTestOthers,
      reasonHivTestOthersDetails,
      // Confirmatory and Retesting
      confirmatoryHivTest,
      retestingHivForArtInitiation,
      // Medical Insurance
      medicalInsuranceSchemeName,
      medicalInsurancePolicyNumber,
      medicalInsuranceMemberName,
      medicalInsuranceRelationshipToMember,
      // Consent/Assent
      consentPersonalTracing,
      consentPersonalTracingDate,
      consentIndexCaseTesting,
      consentIndexCaseTestingDate,
      disclosureHivStatus,
      disclosureHivStatusToWhom,
      disclosureHivStatusFinalDate,
      disclosureHivStatusFinalToWhom
    } = body;

    const result = await tenantDb.query(`
      INSERT INTO hiv_art_initiation_details (
        patient_id, enrollment_id, oi_art_number, date_of_registration, name_of_registration_health_centre,
        age_at_registration, sex_assigned_at_birth,
        marital_status_married, marital_status_never_married, marital_status_widowed,
        marital_status_divorced_separated, marital_status_living_together, marital_status_minor,
        patient_profile_general_population, patient_profile_sex_worker, patient_profile_msm,
        patient_profile_wsw, patient_profile_pwud, patient_profile_pwid, patient_profile_transgender,
        patient_profile_others, patient_profile_others_details,
        education_level,
        physical_address, kraal, village, school, clinic, telephone, cellphone,
        work_address, work_telephone, occupation,
        next_of_kin_name,
        linkage_from_eid, linkage_from_hts, linkage_from_pmtct, linkage_from_sti,
        linkage_from_tb_program, linkage_from_vmmc, linkage_from_other, linkage_from_other_details,
        orphan_status_double, orphan_status_single, orphan_status_not_orphan,
        date_first_confirmed_hiv_test, institution_name_vct_pmtct,
        hiv_test_used_antibody, hiv_test_used_pcr,
        reason_hiv_test_antenatal, reason_hiv_test_pep, reason_hiv_test_death_child_spouse,
        reason_hiv_test_prep, reason_hiv_test_hospital_illness, reason_hiv_test_spouse_child_lt5_art,
        reason_hiv_test_occupational, reason_hiv_test_tb, reason_hiv_test_vct,
        reason_hiv_test_others, reason_hiv_test_others_details,
        confirmatory_hiv_test, retesting_hiv_for_art_initiation,
        medical_insurance_scheme_name, medical_insurance_policy_number,
        medical_insurance_member_name, medical_insurance_relationship_to_member,
        consent_personal_tracing, consent_personal_tracing_date,
        consent_index_case_testing, consent_index_case_testing_date,
        disclosure_hiv_status, disclosure_hiv_status_to_whom,
        disclosure_hiv_status_final_date, disclosure_hiv_status_final_to_whom
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
        $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65,
        $66, $67, $68, $69, $70, $71, $72, $73, $74
      )
      RETURNING *
    `, [
      patientId, enrollmentId, 
      (oiArtNumber && oiArtNumber.trim() !== '') ? oiArtNumber : null, 
      dateOfRegistration, 
      (nameOfRegistrationHealthCentre && nameOfRegistrationHealthCentre.trim() !== '') ? nameOfRegistrationHealthCentre : null,
      (ageAtRegistration && ageAtRegistration.toString().trim() !== '') ? (isNaN(parseInt(ageAtRegistration)) ? null : parseInt(ageAtRegistration)) : null, 
      (sexAssignedAtBirth && sexAssignedAtBirth.trim() !== '') ? sexAssignedAtBirth : null,
      maritalStatusMarried || false, maritalStatusNeverMarried || false, maritalStatusWidowed || false,
      maritalStatusDivorcedSeparated || false, maritalStatusLivingTogether || false, maritalStatusMinor || false,
      patientProfileGeneralPopulation || false, patientProfileSexWorker || false, patientProfileMsm || false,
      patientProfileWsw || false, patientProfilePwud || false, patientProfilePwid || false, patientProfileTransgender || false,
      patientProfileOthers || false, 
      (patientProfileOthersDetails && patientProfileOthersDetails.trim() !== '') ? patientProfileOthersDetails : null,
      (educationLevel && educationLevel.trim() !== '') ? educationLevel : null,
      (physicalAddress && physicalAddress.trim() !== '') ? physicalAddress : null, 
      (kraal && kraal.trim() !== '') ? kraal : null, 
      (village && village.trim() !== '') ? village : null, 
      (school && school.trim() !== '') ? school : null, 
      (clinic && clinic.trim() !== '') ? clinic : null, 
      (telephone && telephone.trim() !== '') ? telephone : null, 
      (cellphone && cellphone.trim() !== '') ? cellphone : null,
      (workAddress && workAddress.trim() !== '') ? workAddress : null, 
      (workTelephone && workTelephone.trim() !== '') ? workTelephone : null, 
      (occupation && occupation.trim() !== '') ? occupation : null,
      (nextOfKinName && nextOfKinName.trim() !== '') ? nextOfKinName : null,
      linkageFromEid || false, linkageFromHts || false, linkageFromPmtct || false, linkageFromSti || false,
      linkageFromTbProgram || false, linkageFromVmmc || false, linkageFromOther || false, 
      (linkageFromOtherDetails && linkageFromOtherDetails.trim() !== '') ? linkageFromOtherDetails : null,
      orphanStatusDouble || false, orphanStatusSingle || false, orphanStatusNotOrphan || false,
      dateFirstConfirmedHivTest || null, 
      (institutionNameVctPmtct && institutionNameVctPmtct.trim() !== '') ? institutionNameVctPmtct : null,
      hivTestUsedAntibody || false, hivTestUsedPcr || false,
      reasonHivTestAntenatal || false, reasonHivTestPep || false, reasonHivTestDeathChildSpouse || false,
      reasonHivTestPrep || false, reasonHivTestHospitalIllness || false, reasonHivTestSpouseChildLt5Art || false,
      reasonHivTestOccupational || false, reasonHivTestTb || false, reasonHivTestVct || false,
      reasonHivTestOthers || false, 
      (reasonHivTestOthersDetails && reasonHivTestOthersDetails.trim() !== '') ? reasonHivTestOthersDetails : null,
      confirmatoryHivTest || false, retestingHivForArtInitiation || false,
      (medicalInsuranceSchemeName && medicalInsuranceSchemeName.trim() !== '') ? medicalInsuranceSchemeName : null, 
      (medicalInsurancePolicyNumber && medicalInsurancePolicyNumber.trim() !== '') ? medicalInsurancePolicyNumber : null,
      (medicalInsuranceMemberName && medicalInsuranceMemberName.trim() !== '') ? medicalInsuranceMemberName : null, 
      (medicalInsuranceRelationshipToMember && medicalInsuranceRelationshipToMember.trim() !== '') ? medicalInsuranceRelationshipToMember : null,
      consentPersonalTracing || false, consentPersonalTracingDate || null,
      consentIndexCaseTesting || false, consentIndexCaseTestingDate || null,
      (disclosureHivStatus && disclosureHivStatus.trim() !== '') ? disclosureHivStatus : null, 
      (disclosureHivStatusToWhom && disclosureHivStatusToWhom.trim() !== '') ? disclosureHivStatusToWhom : null,
      disclosureHivStatusFinalDate || null, 
      (disclosureHivStatusFinalToWhom && disclosureHivStatusFinalToWhom.trim() !== '') ? disclosureHivStatusFinalToWhom : null
    ]);

    return result[0];
  }

  async getEnrollments(query: any, tenantDb: DataSource) {
    const status = query.status || 'active';
    
    this.logger.debug(`getEnrollments called with status: ${status}, query:`, query);
    
    // Build query based on status filter
    let querySql = `
      SELECT 
        e.*, 
        p.first_name, 
        p.last_name, 
        p.patient_number, 
        p.gender, 
        p.date_of_birth,
        (SELECT viral_load FROM hiv_clinical_visits WHERE enrollment_id = e.id AND viral_load IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_viral_load,
        (SELECT viral_load_test_date FROM hiv_clinical_visits WHERE enrollment_id = e.id AND viral_load IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_viral_load_date,
        (SELECT cd4_count FROM hiv_clinical_visits WHERE enrollment_id = e.id AND cd4_count IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_cd4_count,
        (SELECT cd4_test_date FROM hiv_clinical_visits WHERE enrollment_id = e.id AND cd4_count IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_cd4_date,
        (SELECT visit_date FROM hiv_clinical_visits WHERE enrollment_id = e.id ORDER BY visit_date DESC LIMIT 1) as last_visit_date,
        (SELECT arv_regimen_name FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_regimen_name IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_regimen,
        (SELECT arv_regimen_code FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_regimen_code IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_regimen_code,
        (SELECT arv_status FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_status IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as arv_status
       FROM hiv_care_enrollments e
       JOIN patients p ON e.patient_id = p.id
    `;
    
    let enrollments;
    if (status === 'all') {
      querySql += ` ORDER BY e.enrollment_date DESC`;
      this.logger.debug('Executing query (all status):', querySql);
      try {
        enrollments = await tenantDb.query(querySql);
        this.logger.debug(`Found ${enrollments.length} enrollments (all status)`);
      } catch (error) {
        this.logger.error('Error executing query for all status:', error);
        // Fallback: return all enrollments without subqueries if there's an error
        enrollments = await tenantDb.query(`
          SELECT e.*, p.first_name, p.last_name, p.patient_number, p.gender, p.date_of_birth
          FROM hiv_care_enrollments e
          JOIN patients p ON e.patient_id = p.id
          ORDER BY e.enrollment_date DESC
        `);
        this.logger.debug(`Fallback query returned ${enrollments.length} enrollments`);
      }
    } else {
      querySql += ` WHERE e.enrollment_status = $1 ORDER BY e.enrollment_date DESC`;
      this.logger.debug('Executing query (filtered status):', querySql, [status]);
      enrollments = await tenantDb.query(querySql, [status]);
      this.logger.debug(`Found ${enrollments.length} enrollments (status: ${status})`);
    }
    
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
      `SELECT 
        e.*, 
        p.first_name, 
        p.last_name, 
        p.patient_number, 
        p.gender, 
        p.date_of_birth,
        (SELECT viral_load FROM hiv_clinical_visits WHERE enrollment_id = e.id AND viral_load IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_viral_load,
        (SELECT viral_load_test_date FROM hiv_clinical_visits WHERE enrollment_id = e.id AND viral_load IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_viral_load_date,
        (SELECT cd4_count FROM hiv_clinical_visits WHERE enrollment_id = e.id AND cd4_count IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_cd4_count,
        (SELECT cd4_test_date FROM hiv_clinical_visits WHERE enrollment_id = e.id AND cd4_count IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as last_cd4_date,
        (SELECT visit_date FROM hiv_clinical_visits WHERE enrollment_id = e.id ORDER BY visit_date DESC LIMIT 1) as last_visit_date,
        (SELECT arv_regimen_name FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_regimen_name IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_regimen,
        (SELECT arv_regimen_code FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_regimen_code IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as current_regimen_code,
        (SELECT arv_status FROM hiv_clinical_visits WHERE enrollment_id = e.id AND arv_status IS NOT NULL ORDER BY visit_date DESC LIMIT 1) as arv_status
       FROM hiv_care_enrollments e
       JOIN patients p ON e.patient_id = p.id
       WHERE e.id = $1`,
      [enrollmentId]
    );
    if (!result[0]) throw new NotFoundException('Enrollment not found');
    return result[0];
  }

  async createClinicalVisit(body: any, tenantDb: DataSource, providerRole?: string, tenantId?: string) {
    const {
      enrollmentId, visitDate, visitType, providerId, providerName,
      // Vital Signs
      weightKg, heightCm, bmi, bloodPressure,
      // Reproductive Health
      pregnancyLactatingStatus, firstAncBookingDate, deliveryDate, familyPlanningStatus,
      // Clinical Status
      functionalStatus, whoClinicalStage, opportunisticInfections,
      // TB Status
      tbScreening, tbInvestigationResult, tbDiagnosed, tbDiagnosisDate, tbTreatmentStarted,
      // TPT
      iptEligibility, tptStatus, tptNotStartedStoppedReason, tptQuantityDispensed, tptAdherencePercentage,
      // Prophylaxis
      cotrimoxazoleQuantityDispensed, cotrimoxazoleAdherencePercentage,
      fluconazoleQuantityPrescribed, fluconazoleQuantityDispensed,
      // ARV Status & Regimens
      arvStatus, arvReason, arvRegimenCode, arvRegimenName,
      arvQuantityPrescribed, arvQuantityDispensed, arvAdherencePercentage,
      regimenChanged, regimenChangeApprovedBy,
      // Lab Results
      cd4Count, cd4Percentage, cd4TestDate,
      viralLoad, viralLoadUnit, viralLoadTestDate, viralLoadSuppressed,
      altResult, creatinineResult, otherDiagnostics,
      // Adverse Events
      adverseEventsStatus,
      // Referrals & Follow-up
      referredTo, referredToDetails, nextReviewDate,
      visitStatus, followUpStatus, followUpDetails,
      // Notes
      visitNotes, clinicianInitials, pharmacyDispenserInitials
    } = body;

    // Role-based validation for regimen changes
    // For status '4' (Change), check if there's an approved change request
    let finalRegimenChangeApprovedBy = regimenChangeApprovedBy || null;
    let finalRegimenChangeApprovedAt = null;
    let approvedChangeRequestId = null; // Store ID to mark as recorded after visit insert
    let approvedChange: any = null; // Store approved change for audit logging
    
    if (arvStatus === '4') {
      if (providerRole !== 'doctor') {
        // Check if there's an approved change request for this enrollment
        approvedChange = await this.getApprovedArvChangeForEnrollment(enrollmentId, tenantDb);
        if (!approvedChange) {
          throw new Error('Regimen change requires doctor approval. Please ensure a doctor has approved the regimen change request.');
        }
        // Use the approved regimen
        if (!arvRegimenCode || arvRegimenCode !== approvedChange.requested_regimen_code) {
          throw new Error(`Regimen must match the doctor-approved regimen: ${approvedChange.requested_regimen_name}`);
        }
        // Set the approved by and approved at
        finalRegimenChangeApprovedBy = approvedChange.approved_by || null;
        finalRegimenChangeApprovedAt = approvedChange.approval_date || new Date();
        approvedChangeRequestId = approvedChange.id; // Store ID to mark as recorded after visit insert
      } else if (providerRole === 'doctor') {
        // Doctor can directly approve, set approved_at to now
        // Get current regimen for audit logging
        const currentRegimen = await tenantDb.query(`
          SELECT arv_regimen_code, arv_regimen_name 
          FROM hiv_clinical_visits 
          WHERE enrollment_id = $1 
          ORDER BY visit_date DESC, visit_number DESC 
          LIMIT 1
        `, [enrollmentId]);
        approvedChange = currentRegimen.length > 0 ? {
          current_regimen_code: currentRegimen[0].arv_regimen_code,
          current_regimen_name: currentRegimen[0].arv_regimen_name
        } : null;
        finalRegimenChangeApprovedBy = providerId;
        finalRegimenChangeApprovedAt = new Date();
      }
    }

    // Get visit number (sequential)
    const visitCount = await tenantDb.query(
      `SELECT COUNT(*) as count FROM hiv_clinical_visits WHERE enrollment_id = $1`,
      [enrollmentId]
    );
    const visitNumber = (parseInt(visitCount[0]?.count || '0') + 1);

    // Calculate BMI if weight and height provided
    let calculatedBmi = bmi;
    if (weightKg && heightCm && !bmi) {
      const heightM = heightCm / 100;
      calculatedBmi = weightKg / (heightM * heightM);
    }

    // Validate and sanitize values with CHECK constraints
    const validTptStatuses = ['II', 'CI', 'RI', 'IS', 'HPI', 'IC', 'INI', 'NE', 'N/A'];
    const sanitizedTptStatus = (tptStatus && validTptStatuses.includes(tptStatus)) ? tptStatus : null;
    
    const validArvStatuses = ['1', '2', '2a', '2b', '3', '4', '5', '6', '7'];
    const sanitizedArvStatus = (arvStatus && validArvStatuses.includes(arvStatus)) ? arvStatus : null;
    
    const validVisitStatuses = ['E', 'OT', 'L', 'D', 'LO'];
    const sanitizedVisitStatus = (visitStatus && validVisitStatuses.includes(visitStatus)) ? visitStatus : null;
    
    const validVisitTypes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    if (!visitType || !validVisitTypes.includes(visitType)) {
      throw new Error(`Invalid visit type. Must be one of: ${validVisitTypes.join(', ')}`);
    }
    const sanitizedVisitType = visitType;

    const result = await tenantDb.query(`
      INSERT INTO hiv_clinical_visits (
        enrollment_id, visit_number, visit_date, visit_type, provider_id, provider_role,
        weight_kg, height_cm, bmi, blood_pressure,
        pregnancy_lactating_status, first_anc_booking_date, delivery_date, family_planning_status,
        functional_status, who_clinical_stage, opportunistic_infections,
        tb_screening, tb_investigation_result, tb_diagnosed, tb_diagnosis_date, tb_treatment_started,
        ipt_eligibility, tpt_status, tpt_not_started_stopped_reason, tpt_quantity_dispensed, tpt_adherence_percentage,
        cotrimoxazole_quantity_dispensed, cotrimoxazole_adherence_percentage,
        fluconazole_quantity_prescribed, fluconazole_quantity_dispensed,
        arv_status, arv_reason, arv_regimen_code, arv_regimen_name,
        arv_quantity_prescribed, arv_quantity_dispensed, arv_adherence_percentage,
        regimen_changed, regimen_change_approved_by, regimen_change_approved_at,
        cd4_count, cd4_percentage, cd4_test_date,
        viral_load, viral_load_unit, viral_load_test_date, viral_load_suppressed,
        alt_result, creatinine_result, other_diagnostics,
        adverse_events_status,
        referred_to, referred_to_details, next_review_date,
        visit_status, follow_up_status, follow_up_details,
        visit_notes, clinician_initials, pharmacy_dispenser_initials
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29,
        $30, $31,
        $32, $33, $34, $35,
        $36, $37, $38,
        $39, $40, $41,
        $42, $43, $44,
        $45, $46, $47, $48,
        $49, $50, $51,
        $52,
        $53, $54, $55,
        $56, $57, $58,
        $59, $60, $61
      )
      RETURNING *
    `, [
      enrollmentId, visitNumber, visitDate, sanitizedVisitType, providerId, providerRole,
      weightKg || null, heightCm || null, calculatedBmi || null, bloodPressure || null,
      pregnancyLactatingStatus || null, firstAncBookingDate || null, deliveryDate || null, familyPlanningStatus || null,
      functionalStatus || null, whoClinicalStage || null, opportunisticInfections || null,
      tbScreening || null, tbInvestigationResult || null, tbDiagnosed || null, tbDiagnosisDate || null, tbTreatmentStarted || null,
      iptEligibility || null, sanitizedTptStatus, tptNotStartedStoppedReason || null, tptQuantityDispensed || null, tptAdherencePercentage || null,
      cotrimoxazoleQuantityDispensed || null, cotrimoxazoleAdherencePercentage || null,
      fluconazoleQuantityPrescribed || null, fluconazoleQuantityDispensed || null,
      sanitizedArvStatus, arvReason || null, arvRegimenCode || null, arvRegimenName || null,
      arvQuantityPrescribed || null, arvQuantityDispensed || null, arvAdherencePercentage || null,
      regimenChanged || false, finalRegimenChangeApprovedBy, finalRegimenChangeApprovedAt,
      cd4Count || null, cd4Percentage || null, cd4TestDate || null,
      viralLoad || null, (viralLoadUnit && viralLoadUnit.trim() !== '' ? viralLoadUnit : 'copies/mL'), viralLoadTestDate || null, viralLoadSuppressed || null,
      altResult || null, creatinineResult || null, otherDiagnostics || null,
      adverseEventsStatus || null,
      referredTo || null, referredToDetails || null, nextReviewDate || null,
      sanitizedVisitStatus, followUpStatus || null, followUpDetails || null,
      visitNotes || null, clinicianInitials || null, pharmacyDispenserInitials || null
    ]);

    // Update enrollment with latest regimen if changed
    if (regimenChanged && arvRegimenName) {
      await tenantDb.query(
        `UPDATE hiv_care_enrollments SET current_regimen = $1, updated_at = NOW() WHERE id = $2`,
        [arvRegimenName, enrollmentId]
      );
    }
    
    // Mark the approved change request as recorded if this was a Change status visit
    if (arvStatus === '4' && approvedChangeRequestId && result[0]?.id) {
      await tenantDb.query(`
        UPDATE hiv_arv_change_requests
        SET visit_recorded = true,
            visit_recorded_date = CURRENT_DATE,
            visit_id = $1
        WHERE id = $2
      `, [result[0].id, approvedChangeRequestId]);
      
      // Log audit trail for regimen change
      await this.logAuditAction(
        'regimen_change',
        `Regimen changed from ${approvedChange?.current_regimen_name || 'N/A'} to ${arvRegimenName}`,
        enrollmentId,
        { regimenCode: approvedChange?.current_regimen_code, regimenName: approvedChange?.current_regimen_name },
        { regimenCode: arvRegimenCode, regimenName: arvRegimenName },
        providerId,
        providerName || 'Unknown',
        tenantDb
      );
    }
    
    // Log audit trail for visit creation
    if (result[0]?.id) {
      await this.logAuditAction(
        'visit_created',
        `Clinical visit #${visitNumber || 'N/A'} recorded - Type: ${visitType}`,
        enrollmentId,
        null,
        { visitId: result[0].id, visitNumber, visitType, visitDate, arvStatus, arvRegimenName },
        providerId,
        providerName || 'Unknown',
        tenantDb
      );
    }

    // ============================================
    // Post-Visit Processing: Monitoring, Alerts, Tracking
    // ============================================
    const visitId = result[0]?.id;
    const visitDateObj = new Date(visitDate);

    // 1. Update Monitoring Schedules (VL & CD4)
    if (viralLoad !== null && viralLoadTestDate) {
      const nextVlDate = this.monitoringService.calculateNextViralLoadDate(
        artStartDate,
        new Date(viralLoadTestDate),
        parseFloat(viralLoad.toString()),
        arvStatus === '4' ? visitDateObj : null, // Regimen change date
        visitDateObj
      );

      // Use UPSERT to update or create monitoring schedule
      const existingSchedule = await tenantDb.query(`
        SELECT id FROM hiv_monitoring_schedules 
        WHERE enrollment_id = $1 AND test_type = 'viral_load'
      `, [enrollmentId]);

      if (existingSchedule.length > 0) {
        await tenantDb.query(`
          UPDATE hiv_monitoring_schedules SET
          last_test_date = $1,
          last_test_result = $2,
          next_scheduled_date = $3,
          is_overdue = false,
          days_overdue = 0,
          updated_at = NOW()
          WHERE enrollment_id = $4 AND test_type = 'viral_load'
        `, [viralLoadTestDate, viralLoad, nextVlDate.toISOString().split('T')[0], enrollmentId]);
      } else {
        await tenantDb.query(`
          INSERT INTO hiv_monitoring_schedules (
            enrollment_id, test_type, last_test_date, last_test_result,
            next_scheduled_date, monitoring_frequency_months, is_overdue, days_overdue
          ) VALUES ($1, 'viral_load', $2, $3, $4, 3, false, 0)
        `, [enrollmentId, viralLoadTestDate, viralLoad, nextVlDate.toISOString().split('T')[0]]);
      }
    }

    if (cd4Count !== null && cd4TestDate) {
      const nextCd4Date = this.monitoringService.calculateNextCD4Date(
        artStartDate,
        new Date(cd4TestDate),
        parseInt(cd4Count.toString()),
        visitDateObj
      );

      // Use UPSERT to update or create monitoring schedule
      const existingCd4Schedule = await tenantDb.query(`
        SELECT id FROM hiv_monitoring_schedules 
        WHERE enrollment_id = $1 AND test_type = 'cd4'
      `, [enrollmentId]);

      if (existingCd4Schedule.length > 0) {
        await tenantDb.query(`
          UPDATE hiv_monitoring_schedules SET
          last_test_date = $1,
          last_test_result = $2,
          next_scheduled_date = $3,
          is_overdue = false,
          days_overdue = 0,
          updated_at = NOW()
          WHERE enrollment_id = $4 AND test_type = 'cd4'
        `, [cd4TestDate, cd4Count, nextCd4Date.toISOString().split('T')[0], enrollmentId]);
      } else {
        await tenantDb.query(`
          INSERT INTO hiv_monitoring_schedules (
            enrollment_id, test_type, last_test_date, last_test_result,
            next_scheduled_date, monitoring_frequency_months, is_overdue, days_overdue
          ) VALUES ($1, 'cd4', $2, $3, $4, 6, false, 0)
        `, [enrollmentId, cd4TestDate, cd4Count, nextCd4Date.toISOString().split('T')[0]]);
      }
    }

    // 2. Track Regimen History
    if (arvRegimenCode && arvRegimenName && ['2a', '2b', '3', '4'].includes(arvStatus || '')) {
      // Check if this is a new regimen (not already active)
      const existingRegimen = await tenantDb.query(`
        SELECT id FROM hiv_regimen_history 
        WHERE enrollment_id = $1 
        AND regimen_code = $2 
        AND is_active = true
      `, [enrollmentId, arvRegimenCode]);

      if (existingRegimen.length === 0) {
        // End previous active regimen
        await tenantDb.query(`
          UPDATE hiv_regimen_history 
          SET end_date = $1, is_active = false, updated_at = NOW()
          WHERE enrollment_id = $2 AND is_active = true
        `, [visitDate, enrollmentId]);

        // Create new regimen history entry
        await tenantDb.query(`
          INSERT INTO hiv_regimen_history (
            enrollment_id, visit_id, regimen_code, regimen_name,
            start_date, reason_for_change, reason_details,
            changed_by, viral_load_at_change, cd4_at_change, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        `, [
          enrollmentId, visitId, arvRegimenCode, arvRegimenName,
          visitDate,
          arvStatus === '4' ? 'Change' : arvStatus === '2a' ? 'Start' : 'Continue',
          arvChangeStopReason || null,
          providerId,
          viralLoad || null,
          cd4Count || null
        ]);
      }
    }

    // 3. Track Adherence
    if (arvAdherencePercentage !== null && arvQuantityDispensed !== null) {
      await tenantDb.query(`
        INSERT INTO hiv_adherence_tracking (
          enrollment_id, visit_id, tracking_date, adherence_percentage,
          adherence_method, pills_dispensed, pills_returned,
          recorded_by
        ) VALUES ($1, $2, $3, $4, 'pill_count', $5, $6, $7)
      `, [
        enrollmentId, visitId, visitDate, arvAdherencePercentage,
        arvQuantityDispensed,
        (arvQuantityDispensed - (arvQuantityDispensed * (arvAdherencePercentage / 100))) || 0,
        providerId
      ]);
    }

    // 4. Track Side Effects
    if (adverseEventsStatus && Array.isArray(adverseEventsStatus) && adverseEventsStatus.length > 0) {
      for (const sideEffect of adverseEventsStatus) {
        await tenantDb.query(`
          INSERT INTO hiv_side_effects (
            enrollment_id, visit_id, regimen_code, side_effect_type,
            severity, onset_date, recorded_by
          ) VALUES ($1, $2, $3, $4, 'moderate', $5, $6)
        `, [enrollmentId, visitId, arvRegimenCode || null, sideEffect, visitDate, providerId]);
      }
    }

    // 5. Generate Clinical Alerts
    const treatmentFailureCheck = this.monitoringService.checkTreatmentFailure(
      sanitizedArvStatus || '',
      viralLoad ? parseFloat(viralLoad.toString()) : null,
      viralLoadTestDate ? new Date(viralLoadTestDate) : null,
      cd4Count ? parseInt(cd4Count.toString()) : null,
      cd4TestDate ? new Date(cd4TestDate) : null,
      visitDateObj
    );

    if (treatmentFailureCheck.isTreatmentFailure) {
      await tenantDb.query(`
        INSERT INTO hiv_clinical_alerts (
          enrollment_id, alert_type, severity, title, message, related_data, is_resolved
        ) VALUES ($1, $2, $3, $4, $5, $6, false)
        ON CONFLICT DO NOTHING
      `, [
        enrollmentId,
        'treatment_failure',
        treatmentFailureCheck.severity,
        'Treatment Failure Detected',
        treatmentFailureCheck.reason || 'Treatment failure detected',
        JSON.stringify({
          viralLoad,
          cd4Count,
          visitId,
          visitDate
        })
      ]);
    }

    // High VL alert
    if (viralLoad && parseFloat(viralLoad.toString()) > 1000 && ['2a', '2b', '3', '4'].includes(sanitizedArvStatus || '')) {
      await tenantDb.query(`
        INSERT INTO hiv_clinical_alerts (
          enrollment_id, alert_type, severity, title, message, related_data, is_resolved
        ) VALUES ($1, 'high_vl', 'critical', 'High Viral Load', $2, $3, false)
        ON CONFLICT DO NOTHING
      `, [
        enrollmentId,
        `Viral load is ${viralLoad.toLocaleString()} copies/mL - Requires immediate attention`,
        JSON.stringify({ viralLoad, visitId, visitDate })
      ]);
    }

    // Adherence concern alert
    if (arvAdherencePercentage !== null && arvAdherencePercentage < 95) {
      await tenantDb.query(`
        INSERT INTO hiv_clinical_alerts (
          enrollment_id, alert_type, severity, title, message, related_data, is_resolved
        ) VALUES ($1, 'adherence_concern', 'high', 'Adherence Concern', $2, $3, false)
        ON CONFLICT DO NOTHING
      `, [
        enrollmentId,
        `Adherence is ${arvAdherencePercentage}% - Below optimal threshold (95%)`,
        JSON.stringify({ adherencePercentage: arvAdherencePercentage, visitId, visitDate })
      ]);
    }

    // ============================================
    // Auto-Schedule Appointment from Next Review Date
    // ============================================
    if (nextReviewDate && tenantId && providerId) {
      try {
        // Get enrollment to find patient_id
        const enrollmentData = await tenantDb.query(`
          SELECT patient_id FROM hiv_care_enrollments WHERE id = $1
        `, [enrollmentId]);

        if (enrollmentData.length > 0 && enrollmentData[0].patient_id) {
          const patientId = enrollmentData[0].patient_id;
          
          // Create appointment for next review date
          // Use providerId as doctorId (or get default doctor from enrollment's primary provider)
          let doctorId = providerId;
          
          // Try to get a doctor if provider is not a doctor
          if (providerRole !== 'doctor') {
            const doctor = await tenantDb.query(`
              SELECT id FROM users 
              WHERE role = 'doctor' AND id IN (
                SELECT DISTINCT doctor_id FROM appointments 
                WHERE patient_id = $1 
                ORDER BY appointment_date DESC 
                LIMIT 1
              )
              LIMIT 1
            `, [patientId]);
            
            if (doctor.length > 0) {
              doctorId = doctor[0].id;
            }
          }

          // Schedule appointment at 9 AM on next review date
          const appointmentDate = new Date(nextReviewDate);
          appointmentDate.setHours(9, 0, 0, 0);

          await this.appointmentService.create({
            patientId,
            doctorId,
            appointmentDate: appointmentDate.toISOString(),
            appointmentType: 'HIV Follow-up',
            reason: `HIV Care follow-up visit - Next review scheduled`,
            notes: `Auto-scheduled from HIV clinical visit. Visit #${visitNumber || 'N/A'}`,
            durationMinutes: 30
          }, providerId, tenantId);

          this.logger.log(`Auto-scheduled appointment for patient ${patientId} on ${nextReviewDate}`);
        }
      } catch (error) {
        // Log error but don't fail visit creation if appointment scheduling fails
        this.logger.error(`Failed to auto-schedule appointment: ${error.message}`, error.stack);
      }
    }
    
    return result[0];
  }

  /**
   * Audit Trail - Log critical actions
   */
  async logAuditAction(
    actionType: string,
    actionDescription: string,
    enrollmentId: string | null,
    oldValue: any,
    newValue: any,
    performedBy: string,
    performedByName: string,
    tenantDb: DataSource
  ) {
    try {
      await tenantDb.query(`
        INSERT INTO hiv_audit_log (
          enrollment_id, action_type, action_description,
          old_value, new_value, performed_by, performed_by_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        enrollmentId,
        actionType,
        actionDescription,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        performedBy,
        performedByName
      ]);
    } catch (error) {
      this.logger.error('Failed to log audit action:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Get audit log for enrollment
   */
  async getAuditLog(enrollmentId: string, tenantDb: DataSource) {
    try {
      const logs = await tenantDb.query(`
        SELECT al.*, u.first_name, u.last_name
        FROM hiv_audit_log al
        LEFT JOIN users u ON al.performed_by = u.id
        WHERE al.enrollment_id = $1
        ORDER BY al.created_at DESC
      `, [enrollmentId]);
      return { logs: logs || [] };
    } catch (error) {
      this.logger.warn(`Audit log table may not exist: ${error.message}`);
      return { logs: [] };
    }
  }

  async getClinicalVisits(enrollmentId: string, tenantDb: DataSource) {
    const visits = await tenantDb.query(
      `SELECT * FROM hiv_clinical_visits WHERE enrollment_id = $1 ORDER BY visit_date DESC`,
      [enrollmentId]
    );
    return { visits };
  }

  async getVisitCount(enrollmentId: string, tenantDb: DataSource) {
    const result = await tenantDb.query(
      `SELECT COUNT(*) as count, COALESCE(MAX(visit_number), 0) as max_visit_number 
       FROM hiv_clinical_visits 
       WHERE enrollment_id = $1`,
      [enrollmentId]
    );
    const count = parseInt(result[0]?.count || '0');
    const maxVisitNumber = parseInt(result[0]?.max_visit_number || '0');
    
    // Get last visit's next review date and ARV status/regimen for visit status calculation
    const lastVisit = await tenantDb.query(
      `SELECT next_review_date, arv_status, arv_regimen_code, arv_regimen_name
       FROM hiv_clinical_visits 
       WHERE enrollment_id = $1
       ORDER BY visit_date DESC, visit_number DESC 
       LIMIT 1`,
      [enrollmentId]
    );
    
    // Check if patient has ever started ARV (status 2a, 2b, or 3)
    const hasStartedArv = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM hiv_clinical_visits 
       WHERE enrollment_id = $1 
       AND arv_status IN ('2a', '2b', '3', '4', '6')
       AND arv_status IS NOT NULL`,
      [enrollmentId]
    );
    
    // Get the last initiated regimen (from first visit where ARV was started)
    const lastInitiatedRegimen = await tenantDb.query(
      `SELECT arv_regimen_code, arv_regimen_name
       FROM hiv_clinical_visits 
       WHERE enrollment_id = $1 
       AND arv_status IN ('2a', '2b')
       AND arv_regimen_code IS NOT NULL
       ORDER BY visit_date ASC, visit_number ASC
       LIMIT 1`,
      [enrollmentId]
    );
    
    return { 
      count, 
      nextVisitNumber: maxVisitNumber + 1,
      lastVisitNextReviewDate: lastVisit[0]?.next_review_date || null,
      lastVisitArvStatus: lastVisit[0]?.arv_status || null,
      lastVisitArvRegimen: lastVisit[0]?.arv_regimen_code || null,
      lastVisitArvRegimenName: lastVisit[0]?.arv_regimen_name || null,
      hasStartedArv: parseInt(hasStartedArv[0]?.count || '0') > 0,
      lastInitiatedRegimenCode: lastInitiatedRegimen[0]?.arv_regimen_code || null,
      lastInitiatedRegimenName: lastInitiatedRegimen[0]?.arv_regimen_name || null
    };
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

  async getLookupData(tableName: string, query: any, tenantDb: DataSource) {
    const validTables = [
      'visit_types', 'bmi_classifications', 'pregnancy_lactating_status',
      'family_planning_methods', 'functional_status', 'tb_screening_status',
      'tb_investigation_results', 'opportunistic_infections', 'oi_sub_categories',
      'mental_health_results', 'mental_health_management', 'tpt_eligibility',
      'tpt_status', 'cryptococcal_signs', 'cryptococcal_status', 'cryptococcal_treatment',
      'arv_status', 'art_initiation_category', 'adverse_events_status',
      'arv_reasons_not_on', 'arv_reasons_start', 'arv_change_stop_reasons',
      'visit_status', 'final_outcome', 'art_regimens', 'precancerous_lesion_treatment',
      'who_staging'
    ];

    const tableMap: { [key: string]: string } = {
      'visit_types': 'hiv_visit_types',
      'bmi_classifications': 'hiv_bmi_classifications',
      'pregnancy_lactating_status': 'hiv_pregnancy_lactating_status',
      'family_planning_methods': 'hiv_family_planning_methods',
      'functional_status': 'hiv_functional_status',
      'tb_screening_status': 'hiv_tb_screening_status',
      'tb_investigation_results': 'hiv_tb_investigation_results',
      'opportunistic_infections': 'hiv_opportunistic_infections',
      'oi_sub_categories': 'hiv_oi_sub_categories',
      'mental_health_results': 'hiv_mental_health_results',
      'mental_health_management': 'hiv_mental_health_management',
      'tpt_eligibility': 'hiv_tpt_eligibility',
      'tpt_status': 'hiv_tpt_status',
      'cryptococcal_signs': 'hiv_cryptococcal_signs',
      'cryptococcal_status': 'hiv_cryptococcal_status',
      'cryptococcal_treatment': 'hiv_cryptococcal_treatment',
      'arv_status': 'hiv_arv_status',
      'art_initiation_category': 'hiv_art_initiation_category',
      'adverse_events_status': 'hiv_adverse_events_status',
      'arv_reasons_not_on': 'hiv_arv_reasons_not_on',
      'arv_reasons_start': 'hiv_arv_reasons_start',
      'arv_change_stop_reasons': 'hiv_arv_change_stop_reasons',
      'visit_status': 'hiv_visit_status',
      'final_outcome': 'hiv_final_outcome',
      'art_regimens': 'hiv_art_regimens',
      'precancerous_lesion_treatment': 'hiv_precancerous_lesion_treatment',
      'who_staging': 'hiv_who_staging'
    };

    if (!validTables.includes(tableName)) {
      throw new NotFoundException(`Lookup table ${tableName} not found`);
    }

    const dbTableName = tableMap[tableName];
    let sql = `SELECT * FROM ${dbTableName} WHERE is_active = true`;
    const params: any[] = [];

    // Handle special filters
    if (tableName === 'who_staging' && query.stage) {
      sql += ` AND stage = $${params.length + 1}`;
      params.push(parseInt(query.stage));
    }
    if (tableName === 'who_staging' && query.category) {
      sql += ` AND category = $${params.length + 1}`;
      params.push(query.category);
    }
    if (tableName === 'art_regimens' && query.line) {
      sql += ` AND line = $${params.length + 1}`;
      params.push(query.line);
    }
    if (tableName === 'art_regimens' && query.category) {
      sql += ` AND category = $${params.length + 1}`;
      params.push(query.category);
    }
    if (tableName === 'oi_sub_categories' && query.oi_id) {
      sql += ` AND oi_id = $${params.length + 1}`;
      params.push(query.oi_id);
    }

    sql += ` ORDER BY display_order ASC, name ASC`;

    const result = await tenantDb.query(sql, params);
    return { data: result };
  }

  // EAC (Enhanced Adherence Counseling) Methods
  async createEacSession(body: any, tenantDb: DataSource) {
    const {
      enrollmentId, sessionNumber, sessionDate, counselorId, counselorName,
      adherenceBarriers, barriersOtherDetails, adherencePercentageSelfReported,
      adherenceAssessmentMethod, interventionsProvided, interventionsOtherDetails,
      medicationSimplification, adherenceToolsProvided, supportSystemsIdentified,
      patientFeedback, patientConcerns, patientCommitmentLevel,
      nextSessionDate, followUpActions, followUpResponsiblePerson,
      sessionOutcome, outcomeNotes, adherenceImprovementObserved,
      eacProgramStatus, eacCompletionDate, returnToConventionalCareDate,
      viralLoad, viralLoadUnit, viralLoadTestDate, viralLoadSuppressed, viralLoadImproved,
      sessionNotes
    } = body;

    const result = await tenantDb.query(`
      INSERT INTO hiv_eac_sessions (
        enrollment_id, session_number, session_date, counselor_id, counselor_name,
        adherence_barriers, barriers_other_details, adherence_percentage_self_reported,
        adherence_assessment_method, interventions_provided, interventions_other_details,
        medication_simplification, adherence_tools_provided, support_systems_identified,
        patient_feedback, patient_concerns, patient_commitment_level,
        next_session_date, follow_up_actions, follow_up_responsible_person,
        session_outcome, outcome_notes, adherence_improvement_observed,
        eac_program_status, eac_completion_date, return_to_conventional_care_date,
        viral_load, viral_load_unit, viral_load_test_date, viral_load_suppressed, viral_load_improved,
        session_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
      )
      RETURNING *
    `, [
      enrollmentId, sessionNumber, sessionDate, counselorId, counselorName || null,
      adherenceBarriers || [], barriersOtherDetails || null, adherencePercentageSelfReported || null,
      adherenceAssessmentMethod || null, interventionsProvided || [], interventionsOtherDetails || null,
      medicationSimplification || false, adherenceToolsProvided || [], supportSystemsIdentified || [],
      patientFeedback || null, patientConcerns || null, patientCommitmentLevel || null,
      nextSessionDate || null, followUpActions || [], followUpResponsiblePerson || null,
      sessionOutcome || 'Completed', outcomeNotes || null, adherenceImprovementObserved || false,
      eacProgramStatus || 'Active', eacCompletionDate || null, returnToConventionalCareDate || null,
      viralLoad || null, (viralLoadUnit && viralLoadUnit.trim() !== '' ? viralLoadUnit : 'copies/mL'), 
      viralLoadTestDate || null, viralLoadSuppressed || null, viralLoadImproved || false,
      sessionNotes || null
    ]);

    return result[0];
  }

  async getEacSessions(enrollmentId: string, tenantDb: DataSource) {
    const sessions = await tenantDb.query(
      `SELECT * FROM hiv_eac_sessions 
       WHERE enrollment_id = $1 
       ORDER BY session_date DESC, session_number DESC`,
      [enrollmentId]
    );
    return { sessions };
  }

  async getActiveEacProgram(enrollmentId: string, tenantDb: DataSource) {
    const program = await tenantDb.query(
      `SELECT * FROM hiv_eac_sessions 
       WHERE enrollment_id = $1 
       AND eac_program_status = 'Active'
       ORDER BY session_date ASC, session_number ASC
       LIMIT 1`,
      [enrollmentId]
    );
    return program[0] || null;
  }

  // ARV Change Request Methods
  async createArvChangeRequest(body: any, tenantDb: DataSource) {
    const {
      enrollmentId, requestedBy, requestedByName,
      currentRegimenCode, currentRegimenName,
      currentViralLoad, currentViralLoadDate,
      previousViralLoad, previousViralLoadDate,
      eacCompleted, eacSessionsCompleted, eacCompletionDate,
      requestedRegimenCode, requestedRegimenName,
      changeReasonCode, changeReasonDetails, clinicalJustification
    } = body;

    const result = await tenantDb.query(`
      INSERT INTO hiv_arv_change_requests (
        enrollment_id, requested_by, requested_by_name,
        current_regimen_code, current_regimen_name,
        current_viral_load, current_viral_load_date,
        previous_viral_load, previous_viral_load_date,
        eac_completed, eac_sessions_completed, eac_completion_date,
        requested_regimen_code, requested_regimen_name,
        change_reason_code, change_reason_details, clinical_justification
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING *
    `, [
      enrollmentId, requestedBy, requestedByName || null,
      currentRegimenCode || null, currentRegimenName || null,
      currentViralLoad || null, currentViralLoadDate || null,
      previousViralLoad || null, previousViralLoadDate || null,
      eacCompleted || false, eacSessionsCompleted || 0, eacCompletionDate || null,
      requestedRegimenCode, requestedRegimenName,
      changeReasonCode || null, changeReasonDetails || null, clinicalJustification || null
    ]);

    return result[0];
  }

  async getArvChangeRequests(query: any, tenantDb: DataSource) {
    const status = query.status || 'pending';
    const requests = await tenantDb.query(
      `SELECT r.*, e.enrollment_number, p.first_name, p.last_name, p.patient_number
       FROM hiv_arv_change_requests r
       JOIN hiv_care_enrollments e ON r.enrollment_id = e.id
       JOIN patients p ON e.patient_id = p.id
       WHERE r.status = $1
       ORDER BY r.request_date DESC, r.created_at DESC`,
      [status]
    );
    return { requests };
  }

  async approveArvChangeRequest(requestId: string, body: any, tenantDb: DataSource) {
    const { approvedBy, approvedByName, approvalNotes } = body;

    const result = await tenantDb.query(`
      UPDATE hiv_arv_change_requests
      SET status = 'approved',
          approved_by = $1,
          approved_by_name = $2,
          approval_date = CURRENT_DATE,
          approval_notes = $3,
          updated_at = NOW()
      WHERE id = $4 AND status = 'pending'
      RETURNING *
    `, [approvedBy, approvedByName || null, approvalNotes || null, requestId]);

    if (!result[0]) {
      throw new Error('Change request not found or already processed');
    }

    return result[0];
  }

  async rejectArvChangeRequest(requestId: string, body: any, tenantDb: DataSource) {
    const { approvedBy, approvedByName, rejectionReason } = body;

    const result = await tenantDb.query(`
      UPDATE hiv_arv_change_requests
      SET status = 'rejected',
          approved_by = $1,
          approved_by_name = $2,
          approval_date = CURRENT_DATE,
          rejection_reason = $3,
          updated_at = NOW()
      WHERE id = $4 AND status = 'pending'
      RETURNING *
    `, [approvedBy, approvedByName || null, rejectionReason, requestId]);

    if (!result[0]) {
      throw new Error('Change request not found or already processed');
    }

    return result[0];
  }

  async getApprovedArvChangeForEnrollment(enrollmentId: string, tenantDb: DataSource) {
    const request = await tenantDb.query(
      `SELECT * FROM hiv_arv_change_requests
       WHERE enrollment_id = $1 
       AND status = 'approved'
       AND visit_recorded = false
       ORDER BY approval_date DESC, created_at DESC
       LIMIT 1`,
      [enrollmentId]
    );
    return request[0] || null;
  }

  // Check if patient needs EAC based on viral load (WHO Guidelines: 2 consecutive VL >1000)
  async checkEacEligibility(enrollmentId: string, tenantDb: DataSource) {
    const recentVisits = await tenantDb.query(
      `SELECT viral_load, viral_load_test_date, visit_date
       FROM hiv_clinical_visits
       WHERE enrollment_id = $1 
       AND viral_load IS NOT NULL
       AND viral_load > 1000
       ORDER BY visit_date DESC
       LIMIT 2`,
      [enrollmentId]
    );

    const needsEac = recentVisits.length >= 2;
    const lastTwoVisits = recentVisits.slice(0, 2);
    
    // Check if visits are 3-6 months apart (WHO guideline)
    let visitsValid = false;
    if (lastTwoVisits.length === 2) {
      const date1 = new Date(lastTwoVisits[0].visit_date);
      const date2 = new Date(lastTwoVisits[1].visit_date);
      const monthsDiff = (date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24 * 30);
      visitsValid = monthsDiff >= 3 && monthsDiff <= 6;
    }

    // Check if already in EAC
    const activeEac = await this.getActiveEacProgram(enrollmentId, tenantDb);

    // Check if EAC was completed and patient has suppressed VL after completion
    const completedEac = await tenantDb.query(
      `SELECT eac_completion_date, return_to_conventional_care_date
       FROM hiv_eac_sessions
       WHERE enrollment_id = $1 
       AND eac_program_status = 'Completed'
       ORDER BY eac_completion_date DESC
       LIMIT 1`,
      [enrollmentId]
    );

    let eacCompletedAndSuppressed = false;
    if (completedEac.length > 0 && completedEac[0].eac_completion_date) {
      // Check if there's a suppressed VL after EAC completion
      const completionDate = completedEac[0].eac_completion_date;
      const postEacVl = await tenantDb.query(
        `SELECT viral_load, visit_date
         FROM hiv_clinical_visits
         WHERE enrollment_id = $1 
         AND viral_load IS NOT NULL
         AND visit_date >= $2
         ORDER BY visit_date DESC
         LIMIT 1`,
        [enrollmentId, completionDate]
      );
      
      // If patient has suppressed VL (<1000) after EAC completion, no longer needs EAC
      if (postEacVl.length > 0 && postEacVl[0].viral_load && parseFloat(postEacVl[0].viral_load) < 1000) {
        eacCompletedAndSuppressed = true;
      }
    }

    // EAC alert disappears when:
    // 1. Patient doesn't have 2 consecutive high VLs (needsEac = false)
    // 2. Visits are not 3-6 months apart (visitsValid = false)
    // 3. Already in active EAC program (activeEac exists)
    // 4. EAC was completed AND patient has suppressed VL after completion
    const shouldShowEacAlert = needsEac && visitsValid && !activeEac && !eacCompletedAndSuppressed;

    // Get session count for active EAC program
    let sessionsCompleted = 0;
    if (activeEac) {
      const sessionCount = await tenantDb.query(
        `SELECT COUNT(*) as count
         FROM hiv_eac_sessions
         WHERE enrollment_id = $1
         AND eac_program_status = 'Active'`,
        [enrollmentId]
      );
      sessionsCompleted = parseInt(sessionCount[0]?.count || '0');
    }

    return {
      needsEac: shouldShowEacAlert,
      recentVisits: lastTwoVisits,
      activeEac: activeEac !== null,
      eacProgram: activeEac ? {
        ...activeEac,
        sessions_completed: sessionsCompleted,
        eac_start_date: activeEac.session_date || activeEac.created_at
      } : null,
      eacCompleted: completedEac.length > 0,
      eacCompletedAndSuppressed: eacCompletedAndSuppressed
    };
  }

  /**
   * Get matching lab results for auto-population
   */
  async getMatchingLabResults(patientId: string, visitDate: string, tenantDb: DataSource) {
    const visitDateObj = new Date(visitDate);
    const matchedResults = await this.labResultsMatchingService.findMatchingViralLoad(
      patientId,
      visitDateObj,
      tenantDb
    );
    
    return {
      matched: matchedResults.viralLoad !== null,
      viralLoad: matchedResults.viralLoad,
      viralLoadUnit: matchedResults.viralLoadUnit,
      viralLoadTestDate: matchedResults.viralLoadTestDate,
      viralLoadSuppressed: matchedResults.viralLoadSuppressed,
      source: matchedResults.source,
      labOrderId: matchedResults.labOrderId,
      matchedBy: matchedResults.matchedBy
    };
  }

  /**
   * Get monitoring schedules for an enrollment
   */
  async getMonitoringSchedules(enrollmentId: string, tenantDb: DataSource) {
    try {
      const schedules = await tenantDb.query(
        `SELECT * FROM hiv_monitoring_schedules 
         WHERE enrollment_id = $1 
         ORDER BY next_scheduled_date ASC`,
        [enrollmentId]
      );
      return { schedules: schedules || [] };
    } catch (error) {
      this.logger.warn(`Monitoring schedules table may not exist: ${error.message}`);
      return { schedules: [] };
    }
  }

  /**
   * Get quality metrics
   */
  async getQualityMetrics(tenantDb: DataSource) {
    const [vlSuppression, patientsOnART, treatmentFailure, ltfu, timeToSuppression] = await Promise.all([
      this.qualityMetricsService.calculateVLSuppressionRate(tenantDb),
      this.qualityMetricsService.calculatePatientsOnART(tenantDb),
      this.qualityMetricsService.calculateTreatmentFailureRate(tenantDb),
      this.qualityMetricsService.calculateLTFURate(tenantDb),
      this.qualityMetricsService.calculateAverageTimeToSuppression(tenantDb)
    ]);

    return {
      vlSuppression,
      patientsOnART,
      treatmentFailure,
      ltfu,
      timeToSuppression
    };
  }

  /**
   * Get clinical alerts for an enrollment
   */
  async getClinicalAlerts(enrollmentId: string, tenantDb: DataSource) {
    try {
      const alerts = await tenantDb.query(
        `SELECT * FROM hiv_clinical_alerts 
         WHERE enrollment_id = $1 
         AND is_resolved = false
         ORDER BY severity DESC, created_at DESC`,
        [enrollmentId]
      );
      return { alerts: alerts || [] };
    } catch (error) {
      this.logger.warn(`Clinical alerts table may not exist: ${error.message}`);
      return { alerts: [] };
    }
  }

  /**
   * Get adherence tracking data
   */
  async getAdherenceTracking(enrollmentId: string, tenantDb: DataSource) {
    try {
      const tracking = await tenantDb.query(
        `SELECT * FROM hiv_adherence_tracking 
         WHERE enrollment_id = $1 
         ORDER BY tracking_date DESC`,
        [enrollmentId]
      );
      return { tracking: tracking || [] };
    } catch (error) {
      this.logger.warn(`Adherence tracking table may not exist: ${error.message}`);
      return { tracking: [] };
    }
  }

  /**
   * Get regimen history timeline
   */
  async getRegimenHistory(enrollmentId: string, tenantDb: DataSource) {
    try {
      const history = await tenantDb.query(
        `SELECT * FROM hiv_regimen_history 
         WHERE enrollment_id = $1 
         ORDER BY start_date DESC`,
        [enrollmentId]
      );
      return { history: history || [] };
    } catch (error) {
      this.logger.warn(`Regimen history table may not exist: ${error.message}`);
      return { history: [] };
    }
  }

  /**
   * Check TPT eligibility
   */
  async checkTptEligibility(enrollmentId: string, tenantDb: DataSource) {
    return this.tptTrackerService.checkTptEligibility(enrollmentId, tenantDb);
  }

  /**
   * Get TPT completion status
   */
  async getTptCompletionStatus(enrollmentId: string, tenantDb: DataSource) {
    return this.tptTrackerService.getTptCompletionStatus(enrollmentId, tenantDb);
  }

  /**
   * Get visit templates
   */
  async getVisitTemplates(tenantDb: DataSource, visitType?: string) {
    return this.visitTemplatesService.getTemplates(tenantDb, visitType);
  }

  /**
   * Calculate pediatric dose
   */
  calculatePediatricDose(regimenCode: string, weightKg: number, ageMonths: number, bsa?: number) {
    return this.pediatricDosingService.calculatePediatricDose(regimenCode, weightKg, ageMonths, bsa);
  }

  /**
   * Get LTFU patients
   */
  async getLTFUPatients(daysSinceLastVisit: number, tenantDb: DataSource) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastVisit);

    const result = await tenantDb.query(
      `SELECT 
        e.id,
        e.enrollment_number,
        e.patient_id,
        p.first_name,
        p.last_name,
        p.patient_number,
        e.enrollment_date,
        e.art_start_date,
        MAX(v.visit_date) as last_visit_date,
        MAX(v.next_review_date) as last_next_review_date,
        CASE 
          WHEN MAX(v.visit_date) IS NOT NULL THEN 
            (CURRENT_DATE - MAX(v.visit_date)::date)::integer
          ELSE 
            (CURRENT_DATE - e.enrollment_date::date)::integer
        END as days_since_last_visit
      FROM hiv_care_enrollments e
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN hiv_clinical_visits v ON v.enrollment_id = e.id
      WHERE e.enrollment_status = 'active'
      GROUP BY e.id, e.enrollment_number, e.patient_id, p.first_name, p.last_name, p.patient_number, e.enrollment_date, e.art_start_date
      HAVING MAX(v.visit_date) < $1::date OR MAX(v.visit_date) IS NULL
      ORDER BY days_since_last_visit DESC NULLS LAST`,
      [cutoffDate.toISOString().split('T')[0]]
    );

    return { patients: result };
  }

  /**
   * Referral Management
   */
  async createReferral(body: any, tenantDb: DataSource) {
    const {
      enrollmentId, visitId, referralDate, referralType, referralTypeDetails,
      referredToFacility, referredToProvider, referralReason, referralPriority,
      referredBy, referredByName
    } = body;

    const result = await tenantDb.query(`
      INSERT INTO hiv_referrals (
        enrollment_id, visit_id, referral_date, referral_type, referral_type_details,
        referred_to_facility, referred_to_provider, referral_reason, referral_priority,
        referred_by, referred_by_name, referral_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
      RETURNING *
    `, [
      enrollmentId, visitId || null, referralDate || new Date().toISOString().split('T')[0],
      referralType, referralTypeDetails || null, referredToFacility || null,
      referredToProvider || null, referralReason, referralPriority || 'normal',
      referredBy, referredByName
    ]);

    return result[0];
  }

  async getReferrals(query: any, tenantDb: DataSource) {
    let sql = `
      SELECT r.*, 
        e.enrollment_number, e.patient_id,
        p.first_name, p.last_name, p.patient_number,
        v.visit_number, v.visit_date
      FROM hiv_referrals r
      JOIN hiv_care_enrollments e ON r.enrollment_id = e.id
      JOIN patients p ON e.patient_id = p.id
      LEFT JOIN hiv_clinical_visits v ON r.visit_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (query.status) {
      sql += ` AND r.referral_status = $${paramCount++}`;
      params.push(query.status);
    }

    if (query.enrollmentId) {
      sql += ` AND r.enrollment_id = $${paramCount++}`;
      params.push(query.enrollmentId);
    }

    if (query.referralType) {
      sql += ` AND r.referral_type = $${paramCount++}`;
      params.push(query.referralType);
    }

    sql += ` ORDER BY r.referral_date DESC, r.created_at DESC`;

    const referrals = await tenantDb.query(sql, params);
    return { referrals };
  }

  async getEnrollmentReferrals(enrollmentId: string, tenantDb: DataSource) {
    const referrals = await tenantDb.query(`
      SELECT r.*, 
        v.visit_number, v.visit_date
      FROM hiv_referrals r
      LEFT JOIN hiv_clinical_visits v ON r.visit_id = v.id
      WHERE r.enrollment_id = $1
      ORDER BY r.referral_date DESC
    `, [enrollmentId]);

    return { referrals };
  }

  async updateReferralStatus(referralId: string, body: any, tenantDb: DataSource) {
    const { referralStatus, outcome, outcomeNotes, completedDate, declinedReason, cancelledReason, updatedBy } = body;

    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    updateFields.push(`referral_status = $${paramCount++}`);
    params.push(referralStatus);

    if (outcome !== undefined) {
      updateFields.push(`outcome = $${paramCount++}`);
      params.push(outcome);
    }

    if (outcomeNotes !== undefined) {
      updateFields.push(`outcome_notes = $${paramCount++}`);
      params.push(outcomeNotes);
    }

    if (completedDate !== undefined) {
      updateFields.push(`completed_date = $${paramCount++}`);
      params.push(completedDate);
      if (updatedBy) {
        updateFields.push(`completed_by = $${paramCount++}`);
        params.push(updatedBy);
      }
    }

    if (declinedReason !== undefined) {
      updateFields.push(`declined_reason = $${paramCount++}`);
      params.push(declinedReason);
    }

    if (cancelledReason !== undefined) {
      updateFields.push(`cancelled_reason = $${paramCount++}`);
      params.push(cancelledReason);
    }

    updateFields.push(`updated_at = NOW()`);

    params.push(referralId);

    const result = await tenantDb.query(`
      UPDATE hiv_referrals
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);

    return result[0];
  }

  // Medication Stock Management
  async getMedicationStock(query: any, tenantDb: DataSource) {
    let sql = 'SELECT * FROM hiv_medication_stock WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 1;

    if (query.medicationType && query.medicationType !== 'all') {
      sql += ` AND medication_type = $${paramCount}`;
      params.push(query.medicationType);
      paramCount++;
    }

    if (query.lowStock) {
      sql += ` AND current_stock <= reorder_level`;
    }

    sql += ' ORDER BY medication_name';
    const stock = await tenantDb.query(sql, params);
    return { stock };
  }

  async createMedicationStock(body: any, tenantDb: DataSource, userId: string) {
    const {
      medicationName, medicationCode, medicationType, unitOfMeasure,
      currentStock, minimumStockLevel, maximumStockLevel, reorderLevel,
      expiryDate, batchNumber, supplier, notes
    } = body;

    const result = await tenantDb.query(`
      INSERT INTO hiv_medication_stock (
        medication_name, medication_code, medication_type, unit_of_measure,
        current_stock, minimum_stock_level, maximum_stock_level, reorder_level,
        expiry_date, batch_number, supplier, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [medicationName, medicationCode, medicationType, unitOfMeasure || 'tablets',
        currentStock || 0, minimumStockLevel || 0, maximumStockLevel, reorderLevel || 0,
        expiryDate, batchNumber, supplier, notes]);
    
    return result[0];
  }

  async updateMedicationStock(stockId: string, body: any, tenantDb: DataSource, userId: string) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    const fieldMap: any = {
      medicationName: 'medication_name',
      medicationCode: 'medication_code',
      medicationType: 'medication_type',
      unitOfMeasure: 'unit_of_measure',
      currentStock: 'current_stock',
      minimumStockLevel: 'minimum_stock_level',
      maximumStockLevel: 'maximum_stock_level',
      reorderLevel: 'reorder_level',
      expiryDate: 'expiry_date',
      batchNumber: 'batch_number',
      supplier: 'supplier',
      notes: 'notes',
      isActive: 'is_active'
    };

    Object.keys(body).forEach(key => {
      if (body[key] !== undefined && fieldMap[key]) {
        updates.push(`${fieldMap[key]} = $${paramCount}`);
        params.push(body[key]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(stockId);

    const result = await tenantDb.query(`
      UPDATE hiv_medication_stock
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);
    
    return result[0];
  }

  // Cohort Analysis and Comparison Reports
  async getCohortAnalysis(cohortType: string, timeRange: string, tenantDb: DataSource) {
    return this.qualityMetricsService.getCohortAnalysis(cohortType as any, timeRange, tenantDb);
  }

  async getComparisonReport(params: any, tenantDb: DataSource) {
    return this.qualityMetricsService.getComparisonReport(params, tenantDb);
  }
}
