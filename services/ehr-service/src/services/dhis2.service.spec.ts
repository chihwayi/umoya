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
});
