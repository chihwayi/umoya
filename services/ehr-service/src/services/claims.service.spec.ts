import { BadRequestException } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimStatus } from '../entities/medical-aid-claim.entity';

describe('ClaimsService', () => {
  const makeService = () => new ClaimsService();

  const makeTenantDb = (overrides?: {
    claim?: any;
    patient?: any;
    bill?: any;
    appointment?: any;
    preAuth?: any;
    patientDocuments?: any[];
    medicalRecordsCount?: number;
    nursingNotesCount?: number;
    history?: any[];
    worklistRows?: any[];
    repoClaim?: any;
  }) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(overrides?.repoClaim || null),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({
        id:
          Object.prototype.hasOwnProperty.call(input, 'riskScore')
            ? `prediction-${input.claimId}`
            : Object.prototype.hasOwnProperty.call(input, 'eligibilityStatus')
              ? 'assessment-1'
              : Object.prototype.hasOwnProperty.call(input, 'medicalAidName')
                ? 'draft-1'
                : 'entity-1',
        predictedAt: new Date('2026-03-25T08:00:00.000Z'),
        assessedAt: new Date('2026-03-25T08:00:00.000Z'),
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
        updatedAt: new Date('2026-03-25T08:00:00.000Z'),
        ...input,
      })),
    };

    const query = jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT * FROM medical_aid_claims WHERE id = $1')) {
        return overrides?.claim ? [overrides.claim] : [];
      }
      if (sql.includes('FROM patients WHERE id = $1')) {
        return overrides?.patient ? [overrides.patient] : [];
      }
      if (sql.includes('FROM billing WHERE id = $1')) {
        return overrides?.bill ? [overrides.bill] : [];
      }
      if (sql.includes('FROM pre_authorization_requests WHERE id = $1')) {
        return overrides?.preAuth ? [overrides.preAuth] : [];
      }
      if (sql.includes('FROM patient_documents')) {
        return overrides?.patientDocuments || [];
      }
      if (sql.includes('FROM medical_records')) {
        return [{ count: overrides?.medicalRecordsCount ?? 0 }];
      }
      if (sql.includes('FROM nursing_notes')) {
        return [{ count: overrides?.nursingNotesCount ?? 0 }];
      }
      if (sql.includes('FROM claim_status_history') && sql.includes('LIMIT 5')) {
        return overrides?.history || [];
      }
      if (sql.includes('FROM appointments') && sql.includes('WHERE id = $1')) {
        return overrides?.appointment ? [overrides.appointment] : [];
      }
      if (sql.includes('FROM insurance_eligibility_checks')) {
        return [];
      }
      if (sql.includes('SELECT id, status, created_at, submission_date')) {
        return overrides?.worklistRows || [];
      }
      if (sql.includes('INSERT INTO claim_submissions')) {
        return [];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    return {
      query,
      getRepository: jest.fn().mockReturnValue(repo),
      __repo: repo,
    } as any;
  };

  it('returns blocked readiness with missing diagnosis, documentation, and preauth approval', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb({
      claim: {
        id: 'claim-1',
        claim_number: 'CLM00000001',
        patient_id: 'patient-1',
        billing_id: 'bill-1',
        medical_aid_name: 'cimas',
        member_number: 'MEM-1',
        claim_amount: '125.00',
        pre_authorization_id: 'preauth-1',
        claim_data: { requiresPreAuth: true },
        created_at: '2026-03-10T08:00:00.000Z',
      },
      patient: {
        id: 'patient-1',
        first_name: 'Alice',
        last_name: 'Moyo',
        patient_number: 'P001',
      },
      bill: {
        id: 'bill-1',
        appointment_id: 'appt-1',
        notes: '',
      },
      appointment: {
        id: 'appt-1',
        insurance_verified: false,
        diagnosis_codes: [],
      },
      preAuth: {
        id: 'preauth-1',
        status: 'submitted',
        expiry_date: '2026-03-20',
        clinical_notes: '',
      },
      patientDocuments: [],
      medicalRecordsCount: 0,
      nursingNotesCount: 0,
      history: [
        { status: 'rejected', change_reason: 'Missing diagnosis linkage' },
      ],
    });

    const readiness = await service.getClaimReadiness('claim-1', tenantDb);

    expect(readiness.status).toBe('blocked');
    expect(readiness.readyToSubmit).toBe(false);
    expect(readiness.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_diagnosis' }),
        expect.objectContaining({ code: 'missing_clinical_documentation' }),
        expect.objectContaining({ code: 'preauthorization_not_approved' }),
      ]),
    );
    expect(readiness.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'insurance_not_verified' }),
        expect.objectContaining({ code: 'prior_denial_history' }),
      ]),
    );
    expect(readiness.missingDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_insurance_card' }),
      ]),
    );
    expect(readiness.denialPrediction).toEqual(
      expect.objectContaining({
        riskLevel: 'high',
      }),
    );
    expect(readiness.financialClearance).toEqual(
      expect.objectContaining({
        authorizationRequired: true,
      }),
    );
  });

  it('returns ready readiness when diagnosis, documentation, and documents are present', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb({
      claim: {
        id: 'claim-2',
        claim_number: 'CLM00000002',
        patient_id: 'patient-2',
        billing_id: 'bill-2',
        medical_aid_name: 'premier',
        member_number: 'MEM-2',
        claim_amount: '450.00',
        primary_diagnosis_code: 'B20',
        diagnosis_codes: ['B20'],
        claim_data: {
          clinicalNotes: 'Consultation completed and documented.',
          attachments: [{ documentType: 'insurance_card' }],
        },
        created_at: '2026-03-10T08:00:00.000Z',
      },
      patient: {
        id: 'patient-2',
        first_name: 'Brian',
        last_name: 'Ncube',
        patient_number: 'P002',
      },
      bill: {
        id: 'bill-2',
        appointment_id: 'appt-2',
        notes: 'Encounter note complete',
      },
      appointment: {
        id: 'appt-2',
        insurance_verified: true,
        primary_diagnosis_code: 'B20',
        diagnosis_codes: ['B20'],
      },
      patientDocuments: [{ document_type: 'insurance_card', count: 1 }],
      medicalRecordsCount: 1,
      nursingNotesCount: 0,
      history: [],
    });

    const readiness = await service.getClaimReadiness('claim-2', tenantDb);

    expect(readiness.status).toBe('ready');
    expect(readiness.readyToSubmit).toBe(true);
    expect(readiness.blockers).toHaveLength(0);
    expect(readiness.missingDocuments).toHaveLength(0);
    expect(readiness.denialPrediction).toEqual(
      expect.objectContaining({
        riskLevel: 'low',
      }),
    );
    expect(readiness.financialClearance).toEqual(
      expect.objectContaining({
        recommendedNextStep: 'Ready for claim submission.',
      }),
    );
  });

  it('blocks enhanced submission when readiness has blockers', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb({
      claim: {
        id: 'claim-3',
        claim_number: 'CLM00000003',
        patient_id: 'patient-3',
        billing_id: null,
        medical_aid_name: 'cimas',
        member_number: '',
        claim_amount: '0.00',
        claim_data: {},
        created_at: '2026-03-10T08:00:00.000Z',
      },
      repoClaim: {
        id: 'claim-3',
        status: ClaimStatus.DRAFT,
      },
    });

    await expect(service.submitClaimEnhanced('claim-3', 'manual', tenantDb)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns financial clearance view with persisted prediction and clearance data', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb({
      claim: {
        id: 'claim-4',
        claim_number: 'CLM00000004',
        patient_id: 'patient-4',
        billing_id: 'bill-4',
        medical_aid_name: 'cimas',
        member_number: 'MEM-4',
        claim_amount: '320.00',
        primary_diagnosis_code: 'A01',
        diagnosis_codes: ['A01'],
        claim_data: {
          clinicalNotes: 'Ready to submit.',
        },
        created_at: '2026-03-10T08:00:00.000Z',
      },
      patient: {
        id: 'patient-4',
        first_name: 'Chipo',
        last_name: 'Mlambo',
        patient_number: 'P004',
      },
      bill: {
        id: 'bill-4',
        appointment_id: 'appt-4',
        notes: 'Clinical note complete',
      },
      appointment: {
        id: 'appt-4',
        insurance_verified: true,
        primary_diagnosis_code: 'A01',
        diagnosis_codes: ['A01'],
      },
      patientDocuments: [{ document_type: 'insurance_card', count: 1 }],
      medicalRecordsCount: 1,
      nursingNotesCount: 0,
      history: [],
    });

    const result = await service.getFinancialClearance('claim-4', tenantDb);

    expect(result.claimId).toBe('claim-4');
    expect(result.financialClearance).toEqual(
      expect.objectContaining({
        eligibilityStatus: expect.any(String),
      }),
    );
    expect(result.denialPrediction).toEqual(
      expect.objectContaining({
        riskScore: expect.any(Number),
      }),
    );
  });

  it('generates a persisted prior-authorization draft from claim readiness', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb({
      claim: {
        id: 'claim-5',
        claim_number: 'CLM00000005',
        patient_id: 'patient-5',
        billing_id: 'bill-5',
        medical_aid_name: 'cimas',
        member_number: 'MEM-5',
        claim_amount: '510.00',
        primary_diagnosis_code: 'I10',
        diagnosis_codes: ['I10'],
        claim_data: {
          requiresPreAuth: true,
          procedureType: 'mri',
          clinicalNotes: 'MRI requested after escalation.',
        },
        created_at: '2026-03-10T08:00:00.000Z',
      },
      patient: {
        id: 'patient-5',
        first_name: 'Tariro',
        last_name: 'Dube',
        patient_number: 'P005',
      },
      bill: {
        id: 'bill-5',
        appointment_id: 'appt-5',
        notes: 'Imaging note complete',
      },
      appointment: {
        id: 'appt-5',
        insurance_verified: true,
        primary_diagnosis_code: 'I10',
        diagnosis_codes: ['I10'],
      },
      patientDocuments: [{ document_type: 'insurance_card', count: 1 }],
      medicalRecordsCount: 1,
      nursingNotesCount: 0,
      history: [],
    });

    const result = await service.generatePriorAuthorizationDraft('claim-5', tenantDb);

    expect(result).toEqual(
      expect.objectContaining({
        id: 'draft-1',
        claimId: 'claim-5',
        requestType: 'mri',
        medicalAidName: 'cimas',
      }),
    );
    expect(result.justification).toContain('Claim CLM00000005 requires payer review before submission.');
  });
});
