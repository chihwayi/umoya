import axios from 'axios';
import { MflService } from './mfl.service';

jest.mock('axios');

describe('MflService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('upserts Kenya MFL facilities from the live response shape', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      data: {
        results: [
          {
            code: '12345',
            name: 'Nairobi West Clinic',
            county_name: 'Nairobi',
            sub_county_name: 'Westlands',
            facility_type_name: 'Clinic',
            owner_name: 'Private',
            lat: '-1.200000',
            lng: '36.800000',
            phone: '+254700000000',
            email: 'info@example.test',
            active: true,
          },
        ],
        next: null,
      },
    });

    const repo = {
      upsert: jest.fn(async () => undefined),
    };
    const db = {
      getRepository: jest.fn(() => repo),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new MflService(tenantService as any);

    const result = await service.syncFacilities('tenant-a');

    expect(result).toEqual({ synced: 1, errors: 0 });
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          mflCode: '12345',
          facilityName: 'Nairobi West Clinic',
          county: 'Nairobi',
        }),
      ]),
      ['mflCode'],
    );
  });

  it('returns zero sync counts gracefully when the Kenya MFL API is unreachable', async () => {
    (axios.get as jest.Mock).mockRejectedValue({ code: 'ENOTFOUND' });

    const db = {
      getRepository: jest.fn(() => ({ upsert: jest.fn() })),
    };
    const tenantService = { getTenantDatabase: jest.fn(async () => db) };
    const service = new MflService(tenantService as any);

    await expect(service.syncFacilities('tenant-a')).resolves.toEqual({ synced: 0, errors: 0 });
  });
});
