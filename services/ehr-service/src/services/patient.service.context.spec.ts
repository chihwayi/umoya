import { PatientService } from './patient.service';

describe('PatientService.getPatientContext', () => {
  const buildTenantDb = (
    queryImpl: (sql: string, params: any[]) => Promise<any>,
    patientOverride?: any,
  ) => {
    const patientRepository = {
      findOne: jest.fn().mockResolvedValue(
        patientOverride ?? {
          id: 'patient-1',
          patientNumber: 'P-001',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1992-01-10',
          gender: 'female',
          nationalId: '63-123456-Z-63',
          phone: '+263777000111',
          email: 'jane@example.org',
          address: '12 Example Street',
          city: 'Harare',
          bloodType: 'O+',
          emergencyContactName: 'John Doe',
          emergencyContactPhone: '+263777999888',
          medicalAidProvider: 'Example Aid',
          medicalAidNumber: 'AID-001',
          isActive: true,
        },
      ),
    };

    return {
      getRepository: jest.fn().mockReturnValue(patientRepository),
      query: jest.fn(queryImpl),
      __repo: patientRepository,
    } as any;
  };

  it('aggregates latest reusable context across HIV, maternity, oncology, and vitals', async () => {
    const service = new PatientService();
    const tenantDb = buildTenantDb(async (sql: string) => {
      if (sql.includes('FROM vitals')) {
        return [
          {
            id: 'vitals-1',
            blood_pressure: '120/78',
            heart_rate: 72,
            temperature: 36.8,
            respiratory_rate: 16,
            weight: 64.5,
            height: 165,
            bmi: 23.7,
            recorded_at: '2026-03-03T08:00:00.000Z',
          },
        ];
      }
      if (sql.includes('FROM hiv_care_enrollments')) {
        return [
          {
            id: 'hiv-enroll-1',
            enrollment_number: 'HIV-1001',
            enrollment_status: 'active',
          },
        ];
      }
      if (sql.includes('FROM maternity_enrollments')) {
        return [
          {
            id: 'mat-enroll-1',
            enrollment_number: 'MAT-2026-01',
            enrollment_status: 'active',
            gravida: 2,
            para: 1,
            parity_term: 1,
            parity_preterm: 0,
            parity_abortions: 0,
            parity_living: 1,
            previous_cesarean: false,
            previous_complications: 'None',
          },
        ];
      }
      if (sql.includes('FROM oncology_cases') && sql.includes('COUNT(*)')) {
        return [{ active_count: 1 }];
      }
      if (sql.includes('FROM oncology_cases')) {
        return [
          {
            id: 'onc-case-1',
            status: 'active',
            primary_diagnosis: 'Retinoblastoma',
          },
        ];
      }
      if (sql.includes('FROM hiv_clinical_visits')) {
        return [
          {
            id: 'hiv-visit-1',
            visit_date: '2026-03-01',
            arv_status: '2',
            arv_regimen_name: 'TLD',
            next_review_date: '2026-04-01',
          },
        ];
      }
      if (sql.includes('FROM anc_visits')) {
        return [{ id: 'anc-1', visit_date: '2026-02-20' }];
      }
      if (sql.includes('FROM postnatal_visits')) {
        return [];
      }
      if (sql.includes('FROM deliveries')) {
        return [{ id: 'delivery-1', delivery_date: '2025-11-30' }];
      }
      return [];
    });

    const result = await service.getPatientContext('patient-1', tenantDb);

    expect(result.patient.id).toBe('patient-1');
    expect(result.patient.fullName).toBe('Jane Doe');
    expect(result.latestVitals.id).toBe('vitals-1');
    expect(result.modules.hiv.latestEnrollment.id).toBe('hiv-enroll-1');
    expect(result.modules.hiv.latestClinicalVisit.id).toBe('hiv-visit-1');
    expect(result.modules.maternity.latestEnrollment.id).toBe('mat-enroll-1');
    expect(result.modules.oncology.latestCase.id).toBe('onc-case-1');
    expect(result.modules.oncology.activeCaseCount).toBe(1);
  });

  it('returns base patient context even when module tables are missing', async () => {
    const service = new PatientService();
    const tenantDb = buildTenantDb(async () => {
      const err: any = new Error('relation does not exist');
      err.code = '42P01';
      throw err;
    });

    const result = await service.getPatientContext('patient-1', tenantDb);

    expect(result.patient.id).toBe('patient-1');
    expect(result.latestVitals).toBeNull();
    expect(result.modules.hiv.latestEnrollment).toBeNull();
    expect(result.modules.hiv.latestClinicalVisit).toBeNull();
    expect(result.modules.maternity.latestEnrollment).toBeNull();
    expect(result.modules.oncology.latestCase).toBeNull();
    expect(result.modules.oncology.activeCaseCount).toBe(0);
  });
});

