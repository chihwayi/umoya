import { MalariaEpisodeService } from './malaria-episode.service';

describe('MalariaEpisodeService', () => {
  it('recordEpisode stores episode with RDT result, severity grade, and ACT dose', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'episode-1', ...value })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new MalariaEpisodeService(tenantService as any);
    const result = await service.recordEpisode('tenant-a', {
      patientId: 'patient-1',
      episodeDate: '2026-04-11',
      rdtResult: 'positive_pf',
      severityGrade: 'severe',
      actDoseMg: 80,
    });

    expect(result.rdtResult).toBe('positive_pf');
    expect(result.severityGrade).toBe('severe');
    expect(result.actDoseMg).toBe(80);
  });

  it('recordIptp stores an IPTp record with dose number', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'episode-2', ...value })),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new MalariaEpisodeService(tenantService as any);
    const result = await service.recordIptp('tenant-a', {
      patientId: 'patient-2',
      episodeDate: '2026-04-11',
      iptpDoseNumber: 2,
    });

    expect(result.iptpSpGiven).toBe(true);
    expect(result.iptpDoseNumber).toBe(2);
  });

  it('getIptpHistory returns only IPTp episodes', async () => {
    const repo = {
      find: jest.fn(async () => [
        { id: 'episode-3', patientId: 'patient-3', iptpSpGiven: true, iptpDoseNumber: 1 },
      ]),
    };
    const db = { getRepository: jest.fn(() => repo) };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };

    const service = new MalariaEpisodeService(tenantService as any);
    const result = await service.getIptpHistory('tenant-a', 'patient-3');

    expect(repo.find).toHaveBeenCalledWith({
      where: { patientId: 'patient-3', iptpSpGiven: true },
      order: { episodeDate: 'DESC', createdAt: 'DESC' },
    });
    expect(result).toHaveLength(1);
  });
});
