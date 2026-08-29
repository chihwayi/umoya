import { KnowledgeIngestService } from './knowledge-ingest.service';

describe('KnowledgeIngestService', () => {
  const buildRepo = (overrides: any = {}) => ({
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  });

  // F17 investigation (S272) — the roadmap finding claimed documents stay
  // 'pending' forever after a silent failure; verified that's inaccurate — the
  // existing catch block already writes a real terminal 'failed' state.
  it('ingestDocument reaches a real terminal failed status when ingestion throws', async () => {
    const repo = buildRepo();
    const tenantDb = { getRepository: jest.fn().mockReturnValue(repo) } as any;
    const cdssService = { ingestKnowledgeDocument: jest.fn().mockRejectedValue(new Error('embedding service down')) };
    const minioService = { uploadBuffer: jest.fn().mockResolvedValue(undefined) };
    const docRepoSave = { id: 'doc-1', mimeType: 'application/pdf', title: 't', documentType: 'guideline' };
    repo.save = jest.fn().mockResolvedValue(docRepoSave);

    const service = new KnowledgeIngestService(cdssService as any, minioService as any);
    await service.ingestDocument(
      { originalname: 'guideline.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x'), size: 1 } as any,
      { title: 't', documentType: 'guideline' },
      'user-1',
      'clinic-a',
      tenantDb,
    );

    // ingestDocument returns immediately (fire-and-forget); flush microtasks.
    await new Promise((resolve) => setImmediate(resolve));

    expect(repo.update).toHaveBeenCalledWith('doc-1', expect.objectContaining({
      ingestionStatus: 'failed',
      ingestionError: 'embedding service down',
    }));
  });

  // The one genuine residual gap found while investigating F17: if the
  // failure-recording write itself throws, the document must not be silently
  // stuck — this is what detectStuckIngestions exists to catch.
  it('detectStuckIngestions marks pending/processing documents past the threshold as failed', async () => {
    const repo = buildRepo({
      getMany: jest.fn().mockResolvedValue([
        { id: 'doc-2', ingestionStatus: 'processing' },
        { id: 'doc-3', ingestionStatus: 'pending' },
      ]),
    });
    const tenantDb = { getRepository: jest.fn().mockReturnValue(repo) } as any;
    const service = new KnowledgeIngestService({} as any, {} as any);

    const count = await service.detectStuckIngestions('clinic-a', tenantDb);

    expect(count).toBe(2);
    expect(repo.update).toHaveBeenCalledWith('doc-2', expect.objectContaining({ ingestionStatus: 'failed' }));
    expect(repo.update).toHaveBeenCalledWith('doc-3', expect.objectContaining({ ingestionStatus: 'failed' }));
  });

  it('detectStuckIngestions is a no-op when nothing is stuck', async () => {
    const repo = buildRepo();
    const tenantDb = { getRepository: jest.fn().mockReturnValue(repo) } as any;
    const service = new KnowledgeIngestService({} as any, {} as any);

    const count = await service.detectStuckIngestions('clinic-a', tenantDb);

    expect(count).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  describe('sweepStuckIngestions', () => {
    it('does nothing when tenantService is not injected', async () => {
      const service = new KnowledgeIngestService({} as any, {} as any);
      await expect(service.sweepStuckIngestions()).resolves.toBeUndefined();
    });

    it('sweeps every active tenant and continues past a per-tenant failure', async () => {
      const repo = buildRepo();
      const tenantDbA = { getRepository: jest.fn().mockReturnValue(repo) };
      const tenantService = {
        getAllActiveTenants: jest.fn().mockResolvedValue(['clinic-a', 'clinic-b']),
        getTenantDatabase: jest.fn()
          .mockResolvedValueOnce(tenantDbA)
          .mockRejectedValueOnce(new Error('connection refused')),
      };
      const service = new KnowledgeIngestService({} as any, {} as any, tenantService as any);
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.sweepStuckIngestions();

      expect(tenantService.getTenantDatabase).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('clinic-b'));
    });
  });
});
