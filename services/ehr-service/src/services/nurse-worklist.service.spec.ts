import { BadRequestException } from '@nestjs/common';
import { NurseWorklistService } from './nurse-worklist.service';
import { HipaaAuditAction } from './hipaa-audit.service';

const makeService = () => {
  const hipaaAuditService = {
    logAuditEvent: jest.fn().mockResolvedValue(undefined),
  };
  const hivService = {
    getEnrollments: jest.fn().mockResolvedValue({ enrollments: [] }),
    getVlPathway: jest.fn(),
  };

  return {
    service: new NurseWorklistService(hipaaAuditService as any, hivService as any),
    mocks: { hipaaAuditService, hivService },
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

  it('builds a cross-module escalation feed from maternity tasks and HIV follow-up items', async () => {
    const { service, mocks } = makeService();
    mocks.hivService.getEnrollments.mockResolvedValue({
      enrollments: [
        {
          id: 'enroll-hiv-1',
          patient_id: 'patient-hiv-1',
          enrollment_number: 'HIV-001',
          first_name: 'Tariro',
          last_name: 'Moyo',
          patient_number: 'P-100',
          last_viral_load: 4500,
          last_viral_load_date: '2026-03-03',
        },
      ],
    });
    mocks.hivService.getVlPathway.mockResolvedValue({
      status: 'high_vl_needs_eac',
      actions: ['start_eac', 'repeat_vl_after_eac'],
      lastVlValue: 4500,
      lastVlDate: '2026-03-03',
      nextVlDate: '2026-06-03',
      overdue: false,
    });

    let queryCount = 0;
    const tenantDb = {
      query: jest.fn(async () => {
        queryCount += 1;
        if (queryCount === 1) {
          return [
            {
              id: 'mat-task-1',
              maternity_enrollment_id: 'mat-enroll-1',
              patient_id: 'patient-mat-1',
              source_type: 'anc_visit',
              source_record_id: 'anc-1',
              status: 'open',
              priority: 'critical',
              title: 'Critical ANC escalation',
              summary: 'Doctor review required for severe hypertension.',
              required_actions: ['Escalate to obstetric doctor immediately.'],
              task_context: { recommendation_bundle: { bundle_label: 'ANC escalation bundle' } },
              note: null,
              last_event_at: '2026-03-04T08:00:00.000Z',
              created_at: '2026-03-04T07:00:00.000Z',
              age_hours: 2.5,
              sla_status: 'due_soon',
              patient_name: 'Rutendo Ncube',
              patient_number: 'P-200',
              enrollment_number: 'MAT-001',
            },
          ];
        }

        if (queryCount === 2) {
          return [
            {
              id: 'req-1',
              enrollment_id: 'enroll-hiv-2',
              request_date: '2026-03-02',
              approval_date: '2026-03-04',
              current_regimen_name: 'TDF/3TC/DTG',
              requested_regimen_name: 'AZT/3TC/ATV/r',
              change_reason_details: 'Virologic failure',
              clinical_justification: 'Confirmed failure after repeat VL',
              approved_by_name: 'Dr. Dube',
              patient_id: 'patient-hiv-2',
              enrollment_number: 'HIV-002',
              patient_name: 'Linda Moyo',
              patient_number: 'P-300',
            },
          ];
        }

        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);

    expect(result.summary).toEqual({
      total: 3,
      critical: 1,
      high: 2,
      maternity: 1,
      hiv: 2,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'maternity:mat-task-1',
        module: 'maternity',
        severity: 'critical',
        doctor_sync_status: 'awaiting_doctor_review',
      }),
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'hiv-regimen:req-1',
          module: 'hiv',
          workflow_status: 'doctor_approved_pending_nurse_record',
          doctor_sync_status: 'doctor_approved',
        }),
        expect.objectContaining({
          id: 'hiv-pathway:enroll-hiv-1:high_vl_needs_eac',
          module: 'hiv',
          workflow_status: 'high_vl_needs_eac',
          recommended_action: expect.stringContaining('start eac'),
        }),
      ]),
    );
    expect(mocks.hivService.getVlPathway).toHaveBeenCalledWith('enroll-hiv-1', tenantDb);
  });
});
