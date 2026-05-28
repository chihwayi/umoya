import { RadiologyAiService } from './radiology-ai.service';

// ── S170: db-query based method tests ─────────────────────────────────────────

function makeS170Service(cdssOverride?: any, alertOverride?: any) {
  const cdss = cdssOverride ?? {
    analyzeRadiologyStudy: jest.fn().mockResolvedValue({
      findings: [{ description: 'No abnormality', confidence: 0.5 }],
      confidence: 0.5,
    }),
  };
  const alert = alertOverride ?? {
    broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined),
  };
  const tenantService: any = { getTenantDatabase: jest.fn() };
  const aiSurface: any = { buildSurfaceMetadata: jest.fn().mockReturnValue({}) };
  return new RadiologyAiService(tenantService, alert, cdss, aiSurface);
}

function makeS170Db(existing: any[] = [], insertReturn: any = { id: 'finding-1' }) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT') && sql.includes('radiology_ai_findings')) {
        return Promise.resolve(existing);
      }
      if (sql.includes('INSERT')) return Promise.resolve([insertReturn]);
      if (sql.includes('UPDATE')) return Promise.resolve([{ ...insertReturn }]);
      return Promise.resolve([]);
    }),
  };
}

describe('RadiologyAiService — S170 db methods', () => {
  it('returns cached result if study already analysed', async () => {
    const svc = makeS170Service();
    const cached = { id: 'f1', urgency: 'ROUTINE', findings: [] };
    const db = makeS170Db([cached]);
    const result = await svc.analyseStudyWithDb('study-1', 'p1', 'doc-1', db, 'test');
    expect(result).toEqual(cached);
  });

  it('calls CDSS and inserts new finding for new study', async () => {
    const svc = makeS170Service();
    const db = makeS170Db([]);
    const result = await svc.analyseStudyWithDb('study-2', 'p1', 'doc-1', db, 'test');
    expect(result).toMatchObject({ id: 'finding-1' });
  });

  it('stores abstention row when CDSS throws', async () => {
    const cdss = { analyzeRadiologyStudy: jest.fn().mockRejectedValue(new Error('timeout')) };
    const svc = makeS170Service(cdss);
    const db = makeS170Db([]);
    const result = await svc.analyseStudyWithDb('study-3', 'p1', 'doc-1', db, 'test');
    expect(result).toMatchObject({ id: 'finding-1' });
  });

  it('broadcasts alert when urgency is CRITICAL', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const cdss = {
      analyzeRadiologyStudy: jest.fn().mockResolvedValue({
        findings: [{ severity: 'critical', confidence: 0.97 }],
        confidence: 0.97,
      }),
    };
    const svc = makeS170Service(cdss, alert);
    const db = makeS170Db([]);
    await svc.analyseStudyWithDb('study-4', 'p1', 'doc-1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert).toHaveBeenCalledWith(
      'clinic1',
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('does not broadcast for ROUTINE urgency', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeS170Service(undefined, alert);
    const db = makeS170Db([]);
    await svc.analyseStudyWithDb('study-5', 'p1', 'doc-1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert).not.toHaveBeenCalled();
  });

  it('reviewFindingById updates status', async () => {
    const svc = makeS170Service();
    const db = makeS170Db();
    const result = await svc.reviewFindingById('f1', 'doc-1', 'confirmed', 'Verified', db);
    expect(result).toMatchObject({ id: 'finding-1' });
  });

  it('getPatientRadiologyAiHistory returns array', async () => {
    const svc = makeS170Service();
    const db = { query: jest.fn().mockResolvedValue([{ id: 'f1' }]) };
    const result = await svc.getPatientRadiologyAiHistory('p1', db);
    expect(result).toHaveLength(1);
  });
});

describe('RadiologyAiService', () => {
  const aiSurfaceContractService = {
    buildSurfaceMetadata: jest.fn((payload) => ({
      aiSurface: 'radiology_ai',
      useCase: payload.useCase,
      provenance: { modelId: payload.modelId, modelVersion: payload.modelVersion, provider: payload.provider, source: payload.source },
    })),
  };

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

    const service = new RadiologyAiService(
      tenantService as any,
      alertDelivery as any,
      cdssService as any,
      aiSurfaceContractService as any,
    );
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
    expect((study as any).aiMetadata).toEqual(expect.objectContaining({
      aiSurface: 'radiology_ai',
      useCase: 'radiology_analysis',
    }));
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalled();
  });
});
