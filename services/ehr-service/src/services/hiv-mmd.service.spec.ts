import { HivMmdService } from './hiv-mmd.service';

describe('HivMmdService', () => {
  it('scheduleMmd inserts a record with next_due = today + mmdMonths', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue({}) };
    const svc = new HivMmdService();
    await svc.scheduleMmd({ patientId: 'p1', mmdMonths: 3, drugs: ['TDF', '3TC', 'DTG'], daysDispensed: 90, dispensedBy: 'u1', db: mockDb });
    expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('hiv_mmd_schedules'), expect.arrayContaining(['p1', 3, 90, 'u1']));
  });
});
