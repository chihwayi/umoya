import { NurseWorklistController } from './nurse-worklist.controller';

describe('NurseWorklistController', () => {
  const mockTenantDb = {} as any;
  const mockUser = { id: 'doctor-1', role: 'doctor' } as any;

  const nurseWorklistService = {
    getCrossModuleEscalationFeed: jest.fn(),
    getDoctorSynchronizationFeed: jest.fn(),
    getDoctorOutcomeAnalytics: jest.fn(),
    executeLabRecommendationAction: jest.fn(),
    executeImagingRecommendationAction: jest.fn(),
    executePharmacyRecommendationAction: jest.fn(),
  } as any;

  let controller: NurseWorklistController;

  beforeEach(() => {
    controller = new NurseWorklistController(nurseWorklistService);
    jest.clearAllMocks();
  });

  it('returns doctor outcome analytics with parsed filters', async () => {
    const expected = { totals: { completed: 7 } };
    nurseWorklistService.getDoctorOutcomeAnalytics.mockResolvedValue(expected);

    const req = { tenantDb: mockTenantDb } as any;
    const result = await controller.getDoctorOutcomeAnalytics(
      '45',
      'oncology',
      'completed',
      'case-1',
      '2026-02-01',
      '2026-03-01',
      req,
    );

    expect(result).toEqual(expected);
    expect(nurseWorklistService.getDoctorOutcomeAnalytics).toHaveBeenCalledWith(mockTenantDb, {
      days: 45,
      module: 'oncology',
      status: 'completed',
      caseId: 'case-1',
      dateFrom: '2026-02-01',
      dateTo: '2026-03-01',
    });
  });

  it('returns doctor synchronization feed with parsed filters', async () => {
    const expected = { summary: { total: 3 } };
    nurseWorklistService.getDoctorSynchronizationFeed.mockResolvedValue(expected);

    const result = await controller.getDoctorSyncFeed(
      'critical_results',
      'true',
      { tenantDb: mockTenantDb } as any,
    );

    expect(result).toEqual(expected);
    expect(nurseWorklistService.getDoctorSynchronizationFeed).toHaveBeenCalledWith(mockTenantDb, {
      focus: 'critical_results',
      includeAcknowledged: true,
    });
  });

  it('falls back to undefined days when the query is not numeric', async () => {
    nurseWorklistService.getDoctorOutcomeAnalytics.mockResolvedValue({ totals: { completed: 0 } });

    await controller.getDoctorOutcomeAnalytics(
      'not-a-number',
      'lab',
      'pending',
      '',
      '',
      '',
      { tenantDb: mockTenantDb } as any,
    );

    expect(nurseWorklistService.getDoctorOutcomeAnalytics).toHaveBeenCalledWith(mockTenantDb, {
      days: undefined,
      module: 'lab',
      status: 'pending',
      caseId: '',
      dateFrom: '',
      dateTo: '',
    });
  });

  it('forwards lab recommendation actions with audit metadata', async () => {
    const payload = {
      itemId: 'lab-critical-alert:lab-alert-1',
      itemType: 'lab_critical_alert_followup',
      alertId: 'lab-alert-1',
      actionId: 'acknowledge-critical-lab-alert',
    };
    const expected = { actionId: payload.actionId, status: 'executed' };
    nurseWorklistService.executeLabRecommendationAction.mockResolvedValue(expected);

    const req = {
      tenantDb: mockTenantDb,
      user: mockUser,
      ip: '10.0.0.10',
      headers: {
        'user-agent': 'jest-agent',
        'x-session-id': 'session-1',
      },
    } as any;

    const result = await controller.executeLabRecommendationAction(payload as any, req);

    expect(result).toEqual(expected);
    expect(nurseWorklistService.executeLabRecommendationAction).toHaveBeenCalledWith(
      mockTenantDb,
      mockUser,
      payload,
      {
        ipAddress: '10.0.0.10',
        userAgent: 'jest-agent',
        sessionId: 'session-1',
      },
    );
  });

  it('forwards pharmacy recommendation actions using forwarded-for fallback', async () => {
    const payload = {
      itemId: 'pharmacy-prescription:rx-1',
      itemType: 'pharmacy_protocol_followup',
      prescriptionId: 'rx-1',
      actionId: 'prepare-pharmacy-dispense-plan',
    };
    const expected = { actionId: payload.actionId, status: 'executed' };
    nurseWorklistService.executePharmacyRecommendationAction.mockResolvedValue(expected);

    const req = {
      tenantDb: mockTenantDb,
      user: mockUser,
      headers: {
        'x-forwarded-for': '10.0.0.11',
        'user-agent': 'jest-agent',
      },
    } as any;

    const result = await controller.executePharmacyRecommendationAction(payload as any, req);

    expect(result).toEqual(expected);
    expect(nurseWorklistService.executePharmacyRecommendationAction).toHaveBeenCalledWith(
      mockTenantDb,
      mockUser,
      payload,
      {
        ipAddress: '10.0.0.11',
        userAgent: 'jest-agent',
        sessionId: undefined,
      },
    );
  });

  it('forwards imaging recommendation actions with request metadata', async () => {
    const payload = {
      itemId: 'imaging-report:img-report-1',
      itemType: 'imaging_doctor_result_followup',
      reportId: 'img-report-1',
      actionId: 'prepare-radiology-followup-bundle',
    };
    const expected = { actionId: payload.actionId, status: 'executed' };
    nurseWorklistService.executeImagingRecommendationAction.mockResolvedValue(expected);

    const req = {
      tenantDb: mockTenantDb,
      user: mockUser,
      headers: {
        'x-forwarded-for': '10.0.0.12',
        'user-agent': 'jest-agent',
        'x-session-id': 'session-img-1',
      },
    } as any;

    const result = await controller.executeImagingRecommendationAction(payload as any, req);

    expect(result).toEqual(expected);
    expect(nurseWorklistService.executeImagingRecommendationAction).toHaveBeenCalledWith(
      mockTenantDb,
      mockUser,
      payload,
      {
        ipAddress: '10.0.0.12',
        userAgent: 'jest-agent',
        sessionId: 'session-img-1',
      },
    );
  });

  it('returns cross-module feed via service', async () => {
    const expected = { items: [{ id: 'item-1' }] };
    nurseWorklistService.getCrossModuleEscalationFeed.mockResolvedValue(expected);

    const result = await controller.getCrossModuleFeed({ tenantDb: mockTenantDb } as any);
    expect(result).toEqual(expected);
    expect(nurseWorklistService.getCrossModuleEscalationFeed).toHaveBeenCalledWith(mockTenantDb);
  });
});
