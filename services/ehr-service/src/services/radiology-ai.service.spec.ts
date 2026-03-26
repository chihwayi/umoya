import { RadiologyAiService } from './radiology-ai.service';

describe('RadiologyAiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes study analysis through governed CdssService radiology analysis', async () => {
    const studyRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (value) => value),
      create: jest.fn().mockImplementation((value) => value),
    };
    const findingRepo = {
      save: jest.fn().mockImplementation(async (value) => ({ id: 'finding-1', ...value })),
      create: jest.fn().mockImplementation((value) => value),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const tenantDb = {
      getRepository: jest.fn((entity: any) => {
        if (entity?.name === 'DicomStudy') return studyRepo;
        return findingRepo;
      }),
    } as any;
    const tenantService = {
      getTenantDatabase: jest.fn().mockResolvedValue(tenantDb),
    };
    const alertDelivery = {
      broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined),
    };
    const cdssService = {
      analyzeRadiologyStudy: jest.fn().mockResolvedValue({
        findings: [{ severity: 'critical', confidence: 0.91 }],
        top_finding: 'Pneumothorax',
        confidence: 0.91,
        model_version: 'medicore-cxr-v1.0',
      }),
    };

    const service = new RadiologyAiService(tenantService as any, alertDelivery as any, cdssService as any);
    const study = await service.registerStudy('kids-clinic', {
      patientId: 'patient-1',
      studyUid: '1.2.3',
      modality: 'CXR',
      bodyPart: 'Chest',
      storageKey: 'studies/cxr-1',
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(cdssService.analyzeRadiologyStudy).toHaveBeenCalledWith(
      expect.objectContaining({
        studyId: study.id,
        patientId: 'patient-1',
        modality: 'CXR',
      }),
      'kids-clinic',
      tenantDb,
    );
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalled();
  });
});
