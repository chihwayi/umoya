import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller';
import { HipaaAuditService } from '../services/hipaa-audit.service';

describe('AdminAuditController', () => {
  let controller: AdminAuditController;

  const hipaaAuditServiceMock = {
    getDisclosureReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        {
          provide: HipaaAuditService,
          useValue: hipaaAuditServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
    jest.clearAllMocks();
  });

  it('returns patient disclosure report with date filters', async () => {
    const req = {
      tenantDb: { query: jest.fn() },
    } as any;
    hipaaAuditServiceMock.getDisclosureReport.mockResolvedValue({
      reportType: 'hipaa_accounting_of_disclosures',
      summary: { total_events: 1 },
    });

    const result = await controller.getDisclosureReport(
      req,
      {} as any,
      'patient-1',
      '2026-03-01T00:00:00.000Z',
      '2026-03-06T23:59:59.999Z',
    );

    expect(hipaaAuditServiceMock.getDisclosureReport).toHaveBeenCalledWith(
      req.tenantDb,
      'patient-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect(result.summary.total_events).toBe(1);
  });

  it('throws when patientId is missing', async () => {
    const req = {
      tenantDb: { query: jest.fn() },
    } as any;

    await expect(controller.getDisclosureReport(req, {} as any, '', undefined, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

