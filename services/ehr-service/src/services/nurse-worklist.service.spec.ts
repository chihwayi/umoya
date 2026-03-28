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

  it('builds a doctor synchronization feed from doctor-routed coordination items', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getCrossModuleEscalationFeed').mockResolvedValue({
      items: [
        {
          id: 'handoff:patient-1:draft',
          module: 'nursing',
          item_type: 'nurse_handoff_risk',
          severity: 'high',
          workflow_status: 'pending',
          doctor_sync_status: 'nurse_handoff_pending',
          destination_role: 'nurse',
        },
        {
          id: 'lab-critical-alert:alert-1',
          module: 'lab',
          item_type: 'lab_critical_alert_followup',
          severity: 'critical',
          workflow_status: 'pending',
          doctor_sync_status: 'doctor_review_recommended',
          destination_role: 'doctor',
        },
        {
          id: 'medication:mar-1',
          module: 'nursing',
          item_type: 'medication_administration_followup',
          severity: 'high',
          workflow_status: 'acknowledged',
          doctor_sync_status: 'doctor_review_recommended',
          destination_role: 'doctor',
        },
        {
          id: 'pharmacy:rx-1',
          module: 'pharmacy',
          item_type: 'pharmacy_protocol_followup',
          severity: 'medium',
          workflow_status: 'pending',
          doctor_sync_status: 'nurse_followup_required',
          destination_role: 'nurse',
        },
      ],
      summary: {},
    } as any);

    const result = await service.getDoctorSynchronizationFeed({} as any);

    expect(result.summary.total).toBe(2);
    expect(result.summary.handoff).toBe(1);
    expect(result.summary.critical_results).toBe(1);
    expect(result.summary.acknowledged).toBe(0);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'handoff:patient-1:draft',
          coordination_focus: 'handoff',
        }),
        expect.objectContaining({
          id: 'lab-critical-alert:alert-1',
          coordination_focus: 'critical_results',
        }),
      ]),
    );
  });

  it('supports doctor synchronization focus filters and acknowledged inclusion', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getCrossModuleEscalationFeed').mockResolvedValue({
      items: [
        {
          id: 'ed:visit-1',
          module: 'ed',
          item_type: 'ed_protocol_followup',
          severity: 'critical',
          workflow_status: 'pending',
          doctor_sync_status: 'doctor_review_recommended',
          destination_role: 'doctor',
        },
        {
          id: 'medication:mar-1',
          module: 'nursing',
          item_type: 'medication_administration_followup',
          severity: 'high',
          workflow_status: 'acknowledged',
          doctor_sync_status: 'doctor_review_recommended',
          destination_role: 'doctor',
        },
      ],
      summary: {},
    } as any);

    const triageOnly = await service.getDoctorSynchronizationFeed({} as any, { focus: 'triage' });
    expect(triageOnly.items).toHaveLength(1);
    expect(triageOnly.items[0].id).toBe('ed:visit-1');

    const withAcknowledged = await service.getDoctorSynchronizationFeed({} as any, {
      focus: 'orders',
      includeAcknowledged: true,
    });
    expect(withAcknowledged.items).toHaveLength(1);
    expect(withAcknowledged.items[0].id).toBe('medication:mar-1');
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

  it('builds a clinical escalation feed with summary counts', async () => {
    const { service } = makeService();
    const tenantDb = {
      query: jest.fn().mockResolvedValue([
        {
          id: 'esc-1',
          patient_id: 'patient-1',
          early_warning_score_id: 'ews-1',
          nurse_task_id: 'task-1',
          source_module: 'early_warning',
          source_reference_id: 'vitals-1',
          escalation_type: 'deterioration_review',
          severity: 'critical',
          status: 'open',
          title: 'NEWS2 escalation',
          summary: 'Immediate review required',
          recommended_action: 'Repeat vitals',
          due_at: new Date().toISOString(),
          acknowledged_at: null,
          completed_at: null,
          evidence: {},
          metadata: {},
          first_name: 'Jane',
          last_name: 'Doe',
          patient_number: 'P001',
          early_warning_total_score: 8,
          early_warning_risk_level: 'high',
          remote_monitoring_alert_id: 'rma-1',
          remote_monitoring_alert_type: 'early_warning_deterioration',
          remote_monitoring_severity: 'critical',
        },
      ]),
    } as any;

    const result = await service.getClinicalEscalationFeed(tenantDb, { includeCompleted: false });

    expect(result.summary).toEqual({
      total: 1,
      critical: 1,
      open: 1,
      acknowledged: 0,
      highRiskEarlyWarning: 1,
      remoteMonitoringLinked: 1,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'esc-1',
        patientName: 'Jane Doe',
        earlyWarning: expect.objectContaining({ totalScore: 8, riskLevel: 'high' }),
        remoteMonitoring: expect.objectContaining({ alertId: 'rma-1' }),
      }),
    );
  });

  it('acknowledges a clinical escalation and updates linked records', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 'esc-1', patient_id: 'patient-1', early_warning_score_id: 'ews-1', nurse_task_id: 'task-1' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as any;

    const result = await service.acknowledgeClinicalEscalation(tenantDb, user, 'esc-1', {
      ipAddress: '127.0.0.1',
    });

    expect(result).toEqual({ ok: true, escalationTaskId: 'esc-1' });
    expect(tenantDb.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE clinical_escalation_tasks'),
      ['esc-1', 'user-1'],
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_ALERT_ACKNOWLEDGE,
        resourceId: 'esc-1',
        patientId: 'patient-1',
      }),
    );
  });

  it('completes a clinical escalation and resolves linked work items', async () => {
    const { service, mocks } = makeService();
    const tenantDb = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 'esc-1', patient_id: 'patient-1', nurse_task_id: 'task-1' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as any;

    const result = await service.completeClinicalEscalation(
      tenantDb,
      user,
      'esc-1',
      { note: 'Patient reassessed and stabilized' },
      { ipAddress: '127.0.0.1' },
    );

    expect(result).toEqual({ ok: true, escalationTaskId: 'esc-1' });
    expect(tenantDb.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE clinical_escalation_tasks'),
      ['esc-1', 'user-1', 'Patient reassessed and stabilized'],
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_TASK_COMPLETE,
        resourceId: 'esc-1',
        patientId: 'patient-1',
      }),
    );
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
      cardiology: 0,
      ophthalmology: 0,
      ed: 0,
      sepsis: 0,
      blood_bank: 0,
      telemedicine: 0,
      lab: 0,
      imaging: 0,
      pharmacy: 0,
      accounts: 0,
      specialty: 0,
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

  it('surfaces workflow-only specialty modules from shared workflow state', async () => {
    const { service } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [
            {
              workflow_key: 'cardiology-sync:case-1',
              module: 'cardiology',
              item_type: 'cardiology_protocol_followup',
              source_record_id: 'card-case-1',
              patient_id: 'patient-card-1',
              enrollment_id: null,
              status: 'pending',
              destination_role: 'doctor',
              destination_service: 'cardiology',
              destination_specialty: 'Cardiology',
              destination_user_id: 'doctor-card-1',
              destination_user_name: 'Dr. Heart',
              destination_facility_id: null,
              destination_facility_name: null,
              acknowledged_at: null,
              completed_at: null,
              created_at: '2026-03-03T08:00:00.000Z',
              updated_at: '2026-03-04T08:00:00.000Z',
              note: 'Pending echo protocol review',
              context: {
                title: 'Cardiology protocol checkpoint pending',
                summary: 'Pre-procedure cardiac review has not been completed.',
                recommended_action: 'Complete cardiology doctor checkpoint and update workflow.',
                module_status: 'checkpoint_pending',
                doctor_sync_status: 'doctor_review_recommended',
                patient_name: 'Cardio Patient',
                patient_number: 'P-901',
              },
              acknowledged_by_name: null,
              completed_by_name: null,
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);

    expect(result.summary).toEqual(
      expect.objectContaining({
        total: 1,
        cardiology: 1,
        specialty: 1,
      }),
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cardiology-sync:case-1',
          module: 'cardiology',
          item_type: 'cardiology_protocol_followup',
          doctor_sync_status: 'doctor_review_recommended',
          destination_service: 'cardiology',
          workflow_status: 'pending',
          title: 'Cardiology protocol checkpoint pending',
        }),
      ]),
    );
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

  it('builds cardiology protocol items with executable recommendation bundles', async () => {
    const { service } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes("FROM users") && sql.includes("WHERE is_active = true")) {
          return [
            { id: 'doctor-card-1', role: 'doctor', specialization: 'Cardiology', name: 'Dr. Heart' },
            { id: 'nurse-card-1', role: 'nurse', specialization: 'Cardiology', name: 'Nurse Pulse' },
          ];
        }
        if (sql.includes('FROM referral_facilities')) {
          return [];
        }
        if (sql.includes('FROM cardiology_encounters ce')) {
          return [
            {
              cardiology_encounter_id: 'card-enc-1',
              patient_id: 'patient-card-1',
              encounter_date: '2026-03-04T08:00:00.000Z',
              encounter_type: 'follow_up',
              visit_reason: 'Chest pain',
              risk_score: 'high',
              care_status: 'in_progress',
              payment_status: 'payment_confirmed',
              follow_up_plan: null,
              care_plan: null,
              diagnostic_tests: [],
              patient_name: 'Cardio Patient',
              patient_number: 'P-901',
              cardiologist_name: 'Dr. Heart',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);
    const cardiologyItem = result.items.find((item: any) => item.module === 'cardiology');

    expect(result.summary).toEqual(
      expect.objectContaining({
        cardiology: 1,
        specialty: 1,
      }),
    );
    expect(cardiologyItem).toEqual(
      expect.objectContaining({
        id: 'cardiology-encounter:card-enc-1',
        item_type: 'cardiology_protocol_followup',
        severity: 'high',
      }),
    );
    expect(cardiologyItem?.metadata?.recommendation_bundle).toEqual(
      expect.objectContaining({
        bundle_label: 'Cardiology protocol execution bundle',
        actionable_count: 3,
      }),
    );
    expect(cardiologyItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'prepare-cardiology-order-set', type: 'order_set' }),
        expect.objectContaining({ id: 'complete-cardiology-visit-prep', type: 'visit_preparation' }),
        expect.objectContaining({ id: 'escalate-cardiology-doctor-sync', type: 'escalation' }),
      ]),
    );
  });

  it('executes cardiology recommendation actions and persists queue execution state', async () => {
    const { service, mocks } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM cardiology_encounters') && sql.includes('WHERE id = $1')) {
          return [
            {
              id: 'card-enc-1',
              patient_id: 'patient-card-1',
              encounter_date: '2026-03-04T08:00:00.000Z',
              encounter_type: 'follow_up',
              visit_reason: 'Chest pain',
              risk_score: 'high',
              care_status: 'in_progress',
              payment_status: 'payment_confirmed',
              diagnostic_tests: [],
              care_plan: null,
              follow_up_plan: null,
            },
          ];
        }
        if (sql.includes('UPDATE cardiology_encounters') && sql.includes('diagnostic_tests')) {
          return [
            {
              id: 'card-enc-1',
              patient_id: 'patient-card-1',
              diagnostic_tests: [
                { name: 'ECG', source: 'nurse_cross_module_queue' },
                { name: 'Troponin', source: 'nurse_cross_module_queue' },
              ],
            },
          ];
        }
        if (sql.includes('UPDATE cardiology_encounters') && sql.includes('follow_up_plan')) {
          return [
            {
              id: 'card-enc-1',
              patient_id: 'patient-card-1',
              follow_up_plan: 'Cardiology visit prep completed',
            },
          ];
        }
        if (sql.includes('UPDATE cardiology_encounters') && sql.includes('care_plan')) {
          return [
            {
              id: 'card-enc-1',
              patient_id: 'patient-card-1',
              care_plan: 'Cardiology doctor sync documented',
            },
          ];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const orderSetResult = await service.executeCardiologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'cardiology-encounter:card-enc-1',
        itemType: 'cardiology_protocol_followup',
        sourceRecordId: 'card-enc-1',
        patientId: 'patient-card-1',
        encounterId: 'card-enc-1',
        actionId: 'prepare-cardiology-order-set',
        actionType: 'order_set',
        actionTitle: 'Prepare cardiology diagnostic order set',
        actionPayload: {
          suggested_tests: ['ECG', 'Troponin'],
        },
      },
      { sessionId: 'session-card-1' },
    );
    expect(orderSetResult.result).toEqual(
      expect.objectContaining({
        operation: 'cardiology_order_set_prepared',
        encounterId: 'card-enc-1',
      }),
    );

    const prepResult = await service.executeCardiologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'cardiology-encounter:card-enc-1',
        itemType: 'cardiology_protocol_followup',
        sourceRecordId: 'card-enc-1',
        patientId: 'patient-card-1',
        encounterId: 'card-enc-1',
        actionId: 'complete-cardiology-visit-prep',
        actionType: 'visit_preparation',
        actionTitle: 'Complete cardiology visit-prep checkpoint',
      },
      { sessionId: 'session-card-2' },
    );
    expect(prepResult.result).toEqual(
      expect.objectContaining({
        operation: 'cardiology_visit_prep_completed',
        encounterId: 'card-enc-1',
      }),
    );

    const escalateResult = await service.executeCardiologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'cardiology-encounter:card-enc-1',
        itemType: 'cardiology_protocol_followup',
        sourceRecordId: 'card-enc-1',
        patientId: 'patient-card-1',
        encounterId: 'card-enc-1',
        actionId: 'escalate-cardiology-doctor-sync',
        actionType: 'escalation',
        actionTitle: 'Escalate cardiology findings to doctor sync',
      },
      { sessionId: 'session-card-3' },
    );
    expect(escalateResult.result).toEqual(
      expect.objectContaining({
        operation: 'cardiology_doctor_sync_documented',
        encounterId: 'card-enc-1',
      }),
    );

    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'cardiology-encounter:card-enc-1',
        'cardiology',
        'cardiology_protocol_followup',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'cardiology-encounter:card-enc-1',
        metadata: expect.objectContaining({
          module: 'cardiology',
          actionId: 'escalate-cardiology-doctor-sync',
        }),
      }),
    );
  });

  it('builds ophthalmology, telemedicine, lab, imaging, and pharmacy protocol items with executable bundles', async () => {
    const { service } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM users') && sql.includes('WHERE is_active = true')) {
          return [
            { id: 'doctor-spec-1', role: 'doctor', specialization: 'Specialty', name: 'Dr. Specialist' },
            { id: 'nurse-spec-1', role: 'nurse', specialization: 'Specialty', name: 'Nurse Specialist' },
            { id: 'pharm-spec-1', role: 'pharmacist', specialization: 'Pharmacy', name: 'Pharm Specialist' },
          ];
        }
        if (sql.includes('FROM referral_facilities')) {
          return [];
        }
        if (sql.includes('FROM ophthalmology_encounters oe')) {
          return [
            {
              ophthalmology_encounter_id: 'oph-enc-1',
              patient_id: 'patient-oph-1',
              encounter_date: '2026-03-04T08:00:00.000Z',
              encounter_type: 'follow_up',
              chief_complaint: 'Sudden vision loss',
              assessment: null,
              plan: null,
              payment_status: 'payment_confirmed',
              finance_transaction_id: null,
              patient_name: 'Oph Patient',
              patient_number: 'P-OPH-1',
              ophthalmologist_name: 'Dr. Eye',
            },
          ];
        }
        if (sql.includes('FROM telemedicine_consultations tc')) {
          return [
            {
              consultation_id: 'tele-1',
              patient_id: 'patient-tele-1',
              doctor_id: 'doctor-tele-1',
              consultation_type: 'follow_up',
              status: 'technical_issue',
              scheduled_start_time: '2026-03-04T10:00:00.000Z',
              actual_start_time: null,
              patient_consent: false,
              consent_date: null,
              patient_joined: true,
              doctor_joined: false,
              technical_issues: 'Audio failure',
              notes: null,
              patient_name: 'Tele Patient',
              patient_number: 'P-TELE-1',
              doctor_name: 'Dr. Remote',
            },
          ];
        }
        if (sql.includes('FROM lab_critical_alerts lca')) {
          return [
            {
              alert_id: 'lab-alert-1',
              patient_id: 'patient-lab-1',
              lab_order_id: 'lab-order-1',
              component_name: 'Potassium',
              result_value: '6.8',
              critical_range: '5.5-7.0',
              severity: 'critical',
              alert_status: 'pending',
              alerted_to: 'doctor-lab-1',
              escalated_to: null,
              alerted_at: '2026-03-04T07:00:00.000Z',
              acknowledged_at: null,
              created_at: '2026-03-04T07:00:00.000Z',
              patient_name: 'Lab Patient',
              patient_number: 'P-LAB-1',
              alerted_to_name: 'Dr. Lab',
              escalated_to_name: null,
              age_hours: 2.3,
            },
          ];
        }
        if (sql.includes('FROM imaging_reports r') && sql.includes('imaging_report_acknowledgements ack')) {
          return [
            {
              imaging_report_id: 'img-report-1',
              imaging_order_id: 'img-order-1',
              imaging_study_id: 'img-study-1',
              patient_id: 'patient-img-1',
              report_status: 'final',
              is_critical: true,
              report_severity: 'critical',
              follow_up_recommended: true,
              follow_up_interval: '24h',
              recommendations: null,
              critical_findings: 'Immediate follow-up required',
              signed_at: '2026-03-04T08:30:00.000Z',
              report_created_at: '2026-03-04T08:00:00.000Z',
              report_updated_at: '2026-03-04T08:30:00.000Z',
              order_number: 'IMG-001',
              order_status: 'completed',
              payment_status: 'payment_confirmed',
              priority: 'urgent',
              ordering_provider: 'doctor-spec-1',
              study_name: 'CT Chest',
              body_part: 'Chest',
              modality_name: 'CT',
              modality_code: 'CT',
              patient_name: 'Imaging Patient',
              patient_number: 'P-IMG-1',
              ordering_provider_name: 'Dr. Specialist',
              acknowledgement_id: null,
              acknowledged_at: null,
            },
          ];
        }
        if (sql.includes('FROM prescriptions p')) {
          return [
            {
              prescription_id: 'rx-1',
              patient_id: 'patient-rx-1',
              doctor_id: 'doctor-rx-1',
              medication_name: 'Atorvastatin',
              dosage: '20mg',
              frequency: 'daily',
              quantity: 30,
              status: 'active',
              instructions: null,
              created_at: '2026-03-04T06:00:00.000Z',
              patient_name: 'Rx Patient',
              patient_number: 'P-RX-1',
              prescriber_name: 'Dr. Rx',
              stock_on_hand: 12,
              reorder_level: 20,
              inventory_match_count: 1,
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);
    const ophthalmologyItem = result.items.find((item: any) => item.module === 'ophthalmology');
    const telemedicineItem = result.items.find((item: any) => item.module === 'telemedicine');
    const labItem = result.items.find((item: any) => item.module === 'lab');
    const imagingItem = result.items.find((item: any) => item.module === 'imaging');
    const pharmacyItem = result.items.find((item: any) => item.module === 'pharmacy');

    expect(result.summary).toEqual(
      expect.objectContaining({
        ophthalmology: 1,
        telemedicine: 1,
        lab: 1,
        imaging: 1,
        pharmacy: 1,
        specialty: 5,
      }),
    );
    expect(ophthalmologyItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'prepare-ophthalmology-order-set' }),
        expect.objectContaining({ id: 'complete-ophthalmology-visit-prep' }),
        expect.objectContaining({ id: 'escalate-ophthalmology-doctor-sync' }),
      ]),
    );
    expect(telemedicineItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'confirm-telemedicine-consent' }),
        expect.objectContaining({ id: 'complete-telemedicine-visit-prep' }),
        expect.objectContaining({ id: 'escalate-telemedicine-doctor-sync' }),
      ]),
    );
    expect(labItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'acknowledge-critical-lab-alert' }),
        expect.objectContaining({ id: 'prepare-critical-lab-order-set' }),
        expect.objectContaining({ id: 'escalate-lab-doctor-sync' }),
      ]),
    );
    expect(imagingItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'acknowledge-radiology-report' }),
        expect.objectContaining({ id: 'prepare-radiology-followup-bundle' }),
        expect.objectContaining({ id: 'escalate-radiology-doctor-sync' }),
      ]),
    );
    expect(pharmacyItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'prepare-pharmacy-dispense-plan' }),
        expect.objectContaining({ id: 'complete-pharmacy-counseling-checkpoint' }),
        expect.objectContaining({ id: 'escalate-pharmacy-doctor-sync' }),
      ]),
    );
  });

  it('executes ophthalmology, telemedicine, lab, imaging, and pharmacy recommendation actions', async () => {
    const { service, mocks } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }

        if (sql.includes('FROM ophthalmology_encounters oe') && sql.includes('WHERE oe.id = $1')) {
          return [
            {
              id: 'oph-enc-1',
              patient_id: 'patient-oph-1',
              encounter_date: '2026-03-04T08:00:00.000Z',
              encounter_type: 'follow_up',
              chief_complaint: 'Sudden vision loss',
              assessment: null,
              plan: null,
              payment_status: 'payment_confirmed',
              finance_transaction_id: null,
            },
          ];
        }
        if (sql.includes('UPDATE ophthalmology_encounters') && sql.includes('SET assessment = $1')) {
          return [
            {
              id: 'oph-enc-1',
              patient_id: 'patient-oph-1',
              assessment: 'Order set prepared',
            },
          ];
        }

        if (sql.includes('FROM telemedicine_consultations tc') && sql.includes('WHERE tc.id = $1')) {
          return [
            {
              id: 'tele-1',
              patient_id: 'patient-tele-1',
              doctor_id: 'doctor-tele-1',
              consultation_type: 'follow_up',
              status: 'scheduled',
              scheduled_start_time: '2026-03-04T10:00:00.000Z',
              actual_start_time: null,
              patient_consent: false,
              consent_date: null,
              patient_joined: false,
              doctor_joined: false,
              technical_issues: null,
              notes: null,
            },
          ];
        }
        if (sql.includes('UPDATE telemedicine_consultations') && sql.includes('SET notes = $1, updated_at = NOW()')) {
          return [
            {
              id: 'tele-1',
              patient_id: 'patient-tele-1',
              notes: 'Consent checkpoint',
            },
          ];
        }
        if (sql.includes('UPDATE telemedicine_consultations') && sql.includes('SET') && sql.includes('patient_consent = true')) {
          return [];
        }

        if (sql.includes('FROM lab_critical_alerts lca') && sql.includes('WHERE lca.id = $1')) {
          return [
            {
              id: 'lab-alert-1',
              patient_id: 'patient-lab-1',
              lab_order_id: 'lab-order-1',
              component_name: 'Potassium',
              result_value: '6.8',
              critical_range: '5.5-7.0',
              severity: 'critical',
              alert_status: 'pending',
              alerted_to: 'doctor-lab-1',
              escalated_to: null,
              acknowledged_by: null,
              acknowledgment_notes: null,
              alerted_at: '2026-03-04T07:00:00.000Z',
              acknowledged_at: null,
              escalated_at: null,
            },
          ];
        }
        if (
          sql.includes('FROM imaging_reports r') &&
          sql.includes('INNER JOIN imaging_orders io ON io.id = r.imaging_order_id') &&
          sql.includes('WHERE r.id = $1')
        ) {
          return [
            {
              id: 'img-report-1',
              imaging_order_id: 'img-order-1',
              imaging_study_id: 'img-study-1',
              patient_id: 'patient-img-1',
              report_status: 'final',
              is_critical: true,
              severity: 'critical',
              follow_up_recommended: true,
              follow_up_interval: '24h',
              findings: 'Consolidation',
              impression: 'Probable pneumonia',
              recommendations: null,
              critical_findings: null,
              created_at: '2026-03-04T08:00:00.000Z',
              updated_at: '2026-03-04T08:30:00.000Z',
              signed_at: '2026-03-04T08:30:00.000Z',
              order_number: 'IMG-001',
              order_status: 'completed',
              payment_status: 'payment_confirmed',
              priority: 'urgent',
              ordering_provider: 'doctor-img-1',
              acknowledgement_id: null,
              acknowledged_at: null,
              acknowledgment_notes: null,
            },
          ];
        }
        if (sql.includes('UPDATE imaging_reports') && sql.includes('SET recommendations = $1, updated_at = NOW()')) {
          return [
            {
              id: 'img-report-1',
              imaging_order_id: 'img-order-1',
              imaging_study_id: 'img-study-1',
              patient_id: 'patient-img-1',
              report_status: 'final',
              is_critical: true,
              severity: 'critical',
              follow_up_recommended: true,
              follow_up_interval: '24h',
              recommendations: 'Follow-up bundle prepared',
              critical_findings: null,
              created_at: '2026-03-04T08:00:00.000Z',
              updated_at: '2026-03-04T09:00:00.000Z',
              signed_at: '2026-03-04T08:30:00.000Z',
            },
          ];
        }
        if (sql.includes('UPDATE lab_critical_alerts') && sql.includes('SET')) {
          return [
            {
              id: 'lab-alert-1',
              patient_id: 'patient-lab-1',
              lab_order_id: 'lab-order-1',
              alert_status: 'acknowledged',
              acknowledgment_notes: 'Lab alert acknowledged',
            },
          ];
        }
        if (sql.includes('FROM lab_orders') && sql.includes('WHERE id = $1')) {
          return [
            {
              id: 'lab-order-1',
              patient_id: 'patient-lab-1',
              status: 'ordered',
              tests: [],
              priority: 'urgent',
              payment_status: 'paid',
              workflow_events: [],
            },
          ];
        }
        if (sql.includes('UPDATE lab_orders') && sql.includes('SET workflow_events = $1::jsonb')) {
          return [
            {
              id: 'lab-order-1',
              patient_id: 'patient-lab-1',
              workflow_events: [{ marker: '[nurse_queue_action:acknowledge-critical-lab-alert]' }],
            },
          ];
        }

        if (sql.includes('FROM prescriptions p') && sql.includes('WHERE p.id = $1')) {
          return [
            {
              id: 'rx-1',
              patient_id: 'patient-rx-1',
              medication_name: 'Atorvastatin',
              dosage: '20mg',
              frequency: 'daily',
              quantity: 30,
              status: 'active',
              instructions: null,
              created_at: '2026-03-04T06:00:00.000Z',
              stock_on_hand: 12,
              reorder_level: 20,
              inventory_match_count: 1,
            },
          ];
        }
        if (sql.includes('UPDATE prescriptions') && sql.includes('SET instructions = $1')) {
          return [
            {
              id: 'rx-1',
              patient_id: 'patient-rx-1',
              instructions: 'Dispense plan prepared',
            },
          ];
        }

        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }

        return [];
      }),
    } as any;

    const ophthalmologyResult = await service.executeOphthalmologyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'ophthalmology-encounter:oph-enc-1',
        itemType: 'ophthalmology_protocol_followup',
        sourceRecordId: 'oph-enc-1',
        patientId: 'patient-oph-1',
        encounterId: 'oph-enc-1',
        actionId: 'prepare-ophthalmology-order-set',
        actionType: 'order_set',
        actionTitle: 'Prepare ophthalmology order set',
      },
      { sessionId: 'session-oph-1' },
    );
    expect(ophthalmologyResult.result).toEqual(
      expect.objectContaining({
        operation: 'ophthalmology_order_set_prepared',
        encounterId: 'oph-enc-1',
      }),
    );

    const telemedicineResult = await service.executeTelemedicineRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'telemedicine-consultation:tele-1',
        itemType: 'telemedicine_protocol_followup',
        sourceRecordId: 'tele-1',
        patientId: 'patient-tele-1',
        consultationId: 'tele-1',
        actionId: 'confirm-telemedicine-consent',
        actionType: 'safety_review',
        actionTitle: 'Confirm telemedicine consent status',
      },
      { sessionId: 'session-tele-1' },
    );
    expect(telemedicineResult.result).toEqual(
      expect.objectContaining({
        operation: 'telemedicine_consent_confirmed',
        consultationId: 'tele-1',
      }),
    );

    const labResult = await service.executeLabRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'lab-critical-alert:lab-alert-1',
        itemType: 'lab_critical_alert_followup',
        sourceRecordId: 'lab-alert-1',
        patientId: 'patient-lab-1',
        alertId: 'lab-alert-1',
        actionId: 'acknowledge-critical-lab-alert',
        actionType: 'safety_review',
        actionTitle: 'Acknowledge critical lab alert',
      },
      { sessionId: 'session-lab-1' },
    );
    expect(labResult.result).toEqual(
      expect.objectContaining({
        operation: 'lab_alert_acknowledged',
        alertId: 'lab-alert-1',
      }),
    );

    const imagingResult = await service.executeImagingRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'imaging-report:img-report-1',
        itemType: 'imaging_doctor_result_followup',
        sourceRecordId: 'img-report-1',
        patientId: 'patient-img-1',
        reportId: 'img-report-1',
        actionId: 'prepare-radiology-followup-bundle',
        actionType: 'order_set',
        actionTitle: 'Prepare radiology follow-up bundle',
      },
      { sessionId: 'session-img-1' },
    );
    expect(imagingResult.result).toEqual(
      expect.objectContaining({
        operation: 'radiology_followup_bundle_prepared',
        reportId: 'img-report-1',
      }),
    );

    const pharmacyResult = await service.executePharmacyRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'pharmacy-prescription:rx-1',
        itemType: 'pharmacy_protocol_followup',
        sourceRecordId: 'rx-1',
        patientId: 'patient-rx-1',
        prescriptionId: 'rx-1',
        actionId: 'prepare-pharmacy-dispense-plan',
        actionType: 'order_set',
        actionTitle: 'Prepare pharmacy dispense plan',
      },
      { sessionId: 'session-rx-1' },
    );
    expect(pharmacyResult.result).toEqual(
      expect.objectContaining({
        operation: 'pharmacy_dispense_plan_prepared',
        prescriptionId: 'rx-1',
      }),
    );

    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'pharmacy-prescription:rx-1',
        'pharmacy',
        'pharmacy_protocol_followup',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'pharmacy-prescription:rx-1',
        metadata: expect.objectContaining({
          module: 'pharmacy',
          actionId: 'prepare-pharmacy-dispense-plan',
        }),
      }),
    );
  });

  it('builds ED and sepsis protocol items with executable recommendation bundles', async () => {
    const { service } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes("FROM users") && sql.includes("WHERE is_active = true")) {
          return [
            { id: 'doctor-ed-1', role: 'doctor', specialization: 'Emergency Medicine', name: 'Dr. Rapid' },
            { id: 'nurse-ed-1', role: 'nurse', specialization: 'Emergency', name: 'Nurse Swift' },
          ];
        }
        if (sql.includes('FROM referral_facilities')) {
          return [];
        }
        if (sql.includes('FROM ed_visits ev')) {
          return [
            {
              ed_visit_id: 'ed-visit-1',
              patient_id: 'patient-ed-1',
              ed_visit_number: 'ED-0001',
              arrival_date: '2026-03-04T08:00:00.000Z',
              chief_complaint: 'Chest pain',
              triage_level: 2,
              triage_acuity: 'emergent',
              ed_status: 'in_treatment',
              disposition: null,
              code_sepsis: false,
              code_stroke: false,
              code_stemi: true,
              patient_name: 'ED Patient',
              patient_number: 'P-ED-1',
            },
          ];
        }
        if (sql.includes('FROM sepsis_bundles sb')) {
          return [
            {
              sepsis_bundle_id: 'sepsis-bundle-1',
              patient_id: 'patient-sepsis-1',
              sepsis_screening_id: 'sepsis-screen-1',
              bundle_start_time: '2026-03-04T06:00:00.000Z',
              three_hour_bundle_complete: false,
              six_hour_bundle_complete: false,
              overall_compliance: false,
              repeat_lactate_measured: false,
              lactate_value: 4.2,
              severe_sepsis: true,
              septic_shock: false,
              patient_name: 'Sepsis Patient',
              patient_number: 'P-SEP-1',
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.getCrossModuleEscalationFeed(tenantDb);
    const edItem = result.items.find((item: any) => item.module === 'ed');
    const sepsisItem = result.items.find((item: any) => item.module === 'sepsis');

    expect(result.summary).toEqual(
      expect.objectContaining({
        ed: 1,
        sepsis: 1,
        specialty: 2,
      }),
    );
    expect(edItem).toEqual(
      expect.objectContaining({
        id: 'ed-visit:ed-visit-1',
        item_type: 'ed_protocol_followup',
      }),
    );
    expect(edItem?.metadata?.recommendation_bundle).toEqual(
      expect.objectContaining({
        bundle_label: 'ED protocol execution bundle',
      }),
    );
    expect(edItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'prepare-ed-order-set', type: 'order_set' }),
        expect.objectContaining({ id: 'complete-ed-disposition-prep', type: 'visit_preparation' }),
        expect.objectContaining({ id: 'escalate-ed-doctor-sync', type: 'escalation' }),
      ]),
    );

    expect(sepsisItem).toEqual(
      expect.objectContaining({
        id: 'sepsis-bundle:sepsis-bundle-1',
        item_type: 'sepsis_bundle_followup',
      }),
    );
    expect(sepsisItem?.metadata?.recommendation_bundle).toEqual(
      expect.objectContaining({
        bundle_label: 'Sepsis protocol execution bundle',
      }),
    );
    expect(sepsisItem?.metadata?.recommendation_bundle?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'queue-sepsis-three-hour-bundle', type: 'order_set' }),
        expect.objectContaining({ id: 'confirm-repeat-lactate-plan', type: 'lab_followup' }),
        expect.objectContaining({ id: 'escalate-sepsis-doctor-sync', type: 'escalation' }),
      ]),
    );
  });

  it('executes ED recommendation actions and persists queue execution state', async () => {
    const { service, mocks } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM ed_visits') && sql.includes('WHERE id = $1')) {
          return [
            {
              id: 'ed-visit-1',
              patient_id: 'patient-ed-1',
              ed_visit_number: 'ED-0001',
              arrival_date: '2026-03-04T08:00:00.000Z',
              chief_complaint: 'Chest pain',
              triage_level: 2,
              triage_acuity: 'emergent',
              ed_status: 'in_treatment',
              disposition: null,
              notes: null,
              follow_up_instructions: null,
              quality_flags: [],
            },
          ];
        }
        if (sql.includes('UPDATE ed_visits') && sql.includes('quality_flags = $2::jsonb')) {
          return [
            {
              id: 'ed-visit-1',
              patient_id: 'patient-ed-1',
              notes: 'ED order set prepared',
              quality_flags: [{ marker: '[nurse_queue_action:prepare-ed-order-set]' }],
            },
          ];
        }
        if (sql.includes('UPDATE ed_visits') && sql.includes('follow_up_instructions')) {
          return [
            {
              id: 'ed-visit-1',
              patient_id: 'patient-ed-1',
              follow_up_instructions: 'Disposition prep completed',
            },
          ];
        }
        if (sql.includes('UPDATE ed_visits') && sql.includes('SET notes = $1, updated_at = NOW()')) {
          return [
            {
              id: 'ed-visit-1',
              patient_id: 'patient-ed-1',
              notes: 'Doctor sync documented',
            },
          ];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const orderSetResult = await service.executeEdRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'ed-visit:ed-visit-1',
        itemType: 'ed_protocol_followup',
        sourceRecordId: 'ed-visit-1',
        patientId: 'patient-ed-1',
        visitId: 'ed-visit-1',
        actionId: 'prepare-ed-order-set',
        actionType: 'order_set',
        actionTitle: 'Prepare ED protocol order set',
        actionPayload: {
          suggested_orders: ['ECG', 'CBC'],
        },
      },
      { sessionId: 'session-ed-1' },
    );
    expect(orderSetResult.result).toEqual(
      expect.objectContaining({
        operation: 'ed_order_set_prepared',
        visitId: 'ed-visit-1',
      }),
    );

    const dispositionResult = await service.executeEdRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'ed-visit:ed-visit-1',
        itemType: 'ed_protocol_followup',
        sourceRecordId: 'ed-visit-1',
        patientId: 'patient-ed-1',
        visitId: 'ed-visit-1',
        actionId: 'complete-ed-disposition-prep',
        actionType: 'visit_preparation',
        actionTitle: 'Complete ED disposition prep checkpoint',
      },
      { sessionId: 'session-ed-2' },
    );
    expect(dispositionResult.result).toEqual(
      expect.objectContaining({
        operation: 'ed_disposition_prep_completed',
        visitId: 'ed-visit-1',
      }),
    );

    const escalateResult = await service.executeEdRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'ed-visit:ed-visit-1',
        itemType: 'ed_protocol_followup',
        sourceRecordId: 'ed-visit-1',
        patientId: 'patient-ed-1',
        visitId: 'ed-visit-1',
        actionId: 'escalate-ed-doctor-sync',
        actionType: 'escalation',
        actionTitle: 'Escalate ED case to doctor synchronization',
      },
      { sessionId: 'session-ed-3' },
    );
    expect(escalateResult.result).toEqual(
      expect.objectContaining({
        operation: 'ed_doctor_sync_documented',
        visitId: 'ed-visit-1',
      }),
    );

    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'ed-visit:ed-visit-1',
        'ed',
        'ed_protocol_followup',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'ed-visit:ed-visit-1',
        metadata: expect.objectContaining({
          module: 'ed',
          actionId: 'escalate-ed-doctor-sync',
        }),
      }),
    );
  });

  it('executes sepsis recommendation actions and persists queue execution state', async () => {
    const { service, mocks } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM sepsis_bundles sb') && sql.includes('WHERE sb.id = $1')) {
          return [
            {
              id: 'sepsis-bundle-1',
              patient_id: 'patient-sepsis-1',
              sepsis_screening_id: 'sepsis-screen-1',
              bundle_start_time: '2026-03-04T06:00:00.000Z',
              three_hour_bundle_complete: false,
              six_hour_bundle_complete: false,
              overall_compliance: false,
              repeat_lactate_measured: false,
              lactate_value: 4.2,
              repeat_lactate_value: null,
              notes: null,
              severe_sepsis: true,
              septic_shock: false,
            },
          ];
        }
        if (sql.includes('UPDATE sepsis_bundles') && sql.includes('SET notes = $1, updated_at = NOW()')) {
          return [
            {
              id: 'sepsis-bundle-1',
              patient_id: 'patient-sepsis-1',
              notes: 'Sepsis workflow note',
            },
          ];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const queueResult = await service.executeSepsisRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'sepsis-bundle:sepsis-bundle-1',
        itemType: 'sepsis_bundle_followup',
        sourceRecordId: 'sepsis-bundle-1',
        patientId: 'patient-sepsis-1',
        bundleId: 'sepsis-bundle-1',
        actionId: 'queue-sepsis-three-hour-bundle',
        actionType: 'order_set',
        actionTitle: 'Queue sepsis three-hour bundle actions',
      },
      { sessionId: 'session-sepsis-1' },
    );
    expect(queueResult.result).toEqual(
      expect.objectContaining({
        operation: 'sepsis_three_hour_bundle_queued',
        bundleId: 'sepsis-bundle-1',
      }),
    );

    const repeatResult = await service.executeSepsisRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'sepsis-bundle:sepsis-bundle-1',
        itemType: 'sepsis_bundle_followup',
        sourceRecordId: 'sepsis-bundle-1',
        patientId: 'patient-sepsis-1',
        bundleId: 'sepsis-bundle-1',
        actionId: 'confirm-repeat-lactate-plan',
        actionType: 'lab_followup',
        actionTitle: 'Confirm repeat lactate monitoring plan',
      },
      { sessionId: 'session-sepsis-2' },
    );
    expect(repeatResult.result).toEqual(
      expect.objectContaining({
        operation: 'sepsis_repeat_lactate_plan_confirmed',
        bundleId: 'sepsis-bundle-1',
      }),
    );

    const escalateResult = await service.executeSepsisRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'sepsis-bundle:sepsis-bundle-1',
        itemType: 'sepsis_bundle_followup',
        sourceRecordId: 'sepsis-bundle-1',
        patientId: 'patient-sepsis-1',
        bundleId: 'sepsis-bundle-1',
        actionId: 'escalate-sepsis-doctor-sync',
        actionType: 'escalation',
        actionTitle: 'Escalate sepsis bundle to doctor synchronization',
      },
      { sessionId: 'session-sepsis-3' },
    );
    expect(escalateResult.result).toEqual(
      expect.objectContaining({
        operation: 'sepsis_doctor_sync_documented',
        bundleId: 'sepsis-bundle-1',
      }),
    );

    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'sepsis-bundle:sepsis-bundle-1',
        'sepsis',
        'sepsis_bundle_followup',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'sepsis-bundle:sepsis-bundle-1',
        metadata: expect.objectContaining({
          module: 'sepsis',
          actionId: 'escalate-sepsis-doctor-sync',
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
                    executed_at: hoursAgo(28),
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
                    executed_at: hoursAgo(7),
                    result: { operation: 'oncology_doctor_override_documented' },
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
                    executed_at: hoursAgo(3),
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
    expect(analytics.cdssAdoption).toEqual(
      expect.objectContaining({
        queueItemsWithExecutions: 3,
        executionCoveragePercent: 100,
        actionsPerQueueItemPercent: 100,
        overrideActionsTotal: 1,
        averageTimeToExecutionHours: 3,
      }),
    );
  });

  it('aggregates accounts synchronization outcomes in doctor analytics', async () => {
    const { service } = makeService();
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM nurse_cross_module_workflow_state') && sql.includes('destination_role')) {
          return [
            {
              workflow_key: 'accounts-sync:claim-1',
              module: 'claims',
              status: 'pending',
              destination_role: 'admin',
              destination_service: 'claims',
              created_at: hoursAgo(18),
              updated_at: hoursAgo(16),
              context: {
                claim_status: 'pending_submission',
              },
            },
            {
              workflow_key: 'billing-sync:invoice-1',
              module: 'billing',
              status: 'acknowledged',
              destination_role: 'admin',
              destination_service: 'billing',
              created_at: hoursAgo(8),
              updated_at: hoursAgo(6),
              context: {
                payment_status: 'awaiting_payment',
              },
            },
            {
              workflow_key: 'accounts-sync:claim-2',
              module: 'accounts',
              status: 'completed',
              destination_role: 'admin',
              destination_service: 'accounts',
              created_at: hoursAgo(4),
              updated_at: hoursAgo(2),
              completed_at: hoursAgo(1),
              context: {
                accounts_sync_status: 'closed',
              },
            },
          ];
        }
        return [];
      }),
    } as any;

    const analytics = await service.getDoctorOutcomeAnalytics(tenantDb, { days: 30 });

    expect(analytics.accountsSync).toEqual(
      expect.objectContaining({
        totalItems: 3,
        pendingItems: 2,
        byStatus: expect.objectContaining({
          pending_submission: 1,
          awaiting_payment: 1,
          closed: 1,
        }),
        byModule: expect.objectContaining({
          claims: 1,
          billing: 1,
          accounts: 1,
        }),
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
    expect(analytics.cdssAdoption.executionCoveragePercent).toBe(0);
  });

  it('executes blood-bank recommendation actions and persists queue execution state', async () => {
    const { service, mocks } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT context') && sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('FROM blood_transfusions bt')) {
          return [
            {
              id: 'tx-1',
              patient_id: 'patient-1',
              transfusion_status: 'ordered',
              consent_obtained: false,
              notes: '',
              unit_number: 'UNIT-001',
              component_type: 'packed_rbc',
              blood_group: 'O',
              rh_factor: 'positive',
            },
          ];
        }
        if (sql.includes('UPDATE blood_transfusions') && sql.includes('SET notes = $1')) {
          return [
            {
              id: 'tx-1',
              patient_id: 'patient-1',
              transfusion_status: 'ordered',
              consent_obtained: false,
              notes: params?.[0] || '',
            },
          ];
        }
        if (sql.includes('consent_obtained = true')) {
          return [];
        }
        if (sql.includes('SELECT status, context, acknowledged_by')) {
          return [];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.executeBloodBankRecommendationAction(
      tenantDb,
      user,
      {
        itemId: 'blood-bank-transfusion:tx-1',
        itemType: 'blood_bank_transfusion_followup',
        sourceRecordId: 'tx-1',
        patientId: 'patient-1',
        transfusionId: 'tx-1',
        actionId: 'confirm-crossmatch-consent',
        actionTitle: 'Confirm compatibility checks and transfusion consent',
      },
      { sessionId: 'session-1' },
    );

    expect(result.ok).toBe(true);
    expect(result.actionId).toBe('confirm-crossmatch-consent');
    expect(result.result).toEqual(
      expect.objectContaining({
        operation: 'transfusion_consent_confirmed',
        transfusionId: 'tx-1',
        patientId: 'patient-1',
      }),
    );
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO nurse_cross_module_workflow_state'),
      expect.arrayContaining([
        'blood-bank-transfusion:tx-1',
        'blood_bank',
        'blood_bank_transfusion_followup',
        'tx-1',
        null,
        'patient-1',
        'acknowledged',
      ]),
    );
    expect(mocks.hipaaAuditService.logAuditEvent).toHaveBeenCalledWith(
      tenantDb,
      expect.objectContaining({
        action: HipaaAuditAction.NURSE_CROSS_MODULE_ACKNOWLEDGE,
        resourceId: 'blood-bank-transfusion:tx-1',
        patientId: 'patient-1',
        metadata: expect.objectContaining({
          module: 'blood_bank',
          actionId: 'confirm-crossmatch-consent',
          transfusionId: 'tx-1',
        }),
      }),
    );
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
