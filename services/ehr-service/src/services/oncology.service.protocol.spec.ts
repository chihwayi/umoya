import { OncologyService } from './oncology.service';

const makeService = () => {
  const financeService = {};
  const terminologyService = {};

  return {
    service: new OncologyService(financeService as any, terminologyService as any),
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
