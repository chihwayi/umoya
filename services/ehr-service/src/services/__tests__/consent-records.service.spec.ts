import { ConsentRecordsService } from '../consent-records.service';

describe('ConsentRecordsService', () => {
  const service = new ConsentRecordsService();

  describe('hasActiveConsent', () => {
    it('returns false when cnt is 0 (no active consent)', async () => {
      const fakeDb = { query: async () => [{ cnt: 0 }] };
      const result = await service.hasActiveConsent('p1', 'hiv_testing', fakeDb);
      expect(result).toBe(false);
    });

    it('returns true when cnt is 1 (active consent)', async () => {
      const fakeDb = { query: async () => [{ cnt: 1 }] };
      const result = await service.hasActiveConsent('p1', 'hiv_testing', fakeDb);
      expect(result).toBe(true);
    });

    it('returns false when query returns empty array', async () => {
      const fakeDb = { query: async () => [] };
      const result = await service.hasActiveConsent('p1', 'sms_communication', fakeDb);
      expect(result).toBe(false);
    });
  });

  describe('grantConsent', () => {
    it('calls INSERT and returns id from db', async () => {
      const fakeDb = { query: async () => [{ id: 'consent-123' }] };
      const result = await service.grantConsent(
        {
          patientId: 'p1',
          consentType: 'treatment',
          purpose: 'Surgical procedure consent',
          dataCategories: ['medical_history'],
          collectedBy: 'nurse1',
        },
        fakeDb,
      );
      expect(result.id).toBe('consent-123');
    });
  });

  describe('withdrawConsent', () => {
    it('executes UPDATE without throwing', async () => {
      const calls: any[] = [];
      const fakeDb = { query: async (...args: any[]) => { calls.push(args); return []; } };
      await service.withdrawConsent('c1', 'Patient request', fakeDb);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toContain('withdrawn_at = NOW()');
    });
  });
});
