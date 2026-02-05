import { Test, TestingModule } from '@nestjs/testing';
import { HealthMonitorService } from './health-monitor.service';
import { EmailService } from './email.service';
import { DatabaseProvisioningService } from './database-provisioning.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant, TenantStatus } from '../entities/tenant.entity';
import { DataSource } from 'typeorm';

// Mock TypeORM DataSource
jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return {
    ...actual,
    DataSource: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([{ v: 'public.vitals', o: 'public.orders' }]),
      destroy: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let tenantRepositoryMock: any;
  let emailServiceMock: any;
  let provisioningServiceMock: any;

  beforeEach(async () => {
    tenantRepositoryMock = {
      find: jest.fn(),
    };

    emailServiceMock = {
      sendEmail: jest.fn(),
    };

    provisioningServiceMock = {
      applyClinicSchema: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: tenantRepositoryMock,
        },
        {
          provide: EmailService,
          useValue: emailServiceMock,
        },
        {
          provide: DatabaseProvisioningService,
          useValue: provisioningServiceMock,
        },
      ],
    }).compile();

    service = module.get<HealthMonitorService>(HealthMonitorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('performHealthChecks', () => {
    it('should check health for active tenants', async () => {
      const tenants = [
        {
          id: 'tenant-1',
          clinicName: 'Test Clinic',
          connectionString: 'postgres://user:pass@localhost:5432/db',
          status: TenantStatus.ACTIVE,
        },
      ];

      tenantRepositoryMock.find.mockResolvedValue(tenants);

      await service.performHealthChecks();

      expect(tenantRepositoryMock.find).toHaveBeenCalledWith({
        where: { status: TenantStatus.ACTIVE },
      });
      // Verify DataSource was instantiated (via mock)
      expect(DataSource).toHaveBeenCalled();
    });

    it('should handle tenants with missing connection strings', async () => {
      const tenants = [
        {
          id: 'tenant-2',
          clinicName: 'No DB Clinic',
          connectionString: null,
          status: TenantStatus.ACTIVE,
        },
      ];

      tenantRepositoryMock.find.mockResolvedValue(tenants);

      await service.performHealthChecks();

      expect(tenantRepositoryMock.find).toHaveBeenCalled();
    });
  });
});
