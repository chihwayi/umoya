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
    createEacSession: jest.fn(),
    createReferral: jest.fn(),
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

  it('updates shared cross-module workflow state and records the audit event', async () => {
    const { service, mocks } = makeService();
    const tenantDb = { query: jest.fn().mockResolvedValue([]) } as any;

    const result = await service.updateCrossModuleWorkflowState(
      tenantDb,
      user,
      {
        itemId: 'hiv-regimen:req-1',
        module: 'hiv',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-1',
        patientId: 'patient-1',
        enrollmentId: 'enroll-1',
        status: 'acknowledged',
        note: 'Patient counselled and queued for next visit',
        context: { source: 'jest' },
        destinationRole: 'nurse',
        destinationService: 'hiv_clinic',
        destinationSpecialty: 'HIV',
      },
      { sessionId: 'session-1' },
    );

    expect(result).toEqual({ ok: true, itemId: 'hiv-regimen:req-1', status: 'acknowledged' });
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'hiv-regimen:req-1',
        'hiv',
        'hiv_regimen_change',
        'req-1',
        'enroll-1',
        'patient-1',
        'acknowledged',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'hiv-regimen:req-1',
        patientId: 'patient-1',
        metadata: expect.objectContaining({
          module: 'hiv',
          itemType: 'hiv_regimen_change',
          status: 'acknowledged',
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
          date_of_birth: '2018-03-01',
          last_viral_load: 4500,
          last_viral_load_date: '2026-03-03',
          current_regimen_code: 'ABC/3TC/DTG',
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

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [
            {
              workflow_key: 'hiv-regimen:req-1',
              status: 'acknowledged',
              destination_role: 'nurse',
              destination_service: 'hiv_clinic',
              destination_specialty: 'HIV',
              destination_user_id: 'user-hiv-nurse',
              destination_user_name: 'Nurse HIV',
              acknowledged_at: '2026-03-04T09:00:00.000Z',
              completed_at: null,
              note: 'Queued for next clinic visit',
              context: {
                source: 'jest',
                action_executions: {
                  'pregnancy-safety-review': {
                    status: 'completed',
                    executed_at: '2026-03-04T10:00:00.000Z',
                    executed_by_name: 'Nurse Joy',
                    result: { operation: 'pmtct_referral_created' },
                  },
                },
              },
              acknowledged_by_name: 'Nurse Joy',
              completed_by_name: null,
            },
          ];
        }

        if (sql.includes("FROM users") && sql.includes("WHERE is_active = true")) {
          return [
            { id: 'doctor-ob', role: 'doctor', specialization: 'Obstetrics', name: 'Dr. Moyo' },
            { id: 'user-hiv-nurse', role: 'nurse', specialization: 'HIV', name: 'Nurse HIV' },
            { id: 'doctor-hiv', role: 'doctor', specialization: 'HIV', name: 'Dr. HIV' },
          ];
        }

        if (sql.includes('FROM referral_facilities')) {
          return [
            { id: 'facility-ob', facility_name: 'Central Women Hospital', specialties: ['Obstetrics', 'HIV'] },
          ];
        }

        if (sql.includes('FROM maternity_care_tasks')) {
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
              assigned_to: 'doctor-ob',
              assigned_to_name: 'Dr. Moyo',
            },
          ];
        }

        if (sql.includes('FROM hiv_arv_change_requests')) {
          return [
            {
              id: 'req-1',
              enrollment_id: 'enroll-hiv-2',
              request_date: '2026-03-02',
              approval_date: '2026-03-04',
              requested_regimen_code: 'AZT/3TC/ATV/r',
              current_regimen_name: 'TDF/3TC/DTG',
              requested_regimen_name: 'AZT/3TC/ATV/r',
              change_reason_details: 'Virologic failure',
              clinical_justification: 'Confirmed failure after repeat VL',
              regimen_safety_summary: {
                warnings: [
                  {
                    message: 'Review pregnancy safety before switch.',
                    recommendedAction: 'Confirm PMTCT plan and regimen appropriateness.',
                  },
                ],
                guidelineReferences: [
                  'WHO regimen switch safety guidance',
                ],
                context: {
                  tbMedications: ['Rifampicin'],
                },
              },
              approved_by_name: 'Dr. Dube',
              patient_id: 'patient-hiv-2',
              enrollment_number: 'HIV-002',
              date_of_birth: '1997-04-02',
              patient_name: 'Linda Moyo',
              patient_number: 'P-300',
            },
          ];
        }

        if (sql.includes('FROM hiv_clinical_visits v')) {
          return [
            {
              enrollment_id: 'enroll-hiv-1',
              visit_date: '2026-03-03',
              pregnancy_lactating_status: 'NP',
              tb_treatment_started: false,
              creatinine_result: null,
              alt_result: null,
              weight: 24,
              arv_regimen_code: 'ABC/3TC/DTG',
            },
            {
              enrollment_id: 'enroll-hiv-2',
              visit_date: '2026-03-04',
              pregnancy_lactating_status: 'P',
              tb_treatment_started: true,
              creatinine_result: 0.8,
              alt_result: 32,
              weight: 63,
              arv_regimen_code: 'TDF/3TC/DTG',
            },
          ];
        }

        if (sql.includes('FROM nurse_handoff_workflow_state')) {
          return [
            {
              patient_id: 'patient-handoff-1',
              status: 'draft',
              finalized_at: null,
              reviewed_at: null,
              shared_at: null,
              updated_at: '2026-03-04T04:00:00.000Z',
              patient_name: 'Shift Patient',
              patient_number: 'P-400',
            },
          ];
        }

        if (sql.includes('FROM medication_administration_records')) {
          return [
            {
              id: 'mar-1',
              patient_id: 'patient-med-1',
              medication_name: 'Co-trimoxazole',
              dose: '960',
              unit: 'mg',
              route: 'PO',
              scheduled_time: '2026-03-04T02:00:00.000Z',
              actual_administration_time: null,
              administration_status: 'held',
              refusal_reason: null,
              omission_reason: 'Awaiting clinician review',
              notes: null,
              patient_name: 'Medication Patient',
              patient_number: 'P-500',
            },
          ];
        }

        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);

    expect(result.summary).toEqual({
      total: 5,
      critical: 1,
      high: 4,
      maternity: 1,
      hiv: 2,
      nursing: 2,
      handoff: 1,
      medication: 1,
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
          workflow_status: 'acknowledged',
          module_status: 'doctor_approved_pending_nurse_record',
          doctor_sync_status: 'doctor_approved',
          destination_user_name: 'Nurse HIV',
        }),
        expect.objectContaining({
          id: 'hiv-pathway:enroll-hiv-1:high_vl_needs_eac:2026-03-03',
          module: 'hiv',
          module_status: 'high_vl_needs_eac',
          recommended_action: expect.stringContaining('start eac'),
        }),
        expect.objectContaining({
          module: 'nursing',
          item_type: 'nurse_handoff_risk',
          title: 'Shift handoff follow-through required',
        }),
        expect.objectContaining({
          module: 'nursing',
          item_type: 'medication_administration_followup',
          title: 'Held medication requires follow-up',
        }),
      ]),
    );
    const hivRegimenItem = result.items.find((item: any) => item.id === 'hiv-regimen:req-1');
    expect(hivRegimenItem.metadata?.recommendation_bundle).toEqual(
      expect.objectContaining({
        bundle_label: 'WHO HIV regimen follow-through bundle',
        actionable_count: 5,
      }),
    );
    expect(hivRegimenItem.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'regimen-counseling', type: 'counseling' }),
        expect.objectContaining({
          id: 'pregnancy-safety-review',
          type: 'pmtct_followup',
          execution_status: 'completed',
        }),
        expect.objectContaining({ id: 'tb-interaction-review', type: 'interaction_review' }),
      ]),
    );
    expect(hivRegimenItem.metadata?.recommendation_bundle?.applied_count).toBe(1);
    expect(hivRegimenItem.metadata?.guideline_citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: 'regimen.pmtct' }),
        expect.objectContaining({ rule_id: 'regimen.tb_interaction' }),
      ]),
    );

    const hivPathwayItem = result.items.find(
      (item: any) => item.id === 'hiv-pathway:enroll-hiv-1:high_vl_needs_eac:2026-03-03',
    );
    expect(hivPathwayItem.metadata?.recommendation_bundle).toEqual(
      expect.objectContaining({
        bundle_label: 'WHO HIV nurse follow-up bundle',
        actionable_count: 3,
      }),
    );
    expect(hivPathwayItem.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'eac-followup', type: 'follow_up' }),
        expect.objectContaining({ id: 'pediatric-adherence', type: 'dose_review' }),
      ]),
    );
    expect(hivPathwayItem.metadata?.guideline_citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule_id: 'vl-pathway.pediatric' }),
      ]),
    );
    expect(mocks.hivService.getVlPathway).toHaveBeenCalledWith('enroll-hiv-1', tenantDb);
  });

  it('executes a start EAC recommendation and persists bundle execution state', async () => {
    const { service, mocks } = makeService();
    mocks.hivService.createEacSession.mockResolvedValue({
      id: 'eac-1',
      session_number: 1,
      session_date: '2026-03-04',
    });

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM hiv_eac_sessions')) {
          return [];
        }
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-pathway:enroll-hiv-1:high_vl_needs_eac:2026-03-03',
        itemType: 'hiv_vl_followup',
        sourceRecordId: 'enroll-hiv-1',
        patientId: 'patient-hiv-1',
        enrollmentId: 'enroll-hiv-1',
        actionId: 'eac-followup',
        actionType: 'follow_up',
        actionTitle: 'Start or schedule EAC follow-up',
      },
      { sessionId: 'session-1' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        actionId: 'eac-followup',
        result: expect.objectContaining({
          operation: 'eac_session_created',
          sessionId: 'eac-1',
        }),
      }),
    );
    expect(mocks.hivService.createEacSession).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: 'enroll-hiv-1',
        sessionNumber: 1,
        counselorId: 'user-1',
      }),
      tenantDb,
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'hiv-pathway:enroll-hiv-1:high_vl_needs_eac:2026-03-03',
        'hiv',
        'hiv_vl_followup',
      ]),
    );
  });

  it('executes repeat viral load scheduling and PMTCT linkage from the nurse queue', async () => {
    const { service, mocks } = makeService();
    mocks.hivService.createReferral.mockResolvedValue({
      id: 'ref-1',
      referral_status: 'pending',
    });

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM hiv_monitoring_schedules')) {
          return [];
        }
        if (sql.includes('INSERT INTO hiv_monitoring_schedules')) {
          return [{ id: 'sched-1', next_scheduled_date: '2026-06-03' }];
        }
        if (sql.includes("FROM hiv_referrals") && sql.includes("referral_type = 'P'")) {
          return [];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const repeatVlResult = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-pathway:enroll-hiv-1:high_vl_needs_eac:2026-03-03',
        itemType: 'hiv_vl_followup',
        sourceRecordId: 'enroll-hiv-1',
        patientId: 'patient-hiv-1',
        enrollmentId: 'enroll-hiv-1',
        actionId: 'repeat-vl-plan',
        actionType: 'lab_followup',
        actionTitle: 'Prepare repeat viral load follow-up',
        actionPayload: {
          next_vl_date: '2026-06-03',
        },
      },
      { sessionId: 'session-1' },
    );

    expect(repeatVlResult.result).toEqual(
      expect.objectContaining({
        operation: 'vl_monitoring_scheduled',
        scheduleId: 'sched-1',
      }),
    );

    const pmtctResult = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-regimen:req-1',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-1',
        patientId: 'patient-hiv-2',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'pregnancy-safety-review',
        actionType: 'pmtct_followup',
        actionTitle: 'Confirm pregnancy or PMTCT regimen safety',
        destinationFacilityName: 'ANC / PMTCT clinic',
      },
      { sessionId: 'session-1' },
    );

    expect(pmtctResult.result).toEqual(
      expect.objectContaining({
        operation: 'pmtct_referral_created',
        referralId: 'ref-1',
      }),
    );
    expect(mocks.hivService.createReferral).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: 'enroll-hiv-2',
        referralType: 'P',
        referralPriority: 'urgent',
      }),
      tenantDb,
    );
  });
});
