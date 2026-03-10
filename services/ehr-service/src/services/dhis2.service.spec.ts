import axios from 'axios';
import { DataSource } from 'typeorm';
import { Dhis2Service } from './dhis2.service';
import { TenantService, TenantDhis2Config } from './tenant.service';

jest.mock('axios');

describe('Dhis2Service', () => {
  const originalEnv = process.env;

  const makeClient = () => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  });

  const createService = (tenantConfig: TenantDhis2Config | null = null) => {
    const tenantServiceMock = {
      getTenantDhis2Config: jest.fn().mockResolvedValue(tenantConfig),
    } as unknown as TenantService;

    return {
      service: new Dhis2Service(tenantServiceMock),
      tenantServiceMock,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses ApiToken header when DHIS2_PAT is configured', async () => {
    process.env.DHIS2_URL = 'http://localhost:8888';
    process.env.DHIS2_API_VERSION = '40';
    process.env.DHIS2_PAT = 'test-pat';
    delete process.env.DHIS2_USERNAME;
    delete process.env.DHIS2_PASSWORD;
    process.env.DHIS2_USE_MOCK = 'false';

    const client = makeClient();
    client.get.mockResolvedValue({ data: { version: '2.40.0' } });

    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.create.mockReturnValue(client as any);

    const { service } = createService(null);

    const result = await service.getSyncStatus({} as DataSource, 'tenant-a');

    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:8888/api/40',
        headers: expect.objectContaining({
          Authorization: 'ApiToken test-pat',
        }),
      }),
    );
    expect(result.status).toBe('CONNECTED');
  });

  it('returns NOT_CONFIGURED when tenant dhis2 config is disabled', async () => {
    process.env.DHIS2_PAT = 'env-fallback-pat';
    process.env.DHIS2_USE_MOCK = 'false';

    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.create.mockReturnValue(makeClient() as any);

    const { service } = createService({
      tenantId: 'tenant-a',
      baseUrl: 'http://localhost:8888',
      apiVersion: '40',
      authType: 'pat',
      pat: 'tenant-pat',
      orgUnitId: 'ouA',
      trackedEntityTypeId: null,
      dataSetId: null,
      enabled: false,
    });

    const result = await service.getSyncStatus({} as DataSource, 'tenant-a');

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(mockedAxios.create).not.toHaveBeenCalled();
  });

  it('falls back to MOCK mode when no credentials are configured', async () => {
    delete process.env.DHIS2_PAT;
    delete process.env.DHIS2_USERNAME;
    delete process.env.DHIS2_PASSWORD;
    process.env.DHIS2_USE_MOCK = 'false';

    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.create.mockReturnValue(makeClient() as any);

    const { service } = createService(null);

    const result = await service.getPrograms('tenant-a');

    expect(result.programs.length).toBeGreaterThan(0);
    expect(mockedAxios.create).not.toHaveBeenCalled();
  });

  it('maps patient UUID to DHIS2 TEI before sending event', async () => {
    process.env.DHIS2_USE_MOCK = 'false';

    const client = makeClient();
    client.post.mockResolvedValue({
      data: {
        response: {
          importSummaries: [{ reference: 'EVT_123' }],
        },
      },
    });

    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.create.mockReturnValue(client as any);

    const { service } = createService({
      tenantId: 'tenant-a',
      baseUrl: 'http://localhost:8888',
      apiVersion: '40',
      authType: 'pat',
      pat: 'tenant-pat',
      orgUnitId: 'ouA',
      trackedEntityTypeId: null,
      dataSetId: null,
      enabled: true,
    });

    const patientId = 'd090cf8a-77cf-43f3-b7ac-4b7f9d200ac6';
    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT dhis2_tei_id')) {
          return Promise.resolve([{ dhis2_tei_id: 'TEI_789' }]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DataSource;

    const result = await service.sendEvent(
      {
        patientId,
        program: 'prog-1',
        eventDate: '2026-03-10',
        dataValues: [{ dataElement: 'de1', value: '1' }],
      },
      tenantDb,
      'tenant-a',
    );

    expect(client.post).toHaveBeenCalledWith(
      '/events',
      expect.objectContaining({
        trackedEntityInstance: 'TEI_789',
      }),
    );
    expect(result.status).toBe('SUCCESS');
    expect(result.reference).toBe('EVT_123');
  });

  it('returns sync status counts for patient/event/data-value logs', async () => {
    process.env.DHIS2_USE_MOCK = 'false';

    const client = makeClient();
    client.get.mockResolvedValue({ data: { version: '2.40.0' } });

    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.create.mockReturnValue(client as any);

    const { service } = createService({
      tenantId: 'tenant-a',
      baseUrl: 'http://localhost:8888',
      apiVersion: '40',
      authType: 'pat',
      pat: 'tenant-pat',
      orgUnitId: 'ouA',
      trackedEntityTypeId: null,
      dataSetId: null,
      enabled: true,
    });

    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('MAX(synced_at) AS last_sync')) {
          return Promise.resolve([
            {
              last_sync: '2026-03-10T06:30:00.000Z',
              patient_success_count: 5,
              event_success_count: 3,
              data_value_success_count: 2,
              total_error_count: 1,
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DataSource;

    const result = await service.getSyncStatus(tenantDb, 'tenant-a');

    expect(result.status).toBe('CONNECTED');
    expect(result.patientsSynced).toBe(5);
    expect(result.eventsSynced).toBe(3);
    expect(result.dataValuesSynced).toBe(2);
    expect(result.errors).toBe(1);
  });

  it('returns filtered sync log rows with summary', async () => {
    process.env.DHIS2_USE_MOCK = 'false';

    const { service } = createService(null);
    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT COUNT(*)::int AS total')) {
          return Promise.resolve([{ total: 2 }]);
        }
        if (sql.includes('FROM dhis2_sync_log') && sql.includes('ORDER BY synced_at DESC')) {
          return Promise.resolve([
            {
              id: 'log-1',
              entity_type: 'event',
              status: 'error',
              payload: { request: { program: 'p1' } },
              synced_at: '2026-03-10T07:00:00.000Z',
            },
          ]);
        }
        if (sql.includes('GROUP BY entity_type, status')) {
          return Promise.resolve([{ entity_type: 'event', status: 'error', count: 2 }]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DataSource;

    const result = await service.getSyncLog(tenantDb, { status: 'error', limit: 20, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.logs).toHaveLength(1);
    expect(result.summary).toEqual([{ entityType: 'event', status: 'error', count: 2 }]);
  });

  it('retries failed event logs when request payload is available', async () => {
    process.env.DHIS2_USE_MOCK = 'false';

    const { service } = createService(null);
    const sendEventSpy = jest.spyOn(service, 'sendEvent').mockResolvedValue({
      status: 'SUCCESS',
      reference: 'EVT_999',
      message: 'Event sent',
    });

    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM dhis2_sync_log') && sql.includes('status = $1')) {
          return Promise.resolve([
            {
              id: 'log-evt-1',
              entity_type: 'event',
              status: 'error',
              payload: { request: { program: 'prog-1', patientId: 'p-1' } },
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DataSource;

    const result = await service.retryFailedSync(tenantDb, 'tenant-a', { entityType: 'event', limit: 10 });

    expect(sendEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ program: 'prog-1' }),
      tenantDb,
      'tenant-a',
    );
    expect(result.attempted).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('skips retries when failed log has no request payload', async () => {
    process.env.DHIS2_USE_MOCK = 'false';

    const { service } = createService(null);
    const sendEventSpy = jest.spyOn(service, 'sendEvent');

    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM dhis2_sync_log') && sql.includes('status = $1')) {
          return Promise.resolve([
            {
              id: 'log-evt-2',
              entity_type: 'event',
              status: 'error',
              payload: {},
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DataSource;

    const result = await service.retryFailedSync(tenantDb, 'tenant-a', { entityType: 'event', limit: 10 });

    expect(sendEventSpy).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips non-retryable 4xx failed logs to avoid replaying invalid payloads', async () => {
    process.env.DHIS2_USE_MOCK = 'false';

    const { service } = createService(null);
    const sendEventSpy = jest.spyOn(service, 'sendEvent');

    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM dhis2_sync_log') && sql.includes('status = $1')) {
          return Promise.resolve([
            {
              id: 'log-evt-409',
              entity_type: 'event',
              status: 'error',
              error_message: 'Request failed with status code 409',
              payload: {
                request: { program: 'BAD_PROGRAM', patientId: 'p-1' },
                response: { httpStatusCode: 409 },
              },
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DataSource;

    const result = await service.retryFailedSync(tenantDb, 'tenant-a', { entityType: 'event', limit: 10 });

    expect(sendEventSpy).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('builds maternal monthly aggregate payload in mock mode', async () => {
    process.env.DHIS2_USE_MOCK = 'true';

    const { service } = createService(null);
    const tenantDb = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('COUNT(DISTINCT maternity_enrollment_id)')) {
          return Promise.resolve([{ total: 4 }]);
        }
        if (sql.includes('HAVING COUNT(*) >= 4')) {
          return Promise.resolve([{ total: 2 }]);
        }
        if (sql.includes('HAVING COUNT(*) >= 8')) {
          return Promise.resolve([{ total: 1 }]);
        }
        if (sql.includes('FROM deliveries') && sql.includes('COUNT(*)::int AS total')) {
          return Promise.resolve([{ total: 3 }]);
        }
        if (sql.includes('births_live')) {
          return Promise.resolve([{ total: 2 }]);
        }
        if (sql.includes('births_still')) {
          return Promise.resolve([{ total: 1 }]);
        }
        return Promise.resolve([{ total: 0 }]);
      }),
    } as unknown as DataSource;

    const result = await service.sendAggregateReport(
      {
        profile: 'maternal_newborn',
        dataSet: 'DS_MATERNAL',
        period: '202602',
        orgUnit: 'OU_A',
        dataElements: {
          anc1Plus: 'DE_ANC1',
          totalDeliveries: 'DE_DELIVERIES',
          liveBirths: 'DE_LIVE_BIRTHS',
        },
      },
      tenantDb,
      'tenant-a',
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.profile).toBe('maternal_newborn');
    expect(result.dataValues).toBe(3);
  });

  it('returns not configured for unsupported aggregate profile', async () => {
    process.env.DHIS2_USE_MOCK = 'true';

    const { service } = createService(null);
    const tenantDb = {
      query: jest.fn().mockResolvedValue([{ total: 0 }]),
    } as unknown as DataSource;

    const result = await service.sendAggregateReport(
      {
        profile: 'unknown_profile',
        dataSet: 'DS_X',
        period: '202602',
      },
      tenantDb,
      'tenant-a',
    );

    expect(result.status).toBe('NOT_CONFIGURED');
    expect(result.message).toContain('Unsupported aggregate profile');
  });
});
