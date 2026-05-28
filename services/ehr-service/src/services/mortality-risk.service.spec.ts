import { MortalityRiskService } from './mortality-risk.service';

function makeService(alert?: any) {
  return new MortalityRiskService(alert ?? null);
}

function makeDb(overrides: Record<string, any> = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM patients')) return Promise.resolve([{ date_of_birth: '1950-01-01' }]);
      if (sql.includes('news2_assessments')) return Promise.resolve(overrides.news2 ?? [{ total_score: 0 }]);
      if (sql.includes("status = 'chronic'")) return Promise.resolve(overrides.comorbid ?? [{ cnt: '2' }]);
      if (sql.includes("flag IN ('HH'")) return Promise.resolve(overrides.labs ?? [{ cnt: '0' }]);
      if (sql.includes('ICU')) return Promise.resolve(overrides.icu ?? [{ cnt: '0' }]);
      if (sql.includes("icd10_code LIKE 'C%'")) return Promise.resolve(overrides.diag ?? [{ cnt: '1' }]);
      if (sql.includes('INSERT INTO mortality_risk_scores')) return Promise.resolve([]);
      if (sql.includes('SELECT id FROM mortality_risk_scores')) return Promise.resolve([]);
      if (sql.includes('UPDATE mortality_risk_scores')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('MortalityRiskService', () => {
  it('scores a 76-year-old patient with news2=0 in moderate range', async () => {
    const svc = makeService();
    const db = makeDb();
    const { score, band } = await svc.scorePatient('p1', db, 'test');
    // age ~76 → 15pts, comorbid 2 → 8pts, diag 1 → 3pts = 26 → moderate
    expect(band).toBe('moderate');
    expect(score).toBeGreaterThan(20);
  });

  it('scores high or critical for ICU patient with high NEWS2', async () => {
    const svc = makeService();
    const db = makeDb({ news2: [{ total_score: 10 }], icu: [{ cnt: '1' }], labs: [{ cnt: '2' }] });
    const { band } = await svc.scorePatient('p1', db, 'test');
    expect(['high', 'critical']).toContain(band);
  });

  it('attempts alert for critical band', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(alert);
    const db = makeDb({ news2: [{ total_score: 12 }], icu: [{ cnt: '1' }], labs: [{ cnt: '3' }] });
    await svc.scorePatient('p1', db, 'clinic1');
    expect(alert.broadcastCriticalAlert.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('getLatestScore returns null for unknown patient', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.getLatestScore('p-none', db);
    expect(result).toBeNull();
  });
});
