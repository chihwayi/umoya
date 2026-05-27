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
    { checkDrugInteractions: jest.fn().mockResolvedValue(null) } as any, // cdssService
    {} as any, // oiEarlyWarningService
    {} as any, // vacsIndexService
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
    jest.spyOn(service, 'precheckRegimenChange').mockResolvedValue({
      allowed: true,
      blockers: [],
      warnings: [],
      requiredData: [],
      guidelineReferences: [],
    } as any);
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
    jest.spyOn(service, 'precheckRegimenChange').mockResolvedValue({
      allowed: true,
      blockers: [],
      warnings: [],
      requiredData: [],
      guidelineReferences: [],
    } as any);
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

  it('precheck blocks TDF regimen when creatinine result is missing', async () => {
    const service = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('JOIN patients p')) {
          return [
            {
              id: 'enroll-1',
              patient_id: 'patient-1',
              art_start_date: '2024-01-01',
              gender: 'male',
              date_of_birth: '1990-01-01',
            },
          ];
        }
        if (sql.includes('FROM hiv_art_regimens')) {
          return [
            {
              code: 'TDF-3TC-DTG',
              name: 'TDF/3TC/DTG',
              line: '1st Line',
              category: 'Adult',
              components: ['TDF', '3TC', 'DTG'],
            },
          ];
        }
        if (sql.includes('FROM hiv_clinical_visits')) {
          return [
            {
              pregnancy_lactating_status: null,
              tb_treatment_started: false,
              creatinine_result: null,
              alt_result: 20,
              visit_date: '2026-02-01',
            },
          ];
        }
        if (sql.includes('FROM prescriptions')) {
          return [];
        }
        if (sql.includes('FROM hiv_regimen_contraindication_rules')) {
          return [];
        }
        if (sql.includes('FROM hiv_regimen_rule_versions')) {
          return [{ version_code: 'WHO_ZW_ART_2026Q1' }];
        }
        return [];
      }),
    } as any;

    const result = await service.precheckRegimenChange(
      {
        enrollmentId: 'enroll-1',
        requestedRegimenCode: 'TDF-3TC-DTG',
        requestedRegimenName: 'TDF/3TC/DTG',
      },
      tenantDb,
    );

    expect(result.allowed).toBe(false);
    expect(result.requiredData).toContain('creatinine_result');
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers.some((item: any) => String(item.message).includes('Creatinine'))).toBe(true);
  });

  it('persists regimen safety summary when ARV change request is created', async () => {
    const service = makeService();
    jest.spyOn(service, 'precheckRegimenChange').mockResolvedValue({
      allowed: true,
      requestedRegimenCode: 'AZT-3TC-DTG',
      blockers: [],
      warnings: [{ ruleKey: 'tb_rifampicin_with_dtg_warn', message: 'warning' }],
      requiredData: [],
      guidelineReferences: ['WHO guidance'],
      context: { creatinineResult: 1.0 },
      ruleVersionCode: 'WHO_ZW_ART_2026Q1',
    } as any);
    jest.spyOn(service, 'getVlPathway').mockResolvedValue({
      status: 'failure_after_eac',
    } as any);
    jest.spyOn(service, 'checkEacEligibility').mockResolvedValue({
      eacCompleted: true,
      eacProgram: { sessions_completed: 3 },
    } as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT id, art_start_date FROM hiv_care_enrollments')) {
          return [{ id: 'enroll-1', art_start_date: '2024-01-01' }];
        }
        if (sql.includes('FROM hiv_arv_change_requests')) {
          return [];
        }
        if (sql.includes('SELECT COUNT(*) as count') && sql.includes('FROM hiv_eac_sessions')) {
          return [{ count: '3' }];
        }
        if (sql.includes('INSERT INTO hiv_arv_change_requests')) {
          return [{ id: 'req-1' }];
        }
        return [];
      }),
    } as any;

    const result = await service.createArvChangeRequest(
      {
        enrollmentId: 'enroll-1',
        requestedBy: 'doctor-1',
        requestedByName: 'Doctor One',
        currentRegimenCode: 'TDF-3TC-DTG',
        currentRegimenName: 'TDF/3TC/DTG',
        requestedRegimenCode: 'AZT-3TC-DTG',
        requestedRegimenName: 'AZT/3TC/DTG',
        changeReasonDetails: 'Persistent high viral load',
        clinicalJustification: 'Persistent high viral load after completed adherence interventions.',
      },
      tenantDb,
    );

    expect(result).toEqual(expect.objectContaining({ id: 'req-1' }));

    const insertCall = (tenantDb.query as jest.Mock).mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO hiv_arv_change_requests'),
    );
    expect(insertCall).toBeDefined();

    const params = insertCall?.[1] || [];
    expect(params.length).toBeGreaterThanOrEqual(19);
    const safetySummaryRaw = params[17];
    expect(typeof safetySummaryRaw).toBe('string');
    const safetySummary = JSON.parse(safetySummaryRaw);
    expect(safetySummary.ruleVersionCode).toBe('WHO_ZW_ART_2026Q1');
    expect(Array.isArray(safetySummary.warnings)).toBe(true);
  });
});
