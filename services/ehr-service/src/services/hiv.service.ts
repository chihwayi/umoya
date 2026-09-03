import { Injectable, Logger, NotFoundException, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { LabResultsMatchingService } from './lab-results-matching.service';
import { HivMonitoringService } from './hiv-monitoring.service';
import { HivQualityMetricsService } from './hiv-quality-metrics.service';
import { HivVisitTemplatesService } from './hiv-visit-templates.service';
import { HivTptTrackerService } from './hiv-tpt-tracker.service';
import { HivPediatricDosingService } from './hiv-pediatric-dosing.service';
import { AppointmentService } from './appointment.service';
import { TenantService } from './tenant.service';
import { TerminologyService } from './terminology.service';
import { CdssService } from './cdss.service';
import { OiEarlyWarningService } from './oi-early-warning.service';
import { VacsIndexService } from './vacs-index.service';

interface StoredConceptSummary {
  conceptId: string;
  term: string;
  moduleId?: string;
  definitionStatus?: string;
}

@Injectable()
export class HivService {
  private readonly logger = new Logger(HivService.name);
  
  constructor(
    private labResultsMatchingService: LabResultsMatchingService,
    private monitoringService: HivMonitoringService,
    private qualityMetricsService: HivQualityMetricsService,
    private visitTemplatesService: HivVisitTemplatesService,
    private tptTrackerService: HivTptTrackerService,
    private pediatricDosingService: HivPediatricDosingService,
    @Inject(forwardRef(() => AppointmentService))
    private appointmentService: AppointmentService,
    private tenantService: TenantService,
    private readonly terminologyService: TerminologyService,
    private readonly cdssService: CdssService,
    private readonly oiEarlyWarningService: OiEarlyWarningService,
    private readonly vacsIndexService: VacsIndexService,
  ) {}

  private extractConceptId(candidate: any): string | null {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === 'string') {
      return candidate.trim();
    }
    return (
      candidate?.conceptId ??
      candidate?.snomedConceptId ??
      candidate?.snomedCode ??
      candidate?.code ??
      null
    );
  }

  private async resolveConcept(tenantDb: DataSource, raw: any): Promise<StoredConceptSummary | null> {
    if (raw === undefined || raw === null) {
      return null;
    }

    const conceptIdCandidate = this.extractConceptId(raw);
    if (!conceptIdCandidate) {
      return null;
    }

    const conceptId = String(conceptIdCandidate).trim();
    let validated:
      | {
          conceptId: string;
          preferredTerm?: string;
          term?: string;
          moduleId?: string;
          definitionStatus?: string;
        }
      | null = null;

    if (/^\d+$/.test(conceptId)) {
      try {
        validated = await this.terminologyService.validateConcept(tenantDb, conceptId);
      } catch (error: any) {
        this.logger.warn(
          `SNOMED validation failed for concept "${conceptId}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      this.logger.warn(`Received non-numeric SNOMED concept "${conceptId}" for HIV payload.`);
      return null;
    }

    const rawTerm =
      (typeof raw === 'object' && (raw.preferredTerm || raw.term || raw.fullySpecifiedName)) || null;
    const term = rawTerm ?? validated?.preferredTerm ?? validated?.term ?? null;

    if (!term && !validated) {
      return null;
    }

    return {
      conceptId: validated?.conceptId ?? conceptId,
      term: term ?? '',
      moduleId: validated?.moduleId ?? raw?.moduleId,
      definitionStatus: validated?.definitionStatus ?? raw?.definitionStatus,
    };
  }

  private async normalizeConceptArray(
    tenantDb: DataSource,
    raw: any,
  ): Promise<StoredConceptSummary[]> {
    if (!raw) {
      return [];
    }
    const list = Array.isArray(raw) ? raw : [raw];
    const resolved: StoredConceptSummary[] = [];
    for (const candidate of list) {
      const concept = await this.resolveConcept(tenantDb, candidate);
      if (concept) {
        resolved.push(concept);
      }
    }
    return resolved;
  }

  private parseOptionalDateValue(value: any): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private formatDateOnly(value: Date | null): string | null {
    if (!value) {
      return null;
    }
    return value.toISOString().split('T')[0];
  }

  private diffDays(from: Date, to: Date): number {
    const start = new Date(from);
    const end = new Date(to);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private clampLimit(value: any, fallback = 50, max = 200): number {
    const parsed = Number.parseInt(String(value || fallback), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

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
    const {
      patientId,
      testedBy,
      testKitName,
      testResult,
      testKitLot,
      testKitExpiry,
      notes,
      testStage = 'screening',
      testType = 'rapid_antibody',
      testingReason,
      testingApproach,
      testingLocation,
      testingCadre,
      specimenType,
      kitType,
      dualKitUsed = false,
      resultValue,
      resultUnit,
      selfTestReported = false,
      selfTestConfirmed = false,
      recencyTestPerformed = false,
      recencyResult,
      recencyKitLot,
      recencyKitExpiry,
      partnerNotificationStatus,
      linkageAction,
      linkageCompleted = false,
      nextTestDueDate,
      followUpActions = [],
      testingContext = {},
      stis = [],
      testConcept,
      test_concept,
      specimenConcept,
      specimen_concept,
      whoSmartFormData,
    } = body;

    if (!patientId || !testedBy) {
      throw new BadRequestException('patientId and testedBy are required');
    }
    if (!testKitName) {
      throw new BadRequestException('testKitName is required');
    }
    if (!testResult) {
      throw new BadRequestException('testResult is required');
    }

    const testNumber = `HIV-${Date.now()}-${randomBytes(5).toString('hex')}`;
    const kitExpiryValue = testKitExpiry ? testKitExpiry : null;
    const recencyExpiryValue = recencyKitExpiry ? recencyKitExpiry : null;
    const nextTestDateValue = nextTestDueDate ? nextTestDueDate : null;
    const algorithmStep =
      testStage === 'screening'
        ? 1
        : testStage === 'confirmatory'
        ? 2
        : testStage === 'tie_breaker'
        ? 3
        : 1;

    const serializedFollowUps = Array.isArray(followUpActions) ? followUpActions : [];
    const normalizedContext =
      testingContext && typeof testingContext === 'object' ? testingContext : {};

    const [resolvedTestConcept, resolvedSpecimenConcept] = await Promise.all([
      this.resolveConcept(tenantDb, test_concept ?? testConcept),
      this.resolveConcept(tenantDb, specimen_concept ?? specimenConcept),
    ]);

    const normalizedStiPayload = Array.isArray(stis)
      ? (
          await Promise.all(
            stis
              .filter((item) => item && item.infectionType)
              .map(async (item) => {
                const infectionConcept = await this.resolveConcept(
                  tenantDb,
                  item.infection_concept ?? item.infectionConcept,
                );
                const stiTestConcept = await this.resolveConcept(
                  tenantDb,
                  item.test_concept ?? item.testConcept,
                );
                return {
                  infectionType: item.infectionType,
                  testType: item.testType || null,
                  testMethod: item.testMethod || null,
                  specimenType: item.specimenType || null,
                  anatomicSite: item.anatomicSite || null,
                  result: item.result || 'pending',
                  resultValue: item.resultValue || null,
                  resultUnit: item.resultUnit || null,
                  treatmentProvided:
                    typeof item.treatmentProvided === 'boolean' ? item.treatmentProvided : false,
                  treatmentRegimen: item.treatmentRegimen || null,
                  treatmentDate: item.treatmentDate || null,
                  notes: item.notes || null,
                  infectionConcept,
                  testConcept: stiTestConcept,
                };
              }),
          )
        ).filter(Boolean)
      : [];

    const stisScreened = normalizedStiPayload.map((item) => item.infectionType);

    const insertResult = await tenantDb.query(
      `
      INSERT INTO hiv_tests (
        patient_id,
        test_number,
        test_date,
        test_type,
        test_stage,
        testing_reason,
        testing_approach,
        testing_location,
        testing_cadre,
        specimen_type,
        test_snomed_code,
        test_snomed_term,
        test_snomed_module_id,
        test_snomed_definition_status,
        specimen_snomed_code,
        specimen_snomed_term,
        kit_type,
        test_kit_name,
        test_kit_lot,
        test_kit_expiry,
        dual_kit_used,
        test_result,
        result_value,
        result_unit,
        is_confirmatory,
        confirmatory_test_id,
        testing_algorithm_step,
        algorithm_result,
        tested_by,
        reviewed_by,
        reviewed_at,
        notes,
        enrolled_in_care,
        enrollment_declined,
        enrollment_declined_reason,
        self_test_reported,
        self_test_confirmed,
        recency_test_performed,
        recency_result,
        recency_kit_lot,
        recency_kit_expiry,
        partner_notification_status,
        linkage_action,
        linkage_completed,
        stis_screened,
        stis_results,
        follow_up_actions,
        testing_context,
        next_test_due_date,
        who_smart_form_data
      )
      VALUES (
        $1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, false, NULL, $24, NULL, $25, NULL, NULL, $26,
        false, false, NULL, $27, $28, $29, $30, $31, $32, $33, $34, $35,
        $36::jsonb, $37::jsonb, $38::jsonb, $39::jsonb, $40, $41::jsonb
      )
      RETURNING *
    `,
      [
        patientId,
        testNumber,
        testType,
        testStage,
        testingReason || null,
        testingApproach || null,
        testingLocation || null,
        testingCadre || null,
        specimenType || null,
        resolvedTestConcept?.conceptId ?? null,
        resolvedTestConcept?.term ?? null,
        resolvedTestConcept?.moduleId ?? null,
        resolvedTestConcept?.definitionStatus ?? null,
        resolvedSpecimenConcept?.conceptId ?? null,
        resolvedSpecimenConcept?.term ?? null,
        kitType || null,
        testKitName,
        testKitLot || null,
        kitExpiryValue,
        dualKitUsed,
        testResult,
        resultValue || null,
        resultUnit || null,
        algorithmStep,
        testedBy,
        notes || null,
        selfTestReported,
        selfTestConfirmed,
        recencyTestPerformed,
        recencyResult || null,
        recencyKitLot || null,
        recencyExpiryValue,
        partnerNotificationStatus || null,
        linkageAction || null,
        linkageCompleted,
        JSON.stringify(stisScreened),
        JSON.stringify(normalizedStiPayload),
        JSON.stringify(serializedFollowUps),
        JSON.stringify(normalizedContext),
        nextTestDateValue,
        whoSmartFormData ? JSON.stringify(whoSmartFormData) : null,
      ],
    );

    const createdTest = insertResult[0];

    if (normalizedStiPayload.length > 0) {
      for (const sti of normalizedStiPayload) {
        await tenantDb.query(
          `
          INSERT INTO sti_tests (
            patient_id,
            hiv_test_id,
            infection_type,
            infection_snomed_code,
            infection_snomed_term,
            test_type,
            test_method,
            test_snomed_code,
            test_snomed_term,
            specimen_type,
            anatomic_site,
            result,
            result_value,
            result_unit,
            treatment_provided,
            treatment_regimen,
            treatment_date,
            notes,
            ordered_by
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
          )
        `,
          [
            patientId,
            createdTest.id,
            sti.infectionType,
            sti.infectionConcept?.conceptId ?? null,
            sti.infectionConcept?.term ?? null,
            sti.testType,
            sti.testMethod,
            sti.testConcept?.conceptId ?? null,
            sti.testConcept?.term ?? null,
            sti.specimenType,
            sti.anatomicSite,
            sti.result,
            sti.resultValue,
            sti.resultUnit,
            sti.treatmentProvided,
            sti.treatmentRegimen,
            sti.treatmentDate,
            sti.notes,
            testedBy,
          ],
        );
      }
    }

    const algorithmResult = await this.processTestingAlgorithm(createdTest.id, tenantDb);

    return {
      test: {
        ...createdTest,
        sti_tests: normalizedStiPayload,
      },
      algorithm: algorithmResult,
    };
  }

  async processTestingAlgorithm(testId: string, tenantDb: DataSource) {
    // Get all tests for this patient
    const test = await tenantDb.query('SELECT * FROM hiv_tests WHERE id = $1', [testId]);
    if (!test[0]) throw new NotFoundException('Test not found');

    const normalizeResult = (result: string | null): string => {
      if (!result) return '';
      const value = result.toLowerCase();
      if (value === 'positive') return 'reactive';
      if (value === 'negative') return 'non_reactive';
      return value;
    };

    const patientId = test[0].patient_id;
    const allTests = await tenantDb.query(
      'SELECT * FROM hiv_tests WHERE patient_id = $1 ORDER BY test_date ASC',
      [patientId]
    );
    
    // Send to CDSS algorithm
    try {
      this.logger.log(
        `[HivService] Calling CDSS HIV algorithm for patient ${patientId} with ${allTests.length} tests`,
      );
      const algorithmData = await this.cdssService.runHivTestingAlgorithm(
        allTests.map((t) => ({
          test_kit_name: t.test_kit_name,
          test_result: normalizeResult(t.test_result),
          test_date: t.test_date,
          tested_by: t.tested_by,
        })),
      );
      this.logger.log(
        `[HivService] CDSS HIV algorithm response: ${JSON.stringify({
          algorithm_result: algorithmData?.algorithm_result,
          confidence: algorithmData?.confidence,
          has_interpretation: !!algorithmData?.interpretation,
          source: (algorithmData as any)?.source,
        })}`,
      );

      // Update test with algorithm result
      await tenantDb.query(
        `UPDATE hiv_tests SET algorithm_result = $1, updated_at = NOW() WHERE id = $2`,
        [algorithmData.algorithm_result, testId]
      );
      
      return algorithmData;
    } catch (error: any) {
      const status = (error as any)?.response?.status;
      const data = (error as any)?.response?.data;
      this.logger.warn(
        `[HivService] CDSS HIV algorithm call failed (status=${status ?? 'unknown'}): ${
          data ? JSON.stringify(data) : String(error?.message || error)
        }`,
      );
      this.logger.warn('CDSS algorithm unavailable, using basic logic');
      // Basic fallback
      const testResult = normalizeResult(test[0].test_result);
      let algorithmResult = 'incomplete';
      if (testResult === 'non_reactive') algorithmResult = 'negative';
      if (testResult === 'reactive' && allTests.length === 1) algorithmResult = 'incomplete';
      if (allTests.length >= 2) {
        const reactiveCount = allTests.filter(
          (t) => normalizeResult(t.test_result) === 'reactive',
        ).length;
        if (reactiveCount >= 2) algorithmResult = 'positive';
        else if (normalizeResult(allTests[0].test_result) === 'non_reactive')
          algorithmResult = 'negative';
        else algorithmResult = 'indeterminate';
      }
      
      await tenantDb.query(
        `UPDATE hiv_tests SET algorithm_result = $1 WHERE id = $2`,
        [algorithmResult, testId],
      );

      let nextStep = 'Continue national testing algorithm';
      if (algorithmResult === 'positive') {
        nextStep =
          'HIV Positive: ensure immediate linkage to HIV care, baseline labs, and partner services.';
      } else if (algorithmResult === 'negative') {
        nextStep =
          'HIV Negative: provide post-test counselling, risk reduction package, and schedule retesting as per guidelines.';
      }

      return {
        algorithm_result: algorithmResult,
        confidence: 'low',
        next_step: nextStep,
        source: 'ehr_fallback',
      };
    }
  }

  async getPatientHivTests(patientId: string, tenantDb: DataSource) {
    const tests = await tenantDb.query(
      'SELECT * FROM hiv_tests WHERE patient_id = $1 ORDER BY test_date DESC',
      [patientId],
    );

    if (tests.length === 0) {
      return { tests: [] };
    }

    const testIds = tests.map((test: any) => test.id);
    const stiTests = await tenantDb.query(
      `
      SELECT *
      FROM sti_tests
      WHERE hiv_test_id = ANY($1::uuid[])
      ORDER BY test_date DESC
    `,
      [testIds],
    );

    const grouped: Record<string, any[]> = stiTests.reduce((acc: Record<string, any[]>, row: any) => {
      if (!row.hiv_test_id) {
        return acc;
      }
      if (!acc[row.hiv_test_id]) {
        acc[row.hiv_test_id] = [];
      }
      acc[row.hiv_test_id].push(row);
      return acc;
    }, {});

    const enriched = tests.map((test: any) => ({
      ...test,
      sti_tests: grouped[test.id] || [],
    }));

    return { tests: enriched };
  }

  async enrollInCare(body: any, tenantDb: DataSource) {
    const { patientId, enrollmentDate, dateConfirmedPositive, baselineCd4, baselineViralLoad, baselineClinicalStage, baselineWhoStage, enrollmentNotes, createdBy, whoSmartFormData } = body;

    const existing = await tenantDb.query(
      `
      SELECT *
      FROM hiv_care_enrollments
      WHERE patient_id = $1
      ORDER BY enrollment_date DESC
      `,
      [patientId],
    );

    if (existing.length > 0) {
      await tenantDb.query(
        `UPDATE hiv_tests SET enrolled_in_care = true WHERE patient_id = $1`,
        [patientId],
      );
      return existing[0];
    }

    const enrollmentNumber = `ENR-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const result = await tenantDb.query(
      `
      INSERT INTO hiv_care_enrollments (
        patient_id, enrollment_date, enrollment_number, date_confirmed_positive,
        baseline_cd4, baseline_viral_load, baseline_clinical_stage, baseline_who_stage, enrollment_notes, created_by, who_smart_form_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      RETURNING *
    `,
      [
        patientId,
        enrollmentDate || new Date().toISOString().split('T')[0],
        enrollmentNumber,
        dateConfirmedPositive,
        baselineCd4,
        baselineViralLoad,
        baselineClinicalStage,
        baselineWhoStage,
        enrollmentNotes,
        createdBy,
        whoSmartFormData ? JSON.stringify(whoSmartFormData) : null,
      ],
    );

    await tenantDb.query(
      `UPDATE hiv_tests SET enrolled_in_care = true WHERE patient_id = $1`,
      [patientId],
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
      arvInitiationCategoryCode, arvReasonNotOnCode, arvReasonStartCode, arvChangeStopReasonCode,
      arvQuantityPrescribed, arvQuantityDispensed, arvAdherencePercentage,
      regimenChanged, regimenChangeApprovedBy,
      visitReasonConcept,
      opportunisticInfectionConcepts,
      tbScreeningConcept,
      tbInvestigationConcepts,
      arvReasonConcept,
      arvRegimenConcept,
      mentalHealthResultConcept,
      mentalHealthManagementConcept,
      adverseEventConcepts,
      followUpActionConcepts,
      referralReasonConcept,
      // Lab Results
      cd4Count, cd4Percentage, cd4TestDate,
      viralLoad, viralLoadUnit, viralLoadTestDate, viralLoadSampleCollectedDate, viralLoadResultReceivedDate, viralLoadSuppressed,
      altResult, creatinineResult, otherDiagnostics,
      // Adverse Events
      adverseEventsStatus,
      // Referrals & Follow-up
      referredTo, referredToDetails, nextReviewDate,
      visitStatus, followUpStatus, followUpDetails,
      // Notes
      visitNotes, clinicianInitials, pharmacyDispenserInitials,
      // WHO Smart Forms
      whoSmartFormData
    } = body;

    const resolveRecorderIdentity = (...candidates: any[]): string | null => {
      for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const normalized = String(candidate).trim();
        if (normalized) return normalized;
      }
      return null;
    };

    // Server-side authoritative recorder stamp to avoid client-side identity spoofing.
    const resolvedClinicianIdentity = resolveRecorderIdentity(providerName, clinicianInitials, providerId);

    if (!visitDate) {
      throw new BadRequestException('visitDate is required');
    }

    const parsedVisitDate = new Date(visitDate);
    if (Number.isNaN(parsedVisitDate.getTime())) {
      throw new BadRequestException('visitDate is invalid');
    }
    parsedVisitDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedVisitDate > today) {
      throw new BadRequestException('visitDate cannot be in the future');
    }

    const parseOptionalDate = (value: any, fieldName: string): Date | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    const parseOptionalNumber = (value: any, fieldName: string): number | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`${fieldName} must be numeric`);
      }
      return parsed;
    };

    const validatePercentage = (value: any, fieldName: string) => {
      const parsed = parseOptionalNumber(value, fieldName);
      if (parsed !== null && (parsed < 0 || parsed > 100)) {
        throw new BadRequestException(`${fieldName} must be between 0 and 100`);
      }
    };

    const validateNonNegative = (value: any, fieldName: string) => {
      const parsed = parseOptionalNumber(value, fieldName);
      if (parsed !== null && parsed < 0) {
        throw new BadRequestException(`${fieldName} cannot be negative`);
      }
    };

    const normalizedViralLoad = parseOptionalNumber(viralLoad, 'viralLoad');
    if (normalizedViralLoad !== null && normalizedViralLoad < 0) {
      throw new BadRequestException('viralLoad cannot be negative');
    }

    const parsedCd4TestDate = parseOptionalDate(cd4TestDate, 'cd4TestDate');
    const parsedViralLoadTestDate = parseOptionalDate(viralLoadTestDate, 'viralLoadTestDate');
    const parsedViralLoadSampleDate = parseOptionalDate(
      viralLoadSampleCollectedDate,
      'viralLoadSampleCollectedDate',
    );
    const parsedViralLoadResultDate = parseOptionalDate(
      viralLoadResultReceivedDate,
      'viralLoadResultReceivedDate',
    );

    if (parsedCd4TestDate && parsedCd4TestDate > parsedVisitDate) {
      throw new BadRequestException('cd4TestDate cannot be after visitDate');
    }
    if (parsedViralLoadTestDate && parsedViralLoadTestDate > parsedVisitDate) {
      throw new BadRequestException('viralLoadTestDate cannot be after visitDate');
    }
    if (parsedViralLoadSampleDate && parsedViralLoadSampleDate > parsedVisitDate) {
      throw new BadRequestException('viralLoadSampleCollectedDate cannot be after visitDate');
    }
    if (parsedViralLoadResultDate && parsedViralLoadResultDate > parsedVisitDate) {
      throw new BadRequestException('viralLoadResultReceivedDate cannot be after visitDate');
    }
    if (
      parsedViralLoadSampleDate &&
      parsedViralLoadResultDate &&
      parsedViralLoadSampleDate > parsedViralLoadResultDate
    ) {
      throw new BadRequestException(
        'viralLoadSampleCollectedDate cannot be after viralLoadResultReceivedDate',
      );
    }

    validatePercentage(arvAdherencePercentage, 'arvAdherencePercentage');
    validatePercentage(tptAdherencePercentage, 'tptAdherencePercentage');
    validatePercentage(cotrimoxazoleAdherencePercentage, 'cotrimoxazoleAdherencePercentage');
    validatePercentage(cd4Percentage, 'cd4Percentage');

    validateNonNegative(arvQuantityPrescribed, 'arvQuantityPrescribed');
    validateNonNegative(arvQuantityDispensed, 'arvQuantityDispensed');
    validateNonNegative(tptQuantityDispensed, 'tptQuantityDispensed');
    validateNonNegative(cotrimoxazoleQuantityDispensed, 'cotrimoxazoleQuantityDispensed');
    validateNonNegative(fluconazoleQuantityPrescribed, 'fluconazoleQuantityPrescribed');
    validateNonNegative(fluconazoleQuantityDispensed, 'fluconazoleQuantityDispensed');
    validateNonNegative(cd4Count, 'cd4Count');

    const resolvedIptEligibility =
      iptEligibility ?? body?.tptEligibility ?? body?.iptEligibility ?? null;
    const resolvedArvReason =
      arvReason ||
      arvReasonNotOnCode ||
      arvReasonStartCode ||
      arvChangeStopReasonCode ||
      body?.arvReasonNotOnCode ||
      body?.arvReasonStartCode ||
      body?.arvChangeStopReasonCode ||
      null;

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
    if (arvStatus && !validArvStatuses.includes(arvStatus)) {
      throw new BadRequestException(`Invalid ARV status "${arvStatus}"`);
    }
    const sanitizedArvStatus = (arvStatus && validArvStatuses.includes(arvStatus)) ? arvStatus : null;
    
    const validVisitStatuses = ['E', 'OT', 'L', 'D', 'LO'];
    const sanitizedVisitStatus = (visitStatus && validVisitStatuses.includes(visitStatus)) ? visitStatus : null;
    
    const validVisitTypes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    if (!visitType || !validVisitTypes.includes(visitType)) {
      throw new Error(`Invalid visit type. Must be one of: ${validVisitTypes.join(', ')}`);
    }
    const sanitizedVisitType = visitType;

    if (sanitizedArvStatus && ['2a', '2b', '3', '4', '6'].includes(sanitizedArvStatus) && !arvRegimenCode) {
      throw new BadRequestException('arvRegimenCode is required when patient is on ART');
    }
    if (sanitizedArvStatus === '1' && !resolvedArvReason) {
      throw new BadRequestException('Reason for not being on ARV is required for ARV status "1"');
    }
    if (
      sanitizedArvStatus &&
      ['2a', '2b'].includes(sanitizedArvStatus) &&
      (!arvInitiationCategoryCode || !resolvedArvReason)
    ) {
      throw new BadRequestException(
        'ARV initiation category and start reason are required for ARV status "2a/2b"',
      );
    }
    if (
      sanitizedArvStatus &&
      ['4', '5'].includes(sanitizedArvStatus) &&
      !resolvedArvReason
    ) {
      throw new BadRequestException('Reason for ARV change/stop is required for ARV status "4/5"');
    }

    const resolvedVisitReasonConcept = await this.resolveConcept(
      tenantDb,
      visitReasonConcept ?? body?.visit_reason_concept,
    );
    const opportunisticInfectionConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      opportunisticInfectionConcepts ?? body?.opportunistic_infection_concepts,
    );
    const resolvedTbScreeningConcept = await this.resolveConcept(
      tenantDb,
      tbScreeningConcept ?? body?.tb_screening_concept,
    );
    const tbInvestigationConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      tbInvestigationConcepts ?? body?.tb_investigation_concepts,
    );
    const resolvedArvReasonConcept = await this.resolveConcept(
      tenantDb,
      arvReasonConcept ?? body?.arv_reason_concept,
    );
    const resolvedArvRegimenConcept = await this.resolveConcept(
      tenantDb,
      arvRegimenConcept ?? body?.arv_regimen_concept,
    );
    const resolvedMentalHealthResultConcept = await this.resolveConcept(
      tenantDb,
      mentalHealthResultConcept ?? body?.mental_health_result_concept,
    );
    const resolvedMentalHealthManagementConcept = await this.resolveConcept(
      tenantDb,
      mentalHealthManagementConcept ?? body?.mental_health_management_concept,
    );
    const adverseEventConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      adverseEventConcepts ?? body?.adverse_event_concepts,
    );
    const followUpActionConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      followUpActionConcepts ?? body?.follow_up_action_concepts,
    );
    const resolvedReferralReasonConcept = await this.resolveConcept(
      tenantDb,
      referralReasonConcept ?? body?.referral_reason_concept,
    );

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
        visit_notes, clinician_initials, pharmacy_dispenser_initials,
        visit_reason_snomed_code, visit_reason_snomed_term, visit_reason_snomed_module_id, visit_reason_snomed_definition_status,
        opportunistic_infections_snomed,
        tb_screening_snomed_code, tb_screening_snomed_term, tb_screening_snomed_module_id, tb_screening_snomed_definition_status,
        tb_investigation_snomed,
        arv_reason_snomed_code, arv_reason_snomed_term,
        arv_regimen_snomed_code, arv_regimen_snomed_term, arv_regimen_snomed_module_id, arv_regimen_snomed_definition_status,
        mental_health_result_snomed_code, mental_health_result_snomed_term,
        mental_health_management_snomed_code, mental_health_management_snomed_term,
        adverse_events_snomed,
        referral_reason_snomed_code, referral_reason_snomed_term,
        follow_up_actions_snomed,
        who_smart_form_data
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
        $59, $60, $61,
        $62, $63, $64, $65,
        $66,
        $67, $68, $69, $70,
        $71,
        $72, $73,
        $74, $75, $76, $77,
        $78, $79,
        $80, $81,
        $82,
        $83, $84,
        $85,
        $86::jsonb
      )
      RETURNING *
    `, [
      enrollmentId, visitNumber, visitDate, sanitizedVisitType, providerId, providerRole,
      weightKg || null, heightCm || null, calculatedBmi || null, bloodPressure || null,
      pregnancyLactatingStatus || null, firstAncBookingDate || null, deliveryDate || null, familyPlanningStatus || null,
      functionalStatus || null, whoClinicalStage || null, opportunisticInfections || null,
      tbScreening || null, tbInvestigationResult || null, tbDiagnosed || null, tbDiagnosisDate || null, tbTreatmentStarted || null,
      resolvedIptEligibility || null, sanitizedTptStatus, tptNotStartedStoppedReason || null, tptQuantityDispensed || null, tptAdherencePercentage || null,
      cotrimoxazoleQuantityDispensed || null, cotrimoxazoleAdherencePercentage || null,
      fluconazoleQuantityPrescribed || null, fluconazoleQuantityDispensed || null,
      sanitizedArvStatus, resolvedArvReason || null, arvRegimenCode || null, arvRegimenName || null,
      arvQuantityPrescribed || null, arvQuantityDispensed || null, arvAdherencePercentage || null,
      regimenChanged || false, finalRegimenChangeApprovedBy, finalRegimenChangeApprovedAt,
      cd4Count || null, cd4Percentage || null, cd4TestDate || null,
      normalizedViralLoad, (viralLoadUnit && viralLoadUnit.trim() !== '' ? viralLoadUnit : 'copies/mL'), viralLoadTestDate || null, viralLoadSuppressed || null,
      altResult || null, creatinineResult || null, otherDiagnostics || null,
      adverseEventsStatus || null,
      referredTo || null, referredToDetails || null, nextReviewDate || null,
      sanitizedVisitStatus, followUpStatus || null, followUpDetails || null,
      visitNotes || null, resolvedClinicianIdentity, pharmacyDispenserInitials || null,
      resolvedVisitReasonConcept?.conceptId ?? null,
      resolvedVisitReasonConcept?.term ?? null,
      resolvedVisitReasonConcept?.moduleId ?? null,
      resolvedVisitReasonConcept?.definitionStatus ?? null,
      JSON.stringify(opportunisticInfectionConceptsResolved ?? []),
      resolvedTbScreeningConcept?.conceptId ?? null,
      resolvedTbScreeningConcept?.term ?? null,
      resolvedTbScreeningConcept?.moduleId ?? null,
      resolvedTbScreeningConcept?.definitionStatus ?? null,
      JSON.stringify(tbInvestigationConceptsResolved ?? []),
      resolvedArvReasonConcept?.conceptId ?? null,
      resolvedArvReasonConcept?.term ?? null,
      resolvedArvRegimenConcept?.conceptId ?? null,
      resolvedArvRegimenConcept?.term ?? null,
      resolvedArvRegimenConcept?.moduleId ?? null,
      resolvedArvRegimenConcept?.definitionStatus ?? null,
      resolvedMentalHealthResultConcept?.conceptId ?? null,
      resolvedMentalHealthResultConcept?.term ?? null,
      resolvedMentalHealthManagementConcept?.conceptId ?? null,
      resolvedMentalHealthManagementConcept?.term ?? null,
      JSON.stringify(adverseEventConceptsResolved ?? []),
      resolvedReferralReasonConcept?.conceptId ?? null,
      resolvedReferralReasonConcept?.term ?? null,
      JSON.stringify(followUpActionConceptsResolved ?? []),
      whoSmartFormData ? JSON.stringify(whoSmartFormData) : null,
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

      await tenantDb.query(
        `
        UPDATE nurse_cross_module_workflow_state
        SET status = 'completed',
            completed_at = NOW(),
            completed_by = COALESCE($3, completed_by),
            note = COALESCE(note, 'Completed automatically when HIV regimen change was recorded in a clinical visit.'),
            context = COALESCE(context, '{}'::jsonb) || jsonb_build_object(
              'auto_completed_from', 'hiv_clinical_visit',
              'visitId', $1
            ),
            updated_at = NOW()
        WHERE workflow_key = $2
        `,
        [result[0].id, `hiv-regimen:${approvedChangeRequestId}`, providerId || null],
      ).catch((e: any) => { this.logger.warn(`HIV regimen change workflow completion update failed: ${e?.message}`); return undefined; });
      
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
    const artStartDateValue = body?.artStartDate ? new Date(body.artStartDate) : visitDateObj;
    const arvChangeStopReasonValue = body?.arvChangeStopReason ?? null;

    // 1. Update Monitoring Schedules (VL & CD4)
    if (normalizedViralLoad !== null && viralLoadTestDate) {
      const nextVlDate = this.monitoringService.calculateNextViralLoadDate(
        artStartDateValue,
        new Date(viralLoadTestDate),
        normalizedViralLoad,
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
        `, [viralLoadTestDate, normalizedViralLoad, nextVlDate.toISOString().split('T')[0], enrollmentId]);
      } else {
        await tenantDb.query(`
          INSERT INTO hiv_monitoring_schedules (
            enrollment_id, test_type, last_test_date, last_test_result,
            next_scheduled_date, monitoring_frequency_months, is_overdue, days_overdue
          ) VALUES ($1, 'viral_load', $2, $3, $4, 3, false, 0)
        `, [enrollmentId, viralLoadTestDate, normalizedViralLoad, nextVlDate.toISOString().split('T')[0]]);
      }
    }

    if (cd4Count !== null && cd4TestDate) {
      const nextCd4Date = this.monitoringService.calculateNextCD4Date(
        artStartDateValue,
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
          arvChangeStopReasonValue,
          providerId,
          normalizedViralLoad,
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
      normalizedViralLoad,
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
          viralLoad: normalizedViralLoad,
          cd4Count,
          visitId,
          visitDate
        })
      ]);
    }

    // High VL alert
    if (normalizedViralLoad !== null && normalizedViralLoad > 1000 && ['2a', '2b', '3', '4'].includes(sanitizedArvStatus || '')) {
      await tenantDb.query(`
        INSERT INTO hiv_clinical_alerts (
          enrollment_id, alert_type, severity, title, message, related_data, is_resolved
        ) VALUES ($1, 'high_vl', 'critical', 'High Viral Load', $2, $3, false)
        ON CONFLICT DO NOTHING
      `, [
        enrollmentId,
        `Viral load is ${normalizedViralLoad.toLocaleString()} copies/mL - Requires immediate attention`,
        JSON.stringify({ viralLoad: normalizedViralLoad, visitId, visitDate })
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

    // CDSS: ARV drug interaction check — fires async, does not block visit save
    if (arvRegimenCode) {
      const patientRows = await tenantDb
        .query(`SELECT patient_id FROM hiv_care_enrollments WHERE id = $1 LIMIT 1`, [enrollmentId])
        .catch((e: any) => { this.logger.warn(`HIV enrollment patient lookup query failed: ${e?.message}`); return []; });
      const patientId: string | undefined = patientRows[0]?.patient_id;
      if (patientId) {
        const oiInput = {
          cd4Count: cd4Count ?? null,
          symptoms: [
            opportunisticInfections,
            visitNotes,
            ...(Array.isArray(adverseEventsStatus) ? adverseEventsStatus : []),
          ]
            .filter(Boolean)
            .flatMap((value: any) => String(value).split(',').map((part) => part.trim()).filter(Boolean)),
          tbScreenPositive: Boolean(tbScreening || tbDiagnosed),
          currentRegimen: arvRegimenName ?? arvRegimenCode ?? '',
          vl: normalizedViralLoad ?? null,
        };
        const oiAlerts = this.oiEarlyWarningService.evaluateOiRisks(oiInput);
        if (oiAlerts.length > 0) {
          await this.oiEarlyWarningService.saveAlerts(patientId, oiAlerts, tenantId || 'default', tenantDb);
        }

        const patientInfoRows = await tenantDb
          .query(
            `SELECT date_of_birth
             FROM patients
             WHERE id = $1
             LIMIT 1`,
            [patientId],
          )
          .catch((e: any) => { this.logger.warn(`Patient info query for HIV cohort analysis failed: ${e?.message}`); return []; });
        const patient = patientInfoRows[0];
        if (patient?.date_of_birth) {
          const birthDate = new Date(patient.date_of_birth);
          const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age >= 50) {
            const vacsResult = this.vacsIndexService.calculateVacsScore({
              age,
              cd4Count: Number(cd4Count ?? 350),
              viralLoad: Number(normalizedViralLoad ?? 0),
              hemoglobinGdL: Number(body?.hemoglobinGdL ?? body?.hemoglobin ?? 12),
              creatinine: Number(creatinineResult ?? 1.0),
              alanineAminotransferase: Number(altResult ?? 20),
              hepatitisCPositive: Boolean(body?.hepatitisCPositive ?? body?.hepatitisC),
              fbsBmi: Number(calculatedBmi ?? 22),
              drugProblemEverDiagnosed: false,
            });
            await tenantDb.query(
              `INSERT INTO hiv_geriatric_flags
                 (patient_id, age_at_flag, vacs_index_score, vacs_10yr_mortality, frailty_status, next_review)
               VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '6 months')
               ON CONFLICT (patient_id) DO UPDATE SET
                 vacs_index_score = EXCLUDED.vacs_index_score,
                 vacs_10yr_mortality = EXCLUDED.vacs_10yr_mortality,
                 frailty_status = EXCLUDED.frailty_status,
                 last_assessed = now(),
                 next_review = EXCLUDED.next_review`,
              [
                patientId,
                age,
                vacsResult.score,
                vacsResult.tenYearMortality,
                this.vacsIndexService.classifyFrailty(vacsResult.score),
              ],
            );
          }
        }

        const activePrescRows = await tenantDb
          .query(
            `SELECT medication_name FROM prescriptions WHERE patient_id = $1 AND status IN ('active', 'pending') LIMIT 20`,
            [patientId],
          )
          .catch((e: any) => { this.logger.warn(`Active prescriptions query for drug interaction check failed: ${e?.message}`); return []; });
        const medsForCheck = [arvRegimenCode, ...activePrescRows.map((r: any) => r.medication_name).filter(Boolean)];
        if (medsForCheck.length >= 2) {
          this.cdssService
            .checkDrugInteractions(medsForCheck, patientId)
            .then(async (ddiResult: any) => {
              const criticalInteractions = (ddiResult?.interactions ?? []).filter(
                (i: any) => String(i.severity || '').toLowerCase() === 'critical',
              );
              if (criticalInteractions.length > 0) {
                await tenantDb
                  .query(
                    `INSERT INTO hiv_clinical_alerts (enrollment_id, alert_type, severity, title, message, related_data, is_resolved)
                     VALUES ($1, 'drug_interaction', 'critical', 'Critical Drug Interaction Detected', $2, $3, false)
                     ON CONFLICT DO NOTHING`,
                    [
                      enrollmentId,
                      `CDSS detected critical interaction with regimen ${arvRegimenCode}: ${criticalInteractions.map((i: any) => i.description || `${i.drug1} \u2194 ${i.drug2}`).join('; ')}`,
                      JSON.stringify({ regimen: arvRegimenCode, interactions: criticalInteractions, visitId: result[0]?.id }),
                    ],
                  )
                  .catch((e: any) => { this.logger.warn(`Critical drug interaction monitoring schedule update failed: ${e?.message}`); return undefined; });
              }
            })
            .catch((e: any) => this.logger.warn(`CDSS HIV visit DDI check failed: ${e?.message || e}`));
        }
      }
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
    const {
      patientId,
      screeningDate,
      screeningType,
      screeningResult,
      symptoms,
      symptomDurationWeeks,
      screenedBy,
      notes,
      screeningReasonConcept,
      screeningResultConcept,
      symptomConcepts,
      diagnosisConcept,
      treatmentConcept,
      whoSmartFormData,
    } = body;

    const resolvedScreeningReasonConcept = await this.resolveConcept(
      tenantDb,
      screeningReasonConcept ?? body?.screening_reason_concept,
    );
    const resolvedScreeningResultConcept = await this.resolveConcept(
      tenantDb,
      screeningResultConcept ?? body?.screening_result_concept,
    );
    const symptomConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      symptomConcepts ?? body?.symptom_concepts,
    );
    const resolvedDiagnosisConcept = await this.resolveConcept(
      tenantDb,
      diagnosisConcept ?? body?.diagnosis_concept,
    );
    const resolvedTreatmentConcept = await this.resolveConcept(
      tenantDb,
      treatmentConcept ?? body?.treatment_concept,
    );

    const result = await tenantDb.query(
      `
      INSERT INTO tb_screenings (
        patient_id,
        screening_date,
        screening_type,
        screening_result,
        symptom_cough,
        symptom_fever,
        symptom_night_sweats,
        symptom_weight_loss,
        symptom_duration_weeks,
        screened_by,
        notes,
        screening_reason_snomed_code,
        screening_reason_snomed_term,
        screening_result_snomed_code,
        screening_result_snomed_term,
        symptom_snomed_codes,
        diagnosis_snomed_code,
        diagnosis_snomed_term,
        treatment_snomed_code,
        treatment_snomed_term,
        who_smart_form_data
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21::jsonb
      )
      RETURNING *
    `,
      [
        patientId,
        screeningDate,
        screeningType,
        screeningResult,
        symptoms?.cough || false,
        symptoms?.fever || false,
        symptoms?.nightSweats || false,
        symptoms?.weightLoss || false,
        symptomDurationWeeks ?? null,
        screenedBy,
        notes,
        resolvedScreeningReasonConcept?.conceptId ?? null,
        resolvedScreeningReasonConcept?.term ?? null,
        resolvedScreeningResultConcept?.conceptId ?? null,
        resolvedScreeningResultConcept?.term ?? null,
        JSON.stringify(symptomConceptsResolved ?? []),
        resolvedDiagnosisConcept?.conceptId ?? null,
        resolvedDiagnosisConcept?.term ?? null,
        resolvedTreatmentConcept?.conceptId ?? null,
        resolvedTreatmentConcept?.term ?? null,
        whoSmartFormData ? JSON.stringify(whoSmartFormData) : null,
      ],
    );

    this.logger.log(`Created TB screening for patient ${patientId}${whoSmartFormData ? ' with WHO Smart Form data' : ''}`);
    return result[0];

    return result[0];
  }

  async createCervicalCancerScreening(body: any, tenantDb: DataSource) {
    const {
      patientId,
      screeningDate,
      screeningMethod,
      screeningResult,
      viaResult,
      papResult,
      hpvResult,
      hpvTypes,
      colposcopyResult,
      biopsyRequired,
      biopsyResult,
      treatmentProvided,
      treatmentDate,
      nextScreeningDate,
      screenedBy,
      reviewedBy,
      notes,
      // SNOMED fields
      screening_method_snomed,
      screening_result_snomed,
      via_result_snomed,
      pap_result_snomed,
      hpv_result_snomed,
      colposcopy_result_snomed,
      biopsy_result_snomed,
      treatment_provided_snomed,
    } = body;

    // Resolve SNOMED concepts
    const screeningMethodConcept = await this.resolveConcept(tenantDb, screening_method_snomed);
    const screeningResultConcept = await this.resolveConcept(tenantDb, screening_result_snomed);
    const biopsyResultConcept = await this.resolveConcept(tenantDb, biopsy_result_snomed);
    const viaResultList = await this.normalizeConceptArray(tenantDb, via_result_snomed);
    const papResultList = await this.normalizeConceptArray(tenantDb, pap_result_snomed);
    const hpvResultList = await this.normalizeConceptArray(tenantDb, hpv_result_snomed);
    const colposcopyResultList = await this.normalizeConceptArray(tenantDb, colposcopy_result_snomed);
    const treatmentProvidedList = await this.normalizeConceptArray(tenantDb, treatment_provided_snomed);

    const result = await tenantDb.query(
      `
      INSERT INTO cervical_cancer_screenings (
        patient_id, screening_date, screening_method,
        screening_method_snomed_code, screening_method_snomed_term,
        screening_method_snomed_module_id, screening_method_snomed_definition_status,
        screening_result,
        screening_result_snomed_code, screening_result_snomed_term,
        screening_result_snomed_module_id, screening_result_snomed_definition_status,
        via_result, via_result_snomed,
        pap_result, pap_result_snomed,
        hpv_result, hpv_result_snomed, hpv_types,
        colposcopy_result, colposcopy_result_snomed,
        biopsy_required, biopsy_result,
        biopsy_result_snomed_code, biopsy_result_snomed_term,
        biopsy_result_snomed_module_id, biopsy_result_snomed_definition_status,
        treatment_provided, treatment_provided_snomed,
        treatment_date, next_screening_date,
        screened_by, reviewed_by, notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14::jsonb, $15, $16::jsonb, $17, $18::jsonb, $19,
        $20, $21::jsonb, $22, $23, $24, $25, $26, $27,
        $28, $29::jsonb, $30, $31, $32, $33, $34
      )
      RETURNING *
      `,
      [
        patientId,
        screeningDate,
        screeningMethod,
        screeningMethodConcept?.conceptId ?? null,
        screeningMethodConcept?.term ?? null,
        screeningMethodConcept?.moduleId ?? null,
        screeningMethodConcept?.definitionStatus ?? null,
        screeningResult ?? null,
        screeningResultConcept?.conceptId ?? null,
        screeningResultConcept?.term ?? null,
        screeningResultConcept?.moduleId ?? null,
        screeningResultConcept?.definitionStatus ?? null,
        viaResult ?? null,
        JSON.stringify(viaResultList),
        papResult ?? null,
        JSON.stringify(papResultList),
        hpvResult ?? null,
        JSON.stringify(hpvResultList),
        hpvTypes ?? null,
        colposcopyResult ?? null,
        JSON.stringify(colposcopyResultList),
        biopsyRequired ?? false,
        biopsyResult ?? null,
        biopsyResultConcept?.conceptId ?? null,
        biopsyResultConcept?.term ?? null,
        biopsyResultConcept?.moduleId ?? null,
        biopsyResultConcept?.definitionStatus ?? null,
        treatmentProvided ?? null,
        JSON.stringify(treatmentProvidedList),
        treatmentDate ?? null,
        nextScreeningDate ?? null,
        screenedBy,
        reviewedBy ?? null,
        notes ?? null,
      ],
    );

    this.logger.log(`Created cervical cancer screening for patient ${patientId}`);
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
      'who_staging',
      'testing_service_points', 'testing_outreach_events',
      'testing_partner_services', 'testing_linkage_actions',
      'testing_sti_methods', 'testing_sti_specimens'
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
      'who_staging': 'hiv_who_staging',
      'testing_service_points': 'hiv_testing_service_points',
      'testing_outreach_events': 'hiv_testing_outreach_events',
      'testing_partner_services': 'hiv_testing_partner_services',
      'testing_linkage_actions': 'hiv_testing_linkage_actions',
      'testing_sti_methods': 'hiv_testing_sti_methods',
      'testing_sti_specimens': 'hiv_testing_sti_specimens'
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
      sessionNotes,
      adherenceBarrierConcepts,
      interventionConcepts,
      adherenceToolConcepts,
      supportSystemConcepts,
      followUpActionConcepts,
      sessionOutcomeConcept
    } = body;

    if (!enrollmentId) {
      throw new BadRequestException('enrollmentId is required');
    }
    if (!counselorId) {
      throw new BadRequestException('counselorId is required');
    }

    const parseRequiredDate = (value: any, fieldName: string): Date => {
      const parsed = new Date(value);
      if (!value || Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`${fieldName} is required and must be a valid date`);
      }
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    const parseOptionalDate = (value: any, fieldName: string): Date | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    const parseOptionalNumber = (value: any, fieldName: string): number | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`${fieldName} must be numeric`);
      }
      return parsed;
    };

    const sessionNumberNumeric = Number(sessionNumber);
    if (!Number.isInteger(sessionNumberNumeric) || sessionNumberNumeric < 1) {
      throw new BadRequestException('sessionNumber must be a positive integer');
    }

    const parsedSessionDate = parseRequiredDate(sessionDate, 'sessionDate');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsedSessionDate > today) {
      throw new BadRequestException('sessionDate cannot be in the future');
    }

    const parsedNextSessionDate = parseOptionalDate(nextSessionDate, 'nextSessionDate');
    if (parsedNextSessionDate && parsedNextSessionDate <= parsedSessionDate) {
      throw new BadRequestException('nextSessionDate must be after sessionDate');
    }

    const normalizedSessionOutcome = sessionOutcome || 'Completed';
    const validSessionOutcomes = new Set(['Completed', 'Partial', 'Missed', 'Rescheduled']);
    if (!validSessionOutcomes.has(normalizedSessionOutcome)) {
      throw new BadRequestException(`Invalid sessionOutcome "${normalizedSessionOutcome}"`);
    }

    const normalizedProgramStatus = eacProgramStatus || 'Active';
    const validProgramStatuses = new Set(['Active', 'Completed', 'Discontinued', 'Returned to Care']);
    if (!validProgramStatuses.has(normalizedProgramStatus)) {
      throw new BadRequestException(`Invalid eacProgramStatus "${normalizedProgramStatus}"`);
    }

    const parsedCompletionDate = parseOptionalDate(eacCompletionDate, 'eacCompletionDate');
    const parsedReturnToConventionalCareDate = parseOptionalDate(
      returnToConventionalCareDate,
      'returnToConventionalCareDate',
    );

    if (normalizedProgramStatus === 'Completed' && !parsedCompletionDate) {
      throw new BadRequestException('eacCompletionDate is required when eacProgramStatus is Completed');
    }
    if (parsedCompletionDate && parsedCompletionDate < parsedSessionDate) {
      throw new BadRequestException('eacCompletionDate cannot be before sessionDate');
    }
    if (parsedReturnToConventionalCareDate && !parsedCompletionDate) {
      throw new BadRequestException('returnToConventionalCareDate requires eacCompletionDate');
    }
    if (
      parsedReturnToConventionalCareDate &&
      parsedCompletionDate &&
      parsedReturnToConventionalCareDate < parsedCompletionDate
    ) {
      throw new BadRequestException('returnToConventionalCareDate cannot be before eacCompletionDate');
    }

    const adherencePercentage = parseOptionalNumber(
      adherencePercentageSelfReported,
      'adherencePercentageSelfReported',
    );
    if (
      adherencePercentage !== null &&
      (!Number.isInteger(adherencePercentage) || adherencePercentage < 0 || adherencePercentage > 100)
    ) {
      throw new BadRequestException('adherencePercentageSelfReported must be an integer between 0 and 100');
    }

    const normalizedViralLoad = parseOptionalNumber(viralLoad, 'viralLoad');
    if (normalizedViralLoad !== null && normalizedViralLoad < 0) {
      throw new BadRequestException('viralLoad cannot be negative');
    }

    const parsedViralLoadTestDate = parseOptionalDate(viralLoadTestDate, 'viralLoadTestDate');
    if (parsedViralLoadTestDate && parsedViralLoadTestDate > today) {
      throw new BadRequestException('viralLoadTestDate cannot be in the future');
    }

    if (
      normalizedViralLoad !== null &&
      viralLoadSuppressed !== undefined &&
      viralLoadSuppressed !== null
    ) {
      const expectedSuppressed = normalizedViralLoad < 1000;
      if (Boolean(viralLoadSuppressed) !== expectedSuppressed) {
        throw new BadRequestException(
          'viralLoadSuppressed does not match viralLoad threshold (<1000 copies/mL)',
        );
      }
    }

    const enrollmentRows = await tenantDb.query(
      `SELECT id, art_start_date FROM hiv_care_enrollments WHERE id = $1 LIMIT 1`,
      [enrollmentId],
    );
    if (!enrollmentRows || enrollmentRows.length === 0) {
      throw new NotFoundException('HIV care enrollment not found');
    }
    const enrollment = enrollmentRows[0];

    const latestSessionRows = await tenantDb.query(
      `SELECT session_number, session_date
       FROM hiv_eac_sessions
       WHERE enrollment_id = $1
       ORDER BY session_number DESC, session_date DESC
       LIMIT 1`,
      [enrollmentId],
    );

    const latestSession = latestSessionRows[0];
    const expectedSessionNumber = latestSession
      ? Number(latestSession.session_number || 0) + 1
      : 1;

    if (sessionNumberNumeric !== expectedSessionNumber) {
      throw new BadRequestException(
        `EAC sessions must be sequential. Expected sessionNumber ${expectedSessionNumber}.`,
      );
    }

    if (latestSession?.session_date) {
      const latestSessionDate = new Date(latestSession.session_date);
      latestSessionDate.setHours(0, 0, 0, 0);
      if (parsedSessionDate < latestSessionDate) {
        throw new BadRequestException('sessionDate cannot be earlier than the most recent EAC session date');
      }
    }

    const dateToIso = (value: Date | null): string | null =>
      value ? value.toISOString().split('T')[0] : null;

    const barrierConcepts = await this.normalizeConceptArray(
      tenantDb,
      adherenceBarrierConcepts ?? body?.adherence_barrier_concepts,
    );
    const interventionConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      interventionConcepts ?? body?.intervention_concepts,
    );
    const adherenceToolConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      adherenceToolConcepts ?? body?.adherence_tool_concepts,
    );
    const supportSystemConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      supportSystemConcepts ?? body?.support_system_concepts,
    );
    const followUpActionConceptsResolved = await this.normalizeConceptArray(
      tenantDb,
      followUpActionConcepts ?? body?.follow_up_action_concepts,
    );
    const sessionOutcomeConceptResolved = await this.resolveConcept(
      tenantDb,
      sessionOutcomeConcept ?? body?.session_outcome_concept,
    );

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
        session_notes,
        adherence_barriers_snomed, interventions_snomed, adherence_tools_snomed,
        support_systems_snomed, follow_up_actions_snomed,
        session_outcome_snomed_code, session_outcome_snomed_term
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39, $40
      )
      RETURNING *
    `, [
      enrollmentId, sessionNumberNumeric, dateToIso(parsedSessionDate), counselorId, counselorName || null,
      adherenceBarriers || [], barriersOtherDetails || null, adherencePercentage,
      adherenceAssessmentMethod || null, interventionsProvided || [], interventionsOtherDetails || null,
      medicationSimplification || false, adherenceToolsProvided || [], supportSystemsIdentified || [],
      patientFeedback || null, patientConcerns || null, patientCommitmentLevel || null,
      dateToIso(parsedNextSessionDate), followUpActions || [], followUpResponsiblePerson || null,
      normalizedSessionOutcome, outcomeNotes || null, adherenceImprovementObserved || false,
      normalizedProgramStatus, dateToIso(parsedCompletionDate), dateToIso(parsedReturnToConventionalCareDate),
      normalizedViralLoad, (viralLoadUnit && viralLoadUnit.trim() !== '' ? viralLoadUnit : 'copies/mL'),
      dateToIso(parsedViralLoadTestDate),
      normalizedViralLoad !== null
        ? normalizedViralLoad < 1000
        : (viralLoadSuppressed === undefined || viralLoadSuppressed === null
          ? null
          : Boolean(viralLoadSuppressed)),
      viralLoadImproved || false,
      sessionNotes || null,
      JSON.stringify(barrierConcepts ?? []),
      JSON.stringify(interventionConceptsResolved ?? []),
      JSON.stringify(adherenceToolConceptsResolved ?? []),
      JSON.stringify(supportSystemConceptsResolved ?? []),
      JSON.stringify(followUpActionConceptsResolved ?? []),
      sessionOutcomeConceptResolved?.conceptId ?? null,
      sessionOutcomeConceptResolved?.term ?? null
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

  private normalizeRegimenToken(value: string): string {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/_/g, '/');
  }

  private parseRuleCondition(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    return {};
  }

  private computeAgeFromDob(dateOfBirth: any): number | null {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  private hasClinicalData(context: any, dataKey: string): boolean {
    switch (dataKey) {
      case 'pregnancy_status':
        return Boolean(context.pregnancyStatus && String(context.pregnancyStatus).trim() !== '');
      case 'creatinine_result':
        return context.creatinineResult !== null && context.creatinineResult !== undefined;
      case 'alt_result':
        return context.altResult !== null && context.altResult !== undefined;
      case 'tb_treatment_status':
        return context.tbTreatmentStarted !== null && context.tbTreatmentStarted !== undefined;
      default:
        return Boolean(context[dataKey]);
    }
  }

  private getDefaultRegimenSafetyRules() {
    return [
      {
        rule_key: 'pregnancy_status_required_female_reproductive_age',
        regimen_code: null,
        domain: 'pregnancy',
        severity: 'block',
        condition_json: {
          gender_in: ['female'],
          min_age: 15,
          max_age: 49,
          requires_data: ['pregnancy_status'],
        },
        message:
          'Pregnancy/lactation status is required before regimen change for women of reproductive age.',
        recommended_action: 'Capture pregnancy/lactation status first, then retry regimen selection.',
        guideline_reference: 'WHO + Zimbabwe HIV ART pregnancy safety data capture requirement.',
      },
      {
        rule_key: 'renal_data_required_for_tdf_regimens',
        regimen_code: null,
        domain: 'renal',
        severity: 'block',
        condition_json: {
          requires_components_any: ['TDF'],
          requires_data: ['creatinine_result'],
        },
        message: 'Creatinine result is required before selecting a TDF-containing regimen.',
        recommended_action: 'Order or capture renal function result before regimen switch.',
        guideline_reference: 'WHO ART toxicity monitoring recommendations.',
      },
      {
        rule_key: 'hepatic_data_required_for_nvp_regimens',
        regimen_code: null,
        domain: 'hepatic',
        severity: 'block',
        condition_json: {
          requires_components_any: ['NVP'],
          requires_data: ['alt_result'],
        },
        message: 'ALT result is required before selecting an NVP-containing regimen.',
        recommended_action: 'Capture hepatic function result before regimen switch.',
        guideline_reference: 'WHO ART toxicity monitoring recommendations.',
      },
      {
        rule_key: 'tb_rifampicin_with_atv_r_block',
        regimen_code: null,
        domain: 'tb_ddi',
        severity: 'block',
        condition_json: {
          requires_components_any: ['ATV/R'],
          tb_treatment_required: true,
          tb_meds_any: ['rifampicin', 'rifampin'],
        },
        message:
          'ATV/r with rifampicin-based TB therapy is contraindicated due to major drug interaction risk.',
        recommended_action: 'Choose an alternative ART strategy compatible with TB co-treatment.',
        guideline_reference: 'WHO guidance on ART/TB co-treatment interactions.',
      },
      {
        rule_key: 'tb_rifampicin_with_dtg_warn',
        regimen_code: null,
        domain: 'tb_ddi',
        severity: 'warn',
        condition_json: {
          requires_components_any: ['DTG'],
          tb_treatment_required: true,
          tb_meds_any: ['rifampicin', 'rifampin'],
        },
        message:
          'DTG with rifampicin co-treatment requires protocol-level dosing review and follow-up.',
        recommended_action: 'Apply DTG + rifampicin dosing protocol and document plan.',
        guideline_reference: 'WHO guidance on integrase inhibitor co-treatment with rifampicin.',
      },
      {
        rule_key: 'renal_impairment_tdf_warn',
        regimen_code: null,
        domain: 'renal',
        severity: 'warn',
        condition_json: {
          requires_components_any: ['TDF'],
          creatinine_min: 1.5,
        },
        message:
          'Renal risk warning: elevated creatinine with TDF-containing regimen needs clinical review.',
        recommended_action: 'Consider renal-sparing alternative or enhanced renal monitoring.',
        guideline_reference: 'WHO ART toxicity and renal monitoring recommendations.',
      },
      {
        rule_key: 'severe_renal_impairment_tdf_block',
        regimen_code: null,
        domain: 'renal',
        severity: 'block',
        condition_json: {
          requires_components_any: ['TDF'],
          creatinine_min: 2.0,
        },
        message: 'TDF-containing regimen is blocked at this renal function level.',
        recommended_action: 'Select a non-TDF regimen and document renal safety rationale.',
        guideline_reference: 'WHO ART toxicity and renal monitoring recommendations.',
      },
      {
        rule_key: 'high_alt_nvp_block',
        regimen_code: null,
        domain: 'hepatic',
        severity: 'block',
        condition_json: {
          requires_components_any: ['NVP'],
          alt_min: 120,
        },
        message: 'NVP-containing regimen is blocked due to elevated ALT (hepatic risk).',
        recommended_action: 'Select alternative regimen and manage hepatic abnormality first.',
        guideline_reference: 'WHO ART toxicity guidance for NNRTI hepatotoxicity risk.',
      },
    ];
  }

  private async loadRegimenSafetyRules(tenantDb: DataSource) {
    try {
      const rows = await tenantDb.query(
        `SELECT r.rule_key, r.regimen_code, r.domain, r.severity, r.condition_json,
                r.message, r.recommended_action, r.guideline_reference
         FROM hiv_regimen_contraindication_rules r
         LEFT JOIN hiv_regimen_rule_versions v ON v.id = r.version_id
         WHERE r.is_active = true
           AND (v.id IS NULL OR v.is_active = true)
         ORDER BY CASE r.severity WHEN 'block' THEN 0 ELSE 1 END, r.domain ASC, r.rule_key ASC`,
      );
      if (rows && rows.length > 0) {
        return rows;
      }
    } catch (error: any) {
      this.logger.warn(
        `Regimen contraindication matrix unavailable in tenant DB; using default rules: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return this.getDefaultRegimenSafetyRules();
  }

  private evaluateRegimenSafetyRule(rule: any, context: any): { matched: boolean; missingData: string[] } {
    const condition = this.parseRuleCondition(rule.condition_json);
    const missingData: string[] = [];

    if (rule.regimen_code && String(rule.regimen_code).trim() !== context.requestedRegimenCode) {
      return { matched: false, missingData };
    }

    const requiresComponentsAny = Array.isArray(condition.requires_components_any)
      ? condition.requires_components_any.map((value: string) => this.normalizeRegimenToken(value))
      : [];
    if (
      requiresComponentsAny.length > 0 &&
      !requiresComponentsAny.some((component: string) => context.regimenComponentsNormalized.includes(component))
    ) {
      return { matched: false, missingData };
    }

    const requiresComponentsAll = Array.isArray(condition.requires_components_all)
      ? condition.requires_components_all.map((value: string) => this.normalizeRegimenToken(value))
      : [];
    if (
      requiresComponentsAll.length > 0 &&
      !requiresComponentsAll.every((component: string) => context.regimenComponentsNormalized.includes(component))
    ) {
      return { matched: false, missingData };
    }

    if (Array.isArray(condition.gender_in) && condition.gender_in.length > 0) {
      const allowed = condition.gender_in.map((v: string) => String(v).toLowerCase());
      if (!allowed.includes(String(context.gender || '').toLowerCase())) {
        return { matched: false, missingData };
      }
    }

    if (condition.min_age !== undefined && condition.min_age !== null) {
      if (context.age === null || context.age < Number(condition.min_age)) {
        return { matched: false, missingData };
      }
    }
    if (condition.max_age !== undefined && condition.max_age !== null) {
      if (context.age === null || context.age > Number(condition.max_age)) {
        return { matched: false, missingData };
      }
    }

    const requiresData = Array.isArray(condition.requires_data) ? condition.requires_data : [];
    for (const key of requiresData) {
      if (!this.hasClinicalData(context, String(key))) {
        missingData.push(String(key));
      }
    }
    if (missingData.length > 0) {
      return { matched: false, missingData };
    }

    if (condition.pregnancy_required === true && !context.isPregnant) {
      return { matched: false, missingData };
    }

    if (condition.tb_treatment_required === true && !context.tbTreatmentStarted) {
      return { matched: false, missingData };
    }

    const tbMedsAny = Array.isArray(condition.tb_meds_any)
      ? condition.tb_meds_any.map((value: string) => String(value).toLowerCase())
      : [];
    if (tbMedsAny.length > 0) {
      const matchedTbMed = context.tbMedicationsLower.some((med: string) =>
        tbMedsAny.some((needle: string) => med.includes(needle)),
      );
      if (!matchedTbMed) {
        return { matched: false, missingData };
      }
    }

    if (condition.creatinine_min !== undefined && condition.creatinine_min !== null) {
      if (context.creatinineResult === null || context.creatinineResult < Number(condition.creatinine_min)) {
        return { matched: false, missingData };
      }
    }
    if (condition.creatinine_max !== undefined && condition.creatinine_max !== null) {
      if (context.creatinineResult === null || context.creatinineResult > Number(condition.creatinine_max)) {
        return { matched: false, missingData };
      }
    }

    if (condition.alt_min !== undefined && condition.alt_min !== null) {
      if (context.altResult === null || context.altResult < Number(condition.alt_min)) {
        return { matched: false, missingData };
      }
    }
    if (condition.alt_max !== undefined && condition.alt_max !== null) {
      if (context.altResult === null || context.altResult > Number(condition.alt_max)) {
        return { matched: false, missingData };
      }
    }

    return { matched: true, missingData };
  }

  async precheckRegimenChange(body: any, tenantDb: DataSource) {
    const { enrollmentId, requestedRegimenCode, requestedRegimenName } = body || {};

    if (!enrollmentId) {
      throw new BadRequestException('enrollmentId is required');
    }
    if (!requestedRegimenCode || !String(requestedRegimenCode).trim()) {
      throw new BadRequestException('requestedRegimenCode is required');
    }

    const enrollmentRows = await tenantDb.query(
      `SELECT e.id, e.patient_id, e.art_start_date, p.gender, p.date_of_birth
       FROM hiv_care_enrollments e
       JOIN patients p ON p.id = e.patient_id
       WHERE e.id = $1
       LIMIT 1`,
      [enrollmentId],
    );
    if (!enrollmentRows || enrollmentRows.length === 0) {
      throw new NotFoundException('HIV care enrollment not found');
    }
    const enrollment = enrollmentRows[0];

    const regimenRows = await tenantDb.query(
      `SELECT code, name, line, category, components
       FROM hiv_art_regimens
       WHERE code = $1
         AND is_active = true
       LIMIT 1`,
      [String(requestedRegimenCode).trim()],
    );
    if (!regimenRows || regimenRows.length === 0) {
      throw new BadRequestException('Requested ART regimen is not recognized or inactive');
    }
    const regimen = regimenRows[0];

    const latestVisitRows = await tenantDb.query(
      `SELECT pregnancy_lactating_status, tb_treatment_started, creatinine_result, alt_result, visit_date
       FROM hiv_clinical_visits
       WHERE enrollment_id = $1
       ORDER BY visit_date DESC, visit_number DESC
       LIMIT 1`,
      [enrollmentId],
    );
    const latestVisit = latestVisitRows[0] || null;

    const activePrescriptionRows = await tenantDb.query(
      `SELECT medication_name
       FROM prescriptions
       WHERE patient_id = $1
         AND (
           status IS NULL
           OR LOWER(status) NOT IN ('cancelled', 'completed', 'discontinued', 'stopped', 'rejected')
         )`,
      [enrollment.patient_id],
    );

    const activeMedsLower = (activePrescriptionRows || [])
      .map((row: any) => String(row.medication_name || '').trim().toLowerCase())
      .filter(Boolean);

    const tbMedicationKeywords = ['rifampicin', 'rifampin', 'rifabutin', 'isoniazid', 'pyrazinamide', 'ethambutol'];
    const tbMedicationsLower = activeMedsLower.filter((medication: string) =>
      tbMedicationKeywords.some((keyword) => medication.includes(keyword)),
    );

    const regimenComponentsRaw = Array.isArray(regimen.components)
      ? regimen.components
      : (typeof regimen.components === 'string'
        ? regimen.components.split(',').map((value: string) => value.trim())
        : []);
    const regimenComponentsNormalized = regimenComponentsRaw
      .map((value: string) => this.normalizeRegimenToken(value))
      .filter(Boolean);

    const pregnancyStatus = latestVisit?.pregnancy_lactating_status || null;
    const pregnancyStatusNormalized = String(pregnancyStatus || '').trim().toUpperCase();
    const isPregnant =
      pregnancyStatusNormalized === 'P' || pregnancyStatusNormalized.includes('PREG');

    const parsedCreatinine =
      latestVisit?.creatinine_result !== undefined && latestVisit?.creatinine_result !== null
        ? Number(latestVisit.creatinine_result)
        : null;
    const creatinineResult = Number.isFinite(parsedCreatinine) ? parsedCreatinine : null;

    const parsedAlt =
      latestVisit?.alt_result !== undefined && latestVisit?.alt_result !== null
        ? Number(latestVisit.alt_result)
        : null;
    const altResult = Number.isFinite(parsedAlt) ? parsedAlt : null;

    const context = {
      requestedRegimenCode: String(requestedRegimenCode).trim(),
      regimenComponentsNormalized,
      gender: enrollment.gender || null,
      age: this.computeAgeFromDob(enrollment.date_of_birth),
      pregnancyStatus,
      isPregnant,
      tbTreatmentStarted: Boolean(latestVisit?.tb_treatment_started),
      tbMedicationsLower,
      creatinineResult,
      altResult,
      latestVisitDate: latestVisit?.visit_date || null,
    };

    const rules = await this.loadRegimenSafetyRules(tenantDb);
    let ruleVersionCode: string | null = null;
    try {
      const activeVersionRows = await tenantDb.query(
        `SELECT version_code
         FROM hiv_regimen_rule_versions
         WHERE is_active = true
         ORDER BY updated_at DESC
         LIMIT 1`,
      );
      ruleVersionCode = activeVersionRows?.[0]?.version_code || null;
    } catch (error: any) {
      this.logger.warn(
        `Unable to resolve active regimen safety rule version: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const blockers: any[] = [];
    const warnings: any[] = [];
    const requiredData = new Set<string>();
    const guidelineReferences = new Set<string>();

    for (const rule of rules) {
      const evaluation = this.evaluateRegimenSafetyRule(rule, context);

      if (evaluation.missingData.length > 0) {
        for (const field of evaluation.missingData) {
          requiredData.add(field);
        }
        const payload = {
          ruleKey: rule.rule_key,
          domain: rule.domain,
          severity: rule.severity,
          message: rule.message,
          requiredData: evaluation.missingData,
          recommendedAction: rule.recommended_action || null,
          guidelineReference: rule.guideline_reference || null,
        };
        if (String(rule.severity).toLowerCase() === 'block') {
          blockers.push(payload);
        } else {
          warnings.push(payload);
        }
        if (rule.guideline_reference) {
          guidelineReferences.add(String(rule.guideline_reference));
        }
        continue;
      }

      if (!evaluation.matched) {
        continue;
      }

      const payload = {
        ruleKey: rule.rule_key,
        domain: rule.domain,
        severity: rule.severity,
        message: rule.message,
        recommendedAction: rule.recommended_action || null,
        guidelineReference: rule.guideline_reference || null,
      };
      if (String(rule.severity).toLowerCase() === 'block') {
        blockers.push(payload);
      } else {
        warnings.push(payload);
      }
      if (rule.guideline_reference) {
        guidelineReferences.add(String(rule.guideline_reference));
      }
    }

    // CDSS: drug interaction check for the requested regimen + all active medications
    let cdssInteractions: any = null;
    const medsToCheck = [...regimenComponentsNormalized, ...activeMedsLower].filter(Boolean);
    if (medsToCheck.length >= 2) {
      cdssInteractions = await this.cdssService
        .checkDrugInteractions(medsToCheck, enrollment.patient_id)
        .catch((e: any) => {
          this.logger.warn(`CDSS interaction check failed for regimen precheck: ${e?.message || e}`);
          return null;
        });
      if (cdssInteractions?.interactions?.length) {
        for (const interaction of cdssInteractions.interactions) {
          const sev = String(interaction.severity || 'moderate').toLowerCase();
          const entry = {
            ruleKey: `cdss_ddi_${String(interaction.drug1 || '').replace(/\s+/g, '_')}_${String(interaction.drug2 || '').replace(/\s+/g, '_')}`,
            domain: 'drug_interaction',
            severity: sev === 'critical' ? 'block' : 'warn',
            message: interaction.description || `Drug interaction: ${interaction.drug1} \u2194 ${interaction.drug2}`,
            recommendedAction: interaction.recommendation || null,
            guidelineReference: interaction.reference || 'CDSS Drug Interaction Database',
          };
          if (sev === 'critical') {
            blockers.push(entry);
          } else {
            warnings.push(entry);
          }
        }
      }
    }

    return {
      allowed: blockers.length === 0,
      enrollmentId,
      requestedRegimenCode: String(requestedRegimenCode).trim(),
      requestedRegimenName: requestedRegimenName || regimen.name,
      regimen: {
        code: regimen.code,
        name: regimen.name,
        line: regimen.line,
        category: regimen.category,
        components: regimenComponentsRaw,
      },
      context: {
        gender: context.gender,
        age: context.age,
        pregnancyStatus: context.pregnancyStatus,
        tbTreatmentStarted: context.tbTreatmentStarted,
        tbMedications: tbMedicationsLower,
        creatinineResult: context.creatinineResult,
        altResult: context.altResult,
        latestVisitDate: context.latestVisitDate,
      },
      blockers,
      warnings,
      requiredData: Array.from(requiredData),
      guidelineReferences: Array.from(guidelineReferences),
      ruleVersionCode,
      cdssInteractions: cdssInteractions?.interactions ?? null,
    };
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

    if (!enrollmentId) {
      throw new BadRequestException('enrollmentId is required');
    }
    if (!requestedBy) {
      throw new BadRequestException('requestedBy is required');
    }
    if (!requestedRegimenCode || !String(requestedRegimenCode).trim()) {
      throw new BadRequestException('requestedRegimenCode is required');
    }
    if (!requestedRegimenName || !String(requestedRegimenName).trim()) {
      throw new BadRequestException('requestedRegimenName is required');
    }

    const normalizedJustification = String(clinicalJustification || '').trim();
    if (normalizedJustification.length < 15) {
      throw new BadRequestException('clinicalJustification must contain enough clinical detail (minimum 15 characters)');
    }

    const parseOptionalDate = (value: any, fieldName: string): Date | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    const parseOptionalNumber = (value: any, fieldName: string): number | null => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`${fieldName} must be numeric`);
      }
      return parsed;
    };

    const currentViralLoadNumeric = parseOptionalNumber(currentViralLoad, 'currentViralLoad');
    const previousViralLoadNumeric = parseOptionalNumber(previousViralLoad, 'previousViralLoad');
    if (currentViralLoadNumeric !== null && currentViralLoadNumeric < 0) {
      throw new BadRequestException('currentViralLoad cannot be negative');
    }
    if (previousViralLoadNumeric !== null && previousViralLoadNumeric < 0) {
      throw new BadRequestException('previousViralLoad cannot be negative');
    }

    const currentViralLoadDateParsed = parseOptionalDate(currentViralLoadDate, 'currentViralLoadDate');
    const previousViralLoadDateParsed = parseOptionalDate(previousViralLoadDate, 'previousViralLoadDate');
    const eacCompletionDateParsed = parseOptionalDate(eacCompletionDate, 'eacCompletionDate');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (currentViralLoadDateParsed && currentViralLoadDateParsed > today) {
      throw new BadRequestException('currentViralLoadDate cannot be in the future');
    }
    if (previousViralLoadDateParsed && previousViralLoadDateParsed > today) {
      throw new BadRequestException('previousViralLoadDate cannot be in the future');
    }
    if (eacCompletionDateParsed && eacCompletionDateParsed > today) {
      throw new BadRequestException('eacCompletionDate cannot be in the future');
    }

    if (currentRegimenCode && requestedRegimenCode && currentRegimenCode === requestedRegimenCode) {
      throw new BadRequestException('requestedRegimenCode must differ from the current regimen');
    }

    const providedEacSessionsCompleted = Number(eacSessionsCompleted || 0);
    if (!Number.isInteger(providedEacSessionsCompleted) || providedEacSessionsCompleted < 0) {
      throw new BadRequestException('eacSessionsCompleted must be a non-negative integer');
    }

    const enrollmentRows = await tenantDb.query(
      `SELECT id, art_start_date FROM hiv_care_enrollments WHERE id = $1 LIMIT 1`,
      [enrollmentId],
    );
    if (!enrollmentRows || enrollmentRows.length === 0) {
      throw new NotFoundException('HIV care enrollment not found');
    }
    const enrollment = enrollmentRows[0];

    const openChangeRequest = await tenantDb.query(
      `SELECT id, status
       FROM hiv_arv_change_requests
       WHERE enrollment_id = $1
         AND visit_recorded = false
         AND status IN ('pending', 'approved')
       ORDER BY request_date DESC, created_at DESC
       LIMIT 1`,
      [enrollmentId],
    );
    if (openChangeRequest.length > 0) {
      throw new BadRequestException(
        `An ${openChangeRequest[0].status} regimen change request already exists for this enrollment and is still awaiting visit recording.`,
      );
    }

    const regimenSafetyCheck = await this.precheckRegimenChange(
      {
        enrollmentId,
        requestedRegimenCode,
        requestedRegimenName,
      },
      tenantDb,
    );
    if (!regimenSafetyCheck.allowed) {
      const primaryBlocker =
        regimenSafetyCheck.blockers?.[0]?.message ||
        'Requested regimen change is blocked by regimen safety guardrails.';
      throw new BadRequestException(primaryBlocker);
    }
    const regimenSafetySummary = {
      checkedAt: new Date().toISOString(),
      allowed: regimenSafetyCheck.allowed,
      requestedRegimenCode: regimenSafetyCheck.requestedRegimenCode,
      blockers: regimenSafetyCheck.blockers || [],
      warnings: regimenSafetyCheck.warnings || [],
      requiredData: regimenSafetyCheck.requiredData || [],
      guidelineReferences: regimenSafetyCheck.guidelineReferences || [],
      context: regimenSafetyCheck.context || {},
      ruleVersionCode: regimenSafetyCheck.ruleVersionCode || null,
    };

    const eacInfo = await this.checkEacEligibility(enrollmentId, tenantDb);
    const eacSessionCountRows = await tenantDb.query(
      `SELECT COUNT(*) as count
       FROM hiv_eac_sessions
       WHERE enrollment_id = $1`,
      [enrollmentId],
    );
    const authoritativeEacSessionsCompleted = parseInt(eacSessionCountRows[0]?.count || '0', 10);
    const authoritativeEacCompleted = Boolean(eacInfo?.eacCompleted);

    const vlPathway = await this.getVlPathway(enrollmentId, tenantDb);
    const rationale = `${changeReasonDetails || ''} ${normalizedJustification}`.toLowerCase();
    const hasNonFailureIndication =
      /toxicity|toxic|intoler|allerg|pregnan|interaction|contraind|side effect|adverse|renal|hepatic/.test(
        rationale,
      );

    if (vlPathway.status === 'not_on_art') {
      throw new BadRequestException('Regimen change request cannot be created because patient is not currently on ART.');
    }

    const artStartDate = enrollment?.art_start_date ? new Date(enrollment.art_start_date) : null;
    const monthsOnArt =
      artStartDate && !Number.isNaN(artStartDate.getTime())
        ? (today.getTime() - artStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        : null;
    if (
      monthsOnArt !== null &&
      monthsOnArt < 6 &&
      (vlPathway.status === 'high_vl' || vlPathway.status === 'high_vl_needs_eac' || vlPathway.status === 'failure_after_eac') &&
      !hasNonFailureIndication
    ) {
      throw new BadRequestException(
        'Possible virologic failure before 6 months on ART. Continue adherence support and repeat viral load per guideline timeline unless non-failure indication exists.',
      );
    }

    if (
      (vlPathway.status === 'suppressed' || vlPathway.status === 'post_eac_suppressed') &&
      !hasNonFailureIndication
    ) {
      throw new BadRequestException(
        'Current viral load pathway is suppressed. Provide a clear non-failure indication (e.g., toxicity/intolerance) before requesting regimen change.',
      );
    }

    if (
      (vlPathway.status === 'high_vl' || vlPathway.status === 'high_vl_needs_eac') &&
      !authoritativeEacCompleted &&
      authoritativeEacSessionsCompleted < 3 &&
      !hasNonFailureIndication
    ) {
      throw new BadRequestException(
        'Regimen change for unsuppressed viral load requires completed EAC sessions or documented non-failure indication.',
      );
    }

    const dateToIso = (value: Date | null): string | null =>
      value ? value.toISOString().split('T')[0] : null;

    const baseInsertParams = [
      enrollmentId, requestedBy, requestedByName || null,
      currentRegimenCode || null, currentRegimenName || null,
      currentViralLoadNumeric, dateToIso(currentViralLoadDateParsed),
      previousViralLoadNumeric, dateToIso(previousViralLoadDateParsed),
      authoritativeEacCompleted, authoritativeEacSessionsCompleted, dateToIso(eacCompletionDateParsed),
      requestedRegimenCode, requestedRegimenName,
      changeReasonCode || null, changeReasonDetails || null, normalizedJustification,
    ];

    let result: any[] = [];
    try {
      result = await tenantDb.query(
        `
          INSERT INTO hiv_arv_change_requests (
            enrollment_id, requested_by, requested_by_name,
            current_regimen_code, current_regimen_name,
            current_viral_load, current_viral_load_date,
            previous_viral_load, previous_viral_load_date,
            eac_completed, eac_sessions_completed, eac_completion_date,
            requested_regimen_code, requested_regimen_name,
            change_reason_code, change_reason_details, clinical_justification,
            regimen_safety_summary, regimen_safety_blocked
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19
          )
          RETURNING *
        `,
        [...baseInsertParams, JSON.stringify(regimenSafetySummary), false],
      );
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        String(error?.code || '') === '42703' ||
        /regimen_safety_summary|regimen_safety_blocked/i.test(message)
      ) {
        this.logger.warn(
          'hiv_arv_change_requests is missing regimen safety columns; writing legacy row without regimen_safety_summary.',
        );
        result = await tenantDb.query(
          `
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
          `,
          baseInsertParams,
        );
      } else {
        throw error;
      }
    }

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

    if (!approvedBy) {
      throw new BadRequestException('approvedBy is required');
    }

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
      throw new BadRequestException('Change request not found or already processed');
    }

    return result[0];
  }

  async rejectArvChangeRequest(requestId: string, body: any, tenantDb: DataSource) {
    const { approvedBy, approvedByName, rejectionReason } = body;

    if (!approvedBy) {
      throw new BadRequestException('approvedBy is required');
    }
    if (!rejectionReason || !String(rejectionReason).trim()) {
      throw new BadRequestException('rejectionReason is required');
    }

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
    `, [approvedBy, approvedByName || null, String(rejectionReason).trim(), requestId]);

    if (!result[0]) {
      throw new BadRequestException('Change request not found or already processed');
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

  // Check if patient needs EAC based on viral load (WHO-aligned: last 2 consecutive VL results >1000 on ART)
  async checkEacEligibility(enrollmentId: string, tenantDb: DataSource) {
    const recentVisits = await tenantDb.query(
      `SELECT viral_load, viral_load_test_date, visit_date, arv_status
       FROM hiv_clinical_visits
       WHERE enrollment_id = $1 
       AND viral_load IS NOT NULL
       ORDER BY COALESCE(viral_load_test_date, visit_date) DESC
       LIMIT 2`,
      [enrollmentId]
    );

    const enrollmentRows = await tenantDb.query(
      `SELECT art_start_date
       FROM hiv_care_enrollments
       WHERE id = $1
       LIMIT 1`,
      [enrollmentId],
    );
    const enrollmentHasArtStartDate = Boolean(enrollmentRows[0]?.art_start_date);

    const lastTwoVisits = recentVisits.slice(0, 2);
    const onArtStates = new Set(['2a', '2b', '3', '4', '6']);
    const bothHighVl =
      lastTwoVisits.length === 2 &&
      lastTwoVisits.every((visit: any) => Number(visit.viral_load) >= 1000);
    const bothOnArtByVisitStatus =
      lastTwoVisits.length === 2 &&
      lastTwoVisits.every((visit: any) => onArtStates.has(String(visit.arv_status || '').trim()));
    const bothOnArt = bothOnArtByVisitStatus || enrollmentHasArtStartDate;
    const needsEac = bothHighVl && bothOnArt;
    
    // Check if the two high VL results are 3-6 months apart
    let visitsValid = false;
    if (lastTwoVisits.length === 2) {
      const date1 = new Date(lastTwoVisits[0].viral_load_test_date || lastTwoVisits[0].visit_date);
      const date2 = new Date(lastTwoVisits[1].viral_load_test_date || lastTwoVisits[1].visit_date);
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

  async getCohortWorklist(
    query: {
      focus?: string;
      limit?: string | number;
    },
    tenantDb: DataSource,
  ) {
    const focus = String(query?.focus || 'all').trim().toLowerCase();
    const limit = this.clampLimit(query?.limit, 50, 200);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await tenantDb.query(
      `
      SELECT
        e.id AS enrollment_id,
        e.patient_id,
        e.enrollment_number,
        e.enrollment_date,
        e.art_start_date,
        e.current_regimen,
        p.patient_number,
        p.first_name,
        p.last_name,
        latest_visit.visit_date,
        latest_visit.next_review_date,
        latest_visit.viral_load,
        latest_visit.viral_load_test_date,
        latest_visit.viral_load_unit,
        latest_visit.viral_load_suppressed,
        latest_visit.arv_status,
        latest_visit.arv_regimen_name,
        latest_visit.arv_adherence_percentage,
        latest_visit.tpt_status,
        latest_intake.recorded_at AS intake_recorded_at,
        latest_intake.adherence_percentage AS intake_adherence_percentage,
        latest_intake.regimen AS intake_regimen,
        COALESCE(active_eac.active_session_count, 0) AS active_eac_session_count,
        active_eac.latest_session_date AS active_eac_session_date,
        completed_eac.latest_completion_date AS completed_eac_date,
        COALESCE(arv_queue.pending_request_count, 0) AS pending_request_count,
        COALESCE(arv_queue.approved_without_visit_count, 0) AS approved_without_visit_count
      FROM hiv_care_enrollments e
      INNER JOIN patients p ON p.id = e.patient_id
      LEFT JOIN LATERAL (
        SELECT
          v.visit_date,
          v.next_review_date,
          v.viral_load,
          v.viral_load_test_date,
          v.viral_load_unit,
          v.viral_load_suppressed,
          v.arv_status,
          v.arv_regimen_name,
          v.arv_adherence_percentage,
          v.tpt_status
        FROM hiv_clinical_visits v
        WHERE v.enrollment_id = e.id
        ORDER BY v.visit_date DESC, v.created_at DESC
        LIMIT 1
      ) latest_visit ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          recorded_at,
          adherence_percentage,
          regimen
        FROM hiv_nurse_intakes ni
        WHERE ni.patient_id = e.patient_id
        ORDER BY ni.recorded_at DESC
        LIMIT 1
      ) latest_intake ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_request_count,
          COUNT(*) FILTER (
            WHERE status = 'approved' AND COALESCE(visit_recorded, false) = false
          ) AS approved_without_visit_count
        FROM hiv_arv_change_requests r
        WHERE r.enrollment_id = e.id
      ) arv_queue ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS active_session_count,
          MAX(session_date) AS latest_session_date
        FROM hiv_eac_sessions session
        WHERE session.enrollment_id = e.id
          AND session.eac_program_status = 'Active'
      ) active_eac ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          MAX(eac_completion_date) AS latest_completion_date
        FROM hiv_eac_sessions session
        WHERE session.enrollment_id = e.id
          AND session.eac_program_status = 'Completed'
      ) completed_eac ON TRUE
      WHERE e.enrollment_status = 'active'
        AND (
          latest_visit.visit_date IS NULL
          OR latest_visit.visit_date < CURRENT_DATE - INTERVAL '30 days'
          OR latest_visit.next_review_date < CURRENT_DATE
          OR latest_visit.viral_load IS NULL
          OR latest_visit.viral_load_test_date IS NULL
          OR latest_visit.viral_load_test_date < CURRENT_DATE - INTERVAL '180 days'
          OR latest_visit.viral_load >= 1000
          OR COALESCE(latest_intake.adherence_percentage, latest_visit.arv_adherence_percentage, 100) < 95
          OR COALESCE(arv_queue.pending_request_count, 0) > 0
          OR COALESCE(arv_queue.approved_without_visit_count, 0) > 0
        )
      ORDER BY p.last_name ASC, p.first_name ASC
      LIMIT $1
      `,
      [Math.max(limit * 3, 100)],
    );

    const items = rows
      .map((row: any) => {
        const enrollmentDate = this.parseOptionalDateValue(row.enrollment_date);
        const artStartDate = this.parseOptionalDateValue(row.art_start_date);
        const lastVisitDate = this.parseOptionalDateValue(row.visit_date);
        const nextReviewDate = this.parseOptionalDateValue(row.next_review_date);
        const lastVlDate = this.parseOptionalDateValue(row.viral_load_test_date || row.visit_date);
        const intakeRecordedAt = this.parseOptionalDateValue(row.intake_recorded_at);
        const completedEacDate = this.parseOptionalDateValue(row.completed_eac_date);
        const activeEacSessionDate = this.parseOptionalDateValue(row.active_eac_session_date);
        const lastViralLoad =
          row.viral_load !== null && row.viral_load !== undefined
            ? Number.parseFloat(String(row.viral_load))
            : null;
        const adherencePercentageRaw =
          row.intake_adherence_percentage !== null && row.intake_adherence_percentage !== undefined
            ? row.intake_adherence_percentage
            : row.arv_adherence_percentage;
        const adherencePercentage =
          adherencePercentageRaw !== null && adherencePercentageRaw !== undefined
            ? Number.parseInt(String(adherencePercentageRaw), 10)
            : null;

        const referenceVisitDate = lastVisitDate || enrollmentDate || today;
        const daysSinceLastVisit = referenceVisitDate ? this.diffDays(referenceVisitDate, today) : null;
        const overdueVisit =
          (lastVisitDate && this.diffDays(lastVisitDate, today) >= 30) ||
          (!lastVisitDate && enrollmentDate !== null && this.diffDays(enrollmentDate, today) >= 30) ||
          (nextReviewDate !== null && this.diffDays(nextReviewDate, today) > 0);
        const ltfuRisk = daysSinceLastVisit !== null && daysSinceLastVisit >= 90;
        const unsuppressed = lastViralLoad !== null && lastViralLoad >= 1000;

        let nextVlDate: Date | null = null;
        if (artStartDate || lastVlDate || lastViralLoad !== null) {
          nextVlDate = this.monitoringService.calculateNextViralLoadDate(
            artStartDate,
            lastVlDate,
            lastViralLoad,
            null,
            today,
          );
        }

        const overdueViralLoad = nextVlDate !== null && this.diffDays(nextVlDate, today) > 0;
        const overdueViralLoadDays = nextVlDate !== null ? Math.max(this.diffDays(nextVlDate, today), 0) : 0;
        const activeEac = Number(row.active_eac_session_count || 0) > 0;
        const lowAdherence = adherencePercentage !== null && adherencePercentage < 95;
        const pendingRegimenReview = Number(row.pending_request_count || 0) > 0;
        const approvedRegimenVisitPending = Number(row.approved_without_visit_count || 0) > 0;
        const completedEacStillUnsuppressed =
          unsuppressed &&
          completedEacDate !== null &&
          lastVlDate !== null &&
          completedEacDate.getTime() <= lastVlDate.getTime();

        const reasons: string[] = [];
        const secondaryActions: string[] = [];
        let primaryAction = 'book_clinical_review';
        let priority: 'critical' | 'high' | 'medium' = 'medium';

        if (approvedRegimenVisitPending) {
          primaryAction = 'document_regimen_change_visit';
          priority = 'critical';
          reasons.push('Approved regimen change is still missing a linked follow-up visit.');
        } else if (pendingRegimenReview) {
          primaryAction = 'doctor_review_pending_regimen_change';
          priority = 'high';
          reasons.push('Pending ARV change request is waiting for doctor review.');
        } else if (completedEacStillUnsuppressed) {
          primaryAction = 'doctor_review_failed_eac';
          priority = 'critical';
          reasons.push('Latest viral load remains unsuppressed after completed EAC.');
        } else if (unsuppressed && activeEac) {
          primaryAction = 'continue_eac';
          priority = 'high';
          reasons.push('Latest viral load is unsuppressed and the patient is already on active EAC.');
        } else if (unsuppressed) {
          primaryAction = 'start_eac';
          priority = 'high';
          reasons.push('Latest viral load is unsuppressed and requires EAC workflow.');
        } else if (overdueViralLoad) {
          primaryAction = 'collect_viral_load';
          priority = overdueViralLoadDays >= 30 ? 'high' : 'medium';
          reasons.push('Viral load monitoring is overdue.');
        } else if (lowAdherence) {
          primaryAction = 'adherence_counseling';
          priority = adherencePercentage !== null && adherencePercentage < 85 ? 'high' : 'medium';
          reasons.push('Recent adherence capture is below target.');
        } else if (ltfuRisk) {
          primaryAction = 'patient_outreach';
          priority = 'critical';
          reasons.push('Patient is at lost-to-follow-up risk based on last clinical contact.');
        } else if (overdueVisit) {
          primaryAction = 'book_clinical_review';
          priority = 'high';
          reasons.push('Clinical review is overdue.');
        }

        if (ltfuRisk && primaryAction !== 'patient_outreach') {
          secondaryActions.push('patient_outreach');
          reasons.push('Patient is at risk of becoming lost to follow-up.');
          if (priority === 'medium') {
            priority = 'high';
          }
        }
        if (overdueVisit && primaryAction !== 'book_clinical_review') {
          secondaryActions.push('book_clinical_review');
        }
        if (overdueViralLoad && primaryAction !== 'collect_viral_load') {
          secondaryActions.push('collect_viral_load');
        }
        if (lowAdherence && primaryAction !== 'adherence_counseling') {
          secondaryActions.push('adherence_counseling');
        }
        if (unsuppressed && activeEac && primaryAction !== 'continue_eac') {
          secondaryActions.push('continue_eac');
        } else if (unsuppressed && !activeEac && !completedEacStillUnsuppressed && primaryAction !== 'start_eac') {
          secondaryActions.push('start_eac');
        }
        if (pendingRegimenReview && primaryAction !== 'doctor_review_pending_regimen_change') {
          secondaryActions.push('doctor_review_pending_regimen_change');
        }
        if (approvedRegimenVisitPending && primaryAction !== 'document_regimen_change_visit') {
          secondaryActions.push('document_regimen_change_visit');
        }

        const flags = {
          overdueVisit,
          overdueViralLoad,
          unsuppressed,
          activeEac,
          lowAdherence,
          ltfuRisk,
          pendingRegimenReview,
          approvedRegimenVisitPending,
          completedEacStillUnsuppressed,
        };

        const item = {
          enrollmentId: row.enrollment_id,
          patientId: row.patient_id,
          enrollmentNumber: row.enrollment_number,
          patientNumber: row.patient_number,
          patientName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Unknown',
          currentRegimen:
            row.arv_regimen_name || row.intake_regimen || row.current_regimen || null,
          lastVisitDate: this.formatDateOnly(lastVisitDate),
          nextReviewDate: this.formatDateOnly(nextReviewDate),
          daysSinceLastVisit,
          lastViralLoad,
          lastViralLoadDate: this.formatDateOnly(lastVlDate),
          viralLoadUnit: row.viral_load_unit || 'copies/mL',
          nextViralLoadDate: this.formatDateOnly(nextVlDate),
          overdueViralLoadDays,
          adherencePercentage,
          lastIntakeDate: this.formatDateOnly(intakeRecordedAt),
          activeEac,
          activeEacSessionCount: Number(row.active_eac_session_count || 0),
          activeEacSessionDate: this.formatDateOnly(activeEacSessionDate),
          completedEacDate: this.formatDateOnly(completedEacDate),
          pendingRegimenRequestCount: Number(row.pending_request_count || 0),
          approvedRegimenChangesWithoutVisit: Number(row.approved_without_visit_count || 0),
          primaryAction,
          secondaryActions: Array.from(new Set(secondaryActions)),
          priority,
          flags,
          reasons,
        };

        return item;
      })
      .filter((item: any) => {
        switch (focus) {
          case 'unsuppressed':
            return item.flags.unsuppressed;
          case 'overdue_visit':
            return item.flags.overdueVisit || item.flags.ltfuRisk;
          case 'overdue_vl':
            return item.flags.overdueViralLoad;
          case 'adherence':
            return item.flags.lowAdherence;
          case 'regimen_review':
            return item.flags.pendingRegimenReview || item.flags.approvedRegimenVisitPending || item.flags.completedEacStillUnsuppressed;
          default:
            return true;
        }
      })
      .sort((a: any, b: any) => {
        const priorityWeight = { critical: 3, high: 2, medium: 1 };
        const priorityDelta = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        const overdueVisitDelta = (b.daysSinceLastVisit || 0) - (a.daysSinceLastVisit || 0);
        if (overdueVisitDelta !== 0) {
          return overdueVisitDelta;
        }
        return (b.overdueViralLoadDays || 0) - (a.overdueViralLoadDays || 0);
      })
      .slice(0, limit);

    const summary = items.reduce(
      (acc: any, item: any) => {
        acc.totalItems += 1;
        acc.byPriority[item.priority] += 1;
        acc.byPrimaryAction[item.primaryAction] = (acc.byPrimaryAction[item.primaryAction] || 0) + 1;
        if (item.flags.unsuppressed) acc.flagCounts.unsuppressed += 1;
        if (item.flags.overdueVisit) acc.flagCounts.overdueVisit += 1;
        if (item.flags.overdueViralLoad) acc.flagCounts.overdueViralLoad += 1;
        if (item.flags.lowAdherence) acc.flagCounts.lowAdherence += 1;
        if (item.flags.ltfuRisk) acc.flagCounts.ltfuRisk += 1;
        if (item.flags.pendingRegimenReview) acc.flagCounts.pendingRegimenReview += 1;
        if (item.flags.approvedRegimenVisitPending) acc.flagCounts.approvedRegimenVisitPending += 1;
        return acc;
      },
      {
        totalItems: 0,
        byPriority: {
          critical: 0,
          high: 0,
          medium: 0,
        },
        byPrimaryAction: {} as Record<string, number>,
        flagCounts: {
          unsuppressed: 0,
          overdueVisit: 0,
          overdueViralLoad: 0,
          lowAdherence: 0,
          ltfuRisk: 0,
          pendingRegimenReview: 0,
          approvedRegimenVisitPending: 0,
        },
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      focus,
      limit,
      summary,
      items,
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

  async getVlPathway(enrollmentId: string, tenantDb: DataSource) {
    const enrollmentRows = await tenantDb.query(
      `SELECT id, enrollment_date, art_start_date 
       FROM hiv_care_enrollments 
       WHERE id = $1`,
      [enrollmentId],
    );

    if (!enrollmentRows || enrollmentRows.length === 0) {
      throw new NotFoundException('HIV care enrollment not found');
    }

    const enrollment = enrollmentRows[0];

    const vlVisits = await tenantDb.query(
      `SELECT 
         viral_load,
         viral_load_unit,
         COALESCE(viral_load_test_date, visit_date) as vl_date,
         visit_date,
         arv_status
       FROM hiv_clinical_visits
       WHERE enrollment_id = $1
       AND viral_load IS NOT NULL
       ORDER BY COALESCE(viral_load_test_date, visit_date) DESC`,
      [enrollmentId],
    );

    const latestVl = vlVisits.length > 0 ? vlVisits[0] : null;
    const secondLatestVl = vlVisits.length > 1 ? vlVisits[1] : null;

    const onArtRow = await tenantDb.query(
      `SELECT COUNT(*) as count 
       FROM hiv_clinical_visits 
       WHERE enrollment_id = $1
       AND arv_status IN ('2a','2b','3','4','6')`,
      [enrollmentId],
    );

    const everOnArt = parseInt(onArtRow[0]?.count || '0') > 0 || !!enrollment.art_start_date;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const artStartDate = enrollment.art_start_date ? new Date(enrollment.art_start_date) : null;
    const lastVlDate = latestVl?.vl_date ? new Date(latestVl.vl_date) : null;
    const lastVlResult =
      latestVl && latestVl.viral_load !== null && latestVl.viral_load !== undefined
        ? parseFloat(latestVl.viral_load.toString())
        : null;

    let nextVlDate: string | null = null;
    if (everOnArt) {
      const nextDate = this.monitoringService.calculateNextViralLoadDate(
        artStartDate,
        lastVlDate,
        lastVlResult,
        null,
        today,
      );
      nextVlDate = nextDate.toISOString().split('T')[0];
    }

    const eacInfo = await this.checkEacEligibility(enrollmentId, tenantDb);

    let status = 'no_vl';
    const actions: string[] = [];

    if (!everOnArt) {
      status = 'not_on_art';
      actions.push('initiate_art');
    } else if (!latestVl) {
      status = 'vl_missing_on_art';
      actions.push('collect_vl');
    } else if (lastVlResult !== null && lastVlResult < 1000) {
      if (eacInfo.eacCompleted && eacInfo.eacCompletedAndSuppressed) {
        status = 'post_eac_suppressed';
      } else {
        status = 'suppressed';
      }
    } else if (lastVlResult !== null && lastVlResult >= 1000) {
      if (eacInfo.activeEac) {
        status = 'high_vl_on_eac';
        actions.push('continue_eac');
        actions.push('repeat_vl');
      } else if (eacInfo.needsEac) {
        status = 'high_vl_needs_eac';
        actions.push('start_eac');
        actions.push('repeat_vl_after_eac');
      } else if (eacInfo.eacCompleted && !eacInfo.eacCompletedAndSuppressed) {
        status = 'failure_after_eac';
        actions.push('consider_switch');
      } else {
        status = 'high_vl';
        actions.push('start_eac');
      }
    }

    let overdue = false;
    if (nextVlDate) {
      const next = new Date(nextVlDate);
      next.setHours(0, 0, 0, 0);
      overdue = next < today;
      if (overdue && !actions.includes('collect_vl')) {
        actions.push('collect_vl');
      }
    }

    return {
      status,
      everOnArt,
      lastVlValue: lastVlResult,
      lastVlDate: lastVlDate ? lastVlDate.toISOString().split('T')[0] : null,
      lastVlUnit: latestVl?.viral_load_unit || 'copies/mL',
      secondLastVlValue:
        secondLatestVl && secondLatestVl.viral_load !== null && secondLatestVl.viral_load !== undefined
          ? parseFloat(secondLatestVl.viral_load.toString())
          : null,
      secondLastVlDate:
        secondLatestVl && (secondLatestVl.viral_load_test_date || secondLatestVl.visit_date)
          ? new Date(
              secondLatestVl.viral_load_test_date || secondLatestVl.visit_date,
            ).toISOString().split('T')[0]
          : null,
      nextVlDate,
      overdue,
      actions,
      eac: eacInfo,
    };
  }

  async getDsdStatus(enrollmentId: string, tenantDb: DataSource) {
    const enrollmentRows = await tenantDb.query(
      `SELECT id, enrollment_date, art_start_date 
       FROM hiv_care_enrollments 
       WHERE id = $1`,
      [enrollmentId],
    );

    if (!enrollmentRows || enrollmentRows.length === 0) {
      throw new NotFoundException('HIV care enrollment not found');
    }

    const enrollment = enrollmentRows[0];

    const lastVisitRows = await tenantDb.query(
      `SELECT 
         visit_type,
         visit_date,
         arv_status,
         cd4_count,
         cd4_test_date,
         viral_load,
         viral_load_test_date
       FROM hiv_clinical_visits
       WHERE enrollment_id = $1
       ORDER BY visit_date DESC, visit_number DESC
       LIMIT 1`,
      [enrollmentId],
    );

    const lastVisit = lastVisitRows.length > 0 ? lastVisitRows[0] : null;

    const adherenceRows = await tenantDb.query(
      `SELECT adherence_percentage, tracking_date
       FROM hiv_adherence_tracking
       WHERE enrollment_id = $1
       ORDER BY tracking_date DESC
       LIMIT 1`,
      [enrollmentId],
    );

    const adherence = adherenceRows.length > 0 ? adherenceRows[0] : null;

    const artStartDate = enrollment.art_start_date ? new Date(enrollment.art_start_date) : null;

    const onArtRow = await tenantDb.query(
      `SELECT COUNT(*) as count 
       FROM hiv_clinical_visits 
       WHERE enrollment_id = $1
       AND arv_status IN ('2a','2b','3','4','6')`,
      [enrollmentId],
    );

    const everOnArt = parseInt(onArtRow[0]?.count || '0') > 0 || !!enrollment.art_start_date;

    let currentModel = 'conventional';
    const visitType = lastVisit?.visit_type || null;

    if (visitType) {
      if (['E', 'F'].includes(visitType)) {
        currentModel = 'group_dsd';
      } else if (['B', 'D', 'G', 'J', 'K'].includes(visitType)) {
        currentModel = 'fast_track';
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastVlValue =
      lastVisit && lastVisit.viral_load !== null && lastVisit.viral_load !== undefined
        ? parseFloat(lastVisit.viral_load.toString())
        : null;
    const lastVlDateRaw = lastVisit
      ? lastVisit.viral_load_test_date || lastVisit.visit_date || null
      : null;
    const lastVlDate = lastVlDateRaw ? new Date(lastVlDateRaw) : null;

    const lastCd4Value =
      lastVisit && lastVisit.cd4_count !== null && lastVisit.cd4_count !== undefined
        ? parseInt(lastVisit.cd4_count.toString(), 10)
        : null;
    const lastCd4Date = lastVisit && lastVisit.cd4_test_date ? new Date(lastVisit.cd4_test_date) : null;

    const failureCheck = this.monitoringService.checkTreatmentFailure(
      lastVisit?.arv_status || '',
      lastVlValue,
      lastVlDate,
      lastCd4Value,
      lastCd4Date,
      today,
    );

    const reasons: string[] = [];
    let eligibleForDsd = false;
    let recommendedModel: string | null = null;

    if (!everOnArt) {
      reasons.push('Client is not on ART');
    } else {
      if (lastVlValue === null) {
        reasons.push('No recent viral load result');
      }
      if (lastVlValue !== null && lastVlValue >= 1000) {
        reasons.push('High viral load');
      }
      if (failureCheck.isTreatmentFailure) {
        reasons.push('Possible or confirmed treatment failure');
      }
      if (adherence && adherence.adherence_percentage !== null) {
        const adherenceValue = parseFloat(adherence.adherence_percentage.toString());
        if (adherenceValue < 95) {
          reasons.push('Adherence below 95%');
        }
      }

      const vlSuppressed = lastVlValue !== null && lastVlValue < 1000;
      const goodAdherence =
        !adherence ||
        (adherence.adherence_percentage !== null &&
          parseFloat(adherence.adherence_percentage.toString()) >= 95);

      if (vlSuppressed && goodAdherence && !failureCheck.isTreatmentFailure) {
        eligibleForDsd = true;
        recommendedModel = currentModel === 'conventional' ? 'fast_track' : currentModel;
      }
    }

    return {
      currentModel,
      currentModelSourceVisitType: visitType,
      artStartDate: artStartDate ? artStartDate.toISOString().split('T')[0] : null,
      lastVisitDate: lastVisit?.visit_date || null,
      lastVlValue,
      lastVlDate: lastVlDate ? lastVlDate.toISOString().split('T')[0] : null,
      adherencePercentage: adherence?.adherence_percentage ?? null,
      everOnArt,
      eligibleForDsd,
      recommendedModel,
      reasons,
    };
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
