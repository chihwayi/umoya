import { ClinicalWorkflowService } from './clinical-workflow.service';

function makeDb(overrides: Partial<Record<string, any>> = {}) {
  const calls: { sql: string; params: any[] }[] = [];
  const workflowSteps = overrides.workflowSteps ?? [
    { id: 'step-1', workflow_id: 'wf-1', step_order: 1, step_type: 'wait', step_config: { durationMinutes: 60 }, conditions: null, is_required: true },
    { id: 'step-2', workflow_id: 'wf-1', step_order: 2, step_type: 'send_notification', step_config: { userIds: ['u1'], message: 'resumed' }, conditions: null, is_required: true },
  ];

  const db = {
    query: jest.fn().mockImplementation((sql: string, params: any[] = []) => {
      calls.push({ sql, params });

      if (sql.includes('information_schema.tables')) {
        return Promise.resolve([{ exists: true }]);
      }
      if (sql.includes('SELECT * FROM workflow_steps WHERE workflow_id')) {
        return Promise.resolve(workflowSteps);
      }
      if (sql.includes('INSERT INTO workflow_step_executions')) {
        return Promise.resolve([{ id: `se-${params[2]}`, execution_id: params[0], step_id: params[1], step_order: params[2] }]);
      }
      if (sql.startsWith('UPDATE workflow_step_executions SET started_at')) {
        return Promise.resolve([]);
      }
      if (sql.includes('UPDATE workflow_step_executions SET resume_at')) {
        return Promise.resolve([]);
      }
      if (sql.startsWith('UPDATE workflow_step_executions')) {
        return Promise.resolve([]);
      }
      if (sql.startsWith('UPDATE workflow_executions')) {
        return Promise.resolve([]);
      }
      if (sql.includes('SELECT wse.id AS step_execution_id')) {
        return Promise.resolve(overrides.dueRows ?? []);
      }
      if (sql.includes('SELECT created_by FROM clinical_workflows')) {
        return Promise.resolve(overrides.workflowRow ?? [{ created_by: 'creator-1' }]);
      }
      if (sql.includes('INSERT INTO provider_messages')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
  };

  return { db, calls };
}

describe('ClinicalWorkflowService — durable wait steps', () => {
  it('pauses at a wait step instead of blocking, and does not mark the execution completed', async () => {
    const svc = new ClinicalWorkflowService();
    const { db, calls } = makeDb();

    await (svc as any).executeWorkflowSteps('wf-1', 'exec-1', { entityType: 'appointment', entityId: 'a1' }, db);

    const resumeUpdate = calls.find((c) => c.sql.includes('UPDATE workflow_step_executions SET resume_at'));
    expect(resumeUpdate).toBeDefined();
    expect(resumeUpdate!.params[1]).toBe('se-1');

    // The second step (send_notification) must NOT have run yet — only one
    // step_execution row (for the wait step) should have been created.
    const stepExecInserts = calls.filter((c) => c.sql.includes('INSERT INTO workflow_step_executions'));
    expect(stepExecInserts).toHaveLength(1);

    // Execution must not be marked completed while paused.
    const completedUpdate = calls.find(
      (c) => c.sql.includes("UPDATE workflow_executions SET status = 'completed'"),
    );
    expect(completedUpdate).toBeUndefined();
  });

  it('resumeDueWorkflowWaits continues past a due wait step to completion', async () => {
    const tenantService: any = {
      getAllActiveTenants: jest.fn().mockResolvedValue([{ id: 't1', subdomain: 'clinic-a', databaseName: 'db' }]),
      getTenantDatabase: jest.fn(),
    };
    const svc = new ClinicalWorkflowService(undefined, tenantService);

    const { db, calls } = makeDb({
      dueRows: [
        {
          step_execution_id: 'se-1',
          execution_id: 'exec-1',
          step_order: 1,
          workflow_id: 'wf-1',
          trigger_entity_type: 'appointment',
          trigger_entity_id: 'a1',
          patient_id: null,
          execution_data: '{}',
        },
      ],
    });
    tenantService.getTenantDatabase.mockResolvedValue(db);

    await svc.resumeDueWorkflowWaits();

    // The wait step execution itself should be marked completed on resume...
    const waitStepCompleted = calls.find(
      (c) => c.sql.includes('UPDATE workflow_step_executions') && c.sql.includes("SET status = $1") && c.params?.[2] === 'se-1',
    );
    expect(waitStepCompleted).toBeDefined();

    // ...and processing should continue to step 2 and mark the execution completed.
    const completedUpdate = calls.find(
      (c) => c.sql.includes("UPDATE workflow_executions SET status = 'completed'"),
    );
    expect(completedUpdate).toBeDefined();
  });
});

describe('ClinicalWorkflowService — unimplemented step types are rejected, not silently no-op', () => {
  it.each(['assign_role', 'create_task', 'create_order'])(
    'addWorkflowStep rejects %s at creation time',
    async (stepType) => {
      const svc = new ClinicalWorkflowService();
      const { db } = makeDb();

      await expect(svc.addWorkflowStep('wf-1', { stepType }, db as any)).rejects.toThrow(
        /no real backend implementation/,
      );
    },
  );

  it.each(['assign_role', 'create_task', 'create_order'])(
    'executeStep throws for %s instead of logging and reporting success',
    async (stepType) => {
      const svc = new ClinicalWorkflowService();
      const { db } = makeDb();

      await expect(
        (svc as any).executeStep({ step_type: stepType, stepConfig: {} }, {}, db, 'se-1', 'wf-1'),
      ).rejects.toThrow(/no real backend implementation/);
    },
  );
});

describe('ClinicalWorkflowService — send_message step', () => {
  it('inserts a real provider_messages row using the workflow creator as sender', async () => {
    const svc = new ClinicalWorkflowService();
    const { db, calls } = makeDb();

    await (svc as any).executeStep(
      { step_type: 'send_message', stepConfig: { recipientId: 'user-2', message: 'hello' } },
      { patientId: 'p1' },
      db,
      'se-1',
      'wf-1',
    );

    const insert = calls.find((c) => c.sql.includes('INSERT INTO provider_messages'));
    expect(insert).toBeDefined();
    expect(insert!.params).toEqual(
      expect.arrayContaining(['creator-1', 'user-2', 'hello'].map((v) => v)),
    );
  });
});

describe('ClinicalWorkflowService — condition step', () => {
  it('skips the step (does not fail the workflow) when the condition is not met', async () => {
    const svc = new ClinicalWorkflowService();
    const { db } = makeDb();

    const result = await (svc as any).executeStep(
      { step_type: 'condition', stepConfig: { field: 'age', operator: 'gt', value: 18 } },
      {},
      db,
      'se-1',
      'wf-1',
    );

    expect(result).toEqual({ paused: false, skipped: true });
  });

  it('proceeds normally when the condition is met', async () => {
    const svc = new ClinicalWorkflowService();
    const { db } = makeDb();

    const result = await (svc as any).executeStep(
      { step_type: 'condition', stepConfig: { field: 'age', operator: 'gt', value: 18 } },
      { data: { age: 30 } },
      db,
      'se-1',
      'wf-1',
    );

    expect(result).toBeUndefined();
  });
});
