import { OncologyService } from './oncology.service';

const makeService = () => {
  const financeService = {};
  const terminologyService = {};
  const aiSurfaceContractService = {
    buildSurfaceMetadata: jest.fn((input: any) => ({
      aiSurface: input.aiSurface,
      useCase: input.useCase,
      provenance: {
        modelId: input.modelId,
        modelVersion: input.modelVersion,
        provider: input.provider,
        source: input.source,
      },
      audit: {
        modelRegistry: 'ai_model_audit_registry',
        promptAuditLog: 'prompt_audit_log',
        requestId: null,
        recorded: input.recorded === true,
      },
      monitoring: {
        metricsSurface: input.aiSurface,
        offlineEvalSupported: false,
        releaseGateSupported: false,
      },
      controls: {
        disablePaths: ['test disable'],
        rollbackPaths: ['test rollback'],
      },
    })),
  };

  return {
    service: new OncologyService(financeService as any, terminologyService as any, {} as any, aiSurfaceContractService as any),
    aiSurfaceContractService,
  };
};

describe('OncologyService protocol automation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a protocol automation bundle and applies execution state from workflow context', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'generateSurveillanceReminders').mockResolvedValue({
      upcoming: [],
      overdue: [{ dueDate: '2026-03-01T00:00:00.000Z', tests: ['CT Chest'] }],
    } as any);
    jest.spyOn(service, 'getFinancialSummary').mockResolvedValue({
      stressFlag: true,
    } as any);

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM oncology_cases') && sql.includes('LIMIT 1')) {
          return [{ id: 'case-1', status: 'active', primary_diagnosis: 'Lung cancer', care_plan: '' }];
        }
        if (sql.includes('FROM oncology_response_assessments')) {
          return [{ id: 'resp-1', recist_response: 'PD', new_lesions: true, assessment_date: '2026-03-01' }];
        }
        if (sql.includes('FROM oncology_infusion_sessions ois') && sql.includes("ois.status IN ('scheduled', 'in_progress')")) {
          return [{ id: 'sess-1', status: 'scheduled', regimen_id: 'reg-1', regimen_name: 'Carboplatin' }];
        }
        if (sql.includes('FROM oncology_adverse_events') && sql.includes('grade::int >= 3')) {
          return [{ id: 'ae-1', event_type: 'Neutropenia', grade: 3 }];
        }
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [
            {
              status: 'acknowledged',
              context: {
                action_executions: {
                  'route-tumor-board-review': {
                    status: 'completed',
                    executed_at: '2026-03-04T10:00:00.000Z',
                    executed_by_name: 'Dr Onco',
                    result: { operation: 'tumor_board_review_routed' },
                  },
                },
              },
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.getProtocolAutomationBundle(tenantDb, 'case-1');

    expect(result.protocolBundle).toEqual(
      expect.objectContaining({
        bundle_label: 'Oncology Protocol Automation Bundle',
        actionable_count: expect.any(Number),
      }),
    );
    expect(result.protocolBundle.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'queue-prechemo-labs' }),
        expect.objectContaining({ id: 'document-dose-adjustment-review' }),
        expect.objectContaining({ id: 'route-tumor-board-review', execution_status: 'completed' }),
      ]),
    );
    expect(result.protocolBundle.pending_count).toBeGreaterThanOrEqual(1);
  });

  it('returns idempotent success for an already completed protocol action', async () => {
    const { service } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM oncology_cases') && sql.includes('LIMIT 1')) {
          return [{ id: 'case-1', patient_id: 'patient-1', care_plan: '' }];
        }
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [
            {
              status: 'acknowledged',
              context: {
                action_executions: {
                  'queue-prechemo-labs': {
                    status: 'completed',
                    result: { operation: 'prechemo_order_set_documented' },
                  },
                },
              },
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.executeProtocolBundleAction(
      tenantDb,
      'case-1',
      'queue-prechemo-labs',
      { id: 'doc-1', firstName: 'Alex', lastName: 'Doctor' },
      {},
    );

    expect(result.idempotent).toBe(true);
    expect(result.result.operation).toBe('prechemo_order_set_documented');
  });

  it('builds a compact mobile oncology protocol snapshot from the highest-priority active case', async () => {
    const { service, aiSurfaceContractService } = makeService();

    jest.spyOn(service, 'listCases').mockResolvedValue({
      cases: [
        {
          id: 'case-1',
          patient_id: 'patient-1',
          patient_name: 'Jane Doe',
          primary_diagnosis: 'Breast cancer',
          status: 'active',
          overall_stage: 'II',
          oncologist_name: 'Dr Onco',
        },
      ],
      total: 1,
    } as any);
    jest.spyOn(service, 'getProtocolAutomationBundle').mockResolvedValue({
      protocolBundle: {
        bundle_key: 'oncology-protocol:case-1',
        actionable_count: 2,
        pending_count: 1,
        items: [
          {
            id: 'route-tumor-board-review',
            title: 'Route case for tumor-board review',
            priority: 'critical',
            rationale: 'Progressive disease requires multidisciplinary review.',
            execution_status: 'completed',
          },
          {
            id: 'queue-prechemo-labs',
            title: 'Queue pre-chemo CBC/CMP order set',
            priority: 'high',
            rationale: 'Next infusion needs a completed lab gate.',
          },
        ],
      },
    } as any);
    jest.spyOn(service, 'generateTreatmentRecommendations').mockResolvedValue({
      recommendations: [
        {
          title: 'Evaluate alternative regimen',
          rationale: 'Latest RECIST response suggests escalation review.',
          severity: 'warning',
        },
      ],
    } as any);
    jest.spyOn(service, 'generateSurveillanceReminders').mockResolvedValue({
      upcoming: [],
      overdue: [{ dueDate: '2026-03-01T00:00:00.000Z' }],
    } as any);

    const result = await service.getMobileProtocolSnapshot({} as any);

    expect(result.activeCase).toEqual(
      expect.objectContaining({
        id: 'case-1',
        patientName: 'Jane Doe',
        diagnosis: 'Breast cancer',
      }),
    );
    expect(result.protocol).toEqual(
      expect.objectContaining({
        actionableCount: 2,
        pendingCount: 1,
        nextAction: expect.objectContaining({ id: 'queue-prechemo-labs' }),
      }),
    );
    expect(result.surveillance.overdueCount).toBe(1);
    expect(aiSurfaceContractService.buildSurfaceMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        aiSurface: 'oncology_mobile_intelligence',
        useCase: 'oncology_protocol_mobile',
      }),
    );
    expect(result.aiMetadata).toEqual(
      expect.objectContaining({
        aiSurface: 'oncology_mobile_intelligence',
        useCase: 'oncology_protocol_mobile',
        governed: true,
        provenance: expect.objectContaining({
          source: 'oncology_protocol_bundle',
        }),
      }),
    );
  });

  it('executes pre-chemo lab queue protocol action and persists workflow state', async () => {
    const { service } = makeService();

    const tenantDb = {
      query: jest.fn(async (sql: string, params: any[]) => {
        if (sql.includes('FROM oncology_cases') && sql.includes('LIMIT 1')) {
          return [{ id: 'case-1', patient_id: 'patient-1', care_plan: '' }];
        }
        if (sql.includes('FROM nurse_cross_module_workflow_state')) {
          return [];
        }
        if (sql.includes('SELECT id, order_number, status') && sql.includes('FROM lab_orders')) {
          return [];
        }
        if (sql.includes('INSERT INTO lab_orders')) {
          return [{ id: `lab-${Math.random()}`, order_number: 'ONCLAB-1', status: 'ordered' }];
        }
        if (sql.includes('FROM oncology_infusion_sessions') && sql.includes('WHERE id = $1')) {
          return [{ id: 'sess-1', notes: '' }];
        }
        if (sql.includes('UPDATE oncology_infusion_sessions')) {
          return [{ id: 'sess-1' }];
        }
        if (sql.includes('INSERT INTO nurse_cross_module_workflow_state')) {
          return [];
        }
        return [];
      }),
    } as any;

    const result = await service.executeProtocolBundleAction(
      tenantDb,
      'case-1',
      'queue-prechemo-labs',
      { id: 'doc-1', firstName: 'Alex', lastName: 'Doctor' },
      { actionPayload: { infusion_session_id: 'sess-1' } },
    );

    expect(result.ok).toBe(true);
    expect(result.result.operation).toBe('prechemo_lab_orders_created');
    expect(result.result.createdLabOrderCount).toBe(4);
    expect(result.result.createdLabOrderIds).toHaveLength(4);
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE oncology_infusion_sessions'),
      expect.arrayContaining([expect.stringContaining('[protocol:queue-prechemo-labs]'), 'sess-1']),
    );
  });
});
