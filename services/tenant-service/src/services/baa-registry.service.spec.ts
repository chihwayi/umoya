import { Repository } from 'typeorm';
import { BaaRegistryEntry } from '../entities/baa-registry.entity';
import { BaaRegistryService } from './baa-registry.service';

describe('BaaRegistryService', () => {
  let service: BaaRegistryService;
  let repo: jest.Mocked<Repository<BaaRegistryEntry>>;

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;
    service = new BaaRegistryService(repo);
  });

  it('getComplianceSummary returns correct counts', async () => {
    repo.find.mockResolvedValue([
      { baaStatus: 'signed' } as BaaRegistryEntry,
      { baaStatus: 'pending' } as BaaRegistryEntry,
      { baaStatus: 'pending' } as BaaRegistryEntry,
      { baaStatus: 'expired' } as BaaRegistryEntry,
      { baaStatus: 'not_required' } as BaaRegistryEntry,
    ]);

    await expect(service.getComplianceSummary()).resolves.toEqual({
      total: 5,
      signed: 1,
      pending: 2,
      expired: 1,
      notRequired: 1,
    });
  });
});
