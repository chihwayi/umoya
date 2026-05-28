import { AdherenceEngineService } from './adherence-engine.service';

function makeService(alert?: any) {
  return new AdherenceEngineService(alert ?? null);
}

function makeDb(missed7 = '0', missed30 = '0', refills = '0', missedAppts = '0') {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes("INTERVAL '7 days'")) return Promise.resolve([{ cnt: missed7 }]);
      if (sql.includes("INTERVAL '30 days'")) return Promise.resolve([{ cnt: missed30 }]);
      if (sql.includes('next_refill_date')) return Promise.resolve([{ cnt: refills }]);
      if (sql.includes("status = 'no_show'")) return Promise.resolve([{ cnt: missedAppts }]);
      if (sql.includes('INSERT INTO adherence_risk_scores')) return Promise.resolve([]);
      if (sql.includes('FROM adherence_nudges')) return Promise.resolve([]);
      if (sql.includes('FROM patients')) return Promise.resolve([{ first_name: 'John', phone: '+263771234567', drug_name: 'Metformin' }]);
      if (sql.includes('INSERT INTO adherence_nudges')) return Promise.resolve([]);
      if (sql.includes('patient_notifications')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
}

describe('AdherenceEngineService', () => {
  it('scores low when no missed doses', async () => {
    const svc = makeService();
    const db = makeDb();
    const result = await svc.scorePatient('p1', db);
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
  });

  it('scores high_risk with many missed doses', async () => {
    const svc = makeService();
    const db = makeDb('4', '15', '0', '0');
    const result = await svc.scorePatient('p1', db);
    expect(result.level).toBe('high_risk');
  });

  it('does not send duplicate nudge within 24h', async () => {
    const svc = makeService();
    const db = makeDb();
    db.query
      .mockResolvedValueOnce([{ cnt: '0' }])  // missed7
      .mockResolvedValueOnce([{ cnt: '0' }])  // missed30
      .mockResolvedValueOnce([{ cnt: '0' }])  // refills
      .mockResolvedValueOnce([{ cnt: '0' }])  // missedAppts
      .mockResolvedValueOnce([])              // INSERT adherence_risk_scores
      .mockResolvedValueOnce([{ id: 'existing-nudge' }]); // recent nudge exists

    await svc.scorePatient('p1', db);
    const sent = await svc.sendNudge('p1', db, 'test', 'at_risk');
    expect(sent).toBe(false);
  });

  it('sends nudge for at_risk patient with no recent nudge', async () => {
    const alert = { broadcastCriticalAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = makeService(alert);
    const db = makeDb();
    const sent = await svc.sendNudge('p1', db, 'clinic1', 'at_risk');
    expect(sent).toBe(true);
    expect(alert.broadcastCriticalAlert).toHaveBeenCalled();
  });

  it('getAtRiskPatients returns array', async () => {
    const svc = makeService();
    const db = { query: jest.fn().mockResolvedValue([{ patient_id: 'p1', score: 65, risk_level: 'high_risk' }]) };
    const result = await svc.getAtRiskPatients(db);
    expect(result).toHaveLength(1);
  });
});
