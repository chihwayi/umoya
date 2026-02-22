import { BadRequestException } from '@nestjs/common';
import { HivService } from './hiv.service';

const makeService = () => {
  const monitoringService = {
    calculateNextViralLoadDate: jest.fn(),
    calculateNextCD4Date: jest.fn(),
    checkTreatmentFailure: jest.fn().mockReturnValue({
      isTreatmentFailure: false,
      severity: 'medium',
      reason: null,
    }),
  } as any;

  return new HivService(
    {} as any, // labResultsMatchingService
    monitoringService,
    {} as any, // qualityMetricsService
    {} as any, // visitTemplatesService
    {} as any, // tptTrackerService
    {} as any, // pediatricDosingService
    { create: jest.fn() } as any, // appointmentService
    {} as any, // tenantService
    { validateConcept: jest.fn() } as any, // terminologyService
    {} as any, // cdssService
  );
};

describe('HivService hardening guardrails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects EAC session when numbering is not sequential', async () => {
    const service = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [{ id: 'enroll-1' }];
        }
        if (sql.includes('SELECT session_number, session_date')) {
          return [{ session_number: 1, session_date: '2026-02-01' }];
        }
        return [];
      }),
    } as any;

    await expect(
      service.createEacSession(
        {
          enrollmentId: 'enroll-1',
          counselorId: 'user-1',
          counselorName: 'Nurse One',
          sessionNumber: 3,
          sessionDate: '2026-02-20',
          sessionOutcome: 'Completed',
          eacProgramStatus: 'Active',
        },
        tenantDb,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects EAC session when session date is earlier than latest recorded session', async () => {
    const service = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [{ id: 'enroll-1' }];
        }
        if (sql.includes('SELECT session_number, session_date')) {
          return [{ session_number: 1, session_date: '2026-02-15' }];
        }
        return [];
      }),
    } as any;

    await expect(
      service.createEacSession(
        {
          enrollmentId: 'enroll-1',
          counselorId: 'user-1',
          counselorName: 'Nurse One',
          sessionNumber: 2,
          sessionDate: '2026-02-10',
          sessionOutcome: 'Completed',
          eacProgramStatus: 'Active',
        },
        tenantDb,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects ARV change request when another open request exists', async () => {
    const service = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [{ id: 'enroll-1' }];
        }
        if (sql.includes('FROM hiv_arv_change_requests')) {
          return [{ id: 'req-1', status: 'approved' }];
        }
        return [];
      }),
    } as any;

    await expect(
      service.createArvChangeRequest(
        {
          enrollmentId: 'enroll-1',
          requestedBy: 'doctor-1',
          requestedByName: 'Doctor One',
          requestedRegimenCode: 'TLD2',
          requestedRegimenName: 'TLD 2nd line',
          changeReasonDetails: 'High viral load',
          clinicalJustification: 'Patient has persistent high viral load and requires regimen change.',
          eacCompleted: true,
          eacSessionsCompleted: 3,
        },
        tenantDb,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects ARV change request when VL pathway requires EAC completion first', async () => {
    const service = makeService();
    jest.spyOn(service, 'getVlPathway').mockResolvedValue({
      status: 'high_vl_needs_eac',
    } as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [{ id: 'enroll-1' }];
        }
        if (sql.includes('FROM hiv_arv_change_requests')) {
          return [];
        }
        return [];
      }),
    } as any;

    await expect(
      service.createArvChangeRequest(
        {
          enrollmentId: 'enroll-1',
          requestedBy: 'doctor-1',
          requestedByName: 'Doctor One',
          requestedRegimenCode: 'AZT-3TC-DTG',
          requestedRegimenName: 'AZT/3TC/DTG',
          changeReasonDetails: 'Persistent high viral load',
          clinicalJustification: 'Patient remains unsuppressed and adherence intervention is still in progress.',
          eacCompleted: false,
          eacSessionsCompleted: 1,
        },
        tenantDb,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects ARV change request when client claims EAC completed but server state is not completed', async () => {
    const service = makeService();
    jest.spyOn(service, 'getVlPathway').mockResolvedValue({
      status: 'high_vl_needs_eac',
    } as any);
    jest.spyOn(service, 'checkEacEligibility').mockResolvedValue({
      eacCompleted: false,
      eacProgram: { sessions_completed: 1 },
    } as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [{ id: 'enroll-1' }];
        }
        if (sql.includes('FROM hiv_arv_change_requests')) {
          return [];
        }
        if (sql.includes('SELECT COUNT(*) as count') && sql.includes('FROM hiv_eac_sessions')) {
          return [{ count: '1' }];
        }
        return [];
      }),
    } as any;

    await expect(
      service.createArvChangeRequest(
        {
          enrollmentId: 'enroll-1',
          requestedBy: 'doctor-1',
          requestedByName: 'Doctor One',
          requestedRegimenCode: 'ABC-3TC-DTG',
          requestedRegimenName: 'ABC/3TC/DTG',
          changeReasonDetails: 'Persistent high viral load',
          clinicalJustification: 'Patient remains unsuppressed and should continue adherence support before switch.',
          eacCompleted: true,
          eacSessionsCompleted: 3,
        },
        tenantDb,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
