import { timepointStatus } from '../patient-portal-hiv.controller';
import { PatientPortalHivController } from '../patient-portal-hiv.controller';

describe('timepointStatus (pure logic)', () => {
  it('returns done when result is set', () => {
    expect(timepointStatus('2026-01-01', 'negative')).toBe('done');
    expect(timepointStatus(null, 'positive')).toBe('done');
  });

  it('returns not_scheduled when due is null and no result', () => {
    expect(timepointStatus(null, null)).toBe('not_scheduled');
  });

  it('returns overdue for a past due date with no result', () => {
    expect(timepointStatus('2025-01-01', null)).toBe('overdue');
  });

  it('returns due_soon within 14 days', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const dueStr = soon.toISOString().split('T')[0];
    expect(timepointStatus(dueStr, null)).toBe('due_soon');
  });

  it('returns upcoming when due date is more than 14 days away', () => {
    const future = new Date();
    future.setDate(future.getDate() + 60);
    const dueStr = future.toISOString().split('T')[0];
    expect(timepointStatus(dueStr, null)).toBe('upcoming');
  });
});

describe('PatientPortalHivController', () => {
  let controller: PatientPortalHivController;

  const makeReq = (patientId: string, dbOverride?: any) => ({
    patientId,
    tenantDb: dbOverride ?? { query: async () => [] },
  });

  beforeEach(() => {
    controller = new PatientPortalHivController();
  });

  describe('getMmdSchedule', () => {
    it('returns null current when no active schedule', async () => {
      const req = makeReq('p1');
      const result = await controller.getMmdSchedule(req);
      expect(result.current).toBeNull();
      expect(result.history).toEqual([]);
    });

    it('returns current schedule when one exists', async () => {
      let call = 0;
      const db = {
        query: async () => {
          call++;
          if (call === 1) return [{ schedule_type: '3-month', next_pickup_date: '2026-07-01', days_until_pickup: 45 }];
          return [];
        },
      };
      const req = makeReq('p1', db);
      const result = await controller.getMmdSchedule(req);
      expect(result.current?.schedule_type).toBe('3-month');
    });
  });

  describe('getSupportGroups', () => {
    it('returns groups where patient is active member', async () => {
      const db = {
        query: async () => [{ id: 'g1', name: 'Teen Club', membership_status: 'active', sessions_attended: 4 }],
      };
      const result = await controller.getSupportGroups(makeReq('p1', db));
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].name).toBe('Teen Club');
    });

    it('returns empty groups when not enrolled', async () => {
      const result = await controller.getSupportGroups(makeReq('p1'));
      expect(result.groups).toHaveLength(0);
    });
  });

  describe('getCommunicationPreferences', () => {
    it('returns smsOptedOut false when no opt-out record', async () => {
      const db = { query: async () => [] };
      const result = await controller.getCommunicationPreferences(makeReq('p1', db));
      expect(result.smsOptedOut).toBe(false);
      expect(result.nudges).toEqual([]);
    });

    it('returns smsOptedOut true when opt-out row exists', async () => {
      let call = 0;
      const db = {
        query: async () => {
          call++;
          if (call === 2) return [{ opted_out_at: '2026-04-01', reason: 'test' }];
          return [];
        },
      };
      const result = await controller.getCommunicationPreferences(makeReq('p1', db));
      expect(result.smsOptedOut).toBe(true);
    });
  });

  describe('getEidSchedule', () => {
    it('annotates overdue timepoints', async () => {
      const db = {
        query: async () => [{
          id: 'e1', infant_name: 'Baby', birth_date: '2025-11-01',
          test_6w_due: '2025-12-15', test_6w_result: null, test_6w_done_at: null,
          test_4m_due: null, test_4m_result: null, test_4m_done_at: null,
          test_12m_due: null, test_12m_result: null, test_12m_done_at: null,
          test_18m_due: null, test_18m_result: null, test_18m_done_at: null,
          nvp_duration_weeks: 6, final_hiv_status: null, transmission_occurred: null,
        }],
      };
      const result = await controller.getEidSchedule(makeReq('p1', db));
      expect(result[0].timepoints[0].status).toBe('overdue');
    });

    it('annotates done timepoints', async () => {
      const db = {
        query: async () => [{
          id: 'e1', infant_name: 'Baby', birth_date: '2025-06-01',
          test_6w_due: '2025-07-15', test_6w_result: 'negative', test_6w_done_at: '2025-07-14',
          test_4m_due: null, test_4m_result: null, test_4m_done_at: null,
          test_12m_due: null, test_12m_result: null, test_12m_done_at: null,
          test_18m_due: null, test_18m_result: null, test_18m_done_at: null,
          nvp_duration_weeks: 6, final_hiv_status: null, transmission_occurred: null,
        }],
      };
      const result = await controller.getEidSchedule(makeReq('p1', db));
      expect(result[0].timepoints[0].status).toBe('done');
    });

    it('annotates not_scheduled timepoints', async () => {
      const db = {
        query: async () => [{
          id: 'e1', infant_name: 'Baby', birth_date: '2026-03-01',
          test_6w_due: null, test_6w_result: null, test_6w_done_at: null,
          test_4m_due: null, test_4m_result: null, test_4m_done_at: null,
          test_12m_due: null, test_12m_result: null, test_12m_done_at: null,
          test_18m_due: null, test_18m_result: null, test_18m_done_at: null,
          nvp_duration_weeks: 6, final_hiv_status: null, transmission_occurred: null,
        }],
      };
      const result = await controller.getEidSchedule(makeReq('p1', db));
      expect(result[0].timepoints[0].status).toBe('not_scheduled');
    });
  });

  describe('getGrowthHistory', () => {
    it('returns measurements and latestStatus', async () => {
      const db = {
        query: async () => [{
          id: 'm1', measurement_date: '2026-04-01', age_months: 12,
          waz: -1.2, haz: -0.8, waz_category: 'normal', haz_category: 'normal',
          nutrition_referral_needed: false,
        }],
      };
      const result = await controller.getGrowthHistory(makeReq('p1', db));
      expect(result.measurements).toHaveLength(1);
      expect(result.latestStatus?.wazCategory).toBe('normal');
      expect(result.latestStatus?.nutritionReferralNeeded).toBe(false);
    });

    it('returns null latestStatus when no measurements', async () => {
      const result = await controller.getGrowthHistory(makeReq('p1'));
      expect(result.measurements).toHaveLength(0);
      expect(result.latestStatus).toBeNull();
    });
  });

  describe('getMyFlags', () => {
    it('returns false for all flags when no records', async () => {
      const result = await controller.getMyFlags(makeReq('p1'));
      expect(result).toEqual({ hasAncRecord: false, hasGrowthRecord: false, hasDentalRecord: false });
    });

    it('returns true for hasAncRecord when ANC row exists', async () => {
      let call = 0;
      const db = {
        query: async () => {
          call++;
          return call === 1 ? [{ id: 'anc1' }] : [];
        },
      };
      const result = await controller.getMyFlags(makeReq('p1', db));
      expect(result.hasAncRecord).toBe(true);
      expect(result.hasGrowthRecord).toBe(false);
    });
  });
});
