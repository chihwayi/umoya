import axios from 'axios';
import { EtrNetService } from './etr-net.service';

jest.mock('axios');

describe('EtrNetService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.ETR_NET_BASE_URL = 'https://etr.example.test';
    process.env.ETR_NET_API_KEY = 'secret-key';
    process.env.FACILITY_CODE = 'FAC-01';
  });

  it('stores a failed notification when the live ETR.net call is unreachable', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('Network down'));

    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'notif-1', ...value })),
    };
    const db = {
      getRepository: jest.fn(() => repo),
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'tb-1',
            patient_id: 'patient-1',
            registration_date: '2026-04-01',
            patient_category: 'new',
            id_number: '9001011234088',
          },
        ])
        .mockResolvedValueOnce([{ start_date: '2026-04-02' }]),
    };
    const tenantService = {
      getTenantDatabase: jest.fn(async () => db),
    };

    const service = new EtrNetService(tenantService as any);
    const notification = await service.notifyCase('tenant-a', 'tb-1');

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(notification.exportStatus).toBe('failed');
    expect(notification.errorMessage).toContain('Network down');
    expect(notification.payloadJson?.facilityCode).toBe('FAC-01');
  });
});
