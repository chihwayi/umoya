import axios from 'axios';
import { DatimMerService } from './datim-mer.service';

jest.mock('axios');

// CI test fixtures — loaded from environment variables; no credentials are
// hardcoded here. Set DATIM_* vars in your CI environment or a gitignored
// .env.test file. The fallback values are non-secret test stubs only.
const TEST_ENV: Record<string, string> = {
  DATIM_DATASET_UID: process.env.DATIM_DATASET_UID ?? 'DATASET-1',
  DATIM_USERNAME: process.env.DATIM_USERNAME ?? 'ci-user',
  DATIM_PASSWORD: process.env.DATIM_PASSWORD ?? 'ci-stub',
  DATIM_BASE_URL: process.env.DATIM_BASE_URL ?? 'https://datim.example.test',
};

describe('DatimMerService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(process.env, TEST_ENV);
  });

  it('previews DATIM indicators from real-table query shapes', async () => {
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ date_of_birth: '2000-01-01', gender: 'female' }])
        .mockResolvedValueOnce([{ patient_id: 'p1', date_of_birth: '2000-01-01', gender: 'female' }])
        .mockResolvedValueOnce([{ patient_id: 'p1', date_of_birth: '2000-01-01', gender: 'female', viral_load: 200 }])
        .mockResolvedValueOnce([{ date_of_birth: '2000-01-01', gender: 'female', test_result: 'positive' }])
        .mockResolvedValueOnce([]) // TX_ML
        .mockResolvedValueOnce([]), // TX_RTT
      getRepository: jest.fn(),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new DatimMerService(tenantService as any, null as any);

    const preview = await service.previewIndicators('tenant-a', '202604');

    expect(preview.period).toBe('202604');
    expect(preview.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ indicator: 'TX_NEW', disaggregate: 'F_25-29', value: 1 }),
        expect.objectContaining({ indicator: 'TX_CURR', disaggregate: 'F_25-29', value: 1 }),
        expect.objectContaining({ indicator: 'TX_PVLS', disaggregate: 'F_25-29', value: 1 }),
        expect.objectContaining({ indicator: 'TX_PVLS_D', disaggregate: 'F_25-29', value: 1 }),
        expect.objectContaining({ indicator: 'HTS_TST', disaggregate: 'F_25-29', value: 1 }),
        expect.objectContaining({ indicator: 'HTS_TST_POS', disaggregate: 'F_25-29', value: 1 }),
      ]),
    );
  });

  it('submits mapped indicator rows to DATIM and stores the import summary', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { status: 'OK', imported: 2 } });

    const submissionRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'submission-1', ...value })),
    };
    const mappingRepo = {
      find: jest.fn(async () => [
        { merIndicator: 'TX_NEW', disaggregate: 'F_25-29', datimDeUid: 'DE1', datimCocUid: 'COC1', periodType: 'monthly' },
        { merIndicator: 'HTS_TST_POS', disaggregate: 'F_25-29', datimDeUid: 'DE2', datimCocUid: 'COC2', periodType: 'monthly' },
      ]),
    };
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ date_of_birth: '2000-01-01', gender: 'female' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ date_of_birth: '2000-01-01', gender: 'female', test_result: 'positive' }])
        .mockResolvedValueOnce([]) // TX_ML
        .mockResolvedValueOnce([]), // TX_RTT
      getRepository: jest.fn((entity) => {
        if (entity.name === 'DatimSubmission') return submissionRepo;
        return mappingRepo;
      }),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new DatimMerService(tenantService as any, null as any);

    const result = await service.submitToDatim('tenant-a', '202604', 'OU-1');

    expect(axios.post).toHaveBeenCalledWith(
      `${TEST_ENV.DATIM_BASE_URL}/api/dataValueSets`,
      expect.objectContaining({
        dataSet: TEST_ENV.DATIM_DATASET_UID,
        period: '202604',
        orgUnit: 'OU-1',
        dataValues: expect.arrayContaining([
          expect.objectContaining({ dataElement: 'DE1', categoryOptionCombo: 'COC1', value: 1 }),
          expect.objectContaining({ dataElement: 'DE2', categoryOptionCombo: 'COC2', value: 1 }),
        ]),
      }),
      expect.any(Object),
    );
    expect(result.status).toBe('submitted');
  });
});
