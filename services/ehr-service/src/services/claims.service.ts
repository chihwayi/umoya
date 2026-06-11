import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalAidClaim, ClaimStatus, MedicalAidProvider } from '../entities/medical-aid-claim.entity';
import { MedicalAidClaimLine } from '../entities/medical-aid-claim-line.entity';
import { Bill } from '../entities/billing.entity';
import { MedicalAidApiService } from './medical-aid-api.service';
import { NotificationCenterService } from './notification-center.service';
import { ClaimDenialPrediction } from '../entities/claim-denial-prediction.entity';
import { FinancialClearanceAssessment } from '../entities/financial-clearance-assessment.entity';
import { PriorAuthorizationDraft } from '../entities/prior-authorization-draft.entity';

export interface ClaimReadinessIssue {
  code: string;
  message: string;
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private readonly medicalAidApiService?: MedicalAidApiService,
    private readonly notificationCenterService?: NotificationCenterService,
  ) {}

  private clampLimit(value: any, fallback = 50, max = 200) {
    const parsed = Number.parseInt(String(value || fallback), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private parseJsonObject<T = any>(value: any, fallback: T): T {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value === 'object') {
      return value as T;
    }
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return fallback;
    }
  }

  private parseArray(value: any): string[] {
    if (Array.isArray(value)) {
      return value.filter(Boolean).map((item) => String(item));
    }
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return [];
  }

  private normalizeDate(value: any): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  private dateOnly(value: Date | null): string | null {
    if (!value) {
      return null;
    }
    return value.toISOString().split('T')[0];
  }

  private isMissingSchemaError(error: unknown) {
    const code = (error as any)?.code;
    return code === '42P01' || code === '42703';
  }

  private async safeQuery(tenantDb: DataSource, sql: string, params: any[] = []) {
    try {
      return await tenantDb.query(sql, params);
    } catch (error) {
      if (!this.isMissingSchemaError(error)) {
        throw error;
      }
      return [];
    }
  }

  private hasAttachmentOfType(claimData: Record<string, any>, expectedTypes: string[]) {
    const attachments = Array.isArray(claimData?.attachments)
      ? claimData.attachments
      : Array.isArray(claimData?.documents)
        ? claimData.documents
        : [];

    return attachments.some((attachment: any) => {
      const type = String(
        attachment?.documentType || attachment?.type || attachment?.category || attachment || '',
      )
        .trim()
        .toLowerCase();
      return expectedTypes.includes(type);
    });
  }

  private buildClaimIssue(code: string, message: string): ClaimReadinessIssue {
    return { code, message };
  }

  private toCurrencyAmount(value: any): number {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }

  private classifyDenialRisk(score: number) {
    if (score >= 70) {
      return 'high';
    }
    if (score >= 40) {
      return 'medium';
    }
    return 'low';
  }

  private buildDenialPrediction(args: {
    claimId: string;
    blockers: ClaimReadinessIssue[];
    warnings: ClaimReadinessIssue[];
    missingDocuments: ClaimReadinessIssue[];
    latestRejection?: { change_reason?: string | null } | null;
    preAuthStatus?: string | null;
    insuranceVerified?: boolean | null;
  }) {
    const drivers: Array<Record<string, any>> = [];
    for (const blocker of args.blockers) {
      drivers.push({ severity: 'blocker', code: blocker.code, message: blocker.message });
    }
    for (const warning of args.warnings.slice(0, 5)) {
      drivers.push({ severity: 'warning', code: warning.code, message: warning.message });
    }

    let riskScore = args.blockers.length * 24 + args.warnings.length * 9 + args.missingDocuments.length * 11;
    if (args.latestRejection) {
      riskScore += 12;
    }
    if (args.preAuthStatus && args.preAuthStatus.toLowerCase() !== 'approved') {
      riskScore += 10;
    }
    if (args.insuranceVerified === false) {
      riskScore += 8;
    }
    riskScore = Math.min(100, Math.max(0, Number(riskScore.toFixed(2))));

    const recommendedActions = Array.from(
      new Set(
        [
          ...args.blockers.map((issue) => `Resolve ${issue.code.replace(/_/g, ' ')}.`),
          ...args.missingDocuments.map((issue) => `Attach ${issue.code.replace(/^missing_/, '').replace(/_/g, ' ')}.`),
          args.latestRejection ? 'Review the previous denial reason before submission.' : null,
          args.preAuthStatus && args.preAuthStatus.toLowerCase() !== 'approved'
            ? 'Obtain approved pre-authorization before submission.'
            : null,
          args.insuranceVerified === false ? 'Complete front-desk eligibility verification.' : null,
        ].filter(Boolean) as string[],
      ),
    ).slice(0, 8);

    return {
      claimId: args.claimId,
      riskScore,
      riskLevel: this.classifyDenialRisk(riskScore),
      blockersCount: args.blockers.length,
      warningsCount: args.warnings.length,
      missingDocumentsCount: args.missingDocuments.length,
      drivers,
      recommendedActions,
      modelVersion: 'rules.v1',
    };
  }

  private async persistClaimDenialPrediction(
    tenantDb: DataSource,
    prediction: {
      claimId: string;
      riskScore: number;
      riskLevel: string;
      blockersCount: number;
      warningsCount: number;
      missingDocumentsCount: number;
      drivers: Array<Record<string, any>>;
      recommendedActions: string[];
      modelVersion: string;
    },
  ) {
    const repository = tenantDb.getRepository(ClaimDenialPrediction);
    return repository.save(
      repository.create({
        blockersCount: prediction.blockersCount,
        claimId: prediction.claimId,
        drivers: prediction.drivers,
        missingDocumentsCount: prediction.missingDocumentsCount,
        modelVersion: prediction.modelVersion,
        recommendedActions: prediction.recommendedActions,
        riskLevel: prediction.riskLevel,
        riskScore: prediction.riskScore,
        warningsCount: prediction.warningsCount,
      }),
    );
  }

  private async getLatestEligibilitySignal(
    tenantDb: DataSource,
    patientId: string | null,
    medicalAidName: string,
    memberNumber: string,
  ) {
    if (!patientId && !medicalAidName && !memberNumber) {
      return null;
    }

    const rows = await this.safeQuery(
      tenantDb,
      `
        SELECT
          status,
          confidence,
          coverage_flags,
          response_payload,
          checked_at
        FROM insurance_eligibility_checks
        WHERE ($1::uuid IS NULL OR patient_id = $1::uuid)
          AND ($2::text = '' OR LOWER(COALESCE(provider_name, '')) = LOWER($2))
          AND ($3::text = '' OR COALESCE(member_number, '') = $3)
        ORDER BY checked_at DESC, created_at DESC
        LIMIT 1
      `,
      [patientId || null, medicalAidName || '', memberNumber || ''],
    );

    return rows[0] || null;
  }

  private deriveFinancialClearance(args: {
    claimId: string;
    patientId: string | null;
    billId: string | null;
    appointmentId: string | null;
    claimAmount: number;
    blockers: ClaimReadinessIssue[];
    readinessStatus: string;
    preAuth: any | null;
    claimData: Record<string, any>;
    appointment: any | null;
    insuranceSignal: any | null;
  }) {
    const insuranceStatus = String(args.insuranceSignal?.status || '').toLowerCase();
    const eligibilityStatus =
      insuranceStatus ||
      (args.appointment?.insurance_verified === true
        ? 'verified_active'
        : args.appointment?.insurance_verified === false
          ? 'verification_required'
          : 'unknown');

    const authorizationRequired = Boolean(
      args.claimData.requiresPreauthorization ||
        args.claimData.requiresPreAuth ||
        args.preAuth ||
        ['mri', 'ct', 'surgery', 'procedure'].includes(String(args.claimData.procedureType || '').toLowerCase()),
    );
    const authorizationStatus = args.preAuth ? String(args.preAuth.status || '').toLowerCase() : null;

    let coverageRatio = 0;
    const responsePayload = this.parseJsonObject<Record<string, any>>(args.insuranceSignal?.response_payload, {});
    const memberDetails = this.parseJsonObject<Record<string, any>>(responsePayload?.memberDetails, {});
    const rawCoverage =
      memberDetails.coveragePercentage ??
      memberDetails.coverage_percent ??
      args.claimData.coveragePercentage ??
      args.claimData.coveragePercent ??
      null;
    const parsedCoverage = Number(rawCoverage);

    if (Number.isFinite(parsedCoverage) && parsedCoverage > 0) {
      coverageRatio = parsedCoverage > 1 ? parsedCoverage / 100 : parsedCoverage;
    } else if (eligibilityStatus === 'verified_active') {
      coverageRatio = 0.8;
    }

    if (authorizationRequired && authorizationStatus && authorizationStatus !== 'approved') {
      coverageRatio = Math.min(coverageRatio, 0.5);
    }
    if (eligibilityStatus === 'verification_failed' || eligibilityStatus === 'ineligible') {
      coverageRatio = 0;
    }

    const payerEstimatedAmount = Number((args.claimAmount * coverageRatio).toFixed(2));
    const estimatedResponsibility = Number((args.claimAmount - payerEstimatedAmount).toFixed(2));

    const blockers = args.blockers
      .filter((issue) =>
        issue.code.includes('preauthorization') ||
        issue.code.includes('payer') ||
        issue.code.includes('member_number') ||
        issue.code.includes('insurance') ||
        issue.code.includes('clinical_documentation') ||
        issue.code.includes('diagnosis'),
      )
      .map((issue) => ({ code: issue.code, message: issue.message }));

    let recommendedNextStep = 'Ready for claim submission.';
    if (eligibilityStatus === 'verification_required' || eligibilityStatus === 'unknown') {
      recommendedNextStep = 'Complete payer eligibility verification before submission.';
    } else if (eligibilityStatus === 'verification_failed' || eligibilityStatus === 'ineligible') {
      recommendedNextStep = 'Resolve eligibility failure or collect self-pay deposit before submission.';
    } else if (authorizationRequired && authorizationStatus !== 'approved') {
      recommendedNextStep = 'Obtain approved pre-authorization before submission.';
    } else if (args.readinessStatus === 'blocked') {
      recommendedNextStep = 'Resolve readiness blockers before financial clearance.';
    }

    return {
      patientId: args.patientId || null,
      billId: args.billId || null,
      claimId: args.claimId,
      appointmentId: args.appointmentId || null,
      eligibilityStatus,
      estimatedResponsibility,
      payerEstimatedAmount,
      authorizationRequired,
      authorizationStatus,
      blockers,
      recommendedNextStep,
      assessmentData: {
        claimAmount: args.claimAmount,
        readinessStatus: args.readinessStatus,
        coverageRatio,
        insuranceSignal: args.insuranceSignal
          ? {
              status: args.insuranceSignal.status,
              checkedAt: args.insuranceSignal.checked_at || null,
              confidence:
                args.insuranceSignal.confidence === null || args.insuranceSignal.confidence === undefined
                  ? null
                  : Number(args.insuranceSignal.confidence),
              coverageFlags: args.insuranceSignal.coverage_flags || [],
            }
          : null,
      },
    };
  }

  private async persistFinancialClearanceAssessment(
    tenantDb: DataSource,
    assessment: {
      patientId: string | null;
      billId: string | null;
      claimId: string | null;
      appointmentId: string | null;
      eligibilityStatus: string;
      estimatedResponsibility: number | null;
      payerEstimatedAmount: number | null;
      authorizationRequired: boolean;
      authorizationStatus: string | null;
      blockers: Array<Record<string, any>>;
      recommendedNextStep: string | null;
      assessmentData: Record<string, any>;
    },
  ) {
    const repository = tenantDb.getRepository(FinancialClearanceAssessment);
    return repository.save(
      repository.create({
        assessmentData: assessment.assessmentData,
        authorizationRequired: assessment.authorizationRequired,
        authorizationStatus: assessment.authorizationStatus,
        billId: assessment.billId,
        blockers: assessment.blockers,
        claimId: assessment.claimId,
        eligibilityStatus: assessment.eligibilityStatus,
        estimatedResponsibility: assessment.estimatedResponsibility,
        patientId: assessment.patientId,
        payerEstimatedAmount: assessment.payerEstimatedAmount,
        appointmentId: assessment.appointmentId,
        recommendedNextStep: assessment.recommendedNextStep,
      }),
    );
  }

  async getClaimReadiness(id: string, tenantDb: DataSource) {
    const [claimRow] = await tenantDb.query(`SELECT * FROM medical_aid_claims WHERE id = $1`, [id]);

    if (!claimRow) {
      throw new NotFoundException('Claim not found');
    }

    const claimData = this.parseJsonObject<Record<string, any>>(claimRow.claim_data, {});
    const diagnosisCodes = this.parseArray(claimRow.diagnosis_codes);
    const primaryDiagnosisCode = String(claimRow.primary_diagnosis_code || '').trim();
    const patientId = String(claimRow.patient_id || '').trim();
    const billingId = String(claimRow.billing_id || '').trim() || null;
    const preAuthorizationId = String(claimRow.pre_authorization_id || '').trim() || null;

    const [patientRows, billRows, preAuthRows, patientDocumentRows, recentRecordRows, recentNursingNoteRows, historyRows] =
      await Promise.all([
        patientId
          ? this.safeQuery(
              tenantDb,
              `SELECT id, first_name, last_name, patient_number FROM patients WHERE id = $1 LIMIT 1`,
              [patientId],
            )
          : Promise.resolve([]),
        billingId
          ? this.safeQuery(
              tenantDb,
              `SELECT * FROM billing WHERE id = $1 LIMIT 1`,
              [billingId],
            )
          : Promise.resolve([]),
        preAuthorizationId
          ? this.safeQuery(
              tenantDb,
              `SELECT * FROM pre_authorization_requests WHERE id = $1 LIMIT 1`,
              [preAuthorizationId],
            )
          : Promise.resolve([]),
        patientId
          ? this.safeQuery(
              tenantDb,
              `SELECT document_type, COUNT(*)::int AS count
               FROM patient_documents
               WHERE patient_id = $1
               GROUP BY document_type`,
              [patientId],
            )
          : Promise.resolve([]),
        patientId
          ? this.safeQuery(
              tenantDb,
              `SELECT COUNT(*)::int AS count
               FROM medical_records
               WHERE patient_id = $1
                 AND created_at >= NOW() - INTERVAL '90 days'`,
              [patientId],
            )
          : Promise.resolve([]),
        patientId
          ? this.safeQuery(
              tenantDb,
              `SELECT COUNT(*)::int AS count
               FROM nursing_notes
               WHERE patient_id = $1
                 AND recorded_at >= NOW() - INTERVAL '30 days'`,
              [patientId],
            )
          : Promise.resolve([]),
        this.safeQuery(
          tenantDb,
          `SELECT status, change_reason, created_at
           FROM claim_status_history
           WHERE claim_id = $1
           ORDER BY created_at DESC
           LIMIT 5`,
          [id],
        ),
      ]);

    const patient = patientRows[0] || null;
    const bill = billRows[0] || null;
    const preAuth = preAuthRows[0] || null;
    const appointmentId =
      String(claimData.appointmentId || '').trim() ||
      String(bill?.appointment_id || '').trim() ||
      null;

    const [appointmentRows] = await Promise.all([
      appointmentId
        ? this.safeQuery(
            tenantDb,
            `SELECT id, appointment_date, insurance_verified, primary_diagnosis_code, primary_diagnosis_description, diagnosis_codes
             FROM appointments
             WHERE id = $1
             LIMIT 1`,
            [appointmentId],
          )
        : Promise.resolve([]),
    ]);
    const appointment = appointmentRows[0] || null;

    const billDiagnosisCodes = this.parseArray(bill?.diagnosis_codes);
    const appointmentDiagnosisCodes = this.parseArray(appointment?.diagnosis_codes);
    const allDiagnosisCodes = Array.from(
      new Set([
        ...diagnosisCodes,
        ...billDiagnosisCodes,
        ...appointmentDiagnosisCodes,
      ].filter(Boolean)),
    );
    const resolvedPrimaryDiagnosis =
      primaryDiagnosisCode ||
      String(bill?.primary_diagnosis_code || '').trim() ||
      String(appointment?.primary_diagnosis_code || '').trim();

    const documentCounts = Object.fromEntries(
      (patientDocumentRows || []).map((row: any) => [String(row.document_type), Number(row.count || 0)]),
    ) as Record<string, number>;

    const recentMedicalRecords = Number(recentRecordRows[0]?.count || 0);
    const recentNursingNotes = Number(recentNursingNoteRows[0]?.count || 0);
    const clinicalNotesPresent =
      Boolean(String(claimData.clinicalNotes || '').trim()) ||
      Boolean(String(bill?.notes || '').trim()) ||
      Boolean(String(preAuth?.clinical_notes || '').trim()) ||
      recentMedicalRecords > 0 ||
      recentNursingNotes > 0;

    const blockers: ClaimReadinessIssue[] = [];
    const warnings: ClaimReadinessIssue[] = [];
    const missingDocuments: ClaimReadinessIssue[] = [];

    if (!patientId || !patient) {
      blockers.push(this.buildClaimIssue('missing_patient', 'Claim is not linked to a valid patient.'));
    }
    if (!String(claimRow.medical_aid_name || '').trim()) {
      blockers.push(this.buildClaimIssue('missing_payer', 'Medical aid provider is required before submission.'));
    }
    if (!String(claimRow.member_number || '').trim()) {
      blockers.push(this.buildClaimIssue('missing_member_number', 'Member number is required before submission.'));
    }
    if (!(Number(claimRow.claim_amount || 0) > 0)) {
      blockers.push(this.buildClaimIssue('invalid_claim_amount', 'Claim amount must be greater than zero.'));
    }
    if (!resolvedPrimaryDiagnosis && allDiagnosisCodes.length === 0) {
      blockers.push(this.buildClaimIssue('missing_diagnosis', 'Primary diagnosis or diagnosis codes must be documented.'));
    }
    if (!clinicalNotesPresent) {
      blockers.push(this.buildClaimIssue('missing_clinical_documentation', 'Clinical documentation is missing for this claim.'));
    }
    if (!billingId && !appointmentId && !String(claimData.procedureId || '').trim()) {
      warnings.push(
        this.buildClaimIssue(
          'missing_encounter_reference',
          'Claim is not linked to a bill, appointment, or procedure reference.',
        ),
      );
    }
    if (appointment && appointment.insurance_verified === false) {
      warnings.push(
        this.buildClaimIssue(
          'insurance_not_verified',
          'Appointment insurance verification is still false; front-desk eligibility may be incomplete.',
        ),
      );
    }

    if (preAuthorizationId && !preAuth) {
      blockers.push(
        this.buildClaimIssue(
          'missing_preauthorization_record',
          'Claim references a pre-authorization that could not be found.',
        ),
      );
    } else if (preAuth) {
      const preAuthStatus = String(preAuth.status || '').toLowerCase();
      if (preAuthStatus !== 'approved') {
        blockers.push(
          this.buildClaimIssue(
            'preauthorization_not_approved',
            `Pre-authorization is ${preAuth.status || 'not approved'} and must be approved before claim submission.`,
          ),
        );
      }
      const expiryDate = this.normalizeDate(preAuth.expiry_date);
      if (expiryDate && expiryDate.getTime() < Date.now()) {
        blockers.push(
          this.buildClaimIssue('preauthorization_expired', 'Linked pre-authorization has expired.'),
        );
      }
    } else if (claimData.requiresPreauthorization === true || claimData.requiresPreAuth === true) {
      blockers.push(
        this.buildClaimIssue(
          'missing_preauthorization',
          'This claim is marked as requiring pre-authorization but no approved record is linked.',
        ),
      );
    }

    const requiredDocumentTypes = new Set<string>();
    const procedureType = String(claimData.procedureType || '').trim().toLowerCase();
    if (procedureType === 'lab') {
      requiredDocumentTypes.add('lab_result');
    }
    if (procedureType === 'imaging') {
      requiredDocumentTypes.add('imaging_result');
    }
    if (Array.isArray(claimData.requiredDocuments)) {
      for (const required of claimData.requiredDocuments) {
        requiredDocumentTypes.add(String(required).trim().toLowerCase());
      }
    }
    if (!documentCounts.insurance_card && !this.hasAttachmentOfType(claimData, ['insurance_card', 'insurance-card'])) {
      missingDocuments.push(
        this.buildClaimIssue(
          'missing_insurance_card',
          'No insurance card document is attached to the patient record.',
        ),
      );
      warnings.push(
        this.buildClaimIssue(
          'missing_insurance_card',
          'Insurance card is missing from patient documents, which increases denial risk.',
        ),
      );
    }
    for (const requiredType of requiredDocumentTypes) {
      const hasDocument =
        Number(documentCounts[requiredType] || 0) > 0 ||
        this.hasAttachmentOfType(claimData, [requiredType, requiredType.replace(/_/g, '-')]);
      if (!hasDocument) {
        const issue = this.buildClaimIssue(
          `missing_${requiredType}`,
          `Required supporting document "${requiredType}" is missing.`,
        );
        missingDocuments.push(issue);
        blockers.push(issue);
      }
    }

    const latestRejection = (historyRows || []).find((row: any) => String(row.status || '').toLowerCase() === 'rejected');
    if (latestRejection?.change_reason || claimRow.rejection_reason) {
      warnings.push(
        this.buildClaimIssue(
          'prior_denial_history',
          `Claim has prior denial history: ${latestRejection?.change_reason || claimRow.rejection_reason}.`,
        ),
      );
    }

    const status = blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'at_risk' : 'ready';
    const readinessScore = Math.max(0, 100 - blockers.length * 25 - warnings.length * 8);
    const denialPrediction = this.buildDenialPrediction({
      claimId: id,
      blockers,
      warnings,
      missingDocuments,
      latestRejection,
      preAuthStatus: preAuth?.status || null,
      insuranceVerified: appointment?.insurance_verified ?? null,
    });
    const persistedDenialPrediction = await this.persistClaimDenialPrediction(tenantDb, denialPrediction);
    const insuranceSignal = await this.getLatestEligibilitySignal(
      tenantDb,
      patientId || null,
      String(claimRow.medical_aid_name || ''),
      String(claimRow.member_number || ''),
    );
    const financialClearance = this.deriveFinancialClearance({
      claimId: id,
      patientId: patientId || null,
      billId: billingId,
      appointmentId,
      claimAmount: this.toCurrencyAmount(claimRow.claim_amount),
      blockers,
      readinessStatus: status,
      preAuth,
      claimData,
      appointment,
      insuranceSignal,
    });
    const persistedFinancialClearance = await this.persistFinancialClearanceAssessment(
      tenantDb,
      financialClearance,
    );

    return {
      claimId: id,
      claimNumber: claimRow.claim_number,
      status,
      readyToSubmit: blockers.length === 0,
      readinessScore,
      blockers,
      warnings,
      missingDocuments,
      evidence: {
        patient: patient
          ? {
              id: patient.id,
              patientNumber: patient.patient_number,
              patientName: [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim(),
            }
          : null,
        billId: billingId,
        appointmentId,
        encounterLinked: Boolean(billingId || appointmentId || claimData.procedureId),
        primaryDiagnosisCode: resolvedPrimaryDiagnosis || null,
        diagnosisCodes: allDiagnosisCodes,
        clinicalNotesPresent,
        recentMedicalRecords,
        recentNursingNotes,
        insuranceVerified: appointment?.insurance_verified ?? null,
        preAuthorization: preAuth
          ? {
              id: preAuth.id,
              status: preAuth.status,
              expiryDate: this.dateOnly(this.normalizeDate(preAuth.expiry_date)),
              externalPreAuthId: preAuth.external_preauth_id || null,
            }
          : null,
        supportingDocuments: {
          insuranceCardCount: Number(documentCounts.insurance_card || 0),
          medicalReportCount: Number(documentCounts.medical_report || 0),
          labResultCount: Number(documentCounts.lab_result || 0),
          imagingResultCount: Number(documentCounts.imaging_result || 0),
          prescriptionCount: Number(documentCounts.prescription || 0),
        },
      },
      financial: {
        claimAmount: Number(claimRow.claim_amount || 0),
        payer: claimRow.medical_aid_name,
        memberNumber: claimRow.member_number,
        createdAt: claimRow.created_at,
        submissionDate: claimRow.submission_date,
      },
      denialPrediction: {
        id: persistedDenialPrediction.id,
        riskScore: Number(persistedDenialPrediction.riskScore),
        riskLevel: persistedDenialPrediction.riskLevel,
        blockersCount: persistedDenialPrediction.blockersCount,
        warningsCount: persistedDenialPrediction.warningsCount,
        missingDocumentsCount: persistedDenialPrediction.missingDocumentsCount,
        drivers: persistedDenialPrediction.drivers || [],
        recommendedActions: persistedDenialPrediction.recommendedActions || [],
        modelVersion: persistedDenialPrediction.modelVersion,
        predictedAt: persistedDenialPrediction.predictedAt,
      },
      financialClearance: {
        id: persistedFinancialClearance.id,
        eligibilityStatus: persistedFinancialClearance.eligibilityStatus,
        estimatedResponsibility:
          persistedFinancialClearance.estimatedResponsibility === null ||
          persistedFinancialClearance.estimatedResponsibility === undefined
            ? null
            : Number(persistedFinancialClearance.estimatedResponsibility),
        payerEstimatedAmount:
          persistedFinancialClearance.payerEstimatedAmount === null ||
          persistedFinancialClearance.payerEstimatedAmount === undefined
            ? null
            : Number(persistedFinancialClearance.payerEstimatedAmount),
        authorizationRequired: persistedFinancialClearance.authorizationRequired,
        authorizationStatus: persistedFinancialClearance.authorizationStatus || null,
        blockers: persistedFinancialClearance.blockers || [],
        recommendedNextStep: persistedFinancialClearance.recommendedNextStep || null,
        assessedAt: persistedFinancialClearance.assessedAt,
      },
    };
  }

  async getClaimReadinessWorklist(query: any, tenantDb: DataSource) {
    const limit = this.clampLimit(query?.limit, 50, 200);
    const statuses = String(query?.statuses || 'draft,rejected,submitted,processing')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const rows = await tenantDb.query(
      `
      SELECT id, status, created_at, submission_date
      FROM medical_aid_claims
      WHERE status = ANY($1)
      ORDER BY
        CASE status
          WHEN 'rejected' THEN 1
          WHEN 'draft' THEN 2
          WHEN 'submitted' THEN 3
          WHEN 'processing' THEN 4
          ELSE 5
        END,
        created_at DESC
      LIMIT $2
      `,
      [statuses, limit],
    );

    const items = await Promise.all(
      rows.map(async (row: any) => {
        const readiness = await this.getClaimReadiness(row.id, tenantDb);
        return {
          claimId: row.id,
          claimStatus: row.status,
          createdAt: row.created_at,
          submissionDate: row.submission_date,
          ...readiness,
        };
      }),
    );

    const summary = {
      total: items.length,
      ready: items.filter((item) => item.status === 'ready').length,
      atRisk: items.filter((item) => item.status === 'at_risk').length,
      blocked: items.filter((item) => item.status === 'blocked').length,
      missingDiagnosis: items.filter((item) =>
        item.blockers.some((issue) => issue.code === 'missing_diagnosis'),
      ).length,
      missingClinicalDocumentation: items.filter((item) =>
        item.blockers.some((issue) => issue.code === 'missing_clinical_documentation'),
      ).length,
      missingSupportingDocuments: items.filter((item) => item.missingDocuments.length > 0).length,
      preAuthorizationIssues: items.filter((item) =>
        item.blockers.some((issue) => issue.code.includes('preauthorization')),
      ).length,
    };

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        statuses,
        limit,
      },
      summary,
      items,
    };
  }

  async getFinancialClearance(id: string, tenantDb: DataSource) {
    const readiness = await this.getClaimReadiness(id, tenantDb);
    return {
      claimId: readiness.claimId,
      claimNumber: readiness.claimNumber,
      status: readiness.status,
      readyToSubmit: readiness.readyToSubmit,
      financialClearance: readiness.financialClearance,
      denialPrediction: readiness.denialPrediction,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      missingDocuments: readiness.missingDocuments,
      financial: readiness.financial,
    };
  }

  async generatePriorAuthorizationDraft(id: string, tenantDb: DataSource) {
    const readiness = await this.getClaimReadiness(id, tenantDb);
    const [claimRow] = await tenantDb.query(`SELECT * FROM medical_aid_claims WHERE id = $1`, [id]);

    if (!claimRow) {
      throw new NotFoundException('Claim not found');
    }

    const claimData = this.parseJsonObject<Record<string, any>>(claimRow.claim_data, {});
    const requestType = String(
      claimData.requestType || claimData.procedureType || claimData.appointmentType || 'consultation',
    )
      .trim()
      .toLowerCase();
    const diagnosisSummary = [
      readiness.evidence?.primaryDiagnosisCode || null,
      ...(Array.isArray(readiness.evidence?.diagnosisCodes) ? readiness.evidence.diagnosisCodes : []),
    ]
      .filter(Boolean)
      .join(', ');
    const procedureSummary = Array.from(
      new Set(
        [
          claimData.procedureType,
          claimData.procedureId ? `procedure:${claimData.procedureId}` : null,
          claimData.appointmentType,
        ].filter(Boolean),
      ),
    ).join(', ');
    const supportingDocuments = Object.entries(readiness.evidence?.supportingDocuments || {})
      .map(([documentType, count]) => ({
        documentType,
        count: Number(count || 0),
      }))
      .filter((item) => item.count > 0);

    const justificationParts = [
      `Claim ${readiness.claimNumber} requires payer review before submission.`,
      diagnosisSummary ? `Diagnosis context: ${diagnosisSummary}.` : null,
      procedureSummary ? `Service context: ${procedureSummary}.` : null,
      readiness.financial?.claimAmount
        ? `Requested amount: ${this.toCurrencyAmount(readiness.financial.claimAmount).toFixed(2)}.`
        : null,
      readiness.blockers.length > 0
        ? `Current blockers: ${readiness.blockers.map((issue) => issue.code).join(', ')}.`
        : null,
      readiness.financialClearance?.recommendedNextStep
        ? `Financial clearance next step: ${readiness.financialClearance.recommendedNextStep}`
        : null,
    ]
      .filter(Boolean)
      .join(' ');

    const repository = tenantDb.getRepository(PriorAuthorizationDraft);
    const draft = await repository.save(
      repository.create({
        appointmentId: readiness.evidence?.appointmentId || null,
        billId: readiness.evidence?.billId || null,
        claimId: id,
        diagnosisSummary: diagnosisSummary || null,
        draftData: {
          claimReadinessStatus: readiness.status,
          denialPrediction: readiness.denialPrediction,
          financialClearance: readiness.financialClearance,
          evidence: readiness.evidence,
        },
        justification: justificationParts || null,
        medicalAidName: String(claimRow.medical_aid_name || '').trim() || 'unknown',
        memberNumber: String(claimRow.member_number || '').trim() || null,
        patientId: String(claimRow.patient_id || '').trim() || null,
        procedureSummary: procedureSummary || null,
        requestType,
        requestedAmount: this.toCurrencyAmount(claimRow.claim_amount),
        status: 'draft',
        supportingDocuments,
      }),
    );

    return {
      id: draft.id,
      claimId: draft.claimId,
      patientId: draft.patientId,
      billId: draft.billId,
      appointmentId: draft.appointmentId,
      medicalAidName: draft.medicalAidName,
      memberNumber: draft.memberNumber,
      requestType: draft.requestType,
      requestedAmount: draft.requestedAmount === null || draft.requestedAmount === undefined ? null : Number(draft.requestedAmount),
      diagnosisSummary: draft.diagnosisSummary || null,
      procedureSummary: draft.procedureSummary || null,
      justification: draft.justification || null,
      supportingDocuments: draft.supportingDocuments || [],
      status: draft.status,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      draftData: draft.draftData || {},
    };
  }
  
  async createClaim(createClaimDto: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const lineRepository = tenantDb.getRepository(MedicalAidClaimLine);

    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;

    // Itemised lines (optional). When present, the claim amount is the sum of
    // line amounts so the header total can never drift from the detail.
    const rawLines: any[] = Array.isArray(createClaimDto?.lines) ? createClaimDto.lines : [];
    const normalizedLines = rawLines
      .filter((line) => line && (line.tariffCode || line.description))
      .map((line) => {
        const quantity = Number(line.quantity) > 0 ? Math.floor(Number(line.quantity)) : 1;
        const unitAmount = Number(line.unitAmount) || 0;
        const lineAmount =
          Number(line.lineAmount) > 0 ? Number(line.lineAmount) : Number((unitAmount * quantity).toFixed(2));
        return {
          tariffCode: line.tariffCode ?? null,
          description: String(line.description ?? line.tariffCode ?? '').trim(),
          quantity,
          unitAmount: unitAmount.toFixed(2),
          lineAmount: lineAmount.toFixed(2),
          toothNumber: line.toothNumber ?? null,
          quadrant: line.quadrant ?? null,
          icd10Code: line.icd10Code ?? null,
        };
      });

    const linesTotal = normalizedLines.reduce((sum, line) => sum + Number(line.lineAmount), 0);
    const claimAmount =
      normalizedLines.length > 0 ? Number(linesTotal.toFixed(2)) : createClaimDto?.claimAmount;

    // Don't persist the transient `lines` payload onto the claim row.
    const { lines: _lines, ...claimFields } = createClaimDto ?? {};

    const claim: any = claimRepository.create({
      ...claimFields,
      ...(claimAmount !== undefined ? { claimAmount } : {}),
      claimNumber,
      status: ClaimStatus.DRAFT,
    });

    const savedClaim: any = await claimRepository.save(claim);

    if (normalizedLines.length > 0) {
      await lineRepository.save(
        normalizedLines.map((line) => lineRepository.create({ ...line, claimId: savedClaim.id })),
      );
    }

    return savedClaim;
  }

  /**
   * Typeahead over the tariff-code catalog (AHFoZ-style schedules) used to build
   * itemised claim lines. Matches on code prefix or description.
   */
  async searchTariffCodes(
    tenantDb: DataSource,
    query: { q?: string; schedule?: string; limit?: number },
  ) {
    const term = String(query?.q ?? '').trim();
    const limit = Math.min(Math.max(Number(query?.limit) || 25, 1), 100);
    const params: any[] = [];
    const conditions: string[] = ['active = true'];

    if (term) {
      params.push(`${term}%`);
      params.push(`%${term}%`);
      conditions.push(`(code ILIKE $${params.length - 1} OR description ILIKE $${params.length})`);
    }
    if (query?.schedule && query.schedule !== 'all') {
      params.push(query.schedule);
      conditions.push(`schedule = $${params.length}`);
    }
    params.push(limit);

    const rows = await tenantDb.query(
      `SELECT id, code, description, schedule, category, default_amount
       FROM medical_aid_tariff_codes
       WHERE ${conditions.join(' AND ')}
       ORDER BY code ASC
       LIMIT $${params.length}`,
      params,
    );

    return rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      schedule: row.schedule,
      category: row.category,
      defaultAmount: row.default_amount === null ? null : Number(row.default_amount),
    }));
  }

  /** Itemised lines for a claim, ordered by creation. */
  async getClaimLines(claimId: string, tenantDb: DataSource) {
    const rows = await tenantDb.query(
      `SELECT id, claim_id, tariff_code, description, quantity, unit_amount, line_amount,
              tooth_number, quadrant, icd10_code, created_at
       FROM medical_aid_claim_lines
       WHERE claim_id = $1
       ORDER BY created_at ASC`,
      [claimId],
    );
    return rows.map((row: any) => ({
      id: row.id,
      claimId: row.claim_id,
      tariffCode: row.tariff_code,
      description: row.description,
      quantity: Number(row.quantity),
      unitAmount: Number(row.unit_amount),
      lineAmount: Number(row.line_amount),
      toothNumber: row.tooth_number,
      quadrant: row.quadrant,
      icd10Code: row.icd10_code,
      createdAt: row.created_at,
    }));
  }

  /**
   * Parse a remittance-advice CSV into structured lines. Accepts a header row
   * with any of: claim_number, external_claim_id, claimed_amount, paid_amount,
   * status, reason (order-independent, case/space tolerant). Simple v1 parser —
   * no quoted-field/embedded-comma support.
   */
  private parseRemittanceCsv(csv: string): any[] {
    const rows = String(csv || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length < 2) return [];
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');
    const headers = rows[0].split(',').map(norm);
    const idx = (name: string) => headers.indexOf(name);
    const out: any[] = [];
    for (const row of rows.slice(1)) {
      const cells = row.split(',').map((c) => c.trim());
      const at = (name: string) => {
        const i = idx(name);
        return i >= 0 ? cells[i] : undefined;
      };
      out.push({
        claimNumber: at('claim_number') || at('claim') || undefined,
        externalClaimId: at('external_claim_id') || undefined,
        claimedAmount: at('claimed_amount') || at('claimed') || undefined,
        paidAmount: at('paid_amount') || at('paid') || undefined,
        status: at('status') || undefined,
        reason: at('reason') || undefined,
      });
    }
    return out;
  }

  /**
   * Import a medical-aid remittance advice and reconcile it against claims.
   * Each line is matched (by claim_number or external_claim_id), the matched
   * claim is updated with the paid/approved amount and a paid/approved/rejected
   * status, and a remittance-line record is written for the audit/aging trail.
   */
  async importRemittance(
    body: { providerId?: string; remittanceReference?: string; receivedAt?: string; lines?: any[]; csv?: string },
    tenantDb: DataSource,
    userId?: string,
  ) {
    const rawLines = Array.isArray(body?.lines) && body.lines.length > 0
      ? body.lines
      : this.parseRemittanceCsv(body?.csv || '');

    if (rawLines.length === 0) {
      throw new BadRequestException('No remittance lines provided (supply `lines[]` or a `csv` body).');
    }

    const [header] = await tenantDb.query(
      `INSERT INTO medical_aid_remittances (provider_id, remittance_reference, received_at, status, processed_by, processed_at)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), 'processing', $4, NOW())
       RETURNING id`,
      [body?.providerId || null, body?.remittanceReference || null, body?.receivedAt || null, userId || null],
    );
    const remittanceId = header.id;

    let matched = 0;
    let unmatched = 0;
    let totalPaid = 0;
    let totalShortfall = 0;

    for (const line of rawLines) {
      const claimNumber = line.claimNumber ? String(line.claimNumber).trim() : null;
      const externalClaimId = line.externalClaimId ? String(line.externalClaimId).trim() : null;
      const paid = Number(line.paidAmount) || 0;

      const matchRows = claimNumber || externalClaimId
        ? await tenantDb.query(
            `SELECT id, claim_amount, claim_number, patient_id FROM medical_aid_claims
             WHERE ($1::text IS NOT NULL AND claim_number = $1)
                OR ($2::text IS NOT NULL AND external_claim_id = $2)
             LIMIT 1`,
            [claimNumber, externalClaimId],
          )
        : [];
      const matchedClaim = matchRows[0] || null;

      const claimed = Number(line.claimedAmount) > 0
        ? Number(line.claimedAmount)
        : Number(matchedClaim?.claim_amount) || 0;
      const shortfall = Math.max(0, Number((claimed - paid).toFixed(2)));

      let status: string;
      if (!matchedClaim) status = 'unmatched';
      else if (paid <= 0) status = 'rejected';
      else if (paid + 0.001 >= claimed) status = 'paid';
      else status = 'short_paid';

      await tenantDb.query(
        `INSERT INTO medical_aid_remittance_lines
           (remittance_id, claim_number, external_claim_id, matched_claim_id, claimed_amount, paid_amount, shortfall_amount, status, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [remittanceId, claimNumber, externalClaimId, matchedClaim?.id || null,
          claimed.toFixed(2), paid.toFixed(2), shortfall.toFixed(2), status, line.reason || null],
      );

      if (matchedClaim) {
        matched += 1;
        totalPaid += paid;
        totalShortfall += shortfall;
        const claimStatus = status === 'rejected' ? 'rejected' : status === 'paid' ? 'paid' : 'approved';
        await tenantDb.query(
          `UPDATE medical_aid_claims
           SET approved_amount = $2, status = $3, response_date = NOW(),
               rejection_reason = COALESCE($4, rejection_reason)
           WHERE id = $1`,
          [matchedClaim.id, paid.toFixed(2), claimStatus, status === 'rejected' ? (line.reason || 'Rejected on remittance') : null],
        );

        // S221: claim_status_updated notification — config-gated, best-effort.
        if (this.notificationCenterService && matchedClaim.patient_id) {
          try {
            const [patient] = await tenantDb.query(
              `SELECT phone, email FROM patients WHERE id = $1 LIMIT 1`,
              [matchedClaim.patient_id],
            );
            if (patient?.phone || patient?.email) {
              await this.notificationCenterService.notifyTrigger(tenantDb, 'claim_status_updated', {
                recipientSms: patient.phone || undefined,
                recipientEmail: patient.email || undefined,
                patientId: matchedClaim.patient_id,
                subject: 'Medical Aid Claim Update',
                message: `Claim ${matchedClaim.claim_number}: ${claimStatus.toUpperCase()}. Paid: $${paid.toFixed(2)}${shortfall > 0 ? `, shortfall: $${shortfall.toFixed(2)}` : ''}.`,
              });
            }
          } catch (notifyError: any) {
            this.logger.warn(`claim_status_updated notification failed: ${notifyError?.message}`);
          }
        }
      } else {
        unmatched += 1;
      }
    }

    const summary = {
      totalLines: rawLines.length,
      matched,
      unmatched,
      totalPaid: Number(totalPaid.toFixed(2)),
      totalShortfall: Number(totalShortfall.toFixed(2)),
    };

    await tenantDb.query(
      `UPDATE medical_aid_remittances
       SET status = 'processed', payload = $2::jsonb, processed_at = NOW()
       WHERE id = $1`,
      [remittanceId, JSON.stringify(summary)],
    );

    return { remittanceId, ...summary };
  }

  /**
   * Aged outstanding claims (submitted/processing/approved-but-unpaid) bucketed
   * by age since submission, per provider. Powers the Aged Claims report.
   */
  async getAgedClaims(tenantDb: DataSource, query: { provider?: string } = {}) {
    const params: any[] = [];
    let providerFilter = '';
    if (query?.provider && query.provider !== 'all') {
      params.push(query.provider);
      providerFilter = ` AND medical_aid_name = $${params.length}`;
    }

    const rows = await tenantDb.query(
      `SELECT medical_aid_name AS provider,
              CASE
                WHEN age_days <= 30 THEN '0_30'
                WHEN age_days <= 60 THEN '31_60'
                WHEN age_days <= 90 THEN '61_90'
                ELSE '90_plus'
              END AS bucket,
              COUNT(*)::int AS count,
              COALESCE(SUM(outstanding), 0) AS amount
       FROM (
         SELECT medical_aid_name,
                GREATEST(0, DATE_PART('day', NOW() - COALESCE(submission_date, created_at)))::int AS age_days,
                (COALESCE(claim_amount, 0) - COALESCE(approved_amount, 0)) AS outstanding
         FROM medical_aid_claims
         WHERE status IN ('submitted', 'processing', 'approved')${providerFilter}
       ) aged
       GROUP BY provider, bucket`,
      params,
    );

    const emptyBuckets = () => ({ '0_30': { count: 0, amount: 0 }, '31_60': { count: 0, amount: 0 }, '61_90': { count: 0, amount: 0 }, '90_plus': { count: 0, amount: 0 } });
    const totals = emptyBuckets();
    const byProvider: Record<string, any> = {};
    for (const row of rows) {
      const provider = row.provider || 'unknown';
      byProvider[provider] = byProvider[provider] || emptyBuckets();
      byProvider[provider][row.bucket] = { count: Number(row.count), amount: Number(row.amount) };
      totals[row.bucket].count += Number(row.count);
      totals[row.bucket].amount += Number(row.amount);
    }

    return {
      totals,
      byProvider: Object.entries(byProvider).map(([provider, buckets]) => ({ provider, buckets })),
      totalOutstanding: Number(
        Object.values(totals).reduce((sum: number, b: any) => sum + b.amount, 0).toFixed(2),
      ),
    };
  }

  /** Export claims (respecting filters) as a downloadable CSV payload. */
  async exportClaimsCsv(tenantDb: DataSource, query: { status?: string; provider?: string } = {}) {
    const params: any[] = [];
    const conditions: string[] = [];
    if (query?.status && query.status !== 'all') {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (query?.provider && query.provider !== 'all') {
      params.push(query.provider);
      conditions.push(`medical_aid_name = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await tenantDb.query(
      `SELECT claim_number, medical_aid_name, plan_name, member_number, dependant_code,
              claim_amount, approved_amount, status, submission_date, response_date, created_at
       FROM medical_aid_claims
       ${where}
       ORDER BY created_at DESC`,
      params,
    );

    const headers = [
      'Claim Number', 'Provider', 'Plan', 'Member Number', 'Dependant Code',
      'Claim Amount', 'Approved Amount', 'Status', 'Submitted', 'Responded', 'Created',
    ];
    const esc = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push([
        row.claim_number, row.medical_aid_name, row.plan_name, row.member_number, row.dependant_code,
        row.claim_amount, row.approved_amount, row.status, row.submission_date, row.response_date, row.created_at,
      ].map(esc).join(','));
    }

    return {
      filename: `claims-export-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: lines.join('\n'),
      rowCount: rows.length,
    };
  }

  async generateClaimFromBill(billId: string, claimData: any, tenantDb: DataSource) {
    const billRepository = tenantDb.getRepository(Bill);
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    const bill = await billRepository.findOne({ 
      where: { id: billId },
      relations: ['patient']
    });
    
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (!bill.patient) {
      throw new BadRequestException('Bill must be associated with a patient');
    }

    // Check if claim already exists for this bill
    const existingClaim = await claimRepository.findOne({
      where: { billId }
    });

    if (existingClaim) {
      throw new BadRequestException('Claim already exists for this bill');
    }

    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;

    const claim = claimRepository.create({
      billId: bill.id,
      patientId: bill.patientId,
      medicalAidProvider: claimData.medicalAidProvider, // This will map to medical_aid_name
      memberNumber: claimData.memberNumber,
      dependantCode: claimData.dependantCode ?? null,
      planName: claimData.planName ?? null,
      claimAmount: bill.totalAmount,
      claimNumber,
      status: ClaimStatus.DRAFT,
      claimData: {
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        items: (bill as any).items || [],
        subtotal: bill.subtotal,
        taxAmount: bill.taxAmount,
        discountAmount: bill.discountAmount,
        totalAmount: bill.totalAmount,
        ...claimData.additionalData
      }
    } as any);

    return claimRepository.save(claim);
  }

  async generateClaimFromAppointment(appointmentId: string, claimData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    // Fetch appointment with patient and related data
    const appointment = await tenantDb.query(
      `SELECT a.*, p.id as patient_id, p.first_name, p.last_name, p.date_of_birth, p.gender
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
      [appointmentId]
    );
    
    if (!appointment || appointment.length === 0) {
      throw new NotFoundException('Appointment not found');
    }

    const appt = appointment[0];

    // Check if claim already exists for this appointment
    const existingClaim = await tenantDb.query(
      `SELECT id FROM medical_aid_claims 
       WHERE claim_data->>'appointmentId' = $1`,
      [appointmentId]
    );

    if (existingClaim && existingClaim.length > 0) {
      throw new BadRequestException('Claim already exists for this appointment');
    }

    // Calculate claim amount from appointment charges or use provided amount
    const claimAmount = claimData.claimAmount || 0;

    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;

    const claim = claimRepository.create({
      patientId: appt.patient_id,
      medicalAidProvider: claimData.medicalAidProvider,
      memberNumber: claimData.memberNumber,
      dependantCode: claimData.dependantCode ?? null,
      planName: claimData.planName ?? null,
      claimAmount,
      claimNumber,
      status: ClaimStatus.DRAFT,
      claimData: {
        appointmentId,
        appointmentType: appt.appointment_type,
        appointmentDate: appt.appointment_date,
        patientName: `${appt.first_name} ${appt.last_name}`,
        ...claimData.additionalData
      }
    } as any);

    return claimRepository.save(claim);
  }

  async generateClaimFromProcedure(procedureId: string, type: 'lab' | 'imaging' | 'other', claimData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    // Determine table name based on procedure type
    let tableName: string;
    let patientIdColumn: string;
    
    switch (type) {
      case 'lab':
        tableName = 'lab_orders';
        patientIdColumn = 'patient_id';
        break;
      case 'imaging':
        tableName = 'imaging_orders';
        patientIdColumn = 'patient_id';
        break;
      default:
        throw new BadRequestException(`Unsupported procedure type: ${type}`);
    }

    // Fetch procedure with patient data
    const procedure = await tenantDb.query(
      `SELECT p.*, pt.id as patient_id, pt.first_name, pt.last_name
       FROM ${tableName} p
       JOIN patients pt ON p.${patientIdColumn} = pt.id
       WHERE p.id = $1`,
      [procedureId]
    );
    
    if (!procedure || procedure.length === 0) {
      throw new NotFoundException(`${type} procedure not found`);
    }

    const proc = procedure[0];

    // Check if claim already exists for this procedure
    const existingClaim = await tenantDb.query(
      `SELECT id FROM medical_aid_claims 
       WHERE claim_data->>'procedureId' = $1 AND claim_data->>'procedureType' = $2`,
      [procedureId, type]
    );

    if (existingClaim && existingClaim.length > 0) {
      throw new BadRequestException('Claim already exists for this procedure');
    }

    // Calculate claim amount from procedure charges or use provided amount
    const claimAmount = claimData.claimAmount || proc.total_amount || 0;

    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;

    const claim = claimRepository.create({
      patientId: proc.patient_id,
      medicalAidProvider: claimData.medicalAidProvider,
      memberNumber: claimData.memberNumber,
      dependantCode: claimData.dependantCode ?? null,
      planName: claimData.planName ?? null,
      claimAmount,
      claimNumber,
      status: ClaimStatus.DRAFT,
      claimData: {
        procedureId,
        procedureType: type,
        procedureDate: proc.order_date || proc.created_at,
        patientName: `${proc.first_name} ${proc.last_name}`,
        ...claimData.additionalData
      }
    } as any);

    return claimRepository.save(claim);
  }

  async getClaims(query: any, tenantDb: DataSource) {
    // Use raw SQL to avoid TypeORM join issues with column name mismatches
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.status) {
      whereClause += ` AND c.status = $${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (query.provider) {
      whereClause += ` AND c.medical_aid_name = $${paramIndex}`;
      params.push(query.provider);
      paramIndex++;
    }

    if (query.patientId) {
      whereClause += ` AND c.patient_id = $${paramIndex}`;
      params.push(query.patientId);
      paramIndex++;
    }

    if (query.dateFrom) {
      whereClause += ` AND c.created_at >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      whereClause += ` AND c.created_at <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    if (query.search) {
      whereClause += ` AND (c.claim_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR c.member_number ILIKE $${paramIndex})`;
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      paramIndex += 4;
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const offset = (page - 1) * limit;

    const claimsQuery = `
      SELECT 
        c.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        b.invoice_number as bill_number
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN billing b ON b.id = c.billing_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset

    const [claimsRaw, totalResult] = await Promise.all([
      tenantDb.query(claimsQuery, params),
      tenantDb.query(countQuery, countParams),
    ]);

    const claims = claimsRaw.map((row: any) => ({
      id: row.id,
      claimNumber: row.claim_number,
      patientId: row.patient_id,
      billId: row.billing_id,
      medicalAidProvider: row.medical_aid_name,
      memberNumber: row.member_number,
      claimAmount: row.claim_amount,
      approvedAmount: row.approved_amount,
      status: row.status,
      submissionDate: row.submission_date,
      responseDate: row.response_date,
      rejectionReason: row.rejection_reason,
      claimData: row.claim_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      patient: row.patient_first_name ? {
        id: row.patient_id,
        firstName: row.patient_first_name,
        lastName: row.patient_last_name,
      } : null,
      bill: row.bill_number ? {
        id: row.billing_id,
        billNumber: row.bill_number,
      } : null,
    }));

    const total = Number(totalResult[0]?.total || 0);

    return {
      claims,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getClaimById(id: string, tenantDb: DataSource) {
    // Use raw SQL to avoid TypeORM column mapping issues
    const [claimRaw] = await tenantDb.query(
      `
      SELECT 
        c.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        b.invoice_number as bill_number
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN billing b ON b.id = c.billing_id
      WHERE c.id = $1
    `,
      [id],
    );

    if (!claimRaw) {
      throw new NotFoundException('Claim not found');
    }

    return {
      id: claimRaw.id,
      claimNumber: claimRaw.claim_number,
      patientId: claimRaw.patient_id,
      billId: claimRaw.billing_id,
      medicalAidProvider: claimRaw.medical_aid_name,
      memberNumber: claimRaw.member_number,
      claimAmount: claimRaw.claim_amount,
      approvedAmount: claimRaw.approved_amount,
      status: claimRaw.status,
      submissionDate: claimRaw.submission_date,
      responseDate: claimRaw.response_date,
      rejectionReason: claimRaw.rejection_reason,
      claimData: claimRaw.claim_data,
      createdAt: claimRaw.created_at,
      updatedAt: claimRaw.updated_at,
      patient: claimRaw.patient_first_name ? {
        id: claimRaw.patient_id,
        firstName: claimRaw.patient_first_name,
        lastName: claimRaw.patient_last_name,
      } : null,
      bill: claimRaw.bill_number ? {
        id: claimRaw.billing_id,
        billNumber: claimRaw.bill_number,
      } : null,
    };
  }

  async submitClaim(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const readiness = await this.getClaimReadiness(id, tenantDb);
    if (!readiness.readyToSubmit) {
      throw new BadRequestException({
        message: 'Claim is not ready for submission',
        blockers: readiness.blockers,
      });
    }

    // Simulate medical aid submission
    claim.status = ClaimStatus.SUBMITTED;
    claim.submissionDate = new Date();
    
    // Here you would integrate with actual medical aid APIs
    // CIMAS, Premier, Econet Health APIs
    
    return claimRepository.save(claim);
  }

  async checkClaimStatus(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // Simulate status check with medical aid provider
    return {
      claimNumber: claim.claimNumber,
      status: claim.status,
      submissionDate: claim.submissionDate,
      responseDate: claim.responseDate,
      approvedAmount: claim.approvedAmount
    };
  }

  async processResponse(id: string, responseData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    claim.status = responseData.approved ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;
    claim.responseDate = new Date();
    claim.approvedAmount = responseData.approvedAmount;
    claim.rejectionReason = responseData.rejectionReason;
    // Store response data in claimData if needed
    if (claim.claimData) {
      claim.claimData.response = responseData;
    } else {
      claim.claimData = { response: responseData };
    }

    return claimRepository.save(claim);
  }

  async resubmitClaim(id: string, updatedData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status !== ClaimStatus.REJECTED) {
      throw new BadRequestException('Only rejected claims can be resubmitted');
    }

    // Create new claim based on rejected one (tracking original)
    const claimCount = await claimRepository.count();
    const newClaimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;

    // Update resubmission count on original claim
    const resubmissionCount = ((claim as any).resubmissionCount || 0) + 1;
    await tenantDb.query(
      `UPDATE medical_aid_claims SET resubmission_count = $1 WHERE id = $2`,
      [resubmissionCount, claim.id]
    );

    // Create new claim linked to original
    const newClaim = claimRepository.create({
      ...claim,
      id: undefined, // New ID
      claimNumber: newClaimNumber,
      originalClaimId: claim.id,
      resubmissionCount: 0,
      status: ClaimStatus.DRAFT,
      rejectionReason: null,
      responseDate: null,
      approvedAmount: null,
      submissionDate: null,
      memberNumber: updatedData.memberNumber || claim.memberNumber,
      claimAmount: updatedData.claimAmount || claim.claimAmount,
      claimData: updatedData.claimData ? { ...claim.claimData, ...updatedData.claimData } : claim.claimData,
      diagnosisCodes: updatedData.diagnosisCodes || (claim as any).diagnosisCodes,
      primaryDiagnosisCode: updatedData.primaryDiagnosisCode || (claim as any).primaryDiagnosisCode,
      primaryDiagnosisDescription: updatedData.primaryDiagnosisDescription || (claim as any).primaryDiagnosisDescription,
    } as any);

    const savedClaim = await claimRepository.save(newClaim) as any;

    // Log status history
    await this.logClaimStatusChange(tenantDb, savedClaim.id, ClaimStatus.DRAFT, ClaimStatus.REJECTED, null, 'Resubmission created from rejected claim');

    return savedClaim;
  }

  /**
   * Create a pre-authorization request
   */
  async createPreAuthorization(preAuthData: any, tenantDb: DataSource) {
    const preAuth = await tenantDb.query(
      `INSERT INTO pre_authorization_requests (
        patient_id, billing_id, appointment_id, medical_aid_name, member_number,
        request_type, requested_amount, request_date, diagnosis_codes,
        primary_diagnosis_code, primary_diagnosis_description, procedure_codes,
        service_codes, clinical_notes, request_data, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        preAuthData.patientId,
        preAuthData.billingId || null,
        preAuthData.appointmentId || null,
        preAuthData.medicalAidName,
        preAuthData.memberNumber,
        preAuthData.requestType || 'consultation',
        preAuthData.requestedAmount,
        preAuthData.requestDate || new Date(),
        preAuthData.diagnosisCodes || [],
        preAuthData.primaryDiagnosisCode || null,
        preAuthData.primaryDiagnosisDescription || null,
        preAuthData.procedureCodes || [],
        preAuthData.serviceCodes || [],
        preAuthData.clinicalNotes || null,
        JSON.stringify(preAuthData.requestData || {}),
        preAuthData.createdBy || null,
      ]
    );

    return preAuth[0];
  }

  /**
   * Submit pre-authorization to medical aid
   */
  async submitPreAuthorization(preAuthId: string, tenantDb: DataSource) {
    const [preAuth] = await tenantDb.query(
      `SELECT * FROM pre_authorization_requests WHERE id = $1`,
      [preAuthId]
    );

    if (!preAuth) {
      throw new NotFoundException('Pre-authorization request not found');
    }

    if (preAuth.status !== 'pending') {
      throw new BadRequestException(`Pre-authorization is already ${preAuth.status}`);
    }

    // Submit via API if service available
    if (this.medicalAidApiService) {
      const apiResult = await this.medicalAidApiService.submitPreAuthorization(
        preAuth.medical_aid_name,
        {
          patientId: preAuth.patient_id,
          memberNumber: preAuth.member_number,
          requestType: preAuth.request_type,
          requestedAmount: parseFloat(preAuth.requested_amount),
          diagnosisCodes: preAuth.diagnosis_codes || [],
          primaryDiagnosisCode: preAuth.primary_diagnosis_code,
          procedureCodes: preAuth.procedure_codes || [],
          serviceCodes: preAuth.service_codes || [],
          clinicalNotes: preAuth.clinical_notes,
        },
        tenantDb,
      );

      if (apiResult.success) {
        await tenantDb.query(
          `UPDATE pre_authorization_requests 
           SET status = 'submitted', 
               submitted_at = NOW(),
               external_preauth_id = $1,
               api_response_data = $2
           WHERE id = $3`,
          [
            apiResult.preAuthId,
            JSON.stringify(apiResult),
            preAuthId,
          ]
        );
      } else {
        throw new BadRequestException(apiResult.error || 'Pre-authorization submission failed');
      }
    } else {
      // Simulate submission
      await tenantDb.query(
        `UPDATE pre_authorization_requests 
         SET status = 'submitted', submitted_at = NOW() 
         WHERE id = $1`,
        [preAuthId]
      );
    }

    const [updated] = await tenantDb.query(
      `SELECT * FROM pre_authorization_requests WHERE id = $1`,
      [preAuthId]
    );

    return updated;
  }

  /**
   * Get pre-authorization requests
   */
  async getPreAuthorizations(query: any, tenantDb: DataSource) {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.patientId) {
      whereClause += ` AND patient_id = $${paramIndex}`;
      params.push(query.patientId);
      paramIndex++;
    }

    if (query.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (query.medicalAidName) {
      whereClause += ` AND medical_aid_name = $${paramIndex}`;
      params.push(query.medicalAidName);
      paramIndex++;
    }

    const preAuths = await tenantDb.query(
      `SELECT * FROM pre_authorization_requests ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return preAuths;
  }

  /**
   * Link claim to pre-authorization
   */
  async linkClaimToPreAuth(claimId: string, preAuthId: string, tenantDb: DataSource) {
    // Verify pre-auth exists and is approved
    const [preAuth] = await tenantDb.query(
      `SELECT * FROM pre_authorization_requests WHERE id = $1`,
      [preAuthId]
    );

    if (!preAuth) {
      throw new NotFoundException('Pre-authorization not found');
    }

    if (preAuth.status !== 'approved') {
      throw new BadRequestException('Pre-authorization must be approved before linking to claim');
    }

    // Update claim with pre-auth reference
    await tenantDb.query(
      `UPDATE medical_aid_claims SET pre_authorization_id = $1 WHERE id = $2`,
      [preAuthId, claimId]
    );

    return this.getClaimById(claimId, tenantDb);
  }

  /**
   * Log claim status change to history
   */
  private async logClaimStatusChange(
    tenantDb: DataSource,
    claimId: string,
    newStatus: string,
    previousStatus: string | null,
    changedBy: string | null,
    reason?: string,
    apiResponse?: any
  ) {
    await tenantDb.query(
      `INSERT INTO claim_status_history (
        claim_id, status, previous_status, changed_by, change_reason, api_response
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        claimId,
        newStatus,
        previousStatus,
        changedBy,
        reason || null,
        apiResponse ? JSON.stringify(apiResponse) : null,
      ]
    );
  }

  /**
   * Get claim status history
   */
  async getClaimStatusHistory(claimId: string, tenantDb: DataSource) {
    const history = await tenantDb.query(
      `SELECT 
        csh.*,
        u.first_name || ' ' || u.last_name as changed_by_name
       FROM claim_status_history csh
       LEFT JOIN users u ON u.id = csh.changed_by
       WHERE csh.claim_id = $1
       ORDER BY csh.created_at DESC`,
      [claimId]
    );

    return history.map((h: any) => ({
      id: h.id,
      claimId: h.claim_id,
      status: h.status,
      previousStatus: h.previous_status,
      changedBy: h.changed_by,
      changedByName: h.changed_by_name,
      changeReason: h.change_reason,
      notes: h.notes,
      apiResponse: h.api_response,
      metadata: h.metadata,
      createdAt: h.created_at,
    }));
  }

  /**
   * Enhanced submit claim with API integration
   */
  async submitClaimEnhanced(id: string, submissionMethod: 'api' | 'edi' | 'manual' = 'api', tenantDb: DataSource, userId?: string) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status !== ClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft claims can be submitted');
    }

    const readiness = await this.getClaimReadiness(id, tenantDb);
    if (!readiness.readyToSubmit) {
      throw new BadRequestException({
        message: 'Claim is not ready for submission',
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      });
    }

    const previousStatus = claim.status;
    const startTime = Date.now();

    try {
      // If API method and service available, submit via API
      if (submissionMethod === 'api' && this.medicalAidApiService) {
        const apiResult = await this.medicalAidApiService.submitClaim(
          claim.medicalAidProvider,
          {
            claimId: claim.id,
            patientId: claim.patientId,
            memberNumber: claim.memberNumber,
            claimAmount: claim.claimAmount,
            diagnosisCodes: (claim as any).diagnosisCodes,
            primaryDiagnosisCode: (claim as any).primaryDiagnosisCode,
            procedureCodes: (claim.claimData as any)?.procedureCodes,
            serviceCodes: (claim.claimData as any)?.serviceCodes,
            claimData: claim.claimData,
          },
          tenantDb,
        );

        if (apiResult.success) {
          (claim as any).externalClaimId = apiResult.externalClaimId;
          claim.status = ClaimStatus.SUBMITTED;
          claim.submissionDate = new Date();
          (claim as any).submissionMethod = submissionMethod;
          (claim as any).lastStatusCheckAt = new Date();
          (claim as any).nextStatusCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          (claim as any).apiResponseData = { submission: apiResult };
        } else {
          throw new BadRequestException(apiResult.error || 'API submission failed');
        }
      } else {
        // Manual or EDI submission (simulated for now)
        claim.status = ClaimStatus.SUBMITTED;
        claim.submissionDate = new Date();
        (claim as any).submissionMethod = submissionMethod;
        (claim as any).lastStatusCheckAt = new Date();
        (claim as any).nextStatusCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const savedClaim = await claimRepository.save(claim);

      // Log submission
      await tenantDb.query(
        `INSERT INTO claim_submissions (
          claim_id, submission_method, submission_status, submission_attempt,
          submitted_at, submitted_by, processing_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          claim.id,
          submissionMethod,
          'success',
          1,
          new Date(),
          userId ?? null,
          Date.now() - startTime,
        ]
      );

      // Log status change
      await this.logClaimStatusChange(
        tenantDb,
        claim.id,
        ClaimStatus.SUBMITTED,
        previousStatus,
        null,
        `Submitted via ${submissionMethod}`
      );

      return savedClaim;
    } catch (error: any) {
      // Log failed submission
      await tenantDb.query(
        `INSERT INTO claim_submissions (
          claim_id, submission_method, submission_status, submission_attempt,
          error_message, submitted_at, processing_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          claim.id,
          submissionMethod,
          'failed',
          1,
          error.message,
          new Date(),
          Date.now() - startTime,
        ]
      );

      throw error;
    }
  }

  /**
   * Check claim status from medical aid (polling)
   */
  async checkClaimStatusEnhanced(id: string, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (!claim.submissionDate) {
      throw new BadRequestException('Claim has not been submitted yet');
    }

    let latestClaim = claim;

    // If API service available and external claim ID exists, check via API
    if (this.medicalAidApiService && (claim as any).externalClaimId) {
      try {
        const statusResult = await this.medicalAidApiService.checkClaimStatus(
          claim.medicalAidProvider,
          (claim as any).externalClaimId,
          tenantDb,
        );

        const normalizedExternalStatus = String(statusResult.status || '').trim().toLowerCase();
        const paidStatuses = new Set(['paid', 'settled', 'payment_confirmed', 'reimbursed']);
        const approvedStatuses = new Set(['approved', 'successful', 'success', 'accepted', 'authorised', 'authorized']);
        const rejectedStatuses = new Set(['rejected', 'declined', 'denied', 'failed', 'void']);
        const processingStatuses = new Set([
          'processing',
          'pending',
          'queued',
          'submitted',
          'in_review',
          'under_review',
          'on_hold',
          'suspended',
        ]);

        // Update claim with status from API
        latestClaim = await this.processClaimResponse(id, {
          status: statusResult.status,
          externalClaimId:
            (statusResult as any)?.details?.claimId ||
            (statusResult as any)?.details?.referenceNumber ||
            (claim as any).externalClaimId,
          referenceNumber:
            (statusResult as any)?.details?.referenceNumber ||
            (statusResult as any)?.details?.claimId ||
            (claim as any).externalClaimId,
          approved: approvedStatuses.has(normalizedExternalStatus),
          rejected: rejectedStatuses.has(normalizedExternalStatus),
          processing: processingStatuses.has(normalizedExternalStatus),
          paid: paidStatuses.has(normalizedExternalStatus),
          reason:
            normalizedExternalStatus === 'suspended'
              ? 'Claim/member suspended by medical aid provider.'
              : undefined,
          paidAmount: paidStatuses.has(normalizedExternalStatus) ? statusResult.approvedAmount : undefined,
          approvedAmount: statusResult.approvedAmount,
          rejectionReason: statusResult.rejectionReason,
          details: statusResult.details,
        }, tenantDb);
      } catch (error: any) {
        this.logger.warn(`Status check failed for claim ${id}: ${error.message}`);
      }
    }

    // Update last check time
    (latestClaim as any).lastStatusCheckAt = new Date();
    (latestClaim as any).nextStatusCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await claimRepository.save(latestClaim);

    // Get status history
    const history = await this.getClaimStatusHistory(id, tenantDb);

    return {
      claim: await this.getClaimById(id, tenantDb),
      statusHistory: history,
      lastChecked: (latestClaim as any).lastStatusCheckAt,
      nextCheck: (latestClaim as any).nextStatusCheckAt,
    };
  }

  /**
   * Process claim response from medical aid (webhook or polling result)
   */
  async processClaimResponse(id: string, responseData: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    const claim = await claimRepository.findOne({ where: { id } });
    
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const previousStatus = claim.status;
    const externalStatus = String(responseData.status || responseData.claimStatus || '')
      .trim()
      .toLowerCase();

    const paidStatuses = new Set(['paid', 'settled', 'payment_confirmed', 'reimbursed']);
    const approvedStatuses = new Set(['approved', 'successful', 'success', 'accepted', 'authorised', 'authorized']);
    const rejectedStatuses = new Set(['rejected', 'declined', 'denied', 'failed', 'void']);
    const processingStatuses = new Set([
      'processing',
      'pending',
      'queued',
      'submitted',
      'in_review',
      'under_review',
      'on_hold',
      'suspended',
    ]);

    const isPaid = responseData.paid === true || paidStatuses.has(externalStatus);
    const isApproved =
      responseData.approved === true || (approvedStatuses.has(externalStatus) && !isPaid);
    const isRejected = responseData.rejected === true || rejectedStatuses.has(externalStatus);
    const isProcessing = responseData.processing === true || processingStatuses.has(externalStatus);

    // Update claim based on response
    if (isPaid) {
      claim.status = ClaimStatus.PAID;
      claim.approvedAmount =
        responseData.paidAmount || responseData.approvedAmount || claim.approvedAmount || claim.claimAmount;
      claim.rejectionReason = null;
    } else if (isApproved) {
      claim.status = ClaimStatus.APPROVED;
      claim.approvedAmount = responseData.approvedAmount || claim.claimAmount;
      claim.rejectionReason = null;
    } else if (isRejected) {
      claim.status = ClaimStatus.REJECTED;
      claim.rejectionReason = responseData.rejectionReason || responseData.reason;
    } else if (isProcessing) {
      claim.status = ClaimStatus.PROCESSING;
    }

    claim.responseDate = new Date();
    (claim as any).externalClaimId =
      responseData.externalClaimId ||
      responseData.referenceNumber ||
      (claim as any).externalClaimId ||
      null;
    (claim as any).apiResponseData = responseData;
    (claim as any).externalStatus = externalStatus || null;

    const savedClaim = await claimRepository.save(claim);

    const statusChangeReason =
      responseData.rejectionReason ||
      responseData.reason ||
      (externalStatus ? `Status updated from medical aid: ${externalStatus}` : 'Status updated from medical aid');

    // Log status change
    await this.logClaimStatusChange(
      tenantDb,
      claim.id,
      savedClaim.status,
      previousStatus,
      null,
      statusChangeReason,
      responseData
    );

    // Update submission record if exists
    await tenantDb.query(
      `WITH latest_submission AS (
         SELECT id
         FROM claim_submissions
         WHERE claim_id = $3
           AND responded_at IS NULL
         ORDER BY submitted_at DESC
         LIMIT 1
       )
       UPDATE claim_submissions cs
       SET response_payload = $1,
           responded_at = NOW(),
           submission_status = $2
       FROM latest_submission
       WHERE cs.id = latest_submission.id`,
      [
        JSON.stringify(responseData),
        isApproved || isPaid ? 'success' : isRejected ? 'failed' : 'pending',
        claim.id,
      ],
    );

    return savedClaim;
  }

  /**
   * Bulk submit claims
   */
  async bulkSubmitClaims(claimIds: string[], submissionMethod: 'api' | 'edi' = 'api', tenantDb: DataSource) {
    const results = [];

    for (const claimId of claimIds) {
      try {
        const result = await this.submitClaimEnhanced(claimId, submissionMethod, tenantDb);
        results.push({ claimId, success: true, claim: result });
      } catch (error: any) {
        results.push({ claimId, success: false, error: error.message });
      }
    }

    return {
      total: claimIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  /**
   * Bulk check claim statuses
   */
  async bulkCheckClaimStatuses(claimIds: string[], tenantDb: DataSource) {
    const results = [];

    for (const claimId of claimIds) {
      try {
        const result = await this.checkClaimStatusEnhanced(claimId, tenantDb);
        results.push({ claimId, success: true, data: result });
      } catch (error: any) {
        results.push({ claimId, success: false, error: error.message });
      }
    }

    return {
      total: claimIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  async getDashboardSummary(tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);

    const [totalClaims] = await tenantDb.query(`
      SELECT COUNT(*) as total
      FROM medical_aid_claims
    `);

    const [totalAmount] = await tenantDb.query(`
      SELECT COALESCE(SUM(claim_amount), 0) as total
      FROM medical_aid_claims
    `);

    const [approvedAmount] = await tenantDb.query(`
      SELECT COALESCE(SUM(approved_amount), 0) as total
      FROM medical_aid_claims
      WHERE status = 'approved' OR status = 'paid'
    `);

    const [pendingAmount] = await tenantDb.query(`
      SELECT COALESCE(SUM(claim_amount), 0) as total
      FROM medical_aid_claims
      WHERE status IN ('draft', 'submitted', 'processing')
    `);

    const statusBreakdown = await tenantDb.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(claim_amount), 0) as total_amount,
        COALESCE(SUM(approved_amount), 0) as approved_amount
      FROM medical_aid_claims
      GROUP BY status
      ORDER BY count DESC
    `);

    const providerBreakdown = await tenantDb.query(`
      SELECT 
        medical_aid_name as medical_aid_provider,
        COUNT(*) as count,
        COALESCE(SUM(claim_amount), 0) as total_amount,
        COALESCE(SUM(approved_amount), 0) as approved_amount,
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count
      FROM medical_aid_claims
      GROUP BY medical_aid_name
      ORDER BY total_amount DESC
    `);

    // Use raw query to avoid TypeORM column name issues
    const recentClaimsRaw = await tenantDb.query(`
      SELECT 
        c.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        b.invoice_number as bill_number
      FROM medical_aid_claims c
      LEFT JOIN patients p ON p.id = c.patient_id
      LEFT JOIN billing b ON b.id = c.billing_id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);
    
    const recentClaims = recentClaimsRaw.map((row: any) => ({
      id: row.id,
      claimNumber: row.claim_number,
      patientId: row.patient_id,
      billId: row.billing_id,
      medicalAidProvider: row.medical_aid_name,
      memberNumber: row.member_number,
      claimAmount: row.claim_amount,
      approvedAmount: row.approved_amount,
      status: row.status,
      submissionDate: row.submission_date,
      responseDate: row.response_date,
      rejectionReason: row.rejection_reason,
      claimData: row.claim_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      patient: row.patient_first_name ? {
        firstName: row.patient_first_name,
        lastName: row.patient_last_name,
      } : null,
      bill: row.bill_number ? {
        billNumber: row.bill_number,
      } : null,
    }));

    const [rejectedClaims] = await tenantDb.query(`
      SELECT COUNT(*) as count
      FROM medical_aid_claims
      WHERE status = 'rejected'
    `);

    const [avgTurnaroundTime] = await tenantDb.query(`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400), 0) as avg_days
      FROM medical_aid_claims
      WHERE response_date IS NOT NULL AND submission_date IS NOT NULL
    `);

    return {
      summary: {
        totalClaims: Number(totalClaims?.total || 0),
        totalAmount: Number(totalAmount?.total || 0),
        approvedAmount: Number(approvedAmount?.total || 0),
        pendingAmount: Number(pendingAmount?.total || 0),
        rejectedCount: Number(rejectedClaims?.count || 0),
        avgTurnaroundDays: Number(avgTurnaroundTime?.avg_days || 0).toFixed(1),
      },
      statusBreakdown,
      providerBreakdown,
      recentClaims,
    };
  }

  async getClaimAnalytics(tenantDb: DataSource, filters?: { dateFrom?: string; dateTo?: string; provider?: string }) {
    let dateFilter = '';
    const params: any[] = [];

    if (filters?.dateFrom) {
      params.push(filters.dateFrom);
      dateFilter += ` AND created_at >= $${params.length}`;
    }
    if (filters?.dateTo) {
      params.push(filters.dateTo);
      dateFilter += ` AND created_at <= $${params.length}`;
    }
    if (filters?.provider) {
      params.push(filters.provider);
      dateFilter += ` AND medical_aid_name = $${params.length}`;
    }

    const successRate = await tenantDb.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') * 100.0 / NULLIF(COUNT(*), 0) as success_rate
      FROM medical_aid_claims
      WHERE 1=1 ${dateFilter}
    `,
      params,
    );

    const turnaroundTime = await tenantDb.query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400) as avg_days,
        MIN(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400) as min_days,
        MAX(EXTRACT(EPOCH FROM (response_date - submission_date)) / 86400) as max_days
      FROM medical_aid_claims
      WHERE response_date IS NOT NULL AND submission_date IS NOT NULL ${dateFilter}
    `,
      params,
    );

    const monthlyTrend = await tenantDb.query(
      `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as claim_count,
        COALESCE(SUM(claim_amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'paid') as approved_count,
        COALESCE(SUM(approved_amount), 0) as approved_amount
      FROM medical_aid_claims
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
      LIMIT 12
    `,
      params,
    );

    const rejectionReasons = await tenantDb.query(
      `
      SELECT 
        rejection_reason,
        COUNT(*) as count
      FROM medical_aid_claims
      WHERE status = 'rejected' AND rejection_reason IS NOT NULL ${dateFilter}
      GROUP BY rejection_reason
      ORDER BY count DESC
      LIMIT 10
    `,
      params,
    );

    return {
      successRate: Number(successRate[0]?.success_rate || 0).toFixed(2),
      turnaroundTime: {
        avg: Number(turnaroundTime[0]?.avg_days || 0).toFixed(1),
        min: Number(turnaroundTime[0]?.min_days || 0).toFixed(1),
        max: Number(turnaroundTime[0]?.max_days || 0).toFixed(1),
      },
      monthlyTrend,
      rejectionReasons,
    };
  }
}
