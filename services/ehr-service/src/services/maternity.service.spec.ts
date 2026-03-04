import { BadRequestException } from '@nestjs/common';
import { MaternityService } from './maternity.service';

const makeService = () => {
  const terminologyService = {
    validateConcept: jest.fn(),
  };
  const orderService = {
    createOrder: jest.fn(),
    authorizeOrder: jest.fn(),
  };
  const labOrderService = {
    create: jest.fn(),
  };
  const referralService = {
    createReferral: jest.fn(),
  };

  return {
    service: new MaternityService(
      terminologyService as any,
      orderService as any,
      labOrderService as any,
      referralService as any,
    ),
    mocks: {
      terminologyService,
      orderService,
      labOrderService,
      referralService,
    },
  };
};

describe('MaternityService hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects ANC persistence when safety warnings were not acknowledged', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'precheckANCVisit').mockResolvedValue({
      blockers: [],
      warnings: [{ code: 'anc.hypertension_warning', message: 'Raised blood pressure detected.' }],
      required_actions: [],
      suggested_orders: [],
      doctor_escalation_required: true,
      trace: [],
      guideline_citations: [],
    });

    const tenantDb = {
      query: jest.fn(),
    } as any;

    await expect(
      service.createANCVisit(
        tenantDb,
        {
          maternity_enrollment_id: 'enroll-1',
          patient_id: 'patient-1',
          visit_number: 1,
          visit_date: '2026-03-04',
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('rejects delivery persistence when blocker-grade rules fail server-side', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'precheckDelivery').mockResolvedValue({
      blockers: [{ code: 'delivery.missing_delivery_time', message: 'Delivery time is required.' }],
      warnings: [],
      required_actions: [],
      suggested_orders: [],
      doctor_escalation_required: false,
      trace: [],
      guideline_citations: [],
    });

    const tenantDb = {
      query: jest.fn(),
    } as any;

    await expect(
      service.createDelivery(
        tenantDb,
        {
          maternity_enrollment_id: 'enroll-1',
          patient_id: 'patient-1',
          delivery_date: '2026-03-04',
          delivery_type: 'cesarean',
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('creates a maternity care task when ANC escalation is required', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'precheckANCVisit').mockResolvedValue({
      blockers: [],
      warnings: [{ code: 'anc.fever_warning', message: 'Maternal fever detected.' }],
      required_actions: ['Assess for maternal infection and sepsis risk.'],
      suggested_orders: ['Urgent infection workup'],
      doctor_escalation_required: true,
      trace: [{ rule_id: 'anc.fever_warning', severity: 'warning', message: 'Maternal fever detected.' }],
      guideline_citations: [
        {
          rule_id: 'anc.fever_warning',
          source: 'WHO',
          citation: 'WHO ANC danger-sign guidance',
        },
      ],
    });

    const tenantDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT lmp_date FROM maternity_enrollments')) {
          return [];
        }
        if (sql.includes('INSERT INTO anc_visits')) {
          return [{ id: 'anc-visit-1' }];
        }
        if (sql.includes('FROM maternity_care_tasks')) {
          return [];
        }
        if (sql.includes('INSERT INTO maternity_care_tasks')) {
          return [{ id: 'task-1' }];
        }
        return [];
      }),
    } as any;

    const result = await service.createANCVisit(
      tenantDb,
      {
        maternity_enrollment_id: 'enroll-1',
        patient_id: 'patient-1',
        visit_number: 2,
        visit_date: '2026-03-04',
        safety_warnings_acknowledged: true,
      },
      'user-1',
    );

    expect(result.id).toBe('anc-visit-1');
    const careTaskInsertCall = (tenantDb.query as jest.Mock).mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO maternity_care_tasks'),
    );
    expect(careTaskInsertCall?.[1]?.[12]).toEqual(expect.stringContaining('recommendation_bundle'));
  });

  it('applies a maternity recommendation bundle into real workflow records', async () => {
    const { service, mocks } = makeService();
    const recommendationBundle = {
      version: 1,
      generated_at: '2026-03-04T10:00:00.000Z',
      bundle_label: 'ANC escalation bundle',
      summary: 'Immediate urgent obstetric review is required.',
      actionable_count: 2,
      pending_count: 2,
      applied_count: 0,
      items: [
        {
          id: 'maternal-hypertension-monitoring-order',
          type: 'order',
          title: 'Authorize urgent blood pressure monitoring order',
          bundle_name: 'Maternal hypertensive disorder bundle',
          urgency: 'stat',
          rationale: 'Raised maternal blood pressure requires repeat observations.',
          rule_ids: ['anc.severe_hypertension'],
          citations: [],
          auto_authorize: true,
          order_payload: {
            patientId: 'patient-1',
            orderType: 'procedure',
            orderName: 'Urgent blood pressure monitoring',
            instructions: 'Repeat blood pressure now.',
            priority: 'urgent',
          },
        },
        {
          id: 'maternal-hypertension-referral',
          type: 'referral',
          title: 'Prepare urgent obstetric referral',
          bundle_name: 'Maternal hypertensive disorder bundle',
          urgency: 'stat',
          rationale: 'Severe hypertension may require higher-level obstetric care.',
          rule_ids: ['anc.severe_hypertension'],
          citations: [],
          referral_payload: {
            referralType: 'specialist_consultation',
            specialty: 'Obstetrics',
            priority: 'urgent',
            urgency: 'urgent',
            reason: 'Urgent review for severe maternal hypertension / possible pre-eclampsia',
            status: 'pending',
          },
        },
      ],
    };

    mocks.orderService.createOrder.mockResolvedValue({ id: 'order-1' });
    mocks.orderService.authorizeOrder.mockResolvedValue({ id: 'order-1', status: 'authorized' });
    mocks.referralService.createReferral.mockResolvedValue({ id: 'ref-1' });

    const baseTask = {
      id: 'task-1',
      patient_id: 'patient-1',
      source_type: 'anc_visit',
      status: 'acknowledged',
      task_context: {
        recommendation_bundle: recommendationBundle,
        applied_recommendations: [],
        guideline_citations: [],
      },
    };

    const tenantDb = {
      query: jest.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('SELECT * FROM maternity_care_tasks')) {
          return [baseTask];
        }
        if (sql.includes('UPDATE maternity_care_tasks')) {
          return [
            {
              ...baseTask,
              status: params?.[0],
              latest_note: params?.[2],
              task_context: JSON.parse(params?.[3] || '{}'),
            },
          ];
        }
        return [];
      }),
    } as any;

    const result = await service.applyMaternityCareTaskRecommendations(
      tenantDb,
      'tenant-1',
      'task-1',
      {},
      'doctor-1',
    );

    expect(mocks.orderService.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.orderService.authorizeOrder).toHaveBeenCalledWith('order-1', 'doctor-1', 'tenant-1');
    expect(mocks.referralService.createReferral).toHaveBeenCalledWith(
      'patient-1',
      expect.any(Object),
      'doctor-1',
      tenantDb,
    );
    expect(result.applied_count).toBe(2);
    expect(result.task.task_context.recommendation_bundle.applied_count).toBe(2);
    expect(result.task.status).toBe('actioned');
  });
});
