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
      save: jest.fn(),
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

    expect(tenantDb.__repo.save).not.toHaveBeenCalled();
  });
});
