import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MedicalAidClaim, ClaimStatus, MedicalAidProvider } from '../entities/medical-aid-claim.entity';
import { Bill } from '../entities/billing.entity';
import { MedicalAidApiService } from './medical-aid-api.service';

export interface ClaimReadinessIssue {
  code: string;
  message: string;
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(private readonly medicalAidApiService?: MedicalAidApiService) {}

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
  
  async createClaim(createClaimDto: any, tenantDb: DataSource) {
    const claimRepository = tenantDb.getRepository(MedicalAidClaim);
    
    const claimCount = await claimRepository.count();
    const claimNumber = `CLM${String(claimCount + 1).padStart(8, '0')}`;
    
    const claim = claimRepository.create({
      ...createClaimDto,
      claimNumber,
      status: ClaimStatus.DRAFT
    });
    
    return claimRepository.save(claim);
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
  async submitClaimEnhanced(id: string, submissionMethod: 'api' | 'edi' | 'manual' = 'api', tenantDb: DataSource) {
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
          null, // TODO: Get from context
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

    // If API service available and external claim ID exists, check via API
    if (this.medicalAidApiService && (claim as any).externalClaimId) {
      try {
        const statusResult = await this.medicalAidApiService.checkClaimStatus(
          claim.medicalAidProvider,
          (claim as any).externalClaimId,
          tenantDb,
        );

        // Update claim with status from API
        await this.processClaimResponse(id, {
          status: statusResult.status,
          approved: statusResult.status === 'approved' || statusResult.status === 'paid',
          rejected: statusResult.status === 'rejected',
          approvedAmount: statusResult.approvedAmount,
          rejectionReason: statusResult.rejectionReason,
          details: statusResult.details,
        }, tenantDb);
      } catch (error: any) {
        this.logger.warn(`Status check failed for claim ${id}: ${error.message}`);
      }
    }

    // Update last check time
    (claim as any).lastStatusCheckAt = new Date();
    (claim as any).nextStatusCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await claimRepository.save(claim);

    // Get status history
    const history = await this.getClaimStatusHistory(id, tenantDb);

    return {
      claim: await this.getClaimById(id, tenantDb),
      statusHistory: history,
      lastChecked: (claim as any).lastStatusCheckAt,
      nextCheck: (claim as any).nextStatusCheckAt,
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

    // Update claim based on response
    if (responseData.approved) {
      claim.status = ClaimStatus.APPROVED;
      claim.approvedAmount = responseData.approvedAmount || claim.claimAmount;
    } else if (responseData.rejected) {
      claim.status = ClaimStatus.REJECTED;
      claim.rejectionReason = responseData.rejectionReason || responseData.reason;
    } else if (responseData.processing) {
      claim.status = ClaimStatus.PROCESSING;
    } else if (responseData.paid) {
      claim.status = ClaimStatus.PAID;
      claim.approvedAmount = responseData.paidAmount || claim.approvedAmount;
    }

    claim.responseDate = new Date();
    (claim as any).externalClaimId = responseData.externalClaimId || responseData.referenceNumber;
    (claim as any).apiResponseData = responseData;

    const savedClaim = await claimRepository.save(claim);

    // Log status change
    await this.logClaimStatusChange(
      tenantDb,
      claim.id,
      savedClaim.status,
      previousStatus,
      null,
      responseData.rejectionReason || 'Status updated from medical aid',
      responseData
    );

    // Update submission record if exists
    await tenantDb.query(
      `UPDATE claim_submissions 
       SET response_payload = $1, responded_at = NOW(), submission_status = $2
       WHERE claim_id = $3 AND responded_at IS NULL
       ORDER BY submitted_at DESC LIMIT 1`,
      [
        JSON.stringify(responseData),
        responseData.approved || responseData.paid ? 'success' : responseData.rejected ? 'failed' : 'pending',
        claim.id,
      ]
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
