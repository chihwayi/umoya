import { DataSource } from 'typeorm';
import { Dhis2SchedulerService } from './dhis2-scheduler.service';

describe('Dhis2SchedulerService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips hourly sync when scheduler is disabled', async () => {
    process.env.DHIS2_SCHEDULED_SYNC_ENABLED = 'false';

    const tenantServiceMock = {
      getAllActiveTenants: jest.fn(),
      getTenantDatabase: jest.fn(),
    } as any;

    const dhis2ServiceMock = {
      syncPatients: jest.fn(),
      sendAggregateReport: jest.fn(),
      retryFailedSync: jest.fn(),
    } as any;

    const service = new Dhis2SchedulerService(tenantServiceMock, dhis2ServiceMock);
    await service.runHourlyTenantSync();

    expect(tenantServiceMock.getAllActiveTenants).not.toHaveBeenCalled();
    expect(dhis2ServiceMock.syncPatients).not.toHaveBeenCalled();
  });

  it('runs tenant cycle for active tenants when scheduler is enabled', async () => {
    process.env.DHIS2_SCHEDULED_SYNC_ENABLED = 'true';
    process.env.DHIS2_SCHEDULED_RETRY_LIMIT = '10';

    const tenantDb = { query: jest.fn() } as unknown as DataSource;
    const tenantServiceMock = {
      getAllActiveTenants: jest.fn().mockResolvedValue([{ id: 'tenant-a' }]),
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    } as any;

    const dhis2ServiceMock = {
      syncPatients: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
      sendAggregateReport: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
      retryFailedSync: jest.fn().mockResolvedValue({ attempted: 1, failed: 0 }),
    } as any;

    const service = new Dhis2SchedulerService(tenantServiceMock, dhis2ServiceMock);
    await service.runHourlyTenantSync();

    expect(tenantServiceMock.getAllActiveTenants).toHaveBeenCalledTimes(1);
    expect(tenantServiceMock.getTenantDatabase).toHaveBeenCalledWith('tenant-a');
    expect(dhis2ServiceMock.syncPatients).toHaveBeenCalledWith(tenantDb, 'tenant-a');
    expect(dhis2ServiceMock.sendAggregateReport).toHaveBeenCalledWith({}, tenantDb, 'tenant-a');
    expect(dhis2ServiceMock.retryFailedSync).toHaveBeenCalledWith(tenantDb, 'tenant-a', { limit: 10 });
  });
});
