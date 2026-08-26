import { StreamingDiagnosisService } from './streaming-diagnosis.service';

describe('StreamingDiagnosisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes non-streaming diagnosis suggestions through governed CdssService', async () => {
    const cdssService = {
      diagnosisAssist: jest.fn().mockResolvedValue({
        suggested_diagnoses: [{ diagnosis: 'Pneumonia', confidence: 0.8 }],
      }),
    };
    const service = new StreamingDiagnosisService(cdssService as any);

    const result = await service.suggestDifferential('cough and fever', 'patient-1', 'tenant-a');

    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        symptoms: ['cough and fever'],
        clinicalNotes: 'cough and fever',
        context: 'streaming_diagnosis',
        specialty: 'primary_care',
        module: 'diagnostic_workup',
      }),
      true,
      'tenant-a',
    );
    expect((result as any).suggested_diagnoses).toHaveLength(1);
  });

  it('streams diagnosis results through governed CdssService', async () => {
    const cdssService = {
      diagnosisAssist: jest.fn().mockResolvedValue({
        suggested_diagnoses: [
          { diagnosis: 'Pneumonia', confidence: 0.8, icd10: 'J18' },
        ],
        red_flags: ['tachypnea'],
      }),
    };
    const service = new StreamingDiagnosisService(cdssService as any);
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await service.streamDifferential('cough and fever', 'patient-1', 'session-1', res, 'tenant-a');

    expect(cdssService.diagnosisAssist).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        sessionId: 'session-1',
        context: 'streaming_diagnosis',
        specialty: 'primary_care',
        module: 'diagnostic_workup',
      }),
      true,
      'tenant-a',
    );
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"diagnosis":"Pneumonia"'),
    );
    expect(res.write).toHaveBeenCalledWith('event: done\ndata: {}\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('emits a real error event instead of fabricated diagnoses when CDSS fails', async () => {
    const cdssService = {
      diagnosisAssist: jest.fn().mockRejectedValue(new Error('CDSS service unreachable')),
    };
    const service = new StreamingDiagnosisService(cdssService as any);
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as any;

    await service.streamDifferential('cough and fever', 'patient-1', 'session-1', res, 'tenant-a');

    const writtenPayloads = res.write.mock.calls.map((call: any[]) => call[0]).join('');
    expect(writtenPayloads).toContain('event: error');
    expect(writtenPayloads).toContain('diagnosis_unavailable');
    expect(writtenPayloads).not.toContain('Upper respiratory tract infection');
    expect(writtenPayloads).not.toContain('Influenza');
    expect(writtenPayloads).not.toContain('COVID-19');
    expect(res.end).toHaveBeenCalled();
  });
});
