import { EarlyWarningService } from './early-warning.service';
import { NurseWorklistService } from './nurse-worklist.service';
import { PatientEarlyWarningScore } from '../entities/patient-early-warning-score.entity';
import { PatientVitalBaseline } from '../entities/patient-vital-baseline.entity';
import { ClinicalEscalationTask } from '../entities/clinical-escalation-task.entity';

type LifecycleState = {
  patients: Array<{ id: string; firstName: string; lastName: string; patientNumber: string }>;
  baselines: any[];
  scores: any[];
  escalations: any[];
  nurseTasks: any[];
  remoteAlerts: any[];
};

const makeLifecycleTenantDb = (state: LifecycleState) => ({
  getRepository: jest.fn((entity) => {
    if (entity === PatientVitalBaseline) {
      return {
        find: jest.fn(async ({ where }: any) =>
          state.baselines.filter((row) => row.patientId === where.patientId),
        ),
      };
    }

    if (entity === PatientEarlyWarningScore) {
      return {
        create: jest.fn((payload) => payload),
        save: jest.fn(async (payload) => {
          if (payload.id) {
            const existing = state.scores.find((row) => row.id === payload.id);
            Object.assign(existing, payload);
            return existing;
          }
          const row = { id: `ews-${state.scores.length + 1}`, ...payload };
          state.scores.push(row);
          return row;
        }),
        findOne: jest.fn(async ({ where }: any) =>
          state.scores.find((row) => row.id === where.id) || null,
        ),
      };
    }

    if (entity === ClinicalEscalationTask) {
      return {
        create: jest.fn((payload) => payload),
        save: jest.fn(async (payload) => {
          if (payload.id) {
            const existing = state.escalations.find((row) => row.id === payload.id);
            Object.assign(existing, payload);
            return existing;
          }
          const row = { id: `esc-${state.escalations.length + 1}`, ...payload };
          state.escalations.push(row);
          return row;
        }),
        find: jest.fn(async ({ where }: any) =>
          state.escalations.filter((row) => row.earlyWarningScoreId === where.earlyWarningScoreId),
        ),
      };
    }

    throw new Error(`Unexpected repository ${String(entity?.name || entity)}`);
  }),
  query: jest.fn(async (sql: string, params: any[] = []) => {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql.includes('from clinical_escalation_tasks cet')) {
      const [statusFilter, severityFilter, includeCompleted, limit] = params;
      return state.escalations
        .filter((row) => !statusFilter || row.status === statusFilter)
        .filter((row) => !severityFilter || row.severity === severityFilter)
        .filter((row) => includeCompleted === true || row.status !== 'completed')
        .slice(0, limit)
        .map((row) => {
          const patient = state.patients.find((item) => item.id === row.patientId);
          const score = state.scores.find((item) => item.id === row.earlyWarningScoreId);
          const remoteAlert = state.remoteAlerts.find((item) => item.linkedEscalationTaskId === row.id) || null;
          return {
            id: row.id,
            patient_id: row.patientId,
            early_warning_score_id: row.earlyWarningScoreId,
            nurse_task_id: row.nurseTaskId,
            source_module: row.sourceModule,
            source_reference_id: row.sourceReferenceId,
            escalation_type: row.escalationType,
            severity: row.severity,
            status: row.status,
            title: row.title,
            summary: row.summary,
            recommended_action: row.recommendedAction,
            due_at: row.dueAt,
            acknowledged_at: row.acknowledgedAt,
            completed_at: row.completedAt,
            evidence: row.evidence || {},
            metadata: row.metadata || {},
            first_name: patient?.firstName || 'Unknown',
            last_name: patient?.lastName || 'Patient',
            patient_number: patient?.patientNumber || 'UNKNOWN',
            early_warning_total_score: score?.totalScore ?? null,
            early_warning_risk_level: score?.riskLevel ?? null,
            remote_monitoring_alert_id: remoteAlert?.id || null,
            remote_monitoring_alert_type: remoteAlert?.alertType || null,
            remote_monitoring_severity: remoteAlert?.severity || null,
          };
        });
    }

    if (normalizedSql.includes('update clinical_escalation_tasks') && normalizedSql.includes('status = case when status = \'completed\'')) {
      const [escalationTaskId, userId] = params;
      const escalation = state.escalations.find((row) => row.id === escalationTaskId);
      if (!escalation) return [];
      if (escalation.status !== 'completed') {
        escalation.status = 'acknowledged';
      }
      escalation.acknowledgedBy = escalation.acknowledgedBy || userId;
      escalation.acknowledgedAt = escalation.acknowledgedAt || new Date();
      return [{
        id: escalation.id,
        patient_id: escalation.patientId,
        early_warning_score_id: escalation.earlyWarningScoreId,
        nurse_task_id: escalation.nurseTaskId,
      }];
    }

    if (normalizedSql.includes('update patient_early_warning_scores')) {
      const [scoreId, userId] = params;
      const score = state.scores.find((row) => row.id === scoreId);
      if (score) {
        score.alertAcknowledgedBy = score.alertAcknowledgedBy || userId;
        score.alertAcknowledgedAt = score.alertAcknowledgedAt || new Date();
      }
      return [];
    }

    if (normalizedSql.includes('update nurse_tasks') && normalizedSql.includes('status = case when status = \'completed\'')) {
      const [nurseTaskId] = params;
      const nurseTask = state.nurseTasks.find((row) => row.id === nurseTaskId);
      if (nurseTask && nurseTask.status !== 'completed') {
        nurseTask.status = 'in_progress';
      }
      return [];
    }

    if (normalizedSql.includes('update remote_monitoring_alerts') && normalizedSql.includes('acknowledged_by')) {
      const [escalationTaskId, userId] = params;
      state.remoteAlerts
        .filter((row) => row.linkedEscalationTaskId === escalationTaskId)
        .forEach((row) => {
          row.acknowledgedBy = row.acknowledgedBy || userId;
          row.acknowledgedAt = row.acknowledgedAt || new Date();
          if (row.status !== 'completed') {
            row.status = 'acknowledged';
          }
        });
      return [];
    }

    if (normalizedSql.includes('update clinical_escalation_tasks') && normalizedSql.includes('status = \'completed\'')) {
      const [escalationTaskId, userId, note] = params;
      const escalation = state.escalations.find((row) => row.id === escalationTaskId);
      if (!escalation) return [];
      escalation.status = 'completed';
      escalation.completedBy = userId;
      escalation.completedAt = new Date();
      escalation.metadata = {
        ...(escalation.metadata || {}),
        completionNote: note || null,
      };
      return [{
        id: escalation.id,
        patient_id: escalation.patientId,
        nurse_task_id: escalation.nurseTaskId,
      }];
    }

    if (normalizedSql.includes('update nurse_tasks') && normalizedSql.includes('status = \'completed\'')) {
      const [nurseTaskId, userId, note] = params;
      const nurseTask = state.nurseTasks.find((row) => row.id === nurseTaskId);
      if (nurseTask) {
        nurseTask.status = 'completed';
        nurseTask.completedBy = userId;
        nurseTask.completedAt = new Date();
        nurseTask.completionNotes = note || null;
      }
      return [];
    }

    if (normalizedSql.includes('update remote_monitoring_alerts') && normalizedSql.includes('status = \'completed\'')) {
      const [escalationTaskId] = params;
      state.remoteAlerts
        .filter((row) => row.linkedEscalationTaskId === escalationTaskId)
        .forEach((row) => {
          row.status = 'completed';
          row.resolvedAt = new Date();
        });
      return [];
    }

    throw new Error(`Unhandled SQL in lifecycle test: ${sql}`);
  }),
});

describe('MOAS-05 escalation lifecycle', () => {
  it('carries an early-warning escalation through feed, acknowledgment, and completion', async () => {
    const state: LifecycleState = {
      patients: [{ id: 'patient-1', firstName: 'Jane', lastName: 'Doe', patientNumber: 'P001' }],
      baselines: [
        {
          id: 'baseline-1',
          patientId: 'patient-1',
          metricName: 'heartRate',
          baselineValue: 82,
          lowerBound: 70,
          upperBound: 95,
          sampleCount: 6,
        },
      ],
      scores: [],
      escalations: [],
      nurseTasks: [],
      remoteAlerts: [],
    };

    const tenantDb = makeLifecycleTenantDb(state) as any;
    const nurseTaskService = {
      createTask: jest.fn(async (payload: any) => {
        const task = { id: `nurse-task-${state.nurseTasks.length + 1}`, status: 'pending', ...payload };
        state.nurseTasks.push(task);
        return task;
      }),
      updateTask: jest.fn(),
    };
    const earlyWarningService = new EarlyWarningService(null as any, null as any, nurseTaskService as any);
    const hipaaAuditService = {
      logAuditEvent: jest.fn().mockResolvedValue(undefined),
    };
    const hivService = {
      getEnrollments: jest.fn().mockResolvedValue({ enrollments: [] }),
    };
    const nurseWorklistService = new NurseWorklistService(hipaaAuditService as any, hivService as any);
    const user = {
      id: 'nurse-1',
      firstName: 'Nurse',
      lastName: 'Joy',
      role: 'nurse',
    };

    const savedScore: any = await earlyWarningService.recordNews2Score(tenantDb, {
      patientId: 'patient-1',
      vitalsId: 'vitals-1',
      respiratoryRate: 28,
      spo2: 89,
      temperature: 39.2,
      systolicBp: 84,
      heartRate: 132,
      consciousness: 'alert',
    }, 'test-tenant');

    expect(savedScore.escalationTaskId).toBe('esc-1');
    expect(savedScore.explanationSummary).toContain('NEWS2');
    expect(state.escalations[0]).toEqual(
      expect.objectContaining({
        id: 'esc-1',
        patientId: 'patient-1',
        nurseTaskId: 'nurse-task-1',
        status: 'open',
        severity: 'critical',
      }),
    );
    expect(state.escalations[0].metadata.baselineComparisons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'heartRate',
          outsideExpectedRange: true,
        }),
      ]),
    );

    state.remoteAlerts.push({
      id: 'rm-alert-1',
      linkedEscalationTaskId: 'esc-1',
      patientId: 'patient-1',
      alertType: 'early_warning_deterioration',
      severity: 'critical',
      status: 'open',
    });

    const openFeed = await nurseWorklistService.getClinicalEscalationFeed(tenantDb, { includeCompleted: true });
    expect(openFeed.summary).toEqual({
      total: 1,
      critical: 1,
      open: 1,
      acknowledged: 0,
      highRiskEarlyWarning: 1,
      remoteMonitoringLinked: 1,
    });
    expect(openFeed.items[0]).toEqual(
      expect.objectContaining({
        id: 'esc-1',
        patientName: 'Jane Doe',
        status: 'open',
        earlyWarning: expect.objectContaining({ totalScore: savedScore.totalScore, riskLevel: 'high' }),
        remoteMonitoring: expect.objectContaining({ alertId: 'rm-alert-1' }),
      }),
    );

    await nurseWorklistService.acknowledgeClinicalEscalation(tenantDb, user, 'esc-1', {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(state.escalations[0]).toEqual(
      expect.objectContaining({
        status: 'acknowledged',
        acknowledgedBy: 'nurse-1',
      }),
    );
    expect(state.scores[0]).toEqual(
      expect.objectContaining({
        alertAcknowledgedBy: 'nurse-1',
      }),
    );
    expect(state.nurseTasks[0]).toEqual(
      expect.objectContaining({
        status: 'in_progress',
      }),
    );
    expect(state.remoteAlerts[0]).toEqual(
      expect.objectContaining({
        status: 'acknowledged',
        acknowledgedBy: 'nurse-1',
      }),
    );

    await nurseWorklistService.completeClinicalEscalation(
      tenantDb,
      user,
      'esc-1',
      { note: 'Patient reassessed and stabilized' },
      { ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(state.escalations[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        completedBy: 'nurse-1',
        metadata: expect.objectContaining({
          completionNote: 'Patient reassessed and stabilized',
        }),
      }),
    );
    expect(state.nurseTasks[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
        completedBy: 'nurse-1',
        completionNotes: 'Patient reassessed and stabilized',
      }),
    );
    expect(state.remoteAlerts[0]).toEqual(
      expect.objectContaining({
        status: 'completed',
      }),
    );

    const completedFeed = await nurseWorklistService.getClinicalEscalationFeed(tenantDb, { includeCompleted: true });
    expect(completedFeed.summary.open).toBe(0);
    expect(completedFeed.items[0].status).toBe('completed');
    expect(hipaaAuditService.logAuditEvent).toHaveBeenCalledTimes(2);
  });
});
