import { CdssService } from './cdss.service';

describe('CdssService proxy routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('proxies getGuidelines to /guidelines/check with tenant context', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        guidelines: [{ title: 'Sepsis' }],
        recommendations: ['Start broad-spectrum antibiotics'],
        contraindications: [],
        medication_warnings: [],
        evidence_level: 'high',
        matched_condition: 'sepsis',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.getGuidelines(
      'sepsis',
      { age: 41, gender: 'female', comorbidities: ['hypertension'] },
      'tenant-a',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/guidelines/check',
      {
        condition: 'sepsis',
        patient_age: 41,
        patient_gender: 'female',
        comorbidities: ['hypertension'],
        medications: [],
      },
      {
        timeout: 10000,
        headers: { 'X-Tenant-ID': 'tenant-a' },
      },
    );
    expect(response.source).toBe('advanced_cdss');
  });

  it('proxies searchGuidelines to /guidelines/search with patient context and tenant', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        citations: [{ title: 'Sepsis Bundle', source: 'cdss_rag' }],
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    const response = await service.searchGuidelines(
      'sepsis first hour',
      3,
      { age: 60, pregnancy: false },
      'tenant-b',
    );

    expect(postMock).toHaveBeenCalledWith(
      '/guidelines/search',
      {
        query: 'sepsis first hour',
        limit: 3,
        patient_context: { age: 60, pregnancy: false },
      },
      {
        timeout: 15000,
        headers: { 'X-Tenant-ID': 'tenant-b' },
      },
    );
    expect(response.citations).toHaveLength(1);
  });

  it('proxies analyzeMedicalImage to /analyze-image with tenant header', async () => {
    const service = new CdssService(undefined, undefined);
    const postMock = jest.fn().mockResolvedValue({
      data: { findings: ['No acute cardiopulmonary process'] },
    });
    (service as any).cdssClient = { post: postMock };

    const file = {
      buffer: Buffer.from('fake-image'),
      originalname: 'xray.png',
      mimetype: 'image/png',
    } as Express.Multer.File;

    const response = await service.analyzeMedicalImage(file, 'tenant-c');
    const callConfig = postMock.mock.calls[0]?.[2];

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0]?.[0]).toBe('/analyze-image');
    expect(callConfig?.timeout).toBe(45000);
    expect(callConfig?.headers?.['X-Tenant-ID']).toBe('tenant-c');
    expect(response.findings).toEqual(['No acute cardiopulmonary process']);
  });

  it('records abstention metric for abstained CDSS responses', async () => {
    const metricsMock = {
      recordCdssHook: jest.fn(),
      recordCdssHookError: jest.fn(),
      recordCdssRetry: jest.fn(),
      recordCdssTimeout: jest.fn(),
      recordCdssAbstention: jest.fn(),
    };
    const service = new CdssService(undefined, metricsMock as any);
    const postMock = jest.fn().mockResolvedValue({
      data: {
        citations: [],
        abstained: true,
        abstain_reason: 'low_confidence',
      },
    });
    (service as any).cdssClient = { post: postMock };
    (service as any).retryMax = 0;

    await service.searchGuidelines('ambiguous query', 3, { age: 50 }, 'tenant-z');
    expect(metricsMock.recordCdssAbstention).toHaveBeenCalledWith(
      'guidelines_search',
      'low_confidence',
      'tenant-z',
    );
  });

  it('classifies outbound allowlist blocks as egress_block errors', () => {
    const service = new CdssService(undefined, undefined);
    const errorType = (service as any).classifyCdssError({
      response: {
        data: {
          detail: 'Target host is not in CDSS allowlist',
        },
      },
    });
    expect(errorType).toBe('egress_block');
  });
});
