import { BadRequestException } from '@nestjs/common';
import { MaternityService } from './maternity.service';

const makeService = () =>
  new MaternityService({
    validateConcept: jest.fn(),
  } as any);

describe('MaternityService hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects ANC persistence when safety warnings were not acknowledged', async () => {
    const service = makeService();
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
    const service = makeService();
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
    const service = makeService();
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
    expect(tenantDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO maternity_care_tasks'),
      expect.any(Array),
    );
  });
});
