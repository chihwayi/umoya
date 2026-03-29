import { cdssApi, ehrAxios } from './api';

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

jest.mock('../utils/autoLogout', () => ({
  handleAutoLogout: jest.fn(),
}));

describe('cdssApi proxy routing', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(ehrAxios, 'post');
  });

  afterEach(() => {
    postSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('routes risk assessment through EHR proxy with tenant/auth headers', async () => {
    postSpy.mockResolvedValue({ data: { risk_level: 'high' } } as any);
    const payload = { patientId: 'patient-1', age: 44 };

    const response = await cdssApi.getRiskAssessment(payload, 'token-abc', 'tenant-a');

    expect(postSpy).toHaveBeenCalledWith('/cdss/risk-assessment', payload, {
      headers: {
        'X-Tenant-ID': 'tenant-a',
        Authorization: 'Bearer token-abc',
      },
    });
    expect(response.data.risk_level).toBe('high');
  });

  it('routes diagnosis assist through EHR proxy with tenant/auth headers', async () => {
    postSpy.mockResolvedValue({
      data: { suggested_diagnoses: [{ diagnosis: 'pneumonia' }] },
    } as any);
    const payload = { symptoms: ['fever', 'cough'] };

    const response = await cdssApi.getDiagnosisSuggestions(payload, 'token-abc', 'tenant-a');

    expect(postSpy).toHaveBeenCalledWith('/cdss/diagnosis-assist', payload, {
      headers: {
        'X-Tenant-ID': 'tenant-a',
        Authorization: 'Bearer token-abc',
      },
    });
    expect(response.data.suggested_diagnoses[0].diagnosis).toBe('pneumonia');
  });

  it('routes guideline search through EHR proxy with patient context', async () => {
    postSpy.mockResolvedValue({ data: { citations: [] } } as any);
    const patientContext = { age: 70, gender: 'female' };

    await cdssApi.searchGuidelines('sepsis protocol', 'token-abc', 'tenant-a', 7, patientContext);

    expect(postSpy).toHaveBeenCalledWith(
      '/cdss/guidelines/search',
      {
        query: 'sepsis protocol',
        limit: 7,
        patient_context: patientContext,
      },
      {
        headers: {
          'X-Tenant-ID': 'tenant-a',
          Authorization: 'Bearer token-abc',
        },
        timeout: 55000,
      },
    );
  });

  it('routes guideline check through EHR proxy with condition payload', async () => {
    postSpy.mockResolvedValue({ data: { recommendations: [] } } as any);
    const patientData = { age: 50, gender: 'male' };

    await cdssApi.getGuidelines('hypertension', patientData, 'token-abc', 'tenant-a');

    expect(postSpy).toHaveBeenCalledWith(
      '/cdss/guidelines',
      {
        condition: 'hypertension',
        patientData,
      },
      {
        headers: {
          'X-Tenant-ID': 'tenant-a',
          Authorization: 'Bearer token-abc',
        },
      },
    );
  });

  it('routes imaging analysis through EHR proxy with multipart + tenant/auth headers', async () => {
    postSpy.mockResolvedValue({ data: { findings: [] } } as any);
    const formData = new FormData();
    formData.append('file', new Blob(['fake-image'], { type: 'image/png' }), 'image.png');

    await cdssApi.analyzeMedicalImage(formData, 'token-abc', 'tenant-a');

    expect(postSpy).toHaveBeenCalledWith('/cdss/analyze-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Tenant-ID': 'tenant-a',
        Authorization: 'Bearer token-abc',
      },
    });
  });
});
