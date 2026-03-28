import { CareGapSchedulerService } from './care-gap-scheduler.service';

describe('CareGapSchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes nightly care gap detection through governed CdssService', async () => {
    const tenantDb = {
      query: jest.fn()
        .mockResolvedValueOnce([
          { patient_id: 'patient-1', patient_age: 52, patient_gender: 'female' },
        ])
        .mockResolvedValueOnce([{ code: 'I10' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined),
    } as any;
    const tenantService = {
      getAllActiveTenants: jest.fn().mockResolvedValue([{ subdomain: 'kids-clinic' }]),
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const nurseTaskService = {
      createCareGap: jest.fn().mockResolvedValue({ id: 'gap-1' }),
      createTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    const cdssService = {
      detectCareGaps: jest.fn().mockResolvedValue({
        gaps: [{ type: 'bp_followup', description: 'BP review due', recommended_action: 'Book BP check', priority: 'high' }],
      }),
    };

    const service = new CareGapSchedulerService(tenantService as any, nurseTaskService as any, cdssService as any);
    await service.runNightlyGapDetection();

    expect(cdssService.detectCareGaps).toHaveBeenCalledWith(
      52,
      'female',
      [],
      ['I10'],
      {
        tenantId: 'kids-clinic',
        tenantDb,
        patientId: 'patient-1',
        context: 'scheduled_care_gap_detection',
        specialty: 'primary_care',
        module: 'population_health',
      },
    );
    expect(nurseTaskService.createCareGap).toHaveBeenCalled();
    expect(nurseTaskService.createTask).toHaveBeenCalled();
  });
});
