import { BadRequestException } from '@nestjs/common';
import { HivService } from './hiv.service';

const makeTenantDb = () => {
  const query = jest.fn(async (sql: string, params?: any[]) => {
    if (sql.includes('SELECT COUNT(*) as count FROM hiv_clinical_visits')) {
      return [{ count: '0' }];
    }

    if (sql.includes('INSERT INTO hiv_clinical_visits')) {
      return [{ id: 'visit-1' }];
    }

    if (sql.includes('INSERT INTO hiv_audit_log')) {
      return [{ id: 'audit-1' }];
    }

    return [];
  });

  return { query } as any;
};

const makeService = () => {
  const monitoringService = {
    calculateNextViralLoadDate: jest.fn(),
    calculateNextCD4Date: jest.fn(),
    checkTreatmentFailure: jest.fn().mockReturnValue({
      isTreatmentFailure: false,
      severity: 'medium',
      reason: null,
    }),
  } as any;

  return new HivService(
    {} as any, // labResultsMatchingService
    monitoringService,
    {} as any, // qualityMetricsService
    {} as any, // visitTemplatesService
    {} as any, // tptTrackerService
    {} as any, // pediatricDosingService
    { create: jest.fn() } as any, // appointmentService
    {} as any, // tenantService
    { validateConcept: jest.fn() } as any, // terminologyService
    {} as any, // cdssService
  );
};

const baseBody = {
  enrollmentId: 'enroll-1',
  visitDate: '2026-02-20',
  visitType: 'A',
  providerId: 'provider-1',
  providerName: 'Nurse One',
  arvStatus: '1',
  arvReasonNotOnCode: 'CLIENT_DECLINED',
};

describe('HivService clinical visit validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails when visit date is in the future', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    await expect(
      service.createClinicalVisit(
        {
          ...baseBody,
          visitDate: futureDate,
        },
        tenantDb,
        'nurse',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('fails when viral load is non-numeric', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    await expect(
      service.createClinicalVisit(
        {
          ...baseBody,
          viralLoad: 'undetected',
        },
        tenantDb,
        'nurse',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('fails when viral load sample date is after result date', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    await expect(
      service.createClinicalVisit(
        {
          ...baseBody,
          viralLoadSampleCollectedDate: '2026-02-19',
          viralLoadResultReceivedDate: '2026-02-10',
        },
        tenantDb,
        'nurse',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('fails when adherence percentage is out of range', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    await expect(
      service.createClinicalVisit(
        {
          ...baseBody,
          arvAdherencePercentage: 120,
        },
        tenantDb,
        'nurse',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).not.toHaveBeenCalled();
  });

  it('fails when on-ART status is provided without regimen', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    await expect(
      service.createClinicalVisit(
        {
          ...baseBody,
          arvStatus: '3',
          arvReasonNotOnCode: undefined,
          arvRegimenCode: '',
        },
        tenantDb,
        'nurse',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(tenantDb.query).toHaveBeenCalled();
  });

  it('fails when ARV status 1 has no reason', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    await expect(
      service.createClinicalVisit(
        {
          ...baseBody,
          arvReasonNotOnCode: undefined,
          arvReason: undefined,
        },
        tenantDb,
        'nurse',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts reason fallback fields and tptEligibility mapping for valid visit', async () => {
    const service = makeService();
    const tenantDb = makeTenantDb();

    const result = await service.createClinicalVisit(
      {
        ...baseBody,
        arvReason: undefined,
        arvReasonNotOnCode: 'CLIENT_DECLINED',
        tptEligibility: 'Y',
      },
      tenantDb,
      'nurse',
    );

    expect(result).toEqual(expect.objectContaining({ id: 'visit-1' }));

    const visitInsertCall = (tenantDb.query as jest.Mock).mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO hiv_clinical_visits'),
    );

    expect(visitInsertCall).toBeDefined();
    const insertParams = visitInsertCall?.[1] || [];
    expect(insertParams).toContain('CLIENT_DECLINED');
    expect(insertParams).toContain('Y');
  });
});
