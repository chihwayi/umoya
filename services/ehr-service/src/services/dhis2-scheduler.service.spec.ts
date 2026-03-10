import { DataSource } from 'typeorm';
import { Dhis2SchedulerService } from './dhis2-scheduler.service';

describe('Dhis2SchedulerService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete (global as any).fetch;
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
      getRecentErrorCount: jest.fn(),
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
      getRecentErrorCount: jest.fn().mockResolvedValue(0),
    } as any;

    const service = new Dhis2SchedulerService(tenantServiceMock, dhis2ServiceMock);
    await service.runHourlyTenantSync();

    expect(tenantServiceMock.getAllActiveTenants).toHaveBeenCalledTimes(1);
    expect(tenantServiceMock.getTenantDatabase).toHaveBeenCalledWith('tenant-a');
    expect(dhis2ServiceMock.syncPatients).toHaveBeenCalledWith(tenantDb, 'tenant-a');
    expect(dhis2ServiceMock.sendAggregateReport).toHaveBeenCalledWith({}, tenantDb, 'tenant-a');
    expect(dhis2ServiceMock.retryFailedSync).toHaveBeenCalledWith(tenantDb, 'tenant-a', { limit: 10 });
    expect(dhis2ServiceMock.getRecentErrorCount).toHaveBeenCalledWith(tenantDb, 24);
  });

  it('sends webhook alert when recent DHIS2 errors exceed threshold', async () => {
    process.env.DHIS2_SCHEDULED_SYNC_ENABLED = 'true';
    process.env.DHIS2_ALERT_ERROR_THRESHOLD = '3';
    process.env.DHIS2_ALERT_LOOKBACK_HOURS = '12';
    process.env.DHIS2_ALERT_WEBHOOK_URL = 'http://example.test/hook';

    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    (global as any).fetch = fetchMock;

    const tenantDb = { query: jest.fn() } as unknown as DataSource;
    const tenantServiceMock = {
      getAllActiveTenants: jest.fn().mockResolvedValue([{ id: 'tenant-a' }]),
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    } as any;

    const dhis2ServiceMock = {
      syncPatients: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
      sendAggregateReport: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
      retryFailedSync: jest.fn().mockResolvedValue({ attempted: 0, failed: 0 }),
      getRecentErrorCount: jest.fn().mockResolvedValue(5),
    } as any;

    const service = new Dhis2SchedulerService(tenantServiceMock, dhis2ServiceMock);
    await service.runHourlyTenantSync();

    expect(dhis2ServiceMock.getRecentErrorCount).toHaveBeenCalledWith(tenantDb, 12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://example.test/hook');
  });
});
