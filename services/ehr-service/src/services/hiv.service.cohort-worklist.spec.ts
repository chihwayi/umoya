import { HivService } from './hiv.service';

const makeService = () => {
  const monitoringService = {
    calculateNextViralLoadDate: jest.fn((artStartDate: Date | null, lastVlDate: Date | null, lastVlResult: number | null) => {
      if (lastVlDate && lastVlResult !== null && lastVlResult >= 1000) {
        return new Date('2026-02-01T00:00:00.000Z');
      }
      if (lastVlDate) {
        return new Date('2026-04-01T00:00:00.000Z');
      }
      return new Date('2026-02-15T00:00:00.000Z');
    }),
    calculateNextCD4Date: jest.fn(),
    checkTreatmentFailure: jest.fn().mockReturnValue({
      isTreatmentFailure: false,
      severity: 'medium',
      reason: null,
    }),
  } as any;

  return {
    service: new HivService(
      {} as any,
      monitoringService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { create: jest.fn() } as any,
      {} as any,
      { validateConcept: jest.fn() } as any,
      {} as any, // cdssService
      {} as any, // oiEarlyWarningService
      {} as any, // vacsIndexService
    ),
    monitoringService,
  };
};

describe('HivService cohort worklist', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('prioritizes regimen review, EAC continuation, and outreach actions across the cohort', async () => {
    const { service, monitoringService } = makeService();
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          enrollment_id: 'enroll-1',
          patient_id: 'patient-1',
          enrollment_number: 'HIV-001',
          enrollment_date: '2025-01-01',
          art_start_date: '2025-01-10',
          current_regimen: 'TLD',
          patient_number: 'P001',
          first_name: 'Alice',
          last_name: 'Moyo',
          visit_date: '2026-03-01',
          next_review_date: '2026-03-20',
          viral_load: '3500',
          viral_load_test_date: '2026-02-10',
          viral_load_unit: 'copies/mL',
          viral_load_suppressed: false,
          arv_status: '3',
          arv_regimen_name: 'TLD',
          arv_adherence_percentage: 92,
          tpt_status: 'II',
          intake_recorded_at: '2026-03-01T09:00:00.000Z',
          intake_adherence_percentage: 90,
          intake_regimen: 'TLD',
          active_eac_session_count: 0,
          active_eac_session_date: null,
          completed_eac_date: null,
          pending_request_count: 1,
          approved_without_visit_count: 0,
        },
        {
          enrollment_id: 'enroll-2',
          patient_id: 'patient-2',
          enrollment_number: 'HIV-002',
          enrollment_date: '2024-09-14',
          art_start_date: '2024-09-20',
          current_regimen: 'TLE',
          patient_number: 'P002',
          first_name: 'Brian',
          last_name: 'Ncube',
          visit_date: '2026-02-20',
          next_review_date: '2026-03-05',
          viral_load: '1800',
          viral_load_test_date: '2026-02-18',
          viral_load_unit: 'copies/mL',
          viral_load_suppressed: false,
          arv_status: '3',
          arv_regimen_name: 'TLE',
          arv_adherence_percentage: 97,
          tpt_status: 'II',
          intake_recorded_at: '2026-02-19T09:00:00.000Z',
          intake_adherence_percentage: 97,
          intake_regimen: 'TLE',
          active_eac_session_count: 2,
          active_eac_session_date: '2026-02-25',
          completed_eac_date: null,
          pending_request_count: 0,
          approved_without_visit_count: 0,
        },
        {
          enrollment_id: 'enroll-3',
          patient_id: 'patient-3',
          enrollment_number: 'HIV-003',
          enrollment_date: '2025-03-01',
          art_start_date: '2025-03-15',
          current_regimen: 'TLD',
          patient_number: 'P003',
          first_name: 'Chipo',
          last_name: 'Dube',
          visit_date: '2025-11-15',
          next_review_date: '2025-12-15',
          viral_load: '400',
          viral_load_test_date: '2025-11-15',
          viral_load_unit: 'copies/mL',
          viral_load_suppressed: true,
          arv_status: '3',
          arv_regimen_name: 'TLD',
          arv_adherence_percentage: 98,
          tpt_status: 'II',
          intake_recorded_at: null,
          intake_adherence_percentage: null,
          intake_regimen: null,
          active_eac_session_count: 0,
          active_eac_session_date: null,
          completed_eac_date: null,
          pending_request_count: 0,
          approved_without_visit_count: 0,
        },
      ]),
    } as any;

    const result = await service.getCohortWorklist({ limit: 10 }, tenantDb);

    expect(result.summary.totalItems).toBe(3);
    expect(result.summary.byPriority.critical).toBe(1);
    expect(result.summary.byPriority.high).toBe(2);
    const itemByEnrollment = Object.fromEntries(
      result.items.map((item: any) => [item.enrollmentId, item]),
    );

    expect(itemByEnrollment['enroll-1']).toEqual(
      expect.objectContaining({
        enrollmentId: 'enroll-1',
        primaryAction: 'doctor_review_pending_regimen_change',
        priority: 'high',
      }),
    );
    expect(itemByEnrollment['enroll-2']).toEqual(
      expect.objectContaining({
        enrollmentId: 'enroll-2',
        primaryAction: 'continue_eac',
        priority: 'high',
      }),
    );
    expect(itemByEnrollment['enroll-3']).toEqual(
      expect.objectContaining({
        enrollmentId: 'enroll-3',
        primaryAction: 'patient_outreach',
        priority: 'critical',
      }),
    );
    expect(result.summary.flagCounts.ltfuRisk).toBe(1);
    expect(result.summary.flagCounts.unsuppressed).toBe(2);
    expect(monitoringService.calculateNextViralLoadDate).toHaveBeenCalled();
  });

  it('filters the cohort worklist by requested focus', async () => {
    const { service } = makeService();
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          enrollment_id: 'enroll-1',
          patient_id: 'patient-1',
          enrollment_number: 'HIV-001',
          enrollment_date: '2025-01-01',
          art_start_date: '2025-01-10',
          current_regimen: 'TLD',
          patient_number: 'P001',
          first_name: 'Alice',
          last_name: 'Moyo',
          visit_date: '2026-03-01',
          next_review_date: '2026-03-20',
          viral_load: '3500',
          viral_load_test_date: '2026-02-10',
          viral_load_unit: 'copies/mL',
          viral_load_suppressed: false,
          arv_status: '3',
          arv_regimen_name: 'TLD',
          arv_adherence_percentage: 92,
          tpt_status: 'II',
          intake_recorded_at: '2026-03-01T09:00:00.000Z',
          intake_adherence_percentage: 90,
          intake_regimen: 'TLD',
          active_eac_session_count: 0,
          active_eac_session_date: null,
          completed_eac_date: null,
          pending_request_count: 0,
          approved_without_visit_count: 0,
        },
        {
          enrollment_id: 'enroll-2',
          patient_id: 'patient-2',
          enrollment_number: 'HIV-002',
          enrollment_date: '2024-06-01',
          art_start_date: '2024-06-10',
          current_regimen: 'TLE',
          patient_number: 'P002',
          first_name: 'Brian',
          last_name: 'Ncube',
          visit_date: '2026-03-09',
          next_review_date: '2026-03-15',
          viral_load: '500',
          viral_load_test_date: '2026-03-01',
          viral_load_unit: 'copies/mL',
          viral_load_suppressed: true,
          arv_status: '3',
          arv_regimen_name: 'TLE',
          arv_adherence_percentage: 80,
          tpt_status: 'II',
          intake_recorded_at: '2026-03-09T09:00:00.000Z',
          intake_adherence_percentage: 80,
          intake_regimen: 'TLE',
          active_eac_session_count: 0,
          active_eac_session_date: null,
          completed_eac_date: null,
          pending_request_count: 0,
          approved_without_visit_count: 0,
        },
      ]),
    } as any;

    const regimenResult = await service.getCohortWorklist({ focus: 'regimen_review' }, tenantDb);
    expect(regimenResult.items).toHaveLength(0);

    const adherenceResult = await service.getCohortWorklist({ focus: 'adherence' }, tenantDb);
    expect(adherenceResult.items).toHaveLength(2);
    expect(adherenceResult.items.map((item: any) => item.primaryAction)).toEqual(
      expect.arrayContaining(['start_eac', 'adherence_counseling']),
    );
  });
});
