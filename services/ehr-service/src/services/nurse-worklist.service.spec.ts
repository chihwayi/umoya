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
    saveNurseIntake: jest.fn(),
    logAuditAction: jest.fn().mockResolvedValue(undefined),
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

        if (sql.includes('FROM oncology_infusion_sessions ois')) {
          return [
            {
              infusion_session_id: 'inf-1',
              regimen_id: 'reg-1',
              session_date: '2026-03-05T09:00:00.000Z',
              session_status: 'scheduled',
              payment_status: 'payment_confirmed',
              cycle_number: 2,
              session_notes: null,
              regimen_record_id: 'reg-1',
              regimen_name: 'Paclitaxel + Carboplatin',
              regimen_status: 'active',
              oncology_case_id: 'onco-case-1',
              case_status: 'active',
              primary_diagnosis: 'Breast carcinoma',
              overall_stage: 'IIIB',
              patient_id: 'patient-onc-1',
              patient_name: 'Nyasha Maseko',
              patient_number: 'P-600',
              oncologist_name: 'Dr. Onco',
              active_grade3_plus: 1,
            },
          ];
        }

        if (sql.includes('FROM oncology_adverse_events oae')) {
          return [
            {
              adverse_event_id: 'ae-1',
              oncology_case_id: 'onco-case-2',
              regimen_id: 'reg-2',
              event_date: '2026-03-04T11:00:00.000Z',
              event_type: 'Neutropenia',
              grade: '3',
              notes: null,
              action_taken: null,
              outcome: null,
              case_status: 'active',
              primary_diagnosis: 'Lung adenocarcinoma',
              overall_stage: 'IV',
              regimen_name: 'Cisplatin + Pemetrexed',
              patient_id: 'patient-onc-2',
              patient_name: 'Sipho Dube',
              patient_number: 'P-700',
            },
          ];
        }

        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);

    expect(result.summary).toEqual({
      total: 7,
      critical: 2,
      high: 5,
      maternity: 1,
      hiv: 2,
      oncology: 2,
      nursing: 2,
      handoff: 1,
      medication: 1,
    });
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'maternity:mat-task-1',
          module: 'maternity',
          severity: 'critical',
          doctor_sync_status: 'awaiting_doctor_review',
        }),
      ]),
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'oncology-infusion:inf-1',
          module: 'oncology',
          item_type: 'oncology_infusion_followup',
          severity: 'critical',
          doctor_sync_status: 'oncologist_review_recommended',
        }),
      ]),
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
          id: 'oncology-toxicity:ae-1',
          module: 'oncology',
          item_type: 'oncology_toxicity_followup',
          severity: 'high',
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

  it('executes regimen counseling and visit-preparation actions for approved HIV regimen changes', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('UPDATE hiv_arv_change_requests')) {
          return [
            {
              id: 'req-1',
              enrollment_id: 'enroll-hiv-2',
              status: 'approved',
              visit_recorded: false,
              requested_regimen_code: 'AZT/3TC/ATV/r',
              requested_regimen_name: 'AZT/3TC/ATV/r',
            },
          ];
        }
        if (sql.includes('FROM hiv_arv_change_requests') && sql.includes('WHERE id = $1')) {
          return [
            {
              id: 'req-1',
              visit_recorded: false,
              requested_regimen_code: 'AZT/3TC/ATV/r',
              requested_regimen_name: 'AZT/3TC/ATV/r',
            },
          ];
        }
        if (sql.includes('INSERT INTO hiv_adherence_tracking')) {
          return [{ id: 'adh-1', tracking_date: '2026-03-05' }];
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

    const counseling = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-regimen:req-1',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-1',
        patientId: 'patient-hiv-2',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'regimen-counseling',
        actionType: 'counseling',
        actionTitle: 'Counsel patient on approved regimen switch',
        actionPayload: {
          current_regimen: 'TDF/3TC/DTG',
          requested_regimen: 'AZT/3TC/ATV/r',
        },
      },
      { sessionId: 'session-1' },
    );

    expect(counseling.result).toEqual(
      expect.objectContaining({
        operation: 'regimen_counseling_completed',
        requestId: 'req-1',
        adherenceTrackingId: 'adh-1',
      }),
    );

    const visitPrep = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-regimen:req-1',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-1',
        patientId: 'patient-hiv-2',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'visit-recording',
        actionType: 'visit_preparation',
        actionTitle: 'Prepare next HIV clinical visit recording',
      },
      { sessionId: 'session-1' },
    );

    expect(visitPrep.result).toEqual(
      expect.objectContaining({
        operation: 'visit_preparation_completed',
        requestId: 'req-1',
        requestedRegimenCode: 'AZT/3TC/ATV/r',
      }),
    );
    expect(mocks.hivService.logAuditAction).toHaveBeenCalledWith(
      'regimen_counseling_completed',
      expect.any(String),
      'enroll-hiv-2',
      null,
      expect.objectContaining({
        requestId: 'req-1',
      }),
      'user-1',
      'Nurse Joy',
      tenantDb,
    );
    expect(mocks.hivService.logAuditAction).toHaveBeenCalledWith(
      'regimen_visit_preparation_completed',
      expect.any(String),
      'enroll-hiv-2',
      null,
      expect.objectContaining({
        requestId: 'req-1',
      }),
      'user-1',
      'Nurse Joy',
      tenantDb,
    );
  });

  it('executes pediatric dose-review acknowledgment as a persisted HIV action', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO hiv_adherence_tracking')) {
          return [{ id: 'adh-peds-1', tracking_date: '2026-03-05' }];
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
        itemId: 'hiv-regimen:req-3',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-3',
        patientId: 'patient-hiv-3',
        enrollmentId: 'enroll-hiv-3',
        actionId: 'pediatric-dose-check',
        actionType: 'dose_review',
        actionTitle: 'Confirm pediatric weight-band dosing',
        actionPayload: {
          age: 12,
          requested_regimen_code: 'ABC/3TC/DTG',
        },
      },
      { sessionId: 'session-2' },
    );

    expect(result.result).toEqual(
      expect.objectContaining({
        operation: 'pediatric_dose_review_acknowledged',
        adherenceTrackingId: 'adh-peds-1',
        age: 12,
        regimenCode: 'ABC/3TC/DTG',
      }),
    );
    expect(mocks.hivService.logAuditAction).toHaveBeenCalledWith(
      'pediatric_dose_review_acknowledged',
      expect.any(String),
      'enroll-hiv-3',
      null,
      expect.objectContaining({
        actionId: 'pediatric-dose-check',
        age: 12,
      }),
      'user-1',
      'Nurse Joy',
      tenantDb,
    );
  });

  it('returns idempotent success when a recommendation action is already completed', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [
            {
              context: {
                action_executions: {
                  'eac-followup': {
                    status: 'completed',
                    result: {
                      status: 'completed',
                      operation: 'eac_session_created',
                      sessionId: 'eac-existing',
                    },
                  },
                },
              },
            },
          ];
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
      },
      { sessionId: 'session-idem-1' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        idempotent: true,
        actionId: 'eac-followup',
        result: expect.objectContaining({
          operation: 'eac_session_created',
          sessionId: 'eac-existing',
        }),
      }),
    );
    expect(mocks.hivService.createEacSession).not.toHaveBeenCalled();
    expect(mocks.hipaaAuditService.logAuditEvent).not.toHaveBeenCalled();
    expect(tenantDb.query).toHaveBeenCalledTimes(1);
  });

  it('prepares visit recording with a nurse intake draft payload', async () => {
    const { service, mocks } = makeService();
    mocks.hivService.saveNurseIntake.mockResolvedValue({
      id: 'intake-1',
      patient_id: 'patient-hiv-2',
    });

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM hiv_care_enrollments')) {
          return [{ patient_id: 'patient-hiv-2' }];
        }
        if (sql.includes('FROM hiv_arv_change_requests') && sql.includes('WHERE id = $1')) {
          return [
            {
              id: 'req-1',
              visit_recorded: false,
              requested_regimen_code: 'AZT/3TC/ATV/r',
              requested_regimen_name: 'AZT/3TC/ATV/r',
            },
          ];
        }
        if (sql.includes('UPDATE hiv_arv_change_requests')) {
          return [
            {
              id: 'req-1',
              enrollment_id: 'enroll-hiv-2',
              status: 'approved',
              visit_recorded: false,
              requested_regimen_code: 'AZT/3TC/ATV/r',
              requested_regimen_name: 'AZT/3TC/ATV/r',
            },
          ];
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
        itemId: 'hiv-regimen:req-1',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-1',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'visit-recording',
        actionType: 'visit_preparation',
        actionTitle: 'Prepare next HIV clinical visit recording',
      },
      { sessionId: 'session-visit-1' },
    );

    expect(mocks.hivService.saveNurseIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-hiv-2',
        regimen: 'AZT/3TC/ATV/r',
        form: expect.objectContaining({
          source: 'nurse_cross_module_queue',
          prepStatus: 'ready_for_clinical_visit_recording',
          regimenRequestId: 'req-1',
        }),
      }),
      tenantDb,
      'user-1',
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        operation: 'visit_preparation_completed',
        intakeDraftId: 'intake-1',
      }),
    );
  });

  it('executes regimen safety warning review and writes regimen-change alert context', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('UPDATE hiv_arv_change_requests')) {
          return [
            {
              id: 'req-1',
              enrollment_id: 'enroll-hiv-2',
              status: 'approved',
              visit_recorded: false,
              requested_regimen_code: 'AZT/3TC/ATV/r',
              requested_regimen_name: 'AZT/3TC/ATV/r',
            },
          ];
        }
        if (sql.includes('FROM hiv_clinical_alerts')) {
          return [];
        }
        if (sql.includes('INSERT INTO hiv_clinical_alerts')) {
          return [{ id: 'alert-1', alert_type: 'regimen_change_needed', severity: 'high', is_resolved: false }];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('INSERT INTO hiv_audit_log')) {
          return [];
        }
        if (sql.includes('FROM hiv_care_enrollments') && params?.[0] === 'enroll-hiv-2') {
          return [{ patient_id: 'patient-hiv-2' }];
        }
        return [];
      }),
    } as any;

    const result = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-regimen:req-1',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-1',
        patientId: 'patient-hiv-2',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'regimen-safety-warnings',
        actionType: 'safety_review',
        actionTitle: 'Review regimen safety warnings with clinician plan',
        actionPayload: {
          warnings: [
            {
              message: 'Review pregnancy safety before switch.',
              recommendedAction: 'Confirm PMTCT plan and regimen appropriateness.',
            },
          ],
        },
      },
      { sessionId: 'session-safety-1' },
    );

    expect(result.result).toEqual(
      expect.objectContaining({
        operation: 'regimen_safety_warning_reviewed',
        requestId: 'req-1',
        warningCount: 1,
        alertId: 'alert-1',
      }),
    );
    expect(mocks.hivService.logAuditAction).toHaveBeenCalledWith(
      'regimen_safety_warning_reviewed',
      expect.any(String),
      'enroll-hiv-2',
      null,
      expect.objectContaining({
        requestId: 'req-1',
        warningCount: 1,
      }),
      'user-1',
      'Nurse Joy',
      tenantDb,
    );
  });

  it('executes TB interaction and doctor switch review actions as direct queue operations', async () => {
    const { service, mocks } = makeService();
    mocks.hivService.createReferral.mockResolvedValue({
      id: 'ref-t-1',
      referral_status: 'pending',
    });

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM hiv_referrals')) {
          const referralType = params?.[1];
          if (referralType === 'H') {
            return [{ id: 'ref-h-existing', referral_status: 'in_progress', referral_type: 'H' }];
          }
          return [];
        }
        if (sql.includes('FROM hiv_clinical_alerts')) {
          const alertType = params?.[1];
          if (alertType === 'treatment_failure') {
            return [{ id: 'alert-existing' }];
          }
          return [];
        }
        if (sql.includes('INSERT INTO hiv_clinical_alerts')) {
          return [{ id: 'alert-new', alert_type: 'regimen_change_needed', severity: 'high', is_resolved: false }];
        }
        if (sql.includes('UPDATE hiv_clinical_alerts')) {
          return [{ id: 'alert-existing', alert_type: 'treatment_failure', severity: 'critical', is_resolved: false }];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('INSERT INTO hiv_audit_log')) {
          return [];
        }
        return [];
      }),
    } as any;

    const tbResult = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-regimen:req-2',
        itemType: 'hiv_regimen_change',
        sourceRecordId: 'req-2',
        patientId: 'patient-hiv-2',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'tb-interaction-review',
        actionType: 'interaction_review',
        actionTitle: 'Check TB co-treatment interaction plan',
        actionPayload: {
          tb_medications: ['Rifampicin'],
        },
      },
      { sessionId: 'session-tb-1' },
    );

    expect(tbResult.result).toEqual(
      expect.objectContaining({
        operation: 'tb_interaction_referral_created',
        referralId: 'ref-t-1',
        alertId: 'alert-new',
      }),
    );
    expect(mocks.hivService.createReferral).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: 'enroll-hiv-2',
        referralType: 'T',
        referralPriority: 'high',
      }),
      tenantDb,
    );

    const doctorResult = await service.executeHivRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'hiv-pathway:enroll-hiv-2:failure_after_eac:2026-03-03',
        itemType: 'hiv_vl_followup',
        sourceRecordId: 'enroll-hiv-2',
        patientId: 'patient-hiv-2',
        enrollmentId: 'enroll-hiv-2',
        actionId: 'doctor-switch-review',
        actionType: 'escalation',
        actionTitle: 'Escalate for regimen switch review',
      },
      { sessionId: 'session-doc-1' },
    );

    expect(doctorResult.result).toEqual(
      expect.objectContaining({
        operation: 'doctor_switch_referral_reused',
        referralId: 'ref-h-existing',
        alertId: 'alert-existing',
        alertReused: true,
      }),
    );
    expect(mocks.hivService.createReferral).toHaveBeenCalledTimes(1);
    expect(mocks.hivService.logAuditAction).toHaveBeenCalledWith(
      'tb_interaction_review_escalated',
      expect.any(String),
      'enroll-hiv-2',
      null,
      expect.objectContaining({
        referralId: 'ref-t-1',
      }),
      'user-1',
      'Nurse Joy',
      tenantDb,
    );
    expect(mocks.hivService.logAuditAction).toHaveBeenCalledWith(
      'doctor_switch_review_escalated',
      expect.any(String),
      'enroll-hiv-2',
      null,
      expect.objectContaining({
        referralId: 'ref-h-existing',
      }),
      'user-1',
      'Nurse Joy',
      tenantDb,
    );
  });

  it('executes oncology recommendation bundle actions and persists queue execution state', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM oncology_infusion_sessions ois') && params?.[0] === 'inf-1') {
          return [
            {
              id: 'inf-1',
              notes: null,
              status: 'scheduled',
              payment_status: 'payment_confirmed',
              session_date: '2026-03-05T09:00:00.000Z',
              cycle_number: 2,
              regimen_id: 'reg-1',
              regimen_name: 'Paclitaxel + Carboplatin',
              case_id: 'onco-case-1',
              patient_id: 'patient-onc-1',
            },
          ];
        }
        if (sql.includes('UPDATE oncology_infusion_sessions')) {
          return [
            {
              id: 'inf-1',
              status: 'scheduled',
              payment_status: 'payment_confirmed',
              session_date: '2026-03-05T09:00:00.000Z',
              regimen_id: 'reg-1',
            },
          ];
        }
        if (sql.includes('FROM oncology_adverse_events oae') && params?.[0] === 'ae-1') {
          return [
            {
              id: 'ae-1',
              case_id: 'onco-case-1',
              regimen_id: 'reg-1',
              event_type: 'Neutropenia',
              grade: '3',
              notes: null,
              action_taken: null,
              outcome: null,
              patient_id: 'patient-onc-1',
            },
          ];
        }
        if (sql.includes('UPDATE oncology_adverse_events')) {
          return [
            {
              id: 'ae-1',
              case_id: 'onco-case-1',
              regimen_id: 'reg-1',
              event_type: 'Neutropenia',
              grade: '3',
              outcome: 'pending_oncologist_review',
            },
          ];
        }
        if (sql.includes('SELECT id, patient_id, care_plan') && sql.includes('FROM oncology_cases')) {
          return [{ id: 'onco-case-1', patient_id: 'patient-onc-1', care_plan: null }];
        }
        if (sql.includes('UPDATE oncology_cases')) {
          return [
            {
              id: 'onco-case-1',
              patient_id: 'patient-onc-1',
              care_plan: 'Updated from queue',
              status: 'active',
            },
          ];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const infusionResult = await service.executeOncologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'oncology-infusion:inf-1',
        itemType: 'oncology_infusion_followup',
        sourceRecordId: 'inf-1',
        patientId: 'patient-onc-1',
        caseId: 'onco-case-1',
        actionId: 'prepare-infusion-checklist',
        actionType: 'visit_preparation',
        actionTitle: 'Prepare infusion checklist',
      },
      { sessionId: 'session-onc-1' },
    );

    expect(infusionResult.result).toEqual(
      expect.objectContaining({
        operation: 'infusion_checklist_documented',
        sessionId: 'inf-1',
        caseId: 'onco-case-1',
      }),
    );

    const toxicityResult = await service.executeOncologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'oncology-toxicity:ae-1',
        itemType: 'oncology_toxicity_followup',
        sourceRecordId: 'ae-1',
        patientId: 'patient-onc-1',
        caseId: 'onco-case-1',
        actionId: 'acknowledge-toxicity-followup',
        actionType: 'safety_review',
        actionTitle: 'Document toxicity follow-up action',
        actionPayload: {
          adverse_event_id: 'ae-1',
        },
      },
      { sessionId: 'session-onc-2' },
    );

    expect(toxicityResult.result).toEqual(
      expect.objectContaining({
        operation: 'toxicity_followup_documented',
        adverseEventId: 'ae-1',
        caseId: 'onco-case-1',
      }),
    );

    const escalateResult = await service.executeOncologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'oncology-toxicity:ae-1',
        itemType: 'oncology_toxicity_followup',
        sourceRecordId: 'ae-1',
        patientId: 'patient-onc-1',
        caseId: 'onco-case-1',
        actionId: 'escalate-oncology-doctor-review',
        actionType: 'escalation',
        actionTitle: 'Sync toxicity escalation with oncologist',
      },
      { sessionId: 'session-onc-3' },
    );

    expect(escalateResult.result).toEqual(
      expect.objectContaining({
        operation: 'oncology_doctor_sync_documented',
        caseId: 'onco-case-1',
      }),
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'oncology-infusion:inf-1',
        'oncology',
        'oncology_infusion_followup',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'oncology-toxicity:ae-1',
        metadata: expect.objectContaining({
          module: 'oncology',
          actionId: 'escalate-oncology-doctor-review',
        }),
      }),
    );
  });

  it('computes nurse outcome analytics for queue execution and maternity SLA aging', async () => {
    const { service } = makeService();
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state') && sql.includes('created_at >= $1::date')) {
          return [
            {
              workflow_key: 'hiv-pathway:1',
              module: 'hiv',
              status: 'pending',
              created_at: hoursAgo(30),
              updated_at: hoursAgo(26),
              context: {
                action_executions: {
                  'eac-followup': {
                    status: 'completed',
                    result: { operation: 'eac_session_reused' },
                  },
                },
              },
            },
            {
              workflow_key: 'hiv-regimen:1',
              module: 'hiv',
              status: 'acknowledged',
              created_at: hoursAgo(8),
              updated_at: hoursAgo(5),
              context: {
                action_executions: {
                  'visit-recording': {
                    status: 'completed',
                    result: { operation: 'visit_preparation_completed', intakeDraftId: 'intake-1' },
                  },
                },
              },
            },
            {
              workflow_key: 'maternity:1',
              module: 'maternity',
              status: 'completed',
              created_at: hoursAgo(3),
              updated_at: hoursAgo(2),
              context: {
                action_executions: {
                  'tb-interaction-review': {
                    status: 'completed',
                    result: { operation: 'tb_interaction_referral_created' },
                  },
                },
              },
            },
          ];
        }

        if (sql.includes('FROM maternity_care_tasks') && sql.includes("status <> 'closed'")) {
          return [
            {
              id: 'mat-1',
              status: 'open',
              priority: 'critical',
              created_at: hoursAgo(3),
              last_event_at: hoursAgo(3),
            },
            {
              id: 'mat-2',
              status: 'acknowledged',
              priority: 'high',
              created_at: hoursAgo(7),
              last_event_at: hoursAgo(7),
            },
            {
              id: 'mat-3',
              status: 'actioned',
              priority: 'medium',
              created_at: hoursAgo(2),
              last_event_at: hoursAgo(2),
            },
          ];
        }

        return [];
      }),
    } as any;

    const analytics = await service.getOutcomeAnalytics(tenantDb, { days: 14 });

    expect(analytics.window).toEqual(
      expect.objectContaining({
        days: 14,
      }),
    );
    expect(analytics.crossModuleQueue).toEqual(
      expect.objectContaining({
        totalItems: 3,
        activeItems: 2,
        completedItems: 1,
        pendingOlderThan24h: 1,
        byStatus: expect.objectContaining({
          pending: 1,
          acknowledged: 1,
          completed: 1,
        }),
        byModule: expect.objectContaining({
          hiv: 2,
          maternity: 1,
        }),
      }),
    );
    expect(analytics.hivRecommendationExecution).toEqual(
      expect.objectContaining({
        executedActionsTotal: 3,
        reusedOrIdempotentTotal: 1,
        visitPrepDraftsCreated: 1,
        executedByAction: expect.objectContaining({
          'eac-followup': 1,
          'visit-recording': 1,
          'tb-interaction-review': 1,
        }),
      }),
    );
    expect(analytics.maternityEscalationSla).toEqual(
      expect.objectContaining({
        unresolvedTasks: 3,
        criticalUnresolved: 1,
        dueSoon: 1,
        breached: 1,
      }),
    );
  });

  it('computes doctor outcome analytics for doctor-routed queue execution', async () => {
    const { service } = makeService();
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state') && sql.includes('destination_role')) {
          return [
            {
              workflow_key: 'hiv-pathway:dr-1',
              module: 'hiv',
              status: 'pending',
              destination_role: 'doctor',
              created_at: hoursAgo(32),
              updated_at: hoursAgo(29),
              context: {
                action_executions: {
                  'repeat-vl-plan': {
                    status: 'completed',
                    result: { operation: 'hiv_referral_created' },
                  },
                },
              },
            },
            {
              workflow_key: 'oncology-toxicity:dr-1',
              module: 'oncology',
              status: 'acknowledged',
              destination_role: 'doctor',
              created_at: hoursAgo(10),
              updated_at: hoursAgo(8),
              context: {
                action_executions: {
                  'escalate-oncology-doctor-review': {
                    status: 'completed',
                    result: { operation: 'oncology_doctor_sync_documented' },
                  },
                },
              },
            },
            {
              workflow_key: 'maternity:dr-1',
              module: 'maternity',
              status: 'completed',
              destination_role: 'nurse',
              created_at: hoursAgo(5),
              updated_at: hoursAgo(4),
              context: {
                action_executions: {
                  'prepare-visit-checklist': {
                    status: 'completed',
                    result: { operation: 'already_applied' },
                  },
                },
              },
            },
          ];
        }

        return [];
      }),
    } as any;

    const analytics = await service.getDoctorOutcomeAnalytics(tenantDb, { days: 21 });

    expect(analytics.window).toEqual(
      expect.objectContaining({
        days: 21,
      }),
    );
    expect(analytics.doctorQueue).toEqual(
      expect.objectContaining({
        totalItems: 3,
        pendingItems: 1,
        acknowledgedItems: 1,
        completedItems: 1,
        pendingOlderThan24h: 1,
        byModule: expect.objectContaining({
          hiv: 1,
          oncology: 1,
          maternity: 1,
        }),
        moduleDrilldown: expect.arrayContaining([
          expect.objectContaining({ module: 'hiv', totalItems: 1, pendingItems: 1, executedActionsTotal: 1 }),
          expect.objectContaining({ module: 'oncology', totalItems: 1, acknowledgedItems: 1, executedActionsTotal: 1 }),
          expect.objectContaining({ module: 'maternity', totalItems: 1, completedItems: 1, executedActionsTotal: 1 }),
        ]),
      }),
    );
    expect(analytics.recommendationExecution).toEqual(
      expect.objectContaining({
        executedActionsTotal: 3,
        reusedOrIdempotentTotal: 1,
        executedByAction: expect.objectContaining({
          'repeat-vl-plan': 1,
          'escalate-oncology-doctor-review': 1,
          'prepare-visit-checklist': 1,
        }),
        executedByModule: expect.objectContaining({
          hiv: 1,
          oncology: 1,
          maternity: 1,
        }),
        topActions: expect.arrayContaining([
          expect.objectContaining({ actionId: 'repeat-vl-plan', count: 1 }),
        ]),
      }),
    );
  });

  it('returns zero-safe doctor outcome analytics when workflow table is unavailable', async () => {
    const { service } = makeService();
    const missingTableError: any = new Error('relation does not exist');
    missingTableError.code = '42P01';

    const tenantDb = {
      query: jest.fn(async () => {
        throw missingTableError;
      }),
    } as any;

    const analytics = await service.getDoctorOutcomeAnalytics(tenantDb, { days: 999 });

    expect(analytics.window.days).toBe(365);
    expect(analytics.doctorQueue.totalItems).toBe(0);
    expect(analytics.recommendationExecution.executedActionsTotal).toBe(0);
  });

  it('applies module/status/case/date filters in doctor outcome analytics', async () => {
    const { service } = makeService();
    const tenantDb = {
      query: jest.fn(async () => []),
    } as any;

    await service.getDoctorOutcomeAnalytics(tenantDb, {
      days: 30,
      module: 'oncology',
      status: 'pending',
      caseId: 'case-xyz',
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    });

    const [sql, params] = tenantDb.query.mock.calls[0];
    expect(String(sql)).toContain('LOWER(COALESCE(module, \'\')) =');
    expect(String(sql)).toContain('LOWER(COALESCE(status, \'\')) =');
    expect(String(sql)).toContain('source_record_id =');
    expect(params).toEqual(expect.arrayContaining(['2026-02-01', '2026-02-28', 'oncology', 'pending', 'case-xyz']));
  });

  it('returns zero-safe nurse outcome analytics when workflow tables are unavailable', async () => {
    const { service } = makeService();
    const missingTableError: any = new Error('relation does not exist');
    missingTableError.code = '42P01';

    const tenantDb = {
      query: jest.fn(async () => {
        throw missingTableError;
      }),
    } as any;

    const analytics = await service.getOutcomeAnalytics(tenantDb, { days: 400 });

    expect(analytics.window.days).toBe(365);
    expect(analytics.crossModuleQueue.totalItems).toBe(0);
    expect(analytics.hivRecommendationExecution.executedActionsTotal).toBe(0);
    expect(analytics.maternityEscalationSla.unresolvedTasks).toBe(0);
  });
});
