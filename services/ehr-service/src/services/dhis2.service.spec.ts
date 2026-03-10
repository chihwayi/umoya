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
});
