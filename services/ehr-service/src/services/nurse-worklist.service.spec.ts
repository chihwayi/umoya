import { BadRequestException } from '@nestjs/common';
import { NurseWorklistService } from './nurse-worklist.service';
import { HipaaAuditAction } from './hipaa-audit.service';

const makeService = () => {
  const hipaaAuditService = {
    logAuditEvent: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new NurseWorklistService(hipaaAuditService as any),
    mocks: { hipaaAuditService },
  };
};

describe('NurseWorklistService', () => {
  const user = {
    id: 'user-1',
    firstName: 'Nurse',
    lastName: 'Joy',
    role: 'nurse',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a reason when a nurse overrides a task recommendation', async () => {
    const { service } = makeService();
    const tenantDb = { query: jest.fn() } as any;

    await expect(
      service.completeTask(tenantDb, user, 'task-1', { action: 'override' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('persists task completion context and records the audit event', async () => {
    const { service, mocks } = makeService();
    const tenantDb = { query: jest.fn().mockResolvedValue([]) } as any;

    await service.completeTask(
      tenantDb,
      user,
      'task-1',
      {
        action: 'override',
        reason: 'Patient already reviewed by physician',
        patientId: 'patient-1',
        context: { source: 'copilot', priority: 'high' },
      },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    const [sql, params] = tenantDb.query.mock.calls[0];
    expect(String(sql)).toContain('INSERT INTO nurse_copilot_task_events');
    expect(params[0]).toBe('user-1');
    expect(params[1]).toBe('task-1');
    expect(params[2]).toBe('patient-1');
    expect(params[3]).toBe('Patient already reviewed by physician');
    expect(JSON.parse(params[4])).toEqual({
      source: 'copilot',
      priority: 'high',
      action: 'override',
    });

    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_TASK_COMPLETE,
        resourceId: 'task-1',
        patientId: 'patient-1',
        metadata: expect.objectContaining({
          taskId: 'task-1',
          action: 'override',
          reason: 'Patient already reviewed by physician',
        }),
      }),
    );
  });

  it('falls back to HIPAA audit logs when nurse task and alert tables are unavailable', async () => {
    const { service } = makeService();
    let callCount = 0;
    const tenantDb = {
      query: jest.fn(async () => {
        callCount += 1;
        if (callCount <= 2) {
          const error: any = new Error('relation does not exist');
          error.code = '42P01';
          throw error;
        }

        return [
          {
            action: HipaaAuditAction.NURSE_TASK_COMPLETE,
            metadata: { taskId: 'task-1' },
          },
          {
            action: HipaaAuditAction.NURSE_ALERT_ACKNOWLEDGE,
            metadata: { alertId: 'alert-1' },
          },
          {
            action: HipaaAuditAction.NURSE_TASK_COMPLETE,
            metadata: { taskId: 'task-1' },
          },
        ];
      }),
    } as any;

    const result = await service.getState(tenantDb, 'user-1');

    expect(result).toEqual({
      completedTaskIds: ['task-1'],
      acknowledgedAlertIds: ['alert-1'],
    });
  });

  it('requires a reason when a nurse overrides an alert recommendation', async () => {
    const { service } = makeService();
    const tenantDb = { query: jest.fn() } as any;

    await expect(
      service.acknowledgeAlert(tenantDb, user, 'alert-1', { action: 'override' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('stores a bounded handoff preview and records the finalize audit event', async () => {
    const { service, mocks } = makeService();
    const tenantDb = { query: jest.fn().mockResolvedValue([]) } as any;
    const longSummary = 'handoff '.repeat(80);

    const result = await service.finalizeHandoff(
      tenantDb,
      user,
      'patient-1',
      {
        summary: longSummary,
        reason: 'Prepared for shift change',
        context: { source: 'copilot' },
      },
      { sessionId: 'session-1' },
    );

    expect(result).toEqual({ ok: true, patientId: 'patient-1', status: 'finalized' });
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_handoff_workflow_state'),
      expect.arrayContaining([
        'patient-1',
        'user-1',
        expect.any(String),
        'Prepared for shift change',
        JSON.stringify({ source: 'copilot' }),
      ]),
    );

    const preview = tenantDb.query.mock.calls[0][1][2];
    expect(preview.length).toBeLessThanOrEqual(300);
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_HANDOFF_FINALIZE,
        resourceId: 'patient-1',
        patientId: 'patient-1',
        metadata: expect.objectContaining({
          reason: 'Prepared for shift change',
          summaryPreview: preview,
        }),
      }),
    );
  });
});
