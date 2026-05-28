import { PatientRiskScoringService } from './patient-risk-scoring.service';

function makeService(alertMock?: any) {
  return new PatientRiskScoringService(alertMock ?? null);
}

function makeDb(overrides: Partial<Record<string, any[]>> = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('news2_assessments')) return Promise.resolve(overrides.news2 ?? [{ total_score: 0 }]);
      if (sql.includes('oi_alerts')) return Promise.resolve(overrides.oi ?? [{ cnt: '0' }]);
      if (sql.includes('medication_administrations')) return Promise.resolve(overrides.meds ?? [{ cnt: '0' }]);
      if (sql.includes('is_abnormal')) return Promise.resolve(overrides.vitals ?? [{ cnt: '0' }]);
      if (sql.includes('lab_results')) return Promise.resolve(overrides.labs ?? [{ cnt: '0' }]);
      if (sql.includes('encounters')) return Promise.resolve(overrides.patients ?? []);
      return Promise.resolve([]);
    }),
  };
}

describe('PatientRiskScoringService', () => {
  it('scores low when all components are zero', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.scorePatient('p1', db);
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
  });

  it('scores critical when NEWS2 is maximum', async () => {
    const svc = makeService();
    const db = makeDb({ news2: [{ total_score: 10 }] });
    const result = await svc.scorePatient('p1', db);
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it('does not broadcast for low risk', async () => {
    const alertDelivery = { broadcastCriticalAlert: jest.fn() };
    const svc = makeService(alertDelivery);
    const db = makeDb();
    await svc.scoreAndPersist('p1', db, 'test');
    expect(alertDelivery.broadcastCriticalAlert).not.toHaveBeenCalled();
  });

  it('broadcasts alert for high risk', async () => {
    const alertDelivery = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(alertDelivery);
    // NEWS2=10 (40pts) + 3 OI alerts (capped 20pts) + 1 missed med (3pts) = 63 → high
    const db = makeDb({
      news2: [{ total_score: 10 }],
      oi:    [{ cnt: '3' }],
      meds:  [{ cnt: '1' }],
    });
    await svc.scoreAndPersist('p1', db, 'clinic1');
    expect(alertDelivery.broadcastCriticalAlert).toHaveBeenCalledWith(
      'clinic1',
      expect.objectContaining({ patientId: 'p1' }),
    );
  });

  it('runNightlySweep processes all patients', async () => {
    const svc = makeService();
    const db = makeDb({ patients: [{ id: 'p1' }, { id: 'p2' }] });
    const result = await svc.runNightlySweep(db, 'test');
    expect(result.scored).toBe(2);
  });

  it('getHighRiskPatients returns array', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ patient_id: 'p1', score: 90, risk_level: 'critical' }]) };
    const result = await svc.getHighRiskPatients(db);
    expect(result).toHaveLength(1);
  });
});
